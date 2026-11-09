-- Permit Auth's FK cascade to detach a deleted profile from its master page.
-- Create role-specific company/master pages atomically with account assignment.

create or replace function public.guard_master_owner_fields()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_actor_id uuid;
  v_auth_cascade boolean := false;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    v_actor_id := nullif(current_setting('app.owner_assignment_actor', true), '')::uuid;
  end if;

  v_auth_cascade :=
    current_user = 'supabase_auth_admin'
    and old.profile_id is not null
    and new.profile_id is null
    and not exists (select 1 from public.profiles p where p.id = old.profile_id);

  if not v_auth_cascade
     and not exists (
       select 1 from public.profiles p
       where p.id = v_actor_id and p.platform_role = 'owner'
         and p.disabled_at is null and not p.force_password_change
     )
     and (
       old.profile_id is distinct from new.profile_id
       or old.company_id is distinct from new.company_id
       or old.kind is distinct from new.kind
       or old.archived_at is distinct from new.archived_at
     ) then
    raise exception 'Только Owner может менять привязку аккаунта, тип, компанию или архивировать страницу';
  end if;
  return new;
end;
$function$;

create or replace function public.owner_create_user_assignment(
  p_actor_id uuid,
  p_user_id uuid,
  p_role text,
  p_company_id uuid default null,
  p_company_name text default null,
  p_company_slug text default null,
  p_page_name text default null,
  p_page_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_company_id uuid := p_company_id;
  v_master_id uuid := null;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_id and p.platform_role = 'owner'
      and p.disabled_at is null and not p.force_password_change
  ) then
    raise exception 'Только активный Owner может создавать учётные записи';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Профиль сотрудника не найден';
  end if;

  if p_role not in ('admin', 'master', 'master_pro') then
    raise exception 'Недопустимая роль';
  end if;

  if p_role = 'admin' then
    if coalesce(trim(p_company_name), '') = ''
       or coalesce(trim(p_company_slug), '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'Для Admin укажите название и адрес страницы компании';
    end if;
    insert into public.companies(name, slug)
    values (trim(p_company_name), trim(p_company_slug))
    returning id into v_company_id;
  elsif p_role = 'master' then
    if v_company_id is null then
      raise exception 'Для Master необходимо выбрать компанию';
    end if;
    if not exists (select 1 from public.companies c where c.id = v_company_id and c.is_active) then
      raise exception 'Выбранная компания не найдена или отключена';
    end if;
  end if;

  if p_role in ('master', 'master_pro') then
    if coalesce(trim(p_page_name), '') = ''
       or coalesce(trim(p_page_slug), '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'Не удалось сформировать страницу мастера';
    end if;
    insert into public.masters(kind, company_id, display_name, slug)
    values (
      case when p_role = 'master_pro' then 'individual'::public.master_kind else 'company'::public.master_kind end,
      case when p_role = 'master_pro' then null else v_company_id end,
      trim(p_page_name),
      trim(p_page_slug)
    )
    returning id into v_master_id;
  end if;

  perform public.owner_assign_user_role(p_actor_id, p_user_id, p_role, v_company_id, v_master_id);
  return jsonb_build_object('companyId', v_company_id, 'masterId', v_master_id, 'role', p_role);
end;
$function$;

revoke all on function public.owner_create_user_assignment(uuid,uuid,text,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.owner_create_user_assignment(uuid,uuid,text,uuid,text,text,text,text) to service_role;
