-- Grant only the write operations that have matching RLS policies.
grant insert, update on public.companies to authenticated;
grant insert, update on public.masters to authenticated;
grant insert, update on public.services to authenticated;
grant insert, update on public.working_hours to authenticated;
grant insert, update on public.schedule_exceptions to authenticated;
grant insert, update on public.booking_settings to authenticated;

-- Public booking writes are performed only by the SECURITY DEFINER RPC, never direct table inserts.
revoke insert, update, delete on public.bookings from anon, authenticated;
revoke insert, update, delete on public.clients from anon, authenticated;
revoke insert, update, delete on public.company_members from anon, authenticated;
revoke insert, update, delete on public.booking_status_history from anon, authenticated;
