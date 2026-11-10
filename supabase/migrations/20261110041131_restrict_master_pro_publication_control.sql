create or replace function public.guard_master_owner_fields()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_actor_id uuid;
  v_auth_internal boolean := false;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    v_actor_id := nullif(current_setting('app.owner_assignment_actor', true), '')::uuid;
  end if;

  -- Auth's internal delete cascades execute a nested FK action. Permit only
  -- the exact profile_id -> NULL transition made by that nested action.
  v_auth_internal := current_user = 'supabase_auth_admin'
    or (
      pg_catalog.pg_trigger_depth() > 1
      and old.profile_id is not null
      and new.profile_id is null
      and old.company_id is not distinct from new.company_id
      and old.kind is not distinct from new.kind
      and old.archived_at is not distinct from new.archived_at
    );

  -- Publication of an individual Master_pro page belongs only to Owner
  -- or to the active Master_pro account linked to that exact page.
  if not v_auth_internal
     and old.kind = 'individual'
     and old.is_active is distinct from new.is_active
     and not exists (
       select 1
       from public.profiles p
       where p.id = v_actor_id
         and p.platform_role = 'owner'
         and p.disabled_at is null
         and not p.force_password_change
     )
     and not exists (
       select 1
       from public.profiles p
       where p.id = v_actor_id
         and p.id = old.profile_id
         and p.platform_role = 'master_pro'
         and p.disabled_at is null
         and not p.force_password_change
     ) then
    raise exception 'Только Owner или владелец страницы Master_pro может менять её статус публикации';
  end if;

  if not v_auth_internal
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
