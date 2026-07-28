-- Track whether a customer has accepted the overrun quantity on a PO item.
-- This flag is intentionally independent of all numeric quantity fields.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS overrun_accepted BOOLEAN NOT NULL DEFAULT FALSE;
