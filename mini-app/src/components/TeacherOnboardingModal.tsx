import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getMe, completeOnboarding } from '../api/client'
import type { UserOut } from '../shared/types'
import styles from './OnboardingModal.module.css'

interface TeacherOnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function TeacherOnboardingModal({ isOpen, onClose }: TeacherOnboardingModalProps) {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserOut | null>(null)
  const [loading, setLoading] = useState(false)
  const [phoneShared, setPhoneShared] = useState(false)
  const [sharedPhone, setSharedPhone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isOpen) {
      getMe().then(u => {
        setUser(u)
        // Don't set phoneShared here - user must share phone manually
      }).catch(console.error)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSharePhone = () => {
    const tg = (window as any).Telegram?.WebApp
    if (!tg) return

    try {
      if (typeof tg.requestContact === 'function') {
        tg.requestContact((access: boolean, response?: any) => {
          if (access) {
            setPhoneShared(true)
            const phone = response?.responseUnsafe?.contact?.phone_number
            if (phone) {
              setSharedPhone(phone)
              // Compare with admin-entered phone
              verifyPhone(phone)
            }
          }
        })
        return
      }
    } catch { /* requestContact not available */ }

    try {
      tg.sendData('request_phone')
    } catch {
      try { tg.close() } catch { /* not in Telegram */ }
    }
  }

  const verifyPhone = async (phone: string) => {
    if (!user) return

    // Phone is verified by sharing via Telegram requestContact
    setLoading(true)
    try {
      await completeOnboarding({ grade: '', phone })
      setSuccess(true)
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      setError(t('teacherOnboarding.errorSave'))
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    if (!user) return

    setLoading(true)
    try {
      await completeOnboarding({ grade: '', phone: sharedPhone || user.phone })
      setSuccess(true)
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      setError(t('teacherOnboarding.errorSave'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Hero Section */}
        <div className={styles.heroSection}>
          <div className={styles.heroDecor} />
          <div className={styles.heroIcon}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'white', fontVariationSettings: "'FILL' 1" }}>
              school
            </span>
          </div>
          <svg className={styles.heroMathSymbol} viewBox="0 0 100 100" width="100" height="100">
            <text x="10" y="70" fill="white" fontFamily="Inter" fontSize="50" fontWeight="bold">∑</text>
          </svg>
        </div>

        {/* Content */}
        <div className={styles.content}>
          <div className={styles.greeting}>
            <h1 className={styles.greetingTitle}>
              {t('teacherOnboarding.greeting', { name: user?.first_name || (user?.username ? `@${user.username}` : t('profile.teacher')) })}
            </h1>
            <p className={styles.greetingSubtitle}>{t('teacherOnboarding.subtitle')}</p>
          </div>

          {/* Success State */}
          {success && (
            <div className={styles.successState}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#43a047', fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              <p className={styles.successText}>{t('teacherOnboarding.success')}</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className={styles.errorState}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ba1a1a' }}>
                error
              </span>
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          {/* Phone Section */}
          {!success && !error && (
            <div className={styles.phoneSection}>
              {phoneShared ? (
                <div className={styles.phoneShared}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#43a047', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className={styles.phoneSharedText}>{t('onboarding.phoneShared')}</span>
                </div>
              ) : (
                <button
                  className={styles.phoneButton}
                  onClick={handleSharePhone}
                >
                  <svg className={styles.telegramIcon} viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.52-1.4.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.42-1.39-.88.03-.24.36-.48 1-.74 3.91-1.7 6.51-2.82 7.82-3.37 3.71-1.56 4.48-1.83 4.98-1.84.11 0 .35.03.5.16.13.1.17.24.18.33-.01.07.01.21 0 .33z" />
                  </svg>
                  <span className={styles.phoneButtonText}>
                    {t('onboarding.sharePhone')}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Action Button */}
          {!success && !error && phoneShared && (
            <div className={styles.actionSection}>
              <button
                className={styles.readyButton}
                disabled={loading}
                onClick={handleComplete}
              >
                {loading ? t('common.loading') : t('teacherOnboarding.confirm')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
