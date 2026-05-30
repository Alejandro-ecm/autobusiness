-- Método de pago del pedido online (card | cash_on_delivery)
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) NOT NULL DEFAULT 'cash_on_delivery';

-- Vincula una venta con el pedido online que la originó (para idempotencia)
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS source_order_id UUID REFERENCES orders(id);

CREATE INDEX IF NOT EXISTS idx_sales_source_order ON sales(source_order_id);
