import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import type { PartyData } from './party';
import { canCancel } from './party';

export const getParty = createServerFn({ method: 'GET' }).handler(async (): Promise<PartyData> => {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const url = process.env['SUPABASE_URL'];
  if (!key || !url) throw new Error('A lista está temporariamente indisponível.');
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h }); } } });
  const [event, categories, products, reservations] = await Promise.all([db.from('party_event').select('*').single(), db.from('party_categories').select('*').order('id'), db.from('party_products').select('*').order('created_at').order('name'), db.from('party_reservations').select('*').order('created_at')]);
  for (const result of [event, categories, products, reservations]) if (result.error) throw new Error('Não foi possível carregar a lista. Tente novamente.');
  if (!event.data) throw new Error('Evento não encontrado.');
  return { event: event.data, categories: categories.data ?? [], products: products.data ?? [], reservations: reservations.data ?? [] };
});

const identity = z.object({ name: z.string().trim().min(2).max(60), token: z.string().uuid() });
export const identifyParticipant = createServerFn({ method: 'POST' }).inputValidator(identity).handler(async ({ data }) => {
  const { createHash } = await import('node:crypto');
  const hash = createHash('sha256').update(data.token).digest('hex');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const { data: row, error } = await db.from('party_participants').upsert({ name: data.name, token_hash: hash }, { onConflict: 'token_hash' }).select('id,name').single();
  if (error || !row) throw new Error('Não foi possível salvar seu nome.');
  return row;
});

const mutation = z.object({ token: z.string().uuid().optional(), password: z.string().max(200).optional(), action: z.enum(['add','reserve','cancel','edit','delete','received','event','verify','participants']), id: z.string().uuid().optional(), name: z.string().trim().min(1).max(100).optional(), categoryId: z.number().int().min(1).max(6).optional(), quantity: z.number().positive().max(100000).nullable().optional(), unit: z.string().trim().min(1).max(20).optional(), note: z.string().max(500).optional(), source: z.enum(['home','buy']).optional(), received: z.boolean().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), guests: z.number().int().positive().max(100000).nullable().optional(), participantId: z.string().uuid().optional() });
export const changeParty = createServerFn({ method: 'POST' }).inputValidator(mutation).handler(async ({ data }) => {
  const { createHash, timingSafeEqual } = await import('node:crypto');
  const digest = (s: string) => createHash('sha256').update(s).digest();
  let admin = false;
  if (data.password) {
    const expected = process.env['ORGANIZER_PASSWORD'];
    if (!expected) throw new Error('A senha do organizador ainda não foi configurada.');
    admin = timingSafeEqual(digest(data.password), digest(expected));
    if (!admin) throw new Error('Senha incorreta.');
  }
  if (['edit','delete','received','event','verify','participants'].includes(data.action) && !admin) throw new Error('Acesso exclusivo do organizador.');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  let participant: { id: string; name: string } | null = null;
  if (!admin) {
    if (!data.token) throw new Error('Informe seu nome para participar.');
    const { data: row } = await db.from('party_participants').select('id,name').eq('token_hash', digest(data.token).toString('hex')).single();
    if (!row) throw new Error('Informe seu nome para participar.');
    participant = row;
  }
  if (data.action === 'verify') return { ok: true, participants: [] };
  if (data.action === 'participants') { const { data: rows, error } = await db.from('party_participants').select('id,name,created_at').order('name'); if (error) throw new Error('Não foi possível carregar participantes.'); return { ok: true, participants: rows ?? [] }; }
  let error: { message: string; code?: string } | null = null;
  if (data.action === 'add') {
    if (!data.name || !data.categoryId || !data.unit) throw new Error('Preencha nome, categoria e unidade.');
    ({ error } = await db.from('party_products').insert({ name: data.name, category_id: data.categoryId, quantity: data.quantity ?? null, unit: data.unit, note: data.note ?? null }));
  } else if (data.action === 'reserve') {
    if (!data.id || !data.quantity || !data.source) throw new Error('Preencha a quantidade.');
    if (admin && data.participantId) { const { data: row } = await db.from('party_participants').select('id,name').eq('id', data.participantId).single(); participant = row; }
    if (!participant) throw new Error('Selecione um participante.');
    ({ error } = await db.from('party_reservations').insert({ product_id: data.id, participant_id: participant.id, participant_name: participant.name, quantity: data.quantity, source: data.source }));
  } else if (data.action === 'cancel') {
    if (!data.id) throw new Error('Reserva não encontrada.');
    const { data: row } = await db.from('party_reservations').select('participant_id').eq('id', data.id).single();
    if (!row || !canCancel(row.participant_id, participant?.id ?? '', admin)) throw new Error('Você só pode cancelar suas próprias reservas.');
    ({ error } = await db.from('party_reservations').delete().eq('id', data.id));
  } else if (data.action === 'edit') {
    if (!data.id || !data.name || !data.categoryId || !data.unit) throw new Error('Preencha os campos do item.');
    ({ error } = await db.from('party_products').update({ name: data.name, category_id: data.categoryId, quantity: data.quantity ?? null, unit: data.unit, note: data.note ?? null }).eq('id', data.id));
  } else if (data.action === 'delete') {
    if (!data.id) throw new Error('Item não encontrado.');
    ({ error } = await db.from('party_products').delete().eq('id', data.id));
  } else if (data.action === 'received') {
    if (!data.id || data.received === undefined) throw new Error('Item não encontrado.');
    ({ error } = await db.from('party_products').update({ received: data.received }).eq('id', data.id));
  } else if (data.action === 'event') {
    ({ error } = await db.from('party_event').update({ party_date: data.date ?? null, guests: data.guests ?? null }).eq('id', 1));
  }
  if (error) throw new Error(error.code === '23505' ? 'Esse produto já existe nesta categoria.' : error.message.includes('quantidade') || error.message.includes('recebido') || error.message.includes('reservas') ? error.message : 'Não foi possível salvar. Tente novamente.');
  return { ok: true, participants: [] };
});