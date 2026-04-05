-- PAMS Database Schema
-- Run this migration in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE dimension_unit AS ENUM ('mm', 'cm', 'in');
CREATE TYPE upload_status AS ENUM ('uploaded', 'approved', 'rejected');

-- Organizations table (future multi-tenancy, unused for MVP)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (synced with Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role user_role DEFAULT 'user',
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Packaging items table
CREATE TABLE packaging_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  length NUMERIC NOT NULL,
  width NUMERIC NOT NULL,
  height NUMERIC NOT NULL,
  unit dimension_unit DEFAULT 'mm',
  category TEXT,
  archived BOOLEAN DEFAULT FALSE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upload sessions table
CREATE TABLE upload_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  packaging_id UUID NOT NULL REFERENCES packaging_items(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  status upload_status DEFAULT 'uploaded',
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Files table
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_session_id UUID NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories table (optional, for future management UI)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_packaging_items_updated_at ON packaging_items(updated_at DESC);
CREATE INDEX idx_packaging_items_archived ON packaging_items(archived);
CREATE INDEX idx_upload_sessions_packaging_id ON upload_sessions(packaging_id);
CREATE INDEX idx_upload_sessions_uploaded_at ON upload_sessions(uploaded_at DESC);
CREATE INDEX idx_files_upload_session_id ON files(upload_session_id);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for MVP (authenticated users can read/write all rows)
-- Organizations
CREATE POLICY "Authenticated users can view organizations" ON organizations
  FOR SELECT TO authenticated USING (true);

-- Users
CREATE POLICY "Authenticated users can view all users" ON users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Service role can manage users" ON users
  FOR ALL TO service_role USING (true);

-- Packaging Items
CREATE POLICY "Authenticated users can view packaging items" ON packaging_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create packaging items" ON packaging_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update packaging items" ON packaging_items
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete packaging items" ON packaging_items
  FOR DELETE TO authenticated USING (true);

-- Upload Sessions
CREATE POLICY "Authenticated users can view upload sessions" ON upload_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create upload sessions" ON upload_sessions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update upload sessions" ON upload_sessions
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete upload sessions" ON upload_sessions
  FOR DELETE TO authenticated USING (true);

-- Files
CREATE POLICY "Authenticated users can view files" ON files
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create files" ON files
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete files" ON files
  FOR DELETE TO authenticated USING (true);

-- Categories
CREATE POLICY "Authenticated users can view categories" ON categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage categories" ON categories
  FOR ALL TO authenticated USING (true);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user record on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packaging_items_updated_at
  BEFORE UPDATE ON packaging_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_upload_sessions_updated_at
  BEFORE UPDATE ON upload_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
