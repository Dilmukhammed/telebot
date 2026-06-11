import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  useLessonDetail,
  useLessonAttendance,
  useDeleteMaterial,
  useMarkLessonStatus,
  useMarkAttendance,
  useUpdateLesson,
} from '../api/hooks'
import type { AttendanceRecordIn } from '../shared/types'
import Avatar from '../components/Avatar'
import SiteHeader from '../components/SiteHeader'
import MaterialCard from '../components/MaterialCard'
import MaterialForm from '../components/MaterialForm'
import { Loading, Modal } from '../shared/components'
import styles from './LessonDetail.module.css'

export default function LessonDetail() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const date = searchParams.get('date')
  const { data: lesson, isLoading, error } = useLessonDetail(Number(id || '0'), date || undefined)
  const { data: attendance } = useLessonAttendance(
    lesson?.is_teacher && lesson?.lesson_status === 'happened' ? lesson.id : 0,
    lesson?.date || ''
  )
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [attendanceError, setAttendanceError] = useState<string | null>(null)
  const [attendanceSaved, setAttendanceSaved] = useState(false)
  const [showTitleModal, setShowTitleModal] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editPlan, setEditPlan] = useState<{ title: string; description: string }[]>([])
  const [savingEdit, setSavingEdit] = useState(false)
  const [showMaterialForm, setShowMaterialForm] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<number | null>(null)

  const deleteMaterial = useDeleteMaterial()
  const markStatusMutation = useMarkLessonStatus()
  const markAttendanceMutation = useMarkAttendance()
  const updateLessonMutation = useUpdateLesson()

  const handleMaterialDelete = (id: number) => {
    setMaterialToDelete(id)
  }
  const [editError, setEditError] = useState<string | null>(null)

  const handleMarkStatus = async (status: 'happened' | 'cancelled') => {
    if (!lesson) return
    setSavingStatus(true)
    try {
      await markStatusMutation.mutateAsync({ lessonId: lesson.id, date: lesson.date, status })
      // React Query hooks handle all cache invalidation (lesson, teacher-dashboard, calendar, admin-lessons)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSavingStatus(false)
    }
  }

  const handleToggleAttendance = async (userId: number) => {
    if (!attendance) return
    setAttendanceSaved(false)
    const records: AttendanceRecordIn[] = attendance.records.map((r) => ({
      user_id: r.user_id,
      present: r.user_id === userId ? !r.present : r.present,
    }))
    try {
      await markAttendanceMutation.mutateAsync({ lessonId: lesson!.id, date: lesson!.date, records })
      // React Query hooks handle all cache invalidation (lesson-attendance, lesson, teacher-dashboard)
      setAttendanceSaved(true)
      if ((window as any).Telegram?.WebApp) {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success')
      }
    } catch (e: unknown) {
      setAttendanceError(e instanceof Error ? e.message : t('common.error'))
    }
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
      await markAttendanceMutation.mutateAsync({ lessonId: lesson.id, date: lesson.date, records })
      setAttendanceError(null)
      setAttendanceSaved(true)
      if ((window as any).Telegram?.WebApp) {
        (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success')
      }
    } catch (e: unknown) {
      setAttendanceError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSavingAttendance(false)
    }
  }

  if (isLoading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  const handleSaveTitle = async () => {
    if (!lesson) return
    setSavingEdit(true)
    setEditError(null)
    try {
      await updateLessonMutation.mutateAsync({ lessonId: lesson.id, custom_title: editTitle.trim() || null })
      // React Query hooks handle all cache invalidation (lesson, course, teacher-dashboard, admin-lessons)
      setShowTitleModal(false)
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSavingEdit(false)
    }
  }

  const handleSavePlan = async () => {
    if (!lesson) return
    setSavingEdit(true)
    setEditError(null)
    try {
      const planJson = JSON.stringify(editPlan.filter(item => item.title.trim()))
      await updateLessonMutation.mutateAsync({ lessonId: lesson.id, lesson_plan: planJson })
      setShowPlanModal(false)
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : t('common.error'))
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

  if (error || !lesson) {
    return (
      <div className={styles.page}>
        <SiteHeader title={t('lessonDetail.title')} onBack={() => navigate(-1)} />
        <div className={styles.errorState}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ba1a1a' }}>error</span>
          <p>{error?.message || t('common.error')}</p>
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

  return (
    <div className={styles.page}>
      <SiteHeader title={t('lessonDetail.title')} onBack={() => navigate(-1)} />

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
            <Avatar photoUrl={lesson.teacher_photo_url} name={lesson.teacher_name} size={40} className={styles.instructorAvatar} />
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
        <section className={styles.section}>
          <div className={styles.sectionHeaderRow}>
            <h3 className={styles.sectionTitle}>{t('lessonDetail.materials')}</h3>
            {lesson.is_teacher && (
              <button className={styles.addMaterialBtn} onClick={() => setShowMaterialForm(true)}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              </button>
            )}
          </div>
          {lesson.materials.length > 0 ? (
            <div className={styles.materialsList}>
              {lesson.materials.map((material) => (
                <MaterialCard
                  key={material.id}
                  material={material}
                  canDelete={lesson.is_teacher}
                  onDelete={handleMaterialDelete}
                />
              ))}
            </div>
          ) : (
            <p className={styles.noMaterialsText}>{t('courseDetail.noMaterials')}</p>
          )}
        </section>

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
            {editError && (
              <p style={{ color: 'var(--color-error, #ba1a1a)', fontSize: '13px', margin: '4px 0' }}>{editError}</p>
            )}
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
            {editError && (
              <p style={{ color: 'var(--color-error, #ba1a1a)', fontSize: '13px', margin: '4px 0' }}>{editError}</p>
            )}
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

      {showMaterialForm && lesson && (
        <MaterialForm
          subjectId={lesson.subject_id}
          lessonId={lesson.id}
          onClose={() => setShowMaterialForm(false)}
        />
      )}

      {materialToDelete !== null && (
        <Modal
          isOpen={materialToDelete !== null}
          onClose={() => setMaterialToDelete(null)}
          title={t('courseDetail.deleteConfirmTitle')}
        >
          <div className={styles.deleteConfirmContent}>
            <p className={styles.deleteConfirmText}>
              {t('courseDetail.deleteConfirmText')}
            </p>
            {lesson.materials.find(m => m.id === materialToDelete) && (
              <div className={styles.deleteConfirmItem}>
                <span className="material-symbols-outlined" style={{ marginRight: '8px', color: 'var(--color-primary)' }}>
                  {(() => {
                    const material = lesson.materials.find(m => m.id === materialToDelete);
                    if (material?.type === 'text') return 'article';
                    if (material?.type === 'image') return 'photo_camera';
                    if (material?.type === 'youtube') return 'smart_display';
                    if (material?.type === 'video') return 'play_circle';
                    if (material?.type === 'file') return 'description';
                    return 'link';
                  })()}
                </span>
                <span className={styles.deleteConfirmItemTitle}>
                  {lesson.materials.find(m => m.id === materialToDelete)?.title}
                </span>
              </div>
            )}
            <div className={styles.deleteConfirmButtons}>
              <button
                className={styles.deleteCancelBtn}
                onClick={() => setMaterialToDelete(null)}
              >
                {t('common.cancel')}
              </button>
              <button
                className={styles.deleteConfirmBtn}
                onClick={() => {
                  if (materialToDelete !== null) {
                    deleteMaterial.mutate(materialToDelete, {
                      onSuccess: () => setMaterialToDelete(null)
                    })
                  }
                }}
              >
                {t('common.delete', { defaultValue: 'Удалить' })}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}