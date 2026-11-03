DROP FUNCTION IF EXISTS public.decide_contract(uuid, boolean);
DROP FUNCTION IF EXISTS public.create_contract_work_order(uuid);
CREATE OR REPLACE FUNCTION public.create_contract_work_order(_contract uuid, _scheduled timestamptz DEFAULT NULL, _technician uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; wo_id uuid; t text; lbl text;
BEGIN
  IF NOT public.has_role(auth.uid(),'manager') THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT * INTO c FROM maintenance_contracts WHERE id = _contract;
  IF c IS NULL OR c.status <> 'active' THEN RAISE EXCEPTION 'contract not active'; END IF;
  lbl := CASE c.contract_type WHEN 'hvac' THEN 'AVAC' WHEN 'heat_pump' THEN 'Bomba de Calor' ELSE 'Eletricidade' END;
  SELECT string_agg(e.name, ', ') INTO t FROM maintenance_contract_equipments ce JOIN equipments e ON e.id = ce.equipment_id WHERE ce.contract_id = _contract;
  INSERT INTO work_orders (title, description, client_id, created_by, service_type, status, needs_scheduling, scheduled_date, contract_id)
  VALUES (COALESCE(t, 'Manutenção ' || lbl), 'Contrato de manutenção ' || lbl || ' - previsto para ' || to_char(COALESCE(_scheduled::date, c.next_date),'DD/MM/YYYY') || COALESCE(E'\n' || c.notes, ''),
          c.client_id, auth.uid(), 'maintenance', 'pending', _scheduled IS NULL, _scheduled, _contract)
  RETURNING id INTO wo_id;
  INSERT INTO work_order_equipments (work_order_id, equipment_id, unit_part)
    SELECT wo_id, equipment_id, unit_part FROM maintenance_contract_equipments WHERE contract_id = _contract;
  IF _technician IS NOT NULL THEN
    INSERT INTO work_order_assignments (work_order_id, user_id, assigned_by) VALUES (wo_id, _technician, auth.uid());
  END IF;
  RETURN wo_id;
END $$;
CREATE OR REPLACE FUNCTION public.decide_contract(_wo uuid, _continue boolean, _scheduled timestamptz DEFAULT NULL, _technician uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cid uuid; f text; new_wo uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'manager') THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT contract_id INTO cid FROM work_orders WHERE id = _wo;
  IF cid IS NULL THEN RAISE EXCEPTION 'no contract'; END IF;
  UPDATE work_orders SET contract_decision_pending = false WHERE id = _wo;
  IF _continue THEN
    SELECT frequency INTO f FROM maintenance_contracts WHERE id = cid;
    UPDATE maintenance_contracts SET next_date = COALESCE(_scheduled::date, (next_date + CASE f WHEN 'monthly' THEN interval '1 month' WHEN 'quarterly' THEN interval '3 months' ELSE interval '1 year' END)::date) WHERE id = cid;
    new_wo := public.create_contract_work_order(cid, _scheduled, _technician);
  ELSE
    UPDATE maintenance_contracts SET status = 'ended' WHERE id = cid;
  END IF;
  RETURN new_wo;
END $$;
GRANT EXECUTE ON FUNCTION public.create_contract_work_order(uuid, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decide_contract(uuid, boolean, timestamptz, uuid) TO authenticated, service_role;