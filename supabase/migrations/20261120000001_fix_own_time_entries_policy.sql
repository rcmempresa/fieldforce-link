-- Corrigir política que bloqueava técnicos de ver as suas próprias horas em OTs fechadas.
-- Um técnico deve poder sempre consultar os seus próprios registos de horas,
-- independentemente do estado da ordem de trabalho.
ALTER POLICY "Users can view own time entries" ON public.time_entries
  USING (
    public.has_role(auth.uid(), 'manager')
    OR user_id = auth.uid()
  );
