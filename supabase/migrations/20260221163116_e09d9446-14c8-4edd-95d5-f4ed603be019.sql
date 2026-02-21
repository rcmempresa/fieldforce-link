
-- Allow clients to view time entries for their own work orders (read-only, aggregated visibility)
CREATE POLICY "Clients can view time entries for own work orders"
ON public.time_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM work_orders
    WHERE work_orders.id = time_entries.work_order_id
    AND work_orders.client_id = auth.uid()
  )
);
