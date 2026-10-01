# Aviso de Privacidad — AutoBusiness AI

> ⚠️ **BORRADOR** — este documento debe revisarlo un abogado antes de
> publicarse como definitivo. No reemplaza asesoría legal profesional.
> Corresponde al contenido ya publicado en `/privacidad` (ver
> `frontend/src/pages/PrivacyPolicy.jsx`).

Responsable: **Sky Technologies Latam** [COMPLETAR: razón social, RFC,
domicilio fiscal y nombre/contacto del responsable formal del
tratamiento] · soporte@skytechnologieslatam.com

## 1. Quiénes somos

Sky Technologies Latam opera AutoBusiness AI, un sistema de gestión
comercial para PyMEs en México (web y app móvil Android).

## 2. Datos que recopilamos

- **Cuenta/negocio**: nombre del propietario, correo, contraseña
  (cifrada con bcrypt, nunca en texto plano), nombre del negocio y
  sucursales.
- **Operativos**: inventario y productos, ventas y transacciones del
  POS/tienda en línea, pedidos, datos de clientes registrados
  voluntariamente (nombre, teléfono, saldo fiado), movimientos de
  inventario.
- **Pago y suscripción**: procesados por MercadoPago — no se almacenan
  datos de tarjeta. Se guarda el plan activo e historial de pagos.
- **Cámara (app móvil)**: solo para escanear códigos de barras/QR y
  detección visual de productos en el POS; procesamiento en el
  dispositivo, no se almacena ni se envía a servidores externos; el
  acceso es opcional.
- **Técnicos**: IP (logs de servidor, seguridad/antifraude),
  identificador de dispositivo en la app móvil, eventos de uso anónimos.

## 3. Para qué usamos tus datos

Proveer y mejorar el servicio, autenticación y seguridad de la cuenta,
procesar pagos, generar reportes/análisis/insights automáticos, enviar
notificaciones del servicio, cumplir obligaciones legales. No se vende,
renta ni comercializa información personal con fines publicitarios.

## 4. Base legal

Conforme a la legislación mexicana de protección de datos personales en
posesión de particulares vigente [COMPLETAR: confirmar con el abogado la
referencia normativa exacta vigente al momento de publicar]: ejecución
del contrato de servicio, consentimiento, interés legítimo (seguridad y
antifraude) y obligación legal.

## 5. Multi-tenancy y aislamiento

Plataforma multi-tenant: cada negocio tiene un identificador único y sus
datos están separados de los de otros negocios; ningún usuario accede a
datos de otro negocio.

## 6. Terceros con quienes compartimos datos

| Proveedor | Propósito | Datos compartidos |
|---|---|---|
| MercadoPago | Procesamiento de pagos | Monto/descripción del cargo; no se comparten datos de tarjeta |
| [COMPLETAR: proveedor de hosting real en producción] | Infraestructura de servidores | Datos cifrados en tránsito |
| Google Play Store | Distribución de la app Android | Información de instalación/actualización |

## 7. Retención

Mientras la cuenta esté activa. Al eliminarla, los datos personales y
operativos se anonimizan en un plazo máximo de 30 días (ver política de
eliminación de cuentas). Algunos datos (ventas, movimientos de
inventario) se conservan anonimizados por obligaciones fiscales
[COMPLETAR: confirmar plazo legal exacto de conservación fiscal con el
abogado/contador].

## 8. Seguridad

TLS/HTTPS en tránsito, contraseñas con bcrypt, sesión JWT (expira a las
24h), control de acceso por rol (OWNER/ADMIN/CAJERO), base de datos no
expuesta públicamente. Ningún sistema es 100% seguro.

## 9. Derechos del titular (acceso, rectificación, cancelación,
oposición)

Para ejercerlos: soporte@skytechnologieslatam.com, asunto "Derechos
ARCO". Respuesta en un plazo de [COMPLETAR: confirmar plazo oficial —
hoy el código dice "20 días hábiles", debe validarse]. También se puede
eliminar la cuenta directamente desde `/account-deletion`.

## 10. Menores de edad

Servicio dirigido exclusivamente a mayores de 18 años. No se recopilan
datos de menores de forma intencional.

## 11. Cambios a este aviso

Se notificarán por correo y/o aviso en la app con al menos 15 días de
anticipación antes de entrar en vigor.

## 12. Contacto

soporte@skytechnologieslatam.com
