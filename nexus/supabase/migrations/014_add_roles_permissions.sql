ALTER TABLE users
  ADD COLUMN permissions JSONB NOT NULL DEFAULT jsonb_build_object(
    'functionalRoles', jsonb_build_object(
      'purchaser', false,
      'vendor', false,
      'designer', 'disabled'
    ),
    'overrides', jsonb_build_object()
  ),
  ADD COLUMN permissions_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN permissions_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE users
SET
  permissions = COALESCE(
    permissions,
    jsonb_build_object(
      'functionalRoles', jsonb_build_object(
        'purchaser', false,
        'vendor', false,
        'designer', 'disabled'
      ),
      'overrides', jsonb_build_object()
    )
  ),
  permissions_updated_at = COALESCE(permissions_updated_at, NOW());

CREATE INDEX idx_users_permissions_version ON users(permissions_version);
CREATE INDEX idx_users_permissions_updated_at ON users(permissions_updated_at DESC);
