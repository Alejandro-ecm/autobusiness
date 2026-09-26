-- Idempotencia de ventas offline: el frontend genera un clientSaleId
-- (crypto.randomUUID()) al armar el cobro y lo reenvia identico en cada
-- reintento (ej. se corto la red a medio checkout). El indice unico por
-- negocio evita que un reintento cree una venta duplicada — nullable porque
-- las ventas de siempre (caja online normal, tarjeta, pedidos online) no
-- mandan este campo.

ALTER TABLE sales ADD COLUMN client_sale_id VARCHAR(64);

CREATE UNIQUE INDEX idx_sales_business_client_sale_id
    ON sales(business_id, client_sale_id)
    WHERE client_sale_id IS NOT NULL;
