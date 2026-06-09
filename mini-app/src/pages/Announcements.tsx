import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAnnouncements, getTeacherAnnouncements } from '../api/client'
import { useUser } from '../context/UserContext'
import type { AnnouncementOut } from '../shared/types'
import { formatDateTime, langToLocale } from '../shared/utils/formatDate'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './Announcements.module.css'

const LAST_SEEN_KEY = 'lastSeenAnnouncement'

function getLastSeenTime(): number {
  try {
    return Number(localStorage.getItem(LAST_SEEN_KEY)) || 0
  } catch {
    return 0
  }
}

function isNewAnnouncement(sentAt: string, lastSeen: number): boolean {
  return new Date(sentAt).getTime() > lastSeen
}

export default function Announcements() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useUser()
  const [announcements, setAnnouncements] = useState<AnnouncementOut[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSeen] = useState(getLastSeenTime)

  useEffect(() => {
    const isPrivileged = user && (user.role === 'teacher' || user.role === 'admin')
    const fetcher = isPrivileged
      ? getTeacherAnnouncements().catch(() => getAnnouncements())
      : getAnnouncements()
    fetcher
      .then(setAnnouncements)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  // Mark announcements as seen when leaving the page
  useEffect(() => {
    return () => {
      const now = Date.now()
      try {
        localStorage.setItem(LAST_SEEN_KEY, String(now))
      } catch {}
    }
  }, [])

  if (loading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  return (
    <div className={styles.page}>
      <SiteHeader title={t('announcements.title')} onBack={() => navigate(-1)} hideProfile />

      <main className={styles.main}>
        {announcements.length > 0 ? (
          <div className={styles.list}>
            {announcements.map((item) => (
              <div
                key={item.id}
                className={styles.card}
                onClick={() => navigate(`/announcement/${item.id}`)}
              >
                <div className={styles.cardContent}>
                  {item.sender_name && (
                    <span className={styles.cardSender}>
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                        {item.sender_role === 'teacher' ? 'school' : 'admin_panel_settings'}
                      </span>
                      {item.sender_name} · {item.sender_role === 'teacher' ? t('profile.teacher') : t('profile.admin')}
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.title && (
                      <h3 className={styles.cardTitle}>{item.title}</h3>
                    )}
                    {isNewAnnouncement(item.sent_at, lastSeen) && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        flexShrink: 0,
                      }} />
                    )}
                  </div>
                  <p className={styles.cardMessage}>
                    {item.message.length > 120
                      ? item.message.slice(0, 120) + '...'
                      : item.message}
                  </p>
                  <span className={styles.cardDate}>{formatDateTime(item.sent_at, langToLocale(i18n.language))}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--color-outline)' }}>
              campaign
            </span>
            <p>{t('announcements.noAnnouncements')}</p>
          </div>
        )}

        <div className={styles.bottomSpacer} />
      </main>
    </div>
  )
}
