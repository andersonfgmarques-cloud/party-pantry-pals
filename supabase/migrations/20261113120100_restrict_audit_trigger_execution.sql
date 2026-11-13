-- Trigger functions need EXECUTE permission when triggers are created,
-- but callers should not be able to invoke the audit trigger function directly.
REVOKE EXECUTE ON FUNCTION public.party_write_audit_log() FROM PUBLIC, anon, authenticated;
