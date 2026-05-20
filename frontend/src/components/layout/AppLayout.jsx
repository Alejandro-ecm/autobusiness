import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import './AppLayout.css'

export default function AppLayout({ children }) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })
  const location = useLocation()

  useEffect(() => { setOpen(false) }, [location.pathname])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebar_collapsed', String(next)) } catch {}
  }

  return (
    <div className={`app-layout${collapsed ? ' sidebar-collapsed' : ''}`}>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <Sidebar
        open={open}
        onClose={() => setOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
      />

      <div className="app-content">
        <header className="mobile-topbar">
          <button
            className={`hamburger${open ? ' is-open' : ''}`}
            onClick={() => setOpen(o => !o)}
            aria-label="Menú"
          >
            <span /><span /><span />
          </button>
          <span className="mobile-topbar-brand">AutoBusiness</span>
        </header>

        <main className="app-main">{children}</main>
      </div>
    </div>
  )
}
