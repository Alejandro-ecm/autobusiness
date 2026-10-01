// Checkbox de consentimiento legal accesible (input real oculto + caja
// custom con aria-hidden), reutilizado en Register, Login y Storefront.
// Antes estaba duplicado byte a byte en los 3 archivos.
export default function ConsentCheckbox({ checked, onChange, children, style, labelStyle }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', ...style }}>
      <span style={{ position: 'relative', width: 20, height: 20, flexShrink: 0, marginTop: 1 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="legal-checkbox-input"
          style={{ position: 'absolute', inset: 0, width: 20, height: 20, margin: 0, opacity: 0, cursor: 'pointer' }}
        />
        <div
          aria-hidden="true"
          className="legal-checkbox-box"
          style={{
            width: 20, height: 20, borderRadius: 5,
            border: `2px solid ${checked ? 'var(--color-primary)' : '#cbd5e1'}`,
            background: checked ? 'var(--color-primary)' : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s', pointerEvents: 'none',
          }}>
          {checked && (
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
              <path d="M1 4L4 7L10 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      </span>
      <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, ...labelStyle }}>
        {children}
      </span>
    </label>
  )
}
