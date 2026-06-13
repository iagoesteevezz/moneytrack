import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  const location = useLocation()

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
            {NAV.map(({ to, label, icon }, i) => (
              <motion.div
                key={to}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                  }
                >
                  <Icon name={icon} size={17} />
                  <span>{label}</span>
                </NavLink>
              </motion.div>
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
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
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
