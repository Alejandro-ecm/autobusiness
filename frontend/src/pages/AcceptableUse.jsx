import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { legal as legalApi } from '../api'

export default function AcceptableUse() {
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    legalApi.acceptableUse().then(setDoc).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '40px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link to="/" style={{ color: '#6366f1', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
          ← Volver al inicio
        </Link>
        <div style={{ background: '#fff', borderRadius: 16, padding: '40px 48px', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
          {loading ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>Cargando...</p>
          ) : doc ? (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{doc.title}</h1>
              <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 28 }}>Versión {doc.version}</p>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-line' }}>
                {doc.content}
              </div>
            </>
          ) : (
            <p style={{ color: '#64748b' }}>Documento no disponible</p>
          )}
        </div>
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 24 }}>
          © 2025 AutoBusiness AI · <a href="mailto:soporte@skytechnologieslatam.com" style={{ color: '#94a3b8' }}>soporte@skytechnologieslatam.com</a>
        </p>
      </div>
    </div>
  )
}
