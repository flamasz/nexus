-- Multi-environment Business Central support.
-- Phase 1 (Data layer) of the multi-BC-environments plan.
-- Lets one org hold a shared credential set and connect to many BC environments.

-- ---------------------------------------------------------------------------
-- 1. business_central_connections: allow many environments per org
-- ---------------------------------------------------------------------------

-- Drop the single-connection-per-org UNIQUE(organization_id) constraint.
-- The constraint is auto-named (likely business_central_connections_organization_id_key);
-- resolve it by definition so the migration is robust to naming.
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.business_central_connections'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) = 'UNIQUE (organization_id)';
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.business_central_connections DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

-- Add display_name (human label for the environment); backfill from environment.
ALTER TABLE business_central_connections ADD COLUMN display_name TEXT;
UPDATE business_central_connections SET display_name = environment WHERE display_name IS NULL;
ALTER TABLE business_central_connections ALTER COLUMN display_name SET NOT NULL;

-- Add is_default; backfill every existing connection as its org's default.
ALTER TABLE business_central_connections ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE business_central_connections SET is_default = TRUE;

-- Enforce exactly one default connection per organization.
CREATE UNIQUE INDEX idx_bc_connections_one_default_per_org
  ON business_central_connections (organization_id)
  WHERE is_default;

-- ---------------------------------------------------------------------------
-- 2. business_central_credentials: one shared credential set per org
-- ---------------------------------------------------------------------------

CREATE TABLE business_central_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret_id UUID,
  default_api_base_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_business_central_credentials_organization_id
  ON business_central_credentials(organization_id);

CREATE TRIGGER update_business_central_credentials_updated_at
  BEFORE UPDATE ON business_central_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. users: per-user active environment selection
-- ---------------------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN active_bc_connection_id UUID
  REFERENCES business_central_connections(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 4. Supabase Vault + SECURITY DEFINER secret wrappers
-- ---------------------------------------------------------------------------

-- Vault is already enabled on this project; this is a no-op safety net.
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault CASCADE;

-- Store / rotate an org's BC client secret in Vault. Returns the Vault secret id.
-- SECURITY DEFINER (owned by postgres, which can access the vault schema);
-- search_path is emptied and every reference is schema-qualified.
CREATE OR REPLACE FUNCTION public.set_bc_client_secret(p_org_id uuid, p_secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  SELECT client_secret_id INTO v_secret_id
  FROM public.business_central_credentials
  WHERE organization_id = p_org_id;

  IF v_secret_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_secret_id, p_secret);
  ELSE
    v_secret_id := vault.create_secret(
      p_secret,
      'bc_client_secret_' || p_org_id::text,
      'Business Central client secret for organization ' || p_org_id::text
    );
    UPDATE public.business_central_credentials
    SET client_secret_id = v_secret_id
    WHERE organization_id = p_org_id;
  END IF;

  RETURN v_secret_id;
END;
$$;

-- Read an org's decrypted BC client secret from Vault.
CREATE OR REPLACE FUNCTION public.get_bc_client_secret(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret_id uuid;
  v_secret text;
BEGIN
  SELECT client_secret_id INTO v_secret_id
  FROM public.business_central_credentials
  WHERE organization_id = p_org_id;

  IF v_secret_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE id = v_secret_id;

  RETURN v_secret;
END;
$$;

-- Lock the wrappers down: only the service-role client may call them.
REVOKE ALL ON FUNCTION public.set_bc_client_secret(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_bc_client_secret(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_bc_client_secret(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_bc_client_secret(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE business_central_credentials ENABLE ROW LEVEL SECURITY;

-- Org members may read their own org's credential row (IDs only via API; the
-- secret never leaves Vault). No prior org-scoped policy exists to mirror.
CREATE POLICY "Org members view BC credentials" ON business_central_credentials
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Only admins of the owning org may insert/update/delete credentials.
CREATE POLICY "Org admins manage BC credentials" ON business_central_credentials
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
         AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
         AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Tighten business_central_connections SELECT from USING(true) to the owning org.
DROP POLICY IF EXISTS "Authenticated users can view BC connections" ON business_central_connections;
CREATE POLICY "Org members view BC connections" ON business_central_connections
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- DOWN MIGRATION (run manually if needed)
/*
DROP POLICY IF EXISTS "Org members view BC connections" ON business_central_connections;
CREATE POLICY "Authenticated users can view BC connections" ON business_central_connections
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Org admins manage BC credentials" ON business_central_credentials;
DROP POLICY IF EXISTS "Org members view BC credentials" ON business_central_credentials;

REVOKE ALL ON FUNCTION public.get_bc_client_secret(uuid) FROM service_role;
REVOKE ALL ON FUNCTION public.set_bc_client_secret(uuid, text) FROM service_role;
DROP FUNCTION IF EXISTS public.get_bc_client_secret(uuid);
DROP FUNCTION IF EXISTS public.set_bc_client_secret(uuid, text);

ALTER TABLE users DROP COLUMN IF EXISTS active_bc_connection_id;

DROP TRIGGER IF EXISTS update_business_central_credentials_updated_at ON business_central_credentials;
DROP TABLE IF EXISTS business_central_credentials;

DROP INDEX IF EXISTS idx_bc_connections_one_default_per_org;
ALTER TABLE business_central_connections DROP COLUMN IF EXISTS is_default;
ALTER TABLE business_central_connections DROP COLUMN IF EXISTS display_name;
ALTER TABLE business_central_connections
  ADD CONSTRAINT business_central_connections_organization_id_key UNIQUE (organization_id);
*/
