ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';
UPDATE public.equipments SET category = 'hvac' WHERE equipment_type = 'ac';
ALTER TABLE public.equipments ADD CONSTRAINT equipments_category_check CHECK (category IN ('hvac','electricity','generator','cctv','other'));
CREATE POLICY "Assigned employees can link equipments" ON public.work_order_equipments
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'employee') AND EXISTS (SELECT 1 FROM public.work_order_assignments a WHERE a.work_order_id = work_order_equipments.work_order_id AND a.user_id = auth.uid()));