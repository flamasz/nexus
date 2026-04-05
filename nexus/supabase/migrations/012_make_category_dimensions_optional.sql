-- Make dimension fields optional for categories
ALTER TABLE categories
  ALTER COLUMN width DROP NOT NULL,
  ALTER COLUMN height DROP NOT NULL,
  ALTER COLUMN depth DROP NOT NULL;
