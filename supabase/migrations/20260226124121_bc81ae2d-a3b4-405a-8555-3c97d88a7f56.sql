
CREATE OR REPLACE FUNCTION public.generate_work_order_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := 'WO-' || TO_CHAR(now(), 'YYYY') || '-';
  
  -- Use advisory lock to prevent race conditions
  PERFORM pg_advisory_xact_lock(hashtext('work_order_reference'));
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 9) AS INTEGER)), 0) + 1
  INTO next_number
  FROM work_orders
  WHERE reference LIKE year_prefix || '%';
  
  NEW.reference = year_prefix || LPAD(next_number::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;
