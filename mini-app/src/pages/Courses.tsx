import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCourses } from '../api/hooks'
import { useUser } from '../context/UserContext'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './Courses.module.css'

const COURSE_ICONS: Record<string, string> = {
  'SAT Math': 'school',
  'Олимпиадная Математика': 'architecture',
  'Курсы для Абитуриентов': 'menu_book',
}

const COURSE_BADGES: Record<string, string> = {
  'SAT Math': 'Math Expert',
  'Олимпиадная Математика': 'Olympiad',
  'Курсы для Абитуриентов': 'Abiturient',
}

export default function Courses() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useUser()
  const { data: rawCourses, isLoading } = useCourses()
  const isStudent = user?.role === 'student'

  const courses = useMemo(() => {
    if (!rawCourses) return []
    return [...rawCourses].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [rawCourses])

  if (isLoading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  return (
    <div className={styles.page}>
      <SiteHeader title={t('courses.title')} />

      <main className={styles.main}>
        {/* Course Cards */}
        <div className={styles.coursesList}>
          {courses.length > 0 ? (
            courses.map((course) => (
              <div
                key={course.id}
                className={styles.courseCard}
                onClick={() => navigate(`/course/${course.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardInfo}>
                    <span className={styles.badge}>
                      {COURSE_BADGES[course.name] || 'Course'}
                    </span>
                    <h2 className={styles.courseTitle}>{course.name}</h2>
                  </div>
                  <div className={styles.cardRight}>
                    <div className={styles.cardIcon}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>
                        {COURSE_ICONS[course.name] || 'school'}
                      </span>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', fontSize: '20px' }}>
                      chevron_right
                    </span>
                  </div>
                </div>
                <div className={styles.teacherRow}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-outline)' }}>
                    person
                  </span>
                  <span className={styles.teacherName}>{course.teacher_name}</span>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>
                school
              </span>
              <p>{t('courses.noCourses')}</p>
            </div>
          )}
        </div>

        {/* Join Course Button for students */}
        {isStudent && (
          <button
            onClick={() => navigate('/join')}
            className={styles.joinCourseCard}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>key</span>
            {t('courses.joinByCode')}
          </button>
        )}

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
