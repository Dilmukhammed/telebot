import { useEffect } from 'react'
import WebApp from '@twa-dev/sdk'

interface BackButtonProps {
  visible: boolean
  onClick: () => void
}

export function BackButton({ visible, onClick }: BackButtonProps) {
  useEffect(() => {
    if (visible) {
      WebApp.BackButton.onClick(onClick)
      WebApp.BackButton.show()
    } else {
      WebApp.BackButton.hide()
    }

    return () => {
      WebApp.BackButton.hide()
      WebApp.BackButton.offClick(onClick)
    }
  }, [visible, onClick])

  return null
}

export default BackButton
