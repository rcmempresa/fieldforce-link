CREATE TABLE public.profile_unavailabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL DEFAULT 'ferias',
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_unavailabilities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT profile_unavailabilities_dates_chk CHECK (end_date >= start_date),
  CONSTRAINT profile_unavailabilities_reason_chk CHECK (reason IN ('ferias','baixa','folga','feriado','outro'))
);
CREATE INDEX profile_unavailabilities_user_dates_idx ON public.profile_unavailabilities(user_id, start_date, end_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_unavailabilities TO authenticated;
GRANT ALL ON public.profile_unavailabilities TO service_role;
ALTER TABLE public.profile_unavailabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage unavailabilities" ON public.profile_unavailabilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager')) WITH CHECK (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Users read own unavailabilities" ON public.profile_unavailabilities FOR SELECT TO authenticated
  USING (user_id = auth.uid());