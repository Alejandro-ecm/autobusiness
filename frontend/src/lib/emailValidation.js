// Dominios de email aceptados para registro
const ALLOWED_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'hotmail.es',
  'hotmail.com.mx',
  'hotmail.fr',
  'outlook.com',
  'outlook.es',
  'outlook.com.mx',
  'live.com',
  'live.com.mx',
]

/**
 * Valida que el email sea de un dominio permitido (Gmail / Hotmail / Outlook).
 * @returns {string|null} mensaje de error, o null si es válido
 */
export function validateEmailDomain(email) {
  if (!email || !email.includes('@')) return 'Ingresa un correo electrónico válido'
  const domain = email.trim().toLowerCase().split('@')[1]
  if (!ALLOWED_DOMAINS.includes(domain)) {
    return 'Solo se aceptan correos de Gmail (@gmail.com) o Hotmail/Outlook (@hotmail.com, @outlook.com)'
  }
  return null
}

export { ALLOWED_DOMAINS }
