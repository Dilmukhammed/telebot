import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCourses } from '../api/client'
import { useUser } from '../context/UserContext'
import type { CourseOut } from '../shared/types'
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
  const [courses, setCourses] = useState<CourseOut[]>([])
  const [loading, setLoading] = useState(true)

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin'

  useEffect(() => {
    getCourses()
      .then((c) => {
        const sorted = [...c].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        setCourses(sorted)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  return (
    <div className={styles.page}>
      <SiteHeader title={t('courses.title')} hideProfile />

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

          {/* Suggestion Section (students only) */}
          {!isTeacher && (
            <div className={styles.suggestionCard}>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA6qpCDxHSvYm_xQwV6y8C2IoXht-5Gt2ftuDvBS3q6WVwQA3damQw4aNo8RC4O0Tdkz_HrQYek-QomZEjFETKwWvb_8Aciqtt6jaDpL0O6vpQVaP3rn3hXxuJJ9VYXaeeyH2kUCLE31om1oGGQZ0pI_SjtsbJRazqCa9UfhkP27kiCdmAvBA57LL9uwbXTDai0SXzE6U4y40wFRspk7WEce7iZZ7wTO8k7xkQfMKfelDa0ZhtzRf4ift7JH5o_TaKcVG5l_CRAL5M"
                alt="Education"
                className={styles.suggestionImage}
              />
              <h3 className={styles.suggestionTitle}>{t('courses.suggestionTitle')}</h3>
              <p className={styles.suggestionText}>{t('courses.suggestionText')}</p>
              <button className={styles.suggestionButton}>
                {t('courses.exploreCatalog')}
              </button>
            </div>
          )}
        </div>

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
