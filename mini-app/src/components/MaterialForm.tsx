import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import type { MaterialCreate, MaterialOut } from '../shared/types'
import { uploadMaterialWithProgress, createMaterial, deleteMaterial, checkMaterialDuplicate } from '../api/client'
import styles from './MaterialForm.module.css'

interface MaterialFormProps {
  subjectId?: number
  lessonId?: number
  onClose: () => void
}

type UploadStatus = 'idle' | 'uploading' | 'complete' | 'error'
type UploadMaterialType = 'file' | 'image'

const MATERIAL_TYPES: { value: MaterialCreate['type']; labelKey: string; icon: string }[] = [
  { value: 'file', labelKey: 'materialForm.typeFile', icon: 'upload_file' },
  { value: 'image', labelKey: 'materialForm.typePhoto', icon: 'photo_camera' },
  { value: 'youtube', labelKey: 'materialForm.typeYoutube', icon: 'smart_display' },
  { value: 'video', labelKey: 'materialForm.typeVideo', icon: 'play_circle' },
  { value: 'link', labelKey: 'materialForm.typeLink', icon: 'link' },
  { value: 'text', labelKey: 'materialForm.typeText', icon: 'article' },
]

function fileNameToTitle(name: string): string {
  const base = name.replace(/\.[^/.]+$/, '')
  return base.replace(/[-_]/g, ' ').trim() || name
}

function isUploadType(type: MaterialCreate['type']): type is UploadMaterialType {
  return type === 'file' || type === 'image'
}

export default function MaterialForm({ subjectId, lessonId, onClose }: MaterialFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [type, setType] = useState<MaterialCreate['type']>('link')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [nonFileSaved, setNonFileSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [duplicateMaterial, setDuplicateMaterial] = useState<MaterialOut | null>(null)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadGeneration = useRef(0)
  const pendingMaterialIdRef = useRef<number | null>(null)
  const sessionOpenRef = useRef(true)

  const filePreviewUrl = useMemo(() => (file && type === 'image' ? URL.createObjectURL(file) : null), [file, type])

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    }
  }, [filePreviewUrl])

  const invalidateMaterials = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['materials'] })
    queryClient.invalidateQueries({ queryKey: ['lesson'] })
    queryClient.invalidateQueries({ queryKey: ['course'] })
  }, [queryClient])

  const discardPendingMaterial = useCallback(async () => {
    const id = pendingMaterialIdRef.current
    pendingMaterialIdRef.current = null
    if (id === null) return
    try {
      await deleteMaterial(id)
      invalidateMaterials()
    } catch {
      /* best effort */
    }
  }, [invalidateMaterials])

  const startFileUpload = useCallback(async (selectedFile: File, uploadTitle: string, uploadType: UploadMaterialType) => {
    const generation = ++uploadGeneration.current
    setUploadStatus('uploading')
    setUploadProgress(0)
    setUploadError(null)

    try {
      const result = await uploadMaterialWithProgress(
        selectedFile,
        uploadTitle,
        subjectId,
        lessonId,
        (percent) => {
          if (generation === uploadGeneration.current) setUploadProgress(percent)
        },
        uploadType,
      )

      if (generation !== uploadGeneration.current) {
        await deleteMaterial(result.id).catch(() => {})
        return
      }

      if (!sessionOpenRef.current) {
        await deleteMaterial(result.id).catch(() => {})
        return
      }

      pendingMaterialIdRef.current = result.id
      setUploadProgress(100)
      setUploadStatus('complete')
    } catch (e: unknown) {
      if (generation === uploadGeneration.current) {
        setUploadStatus('error')
        setUploadError(e instanceof Error ? e.message : t('materialForm.uploadError'))
      }
    }
  }, [subjectId, lessonId, t])

  const handleDismiss = useCallback(async (confirmed: boolean) => {
    sessionOpenRef.current = false
    uploadGeneration.current++

    if (confirmed) {
      pendingMaterialIdRef.current = null
      invalidateMaterials()
      onClose()
      return
    }

    await discardPendingMaterial()
    onClose()
  }, [discardPendingMaterial, invalidateMaterials, onClose])

  const handleFileSelect = async (selected: File | null) => {
    if (!selected || !isUploadType(type)) return

    if (pendingMaterialIdRef.current !== null) {
      await discardPendingMaterial()
    }

    setFile(selected)
    setNonFileSaved(false)
    setDuplicateMaterial(null)
    setUploadStatus('idle')
    setUploadProgress(0)
    setUploadError(null)
    uploadGeneration.current++

    const uploadTitle = title.trim() || fileNameToTitle(selected.name)
    if (!title.trim()) setTitle(uploadTitle)

    setIsCheckingDuplicate(true)
    try {
      const dup = await checkMaterialDuplicate({
        subjectId,
        lessonId,
        fileName: selected.name,
        fileSize: selected.size,
      })
      if (dup.duplicate && dup.material) {
        setDuplicateMaterial(dup.material)
        return
      }
    } catch {
      /* proceed with upload if check fails */
    } finally {
      setIsCheckingDuplicate(false)
    }

    startFileUpload(selected, uploadTitle, type)
  }

  const handleUploadAnyway = () => {
    if (!file || !isUploadType(type)) return
    setDuplicateMaterial(null)
    startFileUpload(file, title.trim() || fileNameToTitle(file.name), type)
  }

  const handleChooseAnotherFile = () => {
    setDuplicateMaterial(null)
    setFile(null)
    setUploadStatus('idle')
    setUploadProgress(0)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleTypeChange = async (newType: MaterialCreate['type']) => {
    if (newType !== type) {
      uploadGeneration.current++
      if (pendingMaterialIdRef.current !== null) {
        await discardPendingMaterial()
      }
    }
    if (!isUploadType(newType)) {
      setUploadStatus('idle')
      setUploadProgress(0)
      setUploadError(null)
      setFile(null)
    }
    setType(newType)
    setNonFileSaved(false)
    setDuplicateMaterial(null)
  }

  const handleNonFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || isSaving) return

    setDuplicateMaterial(null)
    if (type !== 'text' && url.trim()) {
      try {
        const dup = await checkMaterialDuplicate({
          subjectId,
          lessonId,
          url: url.trim(),
          type,
        })
        if (dup.duplicate && dup.material) {
          setDuplicateMaterial(dup.material)
          return
        }
      } catch {
        /* proceed */
      }
    }

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

    setIsSaving(true)
    try {
      const result = await createMaterial(data)
      pendingMaterialIdRef.current = result.id
      setNonFileSaved(true)
    } catch {
      /* ignore */
    } finally {
      setIsSaving(false)
    }
  }

  const isValid = () => {
    if (!title.trim()) return false
    if (isUploadType(type)) return !!file
    if (type === 'text') return !!content.trim()
    return !!url.trim()
  }

  const canContinue = isUploadType(type)
    ? uploadStatus === 'complete'
    : nonFileSaved

  const isFileUploading = isUploadType(type) && (uploadStatus === 'uploading' || isCheckingDuplicate)

  useEffect(() => {
    return () => {
      sessionOpenRef.current = false
      uploadGeneration.current++
      const id = pendingMaterialIdRef.current
      pendingMaterialIdRef.current = null
      if (id !== null) {
        deleteMaterial(id).then(() => invalidateMaterials()).catch(() => {})
      }
    }
  }, [invalidateMaterials])

  return (
    <div className={styles.overlay} onClick={() => { void handleDismiss(false) }}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <h3 className={styles.heading}>{t('materialForm.title')}</h3>

        <form className={styles.form} onSubmit={isUploadType(type) ? (e) => e.preventDefault() : handleNonFileSubmit}>
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

          {isUploadType(type) && (
            <div className={styles.fileArea}>
              <input
                ref={fileInputRef}
                type="file"
                className={styles.fileInput}
                accept={type === 'image' ? 'image/*' : undefined}
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                className={`${styles.fileButton} ${file ? styles.fileButtonSelected : ''}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={isFileUploading}
              >
                <span className="material-symbols-outlined">{type === 'image' ? 'photo_camera' : 'upload_file'}</span>
                {file ? file.name : (type === 'image' ? t('materialForm.selectPhoto') : t('materialForm.selectFile'))}
              </button>
              {file && (
                <span className={styles.fileSize}>
                  {(file.size / 1024).toFixed(1)} {t('materialForm.kb')}
                </span>
              )}
              {type === 'image' && filePreviewUrl && (
                <img src={filePreviewUrl} alt="" className={styles.imagePreview} />
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

          {duplicateMaterial && (
            <div className={styles.duplicatePanel}>
              <div className={styles.duplicateHeader}>
                <span className={`material-symbols-outlined ${styles.uploadErrorIcon}`}>info</span>
                <span>
                  {isUploadType(type)
                    ? t('materialForm.duplicateFile', {
                        name: file?.name || duplicateMaterial.file_name || '',
                        title: duplicateMaterial.title,
                      })
                    : t('materialForm.duplicateUrl', { title: duplicateMaterial.title })}
                </span>
              </div>
              <div className={styles.duplicateActions}>
                {isUploadType(type) ? (
                  <>
                    <button type="button" className={styles.duplicateSecondaryBtn} onClick={handleChooseAnotherFile}>
                      {t('materialForm.chooseAnotherFile')}
                    </button>
                    <button type="button" className={styles.duplicatePrimaryBtn} onClick={handleUploadAnyway}>
                      {t('materialForm.uploadAnyway')}
                    </button>
                  </>
                ) : (
                  <button type="button" className={styles.duplicateSecondaryBtn} onClick={() => setDuplicateMaterial(null)}>
                    {t('common.close')}
                  </button>
                )}
              </div>
            </div>
          )}

          {isUploadType(type) && isCheckingDuplicate && (
            <div className={styles.uploadPanel}>
              <div className={styles.uploadPanelHeader}>
                <span className={styles.uploadPanelLabel}>{t('materialForm.checkingDuplicate')}</span>
              </div>
            </div>
          )}

          {isUploadType(type) && uploadStatus !== 'idle' && !isCheckingDuplicate && (
            <div className={styles.uploadPanel}>
              <div className={styles.uploadPanelHeader}>
                <span className={styles.uploadPanelLabel}>
                  {uploadStatus === 'complete' ? (
                    <>
                      <span className={`material-symbols-outlined ${styles.uploadDoneIcon}`}>check_circle</span>
                      {type === 'image' ? t('materialForm.photoUploadComplete') : t('materialForm.uploadComplete')}
                    </>
                  ) : uploadStatus === 'error' ? (
                    <>
                      <span className={`material-symbols-outlined ${styles.uploadErrorIcon}`}>error</span>
                      {uploadError}
                    </>
                  ) : uploadProgress >= 92 ? (
                    t('materialForm.processing')
                  ) : (
                    type === 'image' ? t('materialForm.photoUploading') : t('materialForm.uploading')
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
              {uploadStatus === 'error' && file && isUploadType(type) && (
                <button
                  type="button"
                  className={styles.retryBtn}
                  onClick={() => startFileUpload(file, title.trim() || fileNameToTitle(file.name), type)}
                >
                  {t('materialForm.retry')}
                </button>
              )}
            </div>
          )}

          {!isUploadType(type) && nonFileSaved && (
            <div className={styles.savedBanner}>
              <span className={`material-symbols-outlined ${styles.uploadDoneIcon}`}>check_circle</span>
              {t('materialForm.added')}
            </div>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={() => { void handleDismiss(false) }}>
              {t('common.cancel')}
            </button>
            {isUploadType(type) ? (
              <button type="button" className={styles.submitBtn} disabled={!canContinue} onClick={() => { void handleDismiss(true) }}>
                {t('materialForm.continue')}
              </button>
            ) : canContinue ? (
              <button type="button" className={styles.submitBtn} onClick={() => { void handleDismiss(true) }}>
                {t('materialForm.continue')}
              </button>
            ) : (
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={!isValid() || isSaving}
              >
                {isSaving ? t('materialForm.saving') : t('materialForm.add')}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
