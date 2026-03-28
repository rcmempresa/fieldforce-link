
CREATE TABLE public.work_order_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'un',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.work_order_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage all materials"
ON public.work_order_materials
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Employees can manage materials for assigned work orders"
ON public.work_order_materials
FOR ALL
TO authenticated
USING (
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM work_order_assignments woa
    WHERE woa.work_order_id = work_order_materials.work_order_id
    AND woa.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM work_order_assignments woa
    WHERE woa.work_order_id = work_order_materials.work_order_id
    AND woa.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can view materials for own work orders"
ON public.work_order_materials
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM work_orders wo
    WHERE wo.id = work_order_materials.work_order_id
    AND wo.client_id = auth.uid()
  )
);
