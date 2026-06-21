-- PostgREST/Supabase upsert `onConflict` cannot infer a partial unique index.
-- Replace partial env-scoped BC item unique indexes with normal unique indexes
-- so ON CONFLICT (organization_id, bc_connection_id, bc_company_id, bc_item_id)
-- works during multi-environment item sync.

DROP INDEX IF EXISTS business_central_items_org_conn_company_item_key;
DROP INDEX IF EXISTS business_central_items_org_conn_client_request_key;

CREATE UNIQUE INDEX business_central_items_org_conn_company_item_key
  ON business_central_items(organization_id, bc_connection_id, bc_company_id, bc_item_id);

CREATE UNIQUE INDEX business_central_items_org_conn_client_request_key
  ON business_central_items(organization_id, bc_connection_id, client_request_id);
