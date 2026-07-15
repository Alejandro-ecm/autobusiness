import { useState, useEffect } from 'react'
import QRCode from 'qrcode'

export default function StoreQRCode({ storeUrl, businessName, show }) {
  const [dataUrl, setDataUrl] = useState(null)

  useEffect(() => {
    if (!storeUrl) return
    QRCode.toDataURL(storeUrl, {
      width: 480,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setDataUrl)
      .catch(() => show?.('No se pudo generar el código QR', 'error'))
  }, [storeUrl])

  const downloadImage = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `codigo-qr-${(businessName || 'tienda').replace(/\s+/g, '_').toLowerCase()}.png`
    a.click()
    show?.('Código QR descargado', 'success')
  }

  const downloadPDF = () => {
    if (!dataUrl) return
    const w = window.open('', '_blank', 'width=520,height=680')
    if (!w) { show?.('Habilita las ventanas emergentes para descargar el PDF', 'error'); return }
    w.document.write(`
      <html>
        <head>
          <title>Código QR — ${businessName || 'Mi Negocio'}</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 48px 24px; }
            h1 { font-size: 22px; margin: 0 0 4px; color: #0f172a; }
            p.sub { color: #64748b; font-size: 13px; margin: 0 0 24px; }
            img { width: 320px; height: 320px; }
            .cta { font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 20px; }
            .url { font-size: 13px; color: #6366f1; margin-top: 8px; word-break: break-all; }
          </style>
        </head>
        <body>
          <h1>${businessName || 'Mi Negocio'}</h1>
          <p class="sub">Escanea para visitar la tienda online</p>
          <img src="${dataUrl}" />
          <div class="cta">Visita nuestra tienda</div>
          <div class="url">${storeUrl}</div>
        </body>
      </html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 350)
  }

  return (
    <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>📱</div>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, color: '#0f172a' }}>
        Código QR de tu tienda
      </h2>
      <p style={{ fontSize: 13, color: '#1e293b', marginBottom: 24 }}>
        Tus clientes lo escanean con la cámara de su celular y entran directo a tu tienda online.
      </p>

      {dataUrl ? (
        <img
          src={dataUrl}
          alt="Código QR de la tienda"
          style={{ width: 220, height: 220, borderRadius: 16, border: '1px solid #e2e8f0', padding: 12, background: '#fff' }}
        />
      ) : (
        <div style={{ width: 220, height: 220, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="spinner" />
        </div>
      )}

      <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', marginTop: 20 }}>
        Visita nuestra tienda
      </div>
      <div style={{ fontSize: 12, color: '#6366f1', marginTop: 4, wordBreak: 'break-all' }}>
        {storeUrl}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={downloadImage} disabled={!dataUrl}>
          🖼 Descargar como foto
        </button>
        <button className="btn btn-outline" onClick={downloadPDF} disabled={!dataUrl}>
          📄 Descargar como PDF
        </button>
      </div>
    </div>
  )
}
