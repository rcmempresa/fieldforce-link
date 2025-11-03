-- Phase 1 & 2: Create new role system and clean up existing user

-- First, drop all existing policies that depend on old functions
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

-- Now drop old functions
DROP FUNCTION IF EXISTS public.has_role(uuid, user_role);
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('manager', 'employee', 'client');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role = _role 
    AND approved = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND approved = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles 
  WHERE user_id = _user_id 
  AND approved = true;
$$;

CREATE OR REPLACE FUNCTION public.is_first_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1);
$$;

-- Update handle_new_user trigger to implement new logic
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first boolean;
BEGIN
  -- Check if this is the first user
  is_first := (SELECT COUNT(*) FROM auth.users) = 1;
  
  -- Create profile
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  
  -- If first user, make them manager and approve them
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role, approved, approved_at)
    VALUES (NEW.id, 'manager', true, now());
  END IF;
  
  RETURN NEW;
END;
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can manage roles" ON user_roles
  FOR ALL USING (has_role(auth.uid(), 'manager'));

-- Recreate all policies with new system
CREATE POLICY "Managers can view all profiles" ON profiles
  FOR SELECT USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Clients can view own equipments" ON equipments
  FOR SELECT USING (
    client_id = auth.uid() OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'employee')
  );

CREATE POLICY "Managers can manage all equipments" ON equipments
  FOR ALL USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Clients can view own work orders" ON work_orders
  FOR SELECT USING (
    client_id = auth.uid() OR
    created_by = auth.uid() OR
    has_role(auth.uid(), 'manager') OR
    has_role(auth.uid(), 'employee')
  );

CREATE POLICY "Managers can manage all work orders" ON work_orders
  FOR ALL USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can manage work order equipments" ON work_order_equipments
  FOR ALL USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Employees can view own assignments" ON work_order_assignments
  FOR SELECT USING (
    user_id = auth.uid() OR
    has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Managers can manage assignments" ON work_order_assignments
  FOR ALL USING (has_role(auth.uid(), 'manager'));

CREATE POLICY "Users can view own time entries" ON time_entries
  FOR SELECT USING (
    user_id = auth.uid() OR
    has_role(auth.uid(), 'manager')
  );

CREATE POLICY "Clients and managers can view invoices" ON invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM work_orders 
      WHERE id = work_order_id 
      AND (client_id = auth.uid() OR has_role(auth.uid(), 'manager'))
    )
  );

-- Remove role column from profiles (keep profile data only)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- Delete existing user (this will cascade to profiles and other tables)
DELETE FROM auth.users WHERE id = 'a120048f-d352-4e68-b34e-85084267bdbb';