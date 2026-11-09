-- Allow authenticated staff to see their own operational records, including inactive drafts.
create policy companies_staff_read on public.companies for select to authenticated
using (public.is_owner() or public.is_company_admin(id));

create policy masters_staff_read on public.masters for select to authenticated
using (public.is_owner() or public.can_view_master(id) or (company_id is not null and public.is_company_admin(company_id)));

create policy services_staff_read on public.services for select to authenticated
using (public.can_view_master(master_id));

create policy working_hours_staff_read on public.working_hours for select to authenticated
using (public.can_view_master(master_id));

create policy exceptions_staff_read on public.schedule_exceptions for select to authenticated
using (public.can_view_master(master_id));

create policy booking_settings_staff_read on public.booking_settings for select to authenticated
using (public.can_view_master(master_id));

grant select on public.companies, public.masters, public.services, public.working_hours,
  public.schedule_exceptions, public.booking_settings to authenticated;
