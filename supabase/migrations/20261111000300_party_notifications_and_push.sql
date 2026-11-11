create table if not exists public.party_notifications (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.party_participants(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null check (kind in ('reservation','adjustment','cancellation','reminder','event')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists party_notifications_participant_created_idx
  on public.party_notifications (participant_id, created_at desc);
alter table public.party_notifications enable row level security;
revoke all on public.party_notifications from anon, authenticated, public;

create table if not exists public.party_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.party_participants(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists party_push_subscriptions_participant_idx
  on public.party_push_subscriptions (participant_id);
alter table public.party_push_subscriptions enable row level security;
revoke all on public.party_push_subscriptions from anon, authenticated, public;
