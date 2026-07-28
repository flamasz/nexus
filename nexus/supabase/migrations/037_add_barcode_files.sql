-- Barcode files attached to a Business Central item, shown in the GTIN tab.
-- Flat list (no review/session workflow); stored in the packaging-files bucket.

CREATE TABLE barcode_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_central_item_id UUID NOT NULL
    REFERENCES business_central_items(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bc_connection_id UUID NOT NULL
    REFERENCES business_central_connections(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_barcode_files_bc_item_id
  ON barcode_files(business_central_item_id);
CREATE INDEX idx_barcode_files_uploaded_at
  ON barcode_files(uploaded_at DESC);

ALTER TABLE barcode_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view barcode files" ON barcode_files
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members create barcode files" ON barcode_files
  FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Org members delete barcode files" ON barcode_files
  FOR DELETE TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));
