import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import type { MaterialCreate } from '../shared/types'
import { uploadMaterialWithProgress } from '../api/client'
import { useCreateMaterial } from '../api/hooks/useMaterials'
import styles from './MaterialForm.module.css'

interface MaterialFormProps {
  subjectId?: number
  lessonId?: number
  onClose: () => void
}

type UploadStatus = 'idle' | 'uploading' | 'complete' | 'error'

const MATERIAL_TYPES: { value: MaterialCreate['type']; labelKey: string; icon: string }[] = [
  { value: 'file', labelKey: 'materialForm.typeFile', icon: 'upload_file' },
  { value: 'youtube', labelKey: 'materialForm.typeYoutube', icon: 'smart_display' },
  { value: 'video', labelKey: 'materialForm.typeVideo', icon: 'play_circle' },
  { value: 'link', labelKey: 'materialForm.typeLink', icon: 'link' },
  { value: 'text', labelKey: 'materialForm.typeText', icon: 'article' },
]

function fileNameToTitle(name: string): string {
  const base = name.replace(/\.[^/.]+$/, '')
  return base.replace(/[-_]/g, ' ').trim() || name
}

export default function MaterialForm({ subjectId, lessonId, onClose }: MaterialFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const createMaterial = useCreateMaterial()

  const [type, setType] = useState<MaterialCreate['type']>('link')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [nonFileSaved, setNonFileSaved] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadGeneration = useRef(0)

  const invalidateMaterials = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['materials'] })
    queryClient.invalidateQueries({ queryKey: ['lesson'] })
    queryClient.invalidateQueries({ queryKey: ['course'] })
  }, [queryClient])

  const startFileUpload = useCallback(async (selectedFile: File, uploadTitle: string) => {
    const generation = ++uploadGeneration.current
    setUploadStatus('uploading')
    setUploadProgress(0)
    setUploadError(null)

    try {
      await uploadMaterialWithProgress(
        selectedFile,
        uploadTitle,
        subjectId,
        lessonId,
        (percent) => {
          if (generation === uploadGeneration.current) setUploadProgress(percent)
        },
      )
      if (generation === uploadGeneration.current) {
        setUploadProgress(100)
        setUploadStatus('complete')
        invalidateMaterials()
      }
    } catch (e: unknown) {
      if (generation === uploadGeneration.current) {
        setUploadStatus('error')
        setUploadError(e instanceof Error ? e.message : t('materialForm.uploadError'))
      }
    }
  }, [subjectId, lessonId, invalidateMaterials, t])

  const handleFileSelect = (selected: File | null) => {
    if (!selected) return
    setFile(selected)
    setNonFileSaved(false)

    const uploadTitle = title.trim() || fileNameToTitle(selected.name)
    if (!title.trim()) setTitle(uploadTitle)

    startFileUpload(selected, uploadTitle)
  }

  const handleTypeChange = (newType: MaterialCreate['type']) => {
    if (newType !== 'file') {
      uploadGeneration.current++
      setUploadStatus('idle')
      setUploadProgress(0)
      setUploadError(null)
      setFile(null)
    }
    setType(newType)
    setNonFileSaved(false)
  }

  const handleNonFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || createMaterial.isPending) return

    const data: MaterialCreate = { title: title.trim(), type }
    if (type === 'text') {
      if (!content.trim()) return
      data.content = content.trim()
    } else {
      if (!url.trim()) return
      data.url = url.trim()
    }
    if (subjectId !== undefined) data.subject_id = subjectId
    if (lessonId !== undefined) data.lesson_id = lessonId

    try {
      await createMaterial.mutateAsync(data)
      setNonFileSaved(true)
      invalidateMaterials()
    } catch {
      /* createMaterial surfaces via isError if needed */
    }
  }

  const isValid = () => {
    if (!title.trim()) return false
    if (type === 'file') return !!file
    if (type === 'text') return !!content.trim()
    return !!url.trim()
  }

  const canContinue = type === 'file'
    ? uploadStatus === 'complete'
    : nonFileSaved

  const isFileUploading = type === 'file' && uploadStatus === 'uploading'

  useEffect(() => {
    return () => { uploadGeneration.current++ }
  }, [])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <h3 className={styles.heading}>{t('materialForm.title')}</h3>

        <form className={styles.form} onSubmit={type === 'file' ? (e) => e.preventDefault() : handleNonFileSubmit}>
          <div className={styles.typeRow}>
            {MATERIAL_TYPES.map((mt) => (
              <button
                key={mt.value}
                type="button"
                className={`${styles.typeChip} ${type === mt.value ? styles.typeChipActive : ''}`}
                onClick={() => handleTypeChange(mt.value)}
                disabled={isFileUploading}
              >
                <span className="material-symbols-outlined">{mt.icon}</span>
                <span>{t(mt.labelKey)}</span>
              </button>
            ))}
          </div>

          <input
            className={styles.input}
            type="text"
            placeholder={t('materialForm.namePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isFileUploading}
            autoFocus
          />

          {type === 'file' && (
            <div className={styles.fileArea}>
              <input
                ref={fileInputRef}
                type="file"
                className={styles.fileInput}
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                className={`${styles.fileButton} ${file ? styles.fileButtonSelected : ''}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={isFileUploading}
              >
                <span className="material-symbols-outlined">upload_file</span>
                {file ? file.name : t('materialForm.selectFile')}
              </button>
              {file && (
                <span className={styles.fileSize}>
                  {(file.size / 1024).toFixed(1)} {t('materialForm.kb')}
                </span>
              )}
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
              placeholder={t('materialForm.textPlaceholder')}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
            />
          )}

          {type === 'file' && uploadStatus !== 'idle' && (
            <div className={styles.uploadPanel}>
              <div className={styles.uploadPanelHeader}>
                <span className={styles.uploadPanelLabel}>
                  {uploadStatus === 'complete' ? (
                    <>
                      <span className={`material-symbols-outlined ${styles.uploadDoneIcon}`}>check_circle</span>
                      {t('materialForm.uploadComplete')}
                    </>
                  ) : uploadStatus === 'error' ? (
                    <>
                      <span className={`material-symbols-outlined ${styles.uploadErrorIcon}`}>error</span>
                      {uploadError}
                    </>
                  ) : (
                    t('materialForm.uploading')
                  )}
                </span>
                {uploadStatus === 'uploading' && (
                  <span className={styles.uploadPercent}>{uploadProgress}%</span>
                )}
              </div>
              <div className={styles.progressTrack}>
                <div
                  className={`${styles.progressFill} ${uploadStatus === 'complete' ? styles.progressFillDone : ''} ${uploadStatus === 'error' ? styles.progressFillError : ''}`}
                  style={{ width: `${uploadStatus === 'complete' ? 100 : uploadProgress}%` }}
                />
              </div>
              {uploadStatus === 'error' && file && (
                <button
                  type="button"
                  className={styles.retryBtn}
                  onClick={() => startFileUpload(file, title.trim() || fileNameToTitle(file.name))}
                >
                  {t('materialForm.retry')}
                </button>
              )}
            </div>
          )}

          {type !== 'file' && nonFileSaved && (
            <div className={styles.savedBanner}>
              <span className={`material-symbols-outlined ${styles.uploadDoneIcon}`}>check_circle</span>
              {t('materialForm.added')}
            </div>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              {t('common.cancel')}
            </button>
            {type === 'file' ? (
              <button type="button" className={styles.submitBtn} disabled={!canContinue} onClick={onClose}>
                {t('materialForm.continue')}
              </button>
            ) : canContinue ? (
              <button type="button" className={styles.submitBtn} onClick={onClose}>
                {t('materialForm.continue')}
              </button>
            ) : (
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={!isValid() || createMaterial.isPending}
              >
                {createMaterial.isPending ? t('materialForm.saving') : t('materialForm.add')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
