import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminStats, getAdminAnnouncements } from '../api/client'
import type { AdminStats, AdminAnnouncementOut } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './AdminDashboard.module.css'

const formatNotificationDate = (isoString: string) => {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [announcements, setAnnouncements] = useState<AdminAnnouncementOut[]>([])
  const [loading, setLoading] = useState(true)

  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
  const telegramAvatar = tgUser?.photo_url

  useEffect(() => {
    Promise.all([
      getAdminStats(),
      getAdminAnnouncements(),
    ])
      .then(([statsData, announcementsData]) => {
        setStats(statsData)
        setAnnouncements(announcementsData)
      })
      .catch(console.error)
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
      <SiteHeader avatarUrl={telegramAvatar} />

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
              Администратор &middot; ZuhraMath &middot; {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
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

        {/* Announcements */}
        {announcements.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                  campaign
                </span>
                <h2 className={styles.sectionTitle}>Объявления</h2>
              </div>
              <button className={styles.seeAllButton} onClick={() => navigate('/admin/announcements')}>
                Все
              </button>
            </div>
            <div className={styles.notificationsList}>
              {announcements.slice(0, 2).map((notif) => (
                <div
                  key={notif.id}
                  className={styles.notificationCard}
                  onClick={() => navigate('/admin/announcements')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.notificationContent}>
                    {notif.sender_name && (
                      <span className={styles.notificationSender}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                          admin_panel_settings
                        </span>
                        {notif.sender_name}
                      </span>
                    )}
                    {notif.title && (
                      <p className={styles.notificationTitle}>{notif.title}</p>
                    )}
                    <p className={styles.notificationMessage}>
                      {notif.message.length > 80
                        ? notif.message.slice(0, 80) + '...'
                        : notif.message}
                    </p>
                    <span className={styles.notificationTime}>
                      {formatNotificationDate(notif.sent_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
