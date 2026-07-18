ALTER TABLE site_config 
ADD COLUMN IF NOT EXISTS announcement_text TEXT,
ADD COLUMN IF NOT EXISTS announcement_active BOOLEAN DEFAULT false;
