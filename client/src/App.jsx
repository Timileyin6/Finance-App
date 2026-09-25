import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from './lib/AuthContext'
import SideBar from './components/SideBar'
import { Loading } from './components/Status'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import OverviewPage from './pages/OverviewPage'
import TransactionsPage from './pages/TransactionsPage'
import BudgetsPage from './pages/BudgetsPage'
import PotsPage from './pages/PotsPage'
import RecurringBillsPage from './pages/RecurringBillsPage'
import AccountsPage from './pages/AccountsPage'
import MonthlyReportPage from './pages/MonthlyReportPage'

function AppLayout() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  if (user === undefined) return <Loading fullScreen />
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className={`app-shell ${collapsed ? 'collapsed' : ''}`}>
      <SideBar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}

function PublicOnly({ children }) {
  const { user } = useAuth()
  if (user === undefined) return <Loading fullScreen />
  return user ? <Navigate to="/" replace /> : children
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><SignupPage /></PublicOnly>} />
      <Route element={<AppLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="pots" element={<PotsPage />} />
        <Route path="recurring-bills" element={<RecurringBillsPage />} />
        <Route path="monthly-report" element={<MonthlyReportPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
