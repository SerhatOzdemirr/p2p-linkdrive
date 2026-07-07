// hooks/useFileTransfer.js
import { useState, useRef, useCallback, useEffect } from 'react'
import { bufToBase64, base64ToBuf } from '../core/crypto.js'
import { generatePreview } from '../core/preview.js'
import { idbPut, idbDelete, idbGetAll } from '../core/idb.js'

// 128 KB: base64 sonrası ~171 KB → Chrome DataChannel 256 KB limitinin altında
// 256 KB denenmiş, encrypted mesaj ~342 KB çıkıyor → dc.send() patlar, chunk kaybolur
const CHUNK_SIZE     = 128 * 1024
const HIGH_WATERMARK = 8 * CHUNK_SIZE    // 1 MB — bu dolunca dur
const LOW_WATERMARK  = CHUNK_SIZE        // 128 KB — buna düşünce devam et
const MAX_SIZE       = 50 * 1024 ** 3

export function useFileTransfer({ dcReady, dcRef, sendEncrypted, registerMessageHandler }) {
  // ── Gönderen state ──────────────────────────────────────────────────────
  const [sending, setSending]           = useState(false)
  const [sendProgress, setSendProgress] = useState(0)
  const [sendingName, setSendingName]   = useState('')
  const [sendError, setSendError]       = useState('')
  const [sendSpeed, setSendSpeed]       = useState(0)
  const [sendEta, setSendEta]           = useState(0)
  const [waitingAccept, setWaitingAccept] = useState(null) // { id, name, previewUrl }
  const [queuedFiles, setQueuedFiles]   = useState([])     // [{ uid, file }] — UI için
  const [batchTotal, setBatchTotal]     = useState(0)      // toplu gönderim: toplam dosya
  const [batchDone, setBatchDone]       = useState(0)      // toplu gönderim: biten dosya

  // ── Alıcı state ─────────────────────────────────────────────────────────
  const [pendingFiles, setPendingFiles] = useState([])
  const [receivedFiles, setReceivedFiles] = useState([])
  const [incomingMeta, setIncomingMeta] = useState(null)
  const [recvProgress, setRecvProgress] = useState(0)
  const [autoAccept, setAutoAccept]     = useState(false)
  const [recvSpeed, setRecvSpeed]       = useState(0)
  const [recvEta, setRecvEta]           = useState(0)

  // ── Ortak state ─────────────────────────────────────────────────────────
  const [dragOver, setDragOver]           = useState(false)
  const [resumeRequest, setResumeRequest] = useState(null) // { id, fromChunk, name, size } — sayfa yenilenmiş, dosyayı tekrar seç

  // ── Ref'ler ─────────────────────────────────────────────────────────────
  const incoming           = useRef({})
  const opfsNames          = useRef([])
  const cancelRef          = useRef(false)
  const acceptResolversRef = useRef({})
  const previewMapRef      = useRef({})
  const activeSendsRef     = useRef({})    // id → { file } (bağlantı koparsa kaldığı yerden devam için)
  const idbThrottleRef     = useRef({})    // id → son IDB yazma zamanı
  const sendingRef         = useRef(false) // setSending'in sync yansıması
  const sendQueueRef       = useRef([])    // [{ uid, file }]
  const drainingRef        = useRef(false) // drainQueue tekrarlı çağrı koruması
  const autoAcceptRef      = useRef(false) // autoAccept'in sync yansıması
  const batchTotalRef      = useRef(0)     // batchTotal'ın sync yansıması
  const batchDoneRef       = useRef(0)     // batchDone'ın sync yansıması

  // ── Throttle: hot değerler ref'te, state'e seyrek flush (render fırtınasını önler) ──
  const sendProgressRef = useRef(0)
  const sendSpeedRef    = useRef(0)
  const sendEtaRef      = useRef(0)
  const flushTimerRef   = useRef(null)

  // Ref'lerdeki güncel değerleri state'e bas (React 18 timer içinde otomatik batch'ler → tek render)
  function flushView() {
    clearTimeout(flushTimerRef.current)
    flushTimerRef.current = null
    setSendProgress(sendProgressRef.current)
    setSendSpeed(sendSpeedRef.current)
    setSendEta(sendEtaRef.current)
    setBatchDone(batchDoneRef.current)
    setQueuedFiles([...sendQueueRef.current])
  }

  // En fazla 100ms'de bir flush — yüzlerce güncelleme tek render'a iner
  function scheduleFlush() {
    if (flushTimerRef.current) return
    flushTimerRef.current = setTimeout(flushView, 100)
  }

  // OPFS temizliği: sadece TAMAMLANMIŞ dosyaları sil; yarım (IDB'de kayıtlı) olanları
  // resume için sakla
  useEffect(() => {
    return () => {
      ;(async () => {
        try {
          const root    = await navigator.storage.getDirectory()
          const pending = new Set((await idbGetAll()).map(r => `linkdrive_${r.id}`))
          for (const name of opfsNames.current) {
            if (pending.has(name)) continue // yarım kalan → sakla
            try { await root.removeEntry(name) } catch {}
          }
        } catch {}
      })()
    }
  }, [])

  // ── Mesaj yöneticisi ────────────────────────────────────────────────────
  const handleMessage = useCallback(async (msg) => {

    if (msg.type === 'FILE_META') {
      if (msg.size > MAX_SIZE) return
      if (autoAcceptRef.current) {
        // Auto-accept: pending kuyruğunu atla, direkt kabul et
        setIncomingMeta({ name: msg.name, size: msg.size })
        await sendEncrypted({ type: 'FILE_ACCEPT', id: msg.id })
        return
      }
      setPendingFiles(prev => [...prev, {
        id: msg.id, name: msg.name, size: msg.size,
        mime: msg.mime, totalChunks: msg.totalChunks, previewUrl: null,
      }])
      return
    }

    if (msg.type === 'FILE_PREVIEW') {
      previewMapRef.current[msg.id] = msg.dataUrl
      setPendingFiles(prev => prev.map(f =>
        f.id === msg.id ? { ...f, previewUrl: msg.dataUrl } : f
      ))
      return
    }

    if (msg.type === 'FILE_WITHDRAW') {
      setPendingFiles(prev => prev.filter(f => f.id !== msg.id))
      delete previewMapRef.current[msg.id]
      return
    }

    if (msg.type === 'FILE_ACCEPT') {
      acceptResolversRef.current[msg.id]?.(true)
      delete acceptResolversRef.current[msg.id]
      return
    }

    if (msg.type === 'FILE_DECLINE') {
      acceptResolversRef.current[msg.id]?.(false)
      delete acceptResolversRef.current[msg.id]
      return
    }

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
      idbPut({ id: msg.id, name: msg.name, size: msg.size, mime: msg.mime, totalChunks: msg.totalChunks, receivedChunks: 0 })
      setIncomingMeta({ name: msg.name, size: msg.size })
      setRecvProgress(0)
      setRecvSpeed(0)
      setRecvEta(0)
    }

    // Gönderen kaldığı yerden devam ettiriyor (bağlantı koptu/sayfa yenilendi)
    else if (msg.type === 'FILE_RESUME_START') {
      if (msg.size > MAX_SIZE) return
      let transfer = incoming.current[msg.id]
      if (!transfer || transfer.mode !== 'opfs') {
        // Bellekte yok (sayfa yenilenmiş) → OPFS'teki yarım dosyayı tekrar aç
        try {
          const root       = await navigator.storage.getDirectory()
          const opfsName   = `linkdrive_${msg.id}`
          const fileHandle = await root.getFileHandle(opfsName, { create: true })
          const writable   = await fileHandle.createWritable({ keepExistingData: true })
          await writable.seek(msg.fromChunk * CHUNK_SIZE)
          if (!opfsNames.current.includes(opfsName)) opfsNames.current.push(opfsName)
          transfer = { meta: msg, writable, fileHandle, mode: 'opfs',
            received: msg.fromChunk, startTime: Date.now(), bytesReceived: msg.fromChunk * CHUNK_SIZE }
        } catch {
          transfer = { meta: msg, chunks: new Array(Math.max(msg.totalChunks, 1)), mode: 'memory',
            received: msg.fromChunk, startTime: Date.now(), bytesReceived: msg.fromChunk * CHUNK_SIZE }
        }
        incoming.current[msg.id] = transfer
      } else {
        // Bellekte var → yazma pozisyonunu hizala
        transfer.meta = msg
        try { await transfer.writable.seek(msg.fromChunk * CHUNK_SIZE) } catch {}
        transfer.received = msg.fromChunk
        transfer.bytesReceived = msg.fromChunk * CHUNK_SIZE
        transfer.startTime = Date.now()
      }
      setIncomingMeta({ name: msg.name, size: msg.size })
      setRecvProgress((msg.fromChunk / Math.max(msg.totalChunks, 1)) * 100)
    }

    // Karşı taraf "kaldığın yerden devam et" dedi (ben göndericiyim)
    else if (msg.type === 'FILE_RESUME_REQUEST') {
      const active = activeSendsRef.current[msg.id]
      if (active?.file) {
        // Eski gönderim döngüsü (kopan kanal) kapanana kadar bekle, sonra devam et
        let tries = 0
        const tryResume = () => {
          if (!sendingRef.current) { sendFile(active.file, msg.fromChunk, msg.id); return }
          if (tries++ < 20) setTimeout(tryResume, 150)
        }
        tryResume()
      } else {
        setResumeRequest({ id: msg.id, fromChunk: msg.fromChunk, name: msg.name, size: msg.size }) // dosya yok → tekrar seç
      }
    }

    else if (msg.type === 'FILE_CHUNK') {
      const t = incoming.current[msg.id]
      if (!t) return
      // İlk chunk gelince süreyi başlat (FILE_START → ilk chunk arası gecikmeyi dışarıda bırak)
      if (t.received === 0) t.startTime = Date.now()
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

      // İlerlemeyi IDB'ye seyrek yaz (her chunk değil, ~1sn'de bir)
      const now = Date.now()
      if (now - (idbThrottleRef.current[msg.id] || 0) > 1000) {
        idbThrottleRef.current[msg.id] = now
        idbPut({ id: msg.id, name: t.meta.name, size: t.meta.size, mime: t.meta.mime, totalChunks: t.meta.totalChunks, receivedChunks: t.received })
      }
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
      idbDelete(msg.id) // tamamlandı → kalıcı kayıt gerekmez
      setReceivedFiles(prev => [...prev, { name: t.meta.name, size: t.meta.size, mime: t.meta.mime, url, previewUrl }])
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
      idbDelete(msg.id)
      delete incoming.current[msg.id]
      setIncomingMeta(null)
      setRecvProgress(0)
      setRecvSpeed(0)
      setRecvEta(0)
    }

  }, []) // eslint-disable-line

  useEffect(() => {
    const types = [
      'FILE_META', 'FILE_PREVIEW', 'FILE_WITHDRAW',
      'FILE_ACCEPT', 'FILE_DECLINE',
      'FILE_START', 'FILE_RESUME_START', 'FILE_RESUME_REQUEST',
      'FILE_CHUNK', 'FILE_END', 'FILE_CANCEL',
    ]
    types.forEach(t => registerMessageHandler(t, handleMessage))
  }, []) // eslint-disable-line

  // Bağlantı (yeniden) kurulunca yarım kalan alımlar için "kaldığın yerden devam et" iste
  useEffect(() => {
    if (!dcReady) return
    ;(async () => {
      const seen = new Set()
      // 1. Bellekteki aktif alımlar (bağlantı koptu ama sayfa açık)
      for (const [id, t] of Object.entries(incoming.current)) {
        seen.add(id)
        sendEncrypted({ type: 'FILE_RESUME_REQUEST', id, fromChunk: t.received, name: t.meta.name, size: t.meta.size })
      }
      // 2. IDB'deki kalıcı yarım transferler (sayfa yenilenmiş olabilir)
      const pend = await idbGetAll()
      for (const r of pend) {
        if (seen.has(r.id)) continue
        sendEncrypted({ type: 'FILE_RESUME_REQUEST', id: r.id, fromChunk: r.receivedChunks, name: r.name, size: r.size })
      }
    })()
  }, [dcReady]) // eslint-disable-line

  // ── Tekil dosya gönder (resume destekli) ─────────────────────────────────
  async function sendFile(file, fromChunk = 0, resumeId = null) {
    // dcReady state'i değil, canlı kanalı kontrol et (resume handleMessage'dan çağrılıyor → stale closure)
    if (!dcRef.current || dcRef.current.readyState !== 'open' || sendingRef.current) return
    const dc          = dcRef.current
    const isResume    = fromChunk > 0 || !!resumeId
    const id          = resumeId || crypto.randomUUID()
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1

    cancelRef.current  = false
    sendingRef.current = true
    activeSendsRef.current[id] = { file } // kopmada devam için dosyayı tut
    setSending(true)
    setSendingName(file.name)
    setSendError('')
    if (isResume) setResumeRequest(null)

    let aborted = false
    try {
      if (!isResume) {
        const previewUrl = await generatePreview(file)
        await sendEncrypted({ type: 'FILE_META', id, name: file.name, size: file.size, mime: file.type, totalChunks })
        if (previewUrl) await sendEncrypted({ type: 'FILE_PREVIEW', id, dataUrl: previewUrl })

        setWaitingAccept({ id, name: file.name, previewUrl })
        const accepted = await new Promise(resolve => { acceptResolversRef.current[id] = resolve })
        setWaitingAccept(null)
        if (!accepted || cancelRef.current) {
          if (cancelRef.current) await sendEncrypted({ type: 'FILE_WITHDRAW', id })
          delete activeSendsRef.current[id]
          return
        }
      }

      let bytesSent = fromChunk * CHUNK_SIZE
      const startTime = Date.now()
      sendProgressRef.current = (bytesSent / Math.max(file.size, 1)) * 100
      sendSpeedRef.current = 0
      sendEtaRef.current   = 0
      scheduleFlush()

      dc.bufferedAmountLowThreshold = LOW_WATERMARK
      const startType = isResume ? 'FILE_RESUME_START' : 'FILE_START'
      await sendEncrypted({ type: startType, id, name: file.name, size: file.size, totalChunks, mime: file.type, fromChunk })

      for (let i = fromChunk; i < totalChunks; i++) {
        if (cancelRef.current) { await sendEncrypted({ type: 'FILE_CANCEL', id }); break }
        // Bağlantı koptu / kanal değişti → dur, dosya activeSends'te kalsın (resume edilecek)
        if (dcRef.current !== dc || dc.readyState !== 'open') { aborted = true; break }

        if (dc.bufferedAmount > HIGH_WATERMARK) {
          await new Promise(resolve => {
            const done = () => resolve()
            dc.addEventListener('bufferedamountlow', done, { once: true })
            setTimeout(done, 1500) // kopmada takılma yedeği → döngü tekrar kontrol eder
            if (dc.bufferedAmount <= LOW_WATERMARK) done()
          })
          if (dcRef.current !== dc || dc.readyState !== 'open') { aborted = true; break }
        }

        const slice = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        const buf   = await slice.arrayBuffer()
        await sendEncrypted({ type: 'FILE_CHUNK', id, index: i, data: bufToBase64(buf) })

        bytesSent += buf.byteLength
        const elapsed   = (Date.now() - startTime) / 1000 || 0.001
        sendSpeedRef.current    = bytesSent / elapsed
        sendEtaRef.current      = (file.size - bytesSent) / (bytesSent / elapsed)
        sendProgressRef.current = (bytesSent / Math.max(file.size, 1)) * 100
        scheduleFlush()
      }

      if (!cancelRef.current && !aborted) {
        await sendEncrypted({ type: 'FILE_END', id })
        sendProgressRef.current = 100
        scheduleFlush()
        delete activeSendsRef.current[id] // tamamlandı
      }
      if (cancelRef.current) delete activeSendsRef.current[id]
    } catch (err) {
      if (!aborted) setSendError(err?.message || 'Dosya gönderilemedi.')
    } finally {
      sendingRef.current = false
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
      sendSpeedRef.current = 0
      sendEtaRef.current   = 0
      setSending(false)
      setSendingName('')
      setSendSpeed(0)
      setSendEta(0)
      setWaitingAccept(null)
      cancelRef.current = false
      delete acceptResolversRef.current[id]
    }
  }

  // ── Kuyruk işlemcisi ────────────────────────────────────────────────────
  async function drainQueue() {
    if (drainingRef.current) return
    drainingRef.current = true

    while (sendQueueRef.current.length > 0) {
      const entry = sendQueueRef.current.shift()
      scheduleFlush() // kuyruk değişti — throttled flush
      cancelRef.current = false
      await sendFile(entry.file)
      if (cancelRef.current) {
        // İptal sonrası kuyruğu ve batch sayaçlarını temizle
        sendQueueRef.current = []
        batchTotalRef.current = 0
        batchDoneRef.current  = 0
        setBatchTotal(0)
        flushView()
        break
      }
      // Dosya tamamlandı (gönderildi/reddedildi) → batch sayacını artır
      batchDoneRef.current++
      scheduleFlush() // throttled — 500 dosyada per-file render fırtınası olmasın
    }
    flushView() // batch bitti — son durumu kesinleştir

    drainingRef.current = false
    // Batch bitti — bir süre sonra göstergeyi sıfırla
    if (!cancelRef.current) {
      setTimeout(() => {
        if (!drainingRef.current) {
          batchTotalRef.current = 0
          batchDoneRef.current  = 0
          setBatchTotal(0)
          setBatchDone(0)
        }
      }, 1500)
    }
  }

  function enqueueFiles(files) {
    const entries = files.map(f => ({ uid: crypto.randomUUID(), file: f }))
    // Yeni batch başlıyorsa sayaçları sıfırla
    if (!drainingRef.current) {
      batchTotalRef.current = 0
      batchDoneRef.current  = 0
      setBatchDone(0)
    }
    batchTotalRef.current += entries.length
    setBatchTotal(batchTotalRef.current)
    sendQueueRef.current.push(...entries)
    setQueuedFiles(prev => [...prev, ...entries])
    drainQueue()
  }

  // Stable referans — memo'lu kuyruk listesinin gereksiz render'ını önler
  const removeFromQueue = useCallback((uid) => {
    sendQueueRef.current = sendQueueRef.current.filter(e => e.uid !== uid)
    setQueuedFiles(prev => prev.filter(e => e.uid !== uid))
  }, [])

  // ── Alıcı: kabul / reddet ───────────────────────────────────────────────
  async function acceptFile(id) {
    const f = pendingFiles.find(p => p.id === id)
    setPendingFiles(prev => prev.filter(p => p.id !== id))
    if (f) setIncomingMeta({ name: f.name, size: f.size })
    await sendEncrypted({ type: 'FILE_ACCEPT', id })
  }

  async function acceptAll() {
    autoAcceptRef.current = true
    setAutoAccept(true)
    // Şu an bekleyen tüm dosyaları da kabul et
    const pending = [...pendingFiles]
    setPendingFiles([])
    for (const f of pending) {
      setIncomingMeta({ name: f.name, size: f.size })
      await sendEncrypted({ type: 'FILE_ACCEPT', id: f.id })
    }
  }

  function disableAutoAccept() {
    autoAcceptRef.current = false
    setAutoAccept(false)
  }

  async function declineFile(id) {
    setPendingFiles(prev => prev.filter(p => p.id !== id))
    delete previewMapRef.current[id]
    await sendEncrypted({ type: 'FILE_DECLINE', id })
  }

  // ── Drop / input ────────────────────────────────────────────────────────
  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    setSendError('')
    const items = [...(e.dataTransfer.items || [])]
    const hasDir = items.some(item => item.webkitGetAsEntry?.()?.isDirectory)
    if (hasDir) {
      setSendError('Klasör gönderilemez — önce ZIP\'leyin.')
      return
    }
    const files = [...e.dataTransfer.files]
    if (files.length) enqueueFiles(files)
  }

  function handleInput(e) {
    const files = [...e.target.files]
    if (files.length) enqueueFiles(files)
    e.target.value = ''
  }

  function cancelTransfer() {
    cancelRef.current = true
    Object.values(acceptResolversRef.current).forEach(r => r(false))
    acceptResolversRef.current = {}
    activeSendsRef.current = {}
    // Kuyruğu ve batch sayaçlarını temizle
    sendQueueRef.current = []
    setQueuedFiles([])
    batchTotalRef.current = 0
    batchDoneRef.current  = 0
    setBatchTotal(0)
    setBatchDone(0)
  }

  // ── Resume: sayfa yenilenmiş, gönderici dosyayı tekrar seçiyor ────────────
  async function handleResumeFile(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file || !resumeRequest) return
    if (file.name !== resumeRequest.name || file.size !== resumeRequest.size) {
      setSendError(`Yanlış dosya — "${resumeRequest.name}" seçmelisin.`)
      return
    }
    const req = resumeRequest
    setResumeRequest(null)
    await sendFile(file, req.fromChunk, req.id)
  }

  function dismissResume() {
    if (resumeRequest) idbDelete(resumeRequest.id)
    setResumeRequest(null)
  }

  return {
    // Gönderen
    sending, sendProgress, sendingName, sendError, sendSpeed, sendEta,
    waitingAccept, queuedFiles, batchTotal, batchDone,
    // Alıcı
    pendingFiles, receivedFiles,
    incomingMeta, recvProgress, recvSpeed, recvEta,
    // Ortak UI
    dragOver, setDragOver,
    resumeRequest,
    // Aksiyonlar
    handleDrop, handleInput, handleResumeFile, dismissResume,
    cancelTransfer,
    acceptFile, declineFile, acceptAll, autoAccept, disableAutoAccept,
    removeFromQueue,
    setSendError,
  }
}
