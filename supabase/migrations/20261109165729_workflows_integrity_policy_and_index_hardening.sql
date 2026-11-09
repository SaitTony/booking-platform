alter table public.companies
  add constraint companies_slug_reserved_check
  check (slug not in ('admin', 'demo', 'pro'));

-- A Master membership must not survive after its assigned page is deleted:
-- the existing CHECK requires master_id for role='master', so SET NULL was invalid.
alter table public.company_members
  drop constraint company_members_master_id_fkey;
alter table public.company_members
  add constraint company_members_master_id_fkey
  foreign key (master_id) references public.masters(id) on delete cascade;

create index booking_status_history_booking_id_idx on public.booking_status_history(booking_id);
create index booking_status_history_changed_by_idx on public.booking_status_history(changed_by);
create index bookings_cancelled_by_idx on public.bookings(cancelled_by);
create index bookings_service_id_idx on public.bookings(service_id);
create index company_members_company_id_idx on public.company_members(company_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger companies_set_updated_at before update on public.companies
for each row execute function public.set_updated_at();
create trigger masters_set_updated_at before update on public.masters
for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients
for each row execute function public.set_updated_at();
create trigger services_set_updated_at before update on public.services
for each row execute function public.set_updated_at();

-- Keep public reads for anonymous visitors and combine authenticated read
-- paths to avoid repeated permissive policy evaluation.
drop policy if exists companies_admin_read on public.companies;
drop policy if exists companies_staff_read on public.companies;
drop policy if exists companies_public_read on public.companies;
create policy companies_public_read on public.companies
for select to anon using (is_active);
create policy companies_authenticated_read on public.companies
for select to authenticated
using (is_active or public.is_company_admin(id));

drop policy if exists masters_public_read on public.masters;
drop policy if exists masters_staff_read on public.masters;
drop policy if exists masters_company_admin_insert on public.masters;
drop policy if exists masters_owner_insert on public.masters;
drop policy if exists masters_manager_update on public.masters;
create policy masters_public_read on public.masters
for select to anon
using (
  is_active and archived_at is null
  and (company_id is null or exists (
    select 1 from public.companies c where c.id = masters.company_id and c.is_active
  ))
);
create policy masters_authenticated_read on public.masters
for select to authenticated
using (
  (
    is_active and archived_at is null
    and (company_id is null or exists (
      select 1 from public.companies c where c.id = masters.company_id and c.is_active
    ))
  )
  or public.can_view_master(id)
);
create policy masters_manager_insert on public.masters
for insert to authenticated
with check (
  public.is_owner()
  or (
    kind = 'company'::public.master_kind
    and company_id is not null
    and profile_id is null
    and archived_at is null
    and public.is_company_admin(company_id)
  )
);
create policy masters_manager_update on public.masters
for update to authenticated
using (public.can_manage_master(id))
with check (public.can_manage_master(id));

drop policy if exists services_manager_write on public.services;
drop policy if exists services_public_read on public.services;
drop policy if exists services_staff_read on public.services;
create policy services_public_read on public.services
for select to anon
using (
  is_active and exists (
    select 1 from public.masters m
    where m.id = services.master_id and m.is_active and m.archived_at is null
  )
);
create policy services_authenticated_read on public.services
for select to authenticated
using (
  (
    is_active and exists (
      select 1 from public.masters m
      where m.id = services.master_id and m.is_active and m.archived_at is null
    )
  )
  or public.can_view_master(master_id)
);
create policy services_manager_insert on public.services
for insert to authenticated
with check (public.can_manage_master(master_id));
create policy services_manager_update on public.services
for update to authenticated
using (public.can_manage_master(master_id))
with check (public.can_manage_master(master_id));
create policy services_manager_delete on public.services
for delete to authenticated
using (public.can_manage_master(master_id));

drop policy if exists working_hours_manager_write on public.working_hours;
drop policy if exists working_hours_public_read on public.working_hours;
drop policy if exists working_hours_staff_read on public.working_hours;
create policy working_hours_public_read on public.working_hours
for select to anon
using (exists (
  select 1 from public.masters m
  where m.id = working_hours.master_id and m.is_active and m.archived_at is null
));
create policy working_hours_authenticated_read on public.working_hours
for select to authenticated
using (
  exists (
    select 1 from public.masters m
    where m.id = working_hours.master_id and m.is_active and m.archived_at is null
  )
  or public.can_view_master(master_id)
);
create policy working_hours_manager_insert on public.working_hours
for insert to authenticated
with check (public.can_manage_master(master_id));
create policy working_hours_manager_update on public.working_hours
for update to authenticated
using (public.can_manage_master(master_id))
with check (public.can_manage_master(master_id));
create policy working_hours_manager_delete on public.working_hours
for delete to authenticated
using (public.can_manage_master(master_id));

drop policy if exists exceptions_manager_write on public.schedule_exceptions;
drop policy if exists exceptions_public_read on public.schedule_exceptions;
drop policy if exists exceptions_staff_read on public.schedule_exceptions;
create policy exceptions_public_read on public.schedule_exceptions
for select to anon
using (exists (
  select 1 from public.masters m
  where m.id = schedule_exceptions.master_id and m.is_active and m.archived_at is null
));
create policy exceptions_authenticated_read on public.schedule_exceptions
for select to authenticated
using (
  exists (
    select 1 from public.masters m
    where m.id = schedule_exceptions.master_id and m.is_active and m.archived_at is null
  )
  or public.can_view_master(master_id)
);
create policy exceptions_manager_insert on public.schedule_exceptions
for insert to authenticated
with check (public.can_manage_master(master_id));
create policy exceptions_manager_update on public.schedule_exceptions
for update to authenticated
using (public.can_manage_master(master_id))
with check (public.can_manage_master(master_id));
create policy exceptions_manager_delete on public.schedule_exceptions
for delete to authenticated
using (public.can_manage_master(master_id));

drop policy if exists settings_scoped_read on public.booking_settings;

alter policy profiles_read_self_owner on public.profiles
using ((id = (select auth.uid())) or public.is_owner());
alter policy company_members_scoped_read on public.company_members
using (public.is_owner() or (profile_id = (select auth.uid())) or public.is_company_admin(company_id));
