
-- Drop all work_orders policies
DROP POLICY IF EXISTS "Clients can create work orders" ON work_orders;
DROP POLICY IF EXISTS "Clients can view own work orders" ON work_orders;
DROP POLICY IF EXISTS "Managers can manage all work orders" ON work_orders;
DROP POLICY IF EXISTS "Employees can view assigned work orders" ON work_orders;
DROP POLICY IF EXISTS "Employees can update assigned work order status" ON work_orders;

-- Recreate as explicitly PERMISSIVE
CREATE POLICY "Managers can manage all work orders"
ON work_orders AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Clients can create work orders"
ON work_orders AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can view own work orders"
ON work_orders AS PERMISSIVE FOR SELECT TO authenticated
USING ((client_id = auth.uid()) OR (created_by = auth.uid()));

CREATE POLICY "Employees can view assigned work orders"
ON work_orders AS PERMISSIVE FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Employees can update assigned work order status"
ON work_orders AS PERMISSIVE FOR UPDATE TO authenticated
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

-- Drop all work_order_equipments policies
DROP POLICY IF EXISTS "Anyone can view work order equipments" ON work_order_equipments;
DROP POLICY IF EXISTS "Anyone can view work order equipments if they can view the work order" ON work_order_equipments;
DROP POLICY IF EXISTS "Anyone can view work order equipments if they can view the work" ON work_order_equipments;
DROP POLICY IF EXISTS "Managers can manage work order equipments" ON work_order_equipments;
DROP POLICY IF EXISTS "Clients can link equipments to own work orders" ON work_order_equipments;

CREATE POLICY "Managers can manage work order equipments"
ON work_order_equipments AS PERMISSIVE FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Anyone can view work order equipments"
ON work_order_equipments AS PERMISSIVE FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM work_orders WHERE work_orders.id = work_order_equipments.work_order_id
));

CREATE POLICY "Clients can link equipments to own work orders"
ON work_order_equipments AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM work_orders
  WHERE work_orders.id = work_order_equipments.work_order_id
  AND work_orders.client_id = auth.uid()
));
