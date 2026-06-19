-- Enable Row Level Security
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (optional, but good for idempotency)
DROP POLICY IF EXISTS "Public can read site config" ON site_config;
DROP POLICY IF EXISTS "Admin can manage site config" ON site_config;
DROP POLICY IF EXISTS "Public can insert orders" ON orders;
DROP POLICY IF EXISTS "Admin can manage orders" ON orders;

-- Policies for site_config
CREATE POLICY "Public can read site config"
  ON site_config FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin can manage site config"
  ON site_config FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for orders
CREATE POLICY "Public can insert orders"
  ON orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can manage orders"
  ON orders FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RPC for public to count queued orders securely
CREATE OR REPLACE FUNCTION get_queued_count()
RETURNS integer
SECURITY DEFINER
AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM orders WHERE status = 'queued';
  RETURN cnt;
END;
$$ LANGUAGE plpgsql;

-- RPC for public to search their orders safely
CREATE OR REPLACE FUNCTION search_orders(q text)
RETURNS SETOF orders
SECURITY DEFINER
AS $$
BEGIN
  IF length(trim(q)) < 3 THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM orders 
  WHERE tracking_code ILIKE q 
     OR phone ILIKE '%' || q || '%';
END;
$$ LANGUAGE plpgsql;

-- RPC for auto-loading saved orders from local storage
CREATE OR REPLACE FUNCTION get_saved_orders(codes text[])
RETURNS SETOF orders
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM orders 
  WHERE tracking_code = ANY(codes);
END;
$$ LANGUAGE plpgsql;
