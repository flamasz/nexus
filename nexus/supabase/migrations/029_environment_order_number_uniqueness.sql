-- Allow the same purchase order number to exist in different BC environments,
-- while keeping order numbers unique inside one organization + environment.
-- This fixes env-specific sequences colliding with the previous org/global
-- order-number uniqueness rule.

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop UNIQUE constraints on purchase_orders that include order_number.
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'purchase_orders'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%order_number%'
  LOOP
    EXECUTE format('ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  -- Drop standalone UNIQUE indexes on purchase_orders that include order_number.
  FOR r IN
    SELECT i.relname AS index_name
    FROM pg_class t
    JOIN pg_index ix ON ix.indrelid = t.oid
    JOIN pg_class i ON i.oid = ix.indexrelid
    WHERE t.relname = 'purchase_orders'
      AND ix.indisunique
      AND NOT ix.indisprimary
      AND pg_get_indexdef(ix.indexrelid) ILIKE '%order_number%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', r.index_name);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_org_bc_order_number_key
  ON purchase_orders(organization_id, bc_connection_id, order_number)
  WHERE bc_connection_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_org_bc_order_sequence_key
  ON purchase_orders(organization_id, bc_connection_id, order_sequence)
  WHERE bc_connection_id IS NOT NULL;
