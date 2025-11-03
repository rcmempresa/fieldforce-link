-- Drop existing problematic policies
DROP POLICY IF EXISTS "Managers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Clients can view own equipments" ON equipments;
DROP POLICY IF EXISTS "Managers can manage all equipments" ON equipments;
DROP POLICY IF EXISTS "Clients can view own work orders" ON work_orders;
DROP POLICY IF EXISTS "Managers can manage all work orders" ON work_orders;
DROP POLICY IF EXISTS "Managers can manage work order equipments" ON work_order_equipments;
DROP POLICY IF EXISTS "Employees can view own assignments" ON work_order_assignments;
DROP POLICY IF EXISTS "Managers can manage assignments" ON work_order_assignments;
DROP POLICY IF EXISTS "Users can view own time entries" ON time_entries;
DROP POLICY IF EXISTS "Clients and managers can view invoices" ON invoices;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id;
$$;

-- Create security definer function to check if user has role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = _user_id AND role = _role
  );
$$;

-- Recreate profiles policies without recursion
CREATE POLICY "Managers can view all profiles" ON profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'manager'));

-- Recreate equipments policies
CREATE POLICY "Clients can view own equipments" ON equipments
  FOR SELECT USING (
    client_id = auth.uid() OR
    public.get_user_role(auth.uid()) IN ('manager', 'employee')
  );

CREATE POLICY "Managers can manage all equipments" ON equipments
  FOR ALL USING (public.has_role(auth.uid(), 'manager'));

-- Recreate work_orders policies
CREATE POLICY "Clients can view own work orders" ON work_orders
  FOR SELECT USING (
    client_id = auth.uid() OR
    created_by = auth.uid() OR
    public.get_user_role(auth.uid()) IN ('manager', 'employee')
  );

CREATE POLICY "Managers can manage all work orders" ON work_orders
  FOR ALL USING (public.has_role(auth.uid(), 'manager'));

-- Recreate work_order_equipments policies
CREATE POLICY "Managers can manage work order equipments" ON work_order_equipments
  FOR ALL USING (public.has_role(auth.uid(), 'manager'));

-- Recreate work_order_assignments policies
CREATE POLICY "Employees can view own assignments" ON work_order_assignments
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Managers can manage assignments" ON work_order_assignments
  FOR ALL USING (public.has_role(auth.uid(), 'manager'));

-- Recreate time_entries policies
CREATE POLICY "Users can view own time entries" ON time_entries
  FOR SELECT USING (
    user_id = auth.uid() OR
    public.has_role(auth.uid(), 'manager')
  );

-- Recreate invoices policies
CREATE POLICY "Clients and managers can view invoices" ON invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM work_orders 
      WHERE id = work_order_id 
      AND (client_id = auth.uid() OR public.has_role(auth.uid(), 'manager'))
    )
  );