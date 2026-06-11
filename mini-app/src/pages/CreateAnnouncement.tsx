import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTeacherCourses } from '../api/hooks'
import { getCourseStudents, createAnnouncement, uploadAnnouncementAttachment, createAnnouncementLinkAttachment, deleteAnnouncementAttachment } from '../api/client'
import { useQueryClient } from '@tanstack/react-query'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './CreateAnnouncement.module.css'

interface Student {
  id: number
  first_name?: string
  username?: string
}

interface PendingAttachment {
  id: number
  title: string
  type: 'file' | 'link'
  url?: string
  file_name?: string
  file_size?: number
}

export default function CreateAnnouncement() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetType, setTargetType] = useState<'course' | 'students'>('course')
  const { data: courses = [], isLoading } = useTeacherCourses()
  const [selectedCourses, setSelectedCourses] = useState<number[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudents, setSelectedStudents] = useState<number[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (targetType === 'students' && courses.length > 0) {
      // Load ALL students from ALL teacher's courses (resilient to partial failures)
      Promise.allSettled(courses.map((c) => getCourseStudents(c.id)))
        .then((results) => {
          const all = results
            .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof getCourseStudents>>> => r.status === 'fulfilled')
            .flatMap(r => r.value)
          const unique = Array.from(new Map(all.map((s) => [s.id, s])).values())
          unique.sort((a, b) => (a.first_name || '').localeCompare(b.first_name || ''))
          setStudents(unique)
        })
    } else {
      setStudents([])
    }
  }, [targetType, courses])

  const toggleCourse = (id: number) => {
    setSelectedCourses((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const toggleStudent = (id: number) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      const result = await uploadAnnouncementAttachment(file, file.name)
      setAttachments(prev => [...prev, { id: result.id, title: result.title, type: 'file', url: result.url, file_name: result.file_name, file_size: result.file_size }])
    } catch (err: any) {
      setError(err.message || t('common.error'))
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAddLink = async () => {
    if (!linkTitle.trim() || !linkUrl.trim()) return
    try {
      const result = await createAnnouncementLinkAttachment(linkTitle.trim(), linkUrl.trim())
      setAttachments(prev => [...prev, { id: result.id, title: result.title, type: 'link', url: result.url }])
      setLinkTitle('')
      setLinkUrl('')
      setShowLinkInput(false)
    } catch (err: any) {
      setError(err.message || t('common.error'))
    }
  }

  const handleRemoveAttachment = async (id: number) => {
    try {
      await deleteAnnouncementAttachment(id)
    } catch { /* ignore — attachment may not exist on server yet */}
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const handleSend = async () => {
    if (!message.trim()) {
      setError(t('createAnnouncement.messageRequired'))
      return
    }
    if (targetType === 'course' && selectedCourses.length === 0) {
      setError(t('createAnnouncement.selectCourse'))
      return
    }
    if (targetType === 'students' && selectedStudents.length === 0) {
      setError(t('createAnnouncement.selectStudentsRequired'))
      return
    }

    setSending(true)
    setError(null)

    try {
      await createAnnouncement({
        title: title.trim() || undefined,
        message: message.trim(),
        target_type: targetType,
        course_ids: targetType === 'course' ? selectedCourses : undefined,
        student_ids: targetType === 'students' ? selectedStudents : undefined,
        attachment_ids: attachments.length > 0 ? attachments.map(a => a.id) : undefined,
      })
      // Invalidate announcement caches so the list refreshes
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] })
      navigate(-1)
    } catch (e: any) {
      setError(e.message || t('common.error'))
    } finally {
      setSending(false)
    }
  }

  if (isLoading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  return (
    <div className={styles.page}>
      <SiteHeader title={t('createAnnouncement.title')} onBack={() => navigate(-1)} />

      <main className={styles.main}>
        {/* Title */}
        <div className={styles.field}>
          <label className={styles.label}>{t('createAnnouncement.titleLabel')}</label>
          <input
            type="text"
            className={styles.input}
            placeholder={t('createAnnouncement.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
        </div>

        {/* Message */}
        <div className={styles.field}>
          <label className={styles.label}>{t('createAnnouncement.messageLabel')}</label>
          <textarea
            className={styles.textarea}
            placeholder={t('createAnnouncement.messagePlaceholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={2000}
          />
          <span className={styles.charCount}>{message.length}/2000</span>
        </div>

        {/* Target Type */}
        <div className={styles.field}>
          <label className={styles.label}>{t('createAnnouncement.sendTo')}</label>
          <div className={styles.targetButtons}>
            <button
              className={`${styles.targetButton} ${targetType === 'course' ? styles.targetButtonActive : ''}`}
              onClick={() => setTargetType('course')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>menu_book</span>
              {t('createAnnouncement.entireCourse')}
            </button>
            <button
              className={`${styles.targetButton} ${targetType === 'students' ? styles.targetButtonActive : ''}`}
              onClick={() => setTargetType('students')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>people</span>
              {t('createAnnouncement.selectStudents')}
            </button>
          </div>
        </div>

        {/* Course selector (only when targetType=course) */}
        {targetType === 'course' && courses.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label}>
              {t('createAnnouncement.course')}
              {selectedCourses.length > 0 && ` (${selectedCourses.length})`}
            </label>
            <div className={styles.courseList}>
              {courses.map((course) => (
                <button
                  key={course.id}
                  className={`${styles.courseCard} ${selectedCourses.includes(course.id) ? styles.courseCardActive : ''}`}
                  onClick={() => toggleCourse(course.id)}
                >
                  <span className={styles.courseName}>{course.name}</span>
                  <span className={styles.courseCount}>
                    {course.student_count} {t('teacher.students')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Student selector (only when targetType=students) */}
        {targetType === 'students' && students.length > 0 && (
          <div className={styles.field}>
            <label className={styles.label}>
              {t('createAnnouncement.students')}
              {selectedStudents.length > 0 && ` (${selectedStudents.length})`}
            </label>
            <div className={styles.studentList}>
              {students.map((student) => (
                <button
                  key={student.id}
                  className={`${styles.studentCard} ${selectedStudents.includes(student.id) ? styles.studentCardActive : ''}`}
                  onClick={() => toggleStudent(student.id)}
                >
                  <span className={styles.studentName}>
                    {student.first_name || student.username || `${t('profile.student')} #${student.id}`}
                  </span>
                  {student.username && (
                    <span className={styles.studentUsername}>@{student.username}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        <div className={styles.field}>
          <label className={styles.label}>{t('createAnnouncement.attachments', { defaultValue: 'Вложения' })}</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className={styles.targetButton}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload_file</span>
              {uploadingFile ? t('common.loading') : t('createAnnouncement.attachFile', { defaultValue: 'Файл' })}
            </button>
            <button
              type="button"
              className={styles.targetButton}
              onClick={() => setShowLinkInput(!showLinkInput)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>link</span>
              {t('createAnnouncement.attachLink', { defaultValue: 'Ссылка' })}
            </button>
          </div>

          {showLinkInput && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="text"
                className={styles.input}
                placeholder={t('createAnnouncement.linkTitle', { defaultValue: 'Название ссылки' })}
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
              />
              <input
                type="url"
                className={styles.input}
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <button
                type="button"
                className={styles.targetButton}
                onClick={handleAddLink}
                disabled={!linkTitle.trim() || !linkUrl.trim()}
                style={{ alignSelf: 'flex-start' }}
              >
                {t('common.add', { defaultValue: 'Добавить' })}
              </button>
            </div>
          )}

          {attachments.length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {attachments.map((att) => (
                <div
                  key={att.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: 'var(--color-surface-variant, #f5f5f5)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>
                    {att.type === 'file' ? 'description' : 'link'}
                  </span>
                  <span style={{ flex: 1, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {att.title}
                  </span>
                  {att.file_size && (
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', whiteSpace: 'nowrap' }}>
                      {(att.file_size / 1024).toFixed(0)} KB
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-error, #ba1a1a)' }}>close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {/* Send button */}
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={sending || !message.trim()}
        >
          {sending ? t('common.loading') : t('createAnnouncement.send')}
        </button>

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
