CREATE TYPE public.work_regime AS ENUM ('labor', 'after');

ALTER TABLE public.time_entries
  ADD COLUMN work_regime public.work_regime;

UPDATE public.time_entries te
SET work_regime = CASE
  WHEN wo.is_labor_hours IS TRUE AND COALESCE(wo.is_after_hours, false) IS FALSE THEN 'labor'::public.work_regime
  WHEN wo.is_after_hours IS TRUE AND COALESCE(wo.is_labor_hours, false) IS FALSE THEN 'after'::public.work_regime
  WHEN EXTRACT(HOUR FROM te.start_time) >= 20 OR EXTRACT(HOUR FROM te.start_time) < 8 THEN 'after'::public.work_regime
  ELSE 'labor'::public.work_regime
END
FROM public.work_orders wo
WHERE wo.id = te.work_order_id;

UPDATE public.time_entries
SET work_regime = CASE
  WHEN EXTRACT(HOUR FROM start_time) >= 20 OR EXTRACT(HOUR FROM start_time) < 8 THEN 'after'::public.work_regime
  ELSE 'labor'::public.work_regime
END
WHERE work_regime IS NULL;

ALTER TABLE public.time_entries
  ALTER COLUMN work_regime SET DEFAULT 'labor'::public.work_regime,
  ALTER COLUMN work_regime SET NOT NULL;