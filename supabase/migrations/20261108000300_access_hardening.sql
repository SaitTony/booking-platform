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
with check (
  kind = 'company'
  and company_id is not null
  and profile_id is null
  and archived_at is null
  and public.is_company_admin(company_id)
);

-- Companies are deactivated, not physically deleted, so historical bookings remain intact.
drop policy if exists companies_owner_delete on public.companies;

-- Password changes must pass through the server function, which changes the Auth credential
-- and clears force_password_change together. Do not allow a client to clear this flag via RPC.
revoke all on function public.complete_password_change() from public, authenticated;
drop function public.complete_password_change();


-- Only the platform Owner may link accounts to pages, move pages between companies,
-- change a page's kind, or archive a page. Company admins and Master_pro users may
-- edit ordinary page content and activation state within their scope.
create or replace function public.guard_master_owner_fields()
returns trigger language plpgsql set search_path = ''
as $$
declare
  v_actor_id uuid;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    v_actor_id := nullif(current_setting('app.owner_assignment_actor', true), '')::uuid;
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_actor_id and p.platform_role = 'owner'
      and p.disabled_at is null and not p.force_password_change
  ) and (
    old.profile_id is distinct from new.profile_id
    or old.company_id is distinct from new.company_id
    or old.kind is distinct from new.kind
    or old.archived_at is distinct from new.archived_at
  ) then
    raise exception 'Только Owner может менять привязку аккаунта, тип, компанию или архивировать страницу';
  end if;
  return new;
end;
$$;

drop trigger if exists masters_owner_fields_guard on public.masters;
create trigger masters_owner_fields_guard
before update on public.masters
for each row execute function public.guard_master_owner_fields();

-- Company admins may edit company details and theme, but only Owner can enable/disable a company.
create or replace function public.guard_company_owner_fields()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.is_active is distinct from new.is_active and not public.is_owner() then
    raise exception 'Только Owner может включать или отключать компанию';
  end if;
  return new;
end;
$$;

drop trigger if exists companies_owner_fields_guard on public.companies;
create trigger companies_owner_fields_guard
before update on public.companies
for each row execute function public.guard_company_owner_fields();

-- Account assignment is a single database transaction. The actor is re-checked here
-- because this RPC is intentionally callable only with the server-side service role.
create or replace function public.owner_assign_user_role(
  p_actor_id uuid,
  p_user_id uuid,
  p_role text,
  p_company_id uuid default null,
  p_master_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
  v_page public.masters%rowtype;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_id
      and p.platform_role = 'owner'
      and p.disabled_at is null
      and not p.force_password_change
  ) then
    raise exception 'Только активный Owner может назначать роли';
  end if;

  if p_role not in ('admin', 'master', 'master_pro') then
    raise exception 'Недопустимая роль';
  end if;

  select * into v_target
  from public.profiles
  where id = p_user_id
  for update;

  if not found or v_target.platform_role = 'owner' then
    raise exception 'Пользователь не найден или не может быть переназначен';
  end if;

  if p_role = 'master_pro' then
    if p_company_id is not null or p_master_id is null then
      raise exception 'Для Master_pro требуется индивидуальная страница';
    end if;
    select * into v_page
    from public.masters
    where id = p_master_id
    for update;
    if not found or v_page.kind <> 'individual' or v_page.company_id is not null
       or (v_page.profile_id is not null and v_page.profile_id <> p_user_id) then
      raise exception 'Выберите свободную индивидуальную страницу';
    end if;
  else
    if p_company_id is null then
      raise exception 'Для сотрудника компании необходимо выбрать компанию';
    end if;
    if p_role = 'admin' and p_master_id is not null then
      raise exception 'Администратору компании не назначается страница мастера';
    end if;
    if p_role = 'master' then
      if p_master_id is null then
        raise exception 'Выберите страницу мастера компании';
      end if;
      select * into v_page
      from public.masters
      where id = p_master_id
      for update;
      if not found or v_page.kind <> 'company' or v_page.company_id <> p_company_id
         or (v_page.profile_id is not null and v_page.profile_id <> p_user_id) then
        raise exception 'Выберите свободную страницу мастера выбранной компании';
      end if;
    end if;
  end if;

  -- The protected-field trigger verifies this transaction-local Owner identity.
  perform set_config('app.owner_assignment_actor', p_actor_id::text, true);

  -- Clear the previous assignment only after all new values have been validated.
  delete from public.company_members where profile_id = p_user_id;
  update public.masters set profile_id = null where profile_id = p_user_id;

  if p_role = 'master_pro' then
    update public.masters set profile_id = p_user_id where id = p_master_id;
    update public.profiles set platform_role = 'master_pro', updated_at = now()
      where id = p_user_id;
  else
    if p_role = 'master' then
      update public.masters set profile_id = p_user_id where id = p_master_id;
    end if;
    insert into public.company_members(profile_id, company_id, role, master_id)
    values (p_user_id, p_company_id, p_role::public.company_role,
      case when p_role = 'master' then p_master_id else null end);
    update public.profiles set platform_role = 'pending', updated_at = now()
      where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.owner_assign_user_role(uuid,uuid,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.owner_assign_user_role(uuid,uuid,text,uuid,uuid) to service_role;
