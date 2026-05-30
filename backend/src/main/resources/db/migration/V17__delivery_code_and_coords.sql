-- Código único de delivery por negocio
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS delivery_code VARCHAR(20) UNIQUE;

-- Generar códigos para negocios existentes
UPDATE businesses
SET delivery_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
WHERE delivery_code IS NULL;

-- Coordenadas GPS precisas en órdenes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat  DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng  DOUBLE PRECISION;
