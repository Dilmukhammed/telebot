import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import type { MaterialOut } from '../shared/types'
import {
  useCourseDetail,
  useCourseStudents,
  useMaterials,
  useDeleteMaterial,
  useAdminSubjectDetail,
  useAdminAuditLog,
  useAdminUsers,
} from '../api/hooks'
import {
  updateSubject,
  adminCreateLesson,
  adminUpdateLessonSchedule,
  adminEnrollStudentInCourse,
  adminUnenrollStudentFromCourse,
  archiveAdminSubject,
  unarchiveAdminSubject,
  toggleMaterialPin,
} from '../api/client'
import Avatar from '../components/Avatar'
import SiteHeader from '../components/SiteHeader'
import MaterialCard from '../components/MaterialCard'
import MaterialForm from '../components/MaterialForm'
import TimePicker from '../components/TimePicker'
import { Loading, Toast, Modal } from '../shared/components'
import {
  TodayLessonCard,
  UpcomingLessonCard,
  PastLessonCard,
} from './CourseDetail'
import styles from './CourseDetail.module.css'
import modalStyles from './AdminCourseDetail.module.css'

type Tab = 'lessons' | 'materials' | 'about' | 'students'

const MONTH_NAMES = {
  ru: ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'],
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  uz: ['YAN', 'FEV', 'MAR', 'APR', 'MAY', 'IYU', 'IYUL', 'AVG', 'SEN', 'OKT', 'NOY', 'DEK'],
}

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function AdminCourseDetail() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const courseId = Number(id)
  const isValidId = !isNaN(courseId) && courseId > 0

  const { data: course, isLoading, refetch: refetchCourse } = useCourseDetail(isValidId ? courseId : 0)
  const { data: adminMeta, refetch: refetchAdmin } = useAdminSubjectDetail(isValidId ? courseId : 0)
  const { data: students = [], isLoading: studentsLoading, refetch: refetchStudents } = useCourseStudents(isValidId ? courseId : 0)
  const { data: auditLogs = [] } = useAdminAuditLog({ entity_type: 'subject', entity_id: courseId, limit: 20 })
  const { data: allStudents = [] } = useAdminUsers('student')
  const { data: teachers = [] } = useAdminUsers('teacher')

  const [activeTab, setActiveTab] = useState<Tab>('lessons')
  const [copied, setCopied] = useState(false)
  const [showMaterialForm, setShowMaterialForm] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<number | null>(null)
  const [showAudit, setShowAudit] = useState(false)

  const { data: materials = [] } = useMaterials(courseId)
  const deleteMaterial = useDeleteMaterial()

  // Subject edit modal
  const [showSubjectEdit, setShowSubjectEdit] = useState(false)
  const [subjectForm, setSubjectForm] = useState({ name: '', description: '', duration_weeks: '', duration_minutes: '' })
  const [isIndefinite, setIsIndefinite] = useState(false)
  const [subjectSubmitting, setSubjectSubmitting] = useState(false)
  const [subjectError, setSubjectError] = useState('')

  // Create lesson modal
  const [showCreateLesson, setShowCreateLesson] = useState(false)
  const [lessonForm, setLessonForm] = useState({ teacher_name: '', teacher_id: '', specific_date: todayIsoDate(), time: '', room: '', max_capacity: '15' })
  const [lessonSubmitting, setLessonSubmitting] = useState(false)
  const [lessonError, setLessonError] = useState('')
  const [slotRequestSent, setSlotRequestSent] = useState(false)

  // Edit schedule slot modal
  const [showScheduleEdit, setShowScheduleEdit] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    lessonId: 0,
    day_of_week: '0',
    time: '',
    room: '',
    teacher_id: '',
    effective_from: todayIsoDate(),
  })
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)
  const [scheduleError, setScheduleError] = useState('')

  // Enroll modal
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [enrollFilter, setEnrollFilter] = useState('')

  // Unenroll confirm
  const [studentToUnenroll, setStudentToUnenroll] = useState<{ id: number; name: string } | null>(null)
  const [unenrollSubmitting, setUnenrollSubmitting] = useState(false)

  // Archive
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveConfirmName, setArchiveConfirmName] = useState('')
  const [archiveSubmitting, setArchiveSubmitting] = useState(false)

  const dayNames = Array.from({ length: 7 }, (_, i) => t(`courseDetail.daysShort.${i}`))
  const lang = i18n.language as 'ru' | 'en' | 'uz'
  const monthNames = MONTH_NAMES[lang] || MONTH_NAMES.ru

  const scheduleSlots = useMemo(() => {
    if (adminMeta?.lessons?.length) return adminMeta.lessons
    if (!course) return []
    const map = new Map<number, (typeof course.lessons)[0]>()
    for (const l of course.lessons) {
      if (!map.has(l.id)) map.set(l.id, l)
    }
    return [...map.values()].map(l => ({
      id: l.id,
      day_of_week: l.day_of_week,
      time: l.time,
      room: l.room,
      teacher_name: l.teacher_name,
      teacher_id: undefined as number | undefined,
    }))
  }, [adminMeta, course])

  const lessonSlotIds = scheduleSlots.map(s => s.id)

  const queryClient = useQueryClient()

  const refetchAll = async () => {
    await Promise.all([refetchCourse(), refetchAdmin(), refetchStudents()])
    await queryClient.invalidateQueries({ queryKey: ['admin-subjects'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-lessons'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-stats'] })
    await queryClient.invalidateQueries({ queryKey: ['calendar'] })
  }


  const handlePin = useCallback(async (id: number) => {
    try {
      const updated = await toggleMaterialPin(id)
      // Update all materials queries in cache
      queryClient.setQueriesData({ queryKey: ['materials'] }, (old: unknown) => {
        if (!Array.isArray(old)) return old
        const list = old.map((m: MaterialOut) => m.id === updated.id ? updated : m)
        // Re-sort: pinned first, then by created_at desc
        return list.sort((a: MaterialOut, b: MaterialOut) => {
          if (a.is_pinned !== b.is_pinned) return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      })
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Ошибка закрепления')
    }
  }, [queryClient])

  const formatStartDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'uz' ? 'uz-UZ' : 'ru-RU'
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const openSubjectEdit = () => {
    if (!course) return
    const indefinite = !course.duration_weeks
    setIsIndefinite(indefinite)
    setSubjectForm({
      name: course.name,
      description: course.description || '',
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
      const data: Record<string, unknown> = {}
      if (subjectForm.name) data.name = subjectForm.name
      data.description = subjectForm.description || null
      data.duration_weeks = isIndefinite ? null : (subjectForm.duration_weeks ? Number(subjectForm.duration_weeks) : null)
      if (subjectForm.duration_minutes) data.duration_minutes = Number(subjectForm.duration_minutes)
      await updateSubject(course.id, data)
      setShowSubjectEdit(false)
      await refetchAll()
    } catch (e: unknown) {
      setSubjectError(e instanceof Error ? e.message : t('admin.course_detail.save_error'))
    } finally {
      setSubjectSubmitting(false)
    }
  }

  const openScheduleEdit = (slot: { id: number; day_of_week: number; time: string; room: string; teacher_id?: number }) => {
    setScheduleForm({
      lessonId: slot.id,
      day_of_week: String(slot.day_of_week),
      time: slot.time,
      room: slot.room,
      teacher_id: slot.teacher_id ? String(slot.teacher_id) : '',
      effective_from: todayIsoDate(),
    })
    setScheduleError('')
    setShowScheduleEdit(true)
  }

  const handleScheduleSave = async () => {
    if (!scheduleForm.lessonId || !scheduleForm.time || !scheduleForm.room || !scheduleForm.effective_from) return
    setScheduleSubmitting(true)
    setScheduleError('')
    try {
      await adminUpdateLessonSchedule(scheduleForm.lessonId, {
        day_of_week: Number(scheduleForm.day_of_week),
        time: scheduleForm.time,
        room: scheduleForm.room,
        teacher_id: scheduleForm.teacher_id ? Number(scheduleForm.teacher_id) : undefined,
        effective_from: scheduleForm.effective_from,
      })
      setShowScheduleEdit(false)
      await refetchAll()
    } catch (e: unknown) {
      setScheduleError(e instanceof Error ? e.message : t('admin.course_detail.save_error'))
    } finally {
      setScheduleSubmitting(false)
    }
  }

  const openCreateLesson = () => {
    setLessonForm({ teacher_name: '', teacher_id: '', specific_date: todayIsoDate(), time: '', room: '', max_capacity: '15' })
    setLessonError('')
    setSlotRequestSent(false)
    setShowCreateLesson(true)
  }

  const handleCreateLesson = async () => {
    if (!course) return
    setLessonSubmitting(true)
    setLessonError('')
    setSlotRequestSent(false)
    try {
      await adminCreateLesson(course.id, {
        teacher_name: lessonForm.teacher_name,
        teacher_id: lessonForm.teacher_id ? Number(lessonForm.teacher_id) : undefined,
        specific_date: lessonForm.specific_date,
        time: lessonForm.time,
        room: lessonForm.room,
        max_capacity: Number(lessonForm.max_capacity) || 15,
      })
      setShowCreateLesson(false)
      await refetchAll()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('admin.course_detail.create_error')
      // 409 = slot request sent to teacher
      if (msg.includes('Запрос') || msg.includes('request') || msg.includes('409')) {
        setSlotRequestSent(true)
        setLessonError('')
      } else {
        setLessonError(msg)
      }
    } finally {
      setLessonSubmitting(false)
    }
  }

  const handleEnroll = async (userId: number) => {
    if (lessonSlotIds.length === 0) {
      alert(t('admin.course_detail.no_lessons_for_enroll'))
      return
    }
    try {
      await adminEnrollStudentInCourse(courseId, userId)
      setShowEnrollModal(false)
      await refetchAll()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('admin.course_detail.enroll_error'))
    }
  }

  const confirmUnenroll = async () => {
    if (!studentToUnenroll || lessonSlotIds.length === 0) return
    setUnenrollSubmitting(true)
    try {
      await adminUnenrollStudentFromCourse(courseId, studentToUnenroll.id)
      setStudentToUnenroll(null)
      await refetchAll()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('admin.course_detail.unenroll_error'))
    } finally {
      setUnenrollSubmitting(false)
    }
  }

  const handleArchive = async () => {
    if (!course || archiveConfirmName.trim() !== course.name) return
    setArchiveSubmitting(true)
    try {
      await archiveAdminSubject(course.id)
      navigate('/admin/courses')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('admin.course_detail.archive_error'))
    } finally {
      setArchiveSubmitting(false)
    }
  }

  const handleUnarchive = async () => {
    if (!course) return
    try {
      await unarchiveAdminSubject(course.id)
      await refetchAll()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('admin.course_detail.unarchive_error'))
    }
  }

  if (!isValidId) {
    return (
      <div className={styles.page}>
        <SiteHeader title={t('common.error')} onBack={() => navigate('/admin/courses')} />
        <div className={styles.emptyState}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>error</span>
          <p>{t('common.error')}</p>
        </div>
      </div>
    )
  }

  if (isLoading || !course) {
    return <Loading fullPage message={t('common.loading')} />
  }

  const todayLessons = course.lessons.filter(l => l.status === 'today')
  const upcomingLessons = course.lessons.filter(l => l.status === 'upcoming')
  const pastLessons = course.lessons.filter(l => l.status === 'past')
  const isArchived = adminMeta?.is_archived ?? false

  return (
    <div className={styles.page}>
      <SiteHeader title={course.name} onBack={() => navigate('/admin/courses')} />

      <nav className={styles.tabNav}>
        <button
          className={`${styles.tabButton} ${activeTab === 'lessons' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('lessons')}
        >
          {t('courseDetail.lessons')}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'materials' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('materials')}
        >
          {t('courseDetail.materials')}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'students' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('students')}
        >
          {t('courseDetail.studentsTab')}
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'about' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('about')}
        >
          {t('courseDetail.about')}
        </button>
      </nav>

      <main className={styles.main}>
        {isArchived && (
          <div className={styles.archivedBanner}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>archive</span>
            {t('admin.course_detail.course_in_archive')}
          </div>
        )}

        {activeTab === 'lessons' && (
          <>
            <div className={styles.tabSectionHeader}>
              <h2 className={styles.sectionTitle}>{t('courseDetail.lessons')}</h2>
              {!isArchived && (
                <button className={`${styles.adminChipBtn} ${styles.adminChipBtnPrimary}`} onClick={openCreateLesson}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                  {t('admin.course_detail.lesson')}
                </button>
              )}
            </div>

            {todayLessons.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>{t('courseDetail.today')}</h2>
                  <span className={styles.liveDot} />
                </div>
                {todayLessons.map(lesson => (
                  <TodayLessonCard
                    key={`${lesson.id}-${lesson.date}`}
                    lesson={lesson}
                    durationMinutes={course.duration_minutes}
                    onClick={lesson.is_frozen ? undefined : () => navigate(`/admin/lessons/${lesson.id}?date=${lesson.date}`)}
                  />
                ))}
              </section>
            )}

            {upcomingLessons.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('courseDetail.upcoming')}</h2>
                <div className={styles.lessonList}>
                  {upcomingLessons.map(lesson => (
                    <UpcomingLessonCard
                      key={`${lesson.id}-${lesson.date}`}
                      lesson={lesson}
                      monthNames={monthNames}
                      onClick={lesson.is_frozen ? undefined : () => navigate(`/admin/lessons/${lesson.id}?date=${lesson.date}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {pastLessons.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitleMuted}>{t('courseDetail.past')}</h2>
                <div className={styles.lessonList}>
                  {pastLessons.map(lesson => (
                    <PastLessonCard
                      key={`${lesson.id}-${lesson.date}`}
                      lesson={lesson}
                      monthNames={monthNames}
                      onClick={() => navigate(`/admin/lessons/${lesson.id}?date=${lesson.date}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {todayLessons.length === 0 && upcomingLessons.length === 0 && pastLessons.length === 0 && (
              <div className={styles.emptyState}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>event_busy</span>
                <p>{t('courseDetail.noLessons')}</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'materials' && (
          <>
            {materials.length > 0 ? (
              <section className={styles.section}>
                <div className={styles.materialsList}>
                  {materials.map((m) => (
                    <MaterialCard
                      key={m.id}
                      material={m}
                      canDelete
                      onDelete={(mid) => setMaterialToDelete(mid)}
                      canPin
                      onPin={handlePin}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <div className={styles.emptyState}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>folder_open</span>
                <p>{t('courseDetail.noMaterials')}</p>
              </div>
            )}
            <button className={styles.fab} onClick={() => setShowMaterialForm(true)}>
              <span className="material-symbols-outlined">add</span>
            </button>
          </>
        )}

        {activeTab === 'about' && (
          <section className={styles.aboutSection}>
            <div className={styles.tabSectionHeader}>
              <h3 className={styles.aboutLabel} style={{ margin: 0 }}>{t('courseDetail.about')}</h3>
              {!isArchived && (
                <button className={styles.adminChipBtn} onClick={openSubjectEdit}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                  {t('admin.course_detail.edit_course')}
                </button>
              )}
            </div>

            <div className={styles.aboutCard}>
              {course.description && (
                <>
                  <h3 className={styles.aboutLabel}>{t('courseDetail.description')}</h3>
                  <p className={styles.descriptionText}>{course.description}</p>
                </>
              )}
              <div className={styles.aboutRow}>
                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>person</span>
                <span className={styles.aboutRowLabel}>{t('courseDetail.teacher')}</span>
                <span className={styles.aboutRowValue}>{course.teacher_name}</span>
              </div>
              {course.location && (
                <div className={styles.aboutRow}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>location_on</span>
                  <span className={styles.aboutRowLabel}>{t('courseDetail.location')}</span>
                  <span className={styles.aboutRowValue}>{course.location}</span>
                </div>
              )}
              {course.invite_code && (
                <div
                  className={styles.aboutRow}
                  onClick={() => { navigator.clipboard.writeText(course.invite_code!); setCopied(true) }}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '20px' }}>key</span>
                  <span className={styles.aboutRowLabel}>{t('courseDetail.inviteCode')}</span>
                  <span className={styles.aboutRowValue} style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '2px' }}>
                    {course.invite_code}
                    <span className="material-symbols-outlined" style={{ fontSize: '14px', marginLeft: '8px', verticalAlign: 'middle', opacity: 0.6 }}>content_copy</span>
                  </span>
                </div>
              )}
            </div>

            <div className={styles.aboutCard}>
              <h3 className={styles.aboutLabel}>{t('courseDetail.schedule')}</h3>
              <div className={styles.scheduleList}>
                {scheduleSlots.map(slot => {
                  const dayName = t(`courseDetail.daysShort.${slot.day_of_week}`)
                  return (
                    <div key={slot.id} className={`${styles.scheduleItem} ${isArchived ? styles.scheduleItemFrozen : ''}`} style={{ gap: '8px' }}>
                      <span className={styles.scheduleDay}>{dayName}</span>
                      <span className={styles.scheduleTime}>{slot.time}</span>
                      <span className={styles.scheduleRoom}>{slot.room}</span>
                      {'teacher_name' in slot && slot.teacher_name && (
                        <span className={styles.scheduleRoom} style={{ marginLeft: 0, flex: 1, textAlign: 'left' }}>
                          {slot.teacher_name}
                        </span>
                      )}
                      {!isArchived && (
                        <button
                          type="button"
                          className={styles.adminChipBtn}
                          style={{ marginLeft: 'auto', flexShrink: 0, padding: '4px 10px' }}
                          onClick={() => openScheduleEdit({
                            id: slot.id,
                            day_of_week: slot.day_of_week,
                            time: slot.time,
                            room: slot.room,
                            teacher_id: 'teacher_id' in slot ? slot.teacher_id ?? undefined : undefined,
                          })}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-on-surface-variant)', margin: '8px 0 0' }}>
                {t('admin.course_detail.schedule_future_hint')}
              </p>
              <div className={styles.aboutDivider} />
              <div className={styles.aboutDetailsGrid}>
                <div className={styles.aboutDetail}>
                  <span className={styles.aboutDetailValue}>{course.lesson_count}</span>
                  <span className={styles.aboutDetailLabel}>{t('courseDetail.perWeek')}</span>
                </div>
                <div className={styles.aboutDetail}>
                  <span className={styles.aboutDetailValue}>{course.duration_minutes} {t('courseDetail.minutes')}</span>
                  <span className={styles.aboutDetailLabel}>{t('courseDetail.lessonDuration', { defaultValue: 'Длительность урока' })}</span>
                </div>
                <div className={styles.aboutDetail}>
                  <span className={styles.aboutDetailValue}>
                    {course.duration_weeks
                      ? `${course.duration_weeks} ${t('courseDetail.weeks')}`
                      : t('courseDetail.indefiniteDuration', { defaultValue: 'Постоянный курс' })}
                  </span>
                  <span className={styles.aboutDetailLabel}>{t('courseDetail.duration')}</span>
                </div>
                {course.start_date && (
                  <div className={styles.aboutDetail}>
                    <span className={styles.aboutDetailValue}>{formatStartDate(course.start_date)}</span>
                    <span className={styles.aboutDetailLabel}>{t('courseDetail.startDate', { defaultValue: 'Дата запуска' })}</span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.aboutCard}>
              <button className={styles.adminChipBtn} onClick={() => setShowAudit(!showAudit)}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>history</span>
                {showAudit ? t('admin.course_detail.hide_history') : t('admin.course_detail.history_changes')}
              </button>
              {showAudit && (
                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {auditLogs.length === 0 ? (
                    <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-on-surface-variant)', margin: 0 }}>
                      {t('admin.course_detail.no_history_records')}
                    </p>
                  ) : (
                    auditLogs.map(log => (
                      <div key={log.id} className={styles.auditCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontWeight: 600 }}>
                            {log.performed_by_name || t('admin.course_detail.system')}
                          </span>
                          <span style={{ color: 'var(--color-on-surface-variant)' }}>{log.performed_at}</span>
                        </div>
                        <div style={{ marginTop: '4px', color: 'var(--color-on-surface-variant)' }}>
                          {log.entity_type === 'subject' ? t('admin.course_detail.course') : t('admin.course_detail.lesson')}
                          {' · '}
                          {log.action === 'update' ? t('admin.course_detail.action_update') : log.action === 'create' ? t('admin.course_detail.action_create') : log.action}
                        </div>
                        {log.field_name && (
                          <div style={{ marginTop: '2px' }}>
                            <span style={{ color: 'var(--color-primary)' }}>{log.field_name}</span>
                            {log.old_value && <span style={{ textDecoration: 'line-through', color: 'var(--color-danger)', marginLeft: '4px' }}>{log.old_value.substring(0, 50)}</span>}
                            {log.new_value && <span style={{ color: '#4ab97e', marginLeft: '4px' }}>→ {log.new_value.substring(0, 50)}</span>}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: '8px' }}>
              {isArchived ? (
                <button className={styles.primaryOutlineBtn} onClick={handleUnarchive}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>unarchive</span>
                  {t('admin.course_detail.unarchive_course')}
                </button>
              ) : (
                <button className={styles.dangerBtn} onClick={() => { setArchiveConfirmName(''); setShowArchiveModal(true) }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>archive</span>
                  {t('admin.course_detail.archive_course')}
                </button>
              )}
            </div>
          </section>
        )}

        {activeTab === 'students' && (
          <div className={styles.studentsTab}>
            <div className={styles.tabSectionHeader}>
              <h2 className={styles.sectionTitle}>{t('courseDetail.studentsTab')}</h2>
              {!isArchived && (
                <button className={`${styles.adminChipBtn} ${styles.adminChipBtnPrimary}`} onClick={() => { setShowEnrollModal(true); setEnrollFilter('') }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_add</span>
                  {t('admin.course_detail.add')}
                </button>
              )}
            </div>

            {studentsLoading ? (
              <div className={styles.loading}>{t('common.loading')}</div>
            ) : students.length > 0 ? (
              <div className={styles.studentsList}>
                {students.map((student) => (
                  <div key={student.id} className={styles.studentCard}>
                    <div
                      className={styles.studentAvatar}
                      onClick={() => navigate(`/admin/people/${student.id}`)}
                    >
                      <Avatar photoUrl={student.photo_url} name={student.first_name} size={40} />
                    </div>
                    <div className={styles.studentInfo} onClick={() => navigate(`/admin/people/${student.id}`)}>
                      <h3 className={styles.studentName}>
                        {student.first_name || `@${student.username}`}
                      </h3>
                      <div className={styles.studentMeta}>
                        {student.username && <span className={styles.metaItem}>@{student.username}</span>}
                        {student.phone && <span className={styles.metaItem}>{student.phone}</span>}
                        {student.grade && <span className={styles.metaItem}>{t('profile.grade', { grade: student.grade })}</span>}
                      </div>
                    </div>
                    <div className={styles.studentCardActions}>
                      {!isArchived && (
                        <button
                          className={styles.iconBtn}
                          onClick={(e) => {
                            e.stopPropagation()
                            setStudentToUnenroll({
                              id: student.id,
                              name: student.first_name || (student.username ? `@${student.username}` : `#${student.id}`),
                            })
                          }}
                          title={t('admin.course_detail.unenroll')}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_remove</span>
                        </button>
                      )}
                      <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.7 }}>
                        chevron_right
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-on-surface-variant)' }}>group</span>
                <p>{t('admin.course_detail.no_students_enrolled')}</p>
              </div>
            )}
          </div>
        )}

        <div className={styles.bottomSpacer} />
      </main>

      {copied && (
        <Toast message={t('admin.course_detail.code_copied')} onClose={() => setCopied(false)} />
      )}

      {showMaterialForm && (
        <MaterialForm
          subjectId={courseId}
          onClose={() => setShowMaterialForm(false)}
        />
      )}

      {studentToUnenroll !== null && (
        <Modal
          isOpen={studentToUnenroll !== null}
          onClose={() => !unenrollSubmitting && setStudentToUnenroll(null)}
          title={t('admin.course_detail.unenroll_confirm_title')}
        >
          <div className={styles.deleteConfirmContent}>
            <p className={styles.deleteConfirmText}>{t('admin.course_detail.unenroll_confirm')}</p>
            <div className={styles.deleteConfirmItem}>
              <span className="material-symbols-outlined" style={{ marginRight: '8px', color: 'var(--color-primary)' }}>
                person
              </span>
              <span className={styles.deleteConfirmItemTitle}>{studentToUnenroll.name}</span>
            </div>
            <div className={styles.deleteConfirmButtons}>
              <button
                className={styles.deleteCancelBtn}
                onClick={() => setStudentToUnenroll(null)}
                disabled={unenrollSubmitting}
              >
                {t('common.cancel')}
              </button>
              <button
                className={styles.deleteConfirmBtn}
                onClick={confirmUnenroll}
                disabled={unenrollSubmitting}
              >
                {unenrollSubmitting ? '...' : t('admin.course_detail.unenroll')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {materialToDelete !== null && (
        <Modal
          isOpen={materialToDelete !== null}
          onClose={() => setMaterialToDelete(null)}
          title={t('courseDetail.deleteConfirmTitle')}
        >
          <div className={styles.deleteConfirmContent}>
            <p className={styles.deleteConfirmText}>{t('courseDetail.deleteConfirmText')}</p>
            <div className={styles.deleteConfirmButtons}>
              <button className={styles.deleteCancelBtn} onClick={() => setMaterialToDelete(null)}>
                {t('common.cancel')}
              </button>
              <button
                className={styles.deleteConfirmBtn}
                onClick={() => {
                  deleteMaterial.mutate(materialToDelete, { onSuccess: () => setMaterialToDelete(null) })
                }}
              >
                {t('common.delete', { defaultValue: 'Удалить' })}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showSubjectEdit && (
        <div className={modalStyles.modalOverlay} onClick={() => setShowSubjectEdit(false)}>
          <div className={modalStyles.modal} onClick={e => e.stopPropagation()}>
            <div className={modalStyles.modalHandle} />
            <div className={modalStyles.modalHeader}>
              <h3 className={modalStyles.modalTitle}>{t('admin.course_detail.edit_course')}</h3>
              <button className={modalStyles.modalClose} onClick={() => setShowSubjectEdit(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
            {subjectError && <div className={modalStyles.modalError}>{subjectError}</div>}
            <div className={modalStyles.modalActions}>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>{t('admin.course_detail.course_name')}</label>
                <input className={modalStyles.timeInput} value={subjectForm.name} onChange={e => setSubjectForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>{t('admin.course_detail.course_description')}</label>
                <input className={modalStyles.timeInput} value={subjectForm.description} onChange={e => setSubjectForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className={modalStyles.field} style={{ flex: 1 }}>
                  <label className={modalStyles.fieldLabel}>{t('admin.course_detail.weeks')}</label>
                  <input type="number" min="1" className={modalStyles.timeInput} value={subjectForm.duration_weeks} onChange={e => setSubjectForm(p => ({ ...p, duration_weeks: e.target.value }))} disabled={isIndefinite} style={{ opacity: isIndefinite ? 0.5 : 1 }} />
                </div>
                <div className={modalStyles.field} style={{ flex: 1 }}>
                  <label className={modalStyles.fieldLabel}>{t('admin.course_detail.minutes_per_lesson')}</label>
                  <input type="number" min="1" className={modalStyles.timeInput} value={subjectForm.duration_minutes} onChange={e => setSubjectForm(p => ({ ...p, duration_minutes: e.target.value }))} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={isIndefinite} onChange={e => setIsIndefinite(e.target.checked)} />
                <span style={{ fontSize: '14px' }}>{t('admin.course_detail.indefinite_course')}</span>
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className={modalStyles.modalBtnSecondary} onClick={() => setShowSubjectEdit(false)} style={{ flex: 1 }}>{t('common.cancel')}</button>
                <button className={modalStyles.modalBtn} onClick={handleSubjectSave} style={{ flex: 1 }} disabled={subjectSubmitting}>
                  {subjectSubmitting ? t('admin.course_detail.saving') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScheduleEdit && (
        <div className={modalStyles.modalOverlay} onClick={() => setShowScheduleEdit(false)}>
          <div className={modalStyles.modal} onClick={e => e.stopPropagation()}>
            <div className={modalStyles.modalHandle} />
            <div className={modalStyles.modalHeader}>
              <h3 className={modalStyles.modalTitle}>{t('admin.course_detail.edit_schedule')}</h3>
              <button className={modalStyles.modalClose} onClick={() => setShowScheduleEdit(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
            {scheduleError && <div className={modalStyles.modalError}>{scheduleError}</div>}
            <div className={modalStyles.modalActions}>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>{t('admin.course_detail.schedule_effective_from')}</label>
                <input
                  type="date"
                  className={modalStyles.timeInput}
                  value={scheduleForm.effective_from}
                  min={todayIsoDate()}
                  onChange={e => setScheduleForm(p => ({ ...p, effective_from: e.target.value }))}
                />
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-on-surface-variant)' }}>
                  {t('admin.course_detail.schedule_effective_from_hint')}
                </span>
              </div>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>{t('admin.course_detail.teacher')}</label>
                <select
                  className={modalStyles.timeInput}
                  value={scheduleForm.teacher_id}
                  onChange={e => setScheduleForm(p => ({ ...p, teacher_id: e.target.value }))}
                >
                  <option value="">{t('admin.course_detail.select_teacher')}</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.first_name} {teacher.last_name || ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>{t('admin.course_detail.day_of_week')}</label>
                <select className={modalStyles.timeInput} value={scheduleForm.day_of_week} onChange={e => setScheduleForm(p => ({ ...p, day_of_week: e.target.value }))}>
                  {dayNames.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className={modalStyles.field} style={{ flex: 1 }}>
                  <label className={modalStyles.fieldLabel}>{t('admin.course_detail.time')}</label>
                  <TimePicker value={scheduleForm.time} onChange={val => setScheduleForm(p => ({ ...p, time: val }))} />
                </div>
                <div className={modalStyles.field} style={{ flex: 1 }}>
                  <label className={modalStyles.fieldLabel}>{t('admin.course_detail.room')}</label>
                  <input className={modalStyles.timeInput} value={scheduleForm.room} onChange={e => setScheduleForm(p => ({ ...p, room: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className={modalStyles.modalBtnSecondary} onClick={() => setShowScheduleEdit(false)} style={{ flex: 1 }}>{t('common.cancel')}</button>
                <button className={modalStyles.modalBtn} onClick={handleScheduleSave} style={{ flex: 1 }} disabled={scheduleSubmitting || !scheduleForm.time || !scheduleForm.room || !scheduleForm.effective_from}>
                  {scheduleSubmitting ? t('admin.course_detail.saving') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateLesson && (
        <div className={modalStyles.modalOverlay} onClick={() => setShowCreateLesson(false)}>
          <div className={modalStyles.modal} onClick={e => e.stopPropagation()}>
            <div className={modalStyles.modalHandle} />
            <div className={modalStyles.modalHeader}>
              <h3 className={modalStyles.modalTitle}>{t('admin.course_detail.new_lesson')}</h3>
              <button className={modalStyles.modalClose} onClick={() => setShowCreateLesson(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
            {lessonError && <div className={modalStyles.modalError}>{lessonError}</div>}
            {slotRequestSent && (
              <div style={{ padding: '12px 16px', background: 'rgba(33, 150, 243, 0.08)', borderRadius: '12px', fontSize: '13px', color: '#1976d2', lineHeight: 1.5 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: 4 }}>send</span>
                Запрос отправлен учителю. После согласования занятие появится в расписании.
              </div>
            )}
            <div className={modalStyles.modalActions}>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>{t('admin.course_detail.teacher')}</label>
                <select
                  className={modalStyles.timeInput}
                  value={lessonForm.teacher_id}
                  onChange={e => {
                    const tid = e.target.value
                    const t = teachers.find(t => String(t.id) === tid)
                    setLessonForm(p => ({
                      ...p,
                      teacher_id: tid,
                      teacher_name: t ? `${t.first_name || ''} ${t.last_name || ''}`.trim() : '',
                    }))
                  }}
                >
                  <option value="">{t('admin.course_detail.select_teacher')}</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.first_name} {teacher.last_name || ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className={modalStyles.field}>
                <label className={modalStyles.fieldLabel}>Дата</label>
                <input className={modalStyles.timeInput} type="date" min={todayIsoDate()} value={lessonForm.specific_date} onChange={e => setLessonForm(p => ({ ...p, specific_date: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className={modalStyles.field} style={{ flex: 1 }}>
                  <label className={modalStyles.fieldLabel}>{t('admin.course_detail.time')}</label>
                  <TimePicker value={lessonForm.time} onChange={val => setLessonForm(p => ({ ...p, time: val }))} />
                </div>
                <div className={modalStyles.field} style={{ flex: 1 }}>
                  <label className={modalStyles.fieldLabel}>{t('admin.course_detail.room')}</label>
                  <input className={modalStyles.timeInput} value={lessonForm.room} onChange={e => setLessonForm(p => ({ ...p, room: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className={modalStyles.modalBtnSecondary} onClick={() => setShowCreateLesson(false)} style={{ flex: 1 }}>{t('common.cancel')}</button>
                <button className={modalStyles.modalBtn} onClick={handleCreateLesson} style={{ flex: 1 }} disabled={lessonSubmitting || !lessonForm.teacher_id || !lessonForm.time || !lessonForm.room || !lessonForm.specific_date}>
                  {lessonSubmitting ? t('admin.course_detail.creating') : slotRequestSent ? 'Запрос отправлен' : t('admin.course_detail.create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEnrollModal && (
        <div className={modalStyles.modalOverlay} onClick={() => setShowEnrollModal(false)}>
          <div className={modalStyles.modal} onClick={e => e.stopPropagation()}>
            <div className={modalStyles.modalHandle} />
            <div className={modalStyles.modalHeader}>
              <h3 className={modalStyles.modalTitle}>{t('admin.course_detail.enroll_student')}</h3>
              <button className={modalStyles.modalClose} onClick={() => setShowEnrollModal(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
            <input
              className={modalStyles.timeInput}
              placeholder={t('admin.course_detail.search_by_name')}
              value={enrollFilter}
              onChange={e => setEnrollFilter(e.target.value)}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
              {allStudents
                .filter(s => {
                  const enrolledIds = new Set(students.map(st => st.id))
                  if (enrolledIds.has(s.id)) return false
                  if (!enrollFilter) return true
                  const name = `${s.first_name || ''} ${s.last_name || ''} ${s.username || ''}`.toLowerCase()
                  return name.includes(enrollFilter.toLowerCase())
                })
                .map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleEnroll(s.id)}
                    className={modalStyles.modalBtnSecondary}
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

      {showArchiveModal && (
        <div className={modalStyles.modalOverlay} onClick={() => setShowArchiveModal(false)}>
          <div className={modalStyles.modal} onClick={e => e.stopPropagation()}>
            <div className={modalStyles.modalHandle} />
            <div className={modalStyles.modalHeader}>
              <h3 className={modalStyles.modalTitle}>{t('admin.course_detail.archive_course')}</h3>
              <button className={modalStyles.modalClose} onClick={() => setShowArchiveModal(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
            <div className={modalStyles.modalActions}>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-on-surface-variant)', margin: 0 }}>
                {t('admin.course_detail.archive_hint_1')}
              </p>
              <p style={{ fontSize: 'var(--font-sm)', fontWeight: 600, margin: '8px 0' }}>{course.name}</p>
              <div className={modalStyles.field}>
                <input
                  className={modalStyles.timeInput}
                  value={archiveConfirmName}
                  onChange={e => setArchiveConfirmName(e.target.value)}
                  placeholder={t('admin.course_detail.enter_name_placeholder')}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className={modalStyles.modalBtnSecondary} onClick={() => setShowArchiveModal(false)} style={{ flex: 1 }}>
                  {t('common.cancel')}
                </button>
                <button
                  className={modalStyles.modalBtn}
                  onClick={handleArchive}
                  disabled={archiveConfirmName.trim() !== course.name || archiveSubmitting}
                  style={{ flex: 1, background: '#d32f2f' }}
                >
                  {archiveSubmitting ? t('admin.course_detail.archiving') : t('admin.course_detail.archive')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
