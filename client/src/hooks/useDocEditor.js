// hooks/useDocEditor.js
import { useState, useRef, useCallback, useEffect } from 'react'

// 150 KB üstü dosyalar için DataChannel mesajı ~200 KB'yi aşar
const MAX_EDIT_SIZE = 150 * 1024

const EDITABLE_EXTS = new Set([
  '.txt', '.md', '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css',
  '.py', '.java', '.c', '.cpp', '.go', '.rs', '.yaml', '.yml', '.toml',
  '.env', '.sh', '.xml', '.csv', '.sql', '.php', '.rb', '.swift', '.kt',
])

export function isEditable(name, size) {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
  return EDITABLE_EXTS.has(ext) && size <= MAX_EDIT_SIZE
}

export function useDocEditor({ dcReady, sendEncrypted, registerMessageHandler }) {
  const [editorOpen, setEditorOpen]   = useState(false)
  const [fileName, setFileName]       = useState('')
  const [content, setContent]         = useState('')
  const [peerTyping, setPeerTyping]   = useState(false)
  const [openedBy, setOpenedBy]       = useState(null) // 'self' | 'peer'

  const debounceRef      = useRef(null)
  const peerTypingTimer  = useRef(null)

  const handleMessage = useCallback((msg) => {
    if (msg.type === 'DOC_OPEN') {
      setFileName(msg.name)
      setContent(msg.content)
      setOpenedBy('peer')
      setEditorOpen(true)
    }
    if (msg.type === 'DOC_UPDATE') {
      setContent(msg.content)
      setPeerTyping(true)
      clearTimeout(peerTypingTimer.current)
      peerTypingTimer.current = setTimeout(() => setPeerTyping(false), 1500)
    }
    if (msg.type === 'DOC_CLOSE') {
      setEditorOpen(false)
    }
  }, [])

  useEffect(() => {
    registerMessageHandler('DOC_OPEN',   handleMessage)
    registerMessageHandler('DOC_UPDATE', handleMessage)
    registerMessageHandler('DOC_CLOSE',  handleMessage)
  }, []) // eslint-disable-line

  async function openFromUrl(name, url) {
    try {
      const text = await fetch(url).then(r => r.text())
      setFileName(name)
      setContent(text)
      setOpenedBy('self')
      setEditorOpen(true)
      await sendEncrypted({ type: 'DOC_OPEN', name, content: text })
    } catch {
      // Dosya okunamadıysa sessizce geç
    }
  }

  function handleContentChange(newContent) {
    setContent(newContent)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (dcReady) sendEncrypted({ type: 'DOC_UPDATE', content: newContent })
    }, 250)
  }

  function closeEditor() {
    setEditorOpen(false)
    if (dcReady) sendEncrypted({ type: 'DOC_CLOSE' })
  }

  function saveFile() {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    editorOpen, fileName, content, peerTyping, openedBy,
    openFromUrl, handleContentChange, closeEditor, saveFile,
  }
}
