-- Add archived column to upload_sessions table
ALTER TABLE upload_sessions
ADD COLUMN archived boolean DEFAULT false NOT NULL;
