import { useEffect, useState } from 'react'
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
  onClose: () => void
}

export default function ProfileThemeSheet({ open, initialTheme, onChange, onClose }: ProfileThemeSheetProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(() => normalizeProfileTheme(initialTheme))

  useEffect(() => {
    if (open) {
      const next = normalizeProfileTheme(initialTheme)
      setDraft(next)
      onChange(next)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- reset only when sheet opens

  if (!open) return null

  const apply = (next: ProfileThemeOut) => {
    setDraft(next)
    onChange(next)
  }

  const setCardTheme = (card_theme: ProfileCardThemeId) => {
    apply({ ...draft, card_theme })
  }

  const setStatusEmoji = (status_emoji: string | undefined) => {
    apply({
      ...draft,
      status_emoji: draft.status_emoji === status_emoji ? undefined : status_emoji,
    })
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <div className={styles.header}>
          <h3 className={styles.title}>{t('profile.customize')}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('common.close', { defaultValue: 'Закрыть' })}>
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
            onChange={(e) => apply({ ...draft, status_text: e.target.value || undefined })}
            placeholder={t('profile.statusPlaceholder')}
            maxLength={60}
          />
        </section>
      </div>
    </div>
  )
}
