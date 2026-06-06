CREATE TABLE public.client_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_emails TO authenticated;
GRANT ALL ON public.client_emails TO service_role;

ALTER TABLE public.client_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage all client emails"
ON public.client_emails FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Clients view their own extra emails"
ON public.client_emails FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Clients insert their own extra emails"
ON public.client_emails FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Clients update their own extra emails"
ON public.client_emails FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Clients delete their own extra emails"
ON public.client_emails FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_client_emails_updated_at
BEFORE UPDATE ON public.client_emails
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();