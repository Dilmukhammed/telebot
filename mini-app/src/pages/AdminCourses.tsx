import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAdminSubjects, useDeleteAdminSubject } from '../api/hooks'
import {
  adminSearchCourses,
  createAdminSubject,
  getTeachersForSchedule,
  getAdminUsers,
} from '../api/client'
import type { SearchResultOut, UserOut, ScheduleSlot } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import TimePicker from '../components/TimePicker'
import styles from './AdminCourses.module.css'

type Tab = 'all' | 'search' | 'archive'

const COURSE_ICONS: Record<string, string> = {
  'SAT Math': 'school',
  'Олимпиадная Математика': 'architecture',
  'Курсы для Абитуриентов': 'menu_book',
}

const COURSE_BADGES: Record<string, string> = {
  'SAT Math': 'Math Expert',
  'Олимпиадная Математика': 'Olympiad',
  'Курсы для Абитуриентов': 'Abiturient',
}

export default function AdminCourses() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const isArchived = tab === 'archive'
  const { data: rawCourses = [] } = useAdminSubjects(isArchived)

  const courses = useMemo(() => {
    return [...rawCourses].sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [rawCourses])

  const selectTab = (t: Tab) => {
    setTab(t)
    setSearchParams({ tab: t })
  }

  return (
    <div className={styles.page}>
      <SiteHeader title={t('admin.courses.title')} onBack={() => navigate('/dashboard')} />

      <main className={styles.main}>
        <div className={styles.tabs}>
          {([['all', t('admin.courses.title')], ['search', t('admin.courses.search')], ['archive', t('admin.courses.archive')]] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.activeTab : ''}`}
              onClick={() => selectTab(t)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'all' && <AllCourses navigate={navigate} courses={courses} loading={false} />}
        {tab === 'search' && <SearchView />}
        {tab === 'archive' && <ArchiveCourses navigate={navigate} />}
      </main>

      {/* FAB - Create Course */}
      {tab === 'all' && (
        <button className={styles.fab} onClick={() => setShowCreateModal(true)}>
          <span className="material-symbols-outlined">add</span>
        </button>
      )}

      {/* Create Course Modal */}
      {showCreateModal && (
        <CreateCourseModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(id) => {
            setShowCreateModal(false)
            navigate(`/admin/courses/${id}`)
          }}
        />
      )}
    </div>
  )
}

function AllCourses({ navigate, courses, loading }: { navigate: (p: string) => void; courses: any[]; loading: boolean }) {
  const { t } = useTranslation()
  if (loading) return <div className={styles.loading}>{t('admin.courses.loading_courses')}</div>

  if (courses.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>menu_book</span>
        <p>{t('admin.courses.no_courses')}</p>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {courses.map(c => (
        <div
          key={c.id}
          className={styles.courseCard}
          onClick={() => navigate(`/admin/courses/${c.id}`)}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardInfo}>
              <span className={styles.badge}>
                {COURSE_BADGES[c.name] || t('admin.course_detail.course')}
              </span>
              <h2 className={styles.courseTitle}>{c.name}</h2>
            </div>
            <div className={styles.cardRight}>
              <div className={styles.cardIcon}>
                <span className="material-symbols-outlined">
                  {COURSE_ICONS[c.name] || 'school'}
                </span>
              </div>
              <span className={`material-symbols-outlined ${styles.courseChevron}`}>
                chevron_right
              </span>
            </div>
          </div>

          <div className={styles.teacherRow}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-outline)' }}>
              person
            </span>
            <span className={styles.teacherName}>
              {c.teacher_names.join(', ') || t('admin.courses.no_teacher')}
            </span>

            <span className={styles.metaDivider}>·</span>

            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-outline)' }}>
              menu_book
            </span>
            <span className={styles.teacherName}>{t('admin.courses.lessons_short', { count: c.lesson_count })}</span>

            <span className={styles.metaDivider}>·</span>

            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-outline)' }}>
              groups
            </span>
            <span className={styles.teacherName}>{t('admin.courses.students_short', { count: c.student_count })}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Create Course Modal ──────────────────────────────────────────────

type Step = 'info' | 'schedule' | 'teacher' | 'students'

function CreateCourseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { t } = useTranslation()
  const dayNames = Array.from({ length: 7 }, (_, i) => t(`courseDetail.daysShort.${i}`))
  const [step, setStep] = useState<Step>('info')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: Basic info
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isIndefinite, setIsIndefinite] = useState(true)
  const [durationWeeks, setDurationWeeks] = useState('12')
  const [durationMinutes, setDurationMinutes] = useState('90')
  const [maxCapacity, setMaxCapacity] = useState('15')

  // Step 2: Schedule (multi-day picker + single time + room)
  const [selectedDays, setSelectedDays] = useState<number[]>([0])
  const [scheduleTime, setScheduleTime] = useState('16:00')
  const [scheduleRoom, setScheduleRoom] = useState('')

  // Step 3: Teacher (filtered by availability)
  const [teachers, setTeachers] = useState<UserOut[]>([])
  const [matchingTeacherIds, setMatchingTeacherIds] = useState<Set<number>>(new Set())
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | null>(null)
  const [teachersLoading, setTeachersLoading] = useState(false)

  // Step 4: Students
  const [students, setStudents] = useState<UserOut[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([])
  const [studentSearch, setStudentSearch] = useState('')

  // Load teachers when reaching step 3 (filtered by schedule)
  useEffect(() => {
    if (step === 'teacher' && teachers.length === 0) {
      setTeachersLoading(true)
      const duration = parseInt(durationMinutes) || 90
      getTeachersForSchedule(selectedDays.map(day => ({
        day_of_week: day,
        time: scheduleTime,
        duration_minutes: duration,
      })))
        .then(allTeachers => {
          setTeachers(allTeachers)
          setMatchingTeacherIds(new Set(allTeachers.map(t => t.id)))
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setTeachersLoading(false))
    }
  }, [step, selectedDays, scheduleTime, durationMinutes, teachers.length])

  // Load students when reaching step 4
  useEffect(() => {
    if (step === 'students' && students.length === 0) {
      getAdminUsers({ role: 'student' })
        .then(data => setStudents(data))
    }
  }, [step, students.length])

  const steps = [
    { key: 'info', icon: 'info' },
    { key: 'schedule', icon: 'schedule' },
    { key: 'teacher', icon: 'school' },
    { key: 'students', icon: 'groups' },
  ]
  const currentIdx = steps.findIndex(s => s.key === step)

  const canNext = () => {
    if (step === 'info') return name.trim() && (isIndefinite || durationWeeks) && durationMinutes && maxCapacity
    if (step === 'schedule') return selectedDays.length > 0 && scheduleRoom.trim()
    return true
  }

  const handleNext = () => {
    if (!canNext()) return
    if (step === 'info') setStep('schedule')
    else if (step === 'schedule') setStep('teacher')
    else if (step === 'teacher') setStep('students')
  }

  const handleBack = () => {
    if (step === 'schedule') setStep('info')
    else if (step === 'teacher') setStep('schedule')
    else if (step === 'students') setStep('teacher')
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const schedule: ScheduleSlot[] = selectedDays.map(day => ({
        day_of_week: day,
        time: scheduleTime,
        room: scheduleRoom.trim(),
      }))

      const result = await createAdminSubject({
        name: name.trim(),
        description: description.trim() || undefined,
        duration_weeks: isIndefinite ? undefined : (parseInt(durationWeeks) || 12),
        duration_minutes: parseInt(durationMinutes) || 90,
        teacher_id: selectedTeacherId || undefined,
        max_capacity: parseInt(maxCapacity) || 15,
        schedule,
        student_ids: selectedStudentIds,
      })
      onCreated(result.id)
    } catch (err: any) {
      setError(err?.message || t('admin.people.create_error'))
    } finally {
      setLoading(false)
    }
  }

  const toggleStudent = (id: number) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const filteredStudents = students.filter(s => {
    if (!studentSearch) return true
    const q = studentSearch.toLowerCase()
    const nm = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase()
    const username = (s.username || '').toLowerCase()
    return nm.includes(q) || username.includes(q)
  })

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h3>{t('admin.courses.new_course')}</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Step indicator */}
        <div className={styles.stepIndicator}>
          {steps.map((s, idx) => (
            <div
              key={s.key}
              className={`${styles.stepDot} ${idx === currentIdx ? styles.stepDotActive : idx < currentIdx ? styles.stepDotDone : ''}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {idx < currentIdx ? 'check' : s.icon}
              </span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {error && <div className={styles.modalError}>{error}</div>}

          {/* Step 1: Basic Info */}
          {step === 'info' && (
            <>
              <div className={styles.formGroup}>
                <label>{t('admin.courses.course_name_label')}</label>
                <input type="text" placeholder="SAT Math" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label>{t('admin.courses.description_label')}</label>
                <input type="text" placeholder={t('admin.courses.description_placeholder')} value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={isIndefinite}
                  onChange={e => setIsIndefinite(e.target.checked)}
                />
                <span>{t('admin.courses.indefinite_course')}</span>
              </label>
              {!isIndefinite && (
                <div className={styles.formGroup}>
                  <label>{t('admin.courses.weeks_label')}</label>
                  <input type="number" min="1" value={durationWeeks} onChange={e => setDurationWeeks(e.target.value)} />
                </div>
              )}
              <div className={styles.formRow2}>
                <div className={styles.formGroup}>
                  <label>{t('admin.courses.minutes_per_lesson_label')}</label>
                  <input type="number" min="1" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label>{t('admin.courses.max_students_label')}</label>
                  <input type="number" min="1" value={maxCapacity} onChange={e => setMaxCapacity(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Step 2: Schedule */}
          {step === 'schedule' && (
            <>
              <p className={styles.stepHint}>{t('admin.courses.schedule_hint')}</p>
              <div className={styles.formGroup}>
                <label>{t('admin.courses.weekdays_label')}</label>
                <div className={styles.dayPicker}>
                  {dayNames.map((dayName, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`${styles.dayBtn} ${selectedDays.includes(idx) ? styles.dayBtnActive : ''}`}
                      onClick={() => {
                        setSelectedDays(prev =>
                          prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx].sort()
                        )
                      }}
                    >
                      {dayName}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.formRow2}>
                <div className={styles.formGroup}>
                  <label>{t('admin.courses.time_label')}</label>
                  <TimePicker
                    value={scheduleTime}
                    onChange={val => setScheduleTime(val)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>{t('admin.courses.room_label')}</label>
                  <input
                    type="text"
                    placeholder="Каб. 1"
                    value={scheduleRoom}
                    onChange={e => setScheduleRoom(e.target.value)}
                  />
                </div>
              </div>
              {selectedDays.length > 0 && (
                <div className={styles.schedulePreview}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>event</span>
                  <span>
                    {t('admin.courses.schedule_preview', {
                      days: selectedDays.map(d => dayNames[d]).join(', '),
                      time: scheduleTime,
                      room: scheduleRoom || '...'
                    })}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Step 3: Teacher (filtered by availability) */}
          {step === 'teacher' && (
            <>
              <p className={styles.stepHint}>{t('admin.courses.teacher_hint')}</p>
              {teachersLoading ? (
                <div className={styles.loading}>{t('common.loading')}</div>
              ) : (
                <div className={styles.teacherList}>
                  <button
                    className={`${styles.teacherCard} ${selectedTeacherId === null ? styles.teacherCardActive : ''}`}
                    onClick={() => setSelectedTeacherId(null)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person_off</span>
                    <span>{t('admin.courses.no_teacher_option')}</span>
                  </button>
                  {teachers.map(t => {
                    const isMatching = matchingTeacherIds.has(t.id)
                    return (
                      <button
                        key={t.id}
                        className={`${styles.teacherCard} ${selectedTeacherId === t.id ? styles.teacherCardActive : ''}`}
                        onClick={() => setSelectedTeacherId(t.id)}
                      >
                        <div className={styles.teacherAvatar}>
                          {t.first_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className={styles.teacherInfo}>
                          <span className={styles.teacherCardName}>
                            {t.first_name} {t.last_name || ''}
                            {isMatching && <span className={styles.matchBadge}>✓</span>}
                          </span>
                          {t.username && <span className={styles.teacherCardUsername}>@{t.username}</span>}
                        </div>
                      </button>
                    )
                  })}
                  {teachers.length === 0 && (
                    <div className={styles.emptyState}>
                      <p>{t('admin.courses.no_teachers_found')}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Step 4: Students */}
          {step === 'students' && (
            <>
              <p className={styles.stepHint}>{t('admin.courses.students_hint')}</p>
              <div className={styles.searchBox}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#7b7487' }}>search</span>
                <input
                  type="text"
                  placeholder={t('admin.courses.search_students_placeholder')}
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <div className={styles.studentList}>
                {filteredStudents.map(s => (
                  <button
                    key={s.id}
                    className={`${styles.studentCard} ${selectedStudentIds.includes(s.id) ? styles.studentCardActive : ''}`}
                    onClick={() => toggleStudent(s.id)}
                  >
                    <div className={styles.studentCheck}>
                      {selectedStudentIds.includes(s.id) && (
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                      )}
                    </div>
                    <div className={styles.studentInfo}>
                      <span>{s.first_name || s.username || t('admin.people.no_name')} {s.last_name || ''}</span>
                      {s.username && <span className={styles.studentUsername}>@{s.username}</span>}
                    </div>
                  </button>
                ))}
                {filteredStudents.length === 0 && (
                  <div className={styles.emptyState}>
                    <p>{t('admin.courses.no_students_found')}</p>
                  </div>
                )}
              </div>
              {selectedStudentIds.length > 0 && (
                <div className={styles.selectedCount}>
                  {t('admin.courses.selected_count', { count: selectedStudentIds.length })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          {currentIdx > 0 && (
            <button className={styles.cancelBtn} onClick={handleBack}>
              {t('common.back')}
            </button>
          )}
          {currentIdx === 0 && (
            <button className={styles.cancelBtn} onClick={onClose}>
              {t('common.cancel')}
            </button>
          )}
          {currentIdx < steps.length - 1 ? (
            <button className={styles.createBtn} onClick={handleNext} disabled={!canNext()}>
              {t('common.next')}
            </button>
          ) : (
            <button className={styles.createBtn} onClick={handleSubmit} disabled={loading}>
              {loading ? t('admin.people.creating') : t('admin.courses.create_course')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Search View ──────────────────────────────────────────────────────

function SearchView() {
  const { t } = useTranslation()
  const dayNames = Array.from({ length: 7 }, (_, i) => t(`courseDetail.daysShort.${i}`))
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [timeFrom, setTimeFrom] = useState('09:00')
  const [timeTo, setTimeTo] = useState('21:00')
  const [results, setResults] = useState<SearchResultOut | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')

  const toggleDay = (day: number) => {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedDays.length === 0) {
      setError(t('admin.courses.select_day_error'))
      return
    }
    if (timeFrom >= timeTo) {
      setError(t('admin.courses.time_range_error'))
      return
    }
    setSearching(true)
    setError('')
    try {
      const data = await adminSearchCourses({ days: selectedDays, time_from: timeFrom, time_to: timeTo })
      setResults(data)
    } catch (e: any) {
      setError(e.message || t('admin.courses.search_error'))
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className={styles.searchForm}>
      <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('admin.courses.weekdays_label')}</label>
          <div className={styles.dayPicker}>
            {dayNames.map((name, idx) => (
              <button
                key={name}
                type="button"
                className={`${styles.dayBtn} ${selectedDays.includes(idx) ? styles.dayBtnActive : ''}`}
                onClick={() => toggleDay(idx)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.timeRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('admin.courses.time_from_label')}</label>
            <TimePicker value={timeFrom} onChange={val => setTimeFrom(val)} />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('admin.courses.time_to_label')}</label>
            <TimePicker value={timeTo} onChange={val => setTimeTo(val)} />
          </div>
        </div>

        {error && <div className={styles.modalError}>{error}</div>}

        <button type="submit" className={styles.searchBtn} disabled={searching}>
          {searching ? t('admin.courses.searching') : t('admin.courses.find_slots')}
        </button>
      </form>

      {results && (
        <div className={styles.results}>
          <h3 className={styles.resultsTitle}>{t('admin.courses.courses_with_spots')}</h3>
          {results.courses.length === 0 ? (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#7b7487' }}>search_off</span>
              <p>{t('admin.courses.no_courses_with_spots')}</p>
            </div>
          ) : (
            results.courses.map(c => (
              <div key={c.lesson_id} className={styles.resultCard}>
                <div className={styles.resultName}>{c.name}</div>
                <div className={styles.resultMeta}>
                  {c.teacher_name} · {c.day_name} {c.time}–{c.end_time} · {c.room}
                </div>
                <div className={styles.resultMeta}>
                  {t('admin.courses.spots_left_info', { spots_left: c.spots_left, max_capacity: c.max_capacity })}
                </div>
              </div>
            ))
          )}

          <h3 className={styles.resultsTitle}>{t('admin.courses.teachers_open_slots')}</h3>
          {results.open_slots.length === 0 ? (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#7b7487' }}>event_available</span>
              <p>{t('admin.courses.no_teachers_open_slots')}</p>
            </div>
          ) : (
            results.open_slots.map(s => (
              <div key={`${s.teacher_id}-${s.day_of_week}-${s.start_time}`} className={`${styles.resultCard} ${styles.resultCardAccent}`}>
                <div className={styles.resultName}>{s.teacher_name}</div>
                <div className={styles.resultMeta}>
                  {s.day_name} {s.start_time}–{s.end_time}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Archive View ────────────────────────────────────────────────────

function ArchiveCourses({ navigate }: { navigate: (p: string) => void }) {
  const { t } = useTranslation()
  const { data: rawCourses = [], isLoading } = useAdminSubjects(true)
  const courses = useMemo(() => [...rawCourses].sort((a, b) => a.name.localeCompare(b.name, 'ru')), [rawCourses])
  const loading = isLoading
  const deleteSubject = useDeleteAdminSubject()
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  if (loading) return <div className={styles.loading}>{t('admin.courses.loading_archive')}</div>

  if (courses.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>archive</span>
        <p>{t('admin.courses.archive_empty')}</p>
      </div>
    )
  }

  return (
    <>
      <div className={styles.list}>
        {courses.map(c => (
          <div
            key={c.id}
            className={styles.courseCard}
            style={{ cursor: 'pointer', opacity: 0.7 }}
          >
            <div
              className={styles.cardHeader}
              onClick={() => navigate(`/admin/courses/${c.id}`)}
            >
              <div className={styles.cardInfo}>
                <span className={styles.badge} style={{ background: 'var(--color-outline)', color: 'var(--color-on-surface)' }}>
                  {t('admin.courses.archive')}
                </span>
                <h2 className={styles.courseTitle}>{c.name}</h2>
              </div>
              <div className={styles.cardRight}>
                <span className={`material-symbols-outlined ${styles.courseChevron}`}>
                  chevron_right
                </span>
              </div>
            </div>
            <div className={styles.teacherRow}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-outline)' }}>
                person
              </span>
              <span className={styles.teacherName}>
                {c.teacher_names.join(', ') || t('admin.courses.no_teacher')}
              </span>
              <span className={styles.metaDivider}>·</span>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-outline)' }}>
                groups
              </span>
              <span className={styles.teacherName}>{t('admin.courses.students_short', { count: c.student_count })}</span>
              <button
                className={styles.iconBtn}
                title="Удалить курс"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(c.id) }}
                style={{ marginLeft: 'auto', color: '#ba1a1a' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete !== null && (
        <div className={styles.modalOverlay} onClick={() => setConfirmDelete(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Удалить курс?</h3>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)', lineHeight: 1.6 }}>
                Курс будет скрыт из всех списков и интерфейсов. Данные (уроки, посещаемость, результаты) сохранятся в базе для истории, но станут недоступны.
                <br /><br />
                <strong>Это действие нельзя отменить.</strong>
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setConfirmDelete(null)}>Отмена</button>
              <button
                className={styles.deleteBtn}
                onClick={async () => {
                  await deleteSubject.mutateAsync(confirmDelete)
                  setConfirmDelete(null)
                }}
              >
                {deleteSubject.isPending ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
