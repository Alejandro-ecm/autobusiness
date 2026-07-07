ALTER TABLE inventory_transfers
    ADD COLUMN unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN total_retail_value NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE INDEX idx_inventory_transfers_created_at
    ON inventory_transfers(created_at DESC);
