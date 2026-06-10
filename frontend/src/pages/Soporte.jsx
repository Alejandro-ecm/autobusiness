import './Soporte.css'

const WHATSAPP_NUMBER = '527225766423'
const WHATSAPP_DISPLAY = '+52 722 576 6423'
const TECH_NUMBER = '5217298050110'
const TECH_DISPLAY = '+52 1 729 805 0110'
const SUPPORT_EMAIL = 'yomu43e2@gmail.com'
const WA_MESSAGE = encodeURIComponent('Hola, necesito ayuda con AutoBusiness 👋')
const TECH_MESSAGE = encodeURIComponent('Hola, necesito soporte técnico de AutoBusiness 🛠️')

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M16.04 4C9.94 4 5 8.94 5 15.04c0 2.13.6 4.12 1.65 5.82L5 28l7.32-1.6a11 11 0 0 0 3.72.65h.01C22.14 27.05 27 22.1 27 16c0-6.1-4.94-11-10.96-11Zm0 20.1h-.01a9.1 9.1 0 0 1-4.64-1.27l-.33-.2-3.34.73.71-3.26-.22-.34a9.07 9.07 0 0 1-1.39-4.85c0-5.02 4.09-9.1 9.13-9.1 2.44 0 4.73.95 6.45 2.68a9.04 9.04 0 0 1 2.67 6.43c0 5.02-4.09 9.1-9.13 9.1Zm5-6.8c-.27-.14-1.62-.8-1.87-.89-.25-.09-.43-.14-.62.14-.18.27-.71.89-.87 1.07-.16.18-.32.2-.59.07-.27-.14-1.16-.43-2.2-1.36-.81-.72-1.36-1.62-1.52-1.89-.16-.27-.02-.42.12-.55.12-.12.27-.32.4-.48.14-.16.18-.27.27-.46.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.05-.22-.53-.45-.46-.62-.47l-.53-.01c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.3 0 1.36.98 2.66 1.12 2.85.14.18 1.94 2.96 4.7 4.15.66.28 1.17.45 1.57.58.66.21 1.26.18 1.74.11.53-.08 1.62-.66 1.85-1.3.23-.64.23-1.18.16-1.3-.07-.11-.25-.18-.52-.32Z"/>
    </svg>
  )
}

export default function Soporte() {
  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${WA_MESSAGE}`
  const techHref = `https://wa.me/${TECH_NUMBER}?text=${TECH_MESSAGE}`

  return (
    <div className="soporte-page">
      <div className="page-header">
        <h1 className="page-title">Soporte a usuario</h1>
        <p className="page-subtitle">¿Tienes dudas o algún problema? Estamos para ayudarte.</p>
      </div>

      <div className="soporte-grid">
        <div className="card soporte-card">
          <div className="soporte-card-icon">💬</div>
          <h3>Contáctame directamente</h3>
          <p>Escríbenos por WhatsApp y te responderemos lo antes posible. Atención personalizada para tu negocio.</p>
          <a className="soporte-wa-btn" href={waHref} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon />
            <span>Contáctame</span>
          </a>
          <div className="soporte-wa-num">{WHATSAPP_DISPLAY}</div>
        </div>

        <div className="card soporte-card">
          <div className="soporte-card-icon">🛠️</div>
          <h3>Soporte técnico</h3>
          <p>¿Algo no funciona o tienes un problema con el sistema? Escríbenos a la línea de soporte técnico y lo resolvemos.</p>
          <a className="soporte-wa-btn" href={techHref} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon />
            <span>Soporte técnico</span>
          </a>
          <div className="soporte-wa-num">{TECH_DISPLAY}</div>
        </div>

        <div className="card soporte-card">
          <div className="soporte-card-icon">📇</div>
          <h3>Información de contacto</h3>
          <ul className="soporte-info">
            <li>
              <span className="soporte-info-label">WhatsApp</span>
              <a href={waHref} target="_blank" rel="noopener noreferrer">{WHATSAPP_DISPLAY}</a>
            </li>
            <li>
              <span className="soporte-info-label">Soporte técnico (WhatsApp)</span>
              <a href={techHref} target="_blank" rel="noopener noreferrer">{TECH_DISPLAY}</a>
            </li>
            <li>
              <span className="soporte-info-label">Correo</span>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </li>
            <li>
              <span className="soporte-info-label">Horario</span>
              <span>Lunes a sábado · 9:00 a 20:00 hrs</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
