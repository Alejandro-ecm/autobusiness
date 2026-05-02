# AutoBusiness AI

Plataforma de gestión inteligente para PyMEs mexicanas.

---

## Inicio rápido

**Windows**
```
start.bat
```

**Linux / Mac**
```bash
chmod +x start.sh && ./start.sh
```

El script levanta Docker, espera que los 3 servicios estén listos y muestra las URLs.

---

## Credenciales demo

| Rol    | Email               | Password  |
|--------|---------------------|-----------|
| Dueño  | dueno@demo.com      | demo1234  |
| Cajero | cajero@demo.com     | demo1234  |

---

## URLs

| Servicio  | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:3000       |
| Backend   | http://localhost:8080/api   |
| AI Engine | http://localhost:8001       |
| Tienda demo | http://localhost:3000/tienda/tienda-demo |

---

## Estructura

```
├── backend/        Spring Boot 3.2, Java 17, PostgreSQL, JWT
├── ai-engine/      Python FastAPI — Business Brain
├── frontend/       React 18 + Vite
├── start.sh        Inicio Linux/Mac
├── start.bat       Inicio Windows
└── docker-compose.yml
```

---

## Módulos

| Módulo | Ruta frontend | Descripción |
|--------|--------------|-------------|
| Dashboard | /dashboard | Estado + 3 KPIs + 1 problema + 1 acción |
| POS | /pos | Cobrar en 1-2 clics |
| Inventario | /inventory | Stock en tiempo real |
| Pedidos | /orders | Órdenes de tienda online |
| Finanzas | /finance | Ingresos, costos, margen, simulador |
| Marketing | /marketing | Posts WhatsApp automáticos |
| Tienda | /tienda/:slug | Catálogo público + checkout |

---

## API principales

```
POST /api/auth/login          Autenticación
POST /api/auth/register       Nuevo negocio

GET  /api/dashboard           KPIs + insights + alertas
GET  /api/pos/products?q=     Buscar productos
POST /api/pos/checkout        Registrar venta

GET  /api/inventory           Lista inventario
POST /api/inventory/products  Crear producto

GET  /api/orders              Pedidos online
GET  /api/alerts              Alertas no leídas

GET  /api/store/:slug         Catálogo público
POST /api/store/:slug/orders  Hacer pedido
```

```
POST /analyze/:id             Análisis IA completo
GET  /top-insight/:id         Solo el problema #1
GET  /insights/:id            Todos los insights
GET  /finance/:id             Resumen financiero + simulador
POST /marketing/:id/generate  Generar posts WhatsApp
```

---

## Desarrollo local (sin Docker)

```bash
# 1. Solo DB
docker-compose up postgres -d

# 2. Backend
cd backend && mvn spring-boot:run

# 3. AI Engine
cd ai-engine && pip install -r requirements.txt && uvicorn main:app --reload --port 8001

# 4. Frontend
cd frontend && npm install && npm run dev
```
