import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAnnouncementDetail, useAdminAnnouncementRecipients as useAnnouncementRecipients, useMarkAnnouncementRead } from '../api/hooks'
import { useUser } from '../context/UserContext'
import { formatDateTime, langToLocale } from '../shared/utils/formatDate'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './AnnouncementDetail.module.css'

const PREVIEW_COUNT = 5

export default function AnnouncementDetail() {
  const { t, i18n } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useUser()
  const role = user?.role === 'teacher' || user?.role === 'admin' ? 'teacher' : 'student'
  const numId = Number(id)
  const { data: announcement, isLoading, error } = useAnnouncementDetail(numId, role)
  const { data: recipients = [] } = useAnnouncementRecipients(numId)
  const markReadMutation = useMarkAnnouncementRead()
  const [showAllRecipients, setShowAllRecipients] = useState(false)
  const hasMarkedRead = useRef(false)

  // Mark as read when viewing (only once per mount)
  useEffect(() => {
    if (announcement && numId && !announcement.is_read && !hasMarkedRead.current && !markReadMutation.isPending) {
      hasMarkedRead.current = true
      markReadMutation.mutate(numId)
    }
  }, [announcement, numId])

  if (isLoading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  if (error || !announcement) {
    return (
      <div className={styles.page}>
        <SiteHeader title={t('announcements.detailTitle')} onBack={() => navigate(-1)} />
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

  const visibleRecipients = showAllRecipients ? recipients : recipients.slice(0, PREVIEW_COUNT)
  const hasMore = recipients.length > PREVIEW_COUNT

  return (
    <div className={styles.page}>
      <SiteHeader title={t('announcements.detailTitle')} onBack={() => navigate(-1)} />

      <main className={styles.main}>
        <div className={styles.card}>
          {announcement.sender_name && (
            <span className={styles.sender}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {announcement.sender_role === 'teacher' ? 'school' : 'admin_panel_settings'}
              </span>
              {announcement.sender_name} · {announcement.sender_role === 'teacher' ? t('profile.teacher') : t('profile.admin')}
            </span>
          )}
          {announcement.title && (
            <h2 className={styles.title}>{announcement.title}</h2>
          )}
          <span className={styles.date}>{formatDateTime(announcement.sent_at, langToLocale(i18n.language))}</span>
          <div className={styles.divider} />
          <p className={styles.message}>{announcement.message}</p>
        </div>

        {/* Attachments */}
        {announcement.attachments && announcement.attachments.length > 0 && (
          <div className={styles.card} style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>attach_file</span>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>
                {t('announcements.attachments', { defaultValue: 'Вложения' })} ({announcement.attachments.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {announcement.attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '10px',
                    background: 'var(--color-surface-variant, #f5f5f5)',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary)' }}>
                    {att.type === 'file' ? 'description' : 'link'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.title}
                    </div>
                    {att.file_name && att.file_name !== att.title && (
                      <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {att.file_name}
                      </div>
                    )}
                  </div>
                  {att.file_size && (
                    <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', whiteSpace: 'nowrap' }}>
                      {att.file_size > 1024 * 1024
                        ? `${(att.file_size / (1024 * 1024)).toFixed(1)} MB`
                        : `${(att.file_size / 1024).toFixed(0)} KB`}
                    </span>
                  )}
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-on-surface-variant)' }}>open_in_new</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Recipients section (only for teacher's own announcements) */}
        {recipients.length > 0 && (
          <div className={styles.recipientsSection}>
            <div className={styles.recipientsHeader}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>people</span>
              <span className={styles.recipientsTitle}>
                {t('announcements.sentTo')} ({recipients.length})
              </span>
            </div>
            <div className={styles.recipientsList}>
              {visibleRecipients.map((r) => (
                <div key={r.id} className={styles.recipientChip}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person</span>
                  {r.first_name}
                </div>
              ))}
            </div>
            {hasMore && !showAllRecipients && (
              <button
                className={styles.showAllButton}
                onClick={() => setShowAllRecipients(true)}
              >
                {t('announcements.showAllRecipients', { count: recipients.length })}
              </button>
            )}
          </div>
        )}

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
