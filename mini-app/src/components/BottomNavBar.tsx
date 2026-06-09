import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUser } from '../context/UserContext'
import styles from './BottomNavBar.module.css'

export default function BottomNavBar() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useUser()
  const role = user?.role ?? null

  if (location.pathname === '/') return null

  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isAdminRoute = location.pathname.startsWith('/admin')

  const studentTabs = [
    { path: '/dashboard', icon: 'home', label: t('nav.home') },
    { path: '/courses', icon: 'menu_book', label: t('nav.courses') },
    { path: '/calendar', icon: 'calendar_today', label: t('nav.calendar') },
    { path: '/profile', icon: 'person', label: t('nav.profile') },
  ]

  const teacherTabs = [
    { path: '/dashboard', icon: 'dashboard', label: t('nav.home') },
    { path: '/courses', icon: 'menu_book', label: t('nav.courses') },
    { path: '/calendar', icon: 'calendar_today', label: t('nav.calendar') },
    { path: '/profile', icon: 'person', label: t('nav.profile') },
  ]

  const adminTabs = [
    { path: '/dashboard', icon: 'dashboard', label: t('nav.home') },
    { path: '/admin/people', icon: 'group', label: t('nav.people') },
    { path: '/admin/courses', icon: 'menu_book', label: t('nav.courses') },
    { path: '/admin/calendar', icon: 'calendar_today', label: t('nav.calendar') },
    { path: '/profile', icon: 'person', label: t('nav.profile') },
  ]

  // Admin on admin routes or dashboard -> admin tabs
  // Teacher always gets teacher tabs (they share /calendar, /profile with students)
  // Everyone else -> student tabs
  let tabs = studentTabs
  if (isAdmin && (isAdminRoute || location.pathname === '/dashboard')) {
    tabs = adminTabs
  } else if (isTeacher) {
    tabs = teacherTabs
  }

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.path ||
            (tab.path === '/courses' && location.pathname.startsWith('/course')) ||
            (tab.path === '/admin/courses' && location.pathname.startsWith('/admin/courses')) ||
            (tab.path === '/admin/people' && location.pathname.startsWith('/admin/people')) ||
            (tab.path === '/admin/calendar' && location.pathname.startsWith('/admin/calendar'))
          return (
            <button
              key={tab.path}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              onClick={() => navigate(tab.path)}
            >
              <div className={styles.iconContainer}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {tab.icon}
                </span>
              </div>
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
