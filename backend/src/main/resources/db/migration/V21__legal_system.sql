-- Legal documents (versioned)
CREATE TABLE legal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(type, version)
);

-- Legal acceptances audit trail
CREATE TABLE legal_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    terms_version VARCHAR(20) NOT NULL,
    privacy_version VARCHAR(20) NOT NULL,
    acceptable_use_version VARCHAR(20) NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- General audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    metadata TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_legal_acceptances_user ON legal_acceptances(user_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_event ON audit_log(event_type);

-- Seed initial document versions
INSERT INTO legal_documents (type, version, title, content, published, published_at) VALUES
(
  'TERMS', '1.0',
  'Términos y Condiciones',
  $LEGAL$**TÉRMINOS Y CONDICIONES DE USO — AutoBusiness AI**
Versión 1.0 | Vigencia: Junio 2025

**1. ACEPTACIÓN**
Al crear una cuenta en AutoBusiness AI, el Usuario acepta íntegramente estos Términos. Si no está de acuerdo, no deberá usar el Servicio.

**2. DESCRIPCIÓN DEL SERVICIO**
AutoBusiness AI es una plataforma SaaS que proporciona herramientas tecnológicas para la gestión de micro y pequeñas empresas: punto de venta, inventario, tienda en línea, reportes y análisis con inteligencia artificial.

**3. CUENTAS Y ACCESO**
El Usuario es responsable de mantener la confidencialidad de sus credenciales. Debe notificar inmediatamente a soporte@skytechnologieslatam.com cualquier uso no autorizado de su cuenta.

**4. USO ACEPTABLE**
El Servicio debe utilizarse exclusivamente para actividades legales. El Usuario se compromete a no usarlo para vender productos ilegales, cometer fraude, enviar spam o violar derechos de terceros. El incumplimiento dará lugar a la suspensión inmediata de la cuenta.

**5. PAGOS Y SUSCRIPCIONES**
Los planes de pago son mensuales y se renuevan automáticamente. Los cargos son en pesos mexicanos (MXN) salvo indicación contraria. No se realizan reembolsos por períodos ya cobrados. El plan FREE es gratuito con las limitaciones indicadas.

**6. PROPIEDAD INTELECTUAL**
Todo el software, diseño, marcas y contenido de AutoBusiness AI son propiedad de Sky Technologies Latam. El Usuario conserva la propiedad de sus datos de negocio.

**7. PRIVACIDAD Y DATOS**
El tratamiento de datos personales se rige por la Política de Privacidad. El Usuario otorga a AutoBusiness AI una licencia para procesar sus datos operativos con el único fin de prestar el Servicio.

**8. LIMITACIÓN DE RESPONSABILIDAD**
AutoBusiness AI no garantiza disponibilidad ininterrumpida del Servicio. En ningún caso la responsabilidad total excederá el monto pagado por el Usuario en los últimos 3 meses.

**9. SUSPENSIÓN Y CANCELACIÓN**
AutoBusiness AI puede suspender cuentas que incumplan estas condiciones. El Usuario puede cancelar en cualquier momento desde su panel de control.

**10. MODIFICACIONES**
Estos Términos pueden actualizarse. Se notificará al Usuario con 15 días de anticipación. El uso continuado del Servicio constituirá aceptación de los nuevos términos.

**11. LEY APLICABLE**
Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia se someterá a los tribunales competentes de la Ciudad de México.

**Contacto:** soporte@skytechnologieslatam.com$LEGAL$,
  true, NOW()
),
(
  'PRIVACY', '1.0',
  'Política de Privacidad',
  $LEGAL$**POLÍTICA DE PRIVACIDAD — AutoBusiness AI**
Versión 1.0 | Vigencia: Junio 2025

Responsable: Sky Technologies Latam | soporte@skytechnologieslatam.com

**1. DATOS QUE RECOPILAMOS**
• Datos de identificación: nombre, correo electrónico, contraseña cifrada.
• Datos del negocio: nombre comercial, productos, ventas, inventario.
• Datos técnicos: dirección IP, user-agent, registros de acceso.
• Datos de pago: procesados exclusivamente por MercadoPago; no almacenamos datos de tarjetas.

**2. FINALIDAD DEL TRATAMIENTO**
• Prestar y mejorar el Servicio.
• Enviar comunicaciones relacionadas con la cuenta (no publicidad sin consentimiento).
• Cumplir obligaciones legales y fiscales.
• Prevenir fraude y garantizar la seguridad de la plataforma.

**3. FUNDAMENTO LEGAL**
El tratamiento se basa en la ejecución del contrato de servicio y, en su caso, en el consentimiento del Usuario conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP).

**4. CONSERVACIÓN DE DATOS**
Los datos se conservan durante la vigencia de la cuenta y hasta 5 años después de su cancelación, salvo que la ley exija un plazo mayor.

**5. TRANSFERENCIA DE DATOS**
Los datos no se venden a terceros. Pueden compartirse con: proveedores de infraestructura (Railway, Vercel), procesadores de pago (MercadoPago) y autoridades cuando sea legalmente requerido.

**6. DERECHOS ARCO**
El Usuario puede ejercer sus derechos de Acceso, Rectificación, Cancelación y Oposición enviando un correo a soporte@skytechnologieslatam.com con asunto "ARCO" desde su email registrado.

**7. COOKIES Y TECNOLOGÍAS SIMILARES**
Usamos almacenamiento local del navegador para mantener la sesión. No usamos cookies de rastreo publicitario.

**8. SEGURIDAD**
Implementamos cifrado TLS, contraseñas con hash bcrypt, y acceso con control de roles. No obstante, ningún sistema es 100% seguro.

**9. MENORES DE EDAD**
El Servicio no está dirigido a menores de 18 años. No recopilamos datos de menores conscientemente.

**10. CAMBIOS A ESTA POLÍTICA**
Notificaremos cualquier cambio material con 15 días de anticipación por correo electrónico.

**Contacto ARCO:** soporte@skytechnologieslatam.com$LEGAL$,
  true, NOW()
),
(
  'ACCEPTABLE_USE', '1.0',
  'Política de Uso Aceptable',
  $LEGAL$**POLÍTICA DE USO ACEPTABLE — AutoBusiness AI**
Versión 1.0 | Vigencia: Junio 2025

**1. PROPÓSITO**
Esta política define qué usos de AutoBusiness AI están permitidos y cuáles están prohibidos, con el fin de proteger a todos los usuarios y garantizar un entorno seguro y legal.

**2. USOS PERMITIDOS**
• Gestión de inventario, ventas y finanzas de negocios legalmente constituidos.
• Venta de productos y servicios legales conforme a las leyes mexicanas.
• Emisión de reportes, análisis y diagnósticos para la toma de decisiones del negocio.
• Operación de una tienda en línea para productos propios legítimos.

**3. USOS PROHIBIDOS**
Queda expresamente prohibido usar AutoBusiness AI para:
• Vender productos controlados, ilegales, falsificados o que infrinjan derechos de propiedad intelectual.
• Realizar actividades de lavado de dinero, fraude o evasión fiscal.
• Enviar comunicaciones masivas no solicitadas (spam).
• Suplantar la identidad de personas o empresas.
• Almacenar o distribuir contenido que incite a la violencia, pornografía o discriminación.
• Realizar ataques informáticos o intentos de vulnerar la seguridad del sistema.
• Revender o sublicenciar el acceso a la plataforma sin autorización escrita.
• Usar el Servicio para competir directamente con AutoBusiness AI.

**4. RESPONSABILIDAD DEL USUARIO**
El Usuario es el único responsable del contenido que carga, los productos que vende y las transacciones que realiza a través de la plataforma. AutoBusiness AI actúa únicamente como proveedor de herramientas tecnológicas.

**5. DECLARACIÓN OBLIGATORIA**
Al aceptar esta política, el Usuario declara que utilizará AutoBusiness AI únicamente para actividades legales y que es responsable de los productos, servicios, contenido y operaciones realizadas mediante su cuenta.

**6. CONSECUENCIAS DEL INCUMPLIMIENTO**
El incumplimiento de esta política puede resultar en:
• Suspensión temporal o permanente de la cuenta sin reembolso.
• Reporte a las autoridades competentes.
• Acciones legales civiles y/o penales.

**7. REPORTE DE ABUSOS**
Para reportar un uso indebido de la plataforma: soporte@skytechnologieslatam.com con asunto "REPORTE DE ABUSO".

**8. VIGENCIA Y ACTUALIZACIONES**
Esta política puede actualizarse. Los cambios se notificarán con 15 días de anticipación.

**Contacto:** soporte@skytechnologieslatam.com$LEGAL$,
  true, NOW()
);
