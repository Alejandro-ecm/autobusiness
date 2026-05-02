import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import './AppLayout.css'

export default function AppLayout({ children }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Close sidebar whenever the route changes (user tapped a link)
  useEffect(() => { setOpen(false) }, [location.pathname])

  return (
    <div className="app-layout">
      {/* Dark backdrop — only visible on mobile when sidebar is open */}
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <Sidebar open={open} onClose={() => setOpen(false)} />

      <div className="app-content">
        {/* Mobile-only top bar with hamburger */}
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
