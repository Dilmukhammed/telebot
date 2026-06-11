import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDashboard } from '../api/hooks'
import { CENTER, getLocalized } from '../config'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import LessonCountdown from '../components/LessonCountdown'
import MiniCalendar from '../components/MiniCalendar'
import { getGreeting, getTodayLessonsStatus, isLessThanAnHourAway, isLessonOngoing } from '../utils/lessonHelpers'
import styles from './Dashboard.module.css'

export default function Dashboard() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useDashboard()
  const [refreshing, setRefreshing] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const touchStartY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!data) return
    // Use server-calculated unread_count (counts ALL announcements, not just top 3)
    setUnreadCount(data.unread_count ?? 0)
  }, [data])

  // Pull-to-refresh: detect swipe down at scroll top
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback(async (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    const atTop = containerRef.current && containerRef.current.scrollTop <= 0
    if (deltaY > 80 && atTop && !refreshing) {
      setRefreshing(true)
      await refetch()
      setRefreshing(false)
    }
  }, [refetch, refreshing])

  if (isLoading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-outline)' }}>error</span>
          <p style={{ color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>{error?.message || t('common.error')}</p>
          <button
            onClick={() => refetch()}
            style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontWeight: 600, cursor: 'pointer' }}
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  const { profile, lessons, results } = data

  return (
    <div
      ref={containerRef}
      className={styles.page}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}
    >
      <SiteHeader announcementCount={unreadCount} />

      {refreshing && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '8px 0',
          color: 'var(--color-primary)',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          <span className="material-symbols-outlined" style={{
            fontSize: '18px',
            marginRight: '6px',
            animation: 'spin 1s linear infinite',
          }}>refresh</span>
          {t('common.loading')}
        </div>
      )}

      <main className={styles.main}>
        {/* Welcome Section */}
        <div className={styles.welcomeCard}>
          <div className={styles.welcomeLeft}>
            <h1 className={styles.welcomeGreeting}>
              {getGreeting(profile.first_name, t)}
            </h1>
            <p className={styles.welcomeStatus}>
              {profile.grade && (
                <span className={styles.welcomeRoleBadge}>
                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>school</span>
                  {t('dashboard.grade', { grade: profile.grade })}
                </span>
              )}
              <span>{getTodayLessonsStatus(lessons, t)}</span>
            </p>
          </div>
          
          <MiniCalendar language={i18n.language} />
        </div>

        {/* Stats Section */}
        {data.stats && (
          <section className={styles.section}>
            <div className={styles.statsGrid}>
              <div
                className={styles.statCard}
                onClick={() => navigate('/calendar')}
                style={{ cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px', color: 'var(--color-primary)' }}>
                  calendar_month
                </span>
                <span className={styles.statValue}>{data.stats.lessons_this_week}</span>
                <span className={styles.statLabel}>{t('dashboard.lessonsPerWeek')}</span>
              </div>
              <div
                className={styles.statCard}
                onClick={() => navigate('/courses')}
                style={{ cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '22px', color: 'var(--color-primary)' }}>
                  menu_book
                </span>
                <span className={styles.statValue}>{data.stats.total_courses}</span>
                <span className={styles.statLabel}>{t('dashboard.myCourses')}</span>
              </div>
            </div>
          </section>
        )}

        {/* Lessons Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('dashboard.upcomingLessons')}</h2>
            <button className={styles.seeAllButton} onClick={() => navigate('/courses')}>
              {t('common.all')}
            </button>
          </div>
          <div className={styles.lessonsList}>
            {lessons.length > 0 ? (
              lessons.map((lesson) => {
                const urgent = isLessThanAnHourAway(lesson.date, lesson.time)
                const ongoing = isLessonOngoing(lesson.date, lesson.time)
                const cardClass = `${styles.lessonCard} ${
                  ongoing ? styles.lessonCardOngoing : urgent ? styles.lessonCardUrgent : ''
                }`

                return (
                  <div
                    key={lesson.id}
                    className={cardClass}
                    onClick={() => navigate(`/course/${lesson.subject_id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                  <div className={styles.lessonTime}>
                    <span className={styles.lessonDay}>{lesson.day_label}</span>
                    <span className={styles.lessonHour}>{lesson.time}</span>
                  </div>
                  <div className={styles.lessonInfo}>
                    <h3 className={styles.lessonSubject}>{lesson.subject_name}</h3>
                    <div className={styles.lessonRoom}>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                        meeting_room
                      </span>
                      <span>{lesson.room}</span>
                    </div>
                  </div>
                  <LessonCountdown date={lesson.date} time={lesson.time} />
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)' }}>
                    chevron_right
                  </span>
                </div>
              )
            })
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

        {/* Results Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('dashboard.recentResults')}</h2>
          <div className={styles.resultsList}>
            {results.length > 0 ? (
              results.map((result) => (
                <div key={result.id} className={styles.resultCard}>
                  <div className={styles.resultHeader}>
                    <div className={styles.resultInfo}>
                      <div className={styles.resultIcon}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary)' }}>
                          {result.icon}
                        </span>
                      </div>
                      <span className={styles.resultSubject}>{result.subject_name}</span>
                    </div>
                    <span className={styles.resultScore}>
                      {result.score}/{result.max_score}
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${result.max_score > 0 ? (result.score / result.max_score) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-outline)' }}>
                  assignment
                </span>
                <p>{t('dashboard.noResults')}</p>
              </div>
            )}
          </div>
        </section>


        {/* Contact Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('dashboard.contacts')}</h2>
          <div className={styles.contactCard}>
            <div className={styles.mapWrapper}>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5YxlBVE-3vnfueYfCc4JAjnKDnpAoCQ4QSYKaV70BVuPDv0-rLVKaDjkKV09k17rI8HQEUVzvmSQOXgpb8ve07wE9ditbENCzeonuhV3BITVTGcKAtzDZ3Qiw-ZISR_Fevg7XaITU_dqiBIQWC4vvKwyos2uDMcsux1Hlu_9x0KmP9LmvcCMU0vSj10-ObIzcMLBPZW1iC9E9FHLafc_KuNcnAiJf4e4z-rfp_c7EE-tXdonzqxHSxe5nXN_3hvoBDGoZnioCicU"
                alt="Map"
                className={styles.mapImage}
              />
              <div className={styles.mapOverlay} />
              <div className={styles.addressBadge}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>
                  location_on
                </span>
                <span className={styles.addressText}>{t('dashboard.address', { address: getLocalized(CENTER.addressFull, i18n.language) })}</span>
              </div>
            </div>
            <div className={styles.instagramSection}>
              <div className={styles.instagramInfo}>
                <div className={styles.instagramIcon}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </div>
                <div>
                  <p className={styles.instagramLabel}>Instagram</p>
                  <p className={styles.instagramHandle}>@zuhra.math</p>
                </div>
              </div>
              <button
                className={styles.instagramButton}
                onClick={() => window.open('https://instagram.com/zuhra.math', '_blank')}
              >
                {t('dashboard.openInstagram')}
              </button>
            </div>
          </div>
        </section>

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
