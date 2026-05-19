-- Add lean purchase invoice tracking for supplier/manufacturer invoice assignment.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_party') THEN
    CREATE TYPE invoice_party AS ENUM ('supplier', 'manufacturer');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    CREATE TYPE invoice_status AS ENUM ('draft', 'final', 'paid');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_party invoice_party NOT NULL,
  counterparty_name TEXT,
  invoice_number TEXT NOT NULL,
  invoice_date DATE,
  invoice_due_date DATE,
  status invoice_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS supplier_invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manufacturer_invoice_id UUID REFERENCES purchase_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_org_party_number
  ON purchase_invoices(organization_id, invoice_party, invoice_number);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_org_updated
  ON purchase_invoices(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_supplier_invoice_id
  ON order_items(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_order_items_manufacturer_invoice_id
  ON order_items(manufacturer_invoice_id);

ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view purchase invoices in active org"
  ON purchase_invoices;
DROP POLICY IF EXISTS "Users can insert purchase invoices in active org"
  ON purchase_invoices;
DROP POLICY IF EXISTS "Users can update purchase invoices in active org"
  ON purchase_invoices;
DROP POLICY IF EXISTS "Users can delete purchase invoices in active org"
  ON purchase_invoices;

CREATE POLICY "Users can view purchase invoices in active org"
  ON purchase_invoices
  FOR SELECT TO authenticated
  USING (
    organization_id = (
      SELECT users.organization_id
      FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Users can insert purchase invoices in active org"
  ON purchase_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = (
      SELECT users.organization_id
      FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Users can update purchase invoices in active org"
  ON purchase_invoices
  FOR UPDATE TO authenticated
  USING (
    organization_id = (
      SELECT users.organization_id
      FROM users
      WHERE users.id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT users.organization_id
      FROM users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete purchase invoices in active org"
  ON purchase_invoices
  FOR DELETE TO authenticated
  USING (
    organization_id = (
      SELECT users.organization_id
      FROM users
      WHERE users.id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_purchase_invoices_updated_at
  ON purchase_invoices;

CREATE TRIGGER update_purchase_invoices_updated_at
  BEFORE UPDATE ON purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
