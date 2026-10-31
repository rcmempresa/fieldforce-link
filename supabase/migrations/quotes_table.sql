-- ─────────────────────────────────────────────────────────────────────────────
-- Tabela de Orçamentos — Nuno Robinson Unipessoal LDA
-- Correr no SQL Editor do Supabase (Lovable → Supabase → SQL Editor)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS quotes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reference         text        UNIQUE,                              -- ORC-2026-0001 (auto-gerado)
  client_id         uuid        REFERENCES clients(id) ON DELETE SET NULL,
  client_name       text        NOT NULL DEFAULT '',
  client_nif        text,
  client_address    text,
  client_phone      text,
  client_email      text,
  work_order_id     uuid        REFERENCES work_orders(id) ON DELETE SET NULL,
  status            text        NOT NULL DEFAULT 'rascunho'          -- rascunho | enviado | aceite | rejeitado | expirado
                                CHECK (status IN ('rascunho','enviado','aceite','rejeitado','expirado')),
  requires_visit    boolean     NOT NULL DEFAULT false,
  items             jsonb       NOT NULL DEFAULT '[]',               -- [{description,quantity,unit,unit_price,total}]
  subtotal          numeric(10,2) NOT NULL DEFAULT 0,
  vat_rate          numeric(5,4)  NOT NULL DEFAULT 0.22,             -- 22% Madeira
  vat_amount        numeric(10,2) NOT NULL DEFAULT 0,
  total             numeric(10,2) NOT NULL DEFAULT 0,
  valid_days        integer     NOT NULL DEFAULT 30,
  valid_until       date,
  notes             text,
  created_by        uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  sent_at           timestamptz,
  accepted_at       timestamptz
);

-- ── Sequência para número do orçamento ───────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;

CREATE OR REPLACE FUNCTION set_quote_reference()
RETURNS trigger AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'ORC-' || EXTRACT(YEAR FROM NOW())::text
                     || '-' || LPAD(nextval('quote_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_quote
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION set_quote_reference();

-- ── updated_at automático ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_quotes_client_id      ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_work_order_id  ON quotes(work_order_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status         ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at     ON quotes(created_at DESC);

-- ── RLS (Row Level Security) ──────────────────────────────────────────────────
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Managers: acesso total
CREATE POLICY "managers_all" ON quotes
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
  );

-- Funcionários: só leitura (para consultar orçamentos de clientes)
CREATE POLICY "employees_read" ON quotes
  FOR SELECT TO authenticated
  USING (true);
