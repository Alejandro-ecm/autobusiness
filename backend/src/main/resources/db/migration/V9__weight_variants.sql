-- ============================================================
-- V9: Soporte de venta por peso, variantes y stock decimal
-- Compatible hacia atrás: todos los defaults mantienen
-- comportamiento actual (UNIT, stock entero → decimal)
-- ============================================================

-- 1. Nuevas columnas en products
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS sale_mode      VARCHAR(20)    NOT NULL DEFAULT 'UNIT',
    ADD COLUMN IF NOT EXISTS base_unit      VARCHAR(20)    NOT NULL DEFAULT 'unit',
    ADD COLUMN IF NOT EXISTS allows_decimal BOOLEAN        NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS price_per_kg   DECIMAL(12, 4),
    ADD COLUMN IF NOT EXISTS variants       TEXT;

-- 2. Stock decimal (INTEGER → DECIMAL seguro en PostgreSQL)
ALTER TABLE products
    ALTER COLUMN stock     TYPE DECIMAL(12, 4),
    ALTER COLUMN min_stock TYPE DECIMAL(12, 4);

-- 3. Quantity decimal en sale_items
ALTER TABLE sale_items
    ALTER COLUMN quantity TYPE DECIMAL(12, 4);

-- 4. Quantity decimal en inventory_movements
ALTER TABLE inventory_movements
    ALTER COLUMN quantity TYPE DECIMAL(12, 4);

-- 5. Índice para búsqueda por sale_mode
CREATE INDEX IF NOT EXISTS idx_products_sale_mode ON products (business_id, sale_mode);
