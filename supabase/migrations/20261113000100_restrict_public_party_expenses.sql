-- Restrict financial records to the organizer-only Edge Function.
-- The public client no longer reads party_expenses directly.
DROP POLICY IF EXISTS "Public can read party expenses" ON public.party_expenses;
REVOKE SELECT ON TABLE public.party_expenses FROM anon, authenticated;
GRANT SELECT ON TABLE public.party_expenses TO service_role;
