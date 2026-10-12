import { Routes, Route, Navigate } from 'react-router-dom'
import { isAuthenticated } from './api/auth'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import PortfolioDetail from './pages/PortfolioDetail'
import RiskAnalysis from './pages/RiskAnalysis'
import Insights from './pages/Insights'
import StressTesting from './pages/StressTesting'
import StockDetail from './pages/StockDetail'
import DCFCalculator from './pages/DCFCalculator'
import IndexDetail from './pages/IndexDetail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword  from './pages/ResetPassword'
import Financials from './pages/Financials'
import StockSearch from './pages/StockSearch'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

const App = () => {
  return (
    <Routes>
      {/* ── Public routes ── */}
      <Route path="/login"            element={<Login />} />
      <Route path="/register"         element={<Register />} />
      <Route path="/forgot-password"  element={<ForgotPassword />} />
      <Route path="/reset-password"   element={<ResetPassword />} />

      {/* ── Protected routes ── */}
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/portfolio/:id" element={<ProtectedRoute><PortfolioDetail /></ProtectedRoute>} />
      <Route path="/portfolio/:id/risk" element={<ProtectedRoute><RiskAnalysis /></ProtectedRoute>} />
      <Route path="/portfolio/:id/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
      <Route path="/portfolio/:id/stress" element={<ProtectedRoute><StressTesting /></ProtectedRoute>} />
      <Route path="/portfolio/:id/stock/:symbol" element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />
      <Route path="/portfolio/:id/stock/:symbol/financials" element={<ProtectedRoute><Financials /></ProtectedRoute>} />
      <Route path="/portfolio/:id/stock/:symbol/dcf" element={<ProtectedRoute><DCFCalculator /></ProtectedRoute>} />
      <Route path="/index/:key" element={<ProtectedRoute><IndexDetail /></ProtectedRoute>} />

      {/* ── Standalone stock search flow ───────────────── */}
      <Route path="/search"                    element={<ProtectedRoute><StockSearch /></ProtectedRoute>} />
      <Route path="/stock/:symbol"             element={<ProtectedRoute><StockDetail /></ProtectedRoute>} />
      <Route path="/stock/:symbol/dcf"         element={<ProtectedRoute><DCFCalculator /></ProtectedRoute>} />
      <Route path="/stock/:symbol/financials"  element={<ProtectedRoute><Financials /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App