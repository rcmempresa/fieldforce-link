
CREATE TABLE public.maintenance_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('electricity', 'hvac')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  
  -- Report identification
  report_date date DEFAULT CURRENT_DATE,
  
  -- Technician data
  technician_name text,
  technician_id text,
  supervisor_name text,
  start_time text,
  end_time text,
  
  -- Location
  building text,
  floor_number text,
  specific_location text,
  equipment_name text,
  equipment_serial text,
  designation text,
  designation_serial text,
  
  -- Checklist items (JSON array of {label, checked, observation})
  checklist_items jsonb DEFAULT '[]'::jsonb,
  
  -- Measurements (JSON array of {parameter, value, unit})
  measurements jsonb DEFAULT '[]'::jsonb,
  
  -- Materials (JSON array of {description, quantity, unit})
  materials jsonb DEFAULT '[]'::jsonb,
  
  -- Observations
  general_observations text,
  recommendations text,
  
  -- Approval
  next_maintenance text,
  approved_by_name text,
  approval_date date,
  
  -- Signatures (data URLs)
  technician_signature text,
  supervisor_signature text,
  
  -- PDF
  pdf_url text,
  
  -- Status
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.maintenance_reports ENABLE ROW LEVEL SECURITY;

-- Managers can do everything
CREATE POLICY "Managers can manage all reports"
ON public.maintenance_reports FOR ALL TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

-- Employees can create/edit their own reports
CREATE POLICY "Employees can manage own reports"
ON public.maintenance_reports FOR ALL TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Employees can view reports for assigned work orders
CREATE POLICY "Employees can view reports for assigned work orders"
ON public.maintenance_reports FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM work_order_assignments woa
    WHERE woa.work_order_id = maintenance_reports.work_order_id
    AND woa.user_id = auth.uid()
  )
);

-- Clients can view reports for their work orders
CREATE POLICY "Clients can view reports for own work orders"
ON public.maintenance_reports FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM work_orders wo
    WHERE wo.id = maintenance_reports.work_order_id
    AND wo.client_id = auth.uid()
  )
);
