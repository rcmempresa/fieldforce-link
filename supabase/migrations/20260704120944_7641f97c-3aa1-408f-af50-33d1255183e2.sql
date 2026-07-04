
-- Allow deleting users by clearing references in audit-like columns
ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS work_orders_created_by_fkey;
ALTER TABLE public.work_orders ADD CONSTRAINT work_orders_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.work_order_assignments DROP CONSTRAINT IF EXISTS work_order_assignments_assigned_by_fkey;
ALTER TABLE public.work_order_assignments ADD CONSTRAINT work_order_assignments_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.attachments DROP CONSTRAINT IF EXISTS attachments_uploaded_by_fkey;
ALTER TABLE public.attachments ADD CONSTRAINT attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.work_order_materials DROP CONSTRAINT IF EXISTS work_order_materials_created_by_fkey;
ALTER TABLE public.work_order_materials ADD CONSTRAINT work_order_materials_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_reports DROP CONSTRAINT IF EXISTS maintenance_reports_created_by_fkey;
ALTER TABLE public.maintenance_reports ADD CONSTRAINT maintenance_reports_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_approved_by_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.equipment_attachments DROP CONSTRAINT IF EXISTS equipment_attachments_uploaded_by_fkey;
ALTER TABLE public.equipment_attachments ADD CONSTRAINT equipment_attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
