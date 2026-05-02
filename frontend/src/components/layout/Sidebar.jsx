import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import './Sidebar.css'

const ownerNav = [
  { to: '/dashboard',     icon: '⚡', label: 'Resumen' },
  { to: '/caja',          icon: '💳', label: 'Caja' },
  { to: '/caja-ia',       icon: '🤖', label: 'Caja IA' },
  { to: '/inventory',     icon: '📦', label: 'Inventario' },
  { to: '/customers',     icon: '👥', label: 'Clientes' },
  { to: '/store-admin',   icon: '🏪', label: 'Tienda Online' },
  { to: '/orders',        icon: '📋', label: 'Pedidos' },
  { to: '/reports',       icon: '📊', label: 'Reportes' },
  { to: '/finance',       icon: '💰', label: 'Finanzas' },
  { to: '/contabilidad',  icon: '📒', label: 'Contabilidad' },
  { to: '/marketing',     icon: '📣', label: 'Marketing' },
  { to: '/users',         icon: '👤', label: 'Usuarios' },
  { to: '/subscription',  icon: '⭐', label: 'Suscripción' },
]

const cashierNav = [
  { to: '/caja',       icon: '💳', label: 'Caja' },
  { to: '/caja-ia',    icon: '🤖', label: 'Caja IA' },
  { to: '/inventory',  icon: '📦', label: 'Inventario' },
  { to: '/customers',  icon: '👥', label: 'Clientes' },
]

export default function Sidebar({ open, onClose }) {
  const { user, logout, isOwner } = useAuth()
  const navigate = useNavigate()
  const nav = isOwner ? ownerNav : cashierNav

  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-logo">AB</div>
        <div>
          <div className="sidebar-brand-name">AutoBusiness</div>
          <div className="sidebar-business" title={user?.businessName}>{user?.businessName}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user?.businessSlug && (
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
        <div className="sidebar-user">
          <div className="sidebar-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div>
            <div className="sidebar-user-name">{user?.name}</div>
            <div className="sidebar-user-role">{user?.role}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={() => { logout(); navigate('/login') }}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
