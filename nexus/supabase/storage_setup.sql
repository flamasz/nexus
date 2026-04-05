-- Storage bucket setup for PAMS
-- Run this in Supabase SQL Editor after creating the bucket in Dashboard

-- Create storage bucket (do this via Supabase Dashboard > Storage > New Bucket)
-- Name: packaging-files
-- Public: false

-- Storage policies for packaging-files bucket
-- Note: These policies use the storage schema

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'packaging-files');

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'packaging-files');

-- Allow authenticated users to delete their uploaded files
CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'packaging-files');

-- Allow authenticated users to update files
CREATE POLICY "Authenticated users can update files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'packaging-files');
