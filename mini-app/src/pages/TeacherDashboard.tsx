import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTeacherDashboard, useAnnouncements, useEnrollmentRequests, useApproveEnrollment, useRejectEnrollment } from '../api/hooks'

import Avatar from '../components/Avatar'
import SiteHeader from '../components/SiteHeader'
import LessonCountdown from '../components/LessonCountdown'
import MiniCalendar from '../components/MiniCalendar'
import { Loading } from '../shared/components'
import { getGreeting, getTodayLessonsStatus, isLessThanAnHourAway, isLessonOngoing } from '../utils/lessonHelpers'
import styles from './Dashboard.module.css'
import { useUser } from '../context/UserContext'

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
              <Avatar photoUrl={req.photo_url} name={req.user_name} size={44} />
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
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useUser()
  const { data, isLoading, error } = useTeacherDashboard()
  const { data: announcements = [] } = useAnnouncements('teacher')
  const unreadCount = useMemo(
    () => announcements.filter(n => !n.is_read && n.sender_id !== user?.id).length,
    [announcements, user?.id]
  )

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

  return (
    <div className={styles.page}>
      <SiteHeader announcementCount={unreadCount} />

      <main className={styles.main}>
        {/* Welcome Section */}
        <div className={styles.welcomeCard}>
          <div className={styles.welcomeLeft}>
            <h1 className={styles.welcomeGreeting}>
              {getGreeting(profile.first_name, t)}
            </h1>
            <p className={styles.welcomeStatus}>
              <span className={styles.welcomeRoleBadge}>
                <span className="material-symbols-outlined" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>stars</span>
                {t('profile.teacher')}
              </span>
              <span>{getTodayLessonsStatus(lessons, t)}</span>
            </p>
          </div>

          <MiniCalendar language={i18n.language} />
        </div>

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
