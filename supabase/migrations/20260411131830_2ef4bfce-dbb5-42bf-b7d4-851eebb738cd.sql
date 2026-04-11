
CREATE TABLE public.material_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  default_unit text NOT NULL DEFAULT 'un',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

ALTER TABLE public.material_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage catalog"
ON public.material_catalog
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view active catalog"
ON public.material_catalog
FOR SELECT
TO authenticated
USING (active = true OR has_role(auth.uid(), 'manager'::app_role));
