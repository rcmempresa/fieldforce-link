-- Allow managers to create notifications for any user
CREATE POLICY "Managers can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
);