-- Conexión de Mercado Pago por negocio (multi-tenant payments)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mp_access_token  VARCHAR(500);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mp_refresh_token VARCHAR(500);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mp_user_id       VARCHAR(100);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mp_public_key    VARCHAR(200);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS mp_connected_at  TIMESTAMPTZ;
