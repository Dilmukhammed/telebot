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
  theme: ProfileThemeOut
  saving?: boolean
  onClose: () => void
  onSave: (theme: ProfileThemeOut) => void
}

export default function ProfileThemeSheet({ open, theme, saving, onClose, onSave }: ProfileThemeSheetProps) {
  const { t } = useTranslation()
  const safeTheme = normalizeProfileTheme(theme)
  const [draft, setDraft] = useState(safeTheme)

  useEffect(() => {
    if (open) setDraft(normalizeProfileTheme(theme))
  }, [open, theme?.card_theme, theme?.status_emoji, theme?.status_text])

  if (!open) return null

  const setCardTheme = (card_theme: ProfileCardThemeId) => {
    const next = { ...draft, card_theme }
    setDraft(next)
    onSave(next)
  }

  const setStatusEmoji = (status_emoji: string | undefined) => {
    const next = {
      ...draft,
      status_emoji: draft.status_emoji === status_emoji ? undefined : status_emoji,
    }
    setDraft(next)
    onSave(next)
  }

  const handleStatusText = (status_text: string) => {
    setDraft((prev) => ({ ...prev, status_text: status_text || undefined }))
  }

  const commitStatusText = () => {
    onSave(draft)
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
                disabled={saving}
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
              disabled={saving}
            >
              —
            </button>
            {PROFILE_STATUS_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`${styles.emojiBtn} ${draft.status_emoji === emoji ? styles.emojiBtnActive : ''}`}
                onClick={() => setStatusEmoji(emoji)}
                disabled={saving}
              >
                {emoji}
              </button>
            ))}
          </div>
          <input
            type="text"
            className={styles.statusInput}
            value={draft.status_text || ''}
            onChange={(e) => handleStatusText(e.target.value)}
            onBlur={commitStatusText}
            onKeyDown={(e) => e.key === 'Enter' && commitStatusText()}
            placeholder={t('profile.statusPlaceholder')}
            maxLength={60}
            disabled={saving}
          />
        </section>

        {saving && <p className={styles.saving}>{t('common.loading')}</p>}
      </div>
    </div>
  )
}
