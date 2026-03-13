-- Allow anyone to SELECT (list/read) from public storage buckets
-- This is needed because the frontend uses the anon key to list files

-- proposal-assets: allow public read/list, authenticated write/delete
CREATE POLICY "proposal-assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'proposal-assets');

CREATE POLICY "proposal-assets authenticated insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'proposal-assets' AND auth.role() = 'authenticated');

CREATE POLICY "proposal-assets authenticated delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'proposal-assets' AND auth.role() = 'authenticated');

CREATE POLICY "proposal-assets authenticated update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'proposal-assets' AND auth.role() = 'authenticated');

-- ad-creatives: allow public read/list, authenticated write/delete
CREATE POLICY "ad-creatives public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ad-creatives');

CREATE POLICY "ad-creatives authenticated insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ad-creatives' AND auth.role() = 'authenticated');

CREATE POLICY "ad-creatives authenticated delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ad-creatives' AND auth.role() = 'authenticated');

CREATE POLICY "ad-creatives authenticated update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'ad-creatives' AND auth.role() = 'authenticated');
