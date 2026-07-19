-- Allow authenticated users to update gallery media (Required for Edit functionality)
CREATE POLICY "Authenticated users can update gallery media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'gallery-media');
