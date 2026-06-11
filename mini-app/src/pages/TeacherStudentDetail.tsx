import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTeacherStudentDetail } from '../api/hooks'
import SiteHeader from '../components/SiteHeader'
import { getProfileCardStyle, hasProfileStatus, normalizeProfileTheme } from '../shared/profileTheme'
import styles from './TeacherStudentDetail.module.css'

export default function TeacherStudentDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data: student, isLoading, error } = useTeacherStudentDetail(parseInt(id || '0'))

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>{t('common.loading')}</div>
      </div>
    )
  }

  if (error || !student) {
    return (
      <div className={styles.page}>
        <SiteHeader title={t('teacher.studentDetail')} onBack={() => navigate(-1)} />
        <div className={styles.error}>{error?.message || t('common.error')}</div>
      </div>
    )
  }

  const displayName = student.first_name || (student.username ? `@${student.username}` : `#${student.id}`)
  const profileTheme = normalizeProfileTheme(student.profile_theme)
  const cardStyle = getProfileCardStyle(profileTheme)

  return (
    <div className={styles.page}>
      <SiteHeader
        title={t('teacher.studentDetail')}
        onBack={() => navigate(-1)}
      />

      <main className={styles.main}>

        {/* Student Profile */}
        <div className={styles.profileCard} style={cardStyle}>
          <div className={styles.avatar}>
            {student.photo_url ? (
              <img src={student.photo_url} alt={displayName} className={styles.avatarImg} />
            ) : (
              <span className="material-symbols-outlined">person</span>
            )}
          </div>
          <div className={styles.profileInfo}>
            <h2 className={styles.studentName}>
              {displayName}
              {student.last_name && ` ${student.last_name}`}
            </h2>
            {student.grade && (
              <span className={styles.grade}>{student.grade} {t('teacher.gradeClass')}</span>
            )}
            {hasProfileStatus(profileTheme) && (
              <p className={styles.statusLine}>
                {profileTheme.status_emoji && <span>{profileTheme.status_emoji}</span>}
                {profileTheme.status_text && <span>{profileTheme.status_text}</span>}
              </p>
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
          {student.courses && student.courses.length > 0 ? (
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
              <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--color-outline)' }}>
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
