import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCourseDetail, useCourseStudents, useMaterials, useCreateMaterial, useUploadMaterial, useDeleteMaterial } from '../api/hooks'
import { useUser } from '../context/UserContext'
import type { CourseLessonOut, MaterialCreate } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import MaterialCard from '../components/MaterialCard'
import MaterialForm from '../components/MaterialForm'
import { Loading, Toast, Modal } from '../shared/components'
import styles from './CourseDetail.module.css'

type Tab = 'lessons' | 'materials' | 'about' | 'students'

const MONTH_NAMES = {
  ru: ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'],
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  uz: ['YAN', 'FEV', 'MAR', 'APR', 'MAY', 'IYU', 'IYUL', 'AVG', 'SEN', 'OKT', 'NOY', 'DEK'],
}

export default function CourseDetail() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useUser()
  const courseId = Number(id)
  const { data: course, isLoading } = useCourseDetail(courseId)
  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin'
  const { data: students = [] } = useCourseStudents(isTeacherOrAdmin ? courseId : 0)
  const [activeTab, setActiveTab] = useState<Tab>('lessons')
  const [copied, setCopied] = useState(false)
  const [showMaterialForm, setShowMaterialForm] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<number | null>(null)

  const { data: materials = [] } = useMaterials(courseId)
  const createMaterial = useCreateMaterial()
  const uploadMaterial = useUploadMaterial()
  const deleteMaterial = useDeleteMaterial()

  const handleMaterialSubmit = (data: MaterialCreate & { file?: File }) => {
    if (data.type === 'file' && data.file) {
      uploadMaterial.mutate(
        { file: data.file, title: data.title, subjectId: courseId },
        { onSuccess: () => setShowMaterialForm(false) }
      )
    } else {
      createMaterial.mutate(
        { title: data.title, type: data.type, subject_id: courseId, url: data.url, content: data.content },
        { onSuccess: () => setShowMaterialForm(false) }
      )
    }
  }

  const handleMaterialDelete = (id: number) => {
    setMaterialToDelete(id)
  }

  const lang = i18n.language as 'ru' | 'en' | 'uz'
  const monthNames = MONTH_NAMES[lang] || MONTH_NAMES.ru

  const formatStartDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'uz' ? 'uz-UZ' : 'ru-RU'
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (isLoading || !course) {
    return <Loading fullPage message={t('common.loading')} />
  }

  const todayLessons = course.lessons.filter(l => l.status === 'today')
  const upcomingLessons = course.lessons.filter(l => l.status === 'upcoming')
  const pastLessons = course.lessons.filter(l => l.status === 'past')

  return (
    <div className={styles.page}>
      <SiteHeader title={course.name} onBack={() => navigate(-1)} hideProfile />

      {/* Tab Navigation */}
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
          className={`${styles.tabButton} ${activeTab === 'about' ? styles.tabButtonActive : ''}`}
          onClick={() => setActiveTab('about')}
        >
          {t('courseDetail.about')}
        </button>
        {isTeacherOrAdmin && (
          <button
            className={`${styles.tabButton} ${activeTab === 'students' ? styles.tabButtonActive : ''}`}
            onClick={() => setActiveTab('students')}
          >
            {t('courseDetail.studentsTab', { defaultValue: 'Ученики' })}
          </button>
        )}
      </nav>

      <main className={styles.main}>
        {/* Lessons Tab */}
        {activeTab === 'lessons' && (
          <>
            {/* Today */}
            {todayLessons.length > 0 && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>{t('courseDetail.today')}</h2>
                  <span className={styles.liveDot} />
                </div>
                {todayLessons.map(lesson => (
                  <TodayLessonCard
                    key={lesson.id}
                    lesson={lesson}
                    durationMinutes={course.duration_minutes}
                    onClick={() => navigate(`/lesson/${lesson.id}?date=${lesson.date}`)}
                  />
                ))}
              </section>
            )}

            {/* Upcoming */}
            {upcomingLessons.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('courseDetail.upcoming')}</h2>
                <div className={styles.lessonList}>
                  {upcomingLessons.map(lesson => (
                    <UpcomingLessonCard
                      key={lesson.id}
                      lesson={lesson}
                      monthNames={monthNames}
                      onClick={() => navigate(`/lesson/${lesson.id}?date=${lesson.date}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Past */}
            {pastLessons.length > 0 && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitleMuted}>{t('courseDetail.past')}</h2>
                <div className={styles.lessonList}>
                  {pastLessons.map(lesson => (
                    <PastLessonCard
                      key={lesson.id}
                      lesson={lesson}
                      monthNames={monthNames}
                      onClick={() => navigate(`/lesson/${lesson.id}?date=${lesson.date}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {todayLessons.length === 0 && upcomingLessons.length === 0 && pastLessons.length === 0 && (
              <div className={styles.emptyState}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>
                  event_busy
                </span>
                <p>{t('courseDetail.noLessons')}</p>
              </div>
            )}
          </>
        )}

        {/* Materials Tab */}
        {activeTab === 'materials' && (
          <>
            {materials.length > 0 ? (
              <section className={styles.section}>
                <div className={styles.materialsList}>
                  {materials.map((m) => (
                    <MaterialCard
                      key={m.id}
                      material={m}
                      canDelete={isTeacherOrAdmin}
                      onDelete={handleMaterialDelete}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <div className={styles.emptyState}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>
                  folder_open
                </span>
                <p>{t('courseDetail.noMaterials')}</p>
              </div>
            )}
            {isTeacherOrAdmin && (
              <button className={styles.fab} onClick={() => setShowMaterialForm(true)}>
                <span className="material-symbols-outlined">add</span>
              </button>
            )}
          </>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <section className={styles.aboutSection}>
            {/* About: description, teacher, location */}
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
              {isTeacherOrAdmin && course.invite_code && (
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

            {/* Schedule & Details */}
            <div className={styles.aboutCard}>
              <h3 className={styles.aboutLabel}>{t('courseDetail.schedule')}</h3>
              <div className={styles.scheduleList}>
                {course.lessons
                  .filter((lesson, index, self) =>
                    index === self.findIndex(l => l.day_of_week === lesson.day_of_week && l.time === lesson.time)
                  )
                  .map(lesson => {
                    const dayName = t(`courseDetail.daysShort.${lesson.day_of_week}`, { defaultValue: lesson.day_name })
                    return (
                      <div key={`${lesson.day_of_week}-${lesson.time}`} className={styles.scheduleItem}>
                        <span className={styles.scheduleDay}>{dayName}</span>
                        <span className={styles.scheduleTime}>{lesson.time}</span>
                        <span className={styles.scheduleRoom}>{lesson.room}</span>
                      </div>
                    )
                  })
                }
              </div>
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
          </section>
        )}

        {/* Students Tab */}
        {activeTab === 'students' && isTeacherOrAdmin && (
          <div className={styles.studentsTab}>
            {false ? (
              <div className={styles.loading}>{t('common.loading')}</div>
            ) : students.length > 0 ? (
              <div className={styles.studentsList}>
                {students.map((student) => (
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
                      <h3 className={styles.studentName}>
                        {student.first_name || `@${student.username}`}
                      </h3>
                      <div className={styles.studentMeta}>
                        {student.username && <span className={styles.metaItem}>@{student.username}</span>}
                        {student.phone && <span className={styles.metaItem}>{student.phone}</span>}
                        {student.grade && <span className={styles.metaItem}>{t('profile.grade', { grade: student.grade })}</span>}
                      </div>
                    </div>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.7 }}>
                      chevron_right
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-on-surface-variant)' }}>
                  group
                </span>
                <p>{t('teacher.noStudents', { defaultValue: 'Нет учеников' })}</p>
              </div>
            )}
          </div>
        )}

        <div className={styles.bottomSpacer} />
      </main>

      {copied && (
        <Toast message={t('courseDetail.copiedToClipboard')} onClose={() => setCopied(false)} />
      )}

      {showMaterialForm && (
        <MaterialForm
          onSubmit={handleMaterialSubmit}
          onClose={() => setShowMaterialForm(false)}
          isPending={createMaterial.isPending || uploadMaterial.isPending}
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
            {materials.find(m => m.id === materialToDelete) && (
              <div className={styles.deleteConfirmItem}>
                <span className="material-symbols-outlined" style={{ marginRight: '8px', color: 'var(--color-primary)' }}>
                  {(() => {
                    const material = materials.find(m => m.id === materialToDelete);
                    if (material?.type === 'text') return 'article';
                    if (material?.type === 'youtube') return 'smart_display';
                    if (material?.type === 'video') return 'play_circle';
                    if (material?.type === 'file') return 'description';
                    return 'link';
                  })()}
                </span>
                <span className={styles.deleteConfirmItemTitle}>
                  {materials.find(m => m.id === materialToDelete)?.title}
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

function TodayLessonCard({ lesson, durationMinutes, onClick }: { lesson: CourseLessonOut; durationMinutes: number; onClick?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className={styles.todayCard} onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <div className={styles.todayCardDecor} />
      <div className={styles.todayCardContent}>
        <div className={styles.todayCardHeader}>
          <div>
            <span className={styles.liveBadge}>{t('courseDetail.liveBadge', { time: lesson.time })}</span>
            <h3 className={styles.todayTitle}>{lesson.title}</h3>
          </div>
          <span className={styles.roomBadge}>{lesson.room}</span>
        </div>
        <div className={styles.todayCardFooter}>
          <div className={styles.durationInfo}>
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: '18px' }}>schedule</span>
            <span>{durationMinutes} {t('courseDetail.minutes')}</span>
          </div>
          <button className={styles.materialsButton}>
            <span>{t('courses.open')}</span>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function UpcomingLessonCard({ lesson, monthNames, onClick }: { lesson: CourseLessonOut; monthNames: string[]; onClick?: () => void }) {
  const { t } = useTranslation()
  const date = new Date(lesson.date + 'T00:00:00')
  const dayName = t(`courseDetail.daysShort.${lesson.day_of_week}`, { defaultValue: lesson.day_name })
  return (
    <div className={styles.upcomingCard} onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <div className={styles.dateBox}>
        <span className={styles.dateMonth}>{monthNames[date.getMonth()]}</span>
        <span className={styles.dateDay}>{date.getDate()}</span>
      </div>
      <div className={styles.upcomingInfo}>
        <h3 className={styles.upcomingTitle}>{lesson.title}</h3>
        <p className={styles.upcomingMeta}>{dayName} • {lesson.time}</p>
      </div>
      <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.7 }}>
        chevron_right
      </span>
    </div>
  )
}

function PastLessonCard({ lesson, monthNames, onClick }: { lesson: CourseLessonOut; monthNames: string[]; onClick?: () => void }) {
  const { t } = useTranslation()
  const date = new Date(lesson.date + 'T00:00:00')
  return (
    <div className={styles.pastCard} onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <div className={styles.dateBoxMuted}>
        <span className={styles.dateMonthMuted}>{monthNames[date.getMonth()]}</span>
        <span className={styles.dateDayMuted}>{date.getDate()}</span>
      </div>
      <div className={styles.pastInfo}>
        <h3 className={styles.pastTitle}>{lesson.title}</h3>
        <div className={styles.completedBadge}>
          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#22c55e', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <span>{t('courseDetail.completed')}</span>
        </div>
      </div>
      <span className="material-symbols-outlined" style={{ color: 'var(--color-on-surface-variant)', opacity: 0.4 }}>
        chevron_right
      </span>
    </div>
  )
}