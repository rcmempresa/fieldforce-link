CREATE OR REPLACE FUNCTION public.notify_ot_status_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN
      PERFORM net.http_post(
        url := 'https://agent-production-29c8.up.railway.app/webhook/supabase',
        body := jsonb_build_object('type','UPDATE','table','work_orders','record',to_jsonb(NEW),'old_record',to_jsonb(OLD)),
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer NR-Webhook-2026-xK9p')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_ot_status_change failed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;