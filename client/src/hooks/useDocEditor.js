// hooks/useDocEditor.js — ortak metin/kod editörü (içerik chunk'lanarak gönderilir)
import { useState, useRef, useCallback, useEffect } from 'react'

const MAX_EDIT_SIZE  = 5 * 1024 * 1024   // 5 MB — chunk'lı gönderim sayesinde büyük dosyalar
const DOC_CHUNK      = 32 * 1024         // karakter/parça (şifreli mesaj DataChannel limitinin altında)

const EDITABLE_EXTS = new Set([
  '.txt', '.md', '.markdown', '.log', '.csv', '.tsv', '.json', '.json5',
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.html', '.htm', '.css', '.scss', '.less',
  '.py', '.java', '.c', '.h', '.cpp', '.hpp', '.cs', '.go', '.rs', '.rb', '.php', '.swift',
  '.kt', '.kts', '.lua', '.pl', '.r', '.dart', '.vue', '.svelte',
  '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env', '.properties',
  '.xml', '.svg', '.sql', '.sh', '.bash', '.zsh', '.bat', '.ps1',
  '.gitignore', '.dockerfile', '.makefile', '.diff', '.patch', '.srt', '.vtt', '.tex',
])

export function isEditable(name, size) {
  const lower = name.toLowerCase()
  const dot   = lower.lastIndexOf('.')
  const ext   = dot > 0 ? lower.slice(dot) : lower // uzantısız: tam ad (dockerfile, makefile)
  const ok    = EDITABLE_EXTS.has(ext) || ['dockerfile', 'makefile', '.gitignore'].includes(lower)
  return ok && size <= MAX_EDIT_SIZE
}

export function useDocEditor({ dcReady, sendEncrypted, registerMessageHandler }) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [fileName, setFileName]     = useState('')
  const [content, setContent]       = useState('')
  const [peerTyping, setPeerTyping] = useState(false)
  const [openedBy, setOpenedBy]     = useState(null) // 'self' | 'peer'
  const [loadingPct, setLoadingPct] = useState(0)    // alıcı: büyük dosya alınırken

  const debounceRef     = useRef(null)
  const peerTypingTimer = useRef(null)
  const seqRef          = useRef(0)     // giden doküman id (eski güncellemeleri ele)
  const recvRef         = useRef(null)  // { id, parts[], total, name, update }

  // ── Gelen mesajlar (chunk'lı) ────────────────────────────────────────────
  const handleMessage = useCallback((msg) => {
    if (msg.type === 'DOC_BEGIN') {
      recvRef.current = { id: msg.id, parts: new Array(msg.total), got: 0, total: msg.total, name: msg.name, update: msg.update }
      if (!msg.update && msg.total > 1) setLoadingPct(1)
    }
    else if (msg.type === 'DOC_PART') {
      const r = recvRef.current
      if (!r || r.id !== msg.id) return
      r.parts[msg.index] = msg.data
      r.got++
      if (!r.update && r.total > 1) setLoadingPct((r.got / r.total) * 100)
      if (r.got === r.total) {
        const text = r.parts.join('')
        recvRef.current = null
        setLoadingPct(0)
        setContent(text)
        if (r.update) {
          setPeerTyping(true)
          clearTimeout(peerTypingTimer.current)
          peerTypingTimer.current = setTimeout(() => setPeerTyping(false), 1500)
        } else {
          setFileName(r.name || 'belge.txt')
          setOpenedBy('peer')
          setEditorOpen(true)
        }
      }
    }
    else if (msg.type === 'DOC_CLOSE') {
      setEditorOpen(false)
    }
  }, [])

  useEffect(() => {
    registerMessageHandler('DOC_BEGIN', handleMessage)
    registerMessageHandler('DOC_PART',  handleMessage)
    registerMessageHandler('DOC_CLOSE', handleMessage)
  }, []) // eslint-disable-line

  // İçeriği parçalara böl gönder
  async function sendDoc(text, { name = null, update = false } = {}) {
    if (!dcReady) return
    const id    = ++seqRef.current
    const total = Math.max(Math.ceil(text.length / DOC_CHUNK), 1)
    await sendEncrypted({ type: 'DOC_BEGIN', id, name, total, update })
    for (let i = 0; i < total; i++) {
      await sendEncrypted({ type: 'DOC_PART', id, index: i, data: text.slice(i * DOC_CHUNK, (i + 1) * DOC_CHUNK) })
    }
  }

  async function openFromUrl(name, url) {
    try {
      const text = await fetch(url).then(r => r.text())
      setFileName(name)
      setContent(text)
      setOpenedBy('self')
      setEditorOpen(true)
      await sendDoc(text, { name, update: false })
    } catch { /* okunamadı */ }
  }

  function handleContentChange(newContent) {
    setContent(newContent)
    clearTimeout(debounceRef.current)
    // Büyük dosyada canlı senkron ağır → debounce'u içeriğe göre uzat
    const delay = newContent.length > 200 * 1024 ? 700 : 300
    debounceRef.current = setTimeout(() => sendDoc(newContent, { update: true }), delay)
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
    editorOpen, fileName, content, peerTyping, openedBy, loadingPct,
    openFromUrl, handleContentChange, closeEditor, saveFile,
  }
}
