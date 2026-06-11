import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLessonDetail, useAdminLessonAttendance } from '../api/hooks'
import {
  markAdminLessonStatus,
  adminMarkAttendance,
  adminUpdateLesson,
} from '../api/client'
import type { AttendanceRecordIn } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import { langToLocale } from '../shared/utils/formatDate'
import styles from './LessonDetail.module.css'

export default function AdminLessonDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const date = searchParams.get('date')
  const numId = Number(id)

  const { data: lessonRaw, isLoading, error, refetch } = useLessonDetail(numId, date || undefined)
  // Force is_teacher=true so admin can see all teacher features
  const lesson = lessonRaw ? { ...lessonRaw, is_teacher: true } : null

  const { data: attendanceData, refetch: refetchAttendance } = useAdminLessonAttendance(
    lesson?.id ?? 0,
    lesson?.date ?? ''
  )
  const [attendance, setAttendance] = useState<typeof attendanceData>(undefined)
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [attendanceError, setAttendanceError] = useState<string | null>(null)
  const [attendanceSaved, setAttendanceSaved] = useState(false)
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editPlan, setEditPlan] = useState<{ title: string; description: string }[]>([])
  const [savingEdit, setSavingEdit] = useState(false)

  // Sync attendance data from query
  useEffect(() => {
    if (attendanceData) setAttendance(attendanceData)
  }, [attendanceData])

  const handleMarkStatus = async (status: 'happened' | 'cancelled') => {
    if (!lesson) return
    setSavingStatus(true)
    try {
      await markAdminLessonStatus(lesson.id, { date: lesson.date, status })
      await refetch()
      if (status === 'happened') {
        await refetchAttendance()
      }
    } catch (e: any) {
      alert(e.message || 'Error')
    } finally {
      setSavingStatus(false)
    }
  }

  const handleToggleAttendance = (userId: number) => {
    if (!attendance) return
    setAttendanceSaved(false)
    setAttendance({
      ...attendance,
      records: attendance.records.map((r) =>
        r.user_id === userId ? { ...r, present: !r.present } : r
      ),
    })
  }

  const handleSaveAttendance = async () => {
    if (!lesson || !attendance) return
    setSavingAttendance(true)
    setAttendanceError(null)
    try {
      const records: AttendanceRecordIn[] = attendance.records.map((r) => ({
        user_id: r.user_id,
        present: r.present,
      }))
      const result = await adminMarkAttendance(lesson.id, lesson.date, records)
      setAttendance(result)
      setAttendanceError(null)
      setAttendanceSaved(true)
    } catch (e: any) {
      setAttendanceError(e.message || 'Error saving attendance')
    } finally {
      setSavingAttendance(false)
    }
  }

  const handleSaveTitle = async () => {
    if (!lesson) return
    setSavingEdit(true)
    try {
      await adminUpdateLesson(lesson.id, { custom_title: editTitle.trim() || null })
      await refetch()
      setShowTitleModal(false)
    } catch (e: any) {
      console.error(e)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleSavePlan = async () => {
    if (!lesson) return
    setSavingEdit(true)
    try {
      const planJson = JSON.stringify(editPlan.filter(item => item.title.trim()))
      await adminUpdateLesson(lesson.id, { lesson_plan: planJson })
      await refetch()
      setShowPlanModal(false)
    } catch (e: any) {
      console.error(e)
    } finally {
      setSavingEdit(false)
    }
  }

  const openTitleModal = () => {
    setEditTitle(lesson?.title || '')
    setShowTitleModal(true)
  }

  const openPlanModal = () => {
    setEditPlan(lesson?.agenda.map(a => ({ title: a.title, description: a.description || '' })) || [{ title: '', description: '' }])
    setShowPlanModal(true)
  }

  if (isLoading) return <Loading fullPage message={t('common.loading')} />

  const currentLocale = langToLocale(i18n.language)
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString(currentLocale, { day: 'numeric', month: 'long' })
  }

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'slides': return 'present_to_all'
      case 'worksheet': return 'description'
      case 'video': return 'video_library'
      default: return 'description'
    }
  }

  if (error || !lesson) {
    return (
      <div className={styles.page}>
        <SiteHeader title={t('admin.lesson_detail.lesson')} onBack={() => navigate(-1)} />
        <div className={styles.errorState}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ba1a1a' }}>error</span>
          <p>{error?.message || t('admin.lesson_detail.error')}</p>
          <button onClick={() => navigate(-1)} className={styles.backButton}>{t('common.back')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <SiteHeader title={t('admin.lesson_detail.lesson')} onBack={() => navigate(-1)} />

      <main className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.courseTag}>{lesson.subject_name}</div>
          <div className={styles.titleRow}>
            <h2 className={styles.lessonTitle}>{lesson.title}</h2>
            <button className={styles.editBtn} onClick={openTitleModal}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
            </button>
          </div>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className="material-symbols-outlined">calendar_today</span>
              <span>{formatDate(lesson.date)}</span>
            </div>
            <div className={styles.metaItem}>
              <span className="material-symbols-outlined">schedule</span>
              <span>{lesson.time} - {lesson.end_time}</span>
            </div>
            <div className={styles.metaItemFull}>
              <span className="material-symbols-outlined">location_on</span>
              <span>{lesson.room}{lesson.location ? `, ${lesson.location}` : ''}</span>
            </div>
          </div>
        </header>

        {/* Instructor */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('admin.lesson_detail.teacher')}</h3>
          <div className={styles.instructorCard}>
            <div className={styles.instructorAvatar}>
              {lesson.teacher_photo_url ? (
                <img src={lesson.teacher_photo_url} alt={lesson.teacher_name} />
              ) : (
                <span className="material-symbols-outlined">person</span>
              )}
            </div>
            <div className={styles.instructorInfo}>
              <p className={styles.instructorName}>{lesson.teacher_name}</p>
              {lesson.teacher_title && <p className={styles.instructorTitle}>{lesson.teacher_title}</p>}
            </div>
            {lesson.teacher_username && (
              <a href={`https://t.me/${lesson.teacher_username}`} target="_blank" rel="noopener noreferrer" className={styles.telegramButton}>
                <span className="material-symbols-outlined" style={{ transform: 'rotate(-30deg) translate(1px, -1px)', fontSize: '18px' }}>send</span>
              </a>
            )}
          </div>
        </section>

        {/* Lesson Status & Attendance */}
        {(lesson.status === 'past' || lesson.status === 'today') && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('admin.lesson_detail.lesson_status')}</h3>
            {!lesson.lesson_status ? (
              <div className={styles.statusPrompt}>
                <p className={styles.statusPromptText}>{t('admin.lesson_detail.mark_status')}</p>
                <div className={styles.statusButtons}>
                  <button className={styles.happenedButton} onClick={() => handleMarkStatus('happened')} disabled={savingStatus}>
                    <span className="material-symbols-outlined">check_circle</span>
                    {t('admin.lesson_detail.status_happened')}
                  </button>
                  <button className={styles.cancelledButton} onClick={() => handleMarkStatus('cancelled')} disabled={savingStatus}>
                    <span className="material-symbols-outlined">cancel</span>
                    {t('admin.lesson_detail.status_cancelled')}
                  </button>
                </div>
              </div>
            ) : lesson.lesson_status === 'happened' ? (
              <div className={styles.attendanceSection}>
                <h4 className={styles.attendanceTitle}>{t('admin.lesson_detail.attendance')}</h4>
                {attendance ? (
                  <>
                    <div className={`${styles.attendanceList} ${(attendanceSaved || attendance.saved) ? styles.attendanceListLocked : ''}`}>
                      {attendance.records.map((record) => (
                        <div
                          key={record.user_id}
                          className={`${styles.attendanceItem} ${record.present ? styles.attendanceItemPresent : ''}`}
                          onClick={() => !(attendanceSaved || attendance.saved) && handleToggleAttendance(record.user_id)}
                        >
                          <div className={styles.attendanceUser}>
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                              {record.present ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            <span>{record.first_name}</span>
                          </div>
                          <span className={`${styles.attendanceStatus} ${record.present ? styles.attendanceStatusPresent : styles.attendanceStatusAbsent}`}>
                            {record.present ? t('admin.lesson_detail.present') : t('admin.lesson_detail.absent')}
                          </span>
                        </div>
                      ))}
                    </div>
                    {attendanceSaved ? (
                      <div className={styles.attendanceSavedBanner}>
                        <span className="material-symbols-outlined">check_circle</span>
                        <span>{t('admin.lesson_detail.attendance_saved')}</span>
                      </div>
                    ) : !attendance.saved ? (
                      <button className={styles.saveAttendanceButton} onClick={handleSaveAttendance} disabled={savingAttendance}>
                        {savingAttendance ? '...' : t('admin.lesson_detail.save_attendance')}
                      </button>
                    ) : null}
                    {attendanceError && (
                      <p style={{ color: '#ba1a1a', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>{attendanceError}</p>
                    )}
                  </>
                ) : (
                  <Loading message={t('common.loading')} />
                )}
              </div>
            ) : (
              <div className={styles.cancelledBadge}>
                <span className="material-symbols-outlined">block</span>
                <span>{t('admin.lesson_detail.lesson_cancelled')}</span>
              </div>
            )}
          </section>
        )}

        {/* Lesson Plan */}
        <section className={styles.section}>
          <div className={styles.sectionTitleRow}>
            <h3 className={styles.sectionTitle}>{t('admin.lesson_detail.lesson_plan')}</h3>
            {lesson.agenda.length > 0 && (
              <button className={styles.editBtn} onClick={openPlanModal}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
              </button>
            )}
          </div>
          {lesson.agenda.length > 0 ? (
            <div className={styles.timeline}>
              {lesson.agenda.map((item, index) => (
                <div key={item.id} className={styles.timelineItem}>
                  <div className={styles.timelineDot}>
                    <div className={styles.dot} />
                    {index < lesson.agenda.length - 1 && <div className={styles.timelineLine} />}
                  </div>
                  <div className={styles.timelineContent}>
                    <h4 className={styles.timelineTitle}>{item.title}</h4>
                    {item.description && <p className={styles.timelineDescription}>{item.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button className={styles.emptyPlanBtn} onClick={openPlanModal}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>add_notes</span>
              <span>{t('admin.lesson_detail.add_plan')}</span>
            </button>
          )}
        </section>

        {/* Materials */}
        {lesson.materials.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('admin.lesson_detail.materials')}</h3>
            <div className={styles.materialsScroll}>
              {lesson.materials.map((material) => (
                <button key={material.id} className={styles.materialCard}>
                  <span className={`material-symbols-outlined ${styles.materialIcon}`}>{getMaterialIcon(material.type)}</span>
                  <span className={styles.materialTitle}>{material.title}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Homework */}
        {lesson.homework && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('admin.lesson_detail.homework')}</h3>
            <div className={`${styles.homeworkCard} ${styles[lesson.homework.status]}`}>
              <div className={styles.homeworkBadge}>
                <span className={`${styles.homeworkBadgeText} ${styles[lesson.homework.status]}`}>
                  {lesson.homework.status === 'pending' ? t('admin.lesson_detail.homework_pending') : lesson.homework.status === 'submitted' ? t('admin.lesson_detail.homework_submitted') : t('admin.lesson_detail.homework_reviewed')}
                </span>
              </div>
              <div className={styles.homeworkContent}>
                <div className={styles.homeworkIcon}>
                  <span className="material-symbols-outlined">assignment</span>
                </div>
                <div>
                  <h4 className={styles.homeworkTitle}>{lesson.homework.title}</h4>
                  {lesson.homework.due_date && (
                    <div className={styles.homeworkDue}>
                      <span className="material-symbols-outlined">event_repeat</span>
                      <span>{t('admin.lesson_detail.homework_due', { date: formatDate(lesson.homework.due_date) })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        <div className={styles.bottomSpacer} />
      </main>

      {/* Title Edit Modal */}
      {showTitleModal && (
        <div className={styles.modalOverlay} onClick={() => setShowTitleModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{t('admin.lesson_detail.lesson_title')}</h3>
              <button className={styles.modalClose} onClick={() => setShowTitleModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <input type="text" className={styles.modalInput} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
            <button className={styles.modalSaveBtn} onClick={handleSaveTitle} disabled={savingEdit}>
              {savingEdit ? t('admin.lesson_detail.saving') : t('common.save')}
            </button>
          </div>
        </div>
      )}

      {/* Plan Edit Modal */}
      {showPlanModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPlanModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{t('admin.lesson_detail.lesson_plan')}</h3>
              <button className={styles.modalClose} onClick={() => setShowPlanModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.planItems}>
              {editPlan.map((item, index) => (
                <div key={index} className={styles.planItem}>
                  <div className={styles.planItemHeader}>
                    <span className={styles.planItemNumber}>{index + 1}</span>
                    {editPlan.length > 1 && (
                      <button className={styles.planItemRemove} onClick={() => setEditPlan(editPlan.filter((_, i) => i !== index))}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                      </button>
                    )}
                  </div>
                  <input type="text" className={styles.modalInput} placeholder={t('admin.lesson_detail.topic')} value={item.title}
                    onChange={(e) => { const updated = [...editPlan]; updated[index] = { ...updated[index], title: e.target.value }; setEditPlan(updated) }}
                  />
                  <textarea className={styles.modalTextarea} placeholder={t('admin.lesson_detail.description')} value={item.description} rows={2}
                    onChange={(e) => { const updated = [...editPlan]; updated[index] = { ...updated[index], description: e.target.value }; setEditPlan(updated) }}
                  />
                </div>
              ))}
            </div>
            <button className={styles.addPlanItemBtn} onClick={() => setEditPlan([...editPlan, { title: '', description: '' }])}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              {t('admin.lesson_detail.add_item')}
            </button>
            <button className={styles.modalSaveBtn} onClick={handleSavePlan} disabled={savingEdit}>
              {savingEdit ? t('admin.lesson_detail.saving') : t('common.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
