CREATE POLICY "Managers can manage all reports" ON public.maintenance_reports FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'manager')) WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Assigned employees can update reports" ON public.maintenance_reports FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.work_order_assignments woa WHERE woa.work_order_id = maintenance_reports.work_order_id AND woa.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.work_order_assignments woa WHERE woa.work_order_id = maintenance_reports.work_order_id AND woa.user_id = auth.uid()));