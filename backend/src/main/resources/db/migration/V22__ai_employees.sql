-- Empleados IA por negocio (Vendedor IA, Cobrador IA, Repositor IA...)
CREATE TABLE ai_employees (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id   UUID        NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
    employee_type VARCHAR(30) NOT NULL,
    enabled       BOOLEAN     NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (business_id, employee_type)
);

CREATE INDEX idx_ai_employees_business ON ai_employees (business_id);
