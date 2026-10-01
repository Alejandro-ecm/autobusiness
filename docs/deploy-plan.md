# Plan de despliegue — commits locales sin push

> Este documento es un **plan**, no una ejecución. Nada de lo descrito aquí
> se ha corrido. Requiere revisión y luz verde explícita antes de ejecutar
> cualquier paso contra producción.

## Resumen

- Rama local `main` tiene **35 commits** por delante de `origin/main`
  (confirmado con `git fetch origin` + `git rev-list --count
  origin/main..HEAD`). Solo los últimos 7 son de la sesión de hoy
  (compliance: mermas, Finanzas, smoke test, IP confiable, segmentación
  por giro de negocio, accesibilidad, borradores legales) — los otros 28
  ya estaban commiteados localmente de sesiones anteriores.
- **95 archivos**, +4772/−1252 líneas en total.
- **7 migraciones Flyway nuevas**: `V31` a `V37` (origin/main está en
  `V30`). Todas son aditivas (`CREATE TABLE`/`ADD COLUMN` — confirmado
  por sus nombres y por haber corrido `docker compose up` con ellas ya
  aplicadas localmente sin errores en toda la sesión). Ninguna hace
  `DROP`/`ALTER ... DROP COLUMN`/renombrado destructivo.
- **3 bloques de variables de entorno nuevas** en `application.yml` (ver
  sección de env vars abajo) — hay que confirmar en Railway si ya
  existen antes de este push.
- Backend compila y pasa sus tests (`mvn test`, 7/7 — `AuthServiceTest`,
  único archivo de test del backend). Frontend: smoke test de Playwright
  10/10 en cada fase de hoy. Nada de esto reemplaza probar contra la
  base de datos real de producción.

## ⚠️ Limitación real de "lotes separados" en un solo branch

Git no permite enviar a `origin/main` un subconjunto no-contiguo de
commits sin reescribir historia (rebase/cherry-pick). Los 35 commits ya
están en un único orden lineal, con commits de frontend y de backend
intercalados cronológicamente — **no se puede hacer "push del lote 1,
luego push del lote 2"** sin reordenar commits, lo cual es la operación
más riesgosa de todas (puede generar conflictos y reescribe historia que
ya podría estar referenciada en otro lado).

Por eso, los "lotes" de abajo son una **clasificación de riesgo para
decidir qué verificar primero y qué vigilar más de cerca después de un
único `git push`**, no 3 despliegues separados. Si de verdad se quieren 3
despliegues independientes (por ejemplo, para poder hacer rollback de
solo una parte), la única forma correcta es reordenar vía rebase
interactivo — **eso NO está incluido en este plan** y requeriría
aprobación explícita aparte, por el riesgo de romper la historia local.

## Precondición obligatoria — backup antes de tocar producción

```bash
# Desde donde se tenga acceso a DATABASE_URL de producción (Railway
# dashboard → servicio Postgres → Connect → copiar la URL):
pg_dump "$PROD_DATABASE_URL" -F c -f "autobusiness_backup_$(date +%Y%m%d_%H%M).dump"

# Conteo de control ANTES del deploy (guardar el resultado para comparar
# después — debe ser igual o mayor en cada tabla, nunca menor):
psql "$PROD_DATABASE_URL" -c "
SELECT 'businesses' t, count(*) FROM businesses
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'sales', count(*) FROM sales
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'legal_acceptances', count(*) FROM legal_acceptances;"
```

No usar `docker compose down -v` en ningún punto de este proceso — eso
borra el volumen de datos. Si en algún momento hay que reiniciar
contenedores en producción, usar `restart` o `up -d` (sin `-v`, sin
`down -v`).

## Topología real de producción (confirmado 2026-09-30)

- **Frontend**: Vercel. Dominio `autobusiness.skytechnologieslatam.com` →
  CNAME `cname.vercel-dns.com` (confirmado con `nslookup`). Vercel construye
  el sitio estático (`vercel.json` en la **raíz** del repo — es el que usa
  el proyecto, confirmado por `installCommand`/`outputDirectory` con
  prefijo `frontend/`, lo que solo tiene sentido si el Root Directory del
  proyecto Vercel es la raíz) y hace rewrite de `/api/:path*` hacia el
  backend de Railway. El navegador **nunca** llama directo a Railway: el
  cliente HTTP del frontend siempre pide la ruta relativa `/api`
  (`frontend/src/api/client.js`, `frontend/src/api/index.js`, etc. — ninguno
  fija `VITE_API_URL` a una URL absoluta).
- **Backend**: Railway, servicio `autobusiness`
  (`autobusiness-production-ccbc.up.railway.app`), con Flyway.
- El nginx del repo (`frontend/nginx.conf`, `nginx.railway.conf`) y
  `docker-compose.prod.yml` + `setup-server.sh` son una **ruta de
  despliegue alterna** (VPS self-hosted) — no corren dentro de Vercel y no
  sirven el dominio de producción actual. No confundirlos con el flujo real.
- **Mitigación de Preview Deployments (reemplaza el "riesgo aceptado"
  anterior)**: el rewrite en `vercel.json` es estático (no varía por
  environment), así que cualquier Preview Deployment (ej. al pushear una
  rama como `release/2026-10`) apuntaría al **mismo** backend de Railway de
  producción si no se hace nada — no existe un backend de staging. La
  mitigación elegida: fijar `VITE_API_URL` con scope **Preview únicamente**
  (ni Production ni Development) en un valor inválido/seguro (ej.
  `https://preview-disabled.invalid`), para que cualquier llamada desde un
  Preview Deployment falle limpiamente en vez de escribir contra datos
  reales. Es pura configuración del dashboard de Vercel, no toca código.
  Pasos (los ejecuta el dueño del proyecto en Vercel, no vía CLI/CI):
  1. Vercel → proyecto → **Settings → Environment Variables**.
  2. **Add New** → key `VITE_API_URL`, value `https://preview-disabled.invalid`,
     scope: marcar únicamente **Preview** (desmarcar Production y Development).
  3. Guardar y confirmar que no existe ya una `VITE_API_URL` en Production
     que choque (no debería — ver tabla de variables más abajo).
  4. Re-generar (redeploy) cualquier Preview Deployment existente para que
     tome la variable nueva.
  (Mejora futura, no bloqueante: usar `vercel.ts` con `deploymentEnv` para
  apuntar Preview a un backend de staging real, una vez que ese staging
  exista — más preciso que invalidar la URL, pero no es necesario hoy.)
- **Auto-deploy de Vercel sobre `main` — pendiente de confirmar en el
  dashboard** (no se puede ver desde el repo; CLI de Vercel no instalado en
  esta sesión). Dos escenarios:
  - Si el proyecto tiene Git auto-deploy conectado a `main` para
    Production: desconectarlo para Production antes de este deploy (dejar
    solo Preview automático en ramas no-`main`), o configurar un "Ignored
    Build Step" que valide la salud del backend antes de construir.
  - Si los deploys son 100% manuales vía CLI (lo que sugiere
    `CLAUDE_CODE_HANDOFF.md`: `vercel deploy --prod` + `vercel alias set`
    como flujo documentado): no hay riesgo de auto-deploy — el orden ya
    está bajo control manual, solo hay que respetar la secuencia de abajo.

## Variables de entorno nuevas a confirmar/agregar — por proveedor

**Railway (backend):**

| Variable | Requerida para | Si falta |
|---|---|---|
| `RESEND_API_KEY` | Recuperación de contraseña envía el correo real (commit `b2bca07`) | El endpoint responde pero el correo nunca sale — feature silenciosamente rota |
| `RESEND_FROM_EMAIL` | Mismo feature (tiene default razonable) | Usa el remitente genérico `onboarding@resend.dev` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Push notifications (commit `9a5dd37`) | **CRÍTICO si no se cambia**: el valor por default está escrito en el código fuente (`application.yml`, ya en GitHub) — usar el default en producción expone la llave privada públicamente. Generar un par nuevo antes de este deploy. |
| `ACCOUNT_DELETION_DRY_RUN` | Opcional — default `false`, no cambia el comportamiento ya activo hoy | No pasa nada si no se agrega |
| `DIAGNOSTICS_ENABLED` | Habilita temporalmente `GET /api/super-admin/diagnostics/request-info` (ver FASE 2 — IP confiable) para verificar la topología real de red en vivo | Sin ella el endpoint responde 403 siempre — default seguro, encender solo durante la verificación y apagar después |
| `RATE_LIMIT_ENABLED` | Activa el rate limit de `/auth/forgot-password` (5/15min por IP + 3/15min por email, `AuthController`/`RateLimiter`) | Sin ella el endpoint no limita nada (comportamiento actual) — default `false` a propósito: encender solo **después** de confirmar con `DIAGNOSTICS_ENABLED` que `request.getRemoteAddr()` resuelve IPs reales distintas por cliente, no la misma IP interna repetida |

**Vercel (frontend):**

| Variable | Requerida para | Si falta |
|---|---|---|
| `VITE_API_URL` (scope **Preview**) | Mitigación de Preview Deployments (ver "Topología real de producción" arriba) — valor inválido a propósito para que Preview no escriba contra el Railway de producción | Pendiente de que el usuario la configure en el dashboard; sin ella, Preview seguiría compartiendo el backend de producción |
| `VITE_*` en Production/Development | Ninguna fijada — el cliente usa rutas relativas `/api` | N/A |
| Llave **pública** de VAPID | Solo si en el futuro el frontend necesita `pushManager.subscribe()` en el navegador | No rompe nada hoy, push notifications son server-initiated |

Nunca poner la llave **privada** de VAPID ni `RESEND_API_KEY` en Vercel —
esas son del backend.

Acción previa al push: generar un par VAPID nuevo (`npx web-push
generate-vapid-keys` o la librería equivalente) y configurarlo en
Railway **antes** de desplegar este backend — si se despliega con el
default, hay que rotarlo de inmediato después.

## Lote 1 — Frontend de bajo riesgo (19 commits, sin tocar backend/)

UI, accesibilidad, PWA, rediseños visuales. No llaman a ningún endpoint
backend que no exista ya en `origin/main` (son cambios de presentación,
no de contrato API) — no verificado commit por commit de forma
exhaustiva, pero por su naturaleza (CSS, componentes visuales, Service
Worker) el riesgo de romper algo en el backend es prácticamente nulo.

```
b462cb0 docs(legal): borradores + banner BORRADOR faltante en 4 lugares
fcb96e1 feat(accesibilidad): contraste --color-primary, ConsentCheckbox, axe-core
806f1f2 feat(negocio): segmenta funciones de peso/kg por giro del negocio
98335f2 test: smoke test de la app real con Playwright
2d7decc fix(caja): cantidad de producto por pieza se puede teclear directo
b0c77ee compliance: quita testimonio y cifra sin respaldo en paginas publicas
bd496e3 compliance: accesibilidad — contraste .btn-primary, cierre Esc modales
ba97b21 compliance: footer con enlaces legales y datos del negocio
a070bc4 fix(responsive): tablas no quedan inalcanzables en pantallas angostas
8bbfa24 fix(sw): manifest.json y sw.js pasan a network-first
9656672 fix(pwa): desbloquea rotacion de pantalla en tablets
f557808 feat(caja): rediseno de alto impacto — hardware bar, badges, atajos F1-F3
1a52c14 feat(productos): ilustracion por emoji para frutas, verduras y carnes
ae9fa16 fix(ticket): ajusta el contenedor de la vista previa al nuevo ancho
c0a78ea style(ticket): rediseña el ticket impreso/reimpreso
6b43a0a fix(bascula): blinda el parser antes de confiar el peso a dinero cobrado
85168a5 feat(caja): lectura de bascula por USB/serial (Web Serial API)
c43d6b0 feat(caja): filtro por categoria visual en la parrilla de POS
4e492ef refactor(finanzas): fusiona Contabilidad dentro de Finance
```

**Verificación post-deploy (primero, apenas termine el deploy):**
smoke test (`cd frontend && node scripts/smoke.mjs` contra la URL de
producción vía `SMOKE_APP_URL`), luego revisar visualmente Caja (báscula,
atajos F1-F3), Inventario (emoji de productos), un ticket impreso.

## Lote 2 — Backend + migraciones (13 commits)

Features con cambios de esquema (V31-V37) o lógica de servidor nueva.
Verificar INMEDIATAMENTE después del deploy que Flyway corrió las 7
migraciones sin error (logs del backend al arrancar) antes de dar por
buena cualquier otra cosa.

```
9e4ae22 compliance: texto de devoluciones del ticket configurable (V36)
523e48b compliance: paginas legales + plantilla por tienda (V35)
4ecf838 compliance: consentimiento real en registro y checkout (V34)
b916a50 feat(pos): idempotencia en ventas offline via clientSaleId (V33)
3469e63 feat(ventas): muestra unidad de peso en tickets WEIGHT/MIXED
9a5dd37 feat(notificaciones): push notifications via VAPID web-push
2ee280b feat(tienda): opcion de recoger en tienda en checkout (V32)
101ec19 feat(dashboard): indicador de frescura del diagnostico de IA
7cbb43d feat(inventario): registro de mermas
4066ed6 fix(finanzas): la merma ahora resta de la utilidad bruta
91e16bc fix(caja): corte de caja y dashboard usan medianoche CDMX, no UTC
34dad30 fix(compliance): corrige bugs encontrados al cerrar FASE 2
2eec35d compliance: derechos ARCO — exportar datos, eliminacion con gracia (V37)
```

**Verificación post-deploy:** logs de arranque del backend (`Flyway:
Successfully applied 7 migrations`), `GET /api/health` y `/api/actuator/
health`, registrar una merma de prueba en un negocio de prueba (no en un
cliente real) y confirmar que Finanzas refleja el descuento, probar el
corte de caja a la hora real de México.

## Lote 3 — Alto riesgo, vigilar aparte (3 commits)

Tocan seguridad, autenticación o eliminación de datos — no son más
riesgosos técnicamente que el resto (ya probados en esta sesión), pero
el costo de un error es más alto, así que merecen verificación manual
explícita e inmediata después del deploy, antes de considerar el
despliegue "cerrado":

```
b2bca07 feat(auth): recuperacion de contrasena self-service via Resend (V31)
8cf9f55 fix(seguridad): la IP del cliente ya no se confia ciegamente de
        X-Forwarded-For/X-Real-IP
faec0a7 feat(seguridad): blinda el scheduler de eliminacion de cuentas y
        lo cubre con tests (dry-run, idempotencia)
```

**Verificación post-deploy:**
1. Probar "Olvidé mi contraseña" con un correo real de prueba — confirmar
   que el correo llega (depende de `RESEND_API_KEY` ya configurado).
2. Confirmar que `request.getRemoteAddr()` en producción resuelve la IP
   real del cliente y no una IP interna de Railway repetida en cada
   petición. Encender temporalmente `DIAGNOSTICS_ENABLED=true` en Railway y
   llamar `GET /api/super-admin/diagnostics/request-info` (token
   SUPER_ADMIN) desde dos redes reales distintas (ej. wifi + datos
   móviles): deben verse dos IPs públicas distintas en `remoteAddr`. Si en
   cambio ambas muestran la misma IP interna, hay que sobreescribir
   `server.tomcat.remoteip.internal-proxies` con el rango real observado en
   los headers crudos de la respuesta — no antes de confirmarlo así.
   Apagar `DIAGNOSTICS_ENABLED` después. También probar un login y revisar
   el campo `ip_address` en `legal_acceptances` tras aceptar términos.
3. **No forzar una ejecución real del scheduler de eliminación de cuentas
   en producción como prueba** — si se quiere verificar sin riesgo, usar
   `ACCOUNT_DELETION_DRY_RUN=true` temporalmente, revisar los logs al
   pasar las 3am, y quitarlo después.

## Comandos de despliegue

Orden obligatorio: **Railway (backend) primero, verificar, Vercel
(frontend) después** — nunca al revés, porque el frontend ya en producción
podría empezar a llamar endpoints/campos nuevos antes de que el backend los
tenga.

```bash
# 1. Confirmar que no hay nada sin commitear
git status --short   # debe salir vacío

# 2. Backup + conteo de control (ver sección de arriba) — HACERLO ANTES
#    del push, no después.

# 3. Push a main (dispara el deploy en Railway del backend si tiene
#    auto-deploy conectado; confirmar en el dashboard de Railway si el
#    servicio filtra por carpeta o redeploya siempre).
#    Si Vercel también tiene auto-deploy conectado a `main`, este mismo
#    push puede disparar el deploy del FRONTEND al instante — ver sección
#    "Topología real de producción" arriba sobre cómo evitarlo si aplica.
git push origin main

# 4. Verificar el backend en Railway ANTES de tocar el frontend:
curl https://autobusiness-production-ccbc.up.railway.app/api/health
curl https://autobusiness-production-ccbc.up.railway.app/api/actuator/health
#    y revisar en los logs de Railway que Flyway aplicó las 7 migraciones
#    sin error.

# 5. Solo si el backend verificó bien: desplegar/confirmar el frontend.
#    Si los deploys de Vercel son manuales (ver CLAUDE_CODE_HANDOFF.md):
vercel deploy --prod --yes --name autobusiness --scope ale-s-projects89
vercel alias set <VERCEL_DEPLOY_URL> autobusiness.skytechnologieslatam.com --scope ale-s-projects89

# 6. Smoke test contra producción (ajustar URLs reales)
cd frontend
SMOKE_APP_URL=https://autobusiness.skytechnologieslatam.com \
SMOKE_API_URL=https://autobusiness-production-ccbc.up.railway.app/api \
SMOKE_EMAIL=<usuario-de-prueba> SMOKE_PASSWORD=<pw> \
node scripts/smoke.mjs
```

## Rollback

- **Problema aislado a un commit identificable, el resto se queda:**
  `git revert <sha>` del commit problemático (crea un commit nuevo que
  deshace ese cambio, sin reescribir historia), luego `git push origin
  main` de nuevo. Si tocó una migración Flyway ya aplicada, el revert del
  código **no** revierte la migración — evaluar si hace falta una
  migración `V38` que deshaga el cambio de esquema, no editar las
  migraciones ya aplicadas.
- **Problema grave, hay que volver al estado anterior por completo:**
  en Railway, usar su función de "Redeploy" a la versión anterior del
  servicio (si está disponible) en vez de manipular git — es más rápido
  y no toca el historial. Si se necesita por git: `git revert` de todos
  los commits del lote problemático en orden inverso (nunca `reset
  --hard` + force-push sobre `main`, eso reescribe historia compartida).
- **Restaurar datos desde el backup** (último recurso, solo si hubo
  pérdida/corrupción real de datos, no por un bug de UI):
  `pg_restore -d "$PROD_DATABASE_URL" --clean autobusiness_backup_*.dump`
  — esto es destructivo y debe confirmarse explícitamente antes de
  correrlo, idealmente con la app en mantenimiento.

## Checklist final antes de ejecutar este plan (pendiente, no verificado
## en esta sesión)

- [ ] Confirmar en Railway cómo está configurado el auto-deploy desde
      `main` (un servicio o dos, filtra por carpeta o no).
- [ ] Confirmar en el dashboard de Vercel si el proyecto tiene Git
      auto-deploy conectado a `main` para Production (ver sección
      "Topología real de producción" arriba) — desconectarlo o usar un
      Ignored Build Step si aplica, para no desplegar el frontend antes de
      verificar el backend.
- [ ] Generar y configurar un par VAPID nuevo en producción (no usar el
      default que está en el repo).
- [ ] Confirmar que `RESEND_API_KEY` está configurado en Railway.
- [ ] Verificar con `GET /api/super-admin/diagnostics/request-info`
      (`DIAGNOSTICS_ENABLED=true` temporal) si
      `server.tomcat.remoteip.internal-proxies` necesita ajuste para la
      topología real Vercel → Railway.
      **Diferido explícitamente (no implementado esta sesión):** si el
      diagnóstico muestra que `X-Forwarded-For` no es confiable tal cual
      (ej. porque Railway ve la IP de salida de Vercel, no la del cliente
      final), la mitigación de "header secreto compartido" solo es posible
      reemplazando el rewrite estático de `/api` en `vercel.json` (raíz del
      repo) por una Vercel Function o Routing Middleware que inyecte el
      header antes de reenviar a Railway — un rewrite estático **no** puede
      añadir headers a un destino externo. Es un cambio de arquitectura del
      frontend, no solo backend; evaluar aparte una vez que el diagnóstico
      confirme si realmente hace falta.
- [ ] Backup + conteo de control ejecutado y guardado.
- [ ] Decidir si se quiere avisar a los clientes activos (incluida la
      papelería) antes de un despliegue de este tamaño, dado que incluye
      7 migraciones y cambios de seguridad.
