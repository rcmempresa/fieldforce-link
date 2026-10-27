CREATE TABLE public.maintenance_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contract_type text NOT NULL CHECK (contract_type IN ('hvac','heat_pump','electricity')),
  frequency text NOT NULL CHECK (frequency IN ('monthly','quarterly','yearly')),
  start_date date NOT NULL DEFAULT current_date,
  next_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.maintenance_contract_equipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.maintenance_contracts(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  unit_part text NOT NULL DEFAULT 'full',
  UNIQUE (contract_id, equipment_id, unit_part)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_contracts TO authenticated;
GRANT ALL ON public.maintenance_contracts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_contract_equipments TO authenticated;
GRANT ALL ON public.maintenance_contract_equipments TO service_role;
ALTER TABLE public.maintenance_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_contract_equipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage contracts" ON public.maintenance_contracts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'manager'));
CREATE POLICY "Clients view own contracts" ON public.maintenance_contracts FOR SELECT TO authenticated
  USING (client_id = auth.uid());
CREATE POLICY "Managers manage contract equipments" ON public.maintenance_contract_equipments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'manager'));
CREATE POLICY "Clients view own contract equipments" ON public.maintenance_contract_equipments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_contracts c WHERE c.id = contract_id AND c.client_id = auth.uid()));
CREATE TRIGGER update_maintenance_contracts_updated_at BEFORE UPDATE ON public.maintenance_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.work_orders ADD COLUMN contract_id uuid REFERENCES public.maintenance_contracts(id) ON DELETE SET NULL;
ALTER TABLE public.work_orders ADD COLUMN contract_decision_pending boolean NOT NULL DEFAULT false;
CREATE INDEX idx_wo_contract ON public.work_orders(contract_id);

CREATE OR REPLACE FUNCTION public.flag_contract_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.contract_id IS NOT NULL AND NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.contract_decision_pending := true;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER flag_contract_decision_trigger BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.flag_contract_decision();

CREATE OR REPLACE FUNCTION public.create_contract_work_order(_contract uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; wo_id uuid; t text; lbl text;
BEGIN
  IF NOT public.has_role(auth.uid(),'manager') THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT * INTO c FROM maintenance_contracts WHERE id = _contract;
  IF c IS NULL OR c.status <> 'active' THEN RAISE EXCEPTION 'contract not active'; END IF;
  lbl := CASE c.contract_type WHEN 'hvac' THEN 'AVAC' WHEN 'heat_pump' THEN 'Bomba de Calor' ELSE 'Eletricidade' END;
  SELECT string_agg(e.name, ', ') INTO t FROM maintenance_contract_equipments ce JOIN equipments e ON e.id = ce.equipment_id WHERE ce.contract_id = _contract;
  INSERT INTO work_orders (title, description, client_id, created_by, service_type, status, needs_scheduling, contract_id)
  VALUES (COALESCE(t, 'Manutenção ' || lbl), 'Contrato de manutenção ' || lbl || ' - previsto para ' || to_char(c.next_date,'DD/MM/YYYY') || COALESCE(E'\n' || c.notes, ''),
          c.client_id, auth.uid(), 'maintenance', 'pending', true, _contract)
  RETURNING id INTO wo_id;
  INSERT INTO work_order_equipments (work_order_id, equipment_id, unit_part)
    SELECT wo_id, equipment_id, unit_part FROM maintenance_contract_equipments WHERE contract_id = _contract;
  RETURN wo_id;
END $$;

CREATE OR REPLACE FUNCTION public.decide_contract(_wo uuid, _continue boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; f text; new_wo uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'manager') THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT contract_id INTO cid FROM work_orders WHERE id = _wo;
  IF cid IS NULL THEN RAISE EXCEPTION 'no contract'; END IF;
  UPDATE work_orders SET contract_decision_pending = false WHERE id = _wo;
  IF _continue THEN
    SELECT frequency INTO f FROM maintenance_contracts WHERE id = cid;
    UPDATE maintenance_contracts SET next_date = (next_date + CASE f WHEN 'monthly' THEN interval '1 month' WHEN 'quarterly' THEN interval '3 months' ELSE interval '1 year' END)::date WHERE id = cid;
    new_wo := public.create_contract_work_order(cid);
  ELSE
    UPDATE maintenance_contracts SET status = 'ended' WHERE id = cid;
  END IF;
  RETURN new_wo;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_contract_work_order(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decide_contract(uuid, boolean) FROM anon;