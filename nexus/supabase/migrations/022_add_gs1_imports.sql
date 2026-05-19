-- GS1 Data Hub Excel import: products, batches, links, match candidates.

CREATE TABLE gs1_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  source_sheet TEXT,
  status TEXT NOT NULL DEFAULT 'parsed' CHECK (status IN ('parsed', 'reviewed', 'failed')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  auto_linked_count INTEGER NOT NULL DEFAULT 0,
  suggested_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gs1_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  normalized_gtin TEXT NOT NULL,
  gtin TEXT,
  gtin_8 TEXT,
  gtin_12_upc TEXT,
  gtin_13_ean TEXT,
  gs1_company_prefix TEXT,
  brand_name TEXT,
  product_description TEXT,
  product_description_short TEXT,
  label_description TEXT,
  product_industry TEXT,
  packaging_level TEXT,
  status_label TEXT,
  sku TEXT,
  gpc_brick TEXT,
  image_url TEXT,
  target_markets TEXT,
  net_weight_numeric NUMERIC,
  net_weight_unit TEXT,
  gross_weight_numeric NUMERIC,
  gross_weight_unit TEXT,
  depth_numeric NUMERIC,
  depth_unit TEXT,
  width_numeric NUMERIC,
  width_unit TEXT,
  height_numeric NUMERIC,
  height_unit TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}',
  last_import_batch_id UUID REFERENCES gs1_import_batches(id) ON DELETE SET NULL,
  first_imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, normalized_gtin)
);

CREATE TABLE gs1_item_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  gs1_product_id UUID NOT NULL REFERENCES gs1_products(id) ON DELETE CASCADE,
  business_central_item_id UUID NOT NULL REFERENCES business_central_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'auto_linked' CHECK (status IN ('auto_linked', 'approved', 'denied', 'unlinked')),
  match_method TEXT NOT NULL CHECK (match_method IN ('gtin_in_name', 'gtin_field', 'exact_name', 'high_similarity', 'suggested_similarity', 'manual')),
  match_score NUMERIC,
  match_reason TEXT,
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Only one active link per GS1 product (denied/unlinked are kept for audit)
  UNIQUE (gs1_product_id, business_central_item_id)
);

CREATE TABLE gs1_import_match_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  import_batch_id UUID NOT NULL REFERENCES gs1_import_batches(id) ON DELETE CASCADE,
  gs1_product_id UUID NOT NULL REFERENCES gs1_products(id) ON DELETE CASCADE,
  business_central_item_id UUID NOT NULL REFERENCES business_central_items(id) ON DELETE CASCADE,
  match_score NUMERIC NOT NULL,
  match_method TEXT NOT NULL CHECK (match_method IN ('gtin_in_name', 'gtin_field', 'exact_name', 'high_similarity', 'suggested_similarity', 'manual')),
  match_reason TEXT,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'auto_linked', 'approved', 'denied', 'superseded')),
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (import_batch_id, gs1_product_id, business_central_item_id)
);

CREATE INDEX gs1_products_org_gtin ON gs1_products (organization_id, normalized_gtin);
CREATE INDEX gs1_item_links_org_gs1 ON gs1_item_links (organization_id, gs1_product_id);
CREATE INDEX gs1_item_links_org_bc ON gs1_item_links (organization_id, business_central_item_id);
CREATE INDEX gs1_candidates_batch ON gs1_import_match_candidates (import_batch_id);
CREATE INDEX gs1_candidates_gs1_product ON gs1_import_match_candidates (gs1_product_id);
