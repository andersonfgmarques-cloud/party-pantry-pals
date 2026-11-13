-- The event location is private and must only be returned by party-api
-- after validating a participant session or the organizer password.
-- Public event details are served by the party-api public_event action.
revoke select on table public.party_event from anon, authenticated;
