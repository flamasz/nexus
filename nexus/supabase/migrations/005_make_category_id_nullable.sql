-- Migration: Make category_id nullable to allow category deletion
-- Description: Allows packaging_items to have no category when a category is deleted

-- Make category_id nullable
ALTER TABLE packaging_items
ALTER COLUMN category_id DROP NOT NULL;

-- The ON DELETE SET NULL is already in place from migration 002

-- DOWN MIGRATION (for reference, run manually if needed):
-- First ensure all items have a category:
-- INSERT INTO categories (name, length, width, height, unit) 
-- VALUES ('Uncategorized', 100, 100, 100, 'mm')
-- ON CONFLICT (name) DO NOTHING;
-- 
-- UPDATE packaging_items
-- SET category_id = (SELECT id FROM categories WHERE name = 'Uncategorized')
-- WHERE category_id IS NULL;
--
-- ALTER TABLE packaging_items
-- ALTER COLUMN category_id SET NOT NULL;
