-- Fix E.164 validation in the Auth profile trigger.
-- Use a bracket expression for '+' to avoid regex backslash escaping ambiguity.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_phone text;
  v_email text;
begin
  v_name := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
  v_phone := coalesce(nullif(trim(new.raw_user_meta_data->>'phone_e164'), ''), new.phone);
  v_email := lower(nullif(trim(new.email), ''));
  if v_name is null or v_phone is null or v_email is null then
    raise exception 'Для учётной записи обязательны имя, email и контактный номер телефона';
  end if;
  if v_phone !~ '^[+][1-9][0-9]{7,14}$' then
    raise exception 'Номер телефона должен быть в формате E.164';
  end if;
  insert into public.profiles(id, full_name, email, phone_e164)
  values (new.id, v_name, v_email, v_phone);
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated, service_role;
