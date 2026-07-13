-- Drop existing policies if any (idempotent)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read access on creative-images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated upload to creative-images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated update on creative-images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated delete on creative-images" ON storage.objects;
END $$;

CREATE POLICY "Public read access on creative-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'creative-images');

CREATE POLICY "Authenticated upload to creative-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'creative-images');

CREATE POLICY "Authenticated update on creative-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'creative-images');

CREATE POLICY "Authenticated delete on creative-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'creative-images');
