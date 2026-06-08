import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAdminAnnouncements,
  createAdminAnnouncement,
  getAdminSubjects,
  getAdminUsers,
} from '../api/client'
import type {
  AdminAnnouncementOut,
  AdminSubjectOut,
  UserOut,
  AdminAnnouncementCreate,
} from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import styles from './AdminAnnouncements.module.css'

const formatDate = (isoString: string) => {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

export default function AdminAnnouncements() {
  const navigate = useNavigate()
  const [announcements, setAnnouncements] = useState<AdminAnnouncementOut[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetType, setTargetType] = useState<AdminAnnouncementCreate['target_type']>('all')
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([])

  const [courses, setCourses] = useState<AdminSubjectOut[]>([])
  const [students, setStudents] = useState<UserOut[]>([])
  const [teachers, setTeachers] = useState<UserOut[]>([])
  const [targetId, setTargetId] = useState<number | ''>('')

  const loadData = () => {
    setLoading(true)
    getAdminAnnouncements()
      .then(setAnnouncements)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (modalOpen) {
      getAdminSubjects().then(setCourses).catch(console.error)
      getAdminUsers({ role: 'student' }).then(setStudents).catch(console.error)
      getAdminUsers({ role: 'teacher' }).then(setTeachers).catch(console.error)
    }
  }, [modalOpen])

  const handleCreateClick = () => {
    setTitle('')
    setMessage('')
    setTargetType('all')
    setSelectedCourseIds([])
    setSelectedStudentIds([])
    setTargetId('')
    setError('')
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message) {
      setError('Текст объявления обязателен')
      return
    }
    if (targetType === 'course' && selectedCourseIds.length === 0) {
      setError('Выберите хотя бы один курс')
      return
    }
    if (targetType === 'specific_students' && selectedStudentIds.length === 0) {
      setError('Выберите хотя бы одного ученика')
      return
    }
    if (targetType === 'teacher_courses' && !targetId) {
      setError('Выберите преподавателя')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await createAdminAnnouncement({
        title: title || undefined,
        message,
        target_type: targetType,
        course_ids: targetType === 'course' ? selectedCourseIds : undefined,
        student_ids: targetType === 'specific_students' ? selectedStudentIds : undefined,
        target_id: targetType === 'teacher_courses' ? Number(targetId) : undefined,
      })
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      setError(err.message || 'Ошибка отправки')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleCourse = (id: number) => {
    setSelectedCourseIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const toggleStudent = (id: number) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  return (
    <div className={styles.page}>
      <SiteHeader title="Объявления" onBack={() => navigate('/dashboard')} hideProfile />

      <main className={styles.main}>
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>Объявления</h2>
          <button className={styles.createBtn} onClick={handleCreateClick}>
            <span className="material-symbols-outlined">add</span>
            <span>Новое</span>
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : announcements.length === 0 ? (
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>campaign</span>
            <p>Нет объявлений</p>
          </div>
        ) : (
          <div className={styles.list}>
            {announcements.map(a => (
              <div key={a.id} className={styles.card} onClick={() => navigate(`/admin/announcements/${a.id}`)} style={{ cursor: 'pointer' }}>
                <div className={styles.cardHeader}>
                  <span className={styles.target}>{a.target_summary}</span>
                  <span className={styles.date}>{formatDate(a.sent_at)}</span>
                </div>
                {a.title && <h4 className={styles.cardTitle}>{a.title}</h4>}
                <p className={styles.cardMessage}>{a.message}</p>
                <div className={styles.cardFooter}>
                  <span>{a.recipient_count} получателей</span>
                  {a.sender_name && <span>от {a.sender_name}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create modal */}
        {modalOpen && (
          <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHandle} />
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Новое объявление</h3>
                <button className={styles.modalClose} onClick={() => setModalOpen(false)}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>
              <p className={styles.modalSub}>Будет отправлено в Telegram</p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                <div className={styles.field}>
                  <label>Тема (необязательно)</label>
                  <input type="text" placeholder="Тема..." value={title} onChange={e => setTitle(e.target.value)} />
                </div>

                <div className={styles.field}>
                  <label>Кому</label>
                  <select value={targetType} onChange={e => setTargetType(e.target.value as AdminAnnouncementCreate['target_type'])}>
                    <option value="all">Всем</option>
                    <option value="teachers">Преподавателям</option>
                    <option value="students">Ученикам</option>
                    <option value="course">Слушателям курсов</option>
                    <option value="specific_students">Выбранным ученикам</option>
                    <option value="teacher_courses">Курсы преподавателя</option>
                  </select>
                </div>

                {targetType === 'course' && (
                  <div className={styles.field}>
                    <label>Курсы</label>
                    <div className={styles.checkboxList}>
                      {courses.map(c => (
                        <label key={c.id} className={styles.checkbox}>
                          <input type="checkbox" checked={selectedCourseIds.includes(c.id)} onChange={() => toggleCourse(c.id)} />
                          <span>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {targetType === 'specific_students' && (
                  <div className={styles.field}>
                    <label>Ученики</label>
                    <div className={styles.checkboxList}>
                      {students.map(s => (
                        <label key={s.id} className={styles.checkbox}>
                          <input type="checkbox" checked={selectedStudentIds.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                          <span>{s.first_name} {s.last_name || ''}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {targetType === 'teacher_courses' && (
                  <div className={styles.field}>
                    <label>Преподаватель</label>
                    <select value={targetId} onChange={e => setTargetId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">Выберите преподавателя</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.first_name} {t.last_name || ''} {t.username ? `(@${t.username})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={styles.field}>
                  <label>Сообщение</label>
                  <textarea placeholder="Текст сообщения..." value={message} onChange={e => setMessage(e.target.value)} />
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>
                    Отмена
                  </button>
                  <button type="submit" className={styles.submitBtn} disabled={submitting}>
                    {submitting ? 'Отправка...' : 'Отправить'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
