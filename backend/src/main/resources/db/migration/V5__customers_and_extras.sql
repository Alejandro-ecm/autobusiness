-- Clientes del negocio
CREATE TABLE IF NOT EXISTS customers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id  UUID         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    phone        VARCHAR(50),
    email        VARCHAR(255),
    address      TEXT,
    notes        TEXT,
    total_credit NUMERIC(14,2) NOT NULL DEFAULT 0,
    is_active    BOOLEAN      NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Transacciones de crédito (fiado y abonos)
CREATE TABLE IF NOT EXISTS customer_transactions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID          NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID          NOT NULL REFERENCES customers(id)  ON DELETE CASCADE,
    type        VARCHAR(20)   NOT NULL,  -- PURCHASE | PAYMENT
    amount      NUMERIC(14,2) NOT NULL,
    description TEXT,
    sale_id     UUID,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Vincular ventas a clientes
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

CREATE INDEX IF NOT EXISTS idx_customers_business     ON customers(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customer_txn           ON customer_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_customer         ON sales(customer_id) WHERE customer_id IS NOT NULL;
