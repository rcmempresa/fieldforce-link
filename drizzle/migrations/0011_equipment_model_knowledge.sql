CREATE TABLE public.equipment_model_manuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_key text NOT NULL DEFAULT '',
  model_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('parts','technical')),
  filename text NOT NULL,
  url text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_model_manuals TO authenticated;
GRANT ALL ON public.equipment_model_manuals TO service_role;
ALTER TABLE public.equipment_model_manuals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read manuals" ON public.equipment_model_manuals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "Managers manage manuals" ON public.equipment_model_manuals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'manager'));
CREATE INDEX idx_emm_model ON public.equipment_model_manuals(brand_key, model_key);

CREATE TABLE public.equipment_model_faults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_key text NOT NULL DEFAULT '',
  model_key text NOT NULL,
  symptom text NOT NULL,
  causes text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment_model_faults TO authenticated;
GRANT ALL ON public.equipment_model_faults TO service_role;
ALTER TABLE public.equipment_model_faults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read faults" ON public.equipment_model_faults FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'employee'));
CREATE POLICY "Employees add faults" ON public.equipment_model_faults FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'employee') AND created_by = auth.uid());
CREATE POLICY "Managers manage faults" ON public.equipment_model_faults FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'manager')) WITH CHECK (public.has_role(auth.uid(),'manager'));
CREATE INDEX idx_emf_model ON public.equipment_model_faults(brand_key, model_key);
CREATE TRIGGER update_equipment_model_faults_updated_at BEFORE UPDATE ON public.equipment_model_faults
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();