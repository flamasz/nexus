-- Migration: Rename dimension columns for clarity
-- length -> width, width -> height, height -> depth

-- ============================================
-- UP MIGRATION
-- ============================================

-- Must rename in specific order to avoid conflicts
-- First rename 'height' to 'depth' (frees up 'height')
ALTER TABLE categories RENAME COLUMN height TO depth;

-- Then rename 'width' to 'height' (frees up 'width')
ALTER TABLE categories RENAME COLUMN width TO height;

-- Finally rename 'length' to 'width'
ALTER TABLE categories RENAME COLUMN length TO width;


-- ============================================
-- DOWN MIGRATION (run manually if needed to reverse)
-- ============================================
/*
ALTER TABLE categories RENAME COLUMN width TO length;
ALTER TABLE categories RENAME COLUMN height TO width;
ALTER TABLE categories RENAME COLUMN depth TO height;
*/
