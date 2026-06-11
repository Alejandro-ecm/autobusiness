-- Cobrador IA: fecha del último recordatorio de pago enviado a cada cliente
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cobrador_reminded_at TIMESTAMPTZ;
