-- Add a configurable gap between bookings and enforce it in both slot discovery and booking creation.
alter table public.booking_settings
  add column if not exists buffer_minutes integer not null default 0;

alter table public.booking_settings
  drop constraint if exists booking_settings_buffer_minutes_check;
alter table public.booking_settings
  add constraint booking_settings_buffer_minutes_check
  check (buffer_minutes between 0 and 240);

drop function if exists public.save_master_pro_builder(uuid,text,text,text,jsonb,text,text,jsonb,jsonb,integer);
create function public.save_master_pro_builder(
  p_master_id uuid,
  p_display_name text,
  p_description text,
  p_timezone text,
  p_theme jsonb,
  p_photo_url text,
  p_cover_url text,
  p_services jsonb,
  p_working_hours jsonb,
  p_booking_horizon_days integer,
  p_buffer_minutes integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare v_service_ids uuid[];
begin
  if auth.uid() is null or not private.can_manage_master(p_master_id) then
    raise exception 'Недостаточно прав для сохранения страницы';
  end if;
  if coalesce(trim(p_display_name),'')='' then raise exception 'Укажите имя страницы'; end if;
  if p_booking_horizon_days not between 1 and 90 then raise exception 'Горизонт записи должен быть от 1 до 90 дней'; end if;
  if p_buffer_minutes not between 0 and 240 then raise exception 'Пауза между записями должна быть от 0 до 240 минут'; end if;
  if jsonb_typeof(coalesce(p_services,'[]'::jsonb))<>'array' or jsonb_typeof(coalesce(p_working_hours,'[]'::jsonb))<>'array' then
    raise exception 'Некорректные данные услуг или расписания';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_services,'[]'::jsonb)) item
    where coalesce(trim(item->>'name'),'')=''
      or coalesce((item->>'duration')::integer,0) not between 1 and 720
      or coalesce((item->>'price')::numeric,-1)<0
  ) then raise exception 'Проверьте названия, длительность и стоимость услуг'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_working_hours,'[]'::jsonb)) item
    where coalesce((item->>'weekday')::integer,-1) not between 0 and 6
      or (item->>'opens_at')::time >= (item->>'closes_at')::time
  ) then raise exception 'Некорректное расписание'; end if;

  update public.masters set display_name=trim(p_display_name),
    public_description=coalesce(p_description,''),timezone=p_timezone,
    theme=coalesce(p_theme,'{"id":"natural"}'::jsonb),
    photo_url=nullif(p_photo_url,''),cover_url=nullif(p_cover_url,''),updated_at=now()
  where id=p_master_id;
  if not found then raise exception 'Страница не найдена'; end if;

  select coalesce(array_agg((item->>'id')::uuid),array[]::uuid[])
  into v_service_ids from jsonb_array_elements(coalesce(p_services,'[]'::jsonb)) item;
  delete from public.services where master_id=p_master_id and not (id=any(v_service_ids));

  insert into public.services(id,master_id,name,description,duration,price,is_active,sort_order)
  select (item->>'id')::uuid,p_master_id,trim(item->>'name'),coalesce(item->>'description',''),
    (item->>'duration')::integer,(item->>'price')::numeric,
    coalesce((item->>'active')::boolean,true),coalesce((item->>'sort_order')::integer,0)
  from jsonb_array_elements(coalesce(p_services,'[]'::jsonb)) item
  on conflict (id) do update set name=excluded.name,description=excluded.description,
    duration=excluded.duration,price=excluded.price,is_active=excluded.is_active,
    sort_order=excluded.sort_order,updated_at=now()
  where public.services.master_id=p_master_id;

  delete from public.working_hours where master_id=p_master_id;
  insert into public.working_hours(master_id,weekday,opens_at,closes_at,is_day_off)
  select p_master_id,(item->>'weekday')::smallint,(item->>'opens_at')::time,(item->>'closes_at')::time,false
  from jsonb_array_elements(coalesce(p_working_hours,'[]'::jsonb)) item;

  insert into public.booking_settings(master_id,booking_horizon_days,buffer_minutes)
  values(p_master_id,p_booking_horizon_days,p_buffer_minutes)
  on conflict(master_id) do update set
    booking_horizon_days=excluded.booking_horizon_days,
    buffer_minutes=excluded.buffer_minutes;
end;
$function$;

revoke all on function public.save_master_pro_builder(uuid,text,text,text,jsonb,text,text,jsonb,jsonb,integer,integer) from public, anon;
grant execute on function public.save_master_pro_builder(uuid,text,text,text,jsonb,text,text,jsonb,jsonb,integer,integer) to authenticated;

create or replace function public.get_available_slots(p_master_id uuid, p_service_id uuid, p_date date)
returns table(slot_start timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_master public.masters%rowtype;
  v_service public.services%rowtype;
  v_settings public.booking_settings%rowtype;
  v_exception public.schedule_exceptions%rowtype;
  v_window record;
  v_local_start timestamp;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_step integer;
  v_lead integer;
  v_horizon integer;
  v_buffer integer;
begin
  select * into v_master from public.masters
  where id=p_master_id and is_active and archived_at is null;
  if not found then return; end if;
  if v_master.company_id is not null and not exists (
    select 1 from public.companies c where c.id=v_master.company_id and c.is_active
  ) then return; end if;

  select * into v_service from public.services
  where id=p_service_id and master_id=p_master_id and is_active;
  if not found then return; end if;

  select * into v_settings from public.booking_settings where master_id=p_master_id;
  v_step:=coalesce(v_settings.slot_step_minutes,15);
  v_lead:=coalesce(v_settings.minimum_lead_minutes,10);
  v_horizon:=coalesce(v_settings.booking_horizon_days,30);
  v_buffer:=coalesce(v_settings.buffer_minutes,0);
  if p_date < (now() at time zone v_master.timezone)::date
     or p_date > ((now()+make_interval(days=>v_horizon)) at time zone v_master.timezone)::date then
    return;
  end if;

  select * into v_exception from public.schedule_exceptions
  where master_id=p_master_id and exception_date=p_date;
  if found then
    if v_exception.is_day_off then return; end if;
    for v_window in select v_exception.opens_at as opens_at,v_exception.closes_at as closes_at loop
      v_local_start:=p_date+v_window.opens_at;
      while v_local_start+make_interval(mins=>v_service.duration)<=p_date+v_window.closes_at loop
        v_slot_start:=v_local_start at time zone v_master.timezone;
        v_slot_end:=v_slot_start+make_interval(mins=>v_service.duration);
        if v_slot_start>=now()+make_interval(mins=>v_lead)
          and v_slot_start<=now()+make_interval(days=>v_horizon)
          and not exists(
            select 1 from public.bookings b where b.master_id=p_master_id and b.status='confirmed'
              and tstzrange(b.starts_at-make_interval(mins=>v_buffer),b.ends_at+make_interval(mins=>v_buffer),'[)')
                && tstzrange(v_slot_start,v_slot_end,'[)')
          ) then
          slot_start:=v_slot_start; return next;
        end if;
        v_local_start:=v_local_start+make_interval(mins=>v_step);
      end loop;
    end loop;
  else
    for v_window in
      select wh.opens_at,wh.closes_at from public.working_hours wh
      where wh.master_id=p_master_id and wh.weekday=extract(dow from p_date)::integer and not wh.is_day_off
    loop
      v_local_start:=p_date+v_window.opens_at;
      while v_local_start+make_interval(mins=>v_service.duration)<=p_date+v_window.closes_at loop
        v_slot_start:=v_local_start at time zone v_master.timezone;
        v_slot_end:=v_slot_start+make_interval(mins=>v_service.duration);
        if v_slot_start>=now()+make_interval(mins=>v_lead)
          and v_slot_start<=now()+make_interval(days=>v_horizon)
          and not exists(
            select 1 from public.bookings b where b.master_id=p_master_id and b.status='confirmed'
              and tstzrange(b.starts_at-make_interval(mins=>v_buffer),b.ends_at+make_interval(mins=>v_buffer),'[)')
                && tstzrange(v_slot_start,v_slot_end,'[)')
          ) then
          slot_start:=v_slot_start; return next;
        end if;
        v_local_start:=v_local_start+make_interval(mins=>v_step);
      end loop;
    end loop;
  end if;
end;
$function$;

revoke all on function public.get_available_slots(uuid,uuid,date) from public;
grant execute on function public.get_available_slots(uuid,uuid,date) to anon,authenticated;

create or replace function public.create_booking(
  p_master_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone_e164 text,
  p_rules_accepted boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
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
  v_buffer integer;
begin
  -- Serialize bookings for one master so concurrent requests cannot bypass the buffer check.
  select * into v_master from public.masters
  where id=p_master_id and is_active and archived_at is null
  for update;
  if not found then raise exception 'Мастер недоступен для записи'; end if;
  if v_master.company_id is not null and not exists (
    select 1 from public.companies where id=v_master.company_id and is_active
  ) then raise exception 'Компания временно недоступна'; end if;

  select * into v_service from public.services
  where id=p_service_id and master_id=p_master_id and is_active;
  if not found then raise exception 'Услуга недоступна'; end if;

  select * into v_settings from public.booking_settings where master_id=p_master_id;
  if not found then
    v_settings.booking_horizon_days:=30;
    v_settings.minimum_lead_minutes:=10;
    v_settings.slot_step_minutes:=15;
    v_settings.rules_text:='';
    v_buffer:=0;
  else
    v_buffer:=coalesce(v_settings.buffer_minutes,0);
  end if;

  if p_starts_at<now()+make_interval(mins=>v_settings.minimum_lead_minutes) then
    raise exception 'До начала записи должно оставаться не менее % минут',v_settings.minimum_lead_minutes;
  end if;
  if p_starts_at>now()+make_interval(days=>v_settings.booking_horizon_days) then
    raise exception 'Запись доступна не более чем на % дней вперёд',v_settings.booking_horizon_days;
  end if;
  v_local:=p_starts_at at time zone v_master.timezone;
  if extract(second from v_local)<>0 then raise exception 'Время не соответствует шагу расписания'; end if;

  v_ends_at:=p_starts_at+make_interval(mins=>v_service.duration);
  v_weekday:=extract(dow from v_local)::integer;
  select * into v_exception from public.schedule_exceptions
  where master_id=p_master_id and exception_date=v_local::date;
  if found then
    if v_exception.is_day_off then raise exception 'На выбранную дату мастер не работает'; end if;
    v_open:=v_exception.opens_at; v_close:=v_exception.closes_at;
  else
    select opens_at,closes_at into v_open,v_close from public.working_hours
    where master_id=p_master_id and weekday=v_weekday and not is_day_off
      and v_local>=v_local::date+opens_at
      and v_local+make_interval(mins=>v_service.duration)<=v_local::date+closes_at
    order by opens_at limit 1;
  end if;
  if v_open is null or v_local<v_local::date+v_open
     or v_local+make_interval(mins=>v_service.duration)>v_local::date+v_close then
    raise exception 'Выбранное время вне рабочего расписания';
  end if;
  if floor(extract(epoch from(v_local-(v_local::date+v_open)))/60)::integer
       % v_settings.slot_step_minutes<>0 then
    raise exception 'Время не соответствует шагу расписания';
  end if;

  if exists(
    select 1 from public.bookings b
    where b.master_id=p_master_id and b.status='confirmed'
      and tstzrange(b.starts_at-make_interval(mins=>v_buffer),b.ends_at+make_interval(mins=>v_buffer),'[)')
        && tstzrange(p_starts_at,v_ends_at,'[)')
  ) then raise exception 'Между записями должна быть пауза не менее % минут',v_buffer; end if;

  if not coalesce(p_rules_accepted,false) then raise exception 'Необходимо подтвердить ознакомление с правилами записи'; end if;
  if nullif(trim(p_client_name),'') is null then raise exception 'Укажите имя'; end if;
  if p_client_phone_e164 !~ '^[+]7[0-9]{10}$' then raise exception 'Телефон должен содержать +7 и ровно 10 цифр после кода страны'; end if;

  insert into public.clients(phone_e164,full_name)
  values(p_client_phone_e164,trim(p_client_name))
  on conflict(phone_e164) do update set updated_at=now()
  returning id into v_client_id;

  insert into public.bookings(
    master_id,service_id,client_id,starts_at,ends_at,status,
    service_name_snapshot,service_duration_snapshot,price_snapshot,
    client_name_snapshot,client_phone_snapshot
  ) values(
    p_master_id,p_service_id,v_client_id,p_starts_at,v_ends_at,'confirmed',
    v_service.name,v_service.duration,v_service.price,trim(p_client_name),p_client_phone_e164
  ) returning id into v_id;

  insert into public.booking_status_history(booking_id,old_status,new_status)
  values(v_id,null,'confirmed');
  return v_id;
end;
$function$;

revoke all on function public.create_booking(uuid,uuid,timestamptz,text,text,boolean) from public;
grant execute on function public.create_booking(uuid,uuid,timestamptz,text,text,boolean) to anon,authenticated;
