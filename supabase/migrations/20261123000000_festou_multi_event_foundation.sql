-- Festou! multi-event foundation. Additive only: legacy tables and reservations remain untouched.
create table if not exists public.party_managed_events (
  id uuid primary key default gen_random_uuid(),
  legacy_event_id integer unique references public.party_event(id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  status text not null default 'planning' check (status in ('planning','active','completed','cancelled')),
  currency char(3) not null default 'BRL',
  contingency_percent numeric(5,2) not null default 0 check (contingency_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table if not exists public.party_event_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.party_managed_events(id) on delete cascade,
  attendee_type text not null check (attendee_type in ('couple','individual','child','extra_guest')),
  label text not null check (char_length(trim(label)) between 1 and 80),
  age_min integer check (age_min is null or age_min between 0 and 120),
  age_max integer check (age_max is null or age_max between 0 and 120),
  charge_mode text not null check (charge_mode in ('free','half','fixed','standard')),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (age_max is null or age_min is null or age_max >= age_min),
  check ((attendee_type = 'child' and age_min is not null and age_max is not null) or attendee_type <> 'child'),
  check ((charge_mode = 'fixed' and amount >= 0) or charge_mode <> 'fixed')
);
create index if not exists party_event_pricing_rules_event_idx on public.party_event_pricing_rules(event_id, active, sort_order);

create table if not exists public.party_event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.party_managed_events(id) on delete cascade,
  participant_id uuid references public.party_participants(id) on delete set null,
  responsible_attendee_id uuid references public.party_event_attendees(id) on delete set null,
  display_name text not null check (char_length(trim(display_name)) between 2 and 100),
  attendee_type text not null check (attendee_type in ('couple','individual','child','extra_guest')),
  birth_date date,
  age_at_event integer check (age_at_event is null or age_at_event between 0 and 120),
  quantity integer not null default 1 check (quantity between 1 and 20),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((attendee_type = 'child' and responsible_attendee_id is not null) or attendee_type <> 'child')
);
create index if not exists party_event_attendees_event_idx on public.party_event_attendees(event_id, created_at);

create table if not exists public.party_event_budget_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.party_managed_events(id) on delete cascade,
  category text not null check (category in ('venue','food','drinks','decoration','entertainment','transport','other')),
  description text not null check (char_length(trim(description)) between 2 and 160),
  planned_amount numeric(12,2) not null default 0 check (planned_amount >= 0),
  actual_amount numeric(12,2) not null default 0 check (actual_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists party_event_budget_items_event_idx on public.party_event_budget_items(event_id);

create table if not exists public.party_event_payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.party_managed_events(id) on delete cascade,
  attendee_id uuid references public.party_event_attendees(id) on delete set null,
  payer_name text not null check (char_length(trim(payer_name)) between 2 and 100),
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'pix' check (method in ('pix','cash','transfer','card','other')),
  status text not null default 'confirmed' check (status in ('pending','confirmed','rejected','refunded')),
  paid_at timestamptz,
  receipt_path text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists party_event_payments_event_idx on public.party_event_payments(event_id, paid_at desc);

create table if not exists public.party_event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.party_managed_events(id) on delete cascade,
  budget_item_id uuid references public.party_event_budget_items(id) on delete set null,
  description text not null check (char_length(trim(description)) between 2 and 160),
  amount numeric(12,2) not null check (amount > 0),
  paid_by text not null check (char_length(trim(paid_by)) between 2 and 100),
  paid_at timestamptz not null default now(),
  receipt_path text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists party_event_expenses_event_idx on public.party_event_expenses(event_id, paid_at desc);

create table if not exists public.party_event_refunds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.party_managed_events(id) on delete cascade,
  payment_id uuid not null references public.party_event_payments(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  reason text not null check (char_length(trim(reason)) between 2 and 300),
  refunded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists party_event_refunds_event_idx on public.party_event_refunds(event_id);

-- Every table is accessed through the authenticated organizer Edge Function only.
alter table public.party_managed_events enable row level security;
alter table public.party_event_pricing_rules enable row level security;
alter table public.party_event_attendees enable row level security;
alter table public.party_event_budget_items enable row level security;
alter table public.party_event_payments enable row level security;
alter table public.party_event_expenses enable row level security;
alter table public.party_event_refunds enable row level security;

revoke all on public.party_managed_events, public.party_event_pricing_rules, public.party_event_attendees,
  public.party_event_budget_items, public.party_event_payments, public.party_event_expenses,
  public.party_event_refunds from anon, authenticated;

-- Link the current legacy event without copying or modifying any participant/reservation data.
insert into public.party_managed_events (legacy_event_id, name, status)
select id, name, 'active' from public.party_event where id = 1
on conflict (legacy_event_id) do nothing;

-- Serialize refunds per payment so concurrent requests cannot over-refund.
create or replace function public.party_event_add_refund(
  p_event_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_reason text
)
returns setof public.party_event_refunds
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment_amount numeric(12,2);
  v_refunded numeric(12,2);
  v_refund public.party_event_refunds;
begin
  if p_amount is null or p_amount <= 0 or p_reason is null or char_length(trim(p_reason)) < 2 or char_length(trim(p_reason)) > 300 then
    raise exception 'Informe um valor e motivo válidos para o estorno.';
  end if;

  select amount into v_payment_amount
  from public.party_event_payments
  where id = p_payment_id and event_id = p_event_id
  for update;

  if not found then
    raise exception 'Pagamento não encontrado neste evento.';
  end if;

  select coalesce(sum(amount), 0) into v_refunded
  from public.party_event_refunds
  where payment_id = p_payment_id;

  if v_refunded + p_amount > v_payment_amount then
    raise exception 'O estorno excede o valor ainda disponível do pagamento.';
  end if;

  insert into public.party_event_refunds(event_id, payment_id, amount, reason)
  values (p_event_id, p_payment_id, p_amount, trim(p_reason))
  returning * into v_refund;

  return next v_refund;
end;
$$;

revoke all on function public.party_event_add_refund(uuid, uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.party_event_add_refund(uuid, uuid, numeric, text) to service_role;
