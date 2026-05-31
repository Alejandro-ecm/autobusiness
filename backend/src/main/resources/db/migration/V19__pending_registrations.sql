CREATE TABLE pending_registrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name   VARCHAR(200)  NOT NULL,
    owner_name      VARCHAR(200)  NOT NULL,
    email           VARCHAR(255)  NOT NULL,
    password_hash   VARCHAR(255)  NOT NULL,
    plan            VARCHAR(20)   NOT NULL DEFAULT 'PRO',
    mp_preference_id VARCHAR(100),
    mp_external_ref  VARCHAR(100),
    paid            BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMP     NOT NULL
);

CREATE INDEX idx_pending_reg_email   ON pending_registrations(email);
CREATE INDEX idx_pending_reg_ext_ref ON pending_registrations(mp_external_ref);
