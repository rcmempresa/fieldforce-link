CREATE OR REPLACE FUNCTION public.my_closed_work_orders_hours()
RETURNS TABLE(id uuid, reference text, title text, client_name text, scheduled_date timestamptz, created_at timestamptz, status text, hours numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT w.id, w.reference, w.title, COALESCE(p.company_name, p.name), w.scheduled_date, w.created_at, w.status::text,
    COALESCE((SELECT SUM(te.duration_hours) FROM time_entries te WHERE te.work_order_id=w.id AND te.user_id=auth.uid()),0)
  FROM work_orders w LEFT JOIN profiles p ON p.id=w.client_id
  WHERE w.status IN ('completed','invoiced','awaiting_purchase_order')
    AND (EXISTS (SELECT 1 FROM work_order_assignments a WHERE a.work_order_id=w.id AND a.user_id=auth.uid())
      OR EXISTS (SELECT 1 FROM time_entries te WHERE te.work_order_id=w.id AND te.user_id=auth.uid()))
  ORDER BY w.created_at DESC
$$;
REVOKE EXECUTE ON FUNCTION public.my_closed_work_orders_hours() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_closed_work_orders_hours() TO authenticated;