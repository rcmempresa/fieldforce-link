DROP POLICY IF EXISTS "Allow authenticated users to view work order attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view equipment attachments in storage" ON storage.objects;

CREATE POLICY "Scoped read of work order attachments" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'work-order-attachments' AND (
    public.has_role(auth.uid(), 'manager')
    OR owner_id = (select auth.uid()::text)
    OR EXISTS (SELECT 1 FROM public.work_orders wo WHERE wo.id::text = (storage.foldername(name))[1])
    OR EXISTS (SELECT 1 FROM public.attachments a WHERE a.url = name OR a.url LIKE '%/' || name)
    OR EXISTS (SELECT 1 FROM public.maintenance_reports r WHERE r.pdf_url = name OR r.pdf_url LIKE '%/' || name)
  )
);

CREATE POLICY "Scoped read of equipment attachments" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'equipment-attachments' AND (
    public.has_role(auth.uid(), 'manager')
    OR owner_id = (select auth.uid()::text)
    OR EXISTS (SELECT 1 FROM public.equipment_attachments ea WHERE ea.url = name OR ea.url LIKE '%/' || name)
    OR (public.has_role(auth.uid(), 'employee') AND EXISTS (SELECT 1 FROM public.equipment_model_manuals m WHERE m.url = name))
  )
);