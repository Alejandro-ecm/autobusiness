import { Link } from 'react-router-dom'

export function LegalPageLayout({ title, subtitle, backTo = '/', backLabel = '← Inicio', footer, children }) {
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <Link to={backTo} style={styles.backLink}>{backLabel}</Link>
          <div style={styles.logoRow}>
            <div style={styles.logoIcon}>AB</div>
            <span style={styles.logoText}>AutoBusiness AI</span>
          </div>
          <h1 style={styles.title}>{title}</h1>
          {subtitle && <p style={styles.meta}>{subtitle}</p>}
        </div>

        <div style={styles.content}>{children}</div>

        {footer && <div style={styles.footer}>{footer}</div>}
      </div>
    </div>
  )
}

export function Section({ title, children }) {
  return (
    <section style={styles.section}>
      {title && <h2 style={styles.sectionTitle}>{title}</h2>}
      {children}
    </section>
  )
}

export function DraftBanner({ children }) {
  return (
    <div style={styles.draftBanner}>
      ⚠️ <strong>BORRADOR</strong> — {children || 'este contenido debe revisarlo un abogado antes de publicarse como definitivo.'}
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Inter', system-ui, sans-serif",
    color: '#1e293b',
  },
  container: {
    maxWidth: 760,
    margin: '0 auto',
    padding: '40px 24px 64px',
  },
  header: {
    textAlign: 'center',
    marginBottom: 40,
    paddingBottom: 32,
    borderBottom: '2px solid #e2e8f0',
  },
  backLink: {
    display: 'inline-block',
    marginBottom: 20,
    color: '#6366f1',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 600,
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  logoIcon: {
    width: 40,
    height: 40,
    background: '#6366f1',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 16,
    color: '#fff',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 700,
    color: '#0f172a',
  },
  title: {
    fontSize: 28,
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 8px',
  },
  meta: {
    fontSize: 13,
    color: '#1e293b',
    margin: 0,
  },
  content: {
    lineHeight: 1.75,
    fontSize: 15,
    color: '#334155',
  },
  section: {
    marginBottom: 36,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: '1px solid #e2e8f0',
  },
  link: {
    color: '#6366f1',
    textDecoration: 'none',
    fontWeight: 500,
  },
  contactBox: {
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '16px 20px',
    marginTop: 12,
    lineHeight: 1.8,
  },
  draftBanner: {
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#92400e',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 13,
    lineHeight: 1.6,
    marginBottom: 28,
  },
  footer: {
    marginTop: 48,
    paddingTop: 24,
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 13,
    flexWrap: 'wrap',
  },
}

export const legalStyles = styles
