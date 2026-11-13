-- Make birthday photos private. The existing object keys remain unchanged.
update storage.buckets
set public = false
where id = 'party-birthday-photos';
