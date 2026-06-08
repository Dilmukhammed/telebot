import { useEffect } from 'react'
import WebApp from '@twa-dev/sdk'

interface MainButtonProps {
  visible: boolean
  text: string
  onClick: () => void
}

export function MainButton({ visible, text, onClick }: MainButtonProps) {
  useEffect(() => {
    if (visible) {
      WebApp.MainButton.setText(text)
      WebApp.MainButton.onClick(onClick)
      WebApp.MainButton.show()
    } else {
      WebApp.MainButton.hide()
    }

    return () => {
      WebApp.MainButton.hide()
      WebApp.MainButton.offClick(onClick)
    }
  }, [visible, text, onClick])

  return null
}

export default MainButton
