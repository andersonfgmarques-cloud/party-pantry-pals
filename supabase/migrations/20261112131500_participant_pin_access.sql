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

create table if not exists public.party_participant_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.party_participants(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);
alter table public.party_participant_sessions enable row level security;
revoke all on public.party_participant_sessions from anon, authenticated;
grant all on public.party_participant_sessions to service_role;

create index if not exists party_participant_sessions_participant_id_idx on public.party_participant_sessions(participant_id);
