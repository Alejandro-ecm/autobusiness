import client from './client'

export const auth = {
  login:    (email, password) => client.post('/auth/login', { email, password }),
  register: (data)            => client.post('/auth/register', data),
}

export const dashboard = {
  get:            () => client.get('/dashboard'),
  branches:       () => client.get('/dashboard/branches'),
  cashierRanking: (days = 30) => client.get('/dashboard/cashier-ranking', { params: { days } }),
}

export const pos = {
  products:           (q)      => client.get('/pos/products', { params: q ? { q } : {} }),
  topProducts:        ()       => client.get('/pos/top-products'),
  checkout:           (data)   => client.post('/pos/checkout', data),
  createCardPayment:  (data)   => client.post('/pos/create-payment', data),
  processCardPayment: (data)   => client.post('/pos/process-payment', data),
  corteToday:         ()       => client.get('/pos/corte/today'),
  corteClose:         (notes)  => client.post('/pos/corte/close', { notes }),
}

export const inventory = {
  list:        ()              => client.get('/inventory'),
  lowStock:    ()              => client.get('/inventory/low-stock'),
  create:      (data)          => client.post('/inventory/products', data),
  update:      (id, data)      => client.put(`/inventory/products/${id}`, data),
  adjustStock: (id, delta, reason) =>
    client.patch(`/inventory/products/${id}/stock`, { delta, reason }),
  import:      (rows)          => client.post('/inventory/products/import', rows),
  movements:   ()              => client.get('/inventory/movements'),
}

export const categories = {
  list:   ()          => client.get('/categories'),
  create: (data)      => client.post('/categories', data),
  update: (id, data)  => client.put(`/categories/${id}`, data),
  delete: (id)        => client.delete(`/categories/${id}`),
}

export const customers = {
  list:         (q)           => client.get('/customers', { params: q ? { q } : {} }),
  create:       (data)        => client.post('/customers', data),
  update:       (id, data)    => client.put(`/customers/${id}`, data),
  remove:       (id)          => client.delete(`/customers/${id}`),
  transactions: (id)          => client.get(`/customers/${id}/transactions`),
  addFiado:     (id, data)    => client.post(`/customers/${id}/fiado`, data),
  addPayment:   (id, data)    => client.post(`/customers/${id}/payment`, data),
}

export const users = {
  list:         ()            => client.get('/users'),
  create:       (data)        => client.post('/users', data),
  toggleActive: (id, active)  => client.patch(`/users/${id}/active`, { isActive: active }),
  stats:        (id)          => client.get(`/users/${id}/stats`),
}

export const reports = {
  sales: (from, to) => client.get('/reports/sales', { params: { from, to } }),
}

export const orders = {
  list:         ()             => client.get('/orders'),
  updateStatus: (id, status)   => client.patch(`/orders/${id}/status`, { status }),
}

export const alerts = {
  list:     () => client.get('/alerts'),
  markRead: (id) => client.patch(`/alerts/${id}/read`),
}

export const store = {
  storefront:      (slug)       => client.get(`/store/${slug}`),
  placeOrder:      (slug, data) => client.post(`/store/${slug}/orders`, data),
  createPayment:   (slug, data) => client.post(`/store/${slug}/pay`, data),
  processPayment:  (slug, data) => client.post(`/store/${slug}/process-payment`, data),
}

export const business = {
  updateSettings:  (data) => client.patch('/business/settings', data),
  deliveryCode:    ()     => client.get('/business/delivery-code'),
}

export const delivery = {
  orders: (code) => client.get('/delivery/orders', { params: { code } }),
}

export const subscription = {
  status:         ()              => client.get('/subscription'),
  plans:          ()              => client.get('/subscription/plans'),
  upgrade:        (plan, period = 'MONTHLY')           => client.post('/subscription/upgrade', { plan, period }),
  processPayment: (plan, formData, period = 'MONTHLY') => client.post('/subscription/process-payment', { plan, formData, period }),
  cancel:         ()              => client.post('/subscription/cancel'),
  activate:       ()              => client.post('/subscription/activate'),
}

export const payments = {
  createMPPreference: (data) => client.post('/payments/mercadopago/create-preference', data),
  list:               ()     => client.get('/payments'),
  byOrder:            (id)   => client.get(`/payments/order/${id}`),
}

export const mpSettings = {
  status:      ()            => client.get('/settings/mp'),
  connectUrl:  ()            => client.get('/settings/mp/connect-url'),
  connectManual: (token, publicKey) => client.post('/settings/mp/manual', { accessToken: token, ...(publicKey ? { publicKey } : {}) }),
  disconnect:  ()            => client.delete('/settings/mp'),
}

export const invoices = {
  list:   ()        => client.get('/invoices'),
  create: (data)    => client.post('/invoices', data),
  get:    (id)      => client.get(`/invoices/${id}`),
}

export const notifications = {
  vapidKey:   ()     => client.get('/notifications/vapid-key'),
  subscribe:  (data) => client.post('/notifications/subscribe', data),
  unsubscribe: ()    => client.delete('/notifications/subscribe'),
  test:       ()     => client.post('/notifications/test'),
}

export const superAdmin = {
  businesses: ()              => client.get('/super-admin/businesses'),
  metrics:    ()              => client.get('/super-admin/metrics'),
  suspend:    (id)            => client.patch(`/super-admin/businesses/${id}/suspend`),
  activate:   (id)            => client.patch(`/super-admin/businesses/${id}/activate`),
  setPlan:    (id, plan)      => client.patch(`/super-admin/businesses/${id}/plan`, { plan }),
}

export const purchases = {
  list:   ()     => client.get('/purchases'),
  create: (data) => client.post('/purchases', data),
}

export const onboarding = {
  complete: (profileType) => client.patch('/auth/onboarding', { profileType }),
}

export const marketplace = {
  stores: (q) => client.get('/marketplace/stores', { params: q ? { q } : {} }),
}

export const upload = {
  image: (file, folder = 'products') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', folder)
    return client.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const legal = {
  terms:         () => client.get('/legal/terms'),
  privacy:       () => client.get('/legal/privacy'),
  acceptableUse: () => client.get('/legal/acceptable-use'),
  versions:      () => client.get('/legal/versions'),
  status:        () => client.get('/legal/status'),
  accept:        () => client.post('/legal/accept'),
}
