import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const BASE = import.meta.env.VITE_API_URL || '/api'

const DEFAULT_LOGO = '/skymarket-logo.jpg'

export default function Marketplace() {
  const [stores, setStores]   = useState([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${BASE}/marketplace/stores`)
      .then(r => r.json())
      .then(setStores)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = stores.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg,#0f172a,#1e293b)',
        padding: '0 20px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 0 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: '#6366f1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 14, color: '#fff'
              }}>AB</div>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>AutoBusiness</span>
            </div>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: 'rgba(99,102,241,.2)', border: '1px solid rgba(99,102,241,.4)',
                color: '#818cf8', borderRadius: 8, padding: '7px 16px',
                cursor: 'pointer', fontWeight: 600, fontSize: 13
              }}>
              Iniciar sesión
            </button>
          </div>

          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginBottom: 8, margin: '0 0 8px' }}>
            🛍️ Tiendas en línea
          </h1>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 15, margin: '0 0 24px' }}>
            Descubre y compra en negocios locales de México
          </p>

          {/* Buscador */}
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 18, pointerEvents: 'none'
            }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Busca una tienda por nombre o producto..."
              style={{
                width: '100%', padding: '14px 14px 14px 44px',
                borderRadius: 12, border: 'none', fontSize: 15,
                background: 'rgba(255,255,255,.1)', color: '#fff',
                outline: 'none', boxSizing: 'border-box',
                backdropFilter: 'blur(8px)',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{
              width: 40, height: 40, border: '3px solid #e2e8f0',
              borderTopColor: '#6366f1', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'
            }} />
            <p style={{ color: '#94a3b8' }}>Cargando tiendas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🏪</div>
            <p style={{ color: '#64748b', fontSize: 16, fontWeight: 600 }}>
              {search ? `No encontramos tiendas con "${search}"` : 'Aún no hay tiendas registradas'}
            </p>
            {search && (
              <button onClick={() => setSearch('')}
                style={{ marginTop: 12, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
                Ver todas las tiendas
              </button>
            )}
          </div>
        ) : (
          <>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              {filtered.length} {filtered.length === 1 ? 'tienda encontrada' : 'tiendas encontradas'}
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 20
            }}>
              {filtered.map(store => (
                <StoreCard key={store.slug} store={store} />
              ))}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 60, paddingTop: 32, borderTop: '1px solid #e2e8f0' }}>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>
            ¿Tienes un negocio? {' '}
            <span
              onClick={() => navigate('/register')}
              style={{ color: '#6366f1', cursor: 'pointer', fontWeight: 600 }}>
              Abre tu tienda gratis
            </span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

function StoreCard({ store }) {
  const navigate = useNavigate()
  const [imgError, setImgError] = useState(false)

  return (
    <div
      onClick={() => navigate(`/tienda/${store.slug}`)}
      style={{
        background: '#fff', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,.06)',
        cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
        border: '1px solid #f1f5f9',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.12)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.06)'
      }}
    >
      {/* Banner */}
      <div style={{
        height: 90,
        background: store.bannerUrl
          ? `url(${store.bannerUrl}) center/cover`
          : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      }} />

      {/* Info */}
      <div style={{ padding: '0 16px 16px' }}>
        {/* Logo */}
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          border: '3px solid #fff', marginTop: -28,
          background: '#fff', overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,.12)', marginBottom: 10
        }}>
          <img
            src={!imgError && store.logoUrl ? store.logoUrl : DEFAULT_LOGO}
            alt={store.name}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>
          {store.name}
        </div>
        {store.description && (
          <div style={{
            fontSize: 12, color: '#64748b', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
            marginBottom: 12
          }}>
            {store.description}
          </div>
        )}

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: '#f0fdf4', color: '#16a34a',
          borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600
        }}>
          🟢 Tienda activa
        </div>
      </div>
    </div>
  )
}
