-- Permite asignar una categoría a los ítems "libres" (sin producto de
-- inventario) del POS, para que cuenten en Ganancias por categoría.
ALTER TABLE sale_items
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);
