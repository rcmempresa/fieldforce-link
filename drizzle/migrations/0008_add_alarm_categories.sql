DO $$ DECLARE c text; BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.equipments'::regclass AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%category%' LOOP
    EXECUTE format('ALTER TABLE public.equipments DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.equipments ADD CONSTRAINT equipments_category_check CHECK (category IN ('hvac','electricity','generator','cctv','automatismos','refrigeration','thermal_accumulator','heat_pump','industrial','domestic','other','freezing','intrusion','fire'));