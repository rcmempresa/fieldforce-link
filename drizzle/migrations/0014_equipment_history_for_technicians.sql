CREATE OR REPLACE FUNCTION public.get_equipment_history(_equipment uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ids uuid[];
BEGIN
  IF NOT (has_role(auth.uid(),'manager') OR (has_role(auth.uid(),'employee') AND EXISTS (
    SELECT 1 FROM work_order_equipments e JOIN work_order_assignments a ON a.work_order_id=e.work_order_id
    WHERE e.equipment_id=_equipment AND a.user_id=auth.uid()))) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  SELECT array_agg(DISTINCT work_order_id) INTO ids FROM work_order_equipments WHERE equipment_id=_equipment;
  RETURN jsonb_build_object(
    'orders', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT id, reference, title, status, scheduled_date, created_at, description, notes FROM work_orders WHERE id = ANY(ids)) x),'[]'),
    'reports', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT id, work_order_id, report_type, report_date, technician_name, status, pdf_url, created_at FROM maintenance_reports WHERE work_order_id = ANY(ids)) x),'[]'),
    'attachments', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.uploaded_at DESC) FROM (SELECT id, work_order_id, filename, url, uploaded_at FROM attachments WHERE work_order_id = ANY(ids)) x),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.get_equipment_history(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_equipment_history(uuid) TO authenticated;