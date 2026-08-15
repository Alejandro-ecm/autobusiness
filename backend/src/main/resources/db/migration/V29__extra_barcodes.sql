-- ============================================================
-- V29: Hasta 8 códigos de barras adicionales por producto
-- (junto con barcode y barcode2 = hasta 10 en total). Se
-- guardan como un arreglo JSON de texto, igual que "variants".
-- ============================================================

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS extra_barcodes TEXT;
