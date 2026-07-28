-- Scope Business Central item mirror uniqueness by BC environment/connection.
-- Different environments can expose the same company/item ids, so org+company+item
-- is not sufficient once multi-environment sync is enabled.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'business_central_items'::regclass
      AND contype = 'u'
      AND (
        pg_get_constraintdef(oid) ILIKE '%bc_item_id%'
        OR pg_get_constraintdef(oid) ILIKE '%client_request_id%'
      )
  LOOP
    EXECUTE format('ALTER TABLE business_central_items DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  FOR r IN
    SELECT i.relname AS index_name
    FROM pg_class t
    JOIN pg_index ix ON ix.indrelid = t.oid
    JOIN pg_class i ON i.oid = ix.indexrelid
    WHERE t.relname = 'business_central_items'
      AND ix.indisunique
      AND NOT ix.indisprimary
      AND (
        pg_get_indexdef(ix.indexrelid) ILIKE '%bc_item_id%'
        OR pg_get_indexdef(ix.indexrelid) ILIKE '%client_request_id%'
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', r.index_name);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS business_central_items_org_conn_company_item_key
  ON business_central_items(organization_id, bc_connection_id, bc_company_id, bc_item_id)
  WHERE bc_connection_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS business_central_items_org_conn_client_request_key
  ON business_central_items(organization_id, bc_connection_id, client_request_id)
  WHERE bc_connection_id IS NOT NULL AND client_request_id IS NOT NULL;
