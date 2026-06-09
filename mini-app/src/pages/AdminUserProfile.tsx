import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAdminUser, updateAdminUserRole } from '../api/client'
import type { UserOut } from '../shared/types'
import SiteHeader from '../components/SiteHeader'
import styles from './AdminUserProfile.module.css'

export default function AdminUserProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<UserOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingRole, setUpdatingRole] = useState(false)

  useEffect(() => {
    const numId = Number(id)
    if (!id || isNaN(numId)) { setLoading(false); return }
    setLoading(true)
    getAdminUser(numId)
      .then(setUser)
      .catch(err => setError(err.message || 'Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [id])

  const handleRoleChange = async (newRole: string) => {
    if (!user) return
    if (newRole === user.role) return
    const labels: Record<string, string> = { student: 'Ученик', teacher: 'Преподаватель', admin: 'Администратор' }
    if (!window.confirm(`Изменить роль на "${labels[newRole]}"?`)) return
    setError('')
    setUpdatingRole(true)
    try {
      await updateAdminUserRole(user.id, newRole)
      setUser(prev => prev ? { ...prev, role: newRole } : null)
    } catch (e: any) {
      setError(e.message || 'Ошибка обновления роли')
    } finally {
      setUpdatingRole(false)
    }
  }

  if (loading) return <div className={styles.loading}>Загрузка...</div>
  if (error || !user) {
    return (
      <div className={styles.page}>
        <SiteHeader title="Профиль" onBack={() => navigate('/admin/people')} hideProfile />
        <main className={styles.main}>
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#7b7487' }}>person_off</span>
            <p>{error || 'Пользователь не найден'}</p>
          </div>
        </main>
      </div>
    )
  }

  const getInitials = () => {
    if (user.first_name) return user.first_name[0].toUpperCase()
    if (user.username) return user.username[0].toUpperCase()
    return '?'
  }

  const roleLabel = user.role === 'admin' ? 'Администратор' : user.role === 'teacher' ? 'Преподаватель' : 'Ученик'

  return (
    <div className={styles.page}>
      <SiteHeader
        title={`${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Профиль'}
        onBack={() => navigate('/admin/people')}
        hideProfile
      />

      <main className={styles.main}>
        {/* Profile header */}
        <div className={styles.profileCard}>
          <div className={styles.avatar}>
            {user.photo_url ? (
              <img src={user.photo_url} alt="" className={styles.avatarImg} />
            ) : (
              getInitials()
            )}
          </div>
          <div className={styles.profileInfo}>
            <h1 className={styles.name}>{user.first_name || 'Без имени'} {user.last_name || ''}</h1>
            <div className={styles.meta}>
              {user.username && <span className={styles.metaTag}>@{user.username}</span>}
              <span className={styles.metaTag}>{roleLabel}</span>
              <span className={`${styles.metaTag} ${user.is_active ? styles.metaTagActive : styles.metaTagInactive}`}>
                {user.is_active ? 'Активен' : 'Неактивен'}
              </span>
            </div>
          </div>
        </div>

        {/* Info */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Информация</h3>
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
                <span className={styles.infoLabel}>Телефон</span>
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
                <span className={styles.infoLabel}>Класс</span>
              </div>
              <span className={styles.infoValue}>{user.grade ? `${user.grade} кл.` : '—'}</span>
            </div>
          </div>
        </section>

        {/* Role management */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Управление ролью</h3>
          {error && (
            <div style={{ color: '#ef4444', fontSize: '13px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', marginBottom: '8px' }}>
              {error}
            </div>
          )}
          <div className={styles.roleSelectorContainer}>
            {[
              { r: 'student', label: 'Ученик', icon: 'person' },
              { r: 'teacher', label: 'Преподаватель', icon: 'school' },
              { r: 'admin', label: 'Администратор', icon: 'admin_panel_settings' }
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
