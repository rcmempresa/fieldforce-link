CREATE POLICY "Employees can view co-worker profiles via time entries"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'employee'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.time_entries te_other
    WHERE te_other.user_id = profiles.id
      AND (
        EXISTS (
          SELECT 1 FROM public.work_order_assignments woa
          WHERE woa.work_order_id = te_other.work_order_id
            AND woa.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.time_entries te_self
          WHERE te_self.work_order_id = te_other.work_order_id
            AND te_self.user_id = auth.uid()
        )
      )
  )
);