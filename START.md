# AutoBusiness AI — Inicio rápido

## Requisitos
- Docker + Docker Compose
- Node.js 20+ (para desarrollo frontend)
- Java 17 + Maven (para desarrollo backend)

---

## Opción 1: Docker (recomendado)

```bash
docker-compose up -d
```

Acceder en:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080/api
- AI Engine: http://localhost:8001

Credenciales demo:
- Dueño: dueno@demo.com / demo1234
- Cajero: cajero@demo.com / demo1234

---

## Opción 2: Desarrollo local

### Base de datos
```bash
docker-compose up postgres -d
```

### Backend (Spring Boot)
```bash
cd backend
mvn spring-boot:run
```

### AI Engine (Python)
```bash
cd ai-engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
# Abre http://localhost:3000
```

---

## Tienda online pública

Cada negocio tiene una tienda pública en:
```
http://localhost:3000/tienda/{slug}
```
Ejemplo: http://localhost:3000/tienda/tienda-demo

---

## Estructura del proyecto

```
negociooo/
├── backend/          Spring Boot — API REST + JWT + PostgreSQL
├── ai-engine/        Python FastAPI — Business Brain
├── frontend/         React SPA — UI completa
└── docker-compose.yml
```

---

## API Endpoints principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /api/auth/login | Autenticación |
| POST | /api/auth/register | Registro de nuevo negocio |
| GET | /api/dashboard | Dashboard del dueño |
| GET | /api/pos/products | Buscar productos (POS) |
| POST | /api/pos/checkout | Registrar venta |
| GET | /api/inventory | Lista de inventario |
| POST | /api/inventory/products | Crear producto |
| GET | /api/orders | Pedidos online |
| GET | /api/alerts | Alertas del negocio |
| GET | /api/store/{slug} | Catálogo público |
| POST | /api/store/{slug}/orders | Crear pedido online |

### AI Engine
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /analyze/{id} | Análisis completo del negocio |
| GET | /insights/{id} | Obtener insights guardados |
| GET | /finance/{id} | Resumen financiero con simulaciones |
| POST | /marketing/{id}/generate | Generar posts de marketing |
