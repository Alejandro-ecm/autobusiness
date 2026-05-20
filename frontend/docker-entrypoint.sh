#!/bin/sh
set -e

# ── Railway / Render / producción: HTTP, puerto dinámico ──────────────────
# Detecta Railway (RAILWAY_ENVIRONMENT), Render (RENDER=true) o modo manual
if [ -n "$RAILWAY_ENVIRONMENT" ] || [ -n "$RENDER" ] || [ "$NGINX_MODE" = "railway" ]; then
  echo "[AutoBusiness] Modo producción — HTTP en puerto ${PORT:-80}"

  # Valores por defecto — BACKEND_URL apunta al backend en Render
  export PORT="${PORT:-80}"
  export BACKEND_URL="${BACKEND_URL:-https://autobusiness-backend.onrender.com}"

  # Sustituir variables en el template y escribir config activa
  envsubst '${PORT} ${BACKEND_URL}' \
    < /etc/nginx/templates/default.conf.template \
    > /etc/nginx/conf.d/default.conf

  exec "$@"
fi

# ── Local / dev: HTTPS con certificado autofirmado ────────────────────────
IP="${HOST_IP:-127.0.0.1}"
mkdir -p /etc/nginx/ssl

# Usar nginx.conf.local (con SSL)
cp /etc/nginx/conf.d/default.conf.local /etc/nginx/conf.d/default.conf

cat > /tmp/ssl.cnf << SSLEOF
[req]
distinguished_name = req_dn
x509_extensions    = v3_ca
prompt             = no

[req_dn]
C  = MX
O  = AutoBusiness
CN = $IP

[v3_ca]
basicConstraints       = CA:TRUE
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always,issuer
subjectAltName         = @alt_names
keyUsage               = digitalSignature, keyCertSign, cRLSign

[alt_names]
IP.1  = $IP
IP.2  = 127.0.0.1
DNS.1 = localhost
SSLEOF

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/server.key \
  -out    /etc/nginx/ssl/server.crt \
  -config /tmp/ssl.cnf \
  2>/dev/null

cp /etc/nginx/ssl/server.crt /usr/share/nginx/html/autobusiness-ca.crt

echo "[AutoBusiness] TLS listo — CN=$IP  SAN=IP:$IP"
exec "$@"
