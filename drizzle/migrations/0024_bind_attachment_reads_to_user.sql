CREATE OR REPLACE FUNCTION public.can_access_work_order(_wo uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user,'manager')
    OR EXISTS (SELECT 1 FROM work_orders WHERE id=_wo AND client_id=_user)
    OR EXISTS (SELECT 1 FROM work_order_assignments WHERE work_order_id=_wo AND user_id=_user)
    OR EXISTS (SELECT 1 FROM time_entries WHERE work_order_id=_wo AND user_id=_user)
    OR EXISTS (SELECT 1 FROM work_order_previous_assignments WHERE work_order_id=_wo AND user_id=_user)
$$;

CREATE OR REPLACE FUNCTION public.can_access_equipment(_eq uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user,'manager')
    OR EXISTS (SELECT 1 FROM equipments WHERE id=_eq AND client_id=_user)
    OR EXISTS (SELECT 1 FROM work_order_equipments e WHERE e.equipment_id=_eq AND public.can_access_work_order(e.work_order_id,_user))
$$;

DROP POLICY IF EXISTS "Scoped read of work order attachments" ON storage.objects;
CREATE POLICY "Scoped read of work order attachments" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'work-order-attachments' AND (
  public.has_role(auth.uid(),'manager')
  OR owner_id = (SELECT auth.uid()::text)
  OR EXISTS (SELECT 1 FROM public.work_orders wo WHERE wo.id::text = (storage.foldername(objects.name))[1] AND public.can_access_work_order(wo.id, auth.uid()))
  OR EXISTS (SELECT 1 FROM public.attachments a WHERE (a.url = objects.name OR a.url LIKE '%/' || objects.name) AND public.can_access_work_order(a.work_order_id, auth.uid()))
  OR EXISTS (SELECT 1 FROM public.maintenance_reports r WHERE (r.pdf_url = objects.name OR r.pdf_url LIKE '%/' || objects.name) AND public.can_access_work_order(r.work_order_id, auth.uid()))
));

DROP POLICY IF EXISTS "Scoped read of equipment attachments" ON storage.objects;
CREATE POLICY "Scoped read of equipment attachments" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'equipment-attachments' AND (
  public.has_role(auth.uid(),'manager')
  OR owner_id = (SELECT auth.uid()::text)
  OR EXISTS (SELECT 1 FROM public.equipment_attachments ea WHERE (ea.url = objects.name OR ea.url LIKE '%/' || objects.name) AND public.can_access_equipment(ea.equipment_id, auth.uid()))
  OR (public.has_role(auth.uid(),'employee') AND EXISTS (SELECT 1 FROM public.equipment_model_manuals m WHERE m.url = objects.name))
));