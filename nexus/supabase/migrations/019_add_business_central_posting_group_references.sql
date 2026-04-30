-- Add Business Central posting group reference mirrors for item dropdowns.
-- These follow the same active/inactive cache pattern as item categories,
-- tax groups, and units of measure.

CREATE TABLE IF NOT EXISTS business_central_general_product_posting_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bc_id TEXT NOT NULL,
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  default_vat_product_posting_group TEXT,
  auto_insert_default BOOLEAN,
  last_modified_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, bc_id),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS business_central_inventory_posting_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bc_id TEXT NOT NULL,
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_modified_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, bc_id),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_bc_general_product_posting_groups_org_code
  ON business_central_general_product_posting_groups(organization_id, code);
CREATE INDEX IF NOT EXISTS idx_bc_inventory_posting_groups_org_code
  ON business_central_inventory_posting_groups(organization_id, code);
CREATE INDEX IF NOT EXISTS idx_bc_general_product_posting_groups_org_active_code
  ON business_central_general_product_posting_groups(organization_id, is_active, code);
CREATE INDEX IF NOT EXISTS idx_bc_inventory_posting_groups_org_active_code
  ON business_central_inventory_posting_groups(organization_id, is_active, code);

ALTER TABLE business_central_general_product_posting_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_central_inventory_posting_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view BC general product posting groups"
  ON business_central_general_product_posting_groups;
DROP POLICY IF EXISTS "Authenticated users can manage BC general product posting groups"
  ON business_central_general_product_posting_groups;
DROP POLICY IF EXISTS "Authenticated users can view BC inventory posting groups"
  ON business_central_inventory_posting_groups;
DROP POLICY IF EXISTS "Authenticated users can manage BC inventory posting groups"
  ON business_central_inventory_posting_groups;

CREATE POLICY "Authenticated users can view BC general product posting groups"
  ON business_central_general_product_posting_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage BC general product posting groups"
  ON business_central_general_product_posting_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view BC inventory posting groups"
  ON business_central_inventory_posting_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage BC inventory posting groups"
  ON business_central_inventory_posting_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_business_central_general_product_posting_groups_updated_at
  ON business_central_general_product_posting_groups;
DROP TRIGGER IF EXISTS update_business_central_inventory_posting_groups_updated_at
  ON business_central_inventory_posting_groups;

CREATE TRIGGER update_business_central_general_product_posting_groups_updated_at
  BEFORE UPDATE ON business_central_general_product_posting_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_central_inventory_posting_groups_updated_at
  BEFORE UPDATE ON business_central_inventory_posting_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
