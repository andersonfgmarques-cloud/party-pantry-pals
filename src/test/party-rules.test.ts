import { describe, expect, it } from 'vitest';
import { canReserve, canCancel, itemStatus, normalizeName, remainingFor, type Product } from '@/lib/party';
const burger: Product = { id: 'burger', name: 'Hambúrguer', category_id: 2, quantity: 4.5, unit: 'kg', note: null, received: false, created_at: '' };
describe('Regras da festa', () => {
  it('permite contribuição parcial de 2 kg em 4,5 kg', () => expect(canReserve(4.5, 0, 2)).toBe(true));
  it('completa hambúrguer com 2 kg + 2,5 kg', () => expect(itemStatus(burger, 2 + 2.5)).toBe('complete'));
  it('não ultrapassa 4,5 kg', () => expect(canReserve(4.5, 2, 3)).toBe(false));
  it('informa os 2,5 kg ainda necessários', () => expect(remainingFor(burger, 2)).toBe(2.5));
  it('impede cancelar contribuição de outra pessoa', () => expect(canCancel('pessoa1', 'pessoa2', false)).toBe(false));
  it('permite o organizador cancelar', () => expect(canCancel('pessoa1', 'organizador', true)).toBe(true));
  it('normaliza nome para impedir duplicatas na mesma categoria', () => expect(normalizeName(' Café ')).toBe(normalizeName('CAFÉ')));
  it('produto recebido fica azul independentemente da reserva', () => expect(itemStatus({ ...burger, received: true }, 0)).toBe('received'));
  it('quantidades não fornecidas ficam indefinidas', () => expect(remainingFor({ ...burger, quantity: null }, 0)).toBeNull());
});