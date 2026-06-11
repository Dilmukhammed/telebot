import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useJoinCourse } from '../api/hooks'
import SiteHeader from '../components/SiteHeader'
import styles from './JoinCourse.module.css'

export default function JoinCourse() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const joinMutation = useJoinCourse()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) {
      setError(t('joinCourse.errorLength'))
      return
    }

    setError('')
    setSuccess('')

    try {
      const result = await joinMutation.mutateAsync(code.toUpperCase())
      setSuccess(result.message || t('joinCourse.successMessage'))
      setCode('')
    } catch (e: any) {
      setError(e.message || t('joinCourse.errorMessage'))
    }
  }

  const codeLength = 6
  const codeChars = code.padEnd(codeLength, ' ').split('')

  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  return (
    <div className={styles.page}>
      <SiteHeader title={t('joinCourse.title')} onBack={() => navigate(-1)} hideProfile />

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.iconContainer}>
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-primary)' }}>
              key
            </span>
          </div>

          <h1 className={styles.title}>{t('joinCourse.enterCode')}</h1>
          <p className={styles.subtitle}>
            {t('joinCourse.subtitle')}
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.codeContainer} onClick={handleContainerClick}>
              <input
                ref={inputRef}
                type="text"
                value={code}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
                  setCode(val)
                  setError('')
                }}
                placeholder=""
                maxLength={6}
                className={styles.hiddenInput}
                autoComplete="off"
                autoFocus
              />
              <div className={styles.slotsGrid}>
                {codeChars.map((char, index) => {
                  const isActive = index === code.length
                  const isFilled = char !== ' '
                  return (
                    <div
                      key={index}
                      className={`${styles.slot} ${isActive ? styles.slotActive : ''} ${isFilled ? styles.slotFilled : ''}`}
                    >
                      {char}
                    </div>
                  )
                })}
              </div>
            </div>

            {error && (
              <div className={styles.error}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
                {error}
              </div>
            )}

            {success && (
              <div className={styles.success}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={code.length !== 6 || joinMutation.isPending}
              className={styles.submitButton}
            >
              {joinMutation.isPending ? (
                <span className={styles.spinner} />
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>send</span>
                  {t('joinCourse.submitBtn')}
                </>
              )}
            </button>
          </form>

          <button
            onClick={() => navigate('/courses')}
            className={styles.linkButton}
          >
            {t('joinCourse.viewCourses')}
          </button>
        </div>
      </main>
    </div>
  )
}
