import axios from 'axios'

const client = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

client.interceptors.request.use(config => {
  try {
    const token = localStorage.getItem('ab_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch { /* storage no disponible */ }
  return config
})

client.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      try {
        localStorage.removeItem('ab_token')
        localStorage.removeItem('ab_user')
      } catch {}
      // Evitar loops de redirección si ya estamos en /login
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err.response?.data || err)
  }
)

export default client
