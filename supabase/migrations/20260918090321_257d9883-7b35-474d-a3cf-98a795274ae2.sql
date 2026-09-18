ALTER TABLE public.work_orders ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.work_order_assignments ALTER COLUMN assigned_by DROP NOT NULL;
ALTER TABLE public.attachments ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.maintenance_reports ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.work_order_materials ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.equipment_attachments ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.user_roles ALTER COLUMN approved_by DROP NOT NULL;