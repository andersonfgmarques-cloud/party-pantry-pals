import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { Expense, PartyData } from './party';

const identity = z.object({ name: z.string().trim().min(2).max(60), token: z.string().uuid() });
const mutation = z.object({
  token: z.string().uuid().optional(),
  password: z.string().max(200).optional(),
  pin: z.string().optional(),
  action: z.enum(['participant_directory','participant_rename','pin_set','pin_login','participant_logout','add','reserve','cancel','edit','delete','received','event','verify','participants','reservation_status','adjust_reservation','push_config','push_subscribe','push_unsubscribe','notifications','notification_read','audit_history','expenses','expense_add','expense_delete','birthday_add','birthday_edit','birthday_delete','birthday_photos','participant_delete']),
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100).optional(),
  categoryId: z.number().int().min(1).max(6).optional(),
  quantity: z.number().positive().max(100000).nullable().optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  note: z.string().max(500).optional(),
  source: z.enum(['home','buy']).optional(),
  received: z.boolean().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(90).optional(),
  guests: z.number().int().positive().max(100000).nullable().optional(),
  locationUrl: z.string().url().max(2048).nullable().optional(),
  participantId: z.string().uuid().optional(),
  status: z.enum(['planned','purchased','at_home','delivered']).optional(),
  description: z.string().trim().min(1).max(120).optional(),
  amount: z.number().positive().max(10000000).optional(),
  paidBy: z.string().trim().min(2).max(60).optional(),
  subscription: z.record(z.string(), z.unknown()).optional(),
  endpoint: z.string().url().optional(),
  photoData: z.string().max(4200000).optional(),
});
type Mutation = z.infer<typeof mutation>;
type Participant = { id: string; name: string; created_at: string | null };

async function invokePartyApi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('party-api', { body });
  if (error) {
    const context = error.context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.error === 'string') throw new Error(payload.error);
      } catch (cause) {
        if (cause instanceof Error && cause.message !== 'Unexpected end of JSON input') throw cause;
      }
    }
    throw new Error(error.message || 'Não foi possível concluir a operação.');
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function getParty(): Promise<PartyData> {
  const [event, categories, products, reservations, birthdays] = await Promise.all([
    supabase.from('party_event').select('*').eq('id', 1).single(),
    supabase.from('party_categories').select('*').order('id'),
    supabase.from('party_products').select('*').order('created_at').order('name'),
    supabase.from('party_reservations').select('*').order('created_at'),
    supabase.from('party_birthday_people').select('*').order('name'),
  ]);
  for (const result of [event, categories, products, reservations, birthdays]) {
    if (result.error) throw new Error('Não foi possível carregar a lista. Verifique a conexão e as permissões do Supabase.');
  }
  if (!event.data) throw new Error('Evento não encontrado.');
  return { event: event.data, categories: categories.data ?? [], products: products.data ?? [], reservations: reservations.data ?? [], birthdays: birthdays.data ?? [] };
}

export async function identifyParticipant({ data }: { data: z.infer<typeof identity> }): Promise<{id:string;name:string}> {
  const input = identity.parse(data);
  return invokePartyApi({ action: 'identify', ...input });
}

export async function changeParty({ data }: { data: Mutation }): Promise<{ok:boolean;participants:Participant[]}> {
  const input = mutation.parse(data);
  return invokePartyApi({ ...input });
}


export type PartyNotification = { id: string; title: string; body: string; kind: string; created_at: string; read_at: string | null };
export async function getPartyNotifications(token: string): Promise<PartyNotification[]> {
  const result = await invokePartyApi<{ notifications: PartyNotification[] }>({ action: 'notifications', token });
  return result.notifications ?? [];
}
export async function markPartyNotificationRead(token: string, id: string): Promise<void> {
  await invokePartyApi({ action: 'notification_read', token, id });
}
export async function savePushSubscription(token: string, subscription: PushSubscription): Promise<void> {
  await invokePartyApi({ action: 'push_subscribe', token, subscription: subscription.toJSON() });
}
export async function removePushSubscription(token: string, endpoint: string): Promise<void> {
  await invokePartyApi({ action: 'push_unsubscribe', token, endpoint });
}
export async function getPushPublicKey(): Promise<string> {
  const result = await invokePartyApi<{ publicKey: string }>({ action: 'push_config' });
  return result.publicKey;
}

export async function setParticipantPin(token: string, pin: string): Promise<void> {
  await invokePartyApi({ action: 'pin_set', token, pin });
}
export async function loginParticipant(name: string, pin: string): Promise<{ id: string; name: string; token: string }> {
  return invokePartyApi({ action: 'pin_login', name, pin });
}
export async function logoutParticipant(token: string): Promise<void> {
  await invokePartyApi({ action: 'participant_logout', token });
}

export async function renameParticipant(token: string, name: string): Promise<{ id: string; name: string }> {
  return invokePartyApi({ action: 'participant_rename', token, name });
}

export async function getPartyExpenses(password: string): Promise<Expense[]> {
  const result = await invokePartyApi<{ expenses: Expense[] }>({ action: 'expenses', password });
  return result.expenses ?? [];
}

export async function getPartyBirthdayPhotos(token?: string, password?: string): Promise<Record<string, string>> {
  const result = await invokePartyApi<{ photos: { photo_path: string; signed_url: string }[] }>({ action: 'birthday_photos', ...(token ? { token } : {}), ...(password ? { password } : {}) });
  return Object.fromEntries((result.photos ?? []).map(photo => [photo.photo_path, photo.signed_url]));
}
