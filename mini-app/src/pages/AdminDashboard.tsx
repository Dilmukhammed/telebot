import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminStats, getTeacherAnnouncements } from '../api/client'
import type { AdminStats } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './AdminDashboard.module.css'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
  const telegramAvatar = tgUser?.photo_url

  useEffect(() => {
    Promise.allSettled([
      getAdminStats(),
      getTeacherAnnouncements().catch(() => []),
    ])
      .then(([statsResult, annResult]) => {
        if (statsResult.status === 'fulfilled') setStats(statsResult.value)
        if (annResult.status === 'fulfilled') {
          setUnreadCount(annResult.value.filter(a => !a.is_read).length)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Loading fullPage message="Загрузка..." />
  }

  if (!stats) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>Ошибка загрузки</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <SiteHeader avatarUrl={telegramAvatar} announcementCount={unreadCount} announcementPath="/admin/announcements" />

      <main>
        {/* Welcome Card */}
        <section className={styles.welcomeCard}>
          <div className={styles.welcomeGradientBg} />
          <div className={styles.welcomeCardContent}>
            <h1 className={styles.welcomeTitle}>Панель управления</h1>
            <p className={styles.welcomeSub}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: '4px' }}>
                admin_panel_settings
              </span>
              Администратор &middot; EduCenter &middot; {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className={styles.section}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard} onClick={() => navigate('/admin/people')}>
              <span className="material-symbols-outlined">group</span>
              <span className={styles.statValue}>{stats.student_count}</span>
              <span className={styles.statLabel}>Учеников</span>
            </div>
            <div className={styles.statCard} onClick={() => navigate('/admin/people?tab=teachers')}>
              <span className="material-symbols-outlined">school</span>
              <span className={styles.statValue}>{stats.teacher_count}</span>
              <span className={styles.statLabel}>Учителей</span>
            </div>
            <div className={styles.statCard} onClick={() => navigate('/admin/courses')}>
              <span className="material-symbols-outlined">menu_book</span>
              <span className={styles.statValue}>{stats.course_count}</span>
              <span className={styles.statLabel}>Курсов</span>
            </div>
            <div className={styles.statCard} onClick={() => navigate('/admin/courses')}>
              <span className="material-symbols-outlined">quiz</span>
              <span className={styles.statValue}>{stats.active_tests}</span>
              <span className={styles.statLabel}>Тестов</span>
            </div>
          </div>
        </section>

        {/* Quick Action — Search */}
        <section className={styles.section}>
          <div className={styles.actionsGrid}>
            <div className={styles.actionCard} onClick={() => navigate('/admin/courses?tab=search')}>
              <span className="material-symbols-outlined">search</span>
              Найти свободные слоты
            </div>
          </div>
        </section>

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
