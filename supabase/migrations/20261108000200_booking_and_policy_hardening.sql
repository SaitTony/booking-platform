-- Follow-up hardening: active-role checks, controlled page creation and booking RPC.
create or replace function public.can_manage_master(p_master_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_owner()
  or exists (
    select 1 from public.masters m
    join public.profiles p on p.id = auth.uid()
    where m.id = p_master_id and m.profile_id = p.id
      and p.platform_role = 'master_pro' and p.disabled_at is null and not p.force_password_change
  )
  or exists (
    select 1 from public.masters m
    join public.company_members cm on cm.company_id = m.company_id
    join public.profiles p on p.id = cm.profile_id
    where m.id = p_master_id and cm.profile_id = auth.uid() and cm.role = 'admin'
      and p.disabled_at is null and not p.force_password_change
  );
$$;

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_owner() or exists (
    select 1 from public.company_members cm
    join public.profiles p on p.id = cm.profile_id
    where cm.company_id = p_company_id and cm.profile_id = auth.uid()
      and cm.role = 'admin' and p.disabled_at is null and not p.force_password_change
  );
$$;

drop policy if exists masters_manager_write on public.masters;
create policy masters_owner_insert on public.masters for insert to authenticated
with check (public.is_owner());
create policy masters_manager_update on public.masters for update to authenticated
using (public.can_manage_master(id) or (company_id is not null and public.is_company_admin(company_id)))
with check (public.can_manage_master(id) or (company_id is not null and public.is_company_admin(company_id)));

create policy companies_owner_insert on public.companies for insert to authenticated
with check (public.is_owner());
create policy companies_owner_delete on public.companies for delete to authenticated
using (public.is_owner());

create or replace function public.enforce_company_master_limit()
returns trigger language plpgsql set search_path = ''
as $$
declare v_count integer;
begin
  if new.kind = 'company' and new.archived_at is null then
    perform 1 from public.companies where id = new.company_id for update;
    select count(*) into v_count from public.masters
      where company_id = new.company_id and archived_at is null
        and (tg_op = 'INSERT' or id <> new.id);
    if v_count >= 5 then
      raise exception 'В компании может быть не более пяти активных страниц мастеров';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists masters_limit_before_write on public.masters;
create trigger masters_limit_before_write
before insert or update of company_id, archived_at, kind on public.masters
for each row execute function public.enforce_company_master_limit();

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
  if extract(minute from v_local)::integer % v_settings.slot_step_minutes <> 0
     or extract(second from v_local) <> 0 then
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
      and v_local::time >= opens_at
      and (v_local + make_interval(mins => v_service.duration))::time <= closes_at
    order by opens_at limit 1;
  end if;
  if v_open is null or v_local::time < v_open
     or (v_local + make_interval(mins => v_service.duration))::time > v_close then
    raise exception 'Выбранное время вне рабочего расписания';
  end if;

  if not coalesce(p_rules_accepted, false) then raise exception 'Необходимо подтвердить ознакомление с правилами записи'; end if;
  if nullif(trim(p_client_name), '') is null then raise exception 'Укажите имя'; end if;
  if p_client_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Телефон должен быть в формате E.164'; end if;

  insert into public.clients(phone_e164, full_name)
  values (p_client_phone_e164, trim(p_client_name))
  on conflict (phone_e164) do update set full_name = excluded.full_name, updated_at = now()
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
grant execute on function public.create_booking(uuid,uuid,timestamptz,text,text) to anon, authenticated;

create or replace function public.cancel_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Запись не найдена'; end if;
  if not (public.is_owner() or public.can_manage_master(v_booking.master_id)) then
    raise exception 'Недостаточно прав для отмены записи';
  end if;
  if v_booking.status <> 'confirmed' then raise exception 'Запись уже не активна'; end if;
  update public.bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
    where id = p_booking_id;
  insert into public.booking_status_history(booking_id, old_status, new_status, changed_by)
    values (p_booking_id, 'confirmed', 'cancelled', auth.uid());
end;
$$;
revoke all on function public.cancel_booking(uuid) from public;
grant execute on function public.cancel_booking(uuid) to authenticated;
