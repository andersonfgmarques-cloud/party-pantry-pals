create table if not exists public.party_birthday_people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  photo_path text not null,
  created_at timestamptz not null default now()
);
alter table public.party_birthday_people enable row level security;
revoke all on public.party_birthday_people from anon, authenticated, public;
grant select on public.party_birthday_people to anon, authenticated;
drop policy if exists "Public can read birthday people" on public.party_birthday_people;
create policy "Public can read birthday people" on public.party_birthday_people for select to anon, authenticated using (true);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('party-birthday-photos','party-birthday-photos',true,3145728,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true,file_size_limit=3145728,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
