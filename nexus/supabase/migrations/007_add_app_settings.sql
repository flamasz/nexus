-- Create app_settings table for storing application-wide settings like recent custom colors
CREATE TABLE app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and write app settings
CREATE POLICY "Authenticated users can read app settings"
  ON app_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert app settings"
  ON app_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update app settings"
  ON app_settings
  FOR UPDATE
  TO authenticated
  USING (true);

-- Insert initial recent_custom_colors setting
INSERT INTO app_settings (key, value) VALUES ('recent_custom_colors', '[]'::jsonb);
