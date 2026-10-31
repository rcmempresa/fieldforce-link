CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT,
  client_id UUID REFERENCES public.profiles(id),
  client_name TEXT NOT NULL,
  client_nif TEXT,
  client_address TEXT,
  client_phone TEXT,
  client_email TEXT,
  work_order_id UUID REFERENCES public.work_orders(id),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','aceite','rejeitado','expirado')),
  requires_visit BOOLEAN NOT NULL DEFAULT false,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_rate NUMERIC NOT NULL DEFAULT 0.22,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  valid_days INTEGER NOT NULL DEFAULT 30,
  valid_until DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage quotes"
ON public.quotes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'manager'));

CREATE OR REPLACE FUNCTION public.generate_quote_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_number INTEGER;
  year_prefix TEXT;
BEGIN
  year_prefix := 'ORC-' || TO_CHAR(now(), 'YYYY') || '-';
  PERFORM pg_advisory_xact_lock(hashtext('quote_reference'));
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 10) AS INTEGER)), 0) + 1
  INTO next_number
  FROM quotes
  WHERE reference LIKE year_prefix || '%';
  NEW.reference := year_prefix || LPAD(next_number::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_quote_reference
BEFORE INSERT ON public.quotes
FOR EACH ROW
WHEN (NEW.reference IS NULL)
EXECUTE FUNCTION public.generate_quote_reference();

CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();