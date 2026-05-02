import axios from 'axios'

const client = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

client.interceptors.request.use(config => {
  const token = localStorage.getItem('ab_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ab_token')
      localStorage.removeItem('ab_user')
      window.location.href = '/login'
    }
    return Promise.reject(err.response?.data || err)
  }
)

export default client
