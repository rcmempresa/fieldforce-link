CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  is_first boolean;
  _nif text;
BEGIN
  is_first := (SELECT COUNT(*) FROM auth.users) = 1;
  _nif := regexp_replace(COALESCE(NEW.raw_user_meta_data->>'nif', ''), '\s', '', 'g');
  IF _nif !~ '^[0-9]{9}$' THEN _nif := NULL; END IF;
  INSERT INTO public.profiles (id, name, nif)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), _nif);
  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role, approved, approved_at)
    VALUES (NEW.id, 'manager', true, now());
  END IF;
  RETURN NEW;
END;
$function$;