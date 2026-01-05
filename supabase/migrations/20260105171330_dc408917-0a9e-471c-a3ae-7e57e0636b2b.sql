-- Keep work_orders.total_hours always accurate based on time_entries

CREATE OR REPLACE FUNCTION public.calculate_work_order_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  wo_id uuid;
BEGIN
  wo_id := COALESCE(NEW.work_order_id, OLD.work_order_id);

  UPDATE public.work_orders
  SET total_hours = (
    SELECT COALESCE(SUM(te.duration_hours), 0)
    FROM public.time_entries te
    WHERE te.work_order_id = wo_id
  )
  WHERE id = wo_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_calculate_work_order_hours ON public.time_entries;

CREATE TRIGGER trg_calculate_work_order_hours
AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.calculate_work_order_hours();
