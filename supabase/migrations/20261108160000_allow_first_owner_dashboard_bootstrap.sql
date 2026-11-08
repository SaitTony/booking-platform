-- Allow the first Auth user to be created from the Supabase Dashboard,
-- whose basic "Create user" form does not expose user metadata.
-- This is a one-time bootstrap fallback only while profiles is empty.
-- The resulting profile is pending and must be immediately completed
-- with the real full_name and phone_e164 before the account is used.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_name text;
  v_phone text;
  v_email text;
begin
  v_name := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
  v_phone := coalesce(
    nullif(trim(new.raw_user_meta_data->>'phone_e164'), ''),
    new.phone
  );
  v_email := lower(nullif(trim(new.email), ''));

  if v_email is null then
    raise exception 'Email обязателен для учётной записи';
  end if;

  if (v_name is null or v_phone is null)
     and not exists (select 1 from public.profiles) then
    v_name := coalesce(v_name, 'Первый владелец — требуется настройка профиля');
    v_phone := coalesce(v_phone, '+10000000000');
  end if;

  if v_name is null or v_phone is null then
    raise exception 'Для учётной записи обязательны имя и контактный номер телефона';
  end if;

  if v_phone !~ '^[+][1-9][0-9]{7,14}$' then
    raise exception 'Номер телефона должен быть в формате E.164';
  end if;

  insert into public.profiles(id, full_name, email, phone_e164)
  values (new.id, v_name, v_email, v_phone);

  return new;
end;
$function$;
