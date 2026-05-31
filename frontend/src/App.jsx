import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/AuthContext'
import { ToastProvider } from './store/ToastContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Landing from './pages/Landing'
import Register from './pages/Register'
import PaymentResult from './pages/PaymentResult'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import Inventory from './pages/Inventory'
import Orders from './pages/Orders'
import Finance from './pages/Finance'
import Marketing from './pages/Marketing'
import Storefront from './pages/Storefront'
import StoreAdmin from './pages/StoreAdmin'
import Contabilidad from './pages/Contabilidad'
import CajaIA from './pages/CajaIA'
import Customers from './pages/Customers'
import Users from './pages/Users'
import Reports from './pages/Reports'
import Subscription from './pages/Subscription'
import PaymentSettings from './pages/PaymentSettings'
import SuperAdmin from './pages/SuperAdmin'
import Purchases from './pages/Purchases'
import OnboardingWizard from './components/OnboardingWizard'
import Marketplace from './pages/Marketplace'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import AccountDeletion from './pages/AccountDeletion'
import Checkout from './pages/Checkout'

function PrivateRoute({ children, ownerOnly = false, superAdminOnly = false }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (superAdminOnly && !user.isSuperAdmin) return <Navigate to="/dashboard" replace />
  if (ownerOnly && user.role === 'CASHIER') return <Navigate to="/caja" replace />
  // Mostrar onboarding solo a OWNER la primera vez (no en super-admin ni en caja)
  if (user && !user.onboardingCompleted && !user.isSuperAdmin && user.role === 'OWNER') {
    return <OnboardingWizard />
  }
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  const home = user?.isSuperAdmin ? '/super-admin' : user?.role === 'CASHIER' ? '/caja' : '/dashboard'

  // Si el usuario tiene un plan pendiente de pago (registrado desde checkout sin pagar),
  // redirigir a suscripción. NO borrar la key aquí — solo se borra al pagar o al saltar.
  const pendingPlan = localStorage.getItem('checkout_plan_pending')
  if (user && pendingPlan && !user.isSuperAdmin) {
    return <Navigate to={`/subscription?upgrade=${pendingPlan}`} replace />
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={user ? <Navigate to={home} /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to={home} /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={home} /> : <Register />} />
      <Route path="/tienda/:slug" element={<Storefront />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/payment/success" element={<PaymentResult />} />
      <Route path="/payment/failure" element={<PaymentResult />} />
      <Route path="/payment/pending" element={<PaymentResult />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/account-deletion" element={<AccountDeletion />} />

      {/* Super Admin */}
      <Route path="/super-admin" element={
        <PrivateRoute superAdminOnly><AppLayout><SuperAdmin /></AppLayout></PrivateRoute>
      } />

      <Route path="/dashboard" element={
        <PrivateRoute ownerOnly><AppLayout><Dashboard /></AppLayout></PrivateRoute>
      } />

      {/* Caja = POS renombrado */}
      <Route path="/caja" element={
        <PrivateRoute><AppLayout><POS /></AppLayout></PrivateRoute>
      } />
      {/* Alias legacy */}
      <Route path="/pos" element={<Navigate to="/caja" replace />} />

      <Route path="/inventory" element={
        <PrivateRoute><AppLayout><Inventory /></AppLayout></PrivateRoute>
      } />

      <Route path="/store-admin" element={
        <PrivateRoute ownerOnly><AppLayout><StoreAdmin /></AppLayout></PrivateRoute>
      } />

      <Route path="/orders" element={
        <PrivateRoute ownerOnly><AppLayout><Orders /></AppLayout></PrivateRoute>
      } />

      <Route path="/finance" element={
        <PrivateRoute ownerOnly><AppLayout><Finance /></AppLayout></PrivateRoute>
      } />

      <Route path="/marketing" element={
        <PrivateRoute ownerOnly><AppLayout><Marketing /></AppLayout></PrivateRoute>
      } />

      <Route path="/contabilidad" element={
        <PrivateRoute ownerOnly><AppLayout><Contabilidad /></AppLayout></PrivateRoute>
      } />

      <Route path="/caja-ia" element={
        <PrivateRoute><AppLayout><CajaIA /></AppLayout></PrivateRoute>
      } />

      <Route path="/customers" element={
        <PrivateRoute><AppLayout><Customers /></AppLayout></PrivateRoute>
      } />

      <Route path="/users" element={
        <PrivateRoute ownerOnly><AppLayout><Users /></AppLayout></PrivateRoute>
      } />

      <Route path="/reports" element={
        <PrivateRoute ownerOnly><AppLayout><Reports /></AppLayout></PrivateRoute>
      } />

      <Route path="/subscription" element={
        <PrivateRoute ownerOnly><AppLayout><Subscription /></AppLayout></PrivateRoute>
      } />

      <Route path="/settings/payments" element={
        <PrivateRoute ownerOnly><AppLayout><PaymentSettings /></AppLayout></PrivateRoute>
      } />

      <Route path="/purchases" element={
        <PrivateRoute ownerOnly><AppLayout><Purchases /></AppLayout></PrivateRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
