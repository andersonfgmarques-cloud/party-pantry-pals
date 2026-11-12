create index if not exists party_products_category_id_idx
  on public.party_products (category_id);

create index if not exists party_reservations_participant_id_idx
  on public.party_reservations (participant_id);

create index if not exists party_reservations_product_id_idx
  on public.party_reservations (product_id);