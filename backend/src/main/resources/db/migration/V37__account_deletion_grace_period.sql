-- Derechos ARCO (LFPDPPP 2025): la eliminacion de cuenta pasa de inmediata
-- a un periodo de gracia de 30 dias, tal como ya lo prometia AccountDeletion.jsx
-- (que hasta ahora era una promesa falsa — el borrado corria al instante).
-- Nullable: null = sin solicitud pendiente. Reversible con DROP COLUMN.

ALTER TABLE businesses ADD COLUMN deletion_requested_at TIMESTAMP;
