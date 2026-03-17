
DROP POLICY "Employees can view assigned work orders" ON work_orders;

CREATE POLICY "Employees can view assigned work orders" ON work_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM work_order_assignments
      WHERE work_order_assignments.work_order_id = work_orders.id
      AND work_order_assignments.user_id = auth.uid()
    )
  );
