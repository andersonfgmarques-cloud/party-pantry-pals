-- Public clients need read-only access to the event data.
-- All writes are performed by the party-api Edge Function using service_role
-- after validating participant ownership or the organizer password.
revoke all privileges on all tables in schema public from anon, authenticated;

grant select on table
  public.party_birthday_people,
  public.party_categories,
  public.party_event,
  public.party_expenses,
  public.party_products,
  public.party_reservations
to anon, authenticated;