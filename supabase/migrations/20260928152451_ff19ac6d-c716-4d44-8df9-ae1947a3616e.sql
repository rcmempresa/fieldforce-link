REVOKE EXECUTE ON FUNCTION public.enforce_client_hour_lock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_client_hours_used(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_client_hours_locked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_client_hours_used(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_hours_locked(uuid) TO authenticated;