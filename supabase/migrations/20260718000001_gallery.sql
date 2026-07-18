-- Create gallery_items table
CREATE TABLE IF NOT EXISTS gallery_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  media_urls TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Gallery items are viewable by everyone"
  ON gallery_items FOR SELECT
  USING (true);

-- Admin insert/update/delete
CREATE POLICY "Authenticated users can insert gallery items"
  ON gallery_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update gallery items"
  ON gallery_items FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete gallery items"
  ON gallery_items FOR DELETE
  TO authenticated
  USING (true);

-- Create storage bucket for gallery media (images + GIFs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery-media', 'gallery-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public reads on gallery-media bucket
CREATE POLICY "Gallery media is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery-media');

-- Allow authenticated uploads
CREATE POLICY "Authenticated users can upload gallery media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gallery-media');

-- Allow authenticated deletes
CREATE POLICY "Authenticated users can delete gallery media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'gallery-media');
