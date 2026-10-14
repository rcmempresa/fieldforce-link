CREATE INDEX IF NOT EXISTS idx_time_entries_user_wo ON public.time_entries(user_id, work_order_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_wo_user ON public.time_entries(work_order_id, user_id);
CREATE INDEX IF NOT EXISTS idx_woa_user_wo ON public.work_order_assignments(user_id, work_order_id);
CREATE INDEX IF NOT EXISTS idx_woa_wo_user ON public.work_order_assignments(work_order_id, user_id);
CREATE INDEX IF NOT EXISTS idx_wo_client ON public.work_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_wopa_user_wo ON public.work_order_previous_assignments(user_id, work_order_id);

CREATE OR REPLACE FUNCTION public.employee_visible_profile_ids(_viewer uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH my_wos AS (
    SELECT work_order_id FROM work_order_assignments WHERE user_id = _viewer
    UNION SELECT work_order_id FROM time_entries WHERE user_id = _viewer
    UNION SELECT work_order_id FROM work_order_previous_assignments WHERE user_id = _viewer
  )
  SELECT wo.client_id FROM work_orders wo JOIN my_wos m ON m.work_order_id = wo.id
  UNION SELECT woa.user_id FROM work_order_assignments woa JOIN my_wos m ON m.work_order_id = woa.work_order_id
  UNION SELECT te.user_id FROM time_entries te JOIN my_wos m ON m.work_order_id = te.work_order_id
$$;

DROP POLICY IF EXISTS "Employees can view client profiles for assigned work orders" ON public.profiles;
DROP POLICY IF EXISTS "Employees can view co-assigned employee profiles" ON public.profiles;
DROP POLICY IF EXISTS "Employees can view co-worker profiles via time entries" ON public.profiles;
DROP POLICY IF EXISTS "Previous assignees can view client profiles" ON public.profiles;

CREATE POLICY "Employees can view related profiles" ON public.profiles
FOR SELECT TO authenticated
USING (id IN (SELECT public.employee_visible_profile_ids(auth.uid())));