-- Add Business Central item sync schema.
-- Phase 4 of the UI-first Items + Business Central sync plan.

CREATE TYPE business_central_sync_status AS ENUM (
  'never_synced',
  'synced',
  'local_dirty',
  'unpushed',
  'syncing',
  'failed',
  'deleted_in_bc'
);

CREATE TYPE business_central_sync_direction AS ENUM (
  'pull',
  'push',
  'create',
  'delete',
  'connection_test',
  'reference_refresh'
);

CREATE TYPE business_central_sync_event_status AS ENUM (
  'success',
  'failed',
  'skipped',
  'conflict_resolved'
);

CREATE TYPE business_central_error_class AS ENUM (
  'auth_failed',
  'stale_etag',
  'not_found',
  'throttled',
  'server_error',
  'validation_error',
  'network_error',
  'conflict_resolved'
);

CREATE TABLE business_central_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  environment TEXT NOT NULL,
  company_id TEXT NOT NULL,
  company_name TEXT,
  api_base_url TEXT NOT NULL DEFAULT 'https://api.businesscentral.dynamics.com',
  sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_verified_at TIMESTAMPTZ,
  last_error TEXT,
  last_pulled_at TIMESTAMPTZ,
  sync_in_progress_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sync_in_progress_since TIMESTAMPTZ,
  sync_in_progress_timeout_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id)
);

CREATE TABLE business_central_item_categories (
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

CREATE TABLE business_central_tax_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bc_id TEXT NOT NULL,
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  tax_type TEXT,
  last_modified_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, bc_id),
  UNIQUE (organization_id, code)
);

CREATE TABLE business_central_units_of_measure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bc_id TEXT NOT NULL,
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  international_standard_code TEXT,
  symbol TEXT,
  last_modified_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, bc_id),
  UNIQUE (organization_id, code)
);

CREATE TABLE business_central_general_product_posting_groups (
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

CREATE TABLE business_central_inventory_posting_groups (
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

CREATE TABLE business_central_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bc_connection_id UUID REFERENCES business_central_connections(id) ON DELETE SET NULL,
  bc_environment TEXT NOT NULL,
  bc_company_id TEXT NOT NULL,
  bc_item_id TEXT NOT NULL,
  bc_item_number TEXT,
  bc_etag TEXT,
  bc_last_modified_at TIMESTAMPTZ,
  display_name TEXT NOT NULL,
  display_name_2 TEXT,
  type TEXT,
  item_category_id TEXT,
  item_category_code TEXT,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  gtin TEXT,
  inventory NUMERIC,
  unit_price NUMERIC,
  price_includes_tax BOOLEAN NOT NULL DEFAULT FALSE,
  unit_cost NUMERIC,
  tax_group_id TEXT,
  tax_group_code TEXT,
  base_unit_of_measure_id TEXT,
  base_unit_of_measure_code TEXT,
  general_product_posting_group_id TEXT,
  general_product_posting_group_code TEXT,
  inventory_posting_group_id TEXT,
  inventory_posting_group_code TEXT,
  bc_raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync_status business_central_sync_status NOT NULL DEFAULT 'never_synced',
  sync_error TEXT,
  last_synced_at TIMESTAMPTZ,
  last_pulled_at TIMESTAMPTZ,
  last_pushed_at TIMESTAMPTZ,
  local_last_edited_at TIMESTAMPTZ,
  local_last_edited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  client_request_id TEXT,
  deleted_in_bc_at TIMESTAMPTZ,
  delete_confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, bc_company_id, bc_item_id),
  UNIQUE (organization_id, client_request_id)
);

CREATE TABLE business_central_item_details (
  item_id UUID PRIMARY KEY REFERENCES business_central_items(id) ON DELETE CASCADE,
  artwork_status TEXT,
  net_weight_grams NUMERIC,
  net_weight_oz NUMERIC,
  sams_club_item_number TEXT,
  units_per_case INTEGER,
  costco_cases_per_layer INTEGER,
  costco_layers_per_pallet INTEGER,
  costco_units_per_pallet INTEGER,
  sams_cases_per_layer INTEGER,
  sams_layers_per_pallet INTEGER,
  sams_units_per_pallet INTEGER,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_central_item_details_net_weight_grams_nonnegative CHECK (net_weight_grams IS NULL OR net_weight_grams >= 0),
  CONSTRAINT business_central_item_details_net_weight_oz_nonnegative CHECK (net_weight_oz IS NULL OR net_weight_oz >= 0),
  CONSTRAINT business_central_item_details_units_per_case_nonnegative CHECK (units_per_case IS NULL OR units_per_case >= 0),
  CONSTRAINT business_central_item_details_costco_cases_per_layer_nonnegative CHECK (costco_cases_per_layer IS NULL OR costco_cases_per_layer >= 0),
  CONSTRAINT business_central_item_details_costco_layers_per_pallet_nonnegative CHECK (costco_layers_per_pallet IS NULL OR costco_layers_per_pallet >= 0),
  CONSTRAINT business_central_item_details_costco_units_per_pallet_nonnegative CHECK (costco_units_per_pallet IS NULL OR costco_units_per_pallet >= 0),
  CONSTRAINT business_central_item_details_sams_cases_per_layer_nonnegative CHECK (sams_cases_per_layer IS NULL OR sams_cases_per_layer >= 0),
  CONSTRAINT business_central_item_details_sams_layers_per_pallet_nonnegative CHECK (sams_layers_per_pallet IS NULL OR sams_layers_per_pallet >= 0),
  CONSTRAINT business_central_item_details_sams_units_per_pallet_nonnegative CHECK (sams_units_per_pallet IS NULL OR sams_units_per_pallet >= 0)
);

CREATE TABLE business_central_item_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id UUID REFERENCES business_central_items(id) ON DELETE SET NULL,
  run_id UUID,
  direction business_central_sync_direction NOT NULL,
  status business_central_sync_event_status NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_user_label TEXT,
  bc_item_id TEXT,
  bc_item_number TEXT,
  error_class business_central_error_class,
  error_message TEXT,
  changed_fields TEXT[],
  request_summary JSONB,
  response_summary JSONB,
  before_snapshot JSONB,
  after_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE items
  ADD COLUMN bc_item_id UUID REFERENCES business_central_items(id) ON DELETE SET NULL;

CREATE INDEX idx_business_central_connections_organization_id ON business_central_connections(organization_id);
CREATE INDEX idx_business_central_connections_sync_timeout ON business_central_connections(sync_in_progress_timeout_at) WHERE sync_in_progress_timeout_at IS NOT NULL;

CREATE INDEX idx_bc_item_categories_org_code ON business_central_item_categories(organization_id, code);
CREATE INDEX idx_bc_tax_groups_org_code ON business_central_tax_groups(organization_id, code);
CREATE INDEX idx_bc_units_of_measure_org_code ON business_central_units_of_measure(organization_id, code);
CREATE INDEX idx_bc_general_product_posting_groups_org_code ON business_central_general_product_posting_groups(organization_id, code);
CREATE INDEX idx_bc_inventory_posting_groups_org_code ON business_central_inventory_posting_groups(organization_id, code);
CREATE INDEX idx_bc_item_categories_org_active_code ON business_central_item_categories(organization_id, is_active, code);
CREATE INDEX idx_bc_tax_groups_org_active_code ON business_central_tax_groups(organization_id, is_active, code);
CREATE INDEX idx_bc_units_of_measure_org_active_code ON business_central_units_of_measure(organization_id, is_active, code);
CREATE INDEX idx_bc_general_product_posting_groups_org_active_code ON business_central_general_product_posting_groups(organization_id, is_active, code);
CREATE INDEX idx_bc_inventory_posting_groups_org_active_code ON business_central_inventory_posting_groups(organization_id, is_active, code);

CREATE INDEX idx_business_central_items_org_status ON business_central_items(organization_id, sync_status);
CREATE INDEX idx_business_central_items_org_number ON business_central_items(organization_id, bc_item_number);
CREATE INDEX idx_business_central_items_last_modified ON business_central_items(organization_id, bc_last_modified_at DESC);
CREATE INDEX idx_business_central_items_local_dirty ON business_central_items(organization_id, local_last_edited_at DESC) WHERE local_last_edited_at IS NOT NULL;
CREATE INDEX idx_items_bc_item_id ON items(bc_item_id) WHERE bc_item_id IS NOT NULL;

CREATE INDEX idx_bc_sync_events_org_created ON business_central_item_sync_events(organization_id, created_at DESC);
CREATE INDEX idx_bc_sync_events_item_created ON business_central_item_sync_events(item_id, created_at DESC) WHERE item_id IS NOT NULL;
CREATE INDEX idx_bc_sync_events_run ON business_central_item_sync_events(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX idx_bc_sync_events_status ON business_central_item_sync_events(organization_id, status, created_at DESC);

ALTER TABLE business_central_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_central_item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_central_tax_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_central_units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_central_general_product_posting_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_central_inventory_posting_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_central_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_central_item_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_central_item_sync_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view BC connections" ON business_central_connections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage BC connections" ON business_central_connections
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view BC item categories" ON business_central_item_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage BC item categories" ON business_central_item_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view BC tax groups" ON business_central_tax_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage BC tax groups" ON business_central_tax_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view BC units of measure" ON business_central_units_of_measure
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage BC units of measure" ON business_central_units_of_measure
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view BC general product posting groups" ON business_central_general_product_posting_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage BC general product posting groups" ON business_central_general_product_posting_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view BC inventory posting groups" ON business_central_inventory_posting_groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage BC inventory posting groups" ON business_central_inventory_posting_groups
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view BC items" ON business_central_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create BC items" ON business_central_items
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update BC items" ON business_central_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete BC items" ON business_central_items
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view BC item details" ON business_central_item_details
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create BC item details" ON business_central_item_details
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update BC item details" ON business_central_item_details
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete BC item details" ON business_central_item_details
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view BC sync events" ON business_central_item_sync_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create BC sync events" ON business_central_item_sync_events
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE TRIGGER update_business_central_connections_updated_at
  BEFORE UPDATE ON business_central_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_central_item_categories_updated_at
  BEFORE UPDATE ON business_central_item_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_central_tax_groups_updated_at
  BEFORE UPDATE ON business_central_tax_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_central_units_of_measure_updated_at
  BEFORE UPDATE ON business_central_units_of_measure
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_central_general_product_posting_groups_updated_at
  BEFORE UPDATE ON business_central_general_product_posting_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_central_inventory_posting_groups_updated_at
  BEFORE UPDATE ON business_central_inventory_posting_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_central_items_updated_at
  BEFORE UPDATE ON business_central_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_central_item_details_updated_at
  BEFORE UPDATE ON business_central_item_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- DOWN MIGRATION (run manually if needed)
/*
DROP TRIGGER IF EXISTS update_business_central_item_details_updated_at ON business_central_item_details;
DROP TRIGGER IF EXISTS update_business_central_items_updated_at ON business_central_items;
DROP TRIGGER IF EXISTS update_business_central_units_of_measure_updated_at ON business_central_units_of_measure;
DROP TRIGGER IF EXISTS update_business_central_tax_groups_updated_at ON business_central_tax_groups;
DROP TRIGGER IF EXISTS update_business_central_item_categories_updated_at ON business_central_item_categories;
DROP TRIGGER IF EXISTS update_business_central_connections_updated_at ON business_central_connections;

DROP POLICY IF EXISTS "Authenticated users can create BC sync events" ON business_central_item_sync_events;
DROP POLICY IF EXISTS "Authenticated users can view BC sync events" ON business_central_item_sync_events;
DROP POLICY IF EXISTS "Authenticated users can delete BC item details" ON business_central_item_details;
DROP POLICY IF EXISTS "Authenticated users can update BC item details" ON business_central_item_details;
DROP POLICY IF EXISTS "Authenticated users can create BC item details" ON business_central_item_details;
DROP POLICY IF EXISTS "Authenticated users can view BC item details" ON business_central_item_details;
DROP POLICY IF EXISTS "Authenticated users can delete BC items" ON business_central_items;
DROP POLICY IF EXISTS "Authenticated users can update BC items" ON business_central_items;
DROP POLICY IF EXISTS "Authenticated users can create BC items" ON business_central_items;
DROP POLICY IF EXISTS "Authenticated users can view BC items" ON business_central_items;
DROP POLICY IF EXISTS "Authenticated users can manage BC units of measure" ON business_central_units_of_measure;
DROP POLICY IF EXISTS "Authenticated users can view BC units of measure" ON business_central_units_of_measure;
DROP POLICY IF EXISTS "Authenticated users can manage BC tax groups" ON business_central_tax_groups;
DROP POLICY IF EXISTS "Authenticated users can view BC tax groups" ON business_central_tax_groups;
DROP POLICY IF EXISTS "Authenticated users can manage BC item categories" ON business_central_item_categories;
DROP POLICY IF EXISTS "Authenticated users can view BC item categories" ON business_central_item_categories;
DROP POLICY IF EXISTS "Authenticated users can manage BC connections" ON business_central_connections;
DROP POLICY IF EXISTS "Authenticated users can view BC connections" ON business_central_connections;

ALTER TABLE items DROP COLUMN IF EXISTS bc_item_id;
DROP TABLE IF EXISTS business_central_item_sync_events;
DROP TABLE IF EXISTS business_central_item_details;
DROP TABLE IF EXISTS business_central_items;
DROP TABLE IF EXISTS business_central_units_of_measure;
DROP TABLE IF EXISTS business_central_tax_groups;
DROP TABLE IF EXISTS business_central_item_categories;
DROP TABLE IF EXISTS business_central_connections;
DROP TYPE IF EXISTS business_central_error_class;
DROP TYPE IF EXISTS business_central_sync_event_status;
DROP TYPE IF EXISTS business_central_sync_direction;
DROP TYPE IF EXISTS business_central_sync_status;
*/
