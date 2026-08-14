-- ============================================================
-- V28: Segundo código de barras por producto + ítems de venta
-- libres (nombre y precio manual, sin producto de inventario)
-- ============================================================

-- 1. Segundo código de barras (ej: mismo producto con 2 empaques)
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS barcode2 VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_products_barcode2 ON products (business_id, barcode2);

-- 2. sale_items.product_id ahora puede ser NULL para ítems libres
--    (ej: "Copias B/N" a precio que decide el cajero al momento)
ALTER TABLE sale_items
    ALTER COLUMN product_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS custom_name VARCHAR(255);
