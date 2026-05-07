import { createContext, useContext, useState, useCallback } from 'react'
import { auth as authApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('ab_user')
    return stored ? JSON.parse(stored) : null
  })

  const _persist = (userData) => {
    localStorage.setItem('ab_user', JSON.stringify(userData))
    setUser(userData)
  }

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password)
    localStorage.setItem('ab_token', res.token)
    _persist(res.user)
    return res.user
  }, [])

  const register = useCallback(async (data) => {
    const res = await authApi.register(data)
    localStorage.setItem('ab_token', res.token)
    _persist(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('ab_token')
    localStorage.removeItem('ab_user')
    setUser(null)
  }, [])

  // Actualiza campos del usuario en memoria y localStorage (ej: onboardingCompleted)
  const updateUser = useCallback((patch) => {
    setUser(prev => {
      const updated = { ...prev, ...patch }
      localStorage.setItem('ab_user', JSON.stringify(updated))
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
