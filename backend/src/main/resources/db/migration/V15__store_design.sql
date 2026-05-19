-- Store design customization fields
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS banner_url   TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS store_theme  VARCHAR(30) NOT NULL DEFAULT 'modern';
