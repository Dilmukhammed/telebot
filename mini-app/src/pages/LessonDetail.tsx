import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getLessonDetail, getLessonAttendance, markLessonStatus, markAttendance, updateLesson } from '../api/client'
import type { LessonDetailOut, AttendanceListOut, AttendanceRecordIn } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './LessonDetail.module.css'

export default function LessonDetail() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState<LessonDetailOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attendance, setAttendance] = useState<AttendanceListOut | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [attendanceError, setAttendanceError] = useState<string | null>(null)
  const [attendanceSaved, setAttendanceSaved] = useState(false)
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editPlan, setEditPlan] = useState<{ title: string; description: string }[]>([])
  const [savingEdit, setSavingEdit] = useState(false)

  const date = searchParams.get('date')

  useEffect(() => {
    if (id) {
      getLessonDetail(Number(id), date || undefined)
        .then((l) => {
          setLesson(l)
          // Load attendance if teacher and lesson has status
          if (l.is_teacher && l.lesson_status === 'happened') {
            getLessonAttendance(l.id, l.date).then(setAttendance).catch(() => {})
          }
        })
        .catch((e) => {
          console.error(e)
          setError(e.message || 'Error loading lesson')
        })
        .finally(() => setLoading(false))
    }
  }, [id, date])

  const handleMarkStatus = async (status: 'happened' | 'cancelled') => {
    if (!lesson) return
    console.log('[LessonDetail] handleMarkStatus:', status, 'lesson.id:', lesson.id, 'lesson.date:', lesson.date)
    setSavingStatus(true)
    try {
      const result = await markLessonStatus(lesson.id, lesson.date, status)
      console.log('[LessonDetail] markLessonStatus result:', result)
      setLesson({ ...lesson, lesson_status: status })
      if (status === 'happened') {
        const att = await getLessonAttendance(lesson.id, lesson.date)
        console.log('[LessonDetail] attendance loaded:', att)
        setAttendance(att)
      }
    } catch (e: any) {
      console.error('[LessonDetail] markLessonStatus error:', e)
      alert(e.message || 'Error')
    } finally {
      setSavingStatus(false)
    }
  }

  const handleToggleAttendance = (userId: number) => {
    if (!attendance) return
    console.log('[LessonDetail] toggle attendance for user:', userId)
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
      const result = await markAttendance(lesson.id, lesson.date, records)
      setAttendance(result)
      setAttendanceError(null)
      setAttendanceSaved(true)
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success')
      }
    } catch (e: any) {
      setAttendanceError(e.message || 'Error saving attendance')
    } finally {
      setSavingAttendance(false)
    }
  }

  if (loading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  const handleSaveTitle = async () => {
    if (!lesson) return
    setSavingEdit(true)
    try {
      const updated = await updateLesson(lesson.id, { custom_title: editTitle.trim() || null })
      setLesson(updated)
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
      const updated = await updateLesson(lesson.id, { lesson_plan: planJson })
      setLesson(updated)
      setShowPlanModal(false)
    } catch (e: any) {
      console.error(e)
    } finally {
      setSavingEdit(false)
    }
  }

  const openTitleModal = () => {
    setEditTitle(lesson?.custom_title || lesson?.title || '')
    setShowTitleModal(true)
  }

  const openPlanModal = () => {
    setEditPlan(lesson?.agenda.map(a => ({ title: a.title, description: a.description || '' })) || [{ title: '', description: '' }])
    setShowPlanModal(true)
  }

  if (error || !lesson) {
    return (
      <div className={styles.page}>
        <SiteHeader title={t('lessonDetail.title')} onBack={() => navigate(-1)} hideProfile />
        <div className={styles.errorState}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ba1a1a' }}>error</span>
          <p>{error || t('common.error')}</p>
          <button onClick={() => navigate(-1)} className={styles.backButton}>
            {t('common.back')}
          </button>
        </div>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'uz' ? 'uz-UZ' : 'ru-RU'
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' })
  }

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'slides': return 'present_to_all'
      case 'worksheet': return 'description'
      case 'video': return 'video_library'
      case 'document': return 'description'
      default: return 'description'
    }
  }

  return (
    <div className={styles.page}>
      <SiteHeader title={t('lessonDetail.title')} onBack={() => navigate(-1)} hideProfile />

      <main className={styles.main}>
        {/* Header Section */}
        <header className={styles.header}>
          <div className={styles.courseTag}>{lesson.subject_name}</div>
          <div className={styles.titleRow}>
            <h2 className={styles.lessonTitle}>{lesson.title}</h2>
            {lesson.is_teacher && (
              <button className={styles.editBtn} onClick={openTitleModal}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
              </button>
            )}
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

        {/* Instructor Section */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('lessonDetail.instructor')}</h3>
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
              {lesson.teacher_title && (
                <p className={styles.instructorTitle}>{lesson.teacher_title}</p>
              )}
            </div>
            {lesson.teacher_username ? (
              <a
                href={`https://t.me/${lesson.teacher_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.telegramButton}
              >
                <span className="material-symbols-outlined" style={{ transform: 'rotate(-30deg) translate(1px, -1px)', fontSize: '18px' }}>send</span>
              </a>
            ) : (
              <a
                href="https://t.me/educenter_support"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.telegramButton}
              >
                <span className="material-symbols-outlined" style={{ transform: 'rotate(-30deg) translate(1px, -1px)', fontSize: '18px' }}>send</span>
              </a>
            )}
          </div>
        </section>

        {/* Teacher: Lesson Status & Attendance */}
        {lesson.is_teacher && (lesson.status === 'past' || lesson.status === 'today') && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('lessonDetail.lessonStatus')}</h3>
            {!lesson.lesson_status ? (
              <div className={styles.statusPrompt}>
                <p className={styles.statusPromptText}>{t('lessonDetail.markStatus')}</p>
                <div className={styles.statusButtons}>
                  <button
                    className={styles.happenedButton}
                    onClick={() => handleMarkStatus('happened')}
                    disabled={savingStatus}
                  >
                    <span className="material-symbols-outlined">check_circle</span>
                    {t('lessonDetail.happened')}
                  </button>
                  <button
                    className={styles.cancelledButton}
                    onClick={() => handleMarkStatus('cancelled')}
                    disabled={savingStatus}
                  >
                    <span className="material-symbols-outlined">cancel</span>
                    {t('lessonDetail.cancelled')}
                  </button>
                </div>
              </div>
            ) : lesson.lesson_status === 'happened' ? (
              <div className={styles.attendanceSection}>
                <h4 className={styles.attendanceTitle}>{t('lessonDetail.attendance')}</h4>
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
                            {record.present ? t('lessonDetail.present') : t('lessonDetail.absent')}
                          </span>
                        </div>
                      ))}
                    </div>
                    {attendanceSaved ? (
                      <div className={styles.attendanceSavedBanner}>
                        <span className="material-symbols-outlined">check_circle</span>
                        <span>{t('lessonDetail.attendanceSaved')}</span>
                      </div>
                    ) : !attendance.saved ? (
                      <button
                        className={styles.saveAttendanceButton}
                        onClick={handleSaveAttendance}
                        disabled={savingAttendance}
                      >
                        {savingAttendance ? '...' : t('lessonDetail.saveAttendance')}
                      </button>
                    ) : null}
                    {attendanceError && (
                      <p style={{ color: '#ba1a1a', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>
                        {attendanceError}
                      </p>
                    )}
                  </>
                ) : (
                  <Loading message={t('common.loading')} />
                )}
              </div>
            ) : (
              <div className={styles.cancelledBadge}>
                <span className="material-symbols-outlined">block</span>
                <span>{t('lessonDetail.lessonCancelled')}</span>
              </div>
            )}
          </section>
        )}

        {/* Lesson Plan Section */}
        {(lesson.agenda.length > 0 || lesson.is_teacher) && (
          <section className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <h3 className={styles.sectionTitle}>{t('lessonDetail.agenda')}</h3>
              {lesson.is_teacher && lesson.agenda.length > 0 && (
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
                      {item.description && (
                        <p className={styles.timelineDescription}>{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <button className={styles.emptyPlanBtn} onClick={openPlanModal}>
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>add_notes</span>
                <span>{t('lessonDetail.addPlan')}</span>
              </button>
            )}
          </section>
        )}

        {/* Materials Section */}
        {lesson.materials.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('lessonDetail.materials')}</h3>
            <div className={styles.materialsScroll}>
              {lesson.materials.map((material) => (
                <button key={material.id} className={styles.materialCard}>
                  <span className={`material-symbols-outlined ${styles.materialIcon}`}>
                    {getMaterialIcon(material.type)}
                  </span>
                  <span className={styles.materialTitle}>{material.title}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Homework Section */}
        {lesson.homework && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>{t('lessonDetail.homework')}</h3>
            <div className={`${styles.homeworkCard} ${styles[lesson.homework.status]}`}>
              <div className={styles.homeworkBadge}>
                <span className={`${styles.homeworkBadgeText} ${styles[lesson.homework.status]}`}>
                  {t(`lessonDetail.homeworkStatus.${lesson.homework.status}`)}
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
                      <span>{t('lessonDetail.due')}: {formatDate(lesson.homework.due_date)}</span>
                    </div>
                  )}
                </div>
              </div>
              <button className={styles.submitButton}>
                {t('lessonDetail.submitAssignment')}
              </button>
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
              <h3 className={styles.modalTitle}>{t('lessonDetail.editTitle')}</h3>
              <button className={styles.modalClose} onClick={() => setShowTitleModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <input
              type="text"
              className={styles.modalInput}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              autoFocus
            />
            <button
              className={styles.modalSaveBtn}
              onClick={handleSaveTitle}
              disabled={savingEdit}
            >
              {savingEdit ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      )}

      {/* Plan Edit Modal */}
      {showPlanModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPlanModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{t('lessonDetail.editPlan')}</h3>
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
                      <button
                        className={styles.planItemRemove}
                        onClick={() => setEditPlan(editPlan.filter((_, i) => i !== index))}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    className={styles.modalInput}
                    placeholder={t('lessonDetail.agendaItemTitle')}
                    value={item.title}
                    onChange={(e) => {
                      const updated = [...editPlan]
                      updated[index] = { ...updated[index], title: e.target.value }
                      setEditPlan(updated)
                    }}
                  />
                  <textarea
                    className={styles.modalTextarea}
                    placeholder={t('lessonDetail.agendaItemDesc')}
                    value={item.description}
                    rows={2}
                    onChange={(e) => {
                      const updated = [...editPlan]
                      updated[index] = { ...updated[index], description: e.target.value }
                      setEditPlan(updated)
                    }}
                  />
                </div>
              ))}
            </div>
            <button
              className={styles.addPlanItemBtn}
              onClick={() => setEditPlan([...editPlan, { title: '', description: '' }])}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              {t('lessonDetail.addAgendaItem')}
            </button>
            <button
              className={styles.modalSaveBtn}
              onClick={handleSavePlan}
              disabled={savingEdit}
            >
              {savingEdit ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}