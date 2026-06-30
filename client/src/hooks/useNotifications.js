// hooks/useNotifications.js — OS bildirimi + ses + başlık yanıp sönme
import { useEffect, useRef, useCallback } from 'react'

export function useNotifications() {
  const originalTitle = useRef(typeof document !== 'undefined' ? document.title : '')
  const flashTimer    = useRef(null)
  const audioCtxRef   = useRef(null)

  const stopFlash = useCallback(() => {
    clearInterval(flashTimer.current)
    flashTimer.current = null
    document.title = originalTitle.current
  }, [])

  useEffect(() => {
    // İzin iste (kullanıcı odaya girdiyse zaten etkileşim olmuş sayılır)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    const onVisible = () => { if (!document.hidden) stopFlash() }
    window.addEventListener('focus', stopFlash)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', stopFlash)
      document.removeEventListener('visibilitychange', onVisible)
      stopFlash()
    }
  }, [stopFlash])

  // Kısa "ding" — Web Audio ile üretilir, ses dosyası gerekmez
  const beep = useCallback((freq = 660) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      const ctx = audioCtxRef.current ||= new Ctx()
      if (ctx.state === 'suspended') ctx.resume()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch {}
  }, [])

  const flashTitle = useCallback((text) => {
    if (!document.hidden || flashTimer.current) return
    let on = false
    flashTimer.current = setInterval(() => {
      document.title = on ? originalTitle.current : text
      on = !on
    }, 1000)
  }, [])

  // title + body: OS bildirimi; sound: ding; flash: sekme başlığı
  const notify = useCallback(({ title, body, sound = true }) => {
    if (sound) beep()
    if (document.hidden) {
      flashTitle(`🔔 ${title}`)
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(title, { body, tag: 'linkdrive', renotify: true }) } catch {}
      }
    }
  }, [beep, flashTitle])

  return { notify, beep }
}
