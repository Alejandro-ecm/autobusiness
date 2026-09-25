import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { useEffect, useState } from 'react'
import { orders as ordersApi, notifications as notificationsApi } from '../../api'
import './Sidebar.css'

const ACTIVE = new Set(['pending', 'confirmed', 'preparing', 'ready'])

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// Registra el dispositivo para push reales (funcionan con la app/pestaña cerrada).
// No reemplaza el aviso local de abajo, que sirve de respaldo inmediato con la
// pestaña abierta aunque el push tarde o el permiso se haya negado.
async function subscribeToPush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    const registration = await navigator.serviceWorker.ready
    let sub = await registration.pushManager.getSubscription()
    if (!sub) {
      const { publicKey } = await notificationsApi.vapidKey()
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }
    const json = sub.toJSON()
    await notificationsApi.subscribe({ ...json, userAgent: navigator.userAgent })
  } catch {
    // Sin permiso, sin SW listo, o el navegador no soporta push — no es crítico.
  }
}

function usePendingOrdersCount(enabled = true) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    const load = () =>
      ordersApi.list().then(r => {
        // el interceptor ya hace res.data, r es el array directamente
        const n = (Array.isArray(r) ? r : []).filter(o => ACTIVE.has(o.status)).length
        setCount(prev => {
          if (n > prev && prev > 0 && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('Nuevo pedido', { body: `Tienes ${n} pedidos pendientes`, icon: '/skymarket-logo.jpg' })
          }
          return n
        })
      }).catch(() => {})
    load()
    const id = setInterval(load, 15_000)
    return () => clearInterval(id)
  }, [enabled])
  return count
}

const ownerNav = [
  { to: '/dashboard',        icon: '⚡', label: 'Resumen' },
  { to: '/caja',             icon: '💳', label: 'Caja' },
  { to: '/caja-ia',          icon: '🤖', label: 'Caja IA' },
  { to: '/inventory',        icon: '📦', label: 'Inventario' },
  { to: '/customers',        icon: '👥', label: 'Clientes' },
  { to: '/store-admin',      icon: '🏪', label: 'Tienda Online' },
  { to: '/orders',           icon: '📋', label: 'Pedidos' },
  { to: '/reports',          icon: '📊', label: 'Reportes' },
  { to: '/finance',          icon: '💰', label: 'Finanzas' },
  { to: '/purchases',        icon: '🧾', label: 'Compras' },
  { to: '/marketing',        icon: '📣', label: 'Marketing' },
  { to: '/users',            icon: '👤', label: 'Usuarios' },
  { to: '/settings/payments',icon: '💸', label: 'Cobros' },
  { to: '/empleados-ia',     icon: '🤝', label: 'Empleados IA' },
  { to: '/soporte',          icon: '🎧', label: 'Soporte' },
  { to: '/subscription',     icon: '⭐', label: 'Suscripción' },
]

const cashierNav = [
  { to: '/caja',      icon: '💳', label: 'Caja' },
  { to: '/caja-ia',   icon: '🤖', label: 'Caja IA' },
  { to: '/inventory', icon: '📦', label: 'Inventario' },
  { to: '/customers', icon: '👥', label: 'Clientes' },
  { to: '/soporte',   icon: '🎧', label: 'Soporte' },
]

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const { user, logout, isOwner } = useAuth()
  const navigate = useNavigate()
  const nav = isOwner ? ownerNav : cashierNav
  const pendingOrders = usePendingOrdersCount(isOwner)

  useEffect(() => {
    if (!isOwner || !('Notification' in window)) return
    if (Notification.permission === 'granted') {
      subscribeToPush()
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') subscribeToPush()
      })
    }
  }, [isOwner])

  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}${collapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar-brand">
        <img className="sidebar-logo-img" src="/favicon-512.png" alt="AutoBusiness AI" />
        {!collapsed && (
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name" title={user?.businessName}>{user?.businessName || 'AutoBusiness'}</div>
            <div className="sidebar-business">AutoBusiness AI</div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-label">{item.label}</span>}
            {item.to === '/orders' && pendingOrders > 0 && (
              <span className="sidebar-badge">{pendingOrders > 99 ? '99+' : pendingOrders}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && user?.businessSlug && (
          <a
            href={`/tienda/${user.businessSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-store-link"
            onClick={onClose}
          >
            🔗 Ver mi tienda pública
          </a>
        )}
        <div className={`sidebar-user${collapsed ? ' sidebar-user--mini' : ''}`}>
          <div className="sidebar-avatar" title={user?.name}>{user?.name?.[0]?.toUpperCase()}</div>
          {!collapsed && (
            <div>
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <button className="sidebar-logout" onClick={() => { logout(); navigate('/login') }}>
            Cerrar sesión
          </button>
        )}
        {collapsed && (
          <button className="sidebar-logout sidebar-logout--mini" title="Cerrar sesión" onClick={() => { logout(); navigate('/login') }}>
            ⬅
          </button>
        )}
      </div>

    </aside>
  )
}
