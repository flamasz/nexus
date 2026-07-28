-- Keep purchase order auto-number sequences separate per Business Central environment.

CREATE TABLE IF NOT EXISTS purchase_order_sequences (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bc_connection_id UUID NOT NULL REFERENCES business_central_connections(id) ON DELETE CASCADE,
  current_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, bc_connection_id)
);

INSERT INTO purchase_order_sequences (organization_id, bc_connection_id, current_sequence)
SELECT organization_id, bc_connection_id, COALESCE(MAX(order_sequence), 0)
FROM purchase_orders
WHERE bc_connection_id IS NOT NULL
GROUP BY organization_id, bc_connection_id
ON CONFLICT (organization_id, bc_connection_id) DO UPDATE
SET current_sequence = GREATEST(
  purchase_order_sequences.current_sequence,
  EXCLUDED.current_sequence
),
updated_at = NOW();

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
BEGIN
  IF p_bc_connection_id IS NULL THEN
    RAISE EXCEPTION 'Business Central environment is required';
  END IF;

  INSERT INTO purchase_order_sequences (organization_id, bc_connection_id, current_sequence)
  VALUES (p_organization_id, p_bc_connection_id, 0)
  ON CONFLICT (organization_id, bc_connection_id) DO NOTHING;

  SELECT current_sequence
  INTO v_sequence
  FROM purchase_order_sequences
  WHERE organization_id = p_organization_id
    AND bc_connection_id = p_bc_connection_id
  FOR UPDATE;

  v_sequence := COALESCE(v_sequence, 0) + 1;

  UPDATE purchase_order_sequences
  SET current_sequence = v_sequence,
      updated_at = NOW()
  WHERE organization_id = p_organization_id
    AND bc_connection_id = p_bc_connection_id;

  SELECT COALESCE(order_prefix, 'PO'), COALESCE(order_padding, 5)
  INTO v_prefix, v_padding
  FROM org_order_settings
  WHERE organization_id = p_organization_id;

  v_prefix := COALESCE(v_prefix, 'PO');
  v_padding := COALESCE(v_padding, 5);
  v_order_number := v_prefix || '-' || LPAD(v_sequence::TEXT, v_padding, '0');

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
END;
$$;
