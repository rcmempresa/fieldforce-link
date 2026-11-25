CREATE OR REPLACE FUNCTION public.complete_work_order(_wo uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w record; cname text;
BEGIN
  IF NOT (public.has_role(auth.uid(),'manager') OR EXISTS (
    SELECT 1 FROM work_order_assignments WHERE work_order_id=_wo AND user_id=auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissão para concluir esta OT';
  END IF;
  SELECT * INTO w FROM work_orders WHERE id=_wo FOR UPDATE;
  IF w IS NULL THEN RAISE EXCEPTION 'OT não encontrada'; END IF;
  IF w.status IN ('completed','invoiced','awaiting_purchase_order','cancelled') THEN RAISE EXCEPTION 'Esta OT já está fechada'; END IF;
  UPDATE work_orders SET status='completed' WHERE id=_wo;
  SELECT COALESCE(company_name,name) INTO cname FROM profiles WHERE id=w.client_id;
  IF w.client_id IS NOT NULL THEN
    INSERT INTO notifications(user_id, work_order_id, type, channel, payload)
    VALUES (w.client_id, _wo, 'work_order_completed', 'email', jsonb_build_object('reference', w.reference,
      'message', 'Ordem de trabalho ' || w.reference || ' está pronta a faturar. Documento disponível nos anexos.'));
  END IF;
  INSERT INTO notifications(user_id, work_order_id, type, channel, payload)
  SELECT ur.user_id, _wo, 'work_order_completed', 'email', jsonb_build_object('reference', w.reference,
    'client_name', COALESCE(cname,'Cliente'), 'message', 'Ordem ' || w.reference || ' pronta a faturar. Documento disponível nos anexos.')
  FROM user_roles ur WHERE ur.role='manager' AND ur.approved;
END $$;
REVOKE EXECUTE ON FUNCTION public.complete_work_order(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_work_order(uuid) TO authenticated;