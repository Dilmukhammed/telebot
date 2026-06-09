import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTeacherStudents } from '../api/hooks'
import SiteHeader from '../components/SiteHeader'
import styles from './TeacherStudents.module.css'

export default function TeacherStudents() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useTeacherStudents()
  const [filter, setFilter] = useState('')

  const students = data?.students ?? []

  const filteredStudents = students.filter(s => {
    if (!filter) return true
    const search = filter.toLowerCase()
    const name = (s.first_name || '').toLowerCase()
    const username = (s.username || '').toLowerCase()
    const phone = (s.phone || '').toLowerCase()
    return name.includes(search) || username.includes(search) || phone.includes(search)
  })

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <SiteHeader
        title={`${t('teacher.studentsTitle')} (${students.length})`}
        onBack={() => navigate('/dashboard')}
        hideProfile
      />

      <main className={styles.main}>

        {/* Search Filter */}
        <div className={styles.filterSection}>
          <div className={styles.searchBox}>
            <span className="material-symbols-outlined" style={{ color: '#7b7487' }}>search</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t('teacher.searchStudents')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {filter && (
              <button className={styles.clearBtn} onClick={() => setFilter('')}>
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Students List */}
        <div className={styles.studentsList}>
          {filteredStudents.length > 0 ? (
            filteredStudents.map((student) => (
              <div 
                key={student.id} 
                className={styles.studentCard}
                onClick={() => navigate(`/teacher/students/${student.id}`)}
              >
                <div className={styles.studentAvatar}>
                  {student.photo_url ? (
                    <img src={student.photo_url} alt="" className={styles.avatarImg} />
                  ) : (
                    <span className="material-symbols-outlined">person</span>
                  )}
                </div>
                <div className={styles.studentInfo}>
                  <h3 className={styles.studentName}>{student.first_name || (student.username ? `@${student.username}` : `#${student.id}`)}</h3>
                  <div className={styles.studentMeta}>
                    {student.username && (
                      <span className={styles.metaItem}>@{student.username}</span>
                    )}
                    {student.phone && (
                      <span className={styles.metaItem}>{student.phone}</span>
                    )}
                    {student.grade && (
                      <span className={styles.metaItem}>{student.grade} {t('teacher.gradeClass')}</span>
                    )}
                  </div>
                </div>
                <span className="material-symbols-outlined" style={{ color: '#7b7487', fontSize: '20px' }}>
                  chevron_right
                </span>
              </div>
            ))
          ) : (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>
                group
              </span>
              <p>{filter ? t('teacher.noStudentsFound') : t('teacher.noStudents')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
