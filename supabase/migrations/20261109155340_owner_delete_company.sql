create or replace function public.owner_delete_company(
  p_actor_id uuid,
  p_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_company_name text;
  v_profile_ids uuid[] := '{}'::uuid[];
  v_page_id uuid;
  v_archived integer := 0;
  v_deleted integer := 0;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_id
      and p.platform_role = 'owner'
      and p.disabled_at is null
      and not p.force_password_change
  ) then
    raise exception 'Только активный Owner может удалять компании';
  end if;

  select c.name into v_company_name
  from public.companies c
  where c.id = p_company_id;
  if not found then
    raise exception 'Компания не найдена';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor_id::text, true);
  perform pg_catalog.set_config('app.owner_assignment_actor', p_actor_id::text, true);

  select coalesce(array_agg(distinct cm.profile_id), '{}'::uuid[])
  into v_profile_ids
  from public.company_members cm
  where cm.company_id = p_company_id;

  for v_page_id in
    select m.id from public.masters m where m.company_id = p_company_id
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

  delete from public.company_members where company_id = p_company_id;

  if cardinality(v_profile_ids) > 0 then
    update public.profiles
    set platform_role = 'pending'
    where id = any(v_profile_ids)
      and platform_role <> 'owner';
  end if;

  if v_archived > 0 then
    update public.companies
    set is_active = false
    where id = p_company_id;

    return pg_catalog.jsonb_build_object(
      'success', true,
      'archived', true,
      'companyName', v_company_name,
      'archivedPages', v_archived,
      'deletedPages', v_deleted,
      'unassignedAccounts', cardinality(v_profile_ids),
      'message', 'Компания отключена и сохранена в архиве: у её страниц есть услуги или история записей.'
    );
  end if;

  delete from public.companies where id = p_company_id;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'archived', false,
    'companyName', v_company_name,
    'deletedPages', v_deleted,
    'unassignedAccounts', cardinality(v_profile_ids),
    'message', 'Компания и её страницы удалены. Учётные записи сотрудников сохранены без привязки к компании.'
  );
end;
$function$;

revoke all on function public.owner_delete_company(uuid, uuid) from public, anon, authenticated;
grant execute on function public.owner_delete_company(uuid, uuid) to service_role;
