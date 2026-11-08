-- Grant only the write operations that have matching RLS policies.
grant insert, update on public.companies to authenticated;
grant insert, update on public.masters to authenticated;
grant insert, update on public.services to authenticated;
grant insert, update on public.working_hours to authenticated;
grant insert, update on public.schedule_exceptions to authenticated;

-- Booking rules are fixed product constraints in v1. Staff may read settings,
-- but no Data API role may write them (including inherited/default grants).
revoke insert, update, delete on public.booking_settings from public, anon, authenticated;

-- Public booking writes are performed only by the SECURITY DEFINER RPC, never direct table inserts.
revoke insert, update, delete on public.bookings from anon, authenticated;
revoke insert, update, delete on public.clients from anon, authenticated;
revoke insert, update, delete on public.company_members from anon, authenticated;
revoke insert, update, delete on public.booking_status_history from anon, authenticated;


-- New Supabase projects no longer receive broad automatic Data API grants.
-- Explicitly grant the server-side service role the table access used by Edge Functions.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;

-- RLS policy helper functions must be executable by the API roles evaluating those policies.
revoke all on function public.is_owner() from public, anon;
revoke all on function public.can_manage_master(uuid) from public, anon;
revoke all on function public.can_view_master(uuid) from public, anon;
revoke all on function public.is_company_admin(uuid) from public, anon;
grant execute on function public.is_owner() to authenticated, service_role;
grant execute on function public.can_manage_master(uuid) to authenticated, service_role;
grant execute on function public.can_view_master(uuid) to authenticated, service_role;
grant execute on function public.is_company_admin(uuid) to authenticated, service_role;

-- Server-side account management uses service_role only; it is never exposed to the browser.
grant execute on function public.owner_assign_user_role(uuid,uuid,text,uuid,uuid) to service_role;
