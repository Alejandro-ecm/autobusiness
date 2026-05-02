#!/bin/bash
set -e

echo "🚀 AutoBusiness AI — Iniciando sistema..."
echo ""

# Levantar servicios
docker-compose up -d --build

# Esperar PostgreSQL
echo "⏳ Esperando base de datos..."
until docker-compose exec -T postgres pg_isready -U autobusiness > /dev/null 2>&1; do
  sleep 2
done
echo "  ✅ PostgreSQL listo"

# Esperar backend
echo "⏳ Esperando backend..."
until curl -sf http://localhost:8080/api/health > /dev/null 2>&1; do
  sleep 3
done
echo "  ✅ Backend listo"

# Esperar AI engine
echo "⏳ Esperando AI Engine..."
until curl -sf http://localhost:8001/health > /dev/null 2>&1; do
  sleep 2
done
echo "  ✅ AI Engine listo"

echo ""
echo "════════════════════════════════════════"
echo "  AutoBusiness AI — Sistema activo"
echo "════════════════════════════════════════"
echo "  Frontend  →  http://localhost:3000"
echo "  Backend   →  http://localhost:8080/api"
echo "  AI Engine →  http://localhost:8001"
echo ""
echo "  Demo: dueno@demo.com / demo1234"
echo "════════════════════════════════════════"
