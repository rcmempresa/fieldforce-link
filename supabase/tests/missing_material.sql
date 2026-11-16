-- Rolled-back check: pausing for missing material flags the OT and releases technicians; resuming clears the flag.
-- Expected output: ERROR ALL_OK
DO $$
DECLARE u uuid; c uuid; wo uuid; te uuid; s text; f timestamptz; n int;
BEGIN
  SELECT user_id INTO u FROM user_roles WHERE role='employee' AND approved LIMIT 1;
  SELECT id INTO c FROM profiles LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  INSERT INTO work_orders(title,client_id,status) VALUES('TESTE',c,'in_progress') RETURNING id INTO wo;
  INSERT INTO work_order_assignments(work_order_id,user_id) VALUES(wo,u);
  INSERT INTO time_entries(work_order_id,user_id,start_time,work_regime) VALUES(wo,u,now()-interval '1 hour','labor') RETURNING id INTO te;
  s := pause_work_order(te,'falta_material','cabo 3x2.5');
  SELECT missing_material_since INTO f FROM work_orders WHERE id=wo;
  SELECT count(*) INTO n FROM work_order_assignments WHERE work_order_id=wo;
  IF s<>'pending' OR f IS NULL OR n<>0 THEN RAISE EXCEPTION 'FAIL pause s=% f=% n=%',s,f,n; END IF;
  INSERT INTO time_entries(work_order_id,user_id,start_time,work_regime) VALUES(wo,u,now(),'labor');
  SELECT missing_material_since INTO f FROM work_orders WHERE id=wo;
  IF f IS NOT NULL THEN RAISE EXCEPTION 'FAIL resume'; END IF;
  RAISE EXCEPTION 'ALL_OK';
END $$;
