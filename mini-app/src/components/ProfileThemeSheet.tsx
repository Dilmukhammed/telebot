import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileThemeOut } from '../shared/types'
import {
  PROFILE_CARD_PRESETS,
  PROFILE_CARD_THEME_IDS,
  PROFILE_STATUS_EMOJIS,
  normalizeProfileTheme,
  type ProfileCardThemeId,
} from '../shared/profileTheme'
import styles from './ProfileThemeSheet.module.css'

interface ProfileThemeSheetProps {
  open: boolean
  initialTheme: ProfileThemeOut
  onChange: (theme: ProfileThemeOut) => void
  onClose: (theme: ProfileThemeOut) => void
}

export default function ProfileThemeSheet({ open, initialTheme, onChange, onClose }: ProfileThemeSheetProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(() => normalizeProfileTheme(initialTheme))
  const draftRef = useRef(draft)

  const apply = (next: ProfileThemeOut) => {
    draftRef.current = next
    setDraft(next)
    onChange(next)
  }

  useEffect(() => {
    if (open) {
      const next = normalizeProfileTheme(initialTheme)
      apply(next)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- reset only when sheet opens

  const requestClose = () => onClose(draftRef.current)

  if (!open) return null

  const setCardTheme = (card_theme: ProfileCardThemeId) => {
    apply({ ...draftRef.current, card_theme })
  }

  const setStatusEmoji = (status_emoji: string | undefined) => {
    const current = draftRef.current
    apply({
      ...current,
      status_emoji: current.status_emoji === status_emoji ? undefined : status_emoji,
    })
  }

  const setStatusText = (status_text: string) => {
    apply({ ...draftRef.current, status_text: status_text || undefined })
  }

  return (
    <div className={styles.overlay} onClick={requestClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.header}>
          <h3 className={styles.title}>{t('profile.customize')}</h3>
          <button type="button" className={styles.closeBtn} onClick={requestClose} aria-label={t('common.close', { defaultValue: 'Закрыть' })}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <section className={styles.section}>
          <p className={styles.sectionLabel}>{t('profile.themeColor')}</p>
          <div className={styles.themeGrid}>
            {PROFILE_CARD_THEME_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={`${styles.themeSwatch} ${draft.card_theme === id ? styles.themeSwatchActive : ''}`}
                style={{ background: PROFILE_CARD_PRESETS[id].swatch }}
                onClick={() => setCardTheme(id)}
                aria-label={t(`profile.themes.${id}`)}
              >
                {draft.card_theme === id && (
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>check</span>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <p className={styles.sectionLabel}>{t('profile.statusEmoji')}</p>
          <div className={styles.emojiRow}>
            <button
              type="button"
              className={`${styles.emojiBtn} ${!draft.status_emoji ? styles.emojiBtnActive : ''}`}
              onClick={() => setStatusEmoji(undefined)}
            >
              —
            </button>
            {PROFILE_STATUS_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`${styles.emojiBtn} ${draft.status_emoji === emoji ? styles.emojiBtnActive : ''}`}
                onClick={() => setStatusEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <input
            type="text"
            className={styles.statusInput}
            value={draft.status_text || ''}
            onChange={(e) => setStatusText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            placeholder={t('profile.statusPlaceholder')}
            maxLength={60}
            enterKeyHint="done"
          />
        </section>
      </div>
    </div>
  )
}
