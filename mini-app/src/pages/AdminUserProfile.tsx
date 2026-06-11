import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAdminUser, useUpdateAdminUserRole } from '../api/hooks'
import Avatar from '../components/Avatar'
import SiteHeader from '../components/SiteHeader'
import { getProfileCardStyle, hasProfileStatus, normalizeProfileTheme } from '../shared/profileTheme'
import styles from './AdminUserProfile.module.css'

export default function AdminUserProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const numId = Number(id)
  const { data: user, isLoading, error, refetch } = useAdminUser(numId)
  const updateRoleMutation = useUpdateAdminUserRole()
  const [updatingRole, setUpdatingRole] = useState(false)
  const [_roleError, setRoleError] = useState('')

  const handleRoleChange = async (newRole: string) => {
    if (!user) return
    if (newRole === user.role) return
    const labels: Record<string, string> = {
      student: t('admin.profile.role_student'),
      teacher: t('admin.profile.role_teacher'),
      admin: t('admin.profile.role_admin')
    }
    if (!window.confirm(t('admin.profile.change_role_confirm', { role: labels[newRole] }))) return
    setRoleError('')
    setUpdatingRole(true)
    try {
      await updateRoleMutation.mutateAsync({ id: user.id, role: newRole })
      await refetch()
    } catch (e: any) {
      setRoleError(e.message || t('admin.profile.update_role_error'))
    } finally {
      setUpdatingRole(false)
    }
  }

  if (isLoading) return <div className={styles.loading}>{t('common.loading')}</div>
  if (error || !user) {
    return (
      <div className={styles.page}>
        <SiteHeader title={t('admin.profile.title')} onBack={() => navigate('/admin/people')} />
        <main className={styles.main}>
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>person_off</span>
            <p>{error?.message || t('admin.profile.user_not_found')}</p>
          </div>
        </main>
      </div>
    )
  }

  const roleLabel = user.role === 'admin' ? t('admin.profile.role_admin') : user.role === 'teacher' ? t('admin.profile.role_teacher') : t('admin.profile.role_student')
  const profileTheme = normalizeProfileTheme(user.profile_theme)
  const cardStyle = getProfileCardStyle(profileTheme)

  return (
    <div className={styles.page}>
      <SiteHeader
        title={`${user.first_name || ''} ${user.last_name || ''}`.trim() || t('admin.profile.title')}
        onBack={() => navigate('/admin/people')}
      />

      <main className={styles.main}>
        {/* Profile header */}
        <div className={styles.profileCard} style={cardStyle}>
          <Avatar photoUrl={user.photo_url} name={user.first_name || user.username} size={64} className={styles.avatar} />
          <div className={styles.profileInfo}>
            <h1 className={styles.name}>{user.first_name || t('admin.people.no_name')} {user.last_name || ''}</h1>
            <div className={styles.meta}>
              {user.username && <span className={styles.metaTag}>@{user.username}</span>}
              <span className={styles.metaTag}>{roleLabel}</span>
              <span className={`${styles.metaTag} ${user.is_active ? styles.metaTagActive : styles.metaTagInactive}`}>
                {user.is_active ? t('admin.profile.active') : t('admin.profile.inactive')}
              </span>
            </div>
            {hasProfileStatus(profileTheme) && (
              <p className={styles.statusLine}>
                {profileTheme.status_emoji && <span>{profileTheme.status_emoji}</span>}
                {profileTheme.status_text && <span>{profileTheme.status_text}</span>}
              </p>
            )}
          </div>
        </div>

        {/* Info */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('admin.profile.info_section')}</h3>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <div className={styles.infoItemHeader}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>fingerprint</span>
                <span className={styles.infoLabel}>ID</span>
              </div>
              <span className={styles.infoValue}>{user.id}</span>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoItemHeader}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>alternate_email</span>
                <span className={styles.infoLabel}>Telegram ID</span>
              </div>
              <span className={styles.infoValue}>{user.telegram_id}</span>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoItemHeader}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>call</span>
                <span className={styles.infoLabel}>{t('admin.profile.phone')}</span>
              </div>
              {user.phone ? (
                <a href={`tel:${user.phone}`} className={styles.infoValueLink}>{user.phone}</a>
              ) : (
                <span className={styles.infoValue}>—</span>
              )}
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoItemHeader}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-primary)' }}>school</span>
                <span className={styles.infoLabel}>{t('admin.profile.grade')}</span>
              </div>
              <span className={styles.infoValue}>{user.grade ? t('admin.people.grade', { grade: user.grade }) : '—'}</span>
            </div>
          </div>
        </section>

        {/* Role management */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('admin.profile.role_management')}</h3>
          {error && (
            <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', marginBottom: '8px' }}>
              {error}
            </div>
          )}
          <div className={styles.roleSelectorContainer}>
            {[
              { r: 'student', label: t('admin.profile.role_student'), icon: 'person' },
              { r: 'teacher', label: t('admin.profile.role_teacher'), icon: 'school' },
              { r: 'admin', label: t('admin.profile.role_admin'), icon: 'admin_panel_settings' }
            ].map(({ r, label, icon }) => {
              const active = user.role === r
              return (
                <button
                  key={r}
                  type="button"
                  disabled={updatingRole}
                  onClick={() => handleRoleChange(r)}
                  className={`${styles.roleOptionCard} ${active ? styles.roleOptionCardActive : ''}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{icon}</span>
                  <span className={styles.roleOptionLabel}>{label}</span>
                  {active && (
                    <span className={`material-symbols-outlined ${styles.roleOptionCheck}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
