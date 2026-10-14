CREATE TABLE public.work_order_previous_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'falta_material',
  removed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, user_id)
);
GRANT SELECT ON public.work_order_previous_assignments TO authenticated;
GRANT ALL ON public.work_order_previous_assignments TO service_role;
ALTER TABLE public.work_order_previous_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or manager view previous assignments" ON public.work_order_previous_assignments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'manager'));

CREATE OR REPLACE FUNCTION public.is_previous_assignee(_wo uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.work_order_previous_assignments WHERE work_order_id = _wo AND user_id = _user)
$$;

CREATE OR REPLACE FUNCTION public.release_assignments_for_missing_material(_wo uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'manager') OR EXISTS (
    SELECT 1 FROM public.work_order_assignments WHERE work_order_id = _wo AND user_id = auth.uid())) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  INSERT INTO public.work_order_previous_assignments (work_order_id, user_id)
    SELECT work_order_id, user_id FROM public.work_order_assignments WHERE work_order_id = _wo
  ON CONFLICT (work_order_id, user_id) DO UPDATE SET removed_at = now();
  DELETE FROM public.work_order_assignments WHERE work_order_id = _wo;
END $$;

CREATE OR REPLACE FUNCTION public.reassign_previous_technicians(_wo uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'manager') THEN RAISE EXCEPTION 'not allowed'; END IF;
  INSERT INTO public.work_order_assignments (work_order_id, user_id, assigned_by)
    SELECT p.work_order_id, p.user_id, auth.uid() FROM public.work_order_previous_assignments p
    WHERE p.work_order_id = _wo
      AND NOT EXISTS (SELECT 1 FROM public.work_order_assignments a WHERE a.work_order_id = _wo AND a.user_id = p.user_id);
  DELETE FROM public.work_order_previous_assignments WHERE work_order_id = _wo;
END $$;

GRANT EXECUTE ON FUNCTION public.release_assignments_for_missing_material(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_previous_technicians(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_previous_assignee(uuid, uuid) TO authenticated;

CREATE POLICY "Previous assignees can view work orders" ON public.work_orders
  FOR SELECT TO authenticated USING (public.is_previous_assignee(id, auth.uid()));
CREATE POLICY "Previous assignees can view time entries" ON public.time_entries
  FOR SELECT TO authenticated USING (public.is_previous_assignee(work_order_id, auth.uid()));
CREATE POLICY "Previous assignees can view client profiles" ON public.profiles
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.work_orders wo WHERE wo.client_id = profiles.id AND public.is_previous_assignee(wo.id, auth.uid())));