-- Revert temporary PO item catalog layer from migration 034.
-- The app now uses existing packaging items (`items`) as the source for
-- purchase-order item name/category combinations, so `po_items` and
-- `order_items.po_item_id` are no longer used.

DROP TRIGGER IF EXISTS update_po_items_updated_at ON po_items;

DROP POLICY IF EXISTS "Authenticated users can delete PO items" ON po_items;
DROP POLICY IF EXISTS "Authenticated users can update PO items" ON po_items;
DROP POLICY IF EXISTS "Authenticated users can create PO items" ON po_items;
DROP POLICY IF EXISTS "Authenticated users can view PO items" ON po_items;

DROP INDEX IF EXISTS idx_order_items_po_item_id;
DROP INDEX IF EXISTS idx_po_items_bc_item;
DROP INDEX IF EXISTS idx_po_items_org_bc_name_category;

ALTER TABLE order_items
  DROP COLUMN IF EXISTS po_item_id;

DROP TABLE IF EXISTS po_items;
