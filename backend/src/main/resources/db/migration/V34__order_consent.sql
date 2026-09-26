-- Consentimiento del comprador en el checkout público de la Tienda Online
-- (LFPDPPP 2025). Distinto de legal_acceptances (que exige un userId de
-- SaaS): aquí el comprador no tiene cuenta, así que el consentimiento se
-- guarda directamente en la orden. Columnas nullable/con default — no
-- rompen órdenes existentes y son reversibles con un DROP COLUMN.

ALTER TABLE orders ADD COLUMN consent_accepted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN consent_terms_version VARCHAR(20);
ALTER TABLE orders ADD COLUMN consent_privacy_version VARCHAR(20);
ALTER TABLE orders ADD COLUMN consent_ip VARCHAR(45);
ALTER TABLE orders ADD COLUMN consent_at TIMESTAMP;
