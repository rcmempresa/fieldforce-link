CREATE POLICY "Employees can view co-assigned employee profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'employee'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.work_order_assignments woa_self
    JOIN public.work_order_assignments woa_other
      ON woa_other.work_order_id = woa_self.work_order_id
    WHERE woa_self.user_id = auth.uid()
      AND woa_other.user_id = profiles.id
  )
);