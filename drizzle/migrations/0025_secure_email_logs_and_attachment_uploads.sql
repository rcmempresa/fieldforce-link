DROP POLICY "System can insert email logs" ON public.email_logs;
REVOKE INSERT ON public.email_logs FROM anon, authenticated;
GRANT INSERT ON public.email_logs TO service_role;

ALTER POLICY "Users can upload equipment attachments to storage"
ON storage.objects TO authenticated
WITH CHECK (
  bucket_id = 'equipment-attachments'
  AND owner_id = (SELECT auth.uid()::text)
);

ALTER POLICY "Allow authenticated users to upload work order attachments"
ON storage.objects TO authenticated
WITH CHECK (
  bucket_id = 'work-order-attachments'
  AND owner_id = (SELECT auth.uid()::text)
);