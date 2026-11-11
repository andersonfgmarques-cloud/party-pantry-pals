alter table public.party_event
  add column if not exists party_end_date date;

alter table public.party_event
  add constraint party_event_date_range_check
  check (party_end_date is null or party_date is null or party_end_date >= party_date);