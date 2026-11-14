-- Atomic, scoped throttling for participant PIN login.
-- Existing participant records, PIN hashes and legacy attempt rows are untouched.
create table if not exists public.party_pin_login_rate_limits (
  scope_hash text primary key check (scope_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null default 0 check (attempts >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

alter table public.party_pin_login_rate_limits enable row level security;
revoke all on table public.party_pin_login_rate_limits from public, anon, authenticated;

create or replace function public.party_pin_login_rate_limit(
  p_scope_hash text,
  p_action text,
  p_max_attempts integer
)
returns table(is_locked boolean, retry_after_seconds integer, attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.party_pin_login_rate_limits%rowtype;
  v_now timestamptz := now();
begin
  if p_scope_hash is null or p_scope_hash !~ '^[0-9a-f]{64}
    raise exception 'INVALID_RATE_LIMIT_ARGUMENT';
  end if;

  if p_action = 'reset' then
    delete from public.party_pin_login_rate_limits where scope_hash = p_scope_hash;
    return query select false, 0, 0;
    return;
  end if;

  if p_action = 'check' then
    select * into v_row
      from public.party_pin_login_rate_limits
      where scope_hash = p_scope_hash;
    if not found or v_row.locked_until is null or v_row.locked_until <= v_now then
      return query select false, 0, coalesce(v_row.attempts, 0);
    else
      return query select true,
        greatest(1, ceil(extract(epoch from (v_row.locked_until - v_now)))::integer),
        v_row.attempts;
    end if;
    return;
  end if;

  insert into public.party_pin_login_rate_limits as current_limit
    (scope_hash, attempts, window_started_at, locked_until)
  values (p_scope_hash, 1, v_now, null)
  on conflict (scope_hash) do update
    set attempts = case
          when current_limit.locked_until > v_now then current_limit.attempts
          when current_limit.window_started_at <= v_now - interval '15 minutes' then 1
          else current_limit.attempts + 1
        end,
        window_started_at = case
          when current_limit.locked_until > v_now then current_limit.window_started_at
          when current_limit.window_started_at <= v_now - interval '15 minutes' then v_now
          else current_limit.window_started_at
        end,
        locked_until = case
          when current_limit.locked_until > v_now then current_limit.locked_until
          when (case
            when current_limit.window_started_at <= v_now - interval '15 minutes' then 1
            else current_limit.attempts + 1
          end) >= p_max_attempts then v_now + interval '15 minutes'
          else null
        end
  returning current_limit.* into v_row;

  return query select
    coalesce(v_row.locked_until > v_now, false),
    case when v_row.locked_until > v_now
      then greatest(1, ceil(extract(epoch from (v_row.locked_until - v_now)))::integer)
      else 0 end,
    v_row.attempts;
end;
$$;

revoke all on function public.party_pin_login_rate_limit(text, text, integer) from public, anon, authenticated;
grant execute on function public.party_pin_login_rate_limit(text, text, integer) to service_role;

     or p_action is null or p_action not in ('check', 'fail', 'reset')
     or p_max_attempts is null or p_max_attempts < 1 or p_max_attempts > 100 then
    raise exception 'INVALID_RATE_LIMIT_ARGUMENT';
  end if;

  if p_action = 'reset' then
    delete from public.party_pin_login_rate_limits where scope_hash = p_scope_hash;
    return query select false, 0, 0;
    return;
  end if;

  if p_action = 'check' then
    select * into v_row
      from public.party_pin_login_rate_limits
      where scope_hash = p_scope_hash;
    if not found or v_row.locked_until is null or v_row.locked_until <= v_now then
      return query select false, 0, coalesce(v_row.attempts, 0);
    else
      return query select true,
        greatest(1, ceil(extract(epoch from (v_row.locked_until - v_now)))::integer),
        v_row.attempts;
    end if;
    return;
  end if;

  insert into public.party_pin_login_rate_limits as current_limit
    (scope_hash, attempts, window_started_at, locked_until)
  values (p_scope_hash, 1, v_now, null)
  on conflict (scope_hash) do update
    set attempts = case
          when current_limit.locked_until > v_now then current_limit.attempts
          when current_limit.window_started_at <= v_now - interval '15 minutes' then 1
          else current_limit.attempts + 1
        end,
        window_started_at = case
          when current_limit.locked_until > v_now then current_limit.window_started_at
          when current_limit.window_started_at <= v_now - interval '15 minutes' then v_now
          else current_limit.window_started_at
        end,
        locked_until = case
          when current_limit.locked_until > v_now then current_limit.locked_until
          when (case
            when current_limit.window_started_at <= v_now - interval '15 minutes' then 1
            else current_limit.attempts + 1
          end) >= p_max_attempts then v_now + interval '15 minutes'
          else null
        end
  returning current_limit.* into v_row;

  return query select
    coalesce(v_row.locked_until > v_now, false),
    case when v_row.locked_until > v_now
      then greatest(1, ceil(extract(epoch from (v_row.locked_until - v_now)))::integer)
      else 0 end,
    v_row.attempts;
end;
$$;

revoke all on function public.party_pin_login_rate_limit(text, text, integer) from public, anon, authenticated;
grant execute on function public.party_pin_login_rate_limit(text, text, integer) to service_role;
