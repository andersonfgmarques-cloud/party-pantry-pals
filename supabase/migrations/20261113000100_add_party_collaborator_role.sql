-- Add an explicit, opt-in role for participants delegated to manage the shared list.
alter table public.party_participants
  add column if not exists is_collaborator boolean not null default false;

comment on column public.party_participants.is_collaborator is
  'Allows adding, editing, deleting and marking list items as received. Organizer-only actions remain restricted.';
