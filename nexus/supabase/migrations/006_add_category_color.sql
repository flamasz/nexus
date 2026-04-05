-- Add color column to categories table
ALTER TABLE categories
ADD COLUMN color text;

-- No default needed - NULL values will be auto-assigned a color based on name hash at render time
