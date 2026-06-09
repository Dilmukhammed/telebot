import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAdminSubjectDetail, useAdminAuditLog, useAdminUsers } from '../api/hooks'
import {
  updateSubject,
  adminCreateLesson,
  adminEnrollStudent,
  adminUnenrollStudent,
  archiveAdminSubject,
  unarchiveAdminSubject,
} from '../api/client'
import SiteHeader from '../components/SiteHeader'
import styles from './AdminCourseDetail.module.css'

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export default function AdminCourseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const courseId = Number(id)
  const { data: course, isLoading, error, refetch } = useAdminSubjectDetail(courseId)
  const { data: auditLogs = [] } = useAdminAuditLog({ entity_type: 'subject', entity_id: courseId, limit: 20 })
  const { data: allStudents = [] } = useAdminUsers('student')

  // Subject edit modal
  const [showSubjectEdit, setShowSubjectEdit] = useState(false)
  const [subjectForm, setSubjectForm] = useState({ name: '', description: '', start_date: '', duration_weeks: '', duration_minutes: '' })
  const [isIndefinite, setIsIndefinite] = useState(false)
  const [subjectSubmitting, setSubjectSubmitting] = useState(false)
  const [subjectError, setSubjectError] = useState('')

  // Create lesson modal
  const [showCreateLesson, setShowCreateLesson] = useState(false)
  const [lessonForm, setLessonForm] = useState({ teacher_name: '', teacher_id: '', day_of_week: '0', time: '', room: '', max_capacity: '15' })
  const [lessonSubmitting, setLessonSubmitting] = useState(false)
  const [lessonError, setLessonError] = useState('')

  // Enroll modal
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [enrollFilter, setEnrollFilter] = useState('')

  // Audit log
  const [showAudit, setShowAudit] = useState(false)

  // Archive
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveConfirmName, setArchiveConfirmName] = useState('')
  const [archiveSubmitting, setArchiveSubmitting] = useState(false)

  const handleArchive = async () => {
    if (!course) return
    if (archiveConfirmName.trim() !== course.name) return
    setArchiveSubmitting(true)
    try {
      await archiveAdminSubject(course.id)
      navigate('/admin/courses')
    } catch (e: any) {
      alert(e.message || 'Ошибка архивации')
    } finally {
      setArchiveSubmitting(false)
    }
  }

  const handleUnarchive = async () => {
    if (!course) return
    try {
      await unarchiveAdminSubject(course.id)
      await refetch()
    } catch (e: any) {
      alert(e.message || 'Ошибка разархивации')
    }
  }

  // ── Subject Edit ──
  const openSubjectEdit = () => {
    if (!course) return
    const indefinite = !course.duration_weeks
    setIsIndefinite(indefinite)
    setSubjectForm({
      name: course.name,
      description: course.description || '',
      start_date: course.start_date || '',
      duration_weeks: indefinite ? '' : (course.duration_weeks?.toString() || ''),
      duration_minutes: course.duration_minutes?.toString() || '90',
    })
    setSubjectError('')
    setShowSubjectEdit(true)
  }

  const handleSubjectSave = async () => {
    if (!course) return
    setSubjectSubmitting(true)
    setSubjectError('')
    try {
      const data: any = {}
      if (subjectForm.name) data.name = subjectForm.name
      data.description = subjectForm.description || null
      if (subjectForm.start_date) data.start_date = subjectForm.start_date
      data.duration_weeks = isIndefinite ? null : (subjectForm.duration_weeks ? Number(subjectForm.duration_weeks) : null)
      if (subjectForm.duration_minutes) data.duration_minutes = Number(subjectForm.duration_minutes)
      await updateSubject(course.id, data)
      setShowSubjectEdit(false)
      refetch()
    } catch (e: any) {
      setSubjectError(e.message || 'Ошибка сохранения')
    } finally {
      setSubjectSubmitting(false)
    }
  }

  // ── Create Lesson ──
  const openCreateLesson = () => {
    setLessonForm({ teacher_name: '', teacher_id: '', day_of_week: '0', time: '', room: '', max_capacity: '15' })
    setLessonError('')
    setShowCreateLesson(true)
  }

  const handleCreateLesson = async () => {
    if (!course) return
    setLessonSubmitting(true)
    setLessonError('')
    try {
      await adminCreateLesson(course.id, {
        teacher_name: lessonForm.teacher_name,
        teacher_id: lessonForm.teacher_id ? Number(lessonForm.teacher_id) : undefined,
        day_of_week: Number(lessonForm.day_of_week),
        time: lessonForm.time,
        room: lessonForm.room,
        max_capacity: Number(lessonForm.max_capacity) || 15,
      })
      setShowCreateLesson(false)
      refetch()
    } catch (e: any) {
      setLessonError(e.message || 'Ошибка создания')
    } finally {
      setLessonSubmitting(false)
    }
  }

  // ── Enroll / Unenroll ──
  const openEnroll = () => {
    setShowEnrollModal(true)
    setEnrollFilter('')
  }

  const handleEnroll = async (userId: number) => {
    const lessons = course?.lessons
    if (!lessons || lessons.length === 0) { alert('Нет уроков для записи'); return }
    try {
      await Promise.all(lessons.map(l => adminEnrollStudent(l.id, userId)))
      setShowEnrollModal(false)
      refetch()
    } catch (e: any) {
      alert(e.message || 'Ошибка записи')
    }
  }

  const handleUnenroll = async (userId: number) => {
    const lessons = course?.lessons
    if (!lessons || lessons.length === 0) return
    if (!confirm('Отписать ученика от курса?')) return
    try {
      await Promise.all(lessons.map(l => adminUnenrollStudent(l.id, userId)))
      refetch()
    } catch (e: any) {
      alert(e.message || 'Ошибка отписки')
    }
  }

  // ── Audit Log ──
  const toggleAudit = () => {
    setShowAudit(!showAudit)
  }

  // ── Helpers ──
  const getStudentInitials = (s: any) => {
    if (s.first_name) return s.first_name[0].toUpperCase()
    if (s.username) return s.username[0].toUpperCase()
    return '?'
  }

  const getStudentGradientClass = (name: string, styleMap: any) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const gradients = ['purple', 'teal', 'blue', 'orange', 'rose', 'green']
    return styleMap[`gradient_${gradients[hash % gradients.length]}`] || ''
  }

  if (isLoading) return <div className={styles.loading}>Загрузка...</div>
  if (error || !course) {
    return (
      <div className={styles.page}>
        <SiteHeader title="Курс" onBack={() => navigate('/admin/courses')} hideProfile />
        <main className={styles.main}>
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>error</span>
            <p>{error?.message || 'Курс не найден'}</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <SiteHeader title={course.name} onBack={() => navigate('/admin/courses')} hideProfile />

      <main className={styles.main}>
        {/* Header card */}
        <div className={styles.headerCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h1 className={styles.title}>{course.name}</h1>
              {course.description && <p className={styles.desc}>{course.description}</p>}
              <div className={styles.metaRow}>
                <span className={styles.metaTag}>{course.duration_minutes} мин.</span>
                {course.duration_weeks && <span className={styles.metaTag}>{course.duration_weeks} нед.</span>}
                {course.start_date && (
                  <span className={styles.metaTag}>С {new Date(course.start_date).toLocaleDateString('ru-RU')}</span>
                )}
              </div>
            </div>
            <button
              onClick={openSubjectEdit}
              style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#fff' }}>edit</span>
            </button>
          </div>
          {course.is_archived && (
            <div style={{ marginTop: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.15)', borderRadius: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>archive</span>
              Курс в архиве
            </div>
          )}
        </div>

        {/* Lessons */}
        <section className={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
            <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Расписание ({course.lessons.length})</h3>
            <button
              onClick={openCreateLesson}
              style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-full)', padding: '6px 14px', cursor: 'pointer', fontSize: 'var(--font-xs)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
              Урок
            </button>
          </div>
          {course.lessons.length === 0 ? (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#7b7487' }}>event_busy</span>
              <p>Нет занятия</p>
            </div>
          ) : (
            <div className={styles.list}>
              {course.lessons.map(l => {
                const statusClass = l.lesson_status === 'cancelled' ? styles.cancelled
                  : l.lesson_status === 'happened' ? styles.happened
                  : l.lesson_status === 'rescheduled' ? styles.rescheduled : ''
                return (
                  <div
                    key={l.id}
                    className={`${styles.lessonCard} ${statusClass}`}
                    onClick={() => navigate(`/admin/lessons/${l.id}?date=${l.date}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className={styles.lessonMainContent}>
                      <div className={styles.lessonTimeBlock}>
                        <span className={styles.timeBlockDate}>
                          {new Date(l.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className={styles.timeBlockDay}>{l.day_name}</span>
                        <span className={styles.timeBlockTime}>{l.time}</span>
                      </div>

                      <div className={styles.lessonDetails}>
                        <div className={styles.lessonMetaRow}>
                          <div className={styles.lessonMetaItem}>
                            <span className="material-symbols-outlined">school</span>
                            <span>{l.teacher_name}</span>
                          </div>
                          {l.room && (
                            <div className={styles.lessonMetaItem}>
                              <span className="material-symbols-outlined">meeting_room</span>
                              <span>Каб: {l.room}</span>
                            </div>
                          )}
                          <div className={styles.lessonMetaItem}>
                            <span className="material-symbols-outlined">groups</span>
                            <span>{l.student_count} уч.</span>
                          </div>
                        </div>

                        <div className={styles.lessonStatusRow}>
                          <span className={`${styles.statusBadge} ${styles[`status_${l.lesson_status || 'planned'}`]}`}>
                            {l.lesson_status === 'cancelled' ? 'Отменен'
                              : l.lesson_status === 'happened' ? 'Проведен'
                              : l.lesson_status === 'rescheduled' ? 'Перенесен'
                              : 'Запланирован'}
                          </span>
                        </div>
                      </div>

                      <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.5, fontSize: '18px' }}>chevron_right</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Students */}
        <section className={styles.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
            <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Ученики ({course.students?.length || 0})</h3>
            <button
              onClick={openEnroll}
              style={{ background: 'var(--color-gray-100)', border: 'none', borderRadius: 'var(--radius-full)', padding: '6px 14px', cursor: 'pointer', fontSize: 'var(--font-xs)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_add</span>
              Добавить
            </button>
          </div>
          {!course.students || course.students.length === 0 ? (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#7b7487' }}>group</span>
              <p>Нет зачисленных</p>
            </div>
          ) : (
            <div className={styles.studentList}>
              {course.students.map(s => (
                <div key={s.id} className={styles.studentCard}>
                  <div className={`${styles.studentAvatar} ${getStudentGradientClass(s.first_name || '', styles)}`} onClick={() => navigate(`/admin/people/${s.id}`)}>
                    {s.photo_url ? <img src={s.photo_url} alt="" className={styles.avatarImg} /> : getStudentInitials(s)}
                  </div>
                  <div className={styles.studentInfo} onClick={() => navigate(`/admin/people/${s.id}`)}>
                    <div className={styles.studentName}>{s.first_name} {s.last_name || ''}</div>
                    {s.grade && <div className={styles.studentMeta}>{s.grade} кл.</div>}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUnenroll(s.id) }}
                    title="Отписать"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_remove</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Audit Log */}
        <section className={styles.section}>
          <button
            onClick={toggleAudit}
            style={{ background: 'var(--color-gray-100)', border: 'none', borderRadius: 'var(--radius-full)', padding: '8px 16px', cursor: 'pointer', fontSize: 'var(--font-xs)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history</span>
            {showAudit ? 'Скрыть историю' : 'История изменений'}
          </button>
          {showAudit && (
            <div style={{ marginTop: '12px' }}>
              {auditLogs.length === 0 ? (
                <div className={styles.emptyState}><p>Нет записей</p></div>
              ) : (
                <div className={styles.list}>
                  {auditLogs.map(log => (
                    <div key={log.id} className={styles.lessonCard} style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)' }}>
                        <span style={{ fontWeight: 600 }}>
                          {log.performed_by_name || 'Система'}
                          <span style={{ color: 'var(--color-on-surface-variant)', fontWeight: 400, marginLeft: '6px' }}>
                            ({log.performed_by_type === 'admin' ? 'Админ' : 'Препод'})
                          </span>
                        </span>
                        <span style={{ color: 'var(--color-on-surface-variant)' }}>{log.performed_at}</span>
                      </div>
                      <div style={{ marginTop: '4px', fontSize: 'var(--font-xs)', color: 'var(--color-on-surface-variant)' }}>
                        {log.entity_type === 'subject' ? 'Курс' : 'Урок'} #{log.entity_id}
                        {' · '}{log.action === 'update' ? 'изменено' : log.action === 'create' ? 'создано' : log.action === 'toggle_active' ? 'статус' : log.action === 'enroll' ? 'запись' : log.action === 'unenroll' ? 'отписка' : log.action}
                      </div>
                      {log.field_name && (
                        <div style={{ marginTop: '2px', fontSize: 'var(--font-xs)' }}>
                          <span style={{ color: 'var(--color-primary)' }}>{log.field_name}</span>:
                          {log.old_value && <span style={{ textDecoration: 'line-through', color: 'var(--color-danger)', marginLeft: '4px' }}>{log.old_value.substring(0, 50)}</span>}
                          {log.new_value && <span style={{ color: '#4ab97e', marginLeft: '4px' }}>→ {log.new_value.substring(0, 50)}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Subject Edit Modal ── */}
        {showSubjectEdit && (
          <div className={styles.modalOverlay} onClick={() => setShowSubjectEdit(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHandle} />
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Редактировать курс</h3>
                <button className={styles.modalClose} onClick={() => setShowSubjectEdit(false)}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>
              {subjectError && <div className={styles.modalError}>{subjectError}</div>}
              <div className={styles.modalActions}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Название</label>
                  <input className={styles.timeInput} value={subjectForm.name} onChange={e => setSubjectForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Описание</label>
                  <input className={styles.timeInput} value={subjectForm.description} onChange={e => setSubjectForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Дата старта</label>
                  <input type="date" className={styles.timeInput} value={subjectForm.start_date} onChange={e => setSubjectForm(p => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label className={styles.fieldLabel}>Недель</label>
                    <input type="number" min="1" className={styles.timeInput} value={subjectForm.duration_weeks} onChange={e => setSubjectForm(p => ({ ...p, duration_weeks: e.target.value }))} disabled={isIndefinite} style={{ opacity: isIndefinite ? 0.5 : 1 }} />
                  </div>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label className={styles.fieldLabel}>Минут/занятие</label>
                    <input type="number" min="1" className={styles.timeInput} value={subjectForm.duration_minutes} onChange={e => setSubjectForm(p => ({ ...p, duration_minutes: e.target.value }))} />
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isIndefinite} onChange={e => setIsIndefinite(e.target.checked)} />
                  <span style={{ fontSize: '14px' }}>Бессрочный курс</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className={styles.modalBtnSecondary} onClick={() => setShowSubjectEdit(false)} style={{ flex: 1 }}>Отмена</button>
                  <button className={styles.modalBtn} onClick={handleSubjectSave} style={{ flex: 1 }} disabled={subjectSubmitting}>
                    {subjectSubmitting ? 'Сохранение...' : 'Сохранить'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Create Lesson Modal ── */}
        {showCreateLesson && (
          <div className={styles.modalOverlay} onClick={() => setShowCreateLesson(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHandle} />
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Новый урок</h3>
                <button className={styles.modalClose} onClick={() => setShowCreateLesson(false)}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>
              {lessonError && <div className={styles.modalError}>{lessonError}</div>}
              <div className={styles.modalActions}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Преподаватель</label>
                  <input className={styles.timeInput} value={lessonForm.teacher_name} onChange={e => setLessonForm(p => ({ ...p, teacher_name: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>День недели</label>
                  <select className={styles.timeInput} value={lessonForm.day_of_week} onChange={e => setLessonForm(p => ({ ...p, day_of_week: e.target.value }))}>
                    {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label className={styles.fieldLabel}>Время</label>
                    <input type="time" className={styles.timeInput} value={lessonForm.time} onChange={e => setLessonForm(p => ({ ...p, time: e.target.value }))} />
                  </div>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label className={styles.fieldLabel}>Кабинет</label>
                    <input className={styles.timeInput} value={lessonForm.room} onChange={e => setLessonForm(p => ({ ...p, room: e.target.value }))} />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Макс. учеников</label>
                  <input type="number" min="1" className={styles.timeInput} value={lessonForm.max_capacity} onChange={e => setLessonForm(p => ({ ...p, max_capacity: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className={styles.modalBtnSecondary} onClick={() => setShowCreateLesson(false)} style={{ flex: 1 }}>Отмена</button>
                  <button className={styles.modalBtn} onClick={handleCreateLesson} style={{ flex: 1 }} disabled={lessonSubmitting || !lessonForm.teacher_name || !lessonForm.time || !lessonForm.room}>
                    {lessonSubmitting ? 'Создание...' : 'Создать'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Enroll Student Modal ── */}
        {showEnrollModal && (
          <div className={styles.modalOverlay} onClick={() => setShowEnrollModal(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHandle} />
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Записать ученика</h3>
                <button className={styles.modalClose} onClick={() => setShowEnrollModal(false)}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>
              <input
                className={styles.timeInput}
                placeholder="Поиск по имени..."
                value={enrollFilter}
                onChange={e => setEnrollFilter(e.target.value)}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                {allStudents
                  .filter(s => {
                    const enrolledIds = new Set(course?.students?.map(st => st.id) || [])
                    if (enrolledIds.has(s.id)) return false
                    if (!enrollFilter) return true
                    const name = `${s.first_name || ''} ${s.last_name || ''} ${s.username || ''}`.toLowerCase()
                    return name.includes(enrollFilter.toLowerCase())
                  })
                  .map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleEnroll(s.id)}
                      className={styles.modalBtnSecondary}
                      style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <span>{s.first_name} {s.last_name || ''}</span>
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Archive / Unarchive Section ── */}
        <section className={styles.section} style={{ marginTop: '24px' }}>
          {course.is_archived ? (
            <button
              onClick={handleUnarchive}
              style={{
                width: '100%', padding: '14px', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-primary)', background: 'var(--color-primary-container)',
                color: 'var(--color-primary)', fontWeight: 600, fontSize: 'var(--font-sm)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>unarchive</span>
              Разархивировать курс
            </button>
          ) : (
            <button
              onClick={() => { setArchiveConfirmName(''); setShowArchiveModal(true) }}
              style={{
                width: '100%', padding: '14px', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-error, #d32f2f)', background: 'transparent',
                color: 'var(--color-error, #d32f2f)', fontWeight: 600, fontSize: 'var(--font-sm)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>archive</span>
              Архивировать курс
            </button>
          )}
        </section>

        {/* ── Archive Confirmation Modal ── */}
        {showArchiveModal && course && (
          <div className={styles.modalOverlay} onClick={() => setShowArchiveModal(false)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHandle} />
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Архивировать курс</h3>
                <button className={styles.modalClose} onClick={() => setShowArchiveModal(false)}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>
              <div className={styles.modalActions}>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-on-surface-variant)', marginBottom: '12px' }}>
                  Курс будет скрыт от учеников и преподавателей, но останется в архиве для просмотра.
                </p>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-on-surface-variant)', marginBottom: '8px' }}>
                  Введите название курса для подтверждения:
                </p>
                <p style={{ fontSize: 'var(--font-sm)', fontWeight: 600, marginBottom: '12px', color: 'var(--color-on-surface)' }}>
                  {course.name}
                </p>
                <div className={styles.field}>
                  <input
                    className={styles.timeInput}
                    value={archiveConfirmName}
                    onChange={e => setArchiveConfirmName(e.target.value)}
                    placeholder="Введите название..."
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button className={styles.modalBtnSecondary} onClick={() => setShowArchiveModal(false)} style={{ flex: 1 }}>
                    Отмена
                  </button>
                  <button
                    className={styles.modalBtnPrimary}
                    onClick={handleArchive}
                    disabled={archiveConfirmName.trim() !== course.name || archiveSubmitting}
                    style={{ flex: 1, opacity: archiveConfirmName.trim() !== course.name ? 0.5 : 1, background: '#d32f2f', color: '#fff' }}
                  >
                    {archiveSubmitting ? 'Архивация...' : 'Архивировать'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
