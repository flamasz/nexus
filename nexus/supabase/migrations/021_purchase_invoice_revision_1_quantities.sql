-- Revision 1 purchase invoice quantities.
-- Keeps the existing one supplier invoice + one manufacturer invoice per PO item model.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS overrun_qty NUMERIC,
  ADD COLUMN IF NOT EXISTS accept_qty NUMERIC,
  ADD COLUMN IF NOT EXISTS supplier_inv_qty NUMERIC,
  ADD COLUMN IF NOT EXISTS manufacturer_inv_qty NUMERIC,
  ADD COLUMN IF NOT EXISTS overrun_qty_manual BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accept_qty_manual BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supplier_inv_qty_manual BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS manufacturer_inv_qty_manual BOOLEAN NOT NULL DEFAULT FALSE;
