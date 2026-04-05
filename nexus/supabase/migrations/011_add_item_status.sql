-- Migration: Add status column to packaging_items

-- ============================================
-- UP MIGRATION
-- ============================================

-- Step 1: Add status column with default 'new'
ALTER TABLE packaging_items
ADD COLUMN status TEXT NOT NULL DEFAULT 'new';

-- Step 2: Add check constraint for allowed values
ALTER TABLE packaging_items
ADD CONSTRAINT packaging_items_status_check 
CHECK (status IN ('new', 'in_progress', 'approved', 'superceded'));

-- Step 3: Create index on status for filtering
CREATE INDEX idx_packaging_items_status ON packaging_items(status);

-- Step 4: Backfill existing items that have upload sessions to 'in_progress'
UPDATE packaging_items
SET status = 'in_progress'
WHERE id IN (
  SELECT DISTINCT packaging_id 
  FROM upload_sessions
);


-- ============================================
-- DOWN MIGRATION (run manually if needed to reverse)
-- ============================================
/*
DROP INDEX IF EXISTS idx_packaging_items_status;
ALTER TABLE packaging_items DROP CONSTRAINT IF EXISTS packaging_items_status_check;
ALTER TABLE packaging_items DROP COLUMN IF EXISTS status;
*/
