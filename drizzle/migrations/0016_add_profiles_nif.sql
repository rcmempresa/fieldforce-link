ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nif text;
COMMENT ON COLUMN public.profiles.nif IS 'Número de identificação fiscal (NIF) do cliente; usado nos orçamentos.';