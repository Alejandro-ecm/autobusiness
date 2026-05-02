-- Datos de demostración para desarrollo

-- Negocio
INSERT INTO businesses (id, name, slug, description, phone, email, plan)
VALUES ('00000000-0000-0000-0000-000000000001',
        'Tienda Demo',
        'tienda-demo',
        'Negocio de demostración',
        '+52 55 1234 5678',
        'demo@autobusiness.mx',
        'pro');

-- Sucursal principal
INSERT INTO branches (id, business_id, name, address, is_main)
VALUES ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'Sucursal Principal',
        'Av. Insurgentes 123, CDMX',
        true);

-- Segunda sucursal
INSERT INTO branches (id, business_id, name, address, is_main)
VALUES ('00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001',
        'Sucursal Norte',
        'Blvd. Norte 456, CDMX',
        false);

-- Usuario dueño
INSERT INTO users (id, business_id, email, password_hash, name, role)
VALUES ('00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000001',
        'dueno@demo.com',
        '$2a$10$xVNGGpQjvH2LX6YVWz5PEu8VoB2hL8RgC4bqNmKdFhWvT6y8OzrMK',
        'Carlos López',
        'OWNER');

-- Cajero
INSERT INTO users (id, business_id, branch_id, email, password_hash, name, role)
VALUES ('00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        'cajero@demo.com',
        '$2a$10$xVNGGpQjvH2LX6YVWz5PEu8VoB2hL8RgC4bqNmKdFhWvT6y8OzrMK',
        'Ana Martínez',
        'CASHIER');

-- Categorías
INSERT INTO categories (id, business_id, name, color) VALUES
('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', 'Bebidas', '#3b82f6'),
('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Snacks', '#f59e0b'),
('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Lácteos', '#10b981'),
('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Limpieza', '#8b5cf6');

-- Productos
INSERT INTO products (id, business_id, branch_id, category_id, sku, name, price, cost, stock, min_stock, is_online) VALUES
('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000100', 'BEB001', 'Coca-Cola 600ml', 18.00, 10.00, 48, 12, true),
('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000100', 'BEB002', 'Agua Bonafont 1L', 12.00, 6.00, 60, 15, true);