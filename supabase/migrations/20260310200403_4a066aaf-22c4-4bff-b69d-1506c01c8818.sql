
-- Allow managers and uploaders to delete attachments
CREATE POLICY "Managers and uploaders can delete attachments"
  ON public.attachments
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR has_role(auth.uid(), 'manager'::app_role)
  );
