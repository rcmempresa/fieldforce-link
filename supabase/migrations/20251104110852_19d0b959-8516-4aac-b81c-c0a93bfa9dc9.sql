-- Allow employees and managers to view client profiles when they have assigned work orders
CREATE POLICY "Employees can view client profiles for assigned work orders"
ON profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'employee'::app_role) 
  AND EXISTS (
    SELECT 1 
    FROM work_orders wo
    JOIN work_order_assignments woa ON woa.work_order_id = wo.id
    WHERE wo.client_id = profiles.id
    AND woa.user_id = auth.uid()
  )
);