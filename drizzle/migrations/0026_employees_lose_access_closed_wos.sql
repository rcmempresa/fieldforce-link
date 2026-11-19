CREATE OR REPLACE FUNCTION public.wo_is_open(_wo uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM work_orders WHERE id=_wo AND status NOT IN ('completed','invoiced','awaiting_purchase_order'))
$$;

ALTER POLICY "Employees can view assigned work orders" ON public.work_orders
  USING (status NOT IN ('completed','invoiced','awaiting_purchase_order') AND EXISTS (SELECT 1 FROM work_order_assignments WHERE work_order_assignments.work_order_id = work_orders.id AND work_order_assignments.user_id = auth.uid()));
ALTER POLICY "Previous assignees can view work orders" ON public.work_orders
  USING (status NOT IN ('completed','invoiced','awaiting_purchase_order') AND public.is_previous_assignee(id, auth.uid()));

CREATE OR REPLACE FUNCTION public.can_access_work_order(_wo uuid, _user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_user,'manager')
    OR EXISTS (SELECT 1 FROM work_orders WHERE id=_wo AND client_id=_user)
    OR (public.wo_is_open(_wo) AND (
         EXISTS (SELECT 1 FROM work_order_assignments WHERE work_order_id=_wo AND user_id=_user)
      OR EXISTS (SELECT 1 FROM time_entries WHERE work_order_id=_wo AND user_id=_user)
      OR EXISTS (SELECT 1 FROM work_order_previous_assignments WHERE work_order_id=_wo AND user_id=_user)))
$$;

ALTER POLICY "Employees can view reports for assigned work orders" ON public.maintenance_reports
  USING (public.wo_is_open(work_order_id) AND EXISTS (SELECT 1 FROM work_order_assignments woa WHERE woa.work_order_id = maintenance_reports.work_order_id AND woa.user_id = auth.uid()));
ALTER POLICY "Employees can manage own reports" ON public.maintenance_reports
  USING (created_by = auth.uid() AND public.wo_is_open(work_order_id))
  WITH CHECK (created_by = auth.uid());

ALTER POLICY "Employees can view time entries for assigned work orders" ON public.time_entries
  USING (public.wo_is_open(work_order_id) AND EXISTS (SELECT 1 FROM work_order_assignments woa WHERE woa.work_order_id = time_entries.work_order_id AND woa.user_id = auth.uid()));
ALTER POLICY "Previous assignees can view time entries" ON public.time_entries
  USING (public.wo_is_open(work_order_id) AND public.is_previous_assignee(work_order_id, auth.uid()));
ALTER POLICY "Users can view own time entries" ON public.time_entries
  USING (public.has_role(auth.uid(),'manager') OR (user_id = auth.uid() AND public.wo_is_open(work_order_id)));

ALTER POLICY "Employees can manage materials for assigned work orders" ON public.work_order_materials
  USING (public.wo_is_open(work_order_id) AND ((created_by = auth.uid()) OR EXISTS (SELECT 1 FROM work_order_assignments woa WHERE woa.work_order_id = work_order_materials.work_order_id AND woa.user_id = auth.uid())))
  WITH CHECK ((created_by = auth.uid()) OR EXISTS (SELECT 1 FROM work_order_assignments woa WHERE woa.work_order_id = work_order_materials.work_order_id AND woa.user_id = auth.uid()));