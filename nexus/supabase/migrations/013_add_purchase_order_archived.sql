-- Add archived column to purchase_orders
ALTER TABLE purchase_orders
  ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Add index for filtering by archived status
CREATE INDEX idx_purchase_orders_archived ON purchase_orders(archived);
