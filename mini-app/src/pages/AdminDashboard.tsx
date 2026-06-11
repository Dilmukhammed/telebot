import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useAdminStats, useAnnouncements, prefetchAdminLessons } from '../api/hooks'
import { useUser } from '../context/UserContext'
import SiteHeader from '../components/SiteHeader'
import MiniCalendar from '../components/MiniCalendar'
import { Loading } from '../shared/components'
import { langToLocale } from '../shared/utils/formatDate'
import styles from './AdminDashboard.module.css'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t, i18n } = useTranslation()
  const currentLocale = langToLocale(i18n.language)
  const { user } = useUser()
  const { data: stats, isLoading } = useAdminStats()

  useEffect(() => {
    void prefetchAdminLessons(qc)
  }, [qc])
  const { data: announcements = [] } = useAnnouncements('teacher')
  const unreadCount = useMemo(
    () => announcements.filter(a => !a.is_read && a.sender_id !== user?.id).length,
    [announcements, user?.id]
  )

  if (isLoading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  if (!stats) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>{t('common.error')}</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <SiteHeader announcementCount={unreadCount} />

      <main>
        {/* Welcome Card */}
        <section className={styles.welcomeCard}>
          <div className={styles.welcomeLeft}>
            <h1 className={styles.welcomeTitle}>{t('admin.dashboard.title')}</h1>
            <p className={styles.welcomeSub}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>
                admin_panel_settings
              </span>
              {t('admin.dashboard.role_admin')} &middot; EduCenter &middot; {new Date().toLocaleDateString(currentLocale, { day: 'numeric', month: 'long' })}
            </p>
          </div>

          <MiniCalendar language={i18n.language} />
        </section>

        {/* Stats */}
        <section className={styles.section}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard} onClick={() => navigate('/admin/people')}>
              <span className="material-symbols-outlined">group</span>
              <span className={styles.statValue}>{stats.student_count}</span>
              <span className={styles.statLabel}>{t('admin.dashboard.students')}</span>
            </div>
            <div className={styles.statCard} onClick={() => navigate('/admin/people?tab=teachers')}>
              <span className="material-symbols-outlined">school</span>
              <span className={styles.statValue}>{stats.teacher_count}</span>
              <span className={styles.statLabel}>{t('admin.dashboard.teachers')}</span>
            </div>
            <div className={styles.statCard} onClick={() => navigate('/admin/courses')}>
              <span className="material-symbols-outlined">menu_book</span>
              <span className={styles.statValue}>{stats.course_count}</span>
              <span className={styles.statLabel}>{t('admin.dashboard.courses')}</span>
            </div>
            <div className={styles.statCard} onClick={() => navigate('/admin/courses')}>
              <span className="material-symbols-outlined">quiz</span>
              <span className={styles.statValue}>{stats.active_tests}</span>
              <span className={styles.statLabel}>{t('admin.dashboard.tests')}</span>
            </div>
          </div>
        </section>

        {/* Quick Action — Search */}
        <section className={styles.section}>
          <div className={styles.actionsGrid}>
            <div className={styles.actionCard} onClick={() => navigate('/admin/courses?tab=search')}>
              <span className="material-symbols-outlined">search</span>
              {t('admin.dashboard.find_slots')}
            </div>
          </div>
        </section>

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
