import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { Expense, PartyData } from './party';

const identity = z.object({ name: z.string().trim().min(2).max(60), token: z.string().uuid() });
const mutation = z.object({
  token: z.string().uuid().optional(),
  password: z.string().max(200).optional(),
  pin: z.string().optional(),
  action: z.enum(['participant_directory','participant_rename','pin_set','pin_login','participant_logout','add','reserve','cancel','edit','delete','received','event','verify','participants','reservation_status','adjust_reservation','push_config','push_subscribe','push_unsubscribe','push_status','notifications','notification_read','audit_history','expenses','expense_add','expense_delete','birthday_add','birthday_edit','birthday_delete','birthday_photos','participant_delete','contribution_overview','family_assign','product_reference_price']),
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
  familyId: z.number().int().min(1).max(6).nullable().optional(),
  referencePrice: z.number().min(0).nullable().optional(),
  referenceSource: z.enum(['Assaí','Higa','Max Atacadista','Preço informado','Estimativa']).optional(),
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
  const [eventResult, categories, products, reservations, birthdays] = await Promise.all([
    invokePartyApi<{ event: Omit<Database['public']['Tables']['party_event']['Row'], 'location_url'>; participantCount: number }>({ action: 'public_event' }),
    supabase.from('party_categories').select('*').order('id'),
    supabase.from('party_products').select('*').order('created_at').order('name'),
    supabase.from('party_reservations').select('*').order('created_at'),
    supabase.from('party_birthday_people').select('*').order('name'),
  ]);
  for (const result of [categories, products, reservations, birthdays]) {
    if (result.error) throw new Error('Não foi possível carregar a lista. Verifique a conexão e as permissões do Supabase.');
  }
  if (!eventResult.event) throw new Error('Evento não encontrado.');
  return { event: { ...eventResult.event, location_url: null }, participantCount: eventResult.participantCount ?? 0, categories: categories.data ?? [], products: products.data ?? [], reservations: reservations.data ?? [], birthdays: birthdays.data ?? [] };
}

export async function getPartyLocation(token?: string, password?: string): Promise<string | null> {
  const result = await invokePartyApi<{ locationUrl: string | null }>({ action: 'event_location', ...(token ? { token } : {}), ...(password ? { password } : {}) });
  return result.locationUrl ?? null;
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
export async function markAllPartyNotificationsRead(token: string): Promise<void> {
  await invokePartyApi({ action: 'notification_read_all', token });
}
export async function savePushSubscription(token: string, subscription: PushSubscription): Promise<void> {
  await invokePartyApi({ action: 'push_subscribe', token, subscription: subscription.toJSON() });
}
export async function getPushStatus(token: string, endpoint?: string): Promise<{ enabled: boolean }> {
  return invokePartyApi({ action: 'push_status', token, ...(endpoint ? { endpoint } : {}) });
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

export type ContributionOverview = {
  families: { id: number; name: string; target_amount: number }[];
  participants: { id: string; name: string; family_id: number | null; created_at: string | null }[];
  products: { id: string; name: string; unit: string; reference_price: number | null; reference_source: string | null; reference_updated_at: string | null }[];
  reservations: { id: string; product_id: string; participant_id: string; participant_name: string; quantity: number; source: string; status: string | null }[];
};
export async function getContributionOverview(password: string): Promise<ContributionOverview> {
  return invokePartyApi<ContributionOverview>({ action: 'contribution_overview', password });
}

export type ManagedEvent = { id:string; legacy_event_id:number|null; name:string; description:string|null; starts_at:string|null; ends_at:string|null; location:string|null; status:"planning"|"active"|"completed"|"cancelled"; currency:string; contingency_percent:number; standard_quota:number; created_at:string; updated_at:string };
export type EventPricingRule = { id?:string; attendeeType:"couple"|"individual"|"child"|"extra_guest"; label:string; ageMin?:number|null; ageMax?:number|null; chargeMode:"free"|"half"|"fixed"|"standard"; amount:number; active?:boolean; sortOrder?:number };
export type EventFinancialOverview = { collected:number; refunded:number; netCollected:number; expenses:number; balance:number; plannedBudget:number; budgetActual:number; contingencyPercent:number; pendingPayments:number };
export async function getManagedEvents(password:string):Promise<ManagedEvent[]> {
  const r=await invokePartyApi<{events:ManagedEvent[]}>({action:"managed_events",password}); return r.events ?? [];
}
export async function createManagedEvent(password:string,input:{name:string;description?:string;location?:string;startsAt?:string|null;endsAt?:string|null;contingencyPercent?:number;standardQuota?:number}):Promise<ManagedEvent> {
  const r=await invokePartyApi<{event:ManagedEvent}>({action:"managed_event_create",password,...input}); return r.event;
}
export async function updateManagedEvent(password:string,eventId:string,input:Partial<Pick<ManagedEvent,"name"|"description"|"location"|"status">>&{startsAt?:string|null;endsAt?:string|null;contingencyPercent?:number;standardQuota?:number}):Promise<ManagedEvent> {
  const r=await invokePartyApi<{event:ManagedEvent}>({action:"managed_event_update",password,eventId,...input}); return r.event;
}
export async function getEventCollection<T=unknown>(password:string,eventId:string,collection:"event_pricing_rules"|"event_attendees"|"event_budget"|"event_payments"|"event_expenses"):Promise<T[]> {
  const r=await invokePartyApi<{rows:T[]}>({action:collection,password,eventId}); return r.rows ?? [];
}
export async function saveEventPricingRules(password:string,eventId:string,rules:EventPricingRule[]):Promise<void> {
  await invokePartyApi({action:"event_pricing_rules_save",password,eventId,rules});
}
export async function getEventFinancialOverview(password:string,eventId:string):Promise<EventFinancialOverview> {
  const r=await invokePartyApi<{overview:EventFinancialOverview}>({action:"event_financial_overview",password,eventId}); return r.overview;
}
export async function addEventAttendee(password:string,input:{eventId:string;displayName:string;attendeeType:EventPricingRule["attendeeType"];responsibleAttendeeId?:string;participantId?:string;birthDate?:string;ageAtEvent?:number;quantity?:number;notes?:string}) {
  return invokePartyApi({action:"event_attendee_add",password,...input});
}
export async function saveEventBudgetItem(password:string,input:{eventId:string;id?:string;category:"venue"|"food"|"drinks"|"decoration"|"entertainment"|"transport"|"other";description:string;plannedAmount:number;actualAmount?:number}) {
  return invokePartyApi({action:"event_budget_save",password,...input});
}
export async function addEventPayment(password:string,input:{eventId:string;attendeeId?:string;payerName:string;amount:number;method:"pix"|"cash"|"transfer"|"card"|"other";status?:"pending"|"confirmed";notes?:string}) {
  return invokePartyApi({action:"event_payment_add",password,...input});
}
export async function addEventExpense(password:string,input:{eventId:string;budgetItemId?:string;description:string;amount:number;paidBy:string;notes?:string}) {
  return invokePartyApi({action:"event_expense_add",password,...input});
}
export async function uploadEventReceipt(password:string,eventId:string,recordType:"payment"|"expense",recordId:string,file:File):Promise<void> {
  const allowed=["application/pdf","image/jpeg","image/png","image/webp"];
  if(!allowed.includes(file.type)||file.size<=0||file.size>10*1024*1024) throw new Error("Envie PDF, JPG, PNG ou WEBP de até 10 MB.");
  const signed=await invokePartyApi<{path:string;token:string}>({action:"receipt_upload_url",password,eventId,recordType,recordId,fileName:file.name,contentType:file.type,fileSize:file.size});
  const {error}=await supabase.storage.from("festou-private-receipts").uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type,upsert:false});
  if(error) throw new Error(error.message||"Falha ao enviar comprovante.");
  await invokePartyApi({action:"receipt_attach",password,eventId,recordType,recordId,path:signed.path});
}
export async function getEventReceiptUrl(password:string,eventId:string,recordType:"payment"|"expense",recordId:string):Promise<string> {
  const result=await invokePartyApi<{signedUrl:string}>({action:"receipt_download_url",password,eventId,recordType,recordId});
  return result.signedUrl;
}
export async function addEventRefund(password:string,input:{eventId:string;paymentId:string;amount:number;reason:string}) {
  return invokePartyApi({action:"event_refund_add",password,...input});
}
