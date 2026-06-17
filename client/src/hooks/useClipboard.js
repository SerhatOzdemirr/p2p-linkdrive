// hooks/useClipboard.js
import { useState, useEffect } from 'react'

export function useClipboard({ dcReady, sendEncrypted, registerMessageHandler }) {
  const [input, setInput]       = useState('')
  const [received, setReceived] = useState([])
  const [copiedIdx, setCopiedIdx] = useState(null)

  useEffect(() => {
    registerMessageHandler('TEXT_SHARE', (msg) => {
      setReceived(prev => [...prev, { text: msg.text, ts: Date.now() }])
    })
  }, []) // eslint-disable-line

  async function sendText() {
    const text = input.trim()
    if (!text || !dcReady) return
    await sendEncrypted({ type: 'TEXT_SHARE', text })
    setInput('')
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setInput(text)
    } catch {}
  }

  async function copyText(text, idx) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    } catch {}
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      sendText()
    }
  }

  return {
    input, setInput,
    received,
    copiedIdx,
    sendText,
    pasteFromClipboard,
    copyText,
    handleKeyDown,
  }
}
