-- Keep administrative operations and trigger-only helpers off the anonymous API.
revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated, service_role;
