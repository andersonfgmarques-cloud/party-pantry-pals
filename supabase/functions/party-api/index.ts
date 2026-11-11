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
      result = await db.from("party_reservations").insert({ product_id: body.id, participant_id: participant.id, participant_name: participant.name, quantity: body.quantity, source: body.source });
    } else if (action === "cancel") {
      if (!uuid(body.id)) return json({ error: "Reserva não encontrada." }, 400);
      const { data: row } = await db.from("party_reservations").select("participant_id").eq("id", body.id).single();
      if (!row || (!admin && row.participant_id !== participant?.id)) return json({ error: "Você só pode cancelar suas próprias reservas." }, 403);
      result = await db.from("party_reservations").delete().eq("id", body.id);
    } else if (action === "edit") {
      if (!uuid(body.id) || !str(body.name, 100) || !Number.isInteger(body.categoryId) || !str(body.unit, 20)) return json({ error: "Preencha os campos do item." }, 400);
      result = await db.from("party_products").update({ name: body.name.trim(), category_id: body.categoryId, quantity: body.quantity ?? null, unit: body.unit, note: body.note ?? null }).eq("id", body.id);
    } else if (action === "delete") {
      if (!uuid(body.id)) return json({ error: "Item não encontrado." }, 400);
      result = await db.from("party_products").delete().eq("id", body.id);
    } else if (action === "received") {
      if (!uuid(body.id) || typeof body.received !== "boolean") return json({ error: "Item não encontrado." }, 400);
      result = await db.from("party_products").update({ received: body.received }).eq("id", body.id);
    } else if (action === "event") {
      result = await db.from("party_event").update({ party_date: body.date ?? null, guests: body.guests ?? null }).eq("id", 1);
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
