-- Share the Business Central company per organization.
-- Amendment to the multi-BC-environments feature: the BC company is shared
-- across an org's environments (one app registration, one company), so it
-- belongs on the shared credentials row rather than per environment.
--
-- Mirror approach: business_central_credentials becomes the source of truth
-- (new company_id / company_name columns). business_central_connections.company_id
-- STAYS as a denormalized mirror the server actions keep in sync, so the
-- existing sync code (businessCentralItems.ts, client.ts) is untouched.

-- ---------------------------------------------------------------------------
-- 1. business_central_credentials: add the shared company columns
-- ---------------------------------------------------------------------------

ALTER TABLE business_central_credentials ADD COLUMN company_id TEXT;
ALTER TABLE business_central_credentials ADD COLUMN company_name TEXT;

-- ---------------------------------------------------------------------------
-- 2. Backfill: copy company_id / company_name from each org's default
--    connection into its credentials row.
-- ---------------------------------------------------------------------------

UPDATE business_central_credentials AS cred
SET company_id = conn.company_id,
    company_name = conn.company_name
FROM business_central_connections AS conn
WHERE conn.organization_id = cred.organization_id
  AND conn.is_default;

-- DOWN MIGRATION (run manually if needed)
/*
ALTER TABLE business_central_credentials DROP COLUMN IF EXISTS company_name;
ALTER TABLE business_central_credentials DROP COLUMN IF EXISTS company_id;
*/
