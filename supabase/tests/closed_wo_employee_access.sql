-- Rolled back. Assigned technicians lose access once an OT is closed; clients keep it.
BEGIN;
DO $$
DECLARE wo uuid; tech uuid; cli uuid;
BEGIN
  SELECT a.work_order_id, a.user_id, w.client_id INTO wo, tech, cli FROM work_order_assignments a
    JOIN work_orders w ON w.id=a.work_order_id
    WHERE w.status IN ('pending','in_progress') AND NOT has_role(a.user_id,'manager') LIMIT 1;
  IF NOT can_access_work_order(wo, tech) THEN RAISE EXCEPTION 'open not accessible'; END IF;
  UPDATE work_orders SET status='completed' WHERE id=wo;
  IF can_access_work_order(wo, tech) THEN RAISE EXCEPTION 'closed still accessible'; END IF;
  IF NOT can_access_work_order(wo, cli) THEN RAISE EXCEPTION 'client lost access'; END IF;
  UPDATE work_orders SET status='pending' WHERE id=wo;
  IF NOT can_access_work_order(wo, tech) THEN RAISE EXCEPTION 'reopen not accessible'; END IF;
  RAISE NOTICE 'ALL_OK';
END $$;
ROLLBACK;
