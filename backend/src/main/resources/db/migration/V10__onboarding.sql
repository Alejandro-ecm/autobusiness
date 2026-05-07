-- V10: onboarding wizard + business profile type
ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS profile_type          VARCHAR(50),
    ADD COLUMN IF NOT EXISTS onboarding_completed  BOOLEAN NOT NULL DEFAULT false;
