-- Texto de devoluciones impreso en el ticket de venta, configurable por
-- negocio (antes era un string fijo "NO SE ACEPTAN DEVOLUCIONES" igual
-- para todos). Nullable: el frontend aplica un default neutro cuando esta
-- vacio. Reversible con DROP COLUMN.

ALTER TABLE businesses ADD COLUMN ticket_refund_text VARCHAR(200);
