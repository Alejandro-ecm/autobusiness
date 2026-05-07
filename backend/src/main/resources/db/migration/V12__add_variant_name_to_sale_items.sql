-- V12: columna variant_name faltante en sale_items
-- Necesaria para que Hibernate valide SaleItem.variantName
ALTER TABLE sale_items
    ADD COLUMN IF NOT EXISTS variant_name VARCHAR(100);
