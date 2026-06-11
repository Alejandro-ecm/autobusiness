-- Cuentas de Instagram Business conectadas (Vendedor IA Instagram)
CREATE TABLE instagram_accounts (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id      UUID         NOT NULL UNIQUE REFERENCES businesses (id) ON DELETE CASCADE,
    ig_user_id       VARCHAR(50)  NOT NULL UNIQUE,
    username         VARCHAR(100),
    access_token     TEXT         NOT NULL,
    token_expires_at TIMESTAMPTZ,
    connected_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_instagram_accounts_ig_user ON instagram_accounts (ig_user_id);
