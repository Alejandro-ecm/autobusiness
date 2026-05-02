import { createContext, useContext, useState, useCallback } from 'react'
import { auth as authApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('ab_user')
    return stored ? JSON.parse(stored) : null
  })

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password)
    localStorage.setItem('ab_token', res.token)
    localStorage.setItem('ab_user', JSON.stringify(res.user))
    setUser(res.user)
    return res.user
  }, [])

  const register = useCallback(async (data) => {
    const res = await authApi.register(data)
    localStorage.setItem('ab_token', res.token)
    localStorage.setItem('ab_user', JSON.stringify(res.user))
    setUser(res.user)
    return res.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('ab_token')
    localStorage.removeItem('ab_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isOwner: user?.role === 'OWNER' || user?.role === 'ADMIN' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
