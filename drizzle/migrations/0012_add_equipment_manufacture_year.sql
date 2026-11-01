ALTER TABLE public.equipments ADD COLUMN IF NOT EXISTS manufacture_year smallint;
ALTER TABLE public.equipments ADD CONSTRAINT equipments_manufacture_year_range CHECK (manufacture_year IS NULL OR (manufacture_year >= 1900 AND manufacture_year <= 2100));
COMMENT ON COLUMN public.equipments.manufacture_year IS 'Ano de fabrico do equipamento';