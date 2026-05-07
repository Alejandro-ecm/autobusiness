-- V13: negocios existentes ya tienen datos — marcar onboarding como completado
-- Solo afecta negocios que tienen productos o ventas (negocios reales en uso)
UPDATE businesses
SET onboarding_completed = true
WHERE onboarding_completed = false
  AND (
    id IN (SELECT DISTINCT business_id FROM products)
    OR id IN (SELECT DISTINCT business_id FROM sales)
    OR id IN (SELECT DISTINCT business_id FROM users WHERE role = 'OWNER')
  );
