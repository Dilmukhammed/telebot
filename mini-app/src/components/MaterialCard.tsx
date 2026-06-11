import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MaterialOut } from '../shared/types'
import styles from './MaterialCard.module.css'

interface MaterialCardProps {
  material: MaterialOut
  canDelete?: boolean
  onDelete?: (id: number) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function getYoutubeId(url?: string): string | null {
  if (!url) return null
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}

function getDomainName(urlStr?: string): string {
  if (!urlStr) return ''
  try {
    const url = new URL(urlStr)
    return url.hostname.replace('www.', '')
  } catch {
    return 'link'
  }
}

function getFileStyleAndIcon(fileName?: string): { icon: string; styleClass: string } {
  if (!fileName) return { icon: 'description', styleClass: styles.iconGeneric }
  const ext = fileName.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return { icon: 'picture_as_pdf', styleClass: styles.iconPdf }
    case 'doc':
    case 'docx':
    case 'txt':
    case 'rtf':
      return { icon: 'description', styleClass: styles.iconWord }
    case 'xls':
    case 'xlsx':
    case 'csv':
      return { icon: 'table_view', styleClass: styles.iconExcel }
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
      return { icon: 'image', styleClass: styles.iconImage }
    default:
      return { icon: 'draft', styleClass: styles.iconGeneric }
  }
}

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const boldLinkRegex = /(\*\*.*?\*\*|\[.*?\]\(.*?\))/g
  const matches = [...text.matchAll(boldLinkRegex)]
  
  let lastIndex = 0
  matches.forEach((match, matchIdx) => {
    const start = match.index!
    if (start > lastIndex) {
      parts.push(text.substring(lastIndex, start))
    }
    
    const token = match[0]
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={`b-${matchIdx}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('[') && token.includes('](')) {
      const closingBracket = token.indexOf(']')
      const label = token.substring(1, closingBracket)
      const url = token.substring(closingBracket + 2, token.length - 1)
      parts.push(
        <a key={`l-${matchIdx}`} href={url} target="_blank" rel="noopener noreferrer" className={styles.mdLink}>
          {label}
        </a>
      )
    }
    lastIndex = start + token.length
  })
  
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }
  
  return parts.length > 0 ? parts : [text]
}

function renderMarkdown(content?: string) {
  if (!content) return null
  const lines = content.split('\n')
  return lines.map((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('# ')) {
      return <h1 key={i} className={styles.mdH1}>{trimmed.replace('# ', '')}</h1>
    }
    if (trimmed.startsWith('## ')) {
      return <h2 key={i} className={styles.mdH2}>{trimmed.replace('## ', '')}</h2>
    }
    if (trimmed.startsWith('### ')) {
      return <h3 key={i} className={styles.mdH3}>{trimmed.replace('### ', '')}</h3>
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return <li key={i} className={styles.mdLi}>{parseInlineMarkdown(trimmed.substring(2))}</li>
    }
    return <p key={i} className={styles.mdPara}>{parseInlineMarkdown(line)}</p>
  })
}

export default function MaterialCard({ material, canDelete, onDelete }: MaterialCardProps) {
  const { t } = useTranslation()
  const [isPlayerOpen, setIsPlayerOpen] = useState(false)
  const [isTextCollapsed, setIsTextCollapsed] = useState(true)

  const youtubeId = material.type === 'youtube' ? getYoutubeId(material.url) : null
  const isVideo = material.type === 'video' || (material.type === 'youtube' && youtubeId)

  // Google Drive webContentLink uses export=download which forces download instead of inline display.
  // Convert to direct URL for <img src> compatibility.
  const imageUrl = material.url?.includes('drive.google.com')
    ? material.url.replace('&export=download', '').replace('?export=download', '')
    : material.url

  const handleCardClick = () => {
    if (material.type === 'image' && imageUrl) {
      setIsPlayerOpen(true)
    } else if (isVideo) {
      setIsPlayerOpen(true)
    } else if (material.type === 'text') {
      setIsTextCollapsed(!isTextCollapsed)
    } else if (material.url) {
      window.open(material.url, '_blank')
    }
  }

  if (material.type === 'image' && material.url) {
    return (
      <>
        <div className={`${styles.card} ${styles.imageCard}`} onClick={handleCardClick}>
          <div className={styles.imageThumbnailWrap}>
            <img src={imageUrl} alt={material.title} className={styles.imageThumbnail} loading="lazy" />
            <div className={styles.imageBadge}>
              <span className="material-symbols-outlined">photo_camera</span>
              {t('materialCard.photo', { defaultValue: 'Фото' })}
            </div>
          </div>
          <div className={styles.imageInfo}>
            <h3 className={styles.imageTitle}>{material.title}</h3>
            {canDelete && onDelete && (
              <button
                className={styles.cardDeleteBtn}
                onClick={(e) => { e.stopPropagation(); onDelete(material.id) }}
                title="Удалить"
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            )}
          </div>
        </div>

        {isPlayerOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsPlayerOpen(false)}>
            <div className={styles.imageModalContent} onClick={(e) => e.stopPropagation()}>
              <button className={styles.modalClose} onClick={() => setIsPlayerOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
              <img src={imageUrl} alt={material.title} className={styles.imageModalImg} />
              <p className={styles.imageModalCaption}>{material.title}</p>
            </div>
          </div>
        )}
      </>
    )
  }

  // Render YouTube or Direct Video Card
  if (isVideo) {
    const thumbUrl = youtubeId 
      ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
      : 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=640&auto=format&fit=crop&q=60' // Fallback preview gradient

    return (
      <>
        <div className={`${styles.card} ${styles.videoCard}`} onClick={handleCardClick}>
          <div className={styles.videoThumbnailWrap}>
            <img src={thumbUrl} alt={material.title} className={styles.thumbnailImage} />
            <div className={styles.playOverlay}>
              <span className="material-symbols-outlined">play_arrow</span>
            </div>
            <div className={styles.videoBadge}>
              <span className="material-symbols-outlined">
                {material.type === 'youtube' ? 'smart_display' : 'play_circle'}
              </span>
              {material.type === 'youtube' ? 'YouTube' : 'Видео'}
            </div>
          </div>
          <div className={styles.videoInfo}>
            <h3 className={styles.videoTitle}>{material.title}</h3>
            <div className={styles.videoMeta}>
              <span>Смотреть в приложении</span>
              {canDelete && onDelete && (
                <div style={{ position: 'absolute', right: '12px', bottom: '12px' }}>
                  <button
                    className={styles.cardDeleteBtn}
                    onClick={(e) => { e.stopPropagation(); onDelete(material.id) }}
                    title="Удалить"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Video Player Modal */}
        {isPlayerOpen && (
          <div className={styles.modalOverlay} onClick={() => setIsPlayerOpen(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <button className={styles.modalClose} onClick={() => setIsPlayerOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
              {youtubeId ? (
                <div className={styles.iframeWrapper}>
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                    title={material.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className={styles.videoPlayerWrapper}>
                  <video
                    src={material.url}
                    controls
                    autoPlay
                    className={styles.videoPlayer}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </>
    )
  }

  // Render Inline Text (Markdown) Note Card
  if (material.type === 'text') {
    const isLong = material.content && material.content.length > 180

    return (
      <div className={`${styles.card} ${styles.textCard}`} onClick={handleCardClick}>
        <div className={styles.textHeader}>
          <div className={styles.textTitleArea}>
            <span className={`material-symbols-outlined ${styles.textIcon}`}>article</span>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span className={styles.textTitle}>{material.title}</span>
              <span className={styles.textMeta}>Текстовый материал</span>
            </div>
          </div>
          {canDelete && onDelete && (
            <button
              className={styles.cardDeleteBtn}
              onClick={(e) => { e.stopPropagation(); onDelete(material.id) }}
              title="Удалить"
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
          )}
        </div>
        {material.content && (
          <div className={`${styles.textContent} ${isLong && isTextCollapsed ? styles.textContentCollapsed : ''}`}>
            {renderMarkdown(material.content)}
            {isLong && isTextCollapsed && <div className={styles.textFadeOverlay} />}
          </div>
        )}
        {isLong && (
          <button 
            className={styles.toggleTextBtn}
            onClick={(e) => { e.stopPropagation(); setIsTextCollapsed(!isTextCollapsed) }}
          >
            <span className="material-symbols-outlined">
              {isTextCollapsed ? 'keyboard_arrow_down' : 'keyboard_arrow_up'}
            </span>
            {isTextCollapsed ? 'Развернуть' : 'Свернуть'}
          </button>
        )}
      </div>
    )
  }

  // Render File or Link Card (Row format)
  const isFile = material.type === 'file'
  const fileDetails = isFile ? getFileStyleAndIcon(material.file_name) : null
  const domain = !isFile ? getDomainName(material.url) : null

  return (
    <div className={`${styles.card} ${styles.rowCard}`} onClick={handleCardClick}>
      {isFile ? (
        <div className={`${styles.fileIconWrap} ${fileDetails?.styleClass}`}>
          <span className="material-symbols-outlined">{fileDetails?.icon}</span>
        </div>
      ) : (
        <div className={`${styles.fileIconWrap} ${styles.iconLink}`}>
          <span className="material-symbols-outlined">link</span>
        </div>
      )}

      <div className={styles.rowContent}>
        <span className={styles.rowTitle}>{material.title}</span>
        <div className={styles.rowMeta}>
          {isFile ? (
            <>
              <span>Файл</span>
              {material.file_size && <span>· {formatFileSize(material.file_size)}</span>}
              {material.file_name && <span style={{ opacity: 0.7 }}>· {material.file_name}</span>}
            </>
          ) : (
            <>
              <span>Ссылка</span>
              {domain && <span className={styles.domainBadge}>{domain}</span>}
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button className={styles.actionBtn}>
          <span className="material-symbols-outlined">
            {isFile ? 'download' : 'open_in_new'}
          </span>
          {isFile ? 'Скачать' : 'Открыть'}
        </button>

        {canDelete && onDelete && (
          <button
            className={styles.cardDeleteBtn}
            onClick={(e) => { e.stopPropagation(); onDelete(material.id) }}
            title="Удалить"
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
        )}
      </div>
    </div>
  )
}

