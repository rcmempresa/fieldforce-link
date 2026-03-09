CREATE POLICY "Employees can view time entries for assigned work orders"
ON public.time_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM work_order_assignments woa
    WHERE woa.work_order_id = time_entries.work_order_id
    AND woa.user_id = auth.uid()
  )
);