-- Allow employees to update status of work orders assigned to them
CREATE POLICY "Employees can update assigned work order status"
ON work_orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM work_order_assignments
    WHERE work_order_assignments.work_order_id = work_orders.id
    AND work_order_assignments.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM work_order_assignments
    WHERE work_order_assignments.work_order_id = work_orders.id
    AND work_order_assignments.user_id = auth.uid()
  )
);