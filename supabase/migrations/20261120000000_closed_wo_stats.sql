-- Função que devolve as OTs fechadas do técnico autenticado (com as suas horas)
-- Inclui: completed (a faturar), invoiced (faturadas), awaiting_purchase_order (notas de encomenda)
CREATE OR REPLACE FUNCTION public.my_closed_work_orders_hours()
RETURNS TABLE(id uuid, reference text, title text, client_name text, scheduled_date timestamptz, created_at timestamptz, status text, hours numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT w.id, w.reference, w.title,
    COALESCE(p.company_name, p.name),
    w.scheduled_date, w.created_at, w.status::text,
    COALESCE((
      SELECT SUM(te.duration_hours)
      FROM time_entries te
      WHERE te.work_order_id = w.id AND te.user_id = auth.uid()
    ), 0)
  FROM work_orders w
  LEFT JOIN profiles p ON p.id = w.client_id
  WHERE w.status IN ('completed', 'invoiced', 'awaiting_purchase_order')
    AND (
      EXISTS (SELECT 1 FROM work_order_assignments a WHERE a.work_order_id = w.id AND a.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM time_entries te WHERE te.work_order_id = w.id AND te.user_id = auth.uid())
    )
  ORDER BY w.created_at DESC
$$;
REVOKE EXECUTE ON FUNCTION public.my_closed_work_orders_hours() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_closed_work_orders_hours() TO authenticated;

-- Corrigir my_completed_count para incluir todos os estados fechados
CREATE OR REPLACE FUNCTION public.my_completed_count() RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(DISTINCT wo.id)::int
  FROM work_orders wo
  WHERE wo.status IN ('completed', 'invoiced', 'awaiting_purchase_order')
    AND (
      EXISTS (SELECT 1 FROM work_order_assignments a WHERE a.work_order_id = wo.id AND a.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM time_entries te WHERE te.work_order_id = wo.id AND te.user_id = auth.uid())
    )
$$;
REVOKE EXECUTE ON FUNCTION public.my_completed_count() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_completed_count() TO authenticated;
