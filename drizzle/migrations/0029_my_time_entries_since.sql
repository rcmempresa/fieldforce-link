CREATE OR REPLACE FUNCTION public.my_time_entries_since(_from timestamptz)
RETURNS TABLE(start_time timestamptz, duration_hours numeric, work_regime text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT te.start_time, te.duration_hours, te.work_regime::text FROM time_entries te
  WHERE te.user_id = auth.uid() AND te.start_time >= _from
$$;
REVOKE EXECUTE ON FUNCTION public.my_time_entries_since(timestamptz) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_time_entries_since(timestamptz) TO authenticated;