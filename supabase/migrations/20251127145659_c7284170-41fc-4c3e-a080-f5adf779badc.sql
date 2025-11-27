-- Create equipment_attachments table
CREATE TABLE public.equipment_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.equipment_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view attachments for equipments they have access to
CREATE POLICY "Users can view equipment attachments"
ON public.equipment_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.equipments
    WHERE equipments.id = equipment_attachments.equipment_id
  )
);

-- Policy: Users can upload attachments to equipments they have access to
CREATE POLICY "Users can upload equipment attachments"
ON public.equipment_attachments
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.equipments
    WHERE equipments.id = equipment_attachments.equipment_id
  )
);

-- Policy: Users can delete their own attachments or managers can delete any
CREATE POLICY "Users can delete equipment attachments"
ON public.equipment_attachments
FOR DELETE
USING (
  uploaded_by = auth.uid() OR
  has_role(auth.uid(), 'manager'::app_role)
);

-- Create storage bucket for equipment attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-attachments', 'equipment-attachments', false);

-- Storage policies for equipment attachments
CREATE POLICY "Users can view equipment attachments in storage"
ON storage.objects
FOR SELECT
USING (bucket_id = 'equipment-attachments');

CREATE POLICY "Users can upload equipment attachments to storage"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'equipment-attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete own equipment attachments from storage"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'equipment-attachments' AND
  (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'manager'::app_role))
);