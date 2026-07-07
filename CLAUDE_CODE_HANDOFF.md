# AutoBusiness AI - Handoff para Claude Code

Fecha: 2026-06-26

## Estado actual

Repo local:

`C:\Users\yomu4\OneDrive\Escritorio\AutoBussines AI`

Producción principal:

- Frontend oficial: `https://autobusiness.skytechnologieslatam.com`
- Login: `https://autobusiness.skytechnologieslatam.com/login`
- Panel usuarios: `https://autobusiness.skytechnologieslatam.com/users`
- Backend Railway: `https://autobusiness-production-ccbc.up.railway.app`
- Health backend: `https://autobusiness-production-ccbc.up.railway.app/api/health`

Credenciales demo:

- Dueño: `dueno@demo.com` / `demo123`
- Cajero: `cajero@demo.com` / `demo123`

## Deploy

Servicios correctos:

- Railway project: `AutoBussines`
- Railway environment: `production`
- Railway backend service: `autobusiness`
- Vercel project: `autobusiness`
- Vercel scope: `ale-s-projects89`
- Dominio final: `autobusiness.skytechnologieslatam.com`

Comandos usados para producción:

```powershell
railway up --service autobusiness --environment production --detach -y
vercel deploy --prod --yes --name autobusiness --scope ale-s-projects89
vercel alias set <VERCEL_DEPLOY_URL> autobusiness.skytechnologieslatam.com --scope ale-s-projects89
```

Importante: Railway puede mostrar como servicio enlazado `whatsapp-service`; no desplegar ahí el backend. Usar siempre `--service autobusiness`.

## Validación rápida

```powershell
Invoke-WebRequest -Uri 'https://autobusiness-production-ccbc.up.railway.app/api/health' -UseBasicParsing
Invoke-WebRequest -Uri 'https://autobusiness.skytechnologieslatam.com/login' -UseBasicParsing
```

Login API:

```powershell
$body = @{ email='dueno@demo.com'; password='demo123' } | ConvertTo-Json
Invoke-RestMethod -Uri 'https://autobusiness.skytechnologieslatam.com/api/auth/login' -Method Post -ContentType 'application/json' -Body $body
```

## Cambios recientes que deben preservarse

- Login con fondo nuevo en `frontend/public/login-bg-store.jpg`.
- `frontend/src/pages/Login.css` usa ese fondo y oculta las imágenes anteriores.
- `frontend/src/components/layout/AppLayout.css` deja el contenido interno en blanco, sin imagen/fondo borroso.
- `frontend/src/api/index.js` usa `fetch` para login/register y mantiene el resto con Axios.
- `frontend/src/pages/AccountDeletion.jsx` corrige un `style` duplicado.
- Panel `Usuarios`:
  - `frontend/src/pages/Users.jsx`
  - `frontend/src/pages/Users.css`
  - `frontend/src/api/index.js`
  - `backend/src/main/java/com/autobusiness/api/controller/UserController.java`
- Nuevos endpoints de usuarios:
  - `PATCH /api/users/{id}` para cambiar nombre/email.
  - `PATCH /api/users/{id}/password` para resetear contraseña. Si no se manda password, genera una segura.
- No se muestra contraseña anterior porque backend guarda hash, no texto plano.

## Estado local validado

- Backend local: `http://localhost:8080/api/health`
- Frontend local: `http://127.0.0.1:3001`
- Panel usuarios local: `http://127.0.0.1:3001/users`

## Antes de seguir trabajando

1. Revisar:

```powershell
git status --short
```

2. Leer:

- `AGENTS.md`
- `CLAUDE.md`
- `CLAUDE_CODE_HANDOFF.md`

3. Validar builds antes de producción:

```powershell
npm.cmd run build
docker-compose build backend
```

## Ojo con el worktree

Hay cambios acumulados además del panel de usuarios: inventario, finanzas, transferencias, contabilidad, nginx y capturas Android borradas. No descartarlos sin revisar con el usuario.

