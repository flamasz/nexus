-- Relax Business Central mirror numeric constraints.
--
-- Business Central is the source of truth for these fields. Inventory can be
-- negative in real companies, and the mirror table should not reject source
-- rows during pull sync because of local validation assumptions.

ALTER TABLE business_central_items
  DROP CONSTRAINT IF EXISTS business_central_items_unit_price_nonnegative,
  DROP CONSTRAINT IF EXISTS business_central_items_unit_cost_nonnegative,
  DROP CONSTRAINT IF EXISTS business_central_items_inventory_nonnegative;
