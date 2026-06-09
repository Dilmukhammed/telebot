import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateName } from '../api/client'
import { useAvailability, useCreateAvailability, useDeleteAvailability } from '../api/hooks'
import { useUser } from '../context/UserContext'
import { CENTER } from '../config'
import SiteHeader from '../components/SiteHeader'
import { Loading } from '../shared/components'
import styles from './Profile.module.css'

const languages = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'uz', label: "O'zbek", flag: '🇺🇿' },
]

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 12 && cleaned.startsWith('998')) {
    return `+${cleaned.slice(0, 3)} (${cleaned.slice(3, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8, 10)}-${cleaned.slice(10)}`
  }
  if (cleaned.length === 11 && cleaned.startsWith('8')) {
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`
  }
  return phone
}

export default function Profile() {
  const { t, i18n } = useTranslation()
  const { user, loading: userLoading, refresh: refreshUser } = useUser()
  const { data: availability = [] } = useAvailability()
  const createSlotMutation = useCreateAvailability()
  const deleteSlotMutation = useDeleteAvailability()
  const [showLangModal, setShowLangModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedLang, setSelectedLang] = useState(i18n.language)
  const [showSlotModal, setShowSlotModal] = useState(false)
  const [slotDays, setSlotDays] = useState<number[]>([0])
  const [slotStart, setSlotStart] = useState('10:00')
  const [slotEnd, setSlotEnd] = useState('14:00')
  const [slotToDelete, setSlotToDelete] = useState<number | null>(null)

  const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user
  const telegramAvatar = tgUser?.photo_url

  const handleSelectLang = (code: string) => {
    setSelectedLang(code)
    i18n.changeLanguage(code)
    localStorage.setItem('lang', code)
    setShowLangModal(false)
  }

  const handleOpenNameModal = () => {
    setEditFirstName(user?.first_name || '')
    setEditLastName(user?.last_name || '')
    setShowNameModal(true)
  }

  const handleSaveName = async () => {
    if (!editFirstName.trim()) return
    setSaving(true)
    try {
      await updateName(editFirstName.trim(), editLastName.trim() || undefined)
      await refreshUser()
      setShowNameModal(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleAddSlot = async () => {
    setSaving(true)
    try {
      for (const day of slotDays) {
        await createSlotMutation.mutateAsync({ day_of_week: day, start_time: slotStart, end_time: slotEnd })
      }
      setShowSlotModal(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSlot = async () => {
    if (slotToDelete === null) return
    try {
      await deleteSlotMutation.mutateAsync(slotToDelete)
    } catch (err) {
      alert(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSlotToDelete(null)
    }
  }

  const currentLang = languages.find(l => l.code === selectedLang)

  if (userLoading) {
    return <Loading fullPage message={t('common.loading')} />
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>{t('common.error')}</div>
      </div>
    )
  }

  const avatarUrl = telegramAvatar || user.photo_url
  const displayName = user.first_name || (user.username ? `@${user.username}` : t('profile.user'))
  const roleLabel = user.role === 'admin' ? t('profile.admin') : user.role === 'teacher' ? t('profile.teacher') : t('profile.student')

  return (
    <div className={styles.page}>
      <SiteHeader title={t('profile.title')} hideProfile />

      <main className={styles.main}>
        {/* Profile Hero Card */}
        <section className={styles.heroSection}>
          <div className={styles.heroCard}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className={styles.avatarImg} />
                ) : (
                  <span className="material-symbols-outlined">person</span>
                )}
              </div>
            </div>

            <div className={styles.nameRow}>
              <h2 className={styles.name}>{displayName}</h2>
              <button className={styles.editNameBtn} onClick={handleOpenNameModal}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
              </button>
            </div>
            {user.username && (
              <a
                href={`https://t.me/${user.username}`}
                className={styles.username}
                target="_blank"
                rel="noopener noreferrer"
              >
                @{user.username}
              </a>
            )}

            <div className={styles.badges}>
              <span className={styles.badgePrimary}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>stars</span>
                {roleLabel}
              </span>
              {user.grade && (
                <span className={styles.badgeSecondary}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>school</span>
                  {t('profile.grade', { grade: user.grade })}
                </span>
              )}
            </div>

            {user.phone && (
              <div className={styles.phoneRow}>
                <div className={styles.phoneInfo}>
                  <span className="material-symbols-outlined" style={{ color: '#7b7487' }}>call</span>
                  <span className={styles.phoneText}>{formatPhone(user.phone)}</span>
                </div>
                <div className={styles.verified}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>verified</span>
                  <span className={styles.verifiedText}>{t('common.verified')}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Settings Actions */}
        <section className={styles.actionsSection}>
          <div className={styles.actionsCard}>
            <button className={styles.actionBtn} onClick={() => setShowLangModal(true)}>
              <div className={styles.actionLeft}>
                <div className={styles.actionIcon}>
                  <span className="material-symbols-outlined">translate</span>
                </div>
                <span className={styles.actionLabel}>{t('profile.language')}</span>
              </div>
              <div className={styles.actionRight}>
                <span className={styles.actionValue}>{currentLang?.flag} {currentLang?.label}</span>
                <span className="material-symbols-outlined" style={{ color: '#7b7487' }}>chevron_right</span>
              </div>
            </button>

            <div className={styles.divider} />

            <button className={styles.actionBtn} onClick={() => setShowHelpModal(true)}>
              <div className={styles.actionLeft}>
                <div className={styles.actionIcon}>
                  <span className="material-symbols-outlined">help</span>
                </div>
                <span className={styles.actionLabel}>{t('profile.help')}</span>
              </div>
              <span className="material-symbols-outlined" style={{ color: '#7b7487' }}>chevron_right</span>
            </button>
          </div>
        </section>

        {/* Availability Section (teacher only) */}
        {user.role === 'teacher' && (
          <section className={styles.actionsSection}>
            <div className={styles.actionsCard}>
              <div className={styles.availabilityHeader}>
                <div className={styles.availabilityHeaderLeft}>
                  <span className={styles.availabilityTitle}>{t('profile.schedule')}</span>
                  {availability.length > 0 && (
                    <span className={styles.availabilityHours}>
                      {availability.reduce((sum, s) => {
                        const [sh, sm] = s.start_time.split(':').map(Number)
                        const [eh, em] = s.end_time.split(':').map(Number)
                        return sum + (eh * 60 + em - sh * 60 - sm) / 60
                      }, 0)} {t('profile.hoursPerWeek')}
                    </span>
                  )}
                </div>
                <button className={styles.addSlotBtn} onClick={() => { setSlotDays([0]); setSlotStart('10:00'); setSlotEnd('14:00'); setShowSlotModal(true) }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                  {t('profile.addSlot')}
                </button>
              </div>
              {availability.length === 0 ? (
                <p className={styles.noSlots}>{t('profile.noSlots')}</p>
              ) : (
                <div className={styles.slotList}>
                  {availability.map((slot) => (
                    <div key={slot.id} className={styles.slotItem}>
                      <span className={styles.slotDay}>{t(`days.${['monday','tuesday','wednesday','thursday','friday','saturday','sunday'][slot.day_of_week]}`)}</span>
                      <span className={styles.slotTime}>{slot.start_time} — {slot.end_time}</span>
                      <button className={styles.slotDelete} onClick={() => setSlotToDelete(slot.id)}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Language Modal */}
      {showLangModal && (
        <div className={styles.modalOverlay} onClick={() => setShowLangModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{t('profile.selectLanguage')}</h3>
              <button className={styles.modalClose} onClick={() => setShowLangModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.langList}>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  className={`${styles.langOption} ${selectedLang === lang.code ? styles.langOptionActive : ''}`}
                  onClick={() => handleSelectLang(lang.code)}
                >
                  <span className={styles.langFlag}>{lang.flag}</span>
                  <span className={styles.langLabel}>{lang.label}</span>
                  {selectedLang === lang.code && (
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className={styles.modalOverlay} onClick={() => setShowHelpModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{t('profile.help')}</h3>
              <button className={styles.modalClose} onClick={() => setShowHelpModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.helpContent}>
              <a href={CENTER.telegramUrl} className={styles.helpLink} target="_blank" rel="noopener noreferrer">
                <div className={styles.helpIcon}>
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="var(--color-primary)">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.42-1.39-.88.03-.24.36-.48 1-.74 3.91-1.7 6.51-2.82 7.82-3.37 3.71-1.56 4.48-1.83 4.98-1.84.11 0 .35.03.5.16.13.1.17.24.18.33-.01.07.01.21 0 .33z" />
                  </svg>
                </div>
                <div className={styles.helpInfo}>
                  <span className={styles.helpLabel}>Telegram</span>
                  <span className={styles.helpValue}>@{CENTER.telegramUsername}</span>
                </div>
                <span className="material-symbols-outlined" style={{ color: '#7b7487' }}>open_in_new</span>
              </a>

              <a href={`tel:${CENTER.phoneRaw}`} className={styles.helpLink}>
                <div className={styles.helpIcon}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>call</span>
                </div>
                <div className={styles.helpInfo}>
                  <span className={styles.helpLabel}>{t('profile.phone')}</span>
                  <span className={styles.helpValue}>{CENTER.phone}</span>
                </div>
                <span className="material-symbols-outlined" style={{ color: '#7b7487' }}>call</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Name Edit Modal */}
      {showNameModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNameModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{t('profile.editName')}</h3>
              <button className={styles.modalClose} onClick={() => setShowNameModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.nameEditContent}>
              <input
                type="text"
                className={styles.nameInput}
                placeholder={t('profile.firstName')}
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                autoFocus
              />
              <input
                type="text"
                className={styles.nameInput}
                placeholder={t('profile.lastName')}
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
              />
              <button
                className={styles.saveNameBtn}
                onClick={handleSaveName}
                disabled={!editFirstName.trim() || saving}
              >
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Slot Modal */}
      {showSlotModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSlotModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{t('profile.addSlot')}</h3>
              <button className={styles.modalClose} onClick={() => setShowSlotModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className={styles.slotForm}>
              <label className={styles.slotLabel}>{t('profile.selectDays')}</label>
              <div className={styles.dayPicker}>
                {[0,1,2,3,4,5,6].map(d => {
                  const dayKey = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'][d]
                  const active = slotDays.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      className={`${styles.dayPickBtn} ${active ? styles.dayPickBtnActive : ''}`}
                      onClick={() => setSlotDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())}
                    >
                      {t(`days.${dayKey}`).slice(0, 2)}
                    </button>
                  )
                })}
              </div>

              <label className={styles.slotLabel}>{t('profile.startTime')}</label>
              <input
                type="time"
                className={styles.slotTimeInput}
                value={slotStart}
                onChange={(e) => setSlotStart(e.target.value)}
              />

              <label className={styles.slotLabel}>{t('profile.endTime')}</label>
              <input
                type="time"
                className={styles.slotTimeInput}
                value={slotEnd}
                onChange={(e) => setSlotEnd(e.target.value)}
              />

              <button
                className={styles.saveNameBtn}
                onClick={handleAddSlot}
                disabled={saving || slotStart >= slotEnd || slotDays.length === 0}
              >
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {slotToDelete !== null && (
        <div className={styles.modalOverlay} onClick={() => setSlotToDelete(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-error, #ba1a1a)' }}>delete</span>
            <h3 className={styles.confirmTitle}>{t('profile.confirmDeleteSlot')}</h3>
            <p className={styles.confirmText}>{t('profile.confirmDeleteSlotText')}</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setSlotToDelete(null)}>
                {t('common.cancel')}
              </button>
              <button className={styles.confirmDelete} onClick={handleDeleteSlot}>
                {t('profile.deleteSlot')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
