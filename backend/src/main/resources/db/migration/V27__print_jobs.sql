-- Cola de impresión en la nube: dispositivos sin impresora (iPhone) crean
-- trabajos y un dispositivo con impresora (PC bridge o estación Android)
-- los recoge y los imprime.

CREATE TABLE print_jobs (
    id          UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    payload     TEXT NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    printed_at  TIMESTAMPTZ
);

CREATE INDEX idx_print_jobs_pending
    ON print_jobs(business_id, status, created_at);

-- Llave secreta por negocio para que el PC bridge polle la cola sin JWT
ALTER TABLE businesses ADD COLUMN print_key UUID UNIQUE;
-- Última vez que un dispositivo de impresión pidió la cola (para saber si
-- hay "alguien" que va a imprimir antes de encolar)
ALTER TABLE businesses ADD COLUMN print_bridge_seen_at TIMESTAMPTZ;
