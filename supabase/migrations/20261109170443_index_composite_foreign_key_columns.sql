create index bookings_service_master_idx on public.bookings(service_id, master_id);
create index company_members_master_company_idx on public.company_members(master_id, company_id);
drop index public.bookings_service_id_idx;
