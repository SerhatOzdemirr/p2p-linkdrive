// hooks/useFileTransfer.js
import { useState, useRef, useCallback, useEffect } from 'react'
import { bufToBase64, base64ToBuf } from '../core/crypto.js'
import { generatePreview } from '../core/preview.js'

const CHUNK_SIZE = 64 * 1024
const MAX_SIZE   = 50 * 1024 ** 3

function savePending(id, info) {
  try {
    const p = JSON.parse(localStorage.getItem('linkdrive_pending') || '{}')
    p[id] = info
    localStorage.setItem('linkdrive_pending', JSON.stringify(p))
  } catch {}
}

function removePending(id) {
  try {
    const p = JSON.parse(localStorage.getItem('linkdrive_pending') || '{}')
    delete p[id]
    localStorage.setItem('linkdrive_pending', JSON.stringify(p))
  } catch {}
}

export function useFileTransfer({ dcReady, dcRef, sendEncrypted, registerMessageHandler }) {
  // ── Gönderen state ──────────────────────────────────────────────────────
  const [sending, setSending]           = useState(false)
  const [sendProgress, setSendProgress] = useState(0)
  const [sendingName, setSendingName]   = useState('')
  const [sendError, setSendError]       = useState('')
  const [sendSpeed, setSendSpeed]       = useState(0)
  const [sendEta, setSendEta]           = useState(0)
  // Önizleme gönderildi, alıcının kararı bekleniyor
  const [waitingAccept, setWaitingAccept] = useState(null) // { id, name, previewUrl }

  // ── Alıcı state ─────────────────────────────────────────────────────────
  const [pendingFiles, setPendingFiles] = useState([]) // FILE_META geldi, kullanıcı karar verecek
  const [receivedFiles, setReceivedFiles] = useState([])
  const [incomingMeta, setIncomingMeta] = useState(null)
  const [recvProgress, setRecvProgress] = useState(0)
  const [recvSpeed, setRecvSpeed]       = useState(0)
  const [recvEta, setRecvEta]           = useState(0)

  // ── Ortak state ─────────────────────────────────────────────────────────
  const [dragOver, setDragOver]           = useState(false)
  const [resumeRequest, setResumeRequest] = useState(null)
  const [sendError2, _]                   = [sendError, setSendError]

  // ── Ref'ler ─────────────────────────────────────────────────────────────
  const incoming          = useRef({}) // aktif alım transfer'ları
  const opfsNames         = useRef([])
  const cancelRef         = useRef(false)
  const acceptResolversRef = useRef({}) // id → resolve (gönderen taraf accept bekliyor)
  const previewMapRef     = useRef({})  // id → previewUrl (alıcı taraf, FILE_END'de kullanılır)

  // Tamamlanmış OPFS dosyalarını unmount'ta temizle
  useEffect(() => {
    return () => {
      ;(async () => {
        try {
          const root    = await navigator.storage.getDirectory()
          const pending = JSON.parse(localStorage.getItem('linkdrive_pending') || '{}')
          for (const name of opfsNames.current) {
            const id = name.replace('linkdrive_', '')
            if (!pending[id]) {
              try { await root.removeEntry(name) } catch {}
            }
          }
        } catch {}
      })()
    }
  }, [])

  // Peer bağlandığında yarıda kalan transferleri bildir
  useEffect(() => {
    if (!dcReady) return
    const pending = JSON.parse(localStorage.getItem('linkdrive_pending') || '{}')
    Object.values(pending).forEach(info => {
      sendEncrypted({ type: 'FILE_RESUME_REQUEST', id: info.id, name: info.name, size: info.size, totalChunks: info.totalChunks, fromChunk: info.receivedChunks })
    })
  }, [dcReady]) // eslint-disable-line

  // ── Mesaj yöneticisi ────────────────────────────────────────────────────
  const handleMessage = useCallback(async (msg) => {

    // Alıcı: dosya duyurusu, önizleme bekleniyor
    if (msg.type === 'FILE_META') {
      if (msg.size > MAX_SIZE) return
      setPendingFiles(prev => [...prev, {
        id: msg.id, name: msg.name, size: msg.size,
        mime: msg.mime, totalChunks: msg.totalChunks, previewUrl: null,
      }])
      return
    }

    // Alıcı: önizleme geldi
    if (msg.type === 'FILE_PREVIEW') {
      previewMapRef.current[msg.id] = msg.dataUrl
      setPendingFiles(prev => prev.map(f =>
        f.id === msg.id ? { ...f, previewUrl: msg.dataUrl } : f
      ))
      return
    }

    // Alıcı: gönderen iptal etti (kullanıcı henüz kabul etmeden)
    if (msg.type === 'FILE_WITHDRAW') {
      setPendingFiles(prev => prev.filter(f => f.id !== msg.id))
      delete previewMapRef.current[msg.id]
      return
    }

    // Gönderen: alıcı kabul etti
    if (msg.type === 'FILE_ACCEPT') {
      acceptResolversRef.current[msg.id]?.(true)
      delete acceptResolversRef.current[msg.id]
      return
    }

    // Gönderen: alıcı reddetti
    if (msg.type === 'FILE_DECLINE') {
      acceptResolversRef.current[msg.id]?.(false)
      delete acceptResolversRef.current[msg.id]
      return
    }

    // ── Chunk transfer (mevcut protokol) ───────────────────────────────

    if (msg.type === 'FILE_START') {
      if (msg.size > MAX_SIZE) return
      let transfer
      try {
        const root       = await navigator.storage.getDirectory()
        const opfsName   = `linkdrive_${msg.id}`
        const fileHandle = await root.getFileHandle(opfsName, { create: true })
        const writable   = await fileHandle.createWritable()
        opfsNames.current.push(opfsName)
        transfer = { meta: msg, writable, fileHandle, mode: 'opfs', received: 0, startTime: Date.now(), bytesReceived: 0 }
      } catch {
        transfer = { meta: msg, chunks: new Array(Math.max(msg.totalChunks, 1)), mode: 'memory', received: 0, startTime: Date.now(), bytesReceived: 0 }
      }
      incoming.current[msg.id] = transfer
      savePending(msg.id, { id: msg.id, name: msg.name, size: msg.size, totalChunks: msg.totalChunks, mime: msg.mime, receivedChunks: 0 })
      setIncomingMeta({ name: msg.name, size: msg.size })
      setRecvProgress(0)
      setRecvSpeed(0)
      setRecvEta(0)
    }

    else if (msg.type === 'FILE_RESUME_START') {
      if (msg.size > MAX_SIZE) return
      let transfer
      try {
        const root       = await navigator.storage.getDirectory()
        const opfsName   = `linkdrive_${msg.id}`
        const fileHandle = await root.getFileHandle(opfsName, { create: true })
        const writable   = await fileHandle.createWritable({ keepExistingData: true })
        await writable.seek(msg.fromChunk * CHUNK_SIZE)
        if (!opfsNames.current.includes(opfsName)) opfsNames.current.push(opfsName)
        const bytesDone = msg.fromChunk * CHUNK_SIZE
        transfer = { meta: msg, writable, fileHandle, mode: 'opfs', received: msg.fromChunk, startTime: Date.now(), bytesReceived: bytesDone }
      } catch {
        transfer = { meta: msg, chunks: new Array(Math.max(msg.totalChunks, 1)), mode: 'memory', received: msg.fromChunk, startTime: Date.now(), bytesReceived: msg.fromChunk * CHUNK_SIZE }
      }
      incoming.current[msg.id] = transfer
      setIncomingMeta({ name: msg.name, size: msg.size })
      setRecvProgress((msg.fromChunk / Math.max(msg.totalChunks, 1)) * 100)
    }

    else if (msg.type === 'FILE_RESUME_REQUEST') {
      setResumeRequest(msg)
    }

    else if (msg.type === 'FILE_CHUNK') {
      const t = incoming.current[msg.id]
      if (!t) return
      const buf = base64ToBuf(msg.data)
      if (t.mode === 'opfs') {
        await t.writable.write(buf)
      } else {
        t.chunks[msg.index] = buf
      }
      t.received++
      t.bytesReceived += buf.byteLength

      const elapsed   = (Date.now() - t.startTime) / 1000 || 0.001
      const speed     = t.bytesReceived / elapsed
      const remaining = t.meta.size - t.bytesReceived
      setRecvProgress((t.bytesReceived / Math.max(t.meta.size, 1)) * 100)
      setRecvSpeed(speed)
      setRecvEta(remaining / speed)
      savePending(msg.id, { id: msg.id, name: t.meta.name, size: t.meta.size, totalChunks: t.meta.totalChunks, mime: t.meta.mime, receivedChunks: t.received })
    }

    else if (msg.type === 'FILE_END') {
      const t = incoming.current[msg.id]
      if (!t) return
      let url
      if (t.mode === 'opfs') {
        await t.writable.close()
        const file = await t.fileHandle.getFile()
        url = URL.createObjectURL(file)
      } else {
        const blob = new Blob(t.chunks, { type: t.meta.mime || 'application/octet-stream' })
        url = URL.createObjectURL(blob)
      }
      const previewUrl = previewMapRef.current[msg.id] ?? null
      delete previewMapRef.current[msg.id]
      removePending(msg.id)
      setReceivedFiles(prev => [...prev, { name: t.meta.name, size: t.meta.size, url, previewUrl }])
      setIncomingMeta(null)
      setRecvProgress(0)
      setRecvSpeed(0)
      setRecvEta(0)
      delete incoming.current[msg.id]
    }

    else if (msg.type === 'FILE_CANCEL') {
      const t = incoming.current[msg.id]
      if (t?.mode === 'opfs') {
        try { await t.writable.close() } catch {}
      }
      delete incoming.current[msg.id]
      setIncomingMeta(null)
      setRecvProgress(0)
      setRecvSpeed(0)
      setRecvEta(0)
    }

  }, []) // eslint-disable-line

  // Tüm FILE_* tipleri için aynı handler
  useEffect(() => {
    const types = [
      'FILE_META', 'FILE_PREVIEW', 'FILE_WITHDRAW',
      'FILE_ACCEPT', 'FILE_DECLINE',
      'FILE_START', 'FILE_RESUME_START', 'FILE_RESUME_REQUEST',
      'FILE_CHUNK', 'FILE_END', 'FILE_CANCEL',
    ]
    types.forEach(t => registerMessageHandler(t, handleMessage))
  }, []) // eslint-disable-line

  // ── Dosya gönder ────────────────────────────────────────────────────────
  async function sendFile(file, fromChunk = 0, resumeId = null) {
    if (!dcReady || !dcRef.current || sending) return
    const dc        = dcRef.current
    const isResume  = fromChunk > 0 || resumeId !== null
    const id        = resumeId || crypto.randomUUID()
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1

    cancelRef.current = false
    setSending(true)
    setSendingName(file.name)
    setSendError('')

    try {
      if (!isResume) {
        // 1. Önizleme üret (hata olursa null döner, akış devam eder)
        const previewUrl = await generatePreview(file)

        // 2. Meta + önizleme gönder
        await sendEncrypted({ type: 'FILE_META', id, name: file.name, size: file.size, mime: file.type, totalChunks })
        if (previewUrl) await sendEncrypted({ type: 'FILE_PREVIEW', id, dataUrl: previewUrl })

        // 3. Alıcının kararını bekle
        setWaitingAccept({ id, name: file.name, previewUrl })
        const accepted = await new Promise(resolve => {
          acceptResolversRef.current[id] = resolve
        })
        setWaitingAccept(null)

        if (!accepted || cancelRef.current) {
          if (cancelRef.current) await sendEncrypted({ type: 'FILE_WITHDRAW', id })
          return
        }
      }

      // 4. Chunk'ları gönder
      let bytesSent = fromChunk * CHUNK_SIZE
      const startTime = Date.now()
      setSendProgress((bytesSent / Math.max(file.size, 1)) * 100)
      setSendSpeed(0)
      setSendEta(0)

      const msgType = fromChunk > 0 ? 'FILE_RESUME_START' : 'FILE_START'
      await sendEncrypted({ type: msgType, id, name: file.name, size: file.size, totalChunks, mime: file.type, fromChunk })

      for (let i = fromChunk; i < totalChunks; i++) {
        if (cancelRef.current) {
          await sendEncrypted({ type: 'FILE_CANCEL', id })
          break
        }
        while (dc.bufferedAmount > 8 * CHUNK_SIZE) {
          await new Promise(r => setTimeout(r, 10))
        }
        const slice = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        const buf   = await slice.arrayBuffer()
        await sendEncrypted({ type: 'FILE_CHUNK', id, index: i, data: bufToBase64(buf) })

        bytesSent += buf.byteLength
        const elapsed   = (Date.now() - startTime) / 1000 || 0.001
        const speed     = bytesSent / elapsed
        const remaining = file.size - bytesSent
        setSendSpeed(speed)
        setSendEta(remaining / speed)
        setSendProgress((bytesSent / Math.max(file.size, 1)) * 100)
      }

      if (!cancelRef.current) {
        await sendEncrypted({ type: 'FILE_END', id })
        setSendProgress(100)
      }
    } catch (err) {
      setSendError(err?.message || 'Dosya gönderilemedi.')
    } finally {
      setSending(false)
      setSendingName('')
      setSendSpeed(0)
      setSendEta(0)
      setWaitingAccept(null)
      cancelRef.current = false
      delete acceptResolversRef.current[id]
    }
  }

  // ── Alıcı: kabul / reddet ───────────────────────────────────────────────
  async function acceptFile(id) {
    const f = pendingFiles.find(p => p.id === id)
    setPendingFiles(prev => prev.filter(p => p.id !== id))
    if (f) setIncomingMeta({ name: f.name, size: f.size })
    await sendEncrypted({ type: 'FILE_ACCEPT', id })
  }

  async function declineFile(id) {
    setPendingFiles(prev => prev.filter(p => p.id !== id))
    delete previewMapRef.current[id]
    await sendEncrypted({ type: 'FILE_DECLINE', id })
  }

  // ── Resume akışı ────────────────────────────────────────────────────────
  async function handleResumeFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (file.name !== resumeRequest.name || file.size !== resumeRequest.size) {
      setSendError(`Yanlış dosya — "${resumeRequest.name}" seçin.`)
      setResumeRequest(null)
      return
    }
    const req = resumeRequest
    setResumeRequest(null)
    await sendFile(file, req.fromChunk, req.id)
  }

  // ── Drop / input ────────────────────────────────────────────────────────
  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    setSendError('')
    const entry = e.dataTransfer.items?.[0]?.webkitGetAsEntry?.()
    if (entry?.isDirectory) {
      setSendError('Klasör gönderilemez — önce ZIP\'leyin.')
      return
    }
    const file = e.dataTransfer.files[0]
    if (file) sendFile(file)
  }

  function handleInput(e) {
    const file = e.target.files[0]
    if (file) sendFile(file)
    e.target.value = ''
  }

  function cancelTransfer() {
    cancelRef.current = true
    // Accept bekliyorsa da iptal et
    Object.values(acceptResolversRef.current).forEach(r => r(false))
    acceptResolversRef.current = {}
  }

  function dismissResume() {
    removePending(resumeRequest?.id)
    setResumeRequest(null)
  }

  return {
    // Gönderen
    sending, sendProgress, sendingName, sendError, sendSpeed, sendEta,
    waitingAccept,
    // Alıcı
    pendingFiles, receivedFiles,
    incomingMeta, recvProgress, recvSpeed, recvEta,
    // Ortak UI
    dragOver, setDragOver,
    resumeRequest,
    // Aksiyonlar
    handleDrop, handleInput, handleResumeFile,
    cancelTransfer, dismissResume,
    acceptFile, declineFile,
    setSendError,
  }
}
