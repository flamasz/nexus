-- Migration: Add version field to packaging items
-- Description: Adds optional version text field for tracking artwork versions (V1, V2.1, Rev A, etc.)

-- Add version column to packaging_items
ALTER TABLE packaging_items 
ADD COLUMN version text DEFAULT NULL;

-- Update the updated_at timestamp function is already in place from initial migration

-- DOWN MIGRATION (for reference, run manually if needed):
-- ALTER TABLE packaging_items DROP COLUMN version;
