import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { auth as authApi } from '../api'

const AuthContext = createContext(null)

function safeLocalGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
}

function safeLocalSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

function safeLocalRemove(key) {
  try { localStorage.removeItem(key) } catch {}
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => safeLocalGet('ab_user'))

  // Warm up the Render backend on app load so it's ready by the time the user logs in
  useEffect(() => {
    const base = import.meta.env.VITE_API_URL || '/api'
    fetch(`${base}/health`).catch(() => {})
  }, [])

  const _persist = (userData) => {
    safeLocalSet('ab_user', userData)
    setUser(userData)
  }

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password)
    try { localStorage.setItem('ab_token', res.token) } catch {}
    _persist(res.user)
    return res.user
  }, [])

  const register = useCallback(async (data) => {
    const res = await authApi.register(data)
    try { localStorage.setItem('ab_token', res.token) } catch {}
    _persist(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    safeLocalRemove('ab_token')
    safeLocalRemove('ab_user')
    setUser(null)
  }, [])

  const updateUser = useCallback((patch) => {
    setUser(prev => {
      const updated = { ...prev, ...patch }
      safeLocalSet('ab_user', updated)
      return updated
    })
  }, [])

  const switchBusiness = useCallback((acc) => {
    const currentUser = safeLocalGet('ab_user')
    const currentToken = localStorage.getItem('ab_token')
    if (currentUser && currentToken) {
      let accounts = []
      try { accounts = JSON.parse(localStorage.getItem('multi_accounts') || '[]') } catch {}
      const filtered = accounts.filter(a => a.businessId !== acc.businessId)
      filtered.push({
        id: currentUser.id,
        businessId: currentUser.businessId,
        businessName: currentUser.businessName,
        businessSlug: currentUser.businessSlug,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        token: currentToken,
      })
      try { localStorage.setItem('multi_accounts', JSON.stringify(filtered)) } catch {}
    }
    try { localStorage.setItem('ab_token', acc.token) } catch {}
    _persist({
      id: acc.id,
      name: acc.name,
      email: acc.email,
      role: acc.role || 'OWNER',
      businessId: acc.businessId,
      businessName: acc.businessName,
      businessSlug: acc.businessSlug,
    })
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      updateUser,
      switchBusiness,
      isOwner: user?.role === 'OWNER' || user?.role === 'ADMIN',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
