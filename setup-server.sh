#!/bin/bash
# Script de instalacion para Ubuntu 22.04
# Corre este script en el servidor: bash setup-server.sh

set -e

echo "==> Actualizando sistema..."
apt-get update -y && apt-get upgrade -y

echo "==> Instalando Docker..."
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

echo "==> Docker instalado: $(docker --version)"

echo "==> Configurando firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Listo. Ahora sube tu proyecto y corre:"
echo "    cd /opt/autobusiness"
echo "    docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build"
