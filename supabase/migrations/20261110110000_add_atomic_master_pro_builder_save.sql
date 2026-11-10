-- Persist a complete Master_pro draft atomically under the caller's RLS permissions.
create or replace function public.save_master_pro_builder(
  p_master_id uuid,
  p_display_name text,
  p_description text,
  p_timezone text,
  p_theme jsonb,
  p_services jsonb,
  p_working_hours jsonb,
  p_booking_horizon_days integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_service_ids uuid[];
begin
  if auth.uid() is null or not private.can_manage_master(p_master_id) then
    raise exception 'Недостаточно прав для сохранения страницы';
  end if;
  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Укажите имя страницы';
  end if;
  if p_booking_horizon_days not between 1 and 90 then
    raise exception 'Горизонт записи должен быть от 1 до 90 дней';
  end if;
  if jsonb_typeof(coalesce(p_services, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_working_hours, '[]'::jsonb)) <> 'array' then
    raise exception 'Некорректные данные услуг или расписания';
  end if;

  update public.masters
  set display_name = trim(p_display_name),
      public_description = coalesce(p_description, ''),
      timezone = p_timezone,
      theme = coalesce(p_theme, '{"id":"natural"}'::jsonb),
      updated_at = now()
  where id = p_master_id;
  if not found then raise exception 'Страница не найдена'; end if;

  select coalesce(array_agg((item->>'id')::uuid), array[]::uuid[])
  into v_service_ids
  from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) as item;

  delete from public.services
  where master_id = p_master_id and not (id = any(v_service_ids));

  insert into public.services(id, master_id, name, description, duration, price, is_active, sort_order)
  select (item->>'id')::uuid, p_master_id, trim(item->>'name'),
         coalesce(item->>'description', ''), (item->>'duration')::integer,
         (item->>'price')::numeric, coalesce((item->>'active')::boolean, true),
         coalesce((item->>'sort_order')::integer, 0)
  from jsonb_array_elements(coalesce(p_services, '[]'::jsonb)) as item
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    duration = excluded.duration,
    price = excluded.price,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    updated_at = now();

  delete from public.working_hours where master_id = p_master_id;
  insert into public.working_hours(master_id, weekday, opens_at, closes_at, is_day_off)
  select p_master_id, (item->>'weekday')::smallint,
         (item->>'opens_at')::time, (item->>'closes_at')::time, false
  from jsonb_array_elements(coalesce(p_working_hours, '[]'::jsonb)) as item;

  insert into public.booking_settings(master_id, booking_horizon_days)
  values (p_master_id, p_booking_horizon_days)
  on conflict (master_id) do update
    set booking_horizon_days = excluded.booking_horizon_days;
end;
$function$;

revoke all on function public.save_master_pro_builder(uuid,text,text,text,jsonb,jsonb,jsonb,integer) from public, anon;
grant execute on function public.save_master_pro_builder(uuid,text,text,text,jsonb,jsonb,jsonb,integer) to authenticated;
