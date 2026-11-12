alter table public.party_participants
  add column if not exists pin_hash text,
  add column if not exists pin_salt text;

create table if not exists public.party_pin_login_attempts (
  name_hash text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);
alter table public.party_pin_login_attempts enable row level security;
revoke all on public.party_pin_login_attempts from anon, authenticated;
grant all on public.party_pin_login_attempts to service_role;
