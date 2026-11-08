-- Correct staff visibility of client records and remove unused anonymous write grants.
drop policy if exists clients_scoped_read on public.clients;

create policy clients_scoped_read
on public.clients
for select
to authenticated
using (
  is_owner()
  or exists (
    select 1
    from public.bookings b
    where b.client_id = clients.id
      and can_view_master(b.master_id)
  )
);

revoke insert, update, delete, truncate, references, trigger
on all tables in schema public
from anon;
