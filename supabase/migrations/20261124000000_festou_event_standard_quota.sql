-- Add an event-level standard contribution quota for automatic attendee pricing.
alter table public.party_managed_events
  add column if not exists standard_quota numeric(12,2) not null default 0
  check (standard_quota >= 0);
