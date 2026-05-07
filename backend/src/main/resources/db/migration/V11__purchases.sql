-- V11: módulo de compras a proveedores
CREATE TABLE IF NOT EXISTS purchases (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id    UUID         NOT NULL REFERENCES businesses(id),
    branch_id      UUID         REFERENCES branches(id),
    created_by_id  UUID         REFERENCES users(id),
    supplier_name  VARCHAR(200),
    notes          TEXT,
    total          DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status         VARCHAR(20)  NOT NULL DEFAULT 'completed',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id  UUID         NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    product_id   UUID         NOT NULL REFERENCES products(id),
    quantity     DECIMAL(12, 4) NOT NULL,
    unit_cost    DECIMAL(12, 4) NOT NULL,
    subtotal     DECIMAL(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_business    ON purchases(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purch  ON purchase_items(purchase_id);
