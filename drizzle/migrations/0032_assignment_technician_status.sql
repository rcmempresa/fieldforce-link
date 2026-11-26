ALTER TABLE public.work_order_assignments
  ADD COLUMN IF NOT EXISTS tecnico_status TEXT NOT NULL DEFAULT 'novo'
  CHECK (tecnico_status IN ('novo', 'ativo', 'pausado', 'concluido'));
COMMENT ON COLUMN public.work_order_assignments.tecnico_status IS 'Estado do tecnico nesta OT: novo=atribuido sem iniciar, ativo=em execucao, pausado=pausado, concluido=concluido pelo tecnico';