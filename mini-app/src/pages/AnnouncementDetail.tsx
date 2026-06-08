import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAnnouncementDetail, getTeacherAnnouncementDetail, getAnnouncementRecipients } from '../api/client'
import type { AnnouncementOut, AnnouncementRecipient } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './AnnouncementDetail.module.css'

const formatDate = (isoString: string) => {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

const PREVIEW_COUNT = 5

export default function AnnouncementDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [announcement, setAnnouncement] = useState<AnnouncementOut | null>(null)
  const [recipients, setRecipients] = useState<AnnouncementRecipient[]>([])
  const [showAllRecipients, setShowAllRecipients] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      getTeacherAnnouncementDetail(Number(id))
        .then((data) => {
          setAnnouncement(data)
          // If this is the teacher's own announcement, fetch recipients
          if (data.recipient_count && data.recipient_count > 0) {
            getAnnouncementRecipients(Number(id))
              .then(setRecipients)
              .catch(console.error)
          }
        })
        .catch(() => getAnnouncementDetail(Number(id)).then(setAnnouncement))
        .catch((e) => {
          console.error(e)
          setError(e.message || 'Error loading announcement')
        })
        .finally(() => setLoading(false))
    }
  }, [id])

  if (loading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  if (error || !announcement) {
    return (
      <div className={styles.page}>
        <SiteHeader title={t('announcements.detailTitle')} onBack={() => navigate(-1)} hideProfile />
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

  const visibleRecipients = showAllRecipients ? recipients : recipients.slice(0, PREVIEW_COUNT)
  const hasMore = recipients.length > PREVIEW_COUNT

  return (
    <div className={styles.page}>
      <SiteHeader title={t('announcements.detailTitle')} onBack={() => navigate(-1)} hideProfile />

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
          <span className={styles.date}>{formatDate(announcement.sent_at)}</span>
          <div className={styles.divider} />
          <p className={styles.message}>{announcement.message}</p>
        </div>

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
