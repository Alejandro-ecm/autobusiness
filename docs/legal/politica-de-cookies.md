# Política de Cookies — AutoBusiness AI

> ⚠️ **BORRADOR** — este documento debe revisarlo un abogado antes de
> publicarse como definitivo. No reemplaza asesoría legal profesional.
> Corresponde al contenido ya publicado en `/cookies` (ver
> `frontend/src/pages/CookiePolicy.jsx`).

## 1. No usamos cookies de rastreo

AutoBusiness AI no usa cookies de rastreo, analítica de terceros ni
publicidad (sin Google Analytics, Meta Pixel, Hotjar, etc.). Todo lo que
se guarda en el navegador es necesario para que la aplicación funcione,
y se guarda con `localStorage`, no con cookies tradicionales.

## 2. Datos guardados en el navegador (localStorage)

| Clave | Para qué sirve | Tipo |
|---|---|---|
| `ab_token` | Sesión iniciada (token de acceso) | Necesaria |
| `ab_user` | Datos de usuario, para no repetir carga en cada pantalla | Necesaria |
| `ab_offline_sales` | Ventas del POS hechas sin internet, pendientes de sincronizar | Necesaria (funcional) |
| `multi_accounts` | Cambio rápido entre varias cuentas/negocios en el mismo navegador | Preferencia |
| `sidebar_collapsed` | Recordar si el menú lateral está expandido | Preferencia |
| `mkt_history` | Historial de publicaciones de marketing generadas | Funcional |
| `checkout_pending_ref` | Referencia de un pago de suscripción en curso | Necesaria |
| Configuración de báscula | Ajustes de la báscula conectada al POS | Funcional |

Ninguno de estos datos se comparte con terceros ni se usa para
publicidad. Se pueden borrar en cualquier momento desde la configuración
del navegador — algunos (como `ab_token`) simplemente cerrarán la sesión.

## 3. Banner de consentimiento

Como no se usan cookies de analítica ni marketing, no se muestra un
banner de "Aceptar cookies" — no hay nada opcional que aceptar o
rechazar. Si en el futuro se agrega un servicio de ese tipo, esta página
se actualizará y se agregará el banner correspondiente antes de
activarlo.

## 4. Contacto

soporte@skytechnologieslatam.com
