-- ══════════════════════════════════════════════════════════════════
-- V7 — Invoices (CFDI base) + Push subscriptions + Super admin
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS invoices (
    id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id    UUID          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    order_id       UUID          REFERENCES orders(id)   ON DELETE SET NULL,
    sale_id        UUID          REFERENCES sales(id)    ON DELETE SET NULL,
    payment_id     UUID          REFERENCES payments(id) ON DELETE SET NULL,
    rfc            VARCHAR(20)   NOT NULL,
    razon_social   VARCHAR(255)  NOT NULL,
    uso_cfdi       VARCHAR(10)   NOT NULL DEFAULT 'G03',
    regimen_fiscal VARCHAR(10),
    cp_receptor    VARCHAR(10),
    email          VARCHAR(255),
    subtotal       NUMERIC(14,2) NOT NULL,
    iva            NUMERIC(14,2) NOT NULL DEFAULT 0,
    total          NUMERIC(14,2) NOT NULL,
    status         VARCHAR(20)   NOT NULL DEFAULT 'PENDING',  -- PENDING STAMPED CANCELLED
    folio_fiscal   VARCHAR(255),     -- UUID timbrado por PAC
    cfdi_xml       TEXT,             -- XML del CFDI
    pdf_url        TEXT,
    error_message  TEXT,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
    endpoint    TEXT        NOT NULL UNIQUE,
    p256dh      TEXT        NOT NULL,
    auth        TEXT        NOT NULL,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Super admin y suspensión de negocios
ALTER TABLE users      ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_suspended   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS suspended_at   TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subdomain      VARCHAR(100) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subs_biz     ON push_subscriptions(business_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user    ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_subdomain ON businesses(subdomain) WHERE subdomain IS NOT NULL;
