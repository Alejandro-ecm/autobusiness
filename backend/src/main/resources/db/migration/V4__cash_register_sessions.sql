CREATE TABLE IF NOT EXISTS cash_register_sessions (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      UUID         NOT NULL REFERENCES businesses(id),
    branch_id        UUID         REFERENCES branches(id),
    cashier_id       UUID         REFERENCES users(id),
    opened_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    closed_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    total_cash       NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_card       NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_transfer   NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_mp         NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_revenue    NUMERIC(14,2) NOT NULL DEFAULT 0,
    transaction_count INTEGER      NOT NULL DEFAULT 0,
    notes            TEXT,
    status           VARCHAR(20)  NOT NULL DEFAULT 'CLOSED',
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_business
    ON cash_register_sessions(business_id, closed_at DESC);
