import type { Database } from '@/integrations/supabase/types';
export type Product = Database['public']['Tables']['party_products']['Row'];
export type Reservation = Database['public']['Tables']['party_reservations']['Row'];
export type Expense = Database['public']['Tables']['party_expenses']['Row'];
export type PartyData = { expenses: Expense[]; event: Database['public']['Tables']['party_event']['Row']; categories: Database['public']['Tables']['party_categories']['Row'][]; products: Product[]; reservations: Reservation[] };
export function reservedFor(id: string, reservations: Reservation[]) { return reservations.filter(r => r.product_id === id).reduce((sum, r) => sum + Number(r.quantity), 0); }
export function itemStatus(product: Product, reserved: number) { return product.received ? 'received' : product.quantity !== null && reserved >= Number(product.quantity) ? 'complete' : reserved > 0 ? 'partial' : 'available'; }
export function remainingFor(product: Product, reserved: number) { return product.quantity === null ? null : Math.max(0, Number(product.quantity) - reserved); }
export function canReserve(needed: number | null, reserved: number, amount: number) { return Number.isFinite(amount) && amount > 0 && (needed === null || reserved + amount <= needed); }
export function normalizeName(name: string) { return name.trim().toLocaleLowerCase('pt-BR'); }
export function canCancel(ownerId: string, callerId: string, admin: boolean) { return admin || ownerId === callerId; }
export const number = (n: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(n);
export const statusLabels = { available: 'Disponível', partial: 'Parcialmente reservado', complete: 'Completo', received: 'Recebido' };