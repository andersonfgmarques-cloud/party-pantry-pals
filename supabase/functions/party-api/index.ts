import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const encoder = new TextEncoder();
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const str = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;

const VAPID_PUBLIC_KEY = "BNwAcnrXDPuMJBu63N2ZIsXfYuxDMEs-ka6NcDvRHv9WCpV64ulBowK2Q7IB10dJHQWw1lBA23PL9E2pFDhrjyo";
async function notifyParticipants(db: ReturnType<typeof createClient>, actorId: string | null, title: string, body: string, kind: "reservation" | "adjustment" | "cancellation" | "reminder" | "event") {
  const { data: people } = await db.from("party_participants").select("id");
  const recipients = (people ?? []).filter((person) => person.id !== actorId);
  if (!recipients.length) return;
  await db.from("party_notifications").insert(recipients.map((person) => ({ participant_id: person.id, title, body, kind })));
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!privateKey) return;
  const { default: webpush } = await import("npm:web-push@3.6.7");
  webpush.setVapidDetails("mailto:contato@party-pantry-pals.app", VAPID_PUBLIC_KEY, privateKey);
  const { data: subscriptions } = await db.from("party_push_subscriptions").select("id,subscription").in("participant_id", recipients.map((person) => person.id));
  await Promise.all((subscriptions ?? []).map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url: "./" }));
    } catch (error) {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) await db.from("party_push_subscriptions").delete().eq("id", row.id);
      else console.error("Push delivery failed", status ?? "unknown");
    }
  }));
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const organizerPassword = Deno.env.get("ORGANIZER_PASSWORD");
    if (!url || !key || !organizerPassword) return json({ error: "A função ainda não foi configurada." }, 503);
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();
    const action = body?.action;
    if (action === "identify") {
      if (!str(body.name, 60) || body.name.trim().length < 2 || !uuid(body.token)) return json({ error: "Nome ou identificação inválidos." }, 400);
      const { data, error } = await db.from("party_participants").upsert({ name: body.name.trim(), token_hash: await sha256(body.token) }, { onConflict: "token_hash" }).select("id,name").single();
      if (error || !data) return json({ error: "Não foi possível salvar seu nome." }, 400);
      return json(data);
    }
    if (action === "public_participants") {
      const { data, error } = await db.from("party_participants").select("id,name,created_at").order("name");
      if (error) throw error;
      return json({ ok: true, participants: data ?? [] });
    }
    if (action === "push_config") return json({ publicKey: VAPID_PUBLIC_KEY });
    if (action === "push_subscribe" || action === "push_unsubscribe" || action === "notifications" || action === "notification_read") {
      if (!uuid(body.token)) return json({ error: "Identificação do participante inválida." }, 401);
      const { data: owner } = await db.from("party_participants").select("id").eq("token_hash", await sha256(body.token)).single();
      if (!owner) return json({ error: "Participante não encontrado." }, 401);
      if (action === "push_subscribe") {
        const subscription = body.subscription;
        if (!subscription || typeof subscription.endpoint !== "string" || !subscription.endpoint.startsWith("https://") || !subscription.keys?.p256dh || !subscription.keys?.auth) return json({ error: "Assinatura de notificações inválida." }, 400);
        const { error } = await db.from("party_push_subscriptions").upsert({ participant_id: owner.id, endpoint: subscription.endpoint, subscription }, { onConflict: "endpoint" });
        if (error) throw error;
        return json({ ok: true });
      }
      if (action === "push_unsubscribe") {
        if (typeof body.endpoint !== "string") return json({ error: "Dispositivo inválido." }, 400);
        const { error } = await db.from("party_push_subscriptions").delete().eq("participant_id", owner.id).eq("endpoint", body.endpoint);
        if (error) throw error;
        return json({ ok: true });
      }
      if (action === "notifications") {
        const { data, error } = await db.from("party_notifications").select("id,title,body,kind,created_at,read_at").eq("participant_id", owner.id).order("created_at", { ascending: false }).limit(30);
        if (error) throw error;
        return json({ notifications: data ?? [] });
      }
      if (!uuid(body.id)) return json({ error: "Notificação inválida." }, 400);
      const { error } = await db.from("party_notifications").update({ read_at: new Date().toISOString() }).eq("id", body.id).eq("participant_id", owner.id);
      if (error) throw error;
      return json({ ok: true });
    }
    const admin = typeof body.password === "string" && body.password === organizerPassword;
    const adminActions = ["edit", "delete", "received", "event", "verify", "participants"];
    if (adminActions.includes(action) && !admin) return json({ error: "Senha incorreta ou acesso exclusivo do organizador." }, 401);
    let participant: { id: string; name: string } | null = null;
    if (!admin) {
      if (!uuid(body.token)) return json({ error: "Informe seu nome para participar." }, 401);
      const { data } = await db.from("party_participants").select("id,name").eq("token_hash", await sha256(body.token)).single();
      if (!data) return json({ error: "Informe seu nome para participar." }, 401);
      participant = data;
    }
    if (action === "verify") return json({ ok: true, participants: [] });
    if (action === "participants") {
      const { data, error } = await db.from("party_participants").select("id,name,created_at").order("name");
      if (error) throw error;
      return json({ ok: true, participants: data ?? [] });
    }
    let result;
    if (action === "add") {
      if (!str(body.name, 100) || !Number.isInteger(body.categoryId) || !str(body.unit, 20)) return json({ error: "Preencha nome, categoria e unidade." }, 400);
      result = await db.from("party_products").insert({ name: body.name.trim(), category_id: body.categoryId, quantity: body.quantity ?? null, unit: body.unit, note: body.note ?? null });
    } else if (action === "reserve") {
      if (!uuid(body.id) || !Number.isFinite(body.quantity) || body.quantity <= 0 || !["home", "buy"].includes(body.source)) return json({ error: "Dados da reserva inválidos." }, 400);
      if (admin && uuid(body.participantId)) {
        const { data } = await db.from("party_participants").select("id,name").eq("id", body.participantId).single();
        participant = data;
      }
      if (!participant) return json({ error: "Selecione um participante." }, 400);
      const { data: reservationId, error: reserveError } = await db.rpc("reserve_party_item", { p_product_id: body.id, p_participant_id: participant.id, p_participant_name: participant.name, p_quantity: body.quantity, p_source: body.source });
      if (reserveError) return json({ error: reserveError.message.includes("INSUFFICIENT_QUANTITY") ? "Essa quantidade acabou de ser reservada por outra pessoa. Atualize a lista e tente novamente." : "Não foi possível reservar esse item." }, 409);
      result = { error: null, data: reservationId };
      const { data: product } = await db.from("party_products").select("name,unit").eq("id", body.id).single();
      await notifyParticipants(db, participant.id, "Nova contribuição na festa", `${participant.name} assumiu ${body.quantity} ${product?.unit ?? ""} de ${product?.name ?? "um item"}.`, "reservation");
    } else if (action === "cancel") {
      if (!uuid(body.id)) return json({ error: "Reserva não encontrada." }, 400);
      const { data: row } = await db.from("party_reservations").select("participant_id,product_id").eq("id", body.id).single();
      if (!row || (!admin && row.participant_id !== participant?.id)) return json({ error: "Você só pode cancelar suas próprias reservas." }, 403);
      const { data: product } = await db.from("party_products").select("name").eq("id", row.product_id).single();
      result = await db.from("party_reservations").delete().eq("id", body.id);
      if (!result.error) await notifyParticipants(db, participant?.id ?? null, "Contribuição liberada", `Uma contribuição de ${product?.name ?? "um item"} foi cancelada e voltou a ficar disponível.`, "cancellation");
    } else if (action === "adjust_reservation") {
      if (!uuid(body.id) || !Number.isFinite(body.quantity) || body.quantity <= 0) return json({ error: "Informe uma quantidade válida." }, 400);
      const { data: row } = await db.from("party_reservations").select("participant_id,quantity,product_id").eq("id", body.id).single();
      if (!row || (!admin && row.participant_id !== participant?.id)) return json({ error: "Você só pode ajustar suas próprias contribuições." }, 403);
      if (body.quantity >= Number(row.quantity)) return json({ error: "A nova quantidade precisa ser menor que a quantidade atual." }, 400);
      const { data: released, error: adjustError } = await db.rpc("update_party_reservation_quantity", { p_reservation_id: body.id, p_quantity: body.quantity });
      if (adjustError) return json({ error: "Não foi possível ajustar a quantidade. Atualize a lista e tente novamente." }, 409);
      const { data: product } = await db.from("party_products").select("name,unit").eq("id", row.product_id).single();
      await notifyParticipants(db, participant?.id ?? null, "Quantidade atualizada", `${Number(released)} ${product?.unit ?? ""} de ${product?.name ?? "um item"} foram liberados para a lista.`, "adjustment");
      return json({ ok: true, released });
    } else if (action === "reservation_status") {
      if (!uuid(body.id) || !["planned","purchased","at_home","delivered"].includes(body.status)) return json({ error: "Situação inválida." }, 400);
      const { data: row } = await db.from("party_reservations").select("participant_id").eq("id", body.id).single();
      if (!row || (!admin && row.participant_id !== participant?.id)) return json({ error: "Você só pode atualizar sua própria contribuição." }, 403);
      result = await db.from("party_reservations").update({ status: body.status }).eq("id", body.id);
    } else if (action === "expense_add") {
      if (!admin || !str(body.description, 120) || !Number.isFinite(body.amount) || body.amount <= 0 || !str(body.paidBy, 60)) return json({ error: "Informe descrição, valor e responsável pelo pagamento." }, 400);
      result = await db.from("party_expenses").insert({ description: body.description.trim(), amount: body.amount, paid_by: body.paidBy.trim() });
    } else if (action === "expense_delete") {
      if (!admin || !uuid(body.id)) return json({ error: "Ação exclusiva do organizador." }, 403);
      result = await db.from("party_expenses").delete().eq("id", body.id);
    } else if (action === "edit") {
      if (!uuid(body.id) || !str(body.name, 100) || !Number.isInteger(body.categoryId) || !str(body.unit, 20)) return json({ error: "Preencha os campos do item." }, 400);
      result = await db.from("party_products").update({ name: body.name.trim(), category_id: body.categoryId, quantity: body.quantity ?? null, unit: body.unit, note: body.note ?? null }).eq("id", body.id);
    } else if (action === "delete") {
      if (!uuid(body.id)) return json({ error: "Item não encontrado." }, 400);
      result = await db.from("party_products").delete().eq("id", body.id);
    } else if (action === "received") {
      if (!uuid(body.id) || typeof body.received !== "boolean") return json({ error: "Item não encontrado." }, 400);
      result = await db.from("party_products").update({ received: body.received }).eq("id", body.id);
    } else if (action === "birthday_add" || action === "birthday_edit" || action === "birthday_delete") {
      if (!admin) return json({ error: "Ação exclusiva do organizador." }, 403);
      if (action === "birthday_delete") {
        if (!uuid(body.id)) return json({ error: "Aniversariante não encontrado." }, 400);
        const { data: current } = await db.from("party_birthday_people").select("photo_path").eq("id", body.id).single();
        if (!current) return json({ error: "Aniversariante não encontrado." }, 404);
        const { error } = await db.from("party_birthday_people").delete().eq("id", body.id);
        if (error) throw error;
        await db.storage.from("party-birthday-photos").remove([current.photo_path]);
        return json({ ok: true });
      }
      if (!str(body.name, 60)) return json({ error: "Informe o nome do aniversariante (até 60 caracteres)." }, 400);
      let photoPath: string | undefined;
      if (typeof body.photoData === "string") {
        const match = body.photoData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
        if (!match || match[2].length > 4194304) return json({ error: "Envie uma foto JPG, PNG ou WebP de até 3 MB." }, 400);
        const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
        const extension = match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg";
        photoPath = `${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await db.storage.from("party-birthday-photos").upload(photoPath, bytes, { contentType: match[1], upsert: false });
        if (uploadError) throw uploadError;
      }
      if (action === "birthday_add" && !photoPath) return json({ error: "Selecione uma foto para o aniversariante." }, 400);
      if (action === "birthday_edit") {
        if (!uuid(body.id)) return json({ error: "Aniversariante não encontrado." }, 400);
        const { data: current } = await db.from("party_birthday_people").select("photo_path").eq("id", body.id).single();
        if (!current) return json({ error: "Aniversariante não encontrado." }, 404);
        const { error } = await db.from("party_birthday_people").update({ name: body.name.trim(), ...(photoPath ? { photo_path: photoPath } : {}) }).eq("id", body.id);
        if (error) throw error;
        if (photoPath) await db.storage.from("party-birthday-photos").remove([current.photo_path]);
      } else {
        const { error } = await db.from("party_birthday_people").insert({ name: body.name.trim(), photo_path: photoPath! });
        if (error) throw error;
      }
      return json({ ok: true });
    } else if (action === "event") {
      if (body.date && body.endDate && body.endDate < body.date) return json({ error: "A data final não pode ser anterior à data inicial." }, 400);
      result = await db.from("party_event").update({ party_date: body.date ?? null, party_end_date: body.endDate ?? null, guests: body.guests ?? null }).eq("id", 1);
    } else {
      return json({ error: "Ação não reconhecida." }, 400);
    }
    if (result.error) return json({ error: result.error.code === "23505" ? "Esse produto já existe nesta categoria." : "Não foi possível salvar. Tente novamente." }, 400);
    return json({ ok: true, participants: [] });
  } catch (error) {
    console.error("party-api error", error);
    return json({ error: "Não foi possível concluir a operação." }, 500);
  }
});
