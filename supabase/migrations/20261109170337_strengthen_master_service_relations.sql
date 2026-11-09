create unique index masters_id_company_id_uq on public.masters(id, company_id);
alter table public.company_members drop constraint company_members_master_id_fkey;
alter table public.company_members
  add constraint company_members_master_company_fkey
  foreign key (master_id, company_id)
  references public.masters(id, company_id)
  on delete cascade;

create unique index services_id_master_id_uq on public.services(id, master_id);
alter table public.bookings drop constraint bookings_service_id_fkey;
alter table public.bookings
  add constraint bookings_service_master_fkey
  foreign key (service_id, master_id)
  references public.services(id, master_id)
  on delete set null (service_id);
