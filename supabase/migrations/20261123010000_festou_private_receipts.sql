-- Private receipts for Festou! event payments and expenses.
-- The bucket is private; all upload/download authorisation is performed by party-api.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'festou-private-receipts',
  'festou-private-receipts',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No direct client policies are created. Service-role Edge Function access only.
