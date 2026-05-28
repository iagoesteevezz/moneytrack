import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import styles from './AppLayout.module.css'

const NAV = [
  { to: '/',             label: 'Dashboard',      icon: '📊' },
  { to: '/transactions', label: 'Transacciones',  icon: '💸' },
  { to: '/profile',      label: 'Perfil',         icon: '👤' },
]

export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.shell}>
      {/* ── Sidebar (desktop) ───────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>💰 MoneyTrack</div>

        <nav className={styles.nav}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <span className={styles.userEmail}>{user?.email}</span>
          <button className={styles.signOutBtn} onClick={handleSignOut}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────── */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* ── Bottom nav (mobile) ─────────────────────────────── */}
      <nav className={styles.bottomNav}>
        {NAV.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `${styles.bottomNavLink} ${isActive ? styles.bottomNavLinkActive : ''}`
            }
          >
            <span className={styles.bottomNavIcon}>{icon}</span>
            <span className={styles.bottomNavLabel}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
