-- Remove account-owned master pages when the account is deleted.
-- Preserve historical records: pages referenced by services or bookings are archived
-- and deactivated; otherwise they are deleted. An Admin's company is removed only
-- when no other account remains attached to it.

create or replace function public.owner_cleanup_account_pages(
  p_actor_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_master_ids uuid[] := '{}'::uuid[];
  v_company_ids uuid[] := '{}'::uuid[];
  v_page_id uuid;
  v_company_id uuid;
  v_deleted integer := 0;
  v_archived integer := 0;
  v_company_deleted integer := 0;
  v_company_deactivated integer := 0;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_id
      and p.platform_role = 'owner'
      and p.disabled_at is null
      and not p.force_password_change
  ) then
    raise exception 'Только активный Owner может удалять учётные записи';
  end if;

  if p_actor_id = p_user_id or not exists (
    select 1 from public.profiles p where p.id = p_user_id
  ) then
    raise exception 'Учётная запись не найдена или недоступна для удаления';
  end if;

  perform pg_catalog.set_config('app.owner_assignment_actor', p_actor_id::text, true);

  select coalesce(array_agg(distinct page_id), '{}'::uuid[])
  into v_master_ids
  from (
    select m.id as page_id
    from public.masters m
    where m.profile_id = p_user_id
    union
    select cm.master_id as page_id
    from public.company_members cm
    where cm.profile_id = p_user_id and cm.master_id is not null
  ) linked_pages;

  select coalesce(array_agg(distinct cm.company_id), '{}'::uuid[])
  into v_company_ids
  from public.company_members cm
  where cm.profile_id = p_user_id and cm.role = 'admin';

  -- Pages directly assigned to the deleted account.
  foreach v_page_id in array v_master_ids loop
    if exists (select 1 from public.bookings b where b.master_id = v_page_id)
       or exists (select 1 from public.services s where s.master_id = v_page_id) then
      update public.masters
      set profile_id = null,
          is_active = false,
          archived_at = coalesce(archived_at, pg_catalog.now())
      where id = v_page_id;
      v_archived := v_archived + 1;
    else
      delete from public.masters where id = v_page_id;
      if found then v_deleted := v_deleted + 1; end if;
    end if;
  end loop;

  -- An Admin-created company belongs to that account unless other accounts
  -- are still attached. Keep shared companies intact.
  foreach v_company_id in array v_company_ids loop
    if not exists (
      select 1 from public.company_members cm
      where cm.company_id = v_company_id and cm.profile_id <> p_user_id
    ) then
      for v_page_id in
        select m.id from public.masters m where m.company_id = v_company_id
      loop
        if exists (select 1 from public.bookings b where b.master_id = v_page_id)
           or exists (select 1 from public.services s where s.master_id = v_page_id) then
          update public.masters
          set is_active = false,
              archived_at = coalesce(archived_at, pg_catalog.now())
          where id = v_page_id;
          v_archived := v_archived + 1;
        else
          delete from public.masters where id = v_page_id;
          if found then v_deleted := v_deleted + 1; end if;
        end if;
      end loop;

      if not exists (select 1 from public.masters m where m.company_id = v_company_id) then
        delete from public.companies where id = v_company_id;
        if found then v_company_deleted := v_company_deleted + 1; end if;
      else
        update public.companies set is_active = false where id = v_company_id;
        v_company_deactivated := v_company_deactivated + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'deletedPages', v_deleted,
    'archivedPages', v_archived,
    'deletedCompanies', v_company_deleted,
    'deactivatedCompanies', v_company_deactivated
  );
end;
$function$;

revoke all on function public.owner_cleanup_account_pages(uuid, uuid) from public, anon, authenticated;
grant execute on function public.owner_cleanup_account_pages(uuid, uuid) to service_role;
