import { useEffect, useState } from 'react'
import styles from './Toast.module.css'

export interface ToastProps {
  message: string
  onClose: () => void
  duration?: number
  icon?: string
}

export function Toast({ message, onClose, duration = 2000, icon = 'check_circle' }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Start exit animation slightly before the actual onClose call
    const exitTimer = setTimeout(() => {
      setIsExiting(true)
    }, duration - 250)

    const closeTimer = setTimeout(() => {
      onClose()
    }, duration)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(closeTimer)
    }
  }, [duration, onClose])

  return (
    <div className={`${styles.toastWrapper} ${isExiting ? styles.toastExit : ''}`}>
      <div className={styles.toast}>
        <div className={styles.toastIcon}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <span className={styles.toastMessage}>{message}</span>
      </div>
    </div>
  )
}
