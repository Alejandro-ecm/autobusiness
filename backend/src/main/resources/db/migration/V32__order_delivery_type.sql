-- Distingue pedidos a domicilio de pedidos para recoger en tienda. Los
-- pedidos existentes se asumen como entrega (comportamiento previo).

ALTER TABLE orders ADD COLUMN delivery_type VARCHAR(20) NOT NULL DEFAULT 'delivery';
