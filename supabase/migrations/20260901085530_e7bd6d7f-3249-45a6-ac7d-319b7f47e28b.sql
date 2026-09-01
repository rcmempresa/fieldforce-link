DROP POLICY IF EXISTS "Users can manage own time entries" ON public.time_entries;

CREATE POLICY "Users can insert own time entries when WO open"
ON public.time_entries FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id
        AND wo.status NOT IN ('completed','invoiced','cancelled')
    )
  )
);

CREATE POLICY "Users can update own time entries when WO open"
ON public.time_entries FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id
        AND wo.status NOT IN ('completed','invoiced')
    )
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id
        AND wo.status NOT IN ('completed','invoiced')
    )
  )
);

CREATE POLICY "Users can delete own time entries when WO open"
ON public.time_entries FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'manager')
    OR EXISTS (
      SELECT 1 FROM public.work_orders wo
      WHERE wo.id = work_order_id
        AND wo.status NOT IN ('completed','invoiced')
    )
  )
);

CREATE POLICY "Managers can manage all time entries"
ON public.time_entries FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'manager'));