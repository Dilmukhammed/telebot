import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAdminAnnouncements, useAdminSubjects, useAdminUsers } from '../api/hooks'
import {
  createAdminAnnouncement,
  uploadAnnouncementAttachment,
  createAnnouncementLinkAttachment,
  deleteAnnouncementAttachment,
} from '../api/client'
import type {
  AdminAnnouncementCreate,
} from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import { langToLocale } from '../shared/utils/formatDate'
import styles from './AdminAnnouncements.module.css'

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '')

interface PendingAttachment {
  id: number
  title: string
  type: 'file' | 'link'
  mediaType?: 'image' | 'video' | 'file'
  url?: string
  file_name?: string
  file_size?: number
}

const formatDate = (isoString: string, locale: string) => {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return d.toLocaleDateString(locale, {
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
  const { t, i18n } = useTranslation()
  const currentLocale = langToLocale(i18n.language)
  const { data: announcements = [], isLoading, refetch } = useAdminAnnouncements()
  const { data: courses = [] } = useAdminSubjects()
  const { data: students = [] } = useAdminUsers('student')
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetType, setTargetType] = useState<AdminAnnouncementCreate['target_type']>('all')
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([])
  const [teachers] = useState<any[]>([])
  const [targetId, setTargetId] = useState<number | ''>('')

  // Attachment state
  const [attachments, setAttachments] = useState<PendingAttachment[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCreateClick = () => {
    setTitle('')
    setMessage('')
    setTargetType('all')
    setSelectedCourseIds([])
    setSelectedStudentIds([])
    setTargetId('')
    setAttachments([])
    setShowLinkInput(false)
    setLinkTitle('')
    setLinkUrl('')
    setError('')
    setModalOpen(true)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    try {
      const result = await uploadAnnouncementAttachment(file, file.name)
      const mime = file.type || ''
      const mediaType: 'image' | 'video' | 'file' = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'file'
      setAttachments(prev => [...prev, { id: result.id, title: result.title, type: 'file', mediaType, url: result.url, file_name: result.file_name, file_size: result.file_size }])
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
    } catch { /* ignore */ }
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message) {
      setError(t('admin.announcements.message_required'))
      return
    }
    if (targetType === 'course' && selectedCourseIds.length === 0) {
      setError(t('admin.announcements.course_required'))
      return
    }
    if (targetType === 'specific_students' && selectedStudentIds.length === 0) {
      setError(t('admin.announcements.student_required'))
      return
    }
    if (targetType === 'teacher_courses' && !targetId) {
      setError(t('admin.announcements.teacher_required'))
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
        attachment_ids: attachments.length > 0 ? attachments.map(a => a.id) : undefined,
      })
      setModalOpen(false)
      refetch()
    } catch (err: any) {
      setError(err.message || t('admin.announcements.send_error'))
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
      <SiteHeader title={t('admin.announcements.title')} onBack={() => navigate('/dashboard')} />

      <main className={styles.main}>
        <div className={styles.header}>
          <h2 className={styles.headerTitle}>{t('admin.announcements.title')}</h2>
          <button className={styles.createBtn} onClick={handleCreateClick}>
            <span className="material-symbols-outlined">add</span>
            <span>{t('admin.announcements.new')}</span>
          </button>
        </div>

        {isLoading ? (
          <div className={styles.loading}>{t('common.loading')}</div>
        ) : announcements.length === 0 ? (
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>campaign</span>
            <p>{t('admin.announcements.no_announcements')}</p>
          </div>
        ) : (
          <div className={styles.list}>
            {announcements.map(a => (
              <div key={a.id} className={styles.card} onClick={() => navigate(`/admin/announcements/${a.id}`)} style={{ cursor: 'pointer' }}>
                <div className={styles.cardHeader}>
                  <span className={styles.target}>{a.target_summary}</span>
                  <span className={styles.date}>{formatDate(a.sent_at, currentLocale)}</span>
                </div>
                {a.title && <h4 className={styles.cardTitle}>{a.title}</h4>}
                <p className={styles.cardMessage}>{stripHtml(a.message)}</p>
                <div className={styles.cardFooter}>
                  <span>{t('admin.announcements.recipients_count', { count: a.recipient_count })}</span>
                  {a.sender_name && <span>{t('admin.announcements.sender', { name: a.sender_name })}</span>}
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
                <h3 className={styles.modalTitle}>{t('admin.announcements.new_announcement')}</h3>
                <button className={styles.modalClose} onClick={() => setModalOpen(false)}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                </button>
              </div>
              <p className={styles.modalSub}>{t('admin.announcements.tg_hint')}</p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                <div className={styles.field}>
                  <label>{t('admin.announcements.subject_optional')}</label>
                  <input type="text" placeholder={t('admin.announcements.subject_placeholder')} value={title} onChange={e => setTitle(e.target.value)} />
                </div>

                <div className={styles.field}>
                  <label>{t('admin.announcements.recipient_label')}</label>
                  <select value={targetType} onChange={e => setTargetType(e.target.value as AdminAnnouncementCreate['target_type'])}>
                    <option value="all">{t('admin.announcements.target_all')}</option>
                    <option value="teachers">{t('admin.announcements.target_teachers')}</option>
                    <option value="students">{t('admin.announcements.target_students')}</option>
                    <option value="course">{t('admin.announcements.target_course')}</option>
                    <option value="specific_students">{t('admin.announcements.target_specific_students')}</option>
                    <option value="teacher_courses">{t('admin.announcements.target_teacher_courses')}</option>
                  </select>
                </div>

                {targetType === 'course' && (
                  <div className={styles.field}>
                    <label>{t('admin.announcements.courses_label')}</label>
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
                    <label>{t('admin.announcements.students_label')}</label>
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
                    <label>{t('admin.announcements.teacher_label')}</label>
                    <select value={targetId} onChange={e => setTargetId(e.target.value ? Number(e.target.value) : '')}>
                      <option value="">{t('admin.announcements.select_teacher_placeholder')}</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.first_name} {t.last_name || ''} {t.username ? `(@${t.username})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={styles.field}>
                  <label>{t('admin.announcements.message_label')}</label>
                  <textarea placeholder={t('admin.announcements.message_placeholder')} value={message} onChange={e => setMessage(e.target.value)} />
                </div>

                {/* Attachments */}
                <div className={styles.field}>
                  <label>{t('createAnnouncement.attachments', { defaultValue: 'Вложения' })}</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>upload_file</span>
                      {uploadingFile ? t('common.loading') : t('createAnnouncement.attachFile', { defaultValue: 'Файл' })}
                    </button>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() => setShowLinkInput(!showLinkInput)}
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>link</span>
                      {t('createAnnouncement.attachLink', { defaultValue: 'Ссылка' })}
                    </button>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
                    {t('createAnnouncement.uploadHint', { defaultValue: 'Фото, видео или файл (до 50 МБ)' })}
                  </div>

                  {showLinkInput && (
                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <input
                        type="text"
                        placeholder={t('createAnnouncement.linkTitle', { defaultValue: 'Название ссылки' })}
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                      />
                      <input
                        type="url"
                        placeholder="https://..."
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={handleAddLink}
                        disabled={!linkTitle.trim() || !linkUrl.trim()}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {t('common.add', { defaultValue: 'Добавить' })}
                      </button>
                    </div>
                  )}

                  {attachments.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {attachments.map((att) => (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '6px 10px', borderRadius: '6px',
                            background: 'var(--color-surface-container-low, #f0f0f0)',
                            fontSize: '13px',
                          }}
                        >
                          {att.mediaType === 'image' && att.url ? (
                            <img
                              src={att.url}
                              alt={att.title}
                              style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                            />
                          ) : att.mediaType === 'video' ? (
                            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary)', flexShrink: 0 }}>videocam</span>
                          ) : (
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-primary)', flexShrink: 0 }}>
                              {att.type === 'link' ? 'link' : 'description'}
                            </span>
                          )}
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {att.title}
                          </span>
                          {att.file_size && (
                            <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', whiteSpace: 'nowrap' }}>
                              {(att.file_size / 1024).toFixed(0)} KB
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(att.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-error, #ba1a1a)' }}>close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {error && <div className={styles.error}>{error}</div>}

                <div className={styles.modalActions}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className={styles.submitBtn} disabled={submitting}>
                    {submitting ? t('admin.announcements.sending') : t('admin.announcements.send')}
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
