-- Finalize access scoping for company staff and remove client-callable password flag bypass.
create or replace function public.can_view_master(p_master_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.can_manage_master(p_master_id)
  or exists (
    select 1 from public.company_members cm
    join public.profiles p on p.id = cm.profile_id
    where cm.master_id = p_master_id and cm.profile_id = auth.uid()
      and cm.role = 'master' and p.disabled_at is null and not p.force_password_change
  );
$$;

drop policy if exists masters_owner_insert on public.masters;
create policy masters_owner_insert on public.masters for insert to authenticated
with check (public.is_owner());
create policy masters_company_admin_insert on public.masters for insert to authenticated
with check (kind = 'company' and company_id is not null and public.is_company_admin(company_id));

-- Companies are deactivated, not physically deleted, so historical bookings remain intact.
drop policy if exists companies_owner_delete on public.companies;

-- Password changes must pass through the server function, which changes the Auth credential
-- and clears force_password_change together. Do not allow a client to clear this flag via RPC.
revoke all on function public.complete_password_change() from public, authenticated;
drop function public.complete_password_change();
