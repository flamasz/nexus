-- Drop legacy organization-level BC reference uniqueness. Some deployed
-- constraint names are truncated by Postgres, so detect by table + definition
-- instead of hard-coded names.

DO $$
DECLARE
  reference_table TEXT;
  r RECORD;
BEGIN
  FOREACH reference_table IN ARRAY ARRAY[
    'business_central_item_categories',
    'business_central_tax_groups',
    'business_central_units_of_measure',
    'business_central_general_product_posting_groups',
    'business_central_inventory_posting_groups'
  ]
  LOOP
    FOR r IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = reference_table::regclass
        AND contype = 'u'
        AND (
          pg_get_constraintdef(oid) ILIKE '%bc_id%'
          OR pg_get_constraintdef(oid) ILIKE '%code%'
        )
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', reference_table, r.conname);
    END LOOP;

    FOR r IN
      SELECT i.relname AS index_name
      FROM pg_class t
      JOIN pg_index ix ON ix.indrelid = t.oid
      JOIN pg_class i ON i.oid = ix.indexrelid
      WHERE t.relname = reference_table
        AND ix.indisunique
        AND NOT ix.indisprimary
        AND (
          pg_get_indexdef(ix.indexrelid) ILIKE '%bc_id%'
          OR pg_get_indexdef(ix.indexrelid) ILIKE '%code%'
        )
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS %I', r.index_name);
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS bc_item_categories_org_conn_bcid_key
  ON business_central_item_categories(organization_id, bc_connection_id, bc_id);
CREATE UNIQUE INDEX IF NOT EXISTS bc_item_categories_org_conn_code_key
  ON business_central_item_categories(organization_id, bc_connection_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS bc_tax_groups_org_conn_bcid_key
  ON business_central_tax_groups(organization_id, bc_connection_id, bc_id);
CREATE UNIQUE INDEX IF NOT EXISTS bc_tax_groups_org_conn_code_key
  ON business_central_tax_groups(organization_id, bc_connection_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS bc_units_org_conn_bcid_key
  ON business_central_units_of_measure(organization_id, bc_connection_id, bc_id);
CREATE UNIQUE INDEX IF NOT EXISTS bc_units_org_conn_code_key
  ON business_central_units_of_measure(organization_id, bc_connection_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS bc_general_posting_org_conn_bcid_key
  ON business_central_general_product_posting_groups(organization_id, bc_connection_id, bc_id);
CREATE UNIQUE INDEX IF NOT EXISTS bc_general_posting_org_conn_code_key
  ON business_central_general_product_posting_groups(organization_id, bc_connection_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS bc_inventory_posting_org_conn_bcid_key
  ON business_central_inventory_posting_groups(organization_id, bc_connection_id, bc_id);
CREATE UNIQUE INDEX IF NOT EXISTS bc_inventory_posting_org_conn_code_key
  ON business_central_inventory_posting_groups(organization_id, bc_connection_id, code);
