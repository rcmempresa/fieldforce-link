ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS equipment_type text NOT NULL DEFAULT 'general';
ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS outdoor_model text;
ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS outdoor_serial_number text;
ALTER TABLE public.work_order_equipments ADD COLUMN IF NOT EXISTS unit_part text NOT NULL DEFAULT 'both';
ALTER TABLE public.work_order_equipments ADD CONSTRAINT work_order_equipments_unit_part_check CHECK (unit_part IN ('indoor','outdoor','both'));
ALTER TABLE public.equipments ADD CONSTRAINT equipments_type_check CHECK (equipment_type IN ('general','ac'));