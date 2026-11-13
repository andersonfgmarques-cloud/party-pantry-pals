CREATE TABLE IF NOT EXISTS public.party_admin_login_attempts (
  ip_hash text PRIMARY KEY CHECK (ip_hash ~ '^[0-9a-f]{64}$'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.party_admin_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.party_admin_login_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.party_admin_login_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.party_admin_login_guard(p_ip_hash text, p_action text)
RETURNS TABLE(is_locked boolean, attempt_count integer, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.party_admin_login_attempts%ROWTYPE;
BEGIN
  IF p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$'
     OR p_action NOT IN ('check', 'fail', 'reset') THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters';
  END IF;

  IF p_action = 'reset' THEN
    DELETE FROM public.party_admin_login_attempts WHERE ip_hash = p_ip_hash;
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  IF p_action = 'fail' THEN
    INSERT INTO public.party_admin_login_attempts AS current_attempt
      (ip_hash, attempts, window_started_at, locked_until, updated_at)
    VALUES (p_ip_hash, 1, now(), NULL, now())
    ON CONFLICT (ip_hash) DO UPDATE
    SET attempts = CASE
          WHEN current_attempt.window_started_at <= now() - interval '15 minutes' THEN 1
          ELSE current_attempt.attempts + 1
        END,
        window_started_at = CASE
          WHEN current_attempt.window_started_at <= now() - interval '15 minutes' THEN now()
          ELSE current_attempt.window_started_at
        END,
        locked_until = CASE
          WHEN (CASE
            WHEN current_attempt.window_started_at <= now() - interval '15 minutes' THEN 1
            ELSE current_attempt.attempts + 1
          END) >= 5 THEN now() + interval '15 minutes'
          ELSE NULL
        END,
        updated_at = now();
  END IF;

  SELECT * INTO v_row
  FROM public.party_admin_login_attempts
  WHERE ip_hash = p_ip_hash;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  IF v_row.window_started_at <= now() - interval '15 minutes' THEN
    DELETE FROM public.party_admin_login_attempts WHERE ip_hash = p_ip_hash;
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_row.locked_until > now(), false),
    v_row.attempts,
    CASE WHEN v_row.locked_until > now()
      THEN GREATEST(1, ceil(extract(epoch FROM (v_row.locked_until - now())))::integer)
      ELSE 0
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.party_admin_login_guard(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.party_admin_login_guard(text, text) TO service_role;
