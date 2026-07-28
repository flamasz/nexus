-- Scope Nexus workspace records to the active Business Central environment.
-- Existing org-level rows are backfilled to the org default environment so the
-- first environment keeps today's data after multi-environment rollout.

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE product_lines
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE item_names
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE upload_sessions
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE gs1_import_batches
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE gs1_products
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE gs1_item_links
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE gs1_import_match_candidates
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;

WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE categories t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE product_lines t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE item_names t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE items t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE upload_sessions t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE purchase_orders t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE purchase_invoices t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE gs1_import_batches t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE gs1_products t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE gs1_item_links t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE gs1_import_match_candidates t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_org_bc_name ON categories(organization_id, bc_connection_id, name);
CREATE INDEX IF NOT EXISTS idx_product_lines_org_bc_name ON product_lines(organization_id, bc_connection_id, name);
CREATE INDEX IF NOT EXISTS idx_item_names_org_bc_name ON item_names(organization_id, bc_connection_id, name);
CREATE INDEX IF NOT EXISTS idx_items_org_bc_updated ON items(organization_id, bc_connection_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_org_bc_packaging ON upload_sessions(organization_id, bc_connection_id, packaging_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_bc_sequence ON purchase_orders(organization_id, bc_connection_id, order_sequence DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_org_bc_party_number ON purchase_invoices(organization_id, bc_connection_id, invoice_party, invoice_number);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_org_bc_updated ON purchase_invoices(organization_id, bc_connection_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_gs1_import_batches_org_bc ON gs1_import_batches(organization_id, bc_connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gs1_products_org_bc_gtin ON gs1_products(organization_id, bc_connection_id, normalized_gtin);
CREATE INDEX IF NOT EXISTS idx_gs1_item_links_org_bc_gs1 ON gs1_item_links(organization_id, bc_connection_id, gs1_product_id);
CREATE INDEX IF NOT EXISTS idx_gs1_item_links_org_bc_bcitem ON gs1_item_links(organization_id, bc_connection_id, business_central_item_id);

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE product_lines DROP CONSTRAINT IF EXISTS product_lines_name_key;
ALTER TABLE item_names DROP CONSTRAINT IF EXISTS item_names_name_key;
ALTER TABLE gs1_products DROP CONSTRAINT IF EXISTS gs1_products_organization_id_normalized_gtin_key;
ALTER TABLE gs1_item_links DROP CONSTRAINT IF EXISTS gs1_item_links_gs1_product_id_business_central_item_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS categories_org_bc_name_key
  ON categories(organization_id, bc_connection_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS product_lines_org_bc_name_key
  ON product_lines(organization_id, bc_connection_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS item_names_org_bc_name_key
  ON item_names(organization_id, bc_connection_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS gs1_products_org_bc_gtin_key
  ON gs1_products(organization_id, bc_connection_id, normalized_gtin);
CREATE UNIQUE INDEX IF NOT EXISTS gs1_item_links_product_bc_item_key
  ON gs1_item_links(gs1_product_id, business_central_item_id);

ALTER TABLE business_central_item_categories
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE business_central_tax_groups
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE business_central_units_of_measure
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE business_central_general_product_posting_groups
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;
ALTER TABLE business_central_inventory_posting_groups
  ADD COLUMN IF NOT EXISTS bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL;

WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE business_central_item_categories t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE business_central_tax_groups t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE business_central_units_of_measure t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE business_central_general_product_posting_groups t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;
WITH defaults AS (
  SELECT DISTINCT ON (organization_id) organization_id, id AS bc_connection_id
  FROM business_central_connections
  ORDER BY organization_id, is_default DESC, created_at ASC
)
UPDATE business_central_inventory_posting_groups t SET bc_connection_id = d.bc_connection_id
FROM defaults d WHERE t.organization_id = d.organization_id AND t.bc_connection_id IS NULL;

ALTER TABLE business_central_item_categories DROP CONSTRAINT IF EXISTS business_central_item_categories_organization_id_bc_id_key;
ALTER TABLE business_central_item_categories DROP CONSTRAINT IF EXISTS business_central_item_categories_organization_id_code_key;
ALTER TABLE business_central_tax_groups DROP CONSTRAINT IF EXISTS business_central_tax_groups_organization_id_bc_id_key;
ALTER TABLE business_central_tax_groups DROP CONSTRAINT IF EXISTS business_central_tax_groups_organization_id_code_key;
ALTER TABLE business_central_units_of_measure DROP CONSTRAINT IF EXISTS business_central_units_of_measure_organization_id_bc_id_key;
ALTER TABLE business_central_units_of_measure DROP CONSTRAINT IF EXISTS business_central_units_of_measure_organization_id_code_key;
ALTER TABLE business_central_general_product_posting_groups DROP CONSTRAINT IF EXISTS business_central_general_product_posting_groups_organization_id_bc_id_key;
ALTER TABLE business_central_general_product_posting_groups DROP CONSTRAINT IF EXISTS business_central_general_product_posting_groups_organization_id_code_key;
ALTER TABLE business_central_inventory_posting_groups DROP CONSTRAINT IF EXISTS business_central_inventory_posting_groups_organization_id_bc_id_key;
ALTER TABLE business_central_inventory_posting_groups DROP CONSTRAINT IF EXISTS business_central_inventory_posting_groups_organization_id_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS bc_item_categories_org_conn_bcid_key ON business_central_item_categories(organization_id, bc_connection_id, bc_id);
CREATE UNIQUE INDEX IF NOT EXISTS bc_item_categories_org_conn_code_key ON business_central_item_categories(organization_id, bc_connection_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS bc_tax_groups_org_conn_bcid_key ON business_central_tax_groups(organization_id, bc_connection_id, bc_id);
CREATE UNIQUE INDEX IF NOT EXISTS bc_tax_groups_org_conn_code_key ON business_central_tax_groups(organization_id, bc_connection_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS bc_units_org_conn_bcid_key ON business_central_units_of_measure(organization_id, bc_connection_id, bc_id);
CREATE UNIQUE INDEX IF NOT EXISTS bc_units_org_conn_code_key ON business_central_units_of_measure(organization_id, bc_connection_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS bc_general_posting_org_conn_bcid_key ON business_central_general_product_posting_groups(organization_id, bc_connection_id, bc_id);
CREATE UNIQUE INDEX IF NOT EXISTS bc_general_posting_org_conn_code_key ON business_central_general_product_posting_groups(organization_id, bc_connection_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS bc_inventory_posting_org_conn_bcid_key ON business_central_inventory_posting_groups(organization_id, bc_connection_id, bc_id);
CREATE UNIQUE INDEX IF NOT EXISTS bc_inventory_posting_org_conn_code_key ON business_central_inventory_posting_groups(organization_id, bc_connection_id, code);
