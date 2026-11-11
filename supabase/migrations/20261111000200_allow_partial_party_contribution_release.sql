create or replace function public.update_party_reservation_quantity(
  p_reservation_id uuid,
  p_quantity numeric
)
returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old_quantity numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  select quantity
    into v_old_quantity
    from public.party_reservations
   where id = p_reservation_id
   for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND';
  end if;

  if p_quantity >= v_old_quantity then
    raise exception 'QUANTITY_MUST_DECREASE';
  end if;

  update public.party_reservations
     set quantity = p_quantity
   where id = p_reservation_id;

  return v_old_quantity - p_quantity;
end;
$$;

revoke all on function public.update_party_reservation_quantity(uuid, numeric) from public, anon, authenticated;
grant execute on function public.update_party_reservation_quantity(uuid, numeric) to service_role;
