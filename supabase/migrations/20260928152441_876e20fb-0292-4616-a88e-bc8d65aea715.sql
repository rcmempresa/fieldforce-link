ALTER TABLE public.client_hour_quotas
  ADD COLUMN IF NOT EXISTS lock_when_exhausted boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS manually_unlocked boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS client_hour_quotas_client_year_uidx ON public.client_hour_quotas(client_id, year);

CREATE OR REPLACE FUNCTION public.get_client_hours_used(_client_id uuid, _year integer)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(te.duration_hours), 0)
  FROM public.time_entries te
  JOIN public.work_orders wo ON wo.id = te.work_order_id
  WHERE wo.client_id = _client_id
    AND EXTRACT(YEAR FROM te.start_time) = _year
    AND (auth.uid() = _client_id OR public.has_role(auth.uid(), 'manager'));
$$;

CREATE OR REPLACE FUNCTION public.is_client_hours_locked(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_hour_quotas q
    WHERE q.client_id = _client_id
      AND q.year = EXTRACT(YEAR FROM now())::int
      AND q.lock_when_exhausted
      AND NOT q.manually_unlocked
      AND (SELECT COALESCE(SUM(te.duration_hours),0) FROM public.time_entries te
           JOIN public.work_orders wo ON wo.id = te.work_order_id
           WHERE wo.client_id = _client_id
             AND EXTRACT(YEAR FROM te.start_time) = q.year) >= q.contracted_hours
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_client_hour_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() = NEW.client_id AND NOT public.has_role(auth.uid(), 'manager')
     AND public.is_client_hours_locked(NEW.client_id) THEN
    RAISE EXCEPTION 'CLIENT_HOURS_EXHAUSTED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_client_hour_lock_trigger ON public.work_orders;
CREATE TRIGGER enforce_client_hour_lock_trigger BEFORE INSERT ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_client_hour_lock();

DROP TRIGGER IF EXISTS update_client_hour_quotas_updated_at ON public.client_hour_quotas;
CREATE TRIGGER update_client_hour_quotas_updated_at BEFORE UPDATE ON public.client_hour_quotas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();