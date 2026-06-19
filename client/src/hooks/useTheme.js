// hooks/useTheme.js
import { useState, useEffect } from 'react'

export function useTheme() {
  const [dark, setDark] = useState(
    () => localStorage.getItem('theme') !== 'light'
  )

  useEffect(() => {
    const root = document.documentElement
    dark ? root.classList.add('dark') : root.classList.remove('dark')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return { dark, toggle: () => setDark(d => !d) }
}
