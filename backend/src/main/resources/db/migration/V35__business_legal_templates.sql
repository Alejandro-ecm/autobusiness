-- Plantillas legales editables por negocio para su Tienda Online (LFPDPPP
-- 2025 / PROFECO). Nullable: si el negocio no las ha llenado, el frontend
-- muestra una plantilla generica con los datos publicos del negocio.
-- Reversible con DROP COLUMN.

ALTER TABLE businesses ADD COLUMN store_privacy_notice TEXT;
ALTER TABLE businesses ADD COLUMN store_refund_policy TEXT;
