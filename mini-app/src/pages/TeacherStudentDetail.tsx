import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getTeacherStudentDetail } from '../api/client'
import type { TeacherStudentDetailOut } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import styles from './TeacherStudentDetail.module.css'

export default function TeacherStudentDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<TeacherStudentDetailOut | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      getTeacherStudentDetail(parseInt(id))
        .then(setStudent)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [id])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>{t('common.loading')}</div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>{t('common.error')}</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <SiteHeader
        title={t('teacher.studentDetail')}
        onBack={() => navigate(-1)}
        hideProfile
      />

      <main className={styles.main}>

        {/* Student Profile */}
        <div className={styles.profileCard}>
          <div className={styles.avatar}>
            {student.photo_url ? (
              <img src={student.photo_url} alt="" className={styles.avatarImg} />
            ) : (
              <span className="material-symbols-outlined">person</span>
            )}
          </div>
          <div className={styles.profileInfo}>
            <h2 className={styles.studentName}>
              {student.first_name || `@${student.username}`}
              {student.last_name && ` ${student.last_name}`}
            </h2>
            {student.grade && (
              <span className={styles.grade}>{student.grade} {t('teacher.gradeClass')}</span>
            )}
          </div>
        </div>

        {/* Contact Info */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('teacher.contactInfo')}</h3>
          <div className={styles.contactList}>
            {student.username && (
              <a
                href={`https://t.me/${student.username}`}
                className={styles.contactLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>send</span>
                <span className={styles.contactText}>@{student.username}</span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', marginLeft: 'auto', color: 'var(--color-on-surface-variant)', opacity: 0.7 }}>open_in_new</span>
              </a>
            )}
            {student.phone && (
              <a href={`tel:${student.phone}`} className={styles.contactLink}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>call</span>
                <span className={styles.contactText}>{student.phone}</span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', marginLeft: 'auto', color: 'var(--color-on-surface-variant)', opacity: 0.7 }}>call</span>
              </a>
            )}
          </div>
        </div>

        {/* Courses & Attendance */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('teacher.coursesAttendance')}</h3>
          {student.courses.length > 0 ? (
            <div className={styles.coursesList}>
              {student.courses.map((course) => (
                <div key={course.subject_id} className={styles.courseCard}>
                  <div className={styles.courseHeader}>
                    <span className={styles.courseName}>{course.subject_name}</span>
                    <span className={styles.attendancePercent}>
                      {course.attendance_percent}%
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill} 
                      style={{ width: `${course.attendance_percent}%` }}
                    />
                  </div>
                  <span className={styles.attendanceDetail}>
                    {course.attended_lessons}/{course.total_lessons} {t('teacher.lessonsAttended')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#7b7487' }}>
                school
              </span>
              <p>{t('teacher.noCourses')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
