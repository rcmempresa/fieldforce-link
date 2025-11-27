-- Create enum for pause reasons
CREATE TYPE public.pause_reason AS ENUM (
  'falta_material',
  'enviado_oficina',
  'enviado_orcamento',
  'assinatura_gerente'
);

-- Add pause_reason column to time_entries
ALTER TABLE public.time_entries
ADD COLUMN pause_reason pause_reason;

-- Add comment to explain the pause_reason field
COMMENT ON COLUMN public.time_entries.pause_reason IS 'Reason for pausing work, filled when the time entry is paused';