create or replace function public.guard_master_owner_fields()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_actor_id uuid;
  v_auth_cascade boolean := false;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    v_actor_id := nullif(current_setting('app.owner_assignment_actor', true), '')::uuid;
  end if;

  -- Auth's internal FK cascade runs as supabase_auth_admin. Allow only the
  -- automatic profile_id detach; ordinary relationship edits stay Owner-only.
  v_auth_cascade :=
    current_user = 'supabase_auth_admin'
    and old.profile_id is not null
    and new.profile_id is null;

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
