-- Create storage bucket for work order attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'work-order-attachments', 
  'work-order-attachments', 
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);

-- Create RLS policies for storage.objects for this bucket
CREATE POLICY "Allow authenticated users to view work order attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'work-order-attachments');

CREATE POLICY "Allow authenticated users to upload work order attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'work-order-attachments');

CREATE POLICY "Allow users to delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'work-order-attachments' AND owner = auth.uid());

CREATE POLICY "Allow managers to delete any attachment"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'work-order-attachments' AND
  has_role(auth.uid(), 'manager'::app_role)
);