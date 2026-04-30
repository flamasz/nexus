-- Store the complete item JSON returned by the Business Central item API.
-- The scalar columns remain the queryable/editable mirror; this JSONB payload
-- preserves every returned BC item property for audit, future mapping, and fields
-- that Nexus does not edit directly yet.

ALTER TABLE business_central_items
  ADD COLUMN IF NOT EXISTS bc_raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
