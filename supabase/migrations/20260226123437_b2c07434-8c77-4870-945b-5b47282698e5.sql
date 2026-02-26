
-- Drop all existing policies on work_orders and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Clients can create work orders" ON work_orders;
DROP POLICY IF EXISTS "Clients can view own work orders" ON work_orders;
DROP POLICY IF EXISTS "Managers can manage all work orders" ON work_orders;
DROP POLICY IF EXISTS "Employees can view assigned work orders" ON work_orders;
DROP POLICY IF EXISTS "Employees can update assigned work order status" ON work_orders;

CREATE POLICY "Managers can manage all work orders"
ON work_orders FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Clients can create work orders"
ON work_orders FOR INSERT TO authenticated
WITH CHECK ((client_id = auth.uid()) AND has_role(auth.uid(), 'client'::app_role));

CREATE POLICY "Clients can view own work orders"
ON work_orders FOR SELECT TO authenticated
USING ((client_id = auth.uid()) OR (created_by = auth.uid()));

CREATE POLICY "Employees can view assigned work orders"
ON work_orders FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Employees can update assigned work order status"
ON work_orders FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM work_order_assignments
  WHERE work_order_assignments.work_order_id = work_orders.id
  AND work_order_assignments.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM work_order_assignments
  WHERE work_order_assignments.work_order_id = work_orders.id
  AND work_order_assignments.user_id = auth.uid()
));

-- Drop all existing policies on work_order_equipments and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Anyone can view work order equipments if they can view the work order" ON work_order_equipments;
DROP POLICY IF EXISTS "Anyone can view work order equipments if they can view the work" ON work_order_equipments;
DROP POLICY IF EXISTS "Managers can manage work order equipments" ON work_order_equipments;
DROP POLICY IF EXISTS "Clients can link equipments to own work orders" ON work_order_equipments;

CREATE POLICY "Managers can manage work order equipments"
ON work_order_equipments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Anyone can view work order equipments"
ON work_order_equipments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM work_orders WHERE work_orders.id = work_order_equipments.work_order_id
));

CREATE POLICY "Clients can link equipments to own work orders"
ON work_order_equipments FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM work_orders
  WHERE work_orders.id = work_order_equipments.work_order_id
  AND work_orders.client_id = auth.uid()
));
