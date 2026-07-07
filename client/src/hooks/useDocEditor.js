// hooks/useDocEditor.js — ortak editör (chunk'lı sync, yorum, kilit, değişiklik vurgusu)
import { useState, useRef, useCallback, useEffect } from 'react'

const MAX_EDIT_SIZE = 10 * 1024 * 1024  // 10 MB
const DOC_CHUNK     = 32 * 1024

const EDITABLE_EXTS = new Set([
  '.txt', '.md', '.markdown', '.log', '.csv', '.tsv', '.json', '.json5',
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.html', '.htm', '.css', '.scss', '.less',
  '.py', '.java', '.c', '.h', '.cpp', '.hpp', '.cs', '.go', '.rs', '.rb', '.php', '.swift',
  '.kt', '.kts', '.lua', '.pl', '.r', '.dart', '.vue', '.svelte',
  '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env', '.properties',
  '.xml', '.svg', '.sql', '.sh', '.bash', '.zsh', '.bat', '.ps1',
  '.gitignore', '.dockerfile', '.makefile', '.diff', '.patch', '.srt', '.vtt', '.tex',
])

// Uzantı → dil etiketi
const LANG = {
  js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
  py: 'Python', java: 'Java', c: 'C', cpp: 'C++', cs: 'C#', go: 'Go', rs: 'Rust', rb: 'Ruby',
  php: 'PHP', swift: 'Swift', kt: 'Kotlin', lua: 'Lua', r: 'R', dart: 'Dart',
  html: 'HTML', css: 'CSS', scss: 'SCSS', json: 'JSON', xml: 'XML', svg: 'SVG',
  yaml: 'YAML', yml: 'YAML', toml: 'TOML', sql: 'SQL', sh: 'Shell', bash: 'Shell',
  md: 'Markdown', csv: 'CSV', tsv: 'TSV', vue: 'Vue', svelte: 'Svelte',
}
export function detectLang(name = '') {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  return LANG[ext] || (ext ? ext.toUpperCase() : 'Metin')
}

export function isEditable(name, size) {
  const lower = name.toLowerCase()
  const dot   = lower.lastIndexOf('.')
  const ext   = dot > 0 ? lower.slice(dot) : lower
  const ok    = EDITABLE_EXTS.has(ext) || ['dockerfile', 'makefile', '.gitignore'].includes(lower)
  return ok && size <= MAX_EDIT_SIZE
}

function firstDiffLine(a, b) {
  const la = a.split('\n'), lb = b.split('\n')
  const n = Math.max(la.length, lb.length)
  for (let i = 0; i < n; i++) if (la[i] !== lb[i]) return i + 1
  return 0
}

export function useDocEditor({ dcReady, sendEncrypted, registerMessageHandler }) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [fileName, setFileName]     = useState('')
  const [content, setContent]       = useState('')
  const [peerTyping, setPeerTyping] = useState(false)
  const [openedBy, setOpenedBy]     = useState(null)
  const [loadingPct, setLoadingPct] = useState(0)
  const [lockedByPeer, setLockedByPeer] = useState(false) // karşı taraf kilitledi → salt okunur
  const [locked, setLocked]         = useState(false)      // ben kilitledim
  const [comments, setComments]     = useState([])         // { line, text, from, ts }
  const [flash, setFlash]           = useState(null)       // { line, key } — değişiklik vurgusu

  const debounceRef     = useRef(null)
  const peerTypingTimer = useRef(null)
  const seqRef          = useRef(0)
  const recvRef         = useRef(null)
  const contentRef      = useRef('')
  const flashKeyRef     = useRef(0)

  useEffect(() => { contentRef.current = content }, [content])

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
        if (r.update) {
          const line = firstDiffLine(contentRef.current, text)
          if (line) setFlash({ line, key: ++flashKeyRef.current }) // değişen satırı parlat
          setContent(text)
          setPeerTyping(true)
          clearTimeout(peerTypingTimer.current)
          peerTypingTimer.current = setTimeout(() => setPeerTyping(false), 1500)
        } else {
          setContent(text)
          setFileName(r.name || 'belge.txt')
          setOpenedBy('peer')
          setComments([])
          setLockedByPeer(false)
          setEditorOpen(true)
        }
      }
    }
    else if (msg.type === 'DOC_CLOSE')   setEditorOpen(false)
    else if (msg.type === 'DOC_LOCK')    setLockedByPeer(!!msg.locked)
    else if (msg.type === 'DOC_COMMENT') setComments(prev => [...prev, { line: msg.line, text: msg.text, from: 'peer', ts: Date.now() }])
  }, [])

  useEffect(() => {
    ['DOC_BEGIN', 'DOC_PART', 'DOC_CLOSE', 'DOC_LOCK', 'DOC_COMMENT']
      .forEach(t => registerMessageHandler(t, handleMessage))
  }, []) // eslint-disable-line

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
      setFileName(name); setContent(text); setOpenedBy('self')
      setComments([]); setLocked(false); setLockedByPeer(false)
      setEditorOpen(true)
      await sendDoc(text, { name, update: false })
    } catch {}
  }

  function handleContentChange(newContent) {
    if (lockedByPeer) return // salt okunur
    setContent(newContent)
    clearTimeout(debounceRef.current)
    const delay = newContent.length > 200 * 1024 ? 700 : 300
    debounceRef.current = setTimeout(() => sendDoc(newContent, { update: true }), delay)
  }

  function toggleLock() {
    const next = !locked
    setLocked(next)
    sendEncrypted({ type: 'DOC_LOCK', locked: next })
  }

  function addComment(line, text) {
    if (!text.trim()) return
    setComments(prev => [...prev, { line, text: text.trim(), from: 'self', ts: Date.now() }])
    sendEncrypted({ type: 'DOC_COMMENT', line, text: text.trim() })
  }

  function closeEditor() {
    setEditorOpen(false)
    if (locked) { setLocked(false); sendEncrypted({ type: 'DOC_LOCK', locked: false }) }
    if (dcReady) sendEncrypted({ type: 'DOC_CLOSE' })
  }

  function saveFile() {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = fileName; a.click()
    URL.revokeObjectURL(url)
  }

  async function copyToClipboard() {
    try { await navigator.clipboard.writeText(content); return true } catch { return false }
  }

  return {
    editorOpen, fileName, content, peerTyping, openedBy, loadingPct,
    locked, lockedByPeer, comments, flash, lang: detectLang(fileName),
    openFromUrl, handleContentChange, closeEditor, saveFile, copyToClipboard,
    toggleLock, addComment,
  }
}
