import React, { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useUser } from '../context/UserContext'
import { prefetchAdminLessons } from '../api/hooks'
import styles from './BottomNavBar.module.css'

const STUDENT_TABS = [
  { path: '/dashboard', icon: 'home', labelKey: 'nav.home' },
  { path: '/courses', icon: 'menu_book', labelKey: 'nav.courses' },
  { path: '/calendar', icon: 'calendar_today', labelKey: 'nav.calendar' },
  { path: '/profile', icon: 'person', labelKey: 'nav.profile' },
]

const TEACHER_TABS = [
  { path: '/dashboard', icon: 'dashboard', labelKey: 'nav.home' },
  { path: '/courses', icon: 'menu_book', labelKey: 'nav.courses' },
  { path: '/calendar', icon: 'calendar_today', labelKey: 'nav.calendar' },
  { path: '/profile', icon: 'person', labelKey: 'nav.profile' },
]

const ADMIN_TABS = [
  { path: '/dashboard', icon: 'dashboard', labelKey: 'nav.home' },
  { path: '/admin/people', icon: 'group', labelKey: 'nav.people' },
  { path: '/admin/courses', icon: 'menu_book', labelKey: 'nav.courses' },
  { path: '/admin/calendar', icon: 'calendar_today', labelKey: 'nav.calendar' },
  { path: '/profile', icon: 'person', labelKey: 'nav.profile' },
]

const BottomNavBar = React.memo(function BottomNavBar() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useUser()
  const role = user?.role ?? null

  useEffect(() => {
    if (role === 'admin') {
      void prefetchAdminLessons(qc)
    }
  }, [role, qc])

  if (location.pathname === '/') return null

  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'

  // Admin always gets admin tabs, teacher gets teacher tabs, everyone else gets student tabs
  const tabConfig = isAdmin ? ADMIN_TABS : isTeacher ? TEACHER_TABS : STUDENT_TABS
  const tabs = tabConfig.map(tab => ({ ...tab, label: t(tab.labelKey) }))

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
              onClick={() => {
                if (isAdmin && tab.path === '/admin/calendar') {
                  void prefetchAdminLessons(qc)
                }
                navigate(tab.path)
              }}
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
})

export default BottomNavBar
