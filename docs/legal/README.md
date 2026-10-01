# Documentos legales — borradores de referencia

Esta carpeta consolida, en un solo lugar y en Markdown, el contenido legal
que hoy vive repartido entre el código del frontend (`frontend/src/pages/
PrivacyPolicy.jsx`, `TermsOfService.jsx`, `AcceptableUse.jsx`,
`CookiePolicy.jsx`, `RefundPolicy.jsx`) y la tabla `legal_documents` del
backend. El propósito es tener una fuente única, legible y revisable por
un abogado — **no reemplaza ni modifica el contenido que ya está
publicado en la app**.

## Estado

**Todo en esta carpeta es BORRADOR.** Ningún documento aquí debe
considerarse definitivo ni usarse como prueba de cumplimiento legal sin
revisión de un abogado especializado en protección de datos y comercio
electrónico en México.

## Pendientes de confirmar antes de que cualquiera de estos documentos
## pueda considerarse definitivo (marcados `[COMPLETAR]` en el texto)

- **Razón social completa y RFC** de la entidad que opera AutoBusiness AI
  (hoy solo se usa el nombre comercial "Sky Technologies Latam" en todos
  los documentos, sin datos fiscales).
- **Domicilio fiscal / dirección física** para notificaciones legales —
  ningún documento vigente en la app lo incluye hoy.
- **Nombre y contacto del responsable formal del tratamiento de datos**
  (hoy solo se da un correo genérico de soporte, no una persona/área
  designada).
- **Plazo oficial de respuesta a solicitudes ARCO** — la app dice "20 días
  hábiles" en un lugar; confirmar que ese plazo es el correcto conforme a
  la legislación vigente al momento de publicar.
- **Proveedores de infraestructura reales en producción** — el texto vivo
  menciona "Render / Railway" y en otro documento "Vercel"; confirmar
  cuál(es) se usan realmente hoy para no declarar proveedores incorrectos.
- **Autoridad/mecanismo de protección de datos aplicable** — no se nombra
  ninguna autoridad específica en estos borradores a propósito; debe
  confirmarse con el abogado el marco vigente antes de publicar.

## Documentos

| Archivo | Corresponde a (ya publicado en la app) |
|---|---|
| `terminos-y-condiciones.md` | `/terms`, `/terminos` |
| `aviso-de-privacidad.md` | `/privacy-policy`, `/privacidad` |
| `politica-de-uso-aceptable.md` | `/acceptable-use` |
| `politica-de-cookies.md` | `/cookies` |
| `politica-de-reembolsos.md` | `/reembolsos` |

Nota: las páginas públicas ya muestran un aviso "⚠️ BORRADOR" visible a
los usuarios (componente `DraftBanner`, `frontend/src/components/legal/
LegalPageLayout.jsx`) — eso ya estaba hecho en `CookiePolicy.jsx` y
`RefundPolicy.jsx`; en esta misma fase se agregó también a
`PrivacyPolicy.jsx`, `TermsOfService.jsx`, `AcceptableUse.jsx` y a los
modales de aceptación legal en Register/Login, que no lo tenían.

No existe una "Política de Reembolsos" ni "Política de Privacidad" de la
Tienda Online aquí porque esas son específicas de cada negocio que usa
AutoBusiness AI (`StorePrivacyPolicy.jsx` / `StoreRefundPolicy.jsx`,
editables por cada dueño desde Tienda Online → Diseño) — no es contenido
que nosotros publiquemos como operador de la plataforma.
