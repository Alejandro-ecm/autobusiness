CREATE TABLE inventory_transfers (
    id                        UUID PRIMARY KEY,
    source_business_id        UUID NOT NULL REFERENCES businesses(id),
    destination_business_id   UUID NOT NULL REFERENCES businesses(id),
    source_product_id         UUID NOT NULL REFERENCES products(id),
    destination_product_id    UUID NOT NULL REFERENCES products(id),
    quantity                  NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
    status                    VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    notes                     VARCHAR(500),
    created_by                UUID REFERENCES users(id),
    destination_authorized_by UUID REFERENCES users(id),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_transfer_different_businesses
        CHECK (source_business_id <> destination_business_id)
);

CREATE INDEX idx_inventory_transfers_source
    ON inventory_transfers(source_business_id, created_at DESC);
CREATE INDEX idx_inventory_transfers_destination
    ON inventory_transfers(destination_business_id, created_at DESC);

