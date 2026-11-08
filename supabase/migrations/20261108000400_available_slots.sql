create or replace function public.get_available_slots(
  p_master_id uuid,
  p_service_id uuid,
  p_date date
)
returns table(slot_start timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
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
begin
  select * into v_master from public.masters
  where id = p_master_id and is_active and archived_at is null;
  if not found then return; end if;
  if v_master.company_id is not null and not exists (
    select 1 from public.companies c where c.id = v_master.company_id and c.is_active
  ) then return; end if;

  select * into v_service from public.services
  where id = p_service_id and master_id = p_master_id and is_active;
  if not found then return; end if;

  select * into v_settings from public.booking_settings where master_id = p_master_id;
  v_step := coalesce(v_settings.slot_step_minutes, 15);
  v_lead := coalesce(v_settings.minimum_lead_minutes, 10);
  v_horizon := coalesce(v_settings.booking_horizon_days, 30);
  if p_date < (now() at time zone v_master.timezone)::date
     or p_date > ((now() + make_interval(days => v_horizon)) at time zone v_master.timezone)::date then
    return;
  end if;

  select * into v_exception from public.schedule_exceptions
  where master_id = p_master_id and exception_date = p_date;

  if found then
    if v_exception.is_day_off then return; end if;
    for v_window in select v_exception.opens_at as opens_at, v_exception.closes_at as closes_at loop
      v_local_start := p_date + v_window.opens_at;
      while v_local_start + make_interval(mins => v_service.duration) <= p_date + v_window.closes_at loop
        v_slot_start := v_local_start at time zone v_master.timezone;
        v_slot_end := v_slot_start + make_interval(mins => v_service.duration);
        if extract(minute from v_local_start)::integer % v_step = 0
          and v_slot_start >= now() + make_interval(mins => v_lead)
          and v_slot_start <= now() + make_interval(days => v_horizon)
          and not exists (select 1 from public.bookings b where b.master_id = p_master_id
            and b.status = 'confirmed' and tstzrange(b.starts_at,b.ends_at,'[)') &&
              tstzrange(v_slot_start,v_slot_end,'[)')) then
          slot_start := v_slot_start; return next;
        end if;
        v_local_start := v_local_start + make_interval(mins => v_step);
      end loop;
    end loop;
  else
    for v_window in
      select wh.opens_at, wh.closes_at from public.working_hours wh
      where wh.master_id = p_master_id
        and wh.weekday = extract(dow from p_date)::integer and not wh.is_day_off
    loop
      v_local_start := p_date + v_window.opens_at;
      while v_local_start + make_interval(mins => v_service.duration) <= p_date + v_window.closes_at loop
        v_slot_start := v_local_start at time zone v_master.timezone;
        v_slot_end := v_slot_start + make_interval(mins => v_service.duration);
        if extract(minute from v_local_start)::integer % v_step = 0
          and v_slot_start >= now() + make_interval(mins => v_lead)
          and v_slot_start <= now() + make_interval(days => v_horizon)
          and not exists (select 1 from public.bookings b where b.master_id = p_master_id
            and b.status = 'confirmed' and tstzrange(b.starts_at,b.ends_at,'[)') &&
              tstzrange(v_slot_start,v_slot_end,'[)')) then
          slot_start := v_slot_start; return next;
        end if;
        v_local_start := v_local_start + make_interval(mins => v_step);
      end loop;
    end loop;
  end if;
end;
$$;
revoke all on function public.get_available_slots(uuid,uuid,date) from public;
grant execute on function public.get_available_slots(uuid,uuid,date) to anon, authenticated;
