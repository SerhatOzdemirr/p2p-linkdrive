// hooks/useInstallPrompt.js — "Uygulamayı Yükle" butonu için
import { useState, useEffect } from 'react'

export function useInstallPrompt() {
  const [deferred, setDeferred]   = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Zaten kurulu (standalone) mu?
    if (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true)
    }
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e) }
    const onInstalled = () => { setInstalled(true); setDeferred(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream

  return {
    canInstall: !!deferred, // Chrome/Android: kurulabilir olunca true
    install,
    installed,
    isIOS,                  // iOS'ta beforeinstallprompt yok → elle yönerge göster
  }
}
