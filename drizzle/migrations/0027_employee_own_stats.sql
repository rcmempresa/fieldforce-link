CREATE OR REPLACE FUNCTION public.my_hours_since(_from timestamptz) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(SUM(duration_hours),0) FROM time_entries WHERE user_id = auth.uid() AND start_time >= _from
$$;
CREATE OR REPLACE FUNCTION public.my_completed_count() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(DISTINCT wo.id)::int FROM work_orders wo
  WHERE wo.status = 'completed' AND (
    EXISTS (SELECT 1 FROM work_order_assignments a WHERE a.work_order_id = wo.id AND a.user_id = auth.uid()))
$$;
REVOKE EXECUTE ON FUNCTION public.my_hours_since(timestamptz), public.my_completed_count() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_hours_since(timestamptz), public.my_completed_count() TO authenticated;