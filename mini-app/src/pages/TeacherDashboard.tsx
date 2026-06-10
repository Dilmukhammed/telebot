import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTeacherDashboard, useAnnouncements, useEnrollmentRequests, useApproveEnrollment, useRejectEnrollment } from '../api/hooks'

import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './Dashboard.module.css'
import { useUser } from '../context/UserContext'

/** Safe countdown — never produces NaN, works on iOS/Safari */
function LessonCountdown({ date, time, inline }: { date?: string; time?: string; inline?: boolean }) {
  const { t } = useTranslation()
  const [label, setLabel] = useState('')
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!date || !time) return

    function calc() {
      const diff = getTashkentDiffMs(date, time)
      if (isNaN(diff)) return

      if (diff <= 0) {
        if (diff > -90 * 60 * 1000) {
          setLabel(t('dashboard.countdown.happeningNow'))
          setActive(true)
        } else {
          setLabel('')
          setActive(false)
        }
        return
      }

      setActive(false)
      const totalMin = Math.floor(diff / 60000)
      const h = Math.floor(totalMin / 60)
      const d = Math.floor(h / 24)

      if (d > 0) {
        const word = d === 1 ? t('dashboard.countdown.day') : d < 5 ? t('dashboard.countdown.daysFew') : t('dashboard.countdown.days')
        setLabel(t('dashboard.countdown.inDays', { count: d, word }))
      } else if (h > 0) {
        const remMin = totalMin % 60
        setLabel(remMin > 0 ? t('dashboard.countdown.inHoursMinutes', { h, m: remMin }) : t('dashboard.countdown.inHours', { h }))
      } else {
        setLabel(t('dashboard.countdown.inMinutes', { m: totalMin }))
      }
    }

    calc()
    const id = setInterval(calc, 30_000)
    return () => clearInterval(id)
  }, [date, time, t])

  if (!label) return null

  if (inline) {
    return (
      <span className={`${styles.countdownInline} ${active ? styles.countdownActiveInline : ''}`}>
        {active && <span className={styles.pulseDot} />}
        {label}
      </span>
    )
  }

  return (
    <span className={`${styles.countdownBadge} ${active ? styles.countdownActive : ''}`}>
      {active && <span className={styles.pulseDot} />}
      {label}
    </span>
  )
}

const getTashkentDiffMs = (dateStr?: string, timeStr?: string): number => {
  if (!dateStr || !timeStr) return NaN
  try {
    const dp = dateStr.split('-').map(Number)   // [YYYY, MM, DD]
    const tp = timeStr.split(':').map(Number)   // [HH, MM]
    if (dp.length < 3 || tp.length < 2) return NaN
    if (dp.some(isNaN) || tp.some(isNaN)) return NaN

    const utcMs = Date.UTC(dp[0], dp[1] - 1, dp[2], tp[0], tp[1], 0)
    const tashkentOffsetMs = 5 * 60 * 60 * 1000
    return utcMs - tashkentOffsetMs - Date.now()
  } catch {
    return NaN
  }
}

const isLessThanAnHourAway = (dateStr?: string, timeStr?: string): boolean => {
  const diff = getTashkentDiffMs(dateStr, timeStr)
  return !isNaN(diff) && diff > 0 && diff < 60 * 60 * 1000
}

const isLessonOngoing = (dateStr?: string, timeStr?: string): boolean => {
  const diff = getTashkentDiffMs(dateStr, timeStr)
  return !isNaN(diff) && diff <= 0 && diff > -90 * 60 * 1000
}

function EnrollmentRequestsSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: requests = [], isLoading } = useEnrollmentRequests()
  const approveMutation = useApproveEnrollment()
  const rejectMutation = useRejectEnrollment()

  if (isLoading || requests.length === 0) return null

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{t('teacher.enrollmentRequests')}</h2>
        <span style={{
          background: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
          borderRadius: 'var(--radius-full)',
          padding: '2px 10px',
          fontSize: 'var(--font-xs)',
          fontWeight: 600,
        }}>
          {requests.length}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {requests.map((req) => (
          <div
            key={req.id}
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <button
              type="button"
              onClick={() => navigate(`/teacher/students/${req.user_id}`)}
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--color-primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
              }}>
                {req.photo_url ? (
                  <img
                    src={req.photo_url}
                    alt={req.user_name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: '22px', color: 'var(--color-primary)' }}>
                    person
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-sm)', color: 'var(--color-on-surface)' }}>
                  {req.user_name}
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-on-surface-variant)' }}>
                  {req.subject_name}
                  {req.grade ? ` · ${t('dashboard.grade', { grade: req.grade })}` : ''}
                </div>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-on-surface-variant)', flexShrink: 0 }}>
                chevron_right
              </span>
            </button>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={() => rejectMutation.mutate(req.id)}
                disabled={rejectMutation.isPending}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-error, #dc2626)',
                  background: 'transparent',
                  color: 'var(--color-error, #dc2626)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
              <button
                onClick={() => approveMutation.mutate(req.id)}
                disabled={approveMutation.isPending}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  background: 'var(--color-success, #16a34a)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}


export default function TeacherDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useUser()
  const { data, isLoading, error } = useTeacherDashboard()
  const { data: announcements = [] } = useAnnouncements('teacher')
  const unreadCount = announcements.filter(
    n => !n.is_read && n.sender_id !== user?.id
  ).length

  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
  const telegramAvatar = tgUser?.photo_url

  if (isLoading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-outline)' }}>error</span>
          <p style={{ color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>{error?.message || t('common.error')}</p>
          <button
            onClick={() => window.location.reload()}
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
      <SiteHeader avatarUrl={avatarUrl} announcementCount={unreadCount} />

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
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: 'var(--color-primary)' }}>
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
              <span className="material-symbols-outlined" style={{ fontSize: '22px', color: 'var(--color-primary)' }}>
                groups
              </span>
              <span className={styles.statValue}>{stats.total_students}</span>
              <span className={styles.statLabel}>{t('teacher.totalStudents')}</span>
            </div>
          </div>
        </section>

        {/* Enrollment Requests */}
        <EnrollmentRequestsSection />

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
                        <LessonCountdown date={lesson.date} time={lesson.time} inline />
                      </div>
                    </div>
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

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
