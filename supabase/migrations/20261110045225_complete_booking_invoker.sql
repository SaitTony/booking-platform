-- Keep booking completion under ordinary RLS rather than exposing another SECURITY DEFINER RPC.
grant update on public.bookings to authenticated;
grant insert on public.booking_status_history to authenticated;

drop policy if exists booking_history_manager_insert on public.booking_status_history;
create policy booking_history_manager_insert
on public.booking_status_history
for insert
to authenticated
with check (
  changed_by = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and public.can_manage_master(b.master_id)
  )
);

create or replace function public.complete_booking(p_booking_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_booking public.bookings%rowtype;
begin
  if auth.uid() is null then raise exception 'Необходима авторизация'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Запись не найдена'; end if;
  if not public.can_manage_master(v_booking.master_id) then
    raise exception 'Недостаточно прав для изменения записи';
  end if;
  if v_booking.status <> 'confirmed' then raise exception 'Завершить можно только активную запись'; end if;

  update public.bookings set status='completed' where id=p_booking_id;
  insert into public.booking_status_history(booking_id,old_status,new_status,changed_by)
  values(p_booking_id,'confirmed','completed',auth.uid());
end;
$function$;

revoke all on function public.complete_booking(uuid) from public, anon;
grant execute on function public.complete_booking(uuid) to authenticated;
