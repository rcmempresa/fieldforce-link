-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload equipment attachments" ON equipment_attachments;
DROP POLICY IF EXISTS "Users can delete equipment attachments" ON equipment_attachments;

-- Allow employees and managers to upload attachments
CREATE POLICY "Employees and managers can upload equipment attachments"
ON equipment_attachments
FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'employee') OR has_role(auth.uid(), 'manager'))
  AND EXISTS (
    SELECT 1 FROM equipments 
    WHERE equipments.id = equipment_attachments.equipment_id
  )
);

-- Allow employees and managers to delete attachments
CREATE POLICY "Employees and managers can delete equipment attachments"
ON equipment_attachments
FOR DELETE
USING (
  has_role(auth.uid(), 'employee') OR has_role(auth.uid(), 'manager')
);