import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { joinCourse } from '../api/client'
import SiteHeader from '../components/SiteHeader'
import styles from './JoinCourse.module.css'

export default function JoinCourse() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) {
      setError('Код должен содержать 6 символов')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await joinCourse(code.toUpperCase())
      setSuccess(result.message || 'Заявка успешно отправлена!')
      setCode('')
    } catch (e: any) {
      setError(e.message || 'Ошибка отправки заявки')
    } finally {
      setLoading(false)
    }
  }

  const codeLength = 6
  const codeChars = code.padEnd(codeLength, ' ').split('')

  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  return (
    <div className={styles.page}>
      <SiteHeader title="Запись на курс" onBack={() => navigate(-1)} hideProfile />

      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.iconContainer}>
            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--color-primary)' }}>
              key
            </span>
          </div>

          <h1 className={styles.title}>Введите код курса</h1>
          <p className={styles.subtitle}>
            Получите 6-значный код у преподавателя и введите его ниже
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
              disabled={code.length !== 6 || loading}
              className={styles.submitButton}
            >
              {loading ? (
                <span className={styles.spinner} />
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>send</span>
                  Отправить заявку
                </>
              )}
            </button>
          </form>

          <button
            onClick={() => navigate('/courses')}
            className={styles.linkButton}
          >
            Посмотреть доступные курсы
          </button>
        </div>
      </main>
    </div>
  )
}
