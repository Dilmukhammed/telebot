import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAnnouncementDetail, getTeacherAnnouncementDetail, getAnnouncementRecipients, markAnnouncementAsRead } from '../api/client'
import { useUser } from '../context/UserContext'
import type { AnnouncementOut, AnnouncementRecipient } from '../shared/types'
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
  const [announcement, setAnnouncement] = useState<AnnouncementOut | null>(null)
  const [recipients, setRecipients] = useState<AnnouncementRecipient[]>([])
  const [showAllRecipients, setShowAllRecipients] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const numId = Number(id)
    const isPrivileged = user && (user.role === 'teacher' || user.role === 'admin')

    const fetcher = isPrivileged
      ? getTeacherAnnouncementDetail(numId).catch(() => getAnnouncementDetail(numId))
      : getAnnouncementDetail(numId)

    fetcher
      .then((data) => {
        setAnnouncement(data)
        if (isPrivileged && data.recipient_count && data.recipient_count > 0) {
          getAnnouncementRecipients(numId).then(setRecipients).catch(console.error)
        }
        // Mark as read for students
        if (!isPrivileged) {
          markAnnouncementAsRead(numId).catch(() => {})
        }
      })
      .catch((e) => setError(e.message || t('common.error')))
      .finally(() => setLoading(false))
  }, [id, user, t])

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
          <span className={styles.date}>{formatDateTime(announcement.sent_at, langToLocale(i18n.language))}</span>
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
