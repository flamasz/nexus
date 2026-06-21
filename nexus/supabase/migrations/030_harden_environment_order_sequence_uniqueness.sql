-- Fully remove legacy org/global purchase-order numbering uniqueness and make
-- env-scoped order creation retry-safe against any remaining unique collisions.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop UNIQUE constraints on purchase_orders involving order_number or
  -- order_sequence. Older deployments may have names that differ from local
  -- migrations, so detect by definition instead of by constraint name.
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'purchase_orders'::regclass
      AND contype = 'u'
      AND (
        pg_get_constraintdef(oid) ILIKE '%order_number%'
        OR pg_get_constraintdef(oid) ILIKE '%order_sequence%'
      )
  LOOP
    EXECUTE format('ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  -- Drop standalone UNIQUE indexes involving order_number or order_sequence.
  FOR r IN
    SELECT i.relname AS index_name
    FROM pg_class t
    JOIN pg_index ix ON ix.indrelid = t.oid
    JOIN pg_class i ON i.oid = ix.indexrelid
    WHERE t.relname = 'purchase_orders'
      AND ix.indisunique
      AND NOT ix.indisprimary
      AND (
        pg_get_indexdef(ix.indexrelid) ILIKE '%order_number%'
        OR pg_get_indexdef(ix.indexrelid) ILIKE '%order_sequence%'
      )
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', r.index_name);
  END LOOP;
END $$;

-- Recreate only env-scoped uniqueness.
DROP INDEX IF EXISTS purchase_orders_org_bc_order_number_key;
DROP INDEX IF EXISTS purchase_orders_org_bc_order_sequence_key;

CREATE UNIQUE INDEX purchase_orders_org_bc_order_number_key
  ON purchase_orders(organization_id, bc_connection_id, order_number)
  WHERE bc_connection_id IS NOT NULL;

CREATE UNIQUE INDEX purchase_orders_org_bc_order_sequence_key
  ON purchase_orders(organization_id, bc_connection_id, order_sequence)
  WHERE bc_connection_id IS NOT NULL;

CREATE OR REPLACE FUNCTION create_environment_purchase_order(
  p_organization_id UUID,
  p_bc_connection_id UUID,
  p_order_date DATE,
  p_created_by UUID
)
RETURNS purchase_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequence INTEGER;
  v_prefix TEXT;
  v_padding INTEGER;
  v_order_number TEXT;
  v_order purchase_orders;
  v_attempts INTEGER := 0;
BEGIN
  IF p_bc_connection_id IS NULL THEN
    RAISE EXCEPTION 'Business Central environment is required';
  END IF;

  INSERT INTO purchase_order_sequences (organization_id, bc_connection_id, current_sequence)
  VALUES (p_organization_id, p_bc_connection_id, 0)
  ON CONFLICT (organization_id, bc_connection_id) DO NOTHING;

  SELECT COALESCE(order_prefix, 'PO'), COALESCE(order_padding, 5)
  INTO v_prefix, v_padding
  FROM org_order_settings
  WHERE organization_id = p_organization_id;

  v_prefix := COALESCE(v_prefix, 'PO');
  v_padding := COALESCE(v_padding, 5);

  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > 25 THEN
      RAISE EXCEPTION 'Could not allocate an environment purchase order number after % attempts', v_attempts - 1;
    END IF;

    SELECT current_sequence
    INTO v_sequence
    FROM purchase_order_sequences
    WHERE organization_id = p_organization_id
      AND bc_connection_id = p_bc_connection_id
    FOR UPDATE;

    v_sequence := COALESCE(v_sequence, 0) + 1;
    v_order_number := v_prefix || '-' || LPAD(v_sequence::TEXT, v_padding, '0');

    UPDATE purchase_order_sequences
    SET current_sequence = v_sequence,
        updated_at = NOW()
    WHERE organization_id = p_organization_id
      AND bc_connection_id = p_bc_connection_id;

    BEGIN
      INSERT INTO purchase_orders (
        organization_id,
        bc_connection_id,
        order_number,
        order_sequence,
        order_date,
        created_by
      ) VALUES (
        p_organization_id,
        p_bc_connection_id,
        v_order_number,
        v_sequence,
        p_order_date,
        p_created_by
      )
      RETURNING * INTO v_order;

      RETURN v_order;
    EXCEPTION WHEN unique_violation THEN
      -- If an old/unknown unique index still exists in a deployed database,
      -- advance this environment's counter and retry instead of hard-failing.
      CONTINUE;
    END;
  END LOOP;
END;
$$;
