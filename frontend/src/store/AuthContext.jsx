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
    fetch('/api/health').catch(() => {})
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

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      updateUser,
      isOwner: user?.role === 'OWNER' || user?.role === 'ADMIN',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
