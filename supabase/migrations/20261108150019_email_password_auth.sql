-- Email is the canonical staff identity. Phone remains a required contact number.
-- The hosted project was checked before rollout: auth.users=0, profiles=0.
alter table public.profiles add column email text;

update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id and u.email is not null;

do $$
begin
  if exists (select 1 from public.profiles where email is null or btrim(email) = '') then
    raise exception 'Cannot require profiles.email: one or more existing profiles have no Auth email';
  end if;
end;
$$;

alter table public.profiles alter column email set not null;
create unique index profiles_email_lower_uq on public.profiles (lower(email));

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
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Номер телефона должен быть в формате E.164';
  end if;
  insert into public.profiles(id, full_name, email, phone_e164)
  values (new.id, v_name, v_email, v_phone);
  return new;
end;
$$;

create or replace function public.sync_auth_user_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = lower(new.email), updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row execute function public.sync_auth_user_email();

revoke all on function public.sync_auth_user_email() from public, anon, authenticated, service_role;
