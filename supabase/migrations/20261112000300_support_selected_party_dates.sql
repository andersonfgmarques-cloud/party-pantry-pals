alter table public.party_event
  add column if not exists party_dates date[] not null default '{}';

update public.party_event
set party_dates = case
  when party_date is null then '{}'
  when party_end_date is null or party_end_date = party_date then array[party_date]
  else array(select d::date from generate_series(party_date, party_end_date, interval '1 day') d)
end
where coalesce(cardinality(party_dates),0)=0 and party_date is not null;

alter table public.party_event
  add constraint party_event_dates_sorted check (
    cardinality(party_dates) <= 90
  );