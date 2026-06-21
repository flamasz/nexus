-- Add guarded Business Central item purchase-link management over existing packaging items.
-- Active item/category/version rows become the canonical upload targets for the Purchases tab.

DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO duplicate_count
  FROM (
    SELECT organization_id, bc_connection_id, item_name_id, category_id, COALESCE(version, '') AS version_key
    FROM items
    WHERE archived = FALSE
      AND organization_id IS NOT NULL
      AND bc_connection_id IS NOT NULL
      AND category_id IS NOT NULL
    GROUP BY organization_id, bc_connection_id, item_name_id, category_id, COALESCE(version, '')
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Cannot add active packaging item version uniqueness; % duplicate active item/category/version group(s) exist. Archive or merge duplicates first.', duplicate_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS items_active_org_bc_name_category_version_key
  ON items (organization_id, bc_connection_id, item_name_id, category_id, COALESCE(version, ''))
  WHERE archived = FALSE
    AND organization_id IS NOT NULL
    AND bc_connection_id IS NOT NULL
    AND category_id IS NOT NULL;

CREATE OR REPLACE FUNCTION link_business_central_item_to_packaging_combo(
  p_business_central_item_row_id UUID,
  p_item_name_id UUID,
  p_category_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_bc_connection_id UUID;
  v_target_count INTEGER;
  v_conflict_count INTEGER;
BEGIN
  SELECT organization_id, bc_connection_id
  INTO v_org_id, v_bc_connection_id
  FROM business_central_items
  WHERE id = p_business_central_item_row_id
  FOR UPDATE;

  IF v_org_id IS NULL OR v_bc_connection_id IS NULL THEN
    RAISE EXCEPTION 'Business Central item not found or is missing an environment scope';
  END IF;

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM users
    WHERE id = auth.uid()
      AND organization_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Access denied for Business Central item purchase link';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_business_central_item_row_id::TEXT, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_item_name_id::TEXT || ':' || p_category_id::TEXT || ':' || v_bc_connection_id::TEXT, 0));

  IF NOT EXISTS (
    SELECT 1
    FROM item_names
    WHERE id = p_item_name_id
      AND organization_id = v_org_id
      AND bc_connection_id = v_bc_connection_id
  ) THEN
    RAISE EXCEPTION 'Item name not found in this Business Central environment';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM categories
    WHERE id = p_category_id
      AND organization_id = v_org_id
      AND bc_connection_id = v_bc_connection_id
  ) THEN
    RAISE EXCEPTION 'Category not found in this Business Central environment';
  END IF;

  SELECT COUNT(*)
  INTO v_target_count
  FROM items
  WHERE organization_id = v_org_id
    AND bc_connection_id = v_bc_connection_id
    AND item_name_id = p_item_name_id
    AND category_id = p_category_id
    AND archived = FALSE;

  IF v_target_count = 0 THEN
    RAISE EXCEPTION 'Packaging item combination does not exist';
  END IF;

  SELECT COUNT(*)
  INTO v_conflict_count
  FROM items
  WHERE organization_id = v_org_id
    AND bc_connection_id = v_bc_connection_id
    AND item_name_id = p_item_name_id
    AND category_id = p_category_id
    AND archived = FALSE
    AND bc_item_id IS NOT NULL
    AND bc_item_id <> p_business_central_item_row_id;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Packaging item combination is already linked to another Business Central item';
  END IF;

  UPDATE items
  SET bc_item_id = NULL,
      updated_at = NOW()
  WHERE organization_id = v_org_id
    AND bc_connection_id = v_bc_connection_id
    AND archived = FALSE
    AND bc_item_id = p_business_central_item_row_id
    AND (item_name_id <> p_item_name_id OR category_id IS DISTINCT FROM p_category_id);

  UPDATE items
  SET bc_item_id = p_business_central_item_row_id,
      updated_at = NOW()
  WHERE organization_id = v_org_id
    AND bc_connection_id = v_bc_connection_id
    AND item_name_id = p_item_name_id
    AND category_id = p_category_id
    AND archived = FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION link_business_central_item_to_packaging_combo(UUID, UUID, UUID) TO authenticated;
