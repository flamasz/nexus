-- Migration: Add product_lines table and link to packaging_items

-- ============================================
-- UP MIGRATION
-- ============================================

-- Step 1: Create product_lines table
CREATE TABLE product_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create index for name search
CREATE INDEX idx_product_lines_name ON product_lines(name);
CREATE INDEX idx_product_lines_name_lower ON product_lines(LOWER(name));

-- Step 3: Add product_line_id to packaging_items (nullable - optional field)
ALTER TABLE packaging_items
ADD COLUMN product_line_id UUID REFERENCES product_lines(id) ON DELETE SET NULL;

-- Step 4: Create index on product_line_id
CREATE INDEX idx_packaging_items_product_line_id ON packaging_items(product_line_id);

-- Step 5: Enable Row Level Security on product_lines
ALTER TABLE product_lines ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for product_lines (same as other tables)
CREATE POLICY "Authenticated users can view product lines" ON product_lines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create product lines" ON product_lines
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update product lines" ON product_lines
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete product lines" ON product_lines
  FOR DELETE TO authenticated USING (true);


-- ============================================
-- DOWN MIGRATION (run manually if needed to reverse)
-- ============================================
/*
-- Step 1: Drop product_line_id column from packaging_items
ALTER TABLE packaging_items DROP COLUMN product_line_id;

-- Step 2: Drop indexes
DROP INDEX IF EXISTS idx_packaging_items_product_line_id;
DROP INDEX IF EXISTS idx_product_lines_name;
DROP INDEX IF EXISTS idx_product_lines_name_lower;

-- Step 3: Drop RLS policies
DROP POLICY IF EXISTS "Authenticated users can view product lines" ON product_lines;
DROP POLICY IF EXISTS "Authenticated users can create product lines" ON product_lines;
DROP POLICY IF EXISTS "Authenticated users can update product lines" ON product_lines;
DROP POLICY IF EXISTS "Authenticated users can delete product lines" ON product_lines;

-- Step 4: Drop product_lines table
DROP TABLE IF EXISTS product_lines;
*/
