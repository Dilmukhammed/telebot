import type { MaterialOut } from '../shared/types'
import styles from './MaterialCard.module.css'

interface MaterialCardProps {
  material: MaterialOut
  canDelete?: boolean
  onDelete?: (id: number) => void
}

const ICON_MAP: Record<string, string> = {
  file: 'description',
  video: 'play_circle',
  youtube: 'smart_display',
  link: 'link',
  text: 'article',
}

const TYPE_LABELS: Record<string, string> = {
  file: 'Файл',
  video: 'Видео',
  youtube: 'YouTube',
  link: 'Ссылка',
  text: 'Текст',
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export default function MaterialCard({ material, canDelete, onDelete }: MaterialCardProps) {
  const icon = ICON_MAP[material.type] || 'description'
  const typeLabel = TYPE_LABELS[material.type] || material.type

  const handleClick = () => {
    if (material.type === 'text') return // Text is shown inline
    if (material.url) {
      window.open(material.url, '_blank')
    }
  }

  return (
    <div className={styles.card} onClick={handleClick} role={material.url ? 'button' : undefined}>
      <div className={styles.iconWrap}>
        <span className={`material-symbols-outlined ${styles.icon}`}>{icon}</span>
      </div>
      <div className={styles.info}>
        <span className={styles.title}>{material.title}</span>
        <span className={styles.meta}>
          {typeLabel}
          {material.file_size && ` · ${formatFileSize(material.file_size)}`}
          {material.file_name && material.type === 'file' && ` · ${material.file_name}`}
        </span>
      </div>
      {canDelete && onDelete && (
        <button
          className={styles.deleteBtn}
          onClick={(e) => { e.stopPropagation(); onDelete(material.id) }}
          title="Удалить"
        >
          <span className="material-symbols-outlined">delete</span>
        </button>
      )}
      {material.type !== 'text' && material.url && (
        <span className={`material-symbols-outlined ${styles.chevron}`}>open_in_new</span>
      )}
    </div>
  )
}
