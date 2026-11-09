create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

alter function public.is_owner() set schema private;
alter function public.is_company_admin(uuid) set schema private;
alter function public.can_manage_master(uuid) set schema private;
alter function public.can_view_master(uuid) set schema private;

create or replace function private.is_owner()
returns boolean language sql stable security definer set search_path to ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.platform_role = 'owner'
      and p.disabled_at is null
      and not p.force_password_change
  );
$$;

create or replace function private.is_company_admin(p_company_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
  select private.is_owner() or exists (
    select 1 from public.company_members cm
    join public.profiles p on p.id = cm.profile_id
    where cm.company_id = p_company_id
      and cm.profile_id = auth.uid()
      and cm.role = 'admin'
      and p.disabled_at is null
      and not p.force_password_change
  );
$$;

create or replace function private.can_manage_master(p_master_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
  select private.is_owner()
  or exists (
    select 1 from public.masters m
    join public.profiles p on p.id = auth.uid()
    where m.id = p_master_id and m.profile_id = p.id
      and p.platform_role = 'master_pro'
      and p.disabled_at is null and not p.force_password_change
  )
  or exists (
    select 1 from public.masters m
    join public.company_members cm on cm.company_id = m.company_id
    join public.profiles p on p.id = cm.profile_id
    where m.id = p_master_id and cm.profile_id = auth.uid()
      and cm.role = 'admin'
      and p.disabled_at is null and not p.force_password_change
  );
$$;

create or replace function private.can_view_master(p_master_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
  select private.can_manage_master(p_master_id)
  or exists (
    select 1 from public.company_members cm
    join public.profiles p on p.id = cm.profile_id
    where cm.master_id = p_master_id
      and cm.profile_id = auth.uid()
      and cm.role = 'master'
      and p.disabled_at is null and not p.force_password_change
  );
$$;

revoke all on function private.is_owner() from public;
revoke all on function private.is_company_admin(uuid) from public;
revoke all on function private.can_manage_master(uuid) from public;
revoke all on function private.can_view_master(uuid) from public;
grant execute on function private.is_owner() to authenticated;
grant execute on function private.is_company_admin(uuid) to authenticated;
grant execute on function private.can_manage_master(uuid) to authenticated;
grant execute on function private.can_view_master(uuid) to authenticated;

create or replace function public.is_owner()
returns boolean language sql stable security invoker set search_path to ''
as $$ select private.is_owner(); $$;
create or replace function public.is_company_admin(p_company_id uuid)
returns boolean language sql stable security invoker set search_path to ''
as $$ select private.is_company_admin(p_company_id); $$;
create or replace function public.can_manage_master(p_master_id uuid)
returns boolean language sql stable security invoker set search_path to ''
as $$ select private.can_manage_master(p_master_id); $$;
create or replace function public.can_view_master(p_master_id uuid)
returns boolean language sql stable security invoker set search_path to ''
as $$ select private.can_view_master(p_master_id); $$;

revoke all on function public.is_owner() from public;
revoke all on function public.is_company_admin(uuid) from public;
revoke all on function public.can_manage_master(uuid) from public;
revoke all on function public.can_view_master(uuid) from public;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_company_admin(uuid) to authenticated;
grant execute on function public.can_manage_master(uuid) to authenticated;
grant execute on function public.can_view_master(uuid) to authenticated;
