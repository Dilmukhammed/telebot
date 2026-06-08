import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getMe, completeOnboarding } from '../api/client'
import { useUser } from '../context/UserContext'
import type { UserOut } from '../shared/types'
import styles from './OnboardingModal.module.css'

const grades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { t } = useTranslation()
  const { refresh } = useUser()
  const [user, setUser] = useState<UserOut | null>(null)
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)
  const [customRole, setCustomRole] = useState('')
  const [showOtherInput, setShowOtherInput] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phoneShared, setPhoneShared] = useState(false)
  const [sharedPhone, setSharedPhone] = useState<string | null>(null)
  const [showManualPhoneInput, setShowManualPhoneInput] = useState(false)
  const [manualPhone, setManualPhone] = useState('')

  useEffect(() => {
    if (isOpen) {
      getMe().then(u => {
        setUser(u)
        if (u.phone) setPhoneShared(true)
      }).catch(console.error)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleGradeSelect = (grade: string) => {
    setSelectedGrade(grade)
    setShowOtherInput(grade === 'other')
    if (grade !== 'other') {
      setCustomRole('')
    }
  }

  const handleSharePhone = () => {
    const tg = (window as any).Telegram?.WebApp
    if (!tg) {
      setShowManualPhoneInput(true)
      return
    }

    try {
      if (tg.requestContact && typeof tg.requestContact === 'function') {
        tg.requestContact((access: boolean, response?: any) => {
          if (access) {
            setPhoneShared(true)
            const phone = response?.responseUnsafe?.contact?.phone_number
            if (phone) {
              setSharedPhone(phone)
            }
          } else {
            setShowManualPhoneInput(true)
          }
        })
        return
      }
    } catch (err) {
      console.warn('requestContact failed', err)
    }

    setShowManualPhoneInput(true)
  }

  const handleComplete = async () => {
    if (!selectedGrade) return

    const grade = selectedGrade === 'other' ? customRole || t('onboarding.other') : selectedGrade
    setLoading(true)
    setError(null)

    try {
      await completeOnboarding({ grade, phone: sharedPhone || undefined })
      await refresh()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error completing onboarding')
    } finally {
      setLoading(false)
    }
  }

  const isReady = selectedGrade && (selectedGrade !== 'other' || customRole.trim())
  const hasPhone = !!user?.phone || phoneShared || !!sharedPhone

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Hero Aesthetic Element */}
        <div className={styles.heroSection}>
          <div className={styles.heroDecor} />
          <div className={styles.heroIcon}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'white', fontVariationSettings: "'FILL' 1" }}>
              calculate
            </span>
          </div>
          <svg className={styles.heroMathSymbol} viewBox="0 0 100 100" width="100" height="100">
            <text x="10" y="70" fill="white" fontFamily="Inter" fontSize="50" fontWeight="bold">∑</text>
          </svg>
        </div>

        {/* Content Container */}
        <div className={styles.content}>
          <div className={styles.greeting}>
            <h1 className={styles.greetingTitle}>
              {t('onboarding.greeting', { name: user?.first_name || t('profile.user') })}
            </h1>
            <p className={styles.greetingSubtitle}>{t('onboarding.selectClass')}</p>
          </div>

          {/* Class Selection Grid */}
          <div className={styles.gradeGrid}>
            {grades.map((grade) => (
              <button
                key={grade}
                className={`${styles.gradeButton} ${selectedGrade === grade ? styles.gradeButtonActive : ''}`}
                onClick={() => handleGradeSelect(grade)}
              >
                <span className={styles.gradeText}>{grade}</span>
              </button>
            ))}
            <button
              className={`${styles.otherButton} ${selectedGrade === 'other' ? styles.gradeButtonActive : ''}`}
              onClick={() => handleGradeSelect('other')}
            >
              <span className={styles.otherText}>{t('onboarding.other')}</span>
            </button>
          </div>

          {/* Hidden Input Field for "Other" */}
          {showOtherInput && (
            <div className={styles.otherInputContainer}>
              <input
                type="text"
                className={styles.otherInput}
                placeholder={t('onboarding.specifyRole')}
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                maxLength={50}
                autoFocus
              />
            </div>
          )}

          {/* Phone Section */}
          <div className={styles.phoneSection}>
            {hasPhone ? (
              <div className={styles.phoneShared}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#43a047', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className={styles.phoneSharedText}>{t('onboarding.phoneShared')}</span>
              </div>
            ) : showManualPhoneInput ? (
              <div className={styles.otherInputContainer}>
                <input
                  type="tel"
                  className={styles.otherInput}
                  placeholder="+998 (90) 123-45-67"
                  value={manualPhone}
                  onChange={(e) => {
                    setManualPhone(e.target.value)
                    setSharedPhone(e.target.value)
                  }}
                  autoFocus
                />
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

          {/* Error */}
          {error && (
            <div style={{ padding: '8px 12px', background: 'rgba(186, 26, 26, 0.08)', borderRadius: '8px', color: '#ba1a1a', fontSize: '13px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {/* Main Action */}
          <div className={styles.actionSection}>
            <button
              className={`${styles.readyButton} ${!isReady ? styles.readyButtonDisabled : ''}`}
              disabled={!isReady || loading}
              onClick={handleComplete}
            >
              {loading ? t('common.loading') : t('onboarding.ready')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
