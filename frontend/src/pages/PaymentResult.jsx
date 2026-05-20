import { useSearchParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function PaymentResult() {
  const [params] = useSearchParams()
  const status     = params.get('status') || detectStatus()
  const ref        = params.get('ref') || params.get('external_reference') || ''
  const paymentId  = params.get('payment_id') || ''
  const slug       = params.get('slug') || ''

  function detectStatus() {
    const path = window.location.pathname
    if (path.includes('success')) return 'approved'
    if (path.includes('failure')) return 'rejected'
    return 'pending'
  }

  const config = {
    approved: {
      icon: '✅', color: '#10b981', bg: '#d1fae5',
      title: '¡Pago exitoso!',
      msg: 'Tu pago fue procesado correctamente. Tu pedido está confirmado.',
    },
    rejected: {
      icon: '❌', color: '#ef4444', bg: '#fee2e2',
      title: 'Pago rechazado',
      msg: 'El pago no pudo procesarse. Intenta con otro método de pago.',
    },
    pending: {
      icon: '⏳', color: '#f59e0b', bg: '#fef3c7',
      title: 'Pago en proceso',
      msg: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
    },
  }

  const c = config[status] || config.pending

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc', fontFamily: 'Inter,system-ui,sans-serif', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '48px 40px',
        maxWidth: 440, width: '100%', textAlign: 'center',
        border: '1px solid #e2e8f0', boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', background: c.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, margin: '0 auto 24px',
        }}>{c.icon}</div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 12px' }}>{c.title}</h1>
        <p style={{ fontSize: 16, color: '#64748b', margin: '0 0 28px', lineHeight: 1.6 }}>{c.msg}</p>

        {(ref || paymentId) && (
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
            padding: '12px 16px', marginBottom: 28, fontSize: 13, color: '#64748b',
          }}>
            {ref && <div>Referencia: <strong style={{ color: '#0f172a' }}>{ref}</strong></div>}
            {paymentId && <div style={{ marginTop: 4 }}>ID de pago: <strong style={{ color: '#0f172a' }}>{paymentId}</strong></div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {slug ? (
            <Link to={`/tienda/${slug}`} style={{
              background: '#6366f1', color: '#fff', padding: '12px 24px',
              borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 15,
            }}>Volver a la tienda</Link>
          ) : (
            <Link to="/dashboard" style={{
              background: '#6366f1', color: '#fff', padding: '12px 24px',
              borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 15,
            }}>Ir al Dashboard</Link>
          )}
          <Link to={slug ? `/tienda/${slug}` : '/'} style={{
            background: 'transparent', color: '#6366f1', padding: '12px 24px',
            borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 15,
            border: '1.5px solid #6366f1',
          }}>{slug ? 'Seguir comprando' : 'Ir al inicio'}</Link>
        </div>
      </div>
    </div>
  )
}
