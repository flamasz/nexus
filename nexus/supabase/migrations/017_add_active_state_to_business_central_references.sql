-- Track Business Central reference options that have disappeared upstream.
--
-- References are kept as inactive instead of hard-deleted so existing items can
-- still display historical/legacy category, tax group, and UOM values.

ALTER TABLE business_central_item_categories
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE business_central_tax_groups
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE business_central_units_of_measure
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_bc_item_categories_org_active_code
  ON business_central_item_categories(organization_id, is_active, code);
CREATE INDEX IF NOT EXISTS idx_bc_tax_groups_org_active_code
  ON business_central_tax_groups(organization_id, is_active, code);
CREATE INDEX IF NOT EXISTS idx_bc_units_of_measure_org_active_code
  ON business_central_units_of_measure(organization_id, is_active, code);
