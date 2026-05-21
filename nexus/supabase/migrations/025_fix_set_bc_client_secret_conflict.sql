-- Fix set_bc_client_secret to handle the case where a vault secret with the
-- canonical name already exists but business_central_credentials.client_secret_id
-- is NULL (e.g. created by a dev round-trip test before the credentials row was seeded).
-- The original version always tried vault.create_secret in that branch, which hit a
-- unique-name constraint when the orphaned entry was present.

CREATE OR REPLACE FUNCTION public.set_bc_client_secret(p_org_id uuid, p_secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  -- Check if the credentials row already has a vault pointer.
  SELECT client_secret_id INTO v_secret_id
  FROM public.business_central_credentials
  WHERE organization_id = p_org_id;

  IF v_secret_id IS NOT NULL THEN
    -- Credentials row already points to a vault entry — rotate the secret value.
    PERFORM vault.update_secret(v_secret_id, p_secret);
  ELSE
    -- No pointer yet. Look for an orphaned vault secret under the canonical name
    -- (can exist if a test ran before the credentials row was inserted).
    SELECT id INTO v_secret_id
    FROM vault.secrets
    WHERE name = 'bc_client_secret_' || p_org_id::text;

    IF v_secret_id IS NOT NULL THEN
      -- Orphaned entry found — rotate its value and link it.
      PERFORM vault.update_secret(v_secret_id, p_secret);
    ELSE
      -- Fresh install: create a brand-new vault secret.
      v_secret_id := vault.create_secret(
        p_secret,
        'bc_client_secret_' || p_org_id::text,
        'Business Central client secret for organization ' || p_org_id::text
      );
    END IF;

    -- Record the vault secret ID back into the credentials row.
    UPDATE public.business_central_credentials
    SET client_secret_id = v_secret_id
    WHERE organization_id = p_org_id;
  END IF;

  RETURN v_secret_id;
END;
$$;

-- Permissions are inherited from migration 024; restate them to be safe.
REVOKE ALL ON FUNCTION public.set_bc_client_secret(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_bc_client_secret(uuid, text) TO service_role;

-- DOWN MIGRATION
/*
-- Re-apply the original 024 body (does not handle orphaned vault names):
CREATE OR REPLACE FUNCTION public.set_bc_client_secret(p_org_id uuid, p_secret text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_secret_id uuid;
BEGIN
  SELECT client_secret_id INTO v_secret_id FROM public.business_central_credentials WHERE organization_id = p_org_id;
  IF v_secret_id IS NOT NULL THEN PERFORM vault.update_secret(v_secret_id, p_secret);
  ELSE
    v_secret_id := vault.create_secret(p_secret, 'bc_client_secret_' || p_org_id::text, 'Business Central client secret for organization ' || p_org_id::text);
    UPDATE public.business_central_credentials SET client_secret_id = v_secret_id WHERE organization_id = p_org_id;
  END IF;
  RETURN v_secret_id;
END; $$;
REVOKE ALL ON FUNCTION public.set_bc_client_secret(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_bc_client_secret(uuid, text) TO service_role;
*/
