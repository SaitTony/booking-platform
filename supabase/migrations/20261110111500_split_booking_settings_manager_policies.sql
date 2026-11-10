-- Avoid overlapping SELECT policies: keep staff read access separate from writes.
drop policy if exists booking_settings_manager_write on public.booking_settings;

create policy booking_settings_manager_insert
on public.booking_settings for insert to authenticated
with check (private.can_manage_master(master_id));

create policy booking_settings_manager_update
on public.booking_settings for update to authenticated
using (private.can_manage_master(master_id))
with check (private.can_manage_master(master_id));

create policy booking_settings_manager_delete
on public.booking_settings for delete to authenticated
using (private.can_manage_master(master_id));
