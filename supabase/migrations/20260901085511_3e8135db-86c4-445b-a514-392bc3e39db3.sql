ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS is_labor_hours boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_after_hours boolean NOT NULL DEFAULT false;