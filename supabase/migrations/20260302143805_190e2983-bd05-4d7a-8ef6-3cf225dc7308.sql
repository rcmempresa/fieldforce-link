
CREATE TABLE public.client_hour_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year integer NOT NULL,
  contracted_hours numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id, year)
);

ALTER TABLE public.client_hour_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own quotas" ON public.client_hour_quotas
  FOR SELECT USING (client_id = auth.uid() OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can manage quotas" ON public.client_hour_quotas
  FOR ALL USING (has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role));
