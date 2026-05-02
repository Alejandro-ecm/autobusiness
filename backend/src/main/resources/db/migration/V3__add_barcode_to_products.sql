ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(business_id, barcode) WHERE barcode IS NOT NULL;
