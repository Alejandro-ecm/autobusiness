const BASE = 'http://localhost:4000/api/v1'
const SKY_APP_KEY = 'sky_efc3246cfa66ab52547a92813ac6ed742d597ae1'
const APP_ID = '353484de-801b-4f93-ae7b-e3ff059cf94d'
const headers = { 'Content-Type': 'application/json', 'X-Sky-App-Key': SKY_APP_KEY }

export async function trackMetric(name, value, unit = '') {
  fetch(`${BASE}/sky-apps/${APP_ID}/metrics`, { method: 'POST', headers, body: JSON.stringify({ name, value, unit }) }).catch(() => {})
}
export async function trackEvent(type, payload = {}) {
  fetch(`${BASE}/sky-apps/${APP_ID}/events`, { method: 'POST', headers, body: JSON.stringify({ type, payload, source: 'autobusiness-ai' }) }).catch(() => {})
}
export async function trackRevenue(amount, currency = 'MXN', description = '') {
  fetch(`${BASE}/sky-apps/${APP_ID}/revenue`, { method: 'POST', headers, body: JSON.stringify({ amount, amountUsd: currency === 'MXN' ? amount / 18 : amount, currency, type: 'REVENUE', description }) }).catch(() => {})
}
