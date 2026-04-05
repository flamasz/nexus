-- Migration: Move dimensions from packaging_items to categories
-- This migration is reversible

-- ============================================
-- UP MIGRATION
-- ============================================

-- Step 1: Add dimension columns to categories table
ALTER TABLE categories
ADD COLUMN length NUMERIC,
ADD COLUMN width NUMERIC,
ADD COLUMN height NUMERIC,
ADD COLUMN unit dimension_unit DEFAULT 'mm',
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Step 2: Create temporary table to hold unique category+dimension combinations
CREATE TEMP TABLE temp_category_dimensions AS
SELECT DISTINCT
  COALESCE(category, 'Uncategorized') as name,
  length,
  width,
  height,
  unit,
  organization_id
FROM packaging_items
WHERE length IS NOT NULL AND width IS NOT NULL AND height IS NOT NULL;

-- Step 3: Insert/update categories with dimensions from packaging_items
-- For existing categories, update with first matching dimensions
-- For new categories (from free-text), create them
INSERT INTO categories (name, length, width, height, unit, organization_id, created_at, updated_at)
SELECT 
  tcd.name,
  tcd.length,
  tcd.width,
  tcd.height,
  tcd.unit,
  tcd.organization_id,
  NOW(),
  NOW()
FROM temp_category_dimensions tcd
ON CONFLICT (name) DO UPDATE SET
  length = EXCLUDED.length,
  width = EXCLUDED.width,
  height = EXCLUDED.height,
  unit = EXCLUDED.unit,
  updated_at = NOW()
WHERE categories.length IS NULL;

-- Step 4: Add category_id column to packaging_items (nullable initially for migration)
ALTER TABLE packaging_items
ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Step 5: Create index on category_id
CREATE INDEX idx_packaging_items_category_id ON packaging_items(category_id);

-- Step 6: Populate category_id from existing category text field
UPDATE packaging_items pi
SET category_id = c.id
FROM categories c
WHERE COALESCE(pi.category, 'Uncategorized') = c.name;

-- Step 7: For any remaining items without a category_id, create an 'Uncategorized' category if needed
INSERT INTO categories (name, length, width, height, unit, created_at, updated_at)
SELECT 'Uncategorized', 100, 100, 100, 'mm', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Uncategorized')
AND EXISTS (SELECT 1 FROM packaging_items WHERE category_id IS NULL);

-- Update remaining items to use Uncategorized
UPDATE packaging_items
SET category_id = (SELECT id FROM categories WHERE name = 'Uncategorized')
WHERE category_id IS NULL;

-- Step 8: Make category_id NOT NULL now that all items have a value
ALTER TABLE packaging_items
ALTER COLUMN category_id SET NOT NULL;

-- Step 9: Make dimension columns NOT NULL in categories
ALTER TABLE categories
ALTER COLUMN length SET NOT NULL,
ALTER COLUMN width SET NOT NULL,
ALTER COLUMN height SET NOT NULL;

-- Step 10: Drop old columns from packaging_items
ALTER TABLE packaging_items
DROP COLUMN length,
DROP COLUMN width,
DROP COLUMN height,
DROP COLUMN unit,
DROP COLUMN category;

-- Step 11: Add updated_at trigger for categories
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 12: Update RLS policies for categories (already has basic policies, just ensure they cover all operations)
DROP POLICY IF EXISTS "Authenticated users can manage categories" ON categories;

CREATE POLICY "Authenticated users can create categories" ON categories
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories" ON categories
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete categories" ON categories
  FOR DELETE TO authenticated USING (true);

-- Clean up temp table
DROP TABLE IF EXISTS temp_category_dimensions;


-- ============================================
-- DOWN MIGRATION (run manually if needed to reverse)
-- ============================================
-- To reverse this migration, run the following:
/*
-- Step 1: Add dimension columns back to packaging_items
ALTER TABLE packaging_items
ADD COLUMN length NUMERIC,
ADD COLUMN width NUMERIC,
ADD COLUMN height NUMERIC,
ADD COLUMN unit dimension_unit DEFAULT 'mm',
ADD COLUMN category TEXT;

-- Step 2: Populate from categories
UPDATE packaging_items pi
SET 
  length = c.length,
  width = c.width,
  height = c.height,
  unit = c.unit,
  category = c.name
FROM categories c
WHERE pi.category_id = c.id;

-- Step 3: Make dimensions NOT NULL
ALTER TABLE packaging_items
ALTER COLUMN length SET NOT NULL,
ALTER COLUMN width SET NOT NULL,
ALTER COLUMN height SET NOT NULL;

-- Step 4: Drop category_id column and index
DROP INDEX IF EXISTS idx_packaging_items_category_id;
ALTER TABLE packaging_items DROP COLUMN category_id;

-- Step 5: Remove dimension columns from categories
ALTER TABLE categories
DROP COLUMN length,
DROP COLUMN width,
DROP COLUMN height,
DROP COLUMN unit,
DROP COLUMN updated_at;

-- Step 6: Drop updated_at trigger
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
*/
