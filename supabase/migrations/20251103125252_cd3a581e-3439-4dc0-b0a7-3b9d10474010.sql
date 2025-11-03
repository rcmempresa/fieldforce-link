-- Fix search_path for existing functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION generate_work_order_reference()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 9) AS INTEGER)), 0) + 1
  INTO next_number
  FROM work_orders
  WHERE reference LIKE 'WO-' || TO_CHAR(now(), 'YYYY') || '-%';
  
  NEW.reference = 'WO-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION calculate_work_order_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE work_orders
  SET total_hours = (
    SELECT COALESCE(SUM(duration_hours), 0)
    FROM time_entries
    WHERE work_order_id = NEW.work_order_id
  )
  WHERE id = NEW.work_order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;