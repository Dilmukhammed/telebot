import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getTeacherDashboard, getTeacherAnnouncements } from '../api/client'
import type { TeacherDashboardOut, AnnouncementOut } from '../shared/types'
import { formatDateTime, langToLocale } from '../shared/utils/formatDate'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './Dashboard.module.css'

export default function TeacherDashboard() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [data, setData] = useState<TeacherDashboardOut | null>(null)
  const [announcements, setAnnouncements] = useState<AnnouncementOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
  const telegramAvatar = tgUser?.photo_url
  const locale = langToLocale(i18n.language)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dashboard, anns] = await Promise.all([
        getTeacherDashboard(),
        getTeacherAnnouncements(),
      ])
      setData(dashboard)
      setAnnouncements(anns)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-outline)' }}>error</span>
          <p style={{ color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>{error || t('common.error')}</p>
          <button
            onClick={fetchData}
            style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontWeight: 600, cursor: 'pointer' }}
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  const { profile, stats, lessons } = data
  const avatarUrl = telegramAvatar || profile.photo_url

  return (
    <div className={styles.page}>
      <SiteHeader avatarUrl={avatarUrl} />

      <main className={styles.main}>
        {/* Welcome Section */}
        <section className={styles.welcomeCard}>
          <div className={styles.welcomeGradientBg} />
          <div className={styles.welcomeCardContent}>
            <div className={styles.welcomeText}>
              <h1 className={styles.welcomeTitle}>
                {t('dashboard.greeting', { name: profile.first_name })}
              </h1>
              <span className={styles.gradeBadge}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>stars</span>
                {t('profile.teacher')}
              </span>
              <p className={styles.motivationText}>
                {t('dashboard.motivation')}
              </p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className={styles.section}>
          <div className={styles.statsGrid}>
            <div
              className={styles.statCard}
              onClick={() => navigate('/calendar?view=week')}
              style={{ cursor: 'pointer' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--color-primary)' }}>
                calendar_month
              </span>
              <span className={styles.statValue}>{stats.lessons_this_week}</span>
              <span className={styles.statLabel}>{t('teacher.lessonsThisWeek')}</span>
            </div>
            <div
              className={styles.statCard}
              onClick={() => navigate('/teacher/students')}
              style={{ cursor: 'pointer' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--color-primary)' }}>
                groups
              </span>
              <span className={styles.statValue}>{stats.total_students}</span>
              <span className={styles.statLabel}>{t('teacher.totalStudents')}</span>
            </div>
          </div>
        </section>

        {/* Lessons Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('dashboard.upcomingLessons')}</h2>
            <button className={styles.seeAllButton} onClick={() => navigate('/calendar')}>
              {t('common.all')}
            </button>
          </div>
          <div className={styles.lessonsList}>
            {lessons.length > 0 ? (
              lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className={styles.lessonCard}
                  onClick={() => navigate(`/course/${lesson.subject_id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.lessonTime}>
                    <span className={styles.lessonDay}>{lesson.day_label}</span>
                    <span className={styles.lessonHour}>{lesson.time}</span>
                  </div>
                  <div className={styles.lessonInfo}>
                    <h3 className={styles.lessonSubject}>{lesson.subject_name}</h3>
                    <div className={styles.lessonMeta}>
                      <span className={styles.lessonMetaItem}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          meeting_room
                        </span>
                        <span>{lesson.room}</span>
                      </span>
                      <span className={styles.lessonMetaItem}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                          groups
                        </span>
                        <span>{lesson.student_count} {t('teacher.students')}</span>
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)' }}>
                    chevron_right
                  </span>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-outline)' }}>
                  event_busy
                </span>
                <p>{t('dashboard.noLessons')}</p>
              </div>
            )}
          </div>
        </section>

        {/* Announcements Section */}
        {announcements.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>
                  campaign
                </span>
                <h2 className={styles.sectionTitle}>{t('dashboard.announcements')}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {announcements.length > 2 && (
                  <button className={styles.seeAllButton} onClick={() => navigate('/announcements')}>
                    {t('common.all')}
                  </button>
                )}
                <button
                  className={styles.seeAllButton}
                  onClick={() => navigate('/announcements/create')}
                  style={{ display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                </button>
              </div>
            </div>
            <div className={styles.notificationsList}>
              {announcements
                .slice(0, 2)
                .map((notif) => (
                  <div
                    key={notif.id}
                    className={styles.notificationCard}
                    onClick={() => navigate(`/announcement/${notif.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.notificationContent}>
                      {notif.sender_name && (
                        <span className={styles.notificationSender}>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                            {notif.sender_role === 'teacher' ? 'school' : 'admin_panel_settings'}
                          </span>
                          {notif.sender_name} · {notif.sender_role === 'teacher' ? t('profile.teacher') : t('profile.admin')}
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
                        {formatDateTime(notif.sent_at, locale)}
                      </span>
                    </div>
                  </div>
                ))
              }
            </div>
          </section>
        )}

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
