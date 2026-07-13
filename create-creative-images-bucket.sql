-- Create the 'creative-images' storage bucket used by:
--   - image-generator edge function
--   - ResearchPanel (ad screenshot uploads)
--   - tools.ts (server-side uploads)
--
-- Run this in the Supabase SQL editor for project nhebotmrnxixvcvtspet

INSERT INTO storage.buckets (id, name, public)
VALUES ('creative-images', 'creative-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read (public bucket)
CREATE POLICY "Public read access on creative-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'creative-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated upload to creative-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'creative-images');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated update on creative-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'creative-images');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated delete on creative-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'creative-images');
