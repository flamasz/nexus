-- Migration: Add item_names table and convert packaging_items.name to FK

-- ============================================
-- UP MIGRATION
-- ============================================

-- Step 1: Create item_names table
CREATE TABLE item_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for name search
CREATE INDEX idx_item_names_name ON item_names(name);
CREATE INDEX idx_item_names_name_lower ON item_names(LOWER(name));

-- Step 3: Enable Row Level Security on item_names
ALTER TABLE item_names ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for item_names (same as other tables)
CREATE POLICY "Authenticated users can view item names" ON item_names
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create item names" ON item_names
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update item names" ON item_names
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete item names" ON item_names
  FOR DELETE TO authenticated USING (true);

-- Step 5: Backfill item_names from existing distinct names in packaging_items
INSERT INTO item_names (name, organization_id)
SELECT DISTINCT name, organization_id
FROM packaging_items
WHERE name IS NOT NULL AND name != ''
ON CONFLICT (name) DO NOTHING;

-- Step 6: Add item_name_id column to packaging_items (nullable initially for backfill)
ALTER TABLE packaging_items
ADD COLUMN item_name_id UUID REFERENCES item_names(id) ON DELETE RESTRICT;

-- Step 7: Create index on item_name_id
CREATE INDEX idx_packaging_items_item_name_id ON packaging_items(item_name_id);

-- Step 8: Populate item_name_id from existing name values
UPDATE packaging_items p
SET item_name_id = i.id
FROM item_names i
WHERE p.name = i.name;

-- Step 9: Make item_name_id NOT NULL (required field)
ALTER TABLE packaging_items
ALTER COLUMN item_name_id SET NOT NULL;

-- Step 10: Drop the old name column
ALTER TABLE packaging_items
DROP COLUMN name;

-- Step 11: Create trigger for updated_at on item_names
CREATE TRIGGER update_item_names_updated_at
  BEFORE UPDATE ON item_names
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- DOWN MIGRATION (run manually if needed to reverse)
-- ============================================
/*
-- Step 1: Add back the name column
ALTER TABLE packaging_items
ADD COLUMN name TEXT;

-- Step 2: Populate name from item_names
UPDATE packaging_items p
SET name = i.name
FROM item_names i
WHERE p.item_name_id = i.id;

-- Step 3: Make name NOT NULL
ALTER TABLE packaging_items
ALTER COLUMN name SET NOT NULL;

-- Step 4: Drop item_name_id column
ALTER TABLE packaging_items
DROP COLUMN item_name_id;

-- Step 5: Drop index
DROP INDEX IF EXISTS idx_packaging_items_item_name_id;

-- Step 6: Drop trigger
DROP TRIGGER IF EXISTS update_item_names_updated_at ON item_names;

-- Step 7: Drop RLS policies
DROP POLICY IF EXISTS "Authenticated users can view item names" ON item_names;
DROP POLICY IF EXISTS "Authenticated users can create item names" ON item_names;
DROP POLICY IF EXISTS "Authenticated users can update item names" ON item_names;
DROP POLICY IF EXISTS "Authenticated users can delete item names" ON item_names;

-- Step 8: Drop indexes
DROP INDEX IF EXISTS idx_item_names_name;
DROP INDEX IF EXISTS idx_item_names_name_lower;

-- Step 9: Drop item_names table
DROP TABLE IF EXISTS item_names;
*/
