import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import '../css/SideBar.css'

const ITEMS = [
  { name: 'Overview', icon: 'fa-house', path: '/' },
  { name: 'Transactions', icon: 'fa-arrow-down-up-across-line', path: '/transactions' },
  { name: 'Budgets', icon: 'fa-chart-pie', path: '/budgets' },
  { name: 'Pots', icon: 'fa-money-check-dollar', path: '/pots' },
  { name: 'Recurring Bills', icon: 'fa-money-bill-transfer', path: '/recurring-bills' },
  { name: 'Monthly Report', icon: 'fa-file-invoice', path: '/monthly-report' },
  { name: 'Accounts', icon: 'fa-building-columns', path: '/accounts' },
]

function SideBar({ collapsed, onToggle }) {
  const { user, logout } = useAuth()

  return (
    <aside className="sidebar">
      <h1 className="logo">{collapsed ? 'f' : 'finance'}</h1>

      <nav className="nav">
        {ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            title={collapsed ? item.name : undefined}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <i className={`fa-solid ${item.icon}`} aria-hidden="true" />
            <span className="nav-label">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip" title={user.email}>
          <span className="user-initial">{user.name[0]?.toUpperCase()}</span>
          <span className="nav-label user-name">{user.name}</span>
        </div>
        <button type="button" className="nav-item footer-btn" onClick={logout} title="Sign out">
          <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
          <span className="nav-label">Sign Out</span>
        </button>
        <button type="button" className="nav-item footer-btn minimize" onClick={onToggle} title={collapsed ? 'Expand menu' : undefined}>
          <i className={`fa-solid ${collapsed ? 'fa-arrow-right-to-bracket' : 'fa-backward'}`} aria-hidden="true" />
          <span className="nav-label">Minimize Menu</span>
        </button>
      </div>
    </aside>
  )
}

export default SideBar
