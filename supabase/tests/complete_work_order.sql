-- Run in a rolled-back transaction: technician completes an assigned OT; non-assignee is blocked.
BEGIN;
DO $$
DECLARE wo uuid; tech uuid; other uuid;
BEGIN
  SELECT a.work_order_id, a.user_id INTO wo, tech FROM work_order_assignments a JOIN work_orders w ON w.id=a.work_order_id
   WHERE w.status IN ('pending','in_progress') AND NOT has_role(a.user_id,'manager') LIMIT 1;
  SELECT user_id INTO other FROM user_roles WHERE role='employee' AND approved AND user_id<>tech
    AND NOT EXISTS (SELECT 1 FROM work_order_assignments WHERE work_order_id=wo AND user_id=user_roles.user_id) LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',other,'role','authenticated')::text, true);
  BEGIN PERFORM complete_work_order(wo); RAISE EXCEPTION 'FAIL_other_allowed';
  EXCEPTION WHEN others THEN IF SQLERRM='FAIL_other_allowed' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',tech,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM complete_work_order(wo);
  RESET ROLE;
  IF (SELECT status FROM work_orders WHERE id=wo)<>'completed' THEN RAISE EXCEPTION 'FAIL_not_completed'; END IF;
  RAISE NOTICE 'ALL_OK';
END $$;
ROLLBACK;
