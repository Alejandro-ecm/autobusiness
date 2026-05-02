-- ══════════════════════════════════════════════════════════════════
-- V6 — Payments (Mercado Pago) + Subscriptions SaaS
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payments (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id    UUID          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    order_id       UUID          REFERENCES orders(id)  ON DELETE SET NULL,
    sale_id        UUID          REFERENCES sales(id)   ON DELETE SET NULL,
    method         VARCHAR(50)   NOT NULL DEFAULT 'mercadopago',
    status         VARCHAR(30)   NOT NULL DEFAULT 'pending',
    amount         NUMERIC(14,2) NOT NULL,
    currency       VARCHAR(10)   NOT NULL DEFAULT 'MXN',
    transaction_id VARCHAR(255)  UNIQUE,         -- MP payment_id, idempotency key
    preference_id  VARCHAR(255),                 -- MP preference_id
    external_ref   VARCHAR(255),                 -- external_reference enviado a MP
    payer_email    VARCHAR(255),
    payer_name     VARCHAR(255),
    raw_status     VARCHAR(50),                  -- status raw de MP
    metadata       JSONB,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id          UUID         NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
    plan                 VARCHAR(20)  NOT NULL DEFAULT 'FREE',
    status               VARCHAR(20)  NOT NULL DEFAULT 'TRIAL',  -- TRIAL ACTIVE PAST_DUE CANCELED SUSPENDED
    trial_ends_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW() + INTERVAL '14 days',
    current_period_start TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    current_period_end   TIMESTAMPTZ  NOT NULL DEFAULT NOW() + INTERVAL '30 days',
    mp_preapproval_id    VARCHAR(255),
    last_payment_id      UUID         REFERENCES payments(id),
    canceled_at          TIMESTAMPTZ,
    cancel_reason        TEXT,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_business    ON payments(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order       ON payments(order_id)       WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_txn_id      ON payments(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status      ON payments(business_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_biz    ON subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status, current_period_end);

-- Crear suscripción trial para negocios existentes
INSERT INTO subscriptions (business_id, plan, status)
SELECT id, 'FREE', 'TRIAL' FROM businesses
ON CONFLICT (business_id) DO NOTHING;
