-- Enforce Russian phone numbers in every persisted profile and client record.
alter table public.profiles drop constraint if exists profiles_phone_e164_check;
alter table public.profiles add constraint profiles_phone_e164_check
  check (phone_e164 ~ '^[+]7[0-9]{10}$');

alter table public.clients drop constraint if exists clients_phone_e164_check;
alter table public.clients add constraint clients_phone_e164_check
  check (phone_e164 ~ '^[+]7[0-9]{10}$');

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
  if v_phone !~ '^[+]7[0-9]{10}$' then
    raise exception 'Номер телефона должен содержать +7 и ровно 10 цифр после кода страны';
  end if;
  insert into public.profiles(id, full_name, email, phone_e164)
  values (new.id, v_name, v_email, v_phone);
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated, service_role;

create or replace function public.create_booking(
  p_master_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone_e164 text,
  p_rules_accepted boolean
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_master public.masters%rowtype;
  v_service public.services%rowtype;
  v_settings public.booking_settings%rowtype;
  v_client_id uuid;
  v_ends_at timestamptz;
  v_local timestamp;
  v_weekday integer;
  v_open time;
  v_close time;
  v_exception public.schedule_exceptions%rowtype;
  v_id uuid;
begin
  select * into v_master from public.masters
    where id = p_master_id and is_active and archived_at is null;
  if not found then raise exception 'Мастер недоступен для записи'; end if;
  if v_master.company_id is not null and not exists (
    select 1 from public.companies where id = v_master.company_id and is_active
  ) then raise exception 'Компания временно недоступна'; end if;

  select * into v_service from public.services
    where id = p_service_id and master_id = p_master_id and is_active;
  if not found then raise exception 'Услуга недоступна'; end if;

  select * into v_settings from public.booking_settings where master_id = p_master_id;
  if not found then
    v_settings.booking_horizon_days := 30;
    v_settings.minimum_lead_minutes := 10;
    v_settings.slot_step_minutes := 15;
    v_settings.rules_text := '';
  end if;

  if p_starts_at < now() + make_interval(mins => v_settings.minimum_lead_minutes) then
    raise exception 'До начала записи должно оставаться не менее % минут', v_settings.minimum_lead_minutes;
  end if;
  if p_starts_at > now() + make_interval(days => v_settings.booking_horizon_days) then
    raise exception 'Запись доступна не более чем на % дней вперёд', v_settings.booking_horizon_days;
  end if;
  v_local := p_starts_at at time zone v_master.timezone;
  if extract(second from v_local) <> 0 then
    raise exception 'Время не соответствует шагу расписания';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration);
  v_weekday := extract(dow from v_local)::integer;
  select * into v_exception from public.schedule_exceptions
    where master_id = p_master_id and exception_date = v_local::date;
  if found then
    if v_exception.is_day_off then raise exception 'На выбранную дату мастер не работает'; end if;
    v_open := v_exception.opens_at; v_close := v_exception.closes_at;
  else
    select opens_at, closes_at into v_open, v_close
    from public.working_hours
    where master_id = p_master_id and weekday = v_weekday and not is_day_off
      and v_local >= v_local::date + opens_at
      and v_local + make_interval(mins => v_service.duration) <= v_local::date + closes_at
    order by opens_at limit 1;
  end if;
  if v_open is null
     or v_local < v_local::date + v_open
     or v_local + make_interval(mins => v_service.duration) > v_local::date + v_close then
    raise exception 'Выбранное время вне рабочего расписания';
  end if;
  if floor(extract(epoch from (v_local - (v_local::date + v_open))) / 60)::integer
       % v_settings.slot_step_minutes <> 0 then
    raise exception 'Время не соответствует шагу расписания';
  end if;

  if not coalesce(p_rules_accepted, false) then raise exception 'Необходимо подтвердить ознакомление с правилами записи'; end if;
  if nullif(trim(p_client_name), '') is null then raise exception 'Укажите имя'; end if;
  if p_client_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Телефон должен содержать +7 и ровно 10 цифр после кода страны'; end if;

  insert into public.clients(phone_e164, full_name)
  values (p_client_phone_e164, trim(p_client_name))
  on conflict (phone_e164) do update set updated_at = now()
  returning id into v_client_id;

  insert into public.bookings(
    master_id, service_id, client_id, starts_at, ends_at, status,
    service_name_snapshot, service_duration_snapshot, price_snapshot,
    client_name_snapshot, client_phone_snapshot
  ) values (
    p_master_id, p_service_id, v_client_id, p_starts_at, v_ends_at, 'confirmed',
    v_service.name, v_service.duration, v_service.price, trim(p_client_name), p_client_phone_e164
  ) returning id into v_id;

  insert into public.booking_status_history(booking_id, old_status, new_status)
  values (v_id, null, 'confirmed');
  return v_id;
end;
$$;
revoke all on function public.create_booking(uuid,uuid,timestamptz,text,text,boolean) from public;
grant execute on function public.create_booking(uuid,uuid,timestamptz,text,text,boolean) to anon, authenticated;