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

  -- The Auth service uses this private database role for its internal
  -- auth.users -> profiles -> masters foreign-key cascades. It is not
  -- available to API clients; permit its internal cleanup while keeping
  -- protected-field edits Owner-only for all application roles.
  v_auth_internal := current_user = 'supabase_auth_admin';

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
