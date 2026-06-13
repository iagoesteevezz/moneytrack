import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Icon } from '@/components/ui/Icon'
import styles from './AppLayout.module.css'

const NAV = [
  { to: '/',             label: 'Resumen',           icon: 'dashboard'      as const },
  { to: '/transactions', label: 'Movimientos',        icon: 'transactions'   as const },
  { to: '/budgets',      label: 'Presupuestos',       icon: 'target'         as const },
  { to: '/events',       label: 'Viajes',             icon: 'calendar'       as const },
  { to: '/shopping',     label: 'Lista de Compras',   icon: 'cart'           as const },
  { to: '/insights',     label: 'Análisis IA',        icon: 'sparkle'        as const },
]

const BOTTOM_NAV = [
  { to: '/profile',      label: 'Perfil',           icon: 'profile'        as const },
]

export function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'U'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.shell}>
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.brand}>
            <div className={styles.brandMark}>
              <Icon name="wallet" size={16} color="#fff" />
            </div>
            <span className={styles.brandName}>MoneyTrack</span>
          </div>

          <nav className={styles.nav} aria-label="Navegación principal">
            {NAV.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                }
              >
                <Icon name={icon} size={17} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className={styles.sidebarBottom}>
          <div className={styles.sidebarDivider} />

          {BOTTOM_NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              <Icon name={icon} size={17} />
              <span>{label}</span>
            </NavLink>
          ))}

          <div className={styles.userRow}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.userInfo}>
              <span className={styles.userEmail}>{user?.email}</span>
            </div>
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={handleSignOut}
              title="Cerrar sesión"
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Page content ────────────────────────────────────── */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* ── Mobile bottom bar ───────────────────────────────── */}
      <nav className={styles.mobileNav} aria-label="Navegación móvil">
        {[...NAV, ...BOTTOM_NAV].map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `${styles.mobileNavLink} ${isActive ? styles.mobileNavLinkActive : ''}`
            }
          >
            <Icon name={icon} size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
