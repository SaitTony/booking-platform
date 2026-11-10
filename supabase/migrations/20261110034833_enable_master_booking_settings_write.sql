-- Allow authorized page managers to persist online booking settings.
-- Keep access scoped to the same master-management predicate used by other builder tables.

create policy booking_settings_manager_write
on public.booking_settings
for all
to authenticated
using (private.can_manage_master(master_id))
with check (private.can_manage_master(master_id));

grant insert, update, delete on public.booking_settings to authenticated;
