import { useState, useRef } from 'react'
import type { MaterialCreate } from '../shared/types'
import styles from './MaterialForm.module.css'

interface MaterialFormProps {
  onSubmit: (data: MaterialCreate & { file?: File }) => void
  onClose: () => void
  isPending?: boolean
  isSuccess?: boolean
}

const MATERIAL_TYPES: { value: MaterialCreate['type']; label: string; icon: string }[] = [
  { value: 'file', label: 'Файл', icon: 'upload_file' },
  { value: 'youtube', label: 'YouTube', icon: 'smart_display' },
  { value: 'video', label: 'Видео', icon: 'play_circle' },
  { value: 'link', label: 'Ссылка', icon: 'link' },
  { value: 'text', label: 'Текст', icon: 'article' },
]

export default function MaterialForm({ onSubmit, onClose, isPending, isSuccess }: MaterialFormProps) {
  const [type, setType] = useState<MaterialCreate['type']>('link')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || isPending) return

    const data: MaterialCreate & { file?: File } = {
      title: title.trim(),
      type,
    }

    if (type === 'file') {
      if (!file) return
      data.file = file
    } else if (type === 'text') {
      if (!content.trim()) return
      data.content = content.trim()
    } else {
      if (!url.trim()) return
      data.url = url.trim()
    }

    onSubmit(data)
  }

  const isValid = () => {
    if (!title.trim()) return false
    if (type === 'file') return !!file
    if (type === 'text') return !!content.trim()
    return !!url.trim()
  }

  // Loading overlay
  if (isPending) {
    return (
      <div className={styles.overlay}>
        <div className={styles.loadingBox}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>
            {type === 'file' ? 'Загрузка файла...' : 'Сохранение...'}
          </p>
        </div>
      </div>
    )
  }

  // Success state
  if (isSuccess) {
    return (
      <div className={styles.overlay}>
        <div className={styles.successBox}>
          <span className={`material-symbols-outlined ${styles.successIcon}`}>check_circle</span>
          <p className={styles.successText}>Материал добавлен!</p>
          <button className={styles.doneBtn} onClick={onClose}>
            Продолжить
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <h3 className={styles.heading}>Добавить материал</h3>

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Type selector */}
          <div className={styles.typeRow}>
            {MATERIAL_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`${styles.typeChip} ${type === t.value ? styles.typeChipActive : ''}`}
                onClick={() => setType(t.value)}
              >
                <span className="material-symbols-outlined">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Title */}
          <input
            className={styles.input}
            type="text"
            placeholder="Название"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />

          {/* Conditional fields */}
          {type === 'file' && (
            <div className={styles.fileArea}>
              <input
                ref={fileInputRef}
                type="file"
                className={styles.fileInput}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                className={styles.fileButton}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="material-symbols-outlined">upload_file</span>
                {file ? file.name : 'Выбрать файл'}
              </button>
              {file && <span className={styles.fileSize}>{(file.size / 1024).toFixed(1)} КБ</span>}
            </div>
          )}

          {(type === 'link' || type === 'youtube' || type === 'video') && (
            <input
              className={styles.input}
              type="url"
              placeholder={type === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...'}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}

          {type === 'text' && (
            <textarea
              className={styles.textarea}
              placeholder="Содержимое (markdown)..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
            />
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Отмена
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={!isValid()}
            >
              Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
