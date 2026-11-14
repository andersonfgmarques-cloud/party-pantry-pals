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

async function hashPin(pin: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: Uint8Array.from(atob(salt), c => c.charCodeAt(0)), iterations: 310000, hash: "SHA-256" }, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}


async function participantByToken(db: ReturnType<typeof createClient>, token: string) {
  const tokenHash = await sha256(token);
  const { data: session } = await db.from("party_participant_sessions").select("participant_id").eq("token_hash", tokenHash).maybeSingle();
  if (session) {
    const { data } = await db.from("party_participants").select("id,name").eq("id", session.participant_id).maybeSingle();
    if (data) return data;
  }
  const { data } = await db.from("party_participants").select("id,name").eq("token_hash", tokenHash).maybeSingle();
  return data;
}

const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const str = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;

const VAPID_PUBLIC_KEY = "BNwAcnrXDPuMJBu63N2ZIsXfYuxDMEs-ka6NcDvRHv9WCpV64ulBowK2Q7IB10dJHQWw1lBA23PL9E2pFDhrjyo";
async function notifyParticipants(db: ReturnType<typeof createClient>, actorId: string | null, title: string, body: string, kind: "reservation" | "adjustment" | "cancellation" | "reminder" | "event") {
  // Notifications are secondary effects: never report a saved reservation as failed
  // merely because notification delivery is temporarily unavailable.
  try {
    const { data: people, error: peopleError } = await db.from("party_participants").select("id");
    if (peopleError) throw peopleError;
    const recipients = (people ?? []).filter((person) => person.id !== actorId);
    if (!recipients.length) return;
    const { error: notificationError } = await db.from("party_notifications").insert(recipients.map((person) => ({ participant_id: person.id, title, body, kind })));
    if (notificationError) throw notificationError;
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!privateKey) { console.warn("Push disabled: VAPID_PRIVATE_KEY is not configured"); return; }
    const { default: webpush } = await import("npm:web-push@3.6.7");
    webpush.setVapidDetails("mailto:contato@party-pantry-pals.app", VAPID_PUBLIC_KEY, privateKey);
    const { data: subscriptions, error: subscriptionsError } = await db.from("party_push_subscriptions").select("id,subscription").in("participant_id", recipients.map((person) => person.id));
    if (subscriptionsError) throw subscriptionsError;
    await Promise.all((subscriptions ?? []).map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url: "./" }));
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) await db.from("party_push_subscriptions").delete().eq("id", row.id);
        else console.error("Push delivery failed", status ?? "unknown");
      }
    }));
  } catch (error) {
    console.error("Participant notification failed after primary operation", error);
  }
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

    if (action === "public_event") {
      const { data, error } = await db.from("party_event").select("id,name,party_date,party_end_date,party_dates,guests").eq("id", 1).single();
      if (error) throw error;
      return json({ event: data });
    }

    if (action === "event_location" && uuid(body.token)) {
      const participant = await participantByToken(db, body.token);
      if (participant) {
        const { data, error } = await db.from("party_event").select("location_url").eq("id", 1).single();
        if (error) throw error;
        return json({ locationUrl: data?.location_url ?? null });
      }
    }

    if (action === "participant_logout") {
      if (!uuid(body.token)) return json({ error: "Sessão de participante inválida." }, 400);
      const tokenHash = await sha256(body.token);
      const owner = await participantByToken(db, body.token);
      if (!owner) return json({ error: "Esta sessão já foi encerrada." }, 401);
      const { error: sessionError } = await db.from("party_participant_sessions").delete().eq("token_hash", tokenHash);
      if (sessionError) throw sessionError;
      const { error: legacyError } = await db.from("party_participants").update({ token_hash: null }).eq("id", owner.id).eq("token_hash", tokenHash);
      if (legacyError) throw legacyError;
      return json({ ok: true });
    }
    if (action === "pin_set") {
      if (!uuid(body.token) || typeof body.pin !== "string" || !/^\d{6}$/.test(body.pin)) return json({ error: "Defina um PIN de 6 números." }, 400);
      const owner = await participantByToken(db, body.token);
      if (!owner) return json({ error: "Sessão não reconhecida. Entre novamente neste aparelho." }, 401);
      const saltBytes = crypto.getRandomValues(new Uint8Array(16));
      const salt = btoa(String.fromCharCode(...saltBytes));
      const pinHash = await hashPin(body.pin, salt);
      const { error } = await db.from("party_participants").update({ pin_hash: pinHash, pin_salt: salt }).eq("id", owner.id);
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "pin_login") {
      const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
      if (name.length < 2 || name.length > 60 || typeof body.pin !== "string" || !/^\d{6}$/.test(body.pin)) return json({ error: "Informe seu nome e o PIN de 6 números." }, 400);
      const normalizedName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
      const nameHash = await sha256(normalizedName);
      const { data: attempt, error: attemptError } = await db.from("party_pin_login_attempts").select("*").eq("name_hash", nameHash).maybeSingle();
      if (attemptError) throw attemptError;
      const now = Date.now();
      if (attempt?.locked_until && new Date(attempt.locked_until).getTime() > now) return json({ error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." }, 429);
      const { data: candidates, error: lookupError } = await db.from("party_participants").select("id,name,pin_hash,pin_salt").not("pin_hash", "is", null);
      if (lookupError) throw lookupError;
      const matchingNames = (candidates ?? []).filter(candidate => candidate.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR") === normalizedName);
      const matches = [];
      for (const candidate of matchingNames) {
        if (candidate.pin_hash && candidate.pin_salt && safeEqual(await hashPin(body.pin, candidate.pin_salt), candidate.pin_hash)) matches.push(candidate);
      }
      if (matches.length !== 1) {
        const windowExpired = !attempt || now - new Date(attempt.window_started_at).getTime() > 15 * 60 * 1000;
        const attempts = windowExpired ? 1 : Number(attempt.attempts) + 1;
        const { error: attemptSaveError } = await db.from("party_pin_login_attempts").upsert({ name_hash: nameHash, attempts, window_started_at: windowExpired ? new Date().toISOString() : attempt.window_started_at, locked_until: attempts >= 5 ? new Date(now + 15 * 60 * 1000).toISOString() : null });
        if (attemptSaveError) throw attemptSaveError;
        return json({ error: "Nome ou PIN incorreto. Confira os dados e tente novamente." }, 401);
      }
      const { error: clearAttemptError } = await db.from("party_pin_login_attempts").delete().eq("name_hash", nameHash);
      if (clearAttemptError) throw clearAttemptError;
      const token = crypto.randomUUID();
      const { error: tokenError } = await db.from("party_participant_sessions").insert({ participant_id: matches[0].id, token_hash: await sha256(token) });
      if (tokenError) throw tokenError;
      return json({ id: matches[0].id, name: matches[0].name, token });
    }
    if (action === "participant_rename") {
      const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
      if (!uuid(body.token) || name.length < 2 || name.length > 60) return json({ error: "Informe um nome entre 2 e 60 caracteres." }, 400);
      const owner = await participantByToken(db, body.token);
      if (!owner) return json({ error: "Sua sessão não foi reconhecida. Entre novamente para alterar o nome." }, 401);
      const { data, error } = await db.from("party_participants").update({ name }).eq("id", owner.id).select("id,name").single();
      if (error || !data) throw error ?? new Error("Não foi possível atualizar o nome.");
      const { error: reservationsError } = await db.from("party_reservations").update({ participant_name: name }).eq("participant_id", owner.id);
      if (reservationsError) throw reservationsError;
      return json(data);
    }
    if (action === "identify") {
      if (!str(body.name, 60) || body.name.trim().length < 2 || !uuid(body.token)) return json({ error: "Nome ou identificação inválidos." }, 400);
      const { data, error } = await db.from("party_participants").upsert({ name: body.name.trim(), token_hash: await sha256(body.token) }, { onConflict: "token_hash" }).select("id,name").single();
      if (error || !data) return json({ error: "Não foi possível salvar seu nome." }, 400);
      return json(data);
    }
    if (action === "push_config") return json({ publicKey: VAPID_PUBLIC_KEY });
    if (action === "push_subscribe" || action === "push_unsubscribe" || action === "push_status" || action === "notifications" || action === "notification_read") {
      if (!uuid(body.token)) return json({ error: "Identificação do participante inválida." }, 401);
      const owner = await participantByToken(db, body.token);
      if (!owner) return json({ error: "Participante não encontrado." }, 401);
      if (action === "push_subscribe") {
        const subscription = body.subscription;
        if (!subscription || typeof subscription.endpoint !== "string" || !subscription.endpoint.startsWith("https://") || !subscription.keys?.p256dh || !subscription.keys?.auth) return json({ error: "Assinatura de notificações inválida." }, 400);
        const { error } = await db.from("party_push_subscriptions").upsert({ participant_id: owner.id, endpoint: subscription.endpoint, subscription }, { onConflict: "endpoint" });
        if (error) throw error;
        return json({ ok: true });
      }
      if (action === "push_status") {
        if (body.endpoint !== undefined && (typeof body.endpoint !== "string" || !body.endpoint.startsWith("https://"))) {
          return json({ error: "Dispositivo inválido." }, 400);
        }
        if (!body.endpoint) return json({ enabled: false });
        const { data, error } = await db
          .from("party_push_subscriptions")
          .select("id")
          .eq("participant_id", owner.id)
          .eq("endpoint", body.endpoint)
          .maybeSingle();
        if (error) throw error;
        return json({ enabled: !!data });
      }
      if (action === "push_unsubscribe") {
        if (typeof body.endpoint !== "string" || !body.endpoint.startsWith("https://")) {
          return json({ error: "Dispositivo inválido." }, 400);
        }
        const { error } = await db
          .from("party_push_subscriptions")
          .delete()
          .eq("participant_id", owner.id)
          .eq("endpoint", body.endpoint);
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
    if (action === "participant_directory") {
      const { data, error } = await db.from("party_participants").select("id,name,created_at").order("name");
      if (error) throw error;
      return json({ ok: true, participants: data ?? [] });
    }
    const admin = typeof body.password === "string" && safeEqual(body.password, organizerPassword);
    // Every organizer-only action must pass the same IP-based rate limiter.
    const adminActions = ["add", "edit", "delete", "received", "event", "event_location", "verify", "participants", "audit_history", "expenses", "expense_add", "expense_delete", "birthday_add", "birthday_edit", "birthday_delete", "participant_delete"];
    if (adminActions.includes(action)) {
      const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      const clientIp = req.headers.get("cf-connecting-ip")?.trim()
        || req.headers.get("x-real-ip")?.trim()
        || forwardedFor;
      if (!clientIp) return json({ error: "Não foi possível validar a origem da conexão. Tente novamente." }, 503);
      const ipHash = await sha256(`party-admin-rate-limit:${clientIp}:${organizerPassword}`);
      const { data: checkRows, error: checkError } = await db.rpc("party_admin_login_guard", {
        p_ip_hash: ipHash,
        p_action: "check",
      });
      if (checkError) throw checkError;
      const check = Array.isArray(checkRows) ? checkRows[0] : checkRows;
      if (check?.is_locked) {
        return json({ error: "Muitas tentativas de acesso. Aguarde 15 minutos antes de tentar novamente.", retryAfter: check.retry_after_seconds }, 429);
      }
      if (!admin) {
        const { data: failedRows, error: failedError } = await db.rpc("party_admin_login_guard", {
          p_ip_hash: ipHash,
          p_action: "fail",
        });
        if (failedError) throw failedError;
        const failed = Array.isArray(failedRows) ? failedRows[0] : failedRows;
        if (failed?.is_locked) {
          return json({ error: "Limite de tentativas atingido. Acesso bloqueado por 15 minutos.", retryAfter: failed.retry_after_seconds }, 429);
        }
        return json({ error: "Senha incorreta ou acesso exclusivo do organizador." }, 401);
      }
      const { error: resetError } = await db.rpc("party_admin_login_guard", {
        p_ip_hash: ipHash,
        p_action: "reset",
      });
      if (resetError) throw resetError;
    }
    let participant: { id: string; name: string } | null = null;
    if (!admin) {
      if (!uuid(body.token)) return json({ error: "Informe seu nome para participar." }, 401);
      const data = await participantByToken(db, body.token);
      if (!data) return json({ error: "Informe seu nome para participar." }, 401);
      participant = data;
    }
    if (action === "birthday_photos") {
      if (!admin && !participant) return json({ error: "Identifique-se como participante para visualizar as fotos." }, 401);
      const { data: people, error: peopleError } = await db.from("party_birthday_people").select("id,name,photo_path").order("name");
      if (peopleError) throw peopleError;
      const paths = (people ?? []).map(person => person.photo_path);
      if (!paths.length) return json({ photos: [] });
      const { data: signed, error: signedError } = await db.storage.from("party-birthday-photos").createSignedUrls(paths, 3600);
      if (signedError) throw signedError;
      const signedByPath = new Map((signed ?? []).map(item => [item.path, item.signedUrl]));
      return json({ photos: (people ?? []).flatMap(person => {
        const signedUrl = signedByPath.get(person.photo_path);
        return signedUrl ? [{ id: person.id, name: person.name, photo_path: person.photo_path, signed_url: signedUrl }] : [];
      }) });
    }
    if (action === "verify") return json({ ok: true, participants: [] });
    if (action === "audit_history") {
      const { data, error } = await db.from("party_audit_log").select("id,action,entity_type,entity_name,actor_name,details,created_at").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return json({ ok: true, history: data ?? [] });
    }
    if (action === "participants") {
      const { data, error } = await db.from("party_participants").select("id,name,created_at").order("name");
      if (error) throw error;
      return json({ ok: true, participants: data ?? [] });
    }
    if (action === "expenses") {
      const { data, error } = await db.from("party_expenses").select("*").order("created_at");
      if (error) throw error;
      return json({ ok: true, expenses: data ?? [] });
    }
    if (action === "participant_delete") {
      if (!admin || !uuid(body.id)) return json({ error: "Ação exclusiva do organizador ou participante inválido." }, 403);
      const { data: target, error: lookupError } = await db.from("party_participants").select("id,name").eq("id", body.id).maybeSingle();
      if (lookupError) throw lookupError;
      if (!target) return json({ error: "Participante não encontrado." }, 404);
      const { error } = await db.from("party_participants").delete().eq("id", target.id);
      if (error) throw error;
      return json({ ok: true, deletedParticipant: target.id });
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
      const { data: row } = await db.from("party_reservations").select("participant_id,status,product_id").eq("id", body.id).single();
      if (!row || (!admin && row.participant_id !== participant?.id)) return json({ error: "Você só pode atualizar sua própria contribuição." }, 403);
      result = await db.from("party_reservations").update({ status: body.status }).eq("id", body.id);
      if (!result.error && row.status !== body.status) {
        const { data: product } = await db.from("party_products").select("name").eq("id", row.product_id).single();
        const labels: Record<string,string> = { planned: "planejada", purchased: "comprada", at_home: "já está em casa", delivered: "entregue" };
        await notifyParticipants(db, participant?.id ?? null, "Situação de contribuição atualizada", `${product?.name ?? "Um item"} agora está: ${labels[body.status] ?? body.status}.`, "event");
      }
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
      const { data: product } = await db.from("party_products").select("name,received").eq("id", body.id).single();
      result = await db.from("party_products").update({ received: body.received }).eq("id", body.id);
      if (!result.error && product && product.received !== body.received) {
        await notifyParticipants(db, null, body.received ? "Item recebido!" : "Situação do item atualizada", body.received ? `${product.name} foi marcado como recebido.` : `${product.name} não está mais marcado como recebido.`, "event");
      }
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
    } else if (action === "event_location") {
      const { data, error } = await db.from("party_event").select("location_url").eq("id", 1).single();
      if (error) throw error;
      return json({ locationUrl: data?.location_url ?? null });
    } else if (action === "event") {
      const locationUrl = body.locationUrl;
      if (locationUrl !== undefined && locationUrl !== null && locationUrl !== "") {
        if (typeof locationUrl !== "string" || locationUrl.length > 2048) return json({ error: "O link do local é inválido ou muito longo." }, 400);
        let parsed: URL;
        try { parsed = new URL(locationUrl); } catch { return json({ error: "Cole um link válido do Google Maps." }, 400); }
        const allowedHosts = ["maps.app.goo.gl", "maps.google.com", "google.com", "www.google.com"];
        if (parsed.protocol !== "https:" || !allowedHosts.includes(parsed.hostname) || ((parsed.hostname === "google.com" || parsed.hostname === "www.google.com") && !parsed.pathname.startsWith("/maps"))) return json({ error: "Use um link HTTPS compartilhado pelo Google Maps." }, 400);
      }
      const dates = Array.isArray(body.dates)
        ? [...new Set(body.dates.filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)))].sort()
        : body.date ? [body.date] : [];
      if (dates.length > 90 || (Array.isArray(body.dates) && dates.length !== body.dates.length)) return json({ error: "Selecione até 90 datas válidas, sem repetição." }, 400);
      result = await db.from("party_event").update({ party_dates: dates, party_date: dates[0] ?? null, party_end_date: dates.at(-1) ?? null, guests: body.guests ?? null, location_url: locationUrl || null }).eq("id", 1);
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
