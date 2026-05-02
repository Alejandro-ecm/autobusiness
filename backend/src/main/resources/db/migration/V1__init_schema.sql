-- =============================================
-- AutoBusiness AI — Schema inicial PostgreSQL
-- Multi-tenant por business_id discriminator
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Negocios (tenants raíz)
CREATE TABLE businesses (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(255)        NOT NULL,
    slug          VARCHAR(100) UNIQUE NOT NULL,
    description   TEXT,
    logo_url      TEXT,
    phone         VARCHAR(50),
    email         VARCHAR(255),
    address       TEXT,
    plan          VARCHAR(50)         NOT NULL DEFAULT 'free',
    is_active     BOOLEAN             NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Sucursales por negocio
CREATE TABLE branches (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id   UUID        NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    address       TEXT,
    phone         VARCHAR(50),
    is_main       BOOLEAN     NOT NULL DEFAULT false,
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usuarios del sistema
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id   UUID         NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    branch_id     UUID REFERENCES branches (id),
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255)        NOT NULL,
    name          VARCHAR(255)        NOT NULL,
    role          VARCHAR(50)         NOT NULL, -- OWNER, ADMIN, CASHIER
    is_active     BOOLEAN             NOT NULL DEFAULT true,
    last_login    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Categorías de productos
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID        NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    color       VARCHAR(20)  NOT NULL DEFAULT '#6366f1',
    icon        VARCHAR(50)
);

-- Productos
CREATE TABLE products (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id   UUID           NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    branch_id     UUID           REFERENCES branches (id),
    category_id   UUID           REFERENCES categories (id),
    sku           VARCHAR(100),
    name          VARCHAR(255)   NOT NULL,
    description   TEXT,
    price         DECIMAL(12, 2) NOT NULL,
    cost          DECIMAL(12, 2) NOT NULL DEFAULT 0,
    stock         INTEGER        NOT NULL DEFAULT 0,
    min_stock     INTEGER        NOT NULL DEFAULT 5,
    image_url     TEXT,
    is_active     BOOLEAN        NOT NULL DEFAULT true,
    is_online     BOOLEAN        NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Ventas
CREATE TABLE sales (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id    UUID           NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    branch_id      UUID           NOT NULL REFERENCES branches (id),
    cashier_id     UUID           REFERENCES users (id),
    subtotal       DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount       DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total          DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(50)    NOT NULL DEFAULT 'cash',
    cash_received  DECIMAL(12, 2),
    change_given   DECIMAL(12, 2),
    channel        VARCHAR(50)    NOT NULL DEFAULT 'pos',
    status         VARCHAR(50)    NOT NULL DEFAULT 'completed',
    notes          TEXT,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Ítems de venta
CREATE TABLE sale_items (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id     UUID           NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
    product_id  UUID           NOT NULL REFERENCES products (id),
    quantity    INTEGER        NOT NULL,
    unit_price  DECIMAL(12, 2) NOT NULL,
    unit_cost   DECIMAL(12, 2) NOT NULL DEFAULT 0,
    subtotal    DECIMAL(12, 2) NOT NULL
);

-- Movimientos de inventario
CREATE TABLE inventory_movements (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id  UUID        NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    product_id   UUID        NOT NULL REFERENCES products (id),
    branch_id    UUID        REFERENCES branches (id),
    type         VARCHAR(50) NOT NULL, -- IN, OUT, ADJUSTMENT, LOSS
    quantity     INTEGER     NOT NULL,
    reason       TEXT,
    reference_id UUID,
    created_by   UUID        REFERENCES users (id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transacciones financieras
CREATE TABLE transactions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id  UUID           NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    branch_id    UUID           REFERENCES branches (id),
    type         VARCHAR(50)    NOT NULL, -- INCOME, EXPENSE
    category     VARCHAR(100),
    amount       DECIMAL(12, 2) NOT NULL,
    description  TEXT,
    reference_id UUID,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Órdenes online
CREATE TABLE orders (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id    UUID           NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    order_number   VARCHAR(50)    NOT NULL,
    customer_name  VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    subtotal       DECIMAL(12, 2),
    total          DECIMAL(12, 2) NOT NULL,
    status         VARCHAR(50)    NOT NULL DEFAULT 'pending',
    notes          TEXT,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Ítems de órdenes
CREATE TABLE order_items (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id   UUID           NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id UUID           NOT NULL REFERENCES products (id),
    quantity   INTEGER        NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    subtotal   DECIMAL(12, 2) NOT NULL
);

-- Insights de IA
CREATE TABLE ai_insights (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id  UUID           NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    type         VARCHAR(100)   NOT NULL,
    status       VARCHAR(20)    NOT NULL DEFAULT 'GREEN', -- GREEN, YELLOW, RED
    title        TEXT           NOT NULL,
    diagnosis    TEXT           NOT NULL,
    cause        TEXT,
    action       TEXT           NOT NULL,
    impact       TEXT,
    impact_amount DECIMAL(12, 2),
    priority     INTEGER        NOT NULL DEFAULT 1,
    is_dismissed BOOLEAN        NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ
);

-- Alertas del sistema
CREATE TABLE alerts (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id    UUID        NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    branch_id      UUID        REFERENCES branches (id),
    type           VARCHAR(100) NOT NULL,
    severity       VARCHAR(50)  NOT NULL DEFAULT 'INFO', -- INFO, WARNING, CRITICAL
    message        TEXT         NOT NULL,
    reference_type VARCHAR(50),
    reference_id   UUID,
    is_read        BOOLEAN      NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Posts de marketing
CREATE TABLE marketing_posts (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id  UUID        NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    platform     VARCHAR(50)  NOT NULL, -- whatsapp, instagram, facebook
    content      TEXT         NOT NULL,
    status       VARCHAR(50)  NOT NULL DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ,
    sent_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índices críticos de rendimiento
CREATE INDEX idx_products_business    ON products (business_id);
CREATE INDEX idx_products_branch      ON products (branch_id);
CREATE INDEX idx_products_active      ON products (business_id, is_active);
CREATE INDEX idx_sales_business_date  ON sales (business_id, created_at DESC);
CREATE INDEX idx_sales_branch_date    ON sales (branch_id, created_at DESC);
CREATE INDEX idx_inventory_product    ON inventory_movements (product_id, created_at DESC);
CREATE INDEX idx_insights_business    ON ai_insights (business_id, is_dismissed, priority DESC);
CREATE INDEX idx_alerts_business_unread ON alerts (business_id, is_read, created_at DESC);
CREATE INDEX idx_orders_business      ON orders (business_id, status, created_at DESC);
