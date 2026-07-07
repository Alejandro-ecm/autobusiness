# AutoBusiness AI — Guía para IA

## Qué es este proyecto

SaaS **multi-tenant** para gestión de PyMEs en México. Permite a negocios manejar
inventario, punto de venta (POS), tienda online, dashboard de ventas y recibir
diagnósticos automáticos de negocio generados por un motor de IA local (sin LLM externo).

---

## Arquitectura de servicios

```
negociooo/
├── backend/        Spring Boot 3.2 + Java 17 — API REST + JWT
├── ai-engine/      Python 3.11 + FastAPI — motor de análisis de negocio
├── frontend/       React 18 + Vite — dashboard web
└── docker-compose.yml
```

| Servicio   | Puerto | Tecnología               |
|------------|--------|--------------------------|
| backend    | 8080   | Spring Boot 3.2, Java 17 |
| ai-engine  | 8001   | FastAPI, asyncpg         |
| frontend   | 3000   | React 18, Vite           |
| postgres   | 5432   | PostgreSQL 15            |

---

## Cómo correr el proyecto

### Opción 1 — Docker Compose (recomendado)
```bash
cd C:\Users\yomu4\OneDrive\Escritorio\negociooo
docker-compose up --build
```
Levanta los 4 servicios. El backend tarda ~60s (espera a Postgres + build Maven).

### Opción 2 — Solo backend local (requiere Postgres corriendo)
```bash
cd backend
mvn spring-boot:run
```

### Opción 3 — Solo AI Engine local
```bash
cd ai-engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

---

## Variables de entorno clave

| Variable                 | Default                                         | Usado en     |
|--------------------------|-------------------------------------------------|--------------|
| `SPRING_DATASOURCE_URL`  | `jdbc:postgresql://localhost:5432/autobusiness` | backend      |
| `SPRING_DATASOURCE_USERNAME` | `autobusiness`                              | backend      |
| `SPRING_DATASOURCE_PASSWORD` | `autobusiness_secret`                       | backend      |
| `JWT_SECRET`             | `autobusiness_jwt_super_secret_key_2024_development` | backend |
| `AI_ENGINE_URL`          | `http://localhost:8001`                         | backend      |
| `DATABASE_URL`           | `postgresql://autobusiness:autobusiness_secret@localhost:5432/autobusiness` | ai-engine |

---

## Context path del backend

**CRÍTICO:** El backend tiene `server.servlet.context-path: /api`

Todos los endpoints llevan el prefijo `/api`:
- Login → `POST http://localhost:8080/api/auth/login`
- Health → `GET  http://localhost:8080/api/health`
- Actuator → `GET  http://localhost:8080/api/actuator/health`

Spring Security recibe la ruta SIN el context path (ya lo stripea).
Los `requestMatchers` en `SecurityConfig` usan rutas relativas como `/auth/**`.

---

## Endpoints del backend (`/api/...`)

### Públicos (sin token)
| Método | Ruta                         | Descripción              |
|--------|------------------------------|--------------------------|
| POST   | `/api/auth/login`            | Login → devuelve JWT     |
| POST   | `/api/auth/register`         | Registro de nuevo negocio|
| GET    | `/api/health`                | Health check personalizado |
| GET    | `/api/actuator/health`       | Spring Actuator health   |
| GET    | `/api/actuator/info`         | Info de la app           |
| GET    | `/api/actuator/metrics`      | Métricas                 |
| GET    | `/api/store/{slug}`          | Catálogo tienda online   |
| POST   | `/api/store/{slug}/orders`   | Hacer pedido online      |

### Protegidos (requieren `Authorization: Bearer <token>`)
| Método | Ruta                              | Roles         |
|--------|-----------------------------------|---------------|
| GET    | `/api/dashboard`                  | todos         |
| GET    | `/api/dashboard/branches`         | todos         |
| GET    | `/api/inventory`                  | todos         |
| GET    | `/api/inventory/low-stock`        | todos         |
| POST   | `/api/inventory/products`         | OWNER, ADMIN  |
| PUT    | `/api/inventory/products/{id}`    | OWNER, ADMIN  |
| PATCH  | `/api/inventory/products/{id}/stock` | OWNER, ADMIN |
| GET    | `/api/pos/products`               | todos         |
| POST   | `/api/pos/checkout`               | todos         |
| GET    | `/api/orders`                     | todos         |
| PATCH  | `/api/orders/{id}/status`         | todos         |
| GET    | `/api/alerts`                     | todos         |
| PATCH  | `/api/alerts/{id}/read`           | todos         |

---

## Endpoints del AI Engine (puerto 8001)

| Método | Ruta                              | Descripción                          |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/health`                         | Health del engine                    |
| POST   | `/analyze/{business_id}`          | Análisis completo → persiste insights|
| GET    | `/insights/{business_id}`         | Todos los insights activos           |
| GET    | `/top-insight/{business_id}`      | El insight #1 más prioritario        |
| GET    | `/finance/{business_id}`          | Resumen financiero 30 días           |
| POST   | `/marketing/{business_id}/generate` | Genera posts de WhatsApp           |

---

## Autenticación JWT

- Header: `Authorization: Bearer <token>`
- Claims del token: `sub` (userId UUID), `email`, `role`, `businessId` (UUID)
- Roles: `OWNER`, `ADMIN`, `CASHIER`
- Expiración: 24 horas (`jwt.expiration=86400000`)
- El filtro `JwtAuthFilter` crea un `AuthPrincipal` record accesible via `@AuthenticationPrincipal`

### Cómo obtener token (curl)
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"dueno@demo.com\",\"password\":\"demo123\"}"
```

### Usuario demo (seed V2)
- **Owner:** `dueno@demo.com` / `demo123`
- **Cajero:** `cajero@demo.com` / `demo123`
- **Business ID demo:** `00000000-0000-0000-0000-000000000001`
- **Branch ID demo:** `00000000-0000-0000-0000-000000000002`

---

## Base de datos — Tablas principales

| Tabla                  | Propósito                                    |
|------------------------|----------------------------------------------|
| `businesses`           | Tenants raíz — cada negocio es un tenant     |
| `branches`             | Sucursales de cada negocio                   |
| `users`                | Usuarios con roles OWNER/ADMIN/CASHIER       |
| `products`             | Inventario, precio, costo, stock             |
| `categories`           | Categorías de productos                      |
| `sales`                | Ventas del POS y online                      |
| `sale_items`           | Ítems por venta                              |
| `orders`               | Pedidos de tienda online                     |
| `order_items`          | Ítems por pedido                             |
| `inventory_movements`  | Historial de ajustes de inventario           |
| `transactions`         | Ingresos/egresos financieros                 |
| `ai_insights`          | Insights generados por el motor IA           |
| `alerts`               | Alertas del sistema (stock bajo, etc.)       |
| `marketing_posts`      | Posts de WhatsApp/redes generados por IA     |

**Multi-tenancy:** todas las tablas tienen `business_id UUID NOT NULL` como discriminador.
Los servicios siempre filtran por `principal.businessId()` — nunca exponen datos cross-tenant.

---

## Estructura del código Java

```
com.autobusiness/
├── api/
│   ├── GlobalExceptionHandler.java   # Manejo centralizado de errores
│   └── controller/
│       ├── AuthController.java       # POST /auth/login, /auth/register
│       ├── HealthController.java     # GET /health
│       ├── DashboardController.java  # GET /dashboard
│       ├── InventoryController.java  # CRUD /inventory
│       ├── PosController.java        # GET /pos/products, POST /pos/checkout
│       ├── OnlineStoreController.java# /store/** y /orders
│       └── AlertController.java      # GET/PATCH /alerts
├── config/
│   ├── SecurityConfig.java           # Spring Security + JWT filter chain
│   ├── JwtAuthFilter.java            # OncePerRequestFilter — valida Bearer token
│   └── JwtUtil.java                  # generate/parse/isValid del JWT
├── domain/
│   ├── model/                        # Entidades JPA
│   ├── repository/                   # Spring Data JPA repositories
│   └── service/                      # Lógica de negocio
│       ├── AuthService.java
│       ├── DashboardService.java
│       ├── InventoryService.java
│       ├── OnlineStoreService.java
│       └── PosService.java
├── events/
│   ├── SaleCreatedEvent.java
│   ├── AlertCreatedEvent.java
│   ├── EventPublisher.java
│   └── SaleEventListener.java        # Listener → crea alertas de stock bajo
└── infrastructure/
    └── AiEngineClient.java           # WebClient → llama a http://ai-engine:8001
```

---

## Dependencias principales (pom.xml)

```xml
spring-boot-starter-web
spring-boot-starter-data-jpa
spring-boot-starter-security
spring-boot-starter-actuator        <!-- health, metrics, info -->
spring-boot-starter-validation
spring-boot-starter-webflux         <!-- WebClient para llamar al AI Engine -->
postgresql (runtime)
flyway-core                         <!-- migraciones V1, V2 -->
jjwt-api / jjwt-impl / jjwt-jackson (0.12.3)
lombok
```

---

## Reglas de seguridad en SecurityConfig

```java
// Públicos (sin autenticación)
"/auth/**"      → login, register
"/store/**"     → tienda online pública
"/health"       → health check custom
"/actuator/**"  → Spring Actuator

// Con rol
"/admin/**"     → solo OWNER o ADMIN

// Todo lo demás → requiere Bearer token válido
```

---

## Migraciones Flyway

- `V1__init_schema.sql` — crea todas las tablas e índices
- `V2__seed_data.sql` — datos demo (1 negocio, 2 sucursales, 2 usuarios, categorías, 2 productos)
- Flyway corre automáticamente al iniciar. `baseline-on-migrate: true`.
- Nuevas migraciones: crear `V3__descripcion.sql` en `src/main/resources/db/migration/`

---

## Motor de IA (ai-engine/brain/business_brain.py)

Análisis 100% local, sin LLMs externos. Consulta directamente PostgreSQL via asyncpg.

### Análisis que genera:
| Tipo             | Estado | Trigger                                    |
|------------------|--------|--------------------------------------------|
| `REVENUE_DROP`   | RED    | Ventas bajaron >20% vs semana anterior     |
| `REVENUE_UP`     | GREEN  | Ventas subieron >15% vs semana anterior    |
| `OUT_OF_STOCK`   | RED    | Productos con stock = 0                    |
| `STOCK_LOW`      | YELLOW | Productos con stock <= min_stock           |
| `LOW_MARGIN`     | YELLOW | Productos con margen < 20%                 |
| `SLOW_MOVING`    | YELLOW | Productos con <3 unidades vendidas en 30d  |

Cada insight tiene: `type`, `status`, `title`, `diagnosis`, `cause`, `action`, `impact`, `impactAmount`, `priority`.

---

## Manejo de errores (GlobalExceptionHandler)

| Excepción                      | HTTP | Respuesta                                    |
|--------------------------------|------|----------------------------------------------|
| `NoResourceFoundException`     | 404  | `{"error": "Endpoint not found: /ruta"}`     |
| `MethodArgumentNotValidException` | 400 | `{"error": "campo: mensaje de validación"}` |
| `IllegalArgumentException`     | 400  | `{"error": "mensaje"}`                       |
| `IllegalStateException`        | 409  | `{"error": "mensaje"}`                       |
| `AccessDeniedException`        | 403  | `{"error": "No tienes permiso..."}`          |
| `Exception` (catch-all)        | 500  | `{"error": "Error interno — intenta de nuevo"}` |

Todas las respuestas incluyen `"timestamp": "ISO-8601"`.

---

## Comandos de prueba rápida

```bash
# Health custom
curl http://localhost:8080/api/health

# Actuator
curl http://localhost:8080/api/actuator/health
curl http://localhost:8080/api/actuator/info

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"dueno@demo.com\",\"password\":\"demo123\"}"

# Tienda pública
curl http://localhost:8080/api/store/tienda-demo

# AI Engine
curl http://localhost:8001/health
curl -X POST http://localhost:8001/analyze/00000000-0000-0000-0000-000000000001
curl http://localhost:8001/insights/00000000-0000-0000-0000-000000000001
```

---

## Problemas conocidos / notas

- La contraseña `demo123` en V2 seed usa bcrypt hash `$2a$10$xVNGGpQjvH2LX6...`. Si el login falla, el hash puede no corresponder a `demo123` — regenerar con `BCryptPasswordEncoder`.
- El AI Engine **no usa LLM externo** — todo el análisis es SQL + reglas de negocio en Python.
- `AiEngineClient.java` (WebFlux) llama al AI Engine desde el backend. Si el AI Engine no está corriendo, el backend sigue funcionando pero los análisis fallan silenciosamente.
- El evento `SaleCreatedEvent` dispara `SaleEventListener` que verifica stock bajo y crea alertas automáticamente después de cada venta.
- `jpa.hibernate.ddl-auto: validate` — Hibernate solo valida el schema contra las entidades, NO lo crea. Flyway es el único que crea/modifica tablas.
