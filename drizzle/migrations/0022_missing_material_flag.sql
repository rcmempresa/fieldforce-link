ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS missing_material_since timestamptz, ADD COLUMN IF NOT EXISTS missing_material_note text;

CREATE OR REPLACE FUNCTION public.pause_work_order(_entry uuid, _reason public.pause_reason, _note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e record; others int; new_status work_order_status;
BEGIN
  SELECT * INTO e FROM time_entries WHERE id = _entry FOR UPDATE;
  IF e IS NULL THEN RAISE EXCEPTION 'Sessão não encontrada'; END IF;
  IF e.user_id <> auth.uid() AND NOT has_role(auth.uid(),'manager') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF e.end_time IS NOT NULL THEN RAISE EXCEPTION 'Esta sessão já estava terminada. Atualize a página.'; END IF;
  IF _reason = 'falta_material' AND coalesce(trim(_note),'') = '' THEN RAISE EXCEPTION 'Descreva o material em falta'; END IF;
  UPDATE time_entries SET end_time = now(), duration_hours = extract(epoch from (now() - start_time))/3600,
    pause_reason = _reason, note = CASE WHEN _reason='falta_material' THEN 'Material em falta: ' || _note ELSE NULL END
  WHERE id = _entry;
  SELECT count(*) INTO others FROM time_entries WHERE work_order_id = e.work_order_id AND end_time IS NULL AND user_id <> e.user_id;
  new_status := CASE WHEN others > 0 THEN 'in_progress' ELSE 'pending' END;
  UPDATE work_orders SET status = new_status,
    missing_material_since = CASE WHEN _reason='falta_material' THEN now() ELSE missing_material_since END,
    missing_material_note = CASE WHEN _reason='falta_material' THEN _note ELSE missing_material_note END
  WHERE id = e.work_order_id;
  IF _reason = 'falta_material' AND others = 0 THEN
    INSERT INTO work_order_previous_assignments (work_order_id, user_id)
      SELECT work_order_id, user_id FROM work_order_assignments WHERE work_order_id = e.work_order_id
    ON CONFLICT (work_order_id, user_id) DO UPDATE SET removed_at = now();
    DELETE FROM work_order_assignments WHERE work_order_id = e.work_order_id;
  END IF;
  RETURN new_status::text;
END $$;

CREATE OR REPLACE FUNCTION public.set_missing_material(_wo uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT has_role(auth.uid(),'manager') THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF _note IS NULL THEN
    UPDATE work_orders SET missing_material_since = NULL, missing_material_note = NULL WHERE id = _wo;
  ELSE
    IF trim(_note) = '' THEN RAISE EXCEPTION 'Descreva o material em falta'; END IF;
    UPDATE work_orders SET missing_material_since = now(), missing_material_note = _note WHERE id = _wo;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.clear_missing_material_on_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('completed','invoiced','cancelled','awaiting_purchase_order') THEN
    NEW.missing_material_since := NULL; NEW.missing_material_note := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER clear_missing_material_status BEFORE UPDATE OF status ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.clear_missing_material_on_status();

CREATE OR REPLACE FUNCTION public.clear_missing_material_on_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.end_time IS NULL THEN
    UPDATE work_orders SET missing_material_since = NULL, missing_material_note = NULL
    WHERE id = NEW.work_order_id AND missing_material_since IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER clear_missing_material_session AFTER INSERT ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.clear_missing_material_on_session();

CREATE OR REPLACE FUNCTION public.reassign_previous_technicians(_wo uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'manager') THEN RAISE EXCEPTION 'not allowed'; END IF;
  INSERT INTO public.work_order_assignments (work_order_id, user_id, assigned_by)
    SELECT p.work_order_id, p.user_id, auth.uid() FROM public.work_order_previous_assignments p
    WHERE p.work_order_id = _wo
      AND NOT EXISTS (SELECT 1 FROM public.work_order_assignments a WHERE a.work_order_id = _wo AND a.user_id = p.user_id);
  DELETE FROM public.work_order_previous_assignments WHERE work_order_id = _wo;
  UPDATE public.work_orders SET missing_material_since = NULL, missing_material_note = NULL WHERE id = _wo;
END $function$;

UPDATE public.work_orders w SET missing_material_since = t.start_time, missing_material_note = regexp_replace(coalesce(t.note,''), '^Material em falta: ', '')
FROM (SELECT DISTINCT ON (work_order_id) work_order_id, pause_reason, note, start_time FROM public.time_entries ORDER BY work_order_id, start_time DESC) t
WHERE t.work_order_id = w.id AND t.pause_reason = 'falta_material' AND w.status NOT IN ('completed','invoiced','cancelled','in_progress','awaiting_purchase_order');