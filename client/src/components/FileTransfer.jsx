// components/FileTransfer.jsx
import { useState, useRef, useCallback, useEffect } from 'react'
import { bufToBase64, base64ToBuf } from '../core/crypto.js'

const CHUNK_SIZE = 16 * 1024       // 16 KB — DataChannel güvenli sınırı
const MAX_SIZE   = 50 * 1024 ** 3  // 50 GB üstü reddet (OPFS kotası için)

export default function FileTransfer({ dcReady, dcRef, send, onRegisterHandler }) {
  const [sending, setSending]             = useState(false)
  const [sendProgress, setSendProgress]   = useState(0)
  const [sendingName, setSendingName]     = useState('')
  const [sendError, setSendError]         = useState('')
  const [receivedFiles, setReceivedFiles] = useState([])
  const [incomingMeta, setIncomingMeta]   = useState(null)
  const [recvProgress, setRecvProgress]   = useState(0)
  const [dragOver, setDragOver]           = useState(false)

  const incoming  = useRef({})  // id -> transfer state
  const opfsNames = useRef([])  // unmount'ta temizlenecek OPFS girişleri

  // Sayfa kapanınca geçici OPFS dosyalarını sil
  useEffect(() => {
    return () => {
      ;(async () => {
        try {
          const root = await navigator.storage.getDirectory()
          for (const name of opfsNames.current) {
            try { await root.removeEntry(name) } catch {}
          }
        } catch {}
      })()
    }
  }, [])

  const handleMessage = useCallback(async (msg) => {

    // ── Dosya başlıyor ─────────────────────────────────────────────────────
    if (msg.type === 'FILE_START') {
      if (msg.size > MAX_SIZE) return

      let transfer
      try {
        // OPFS: her chunk RAM'e yüklenmeden diske gider
        const root      = await navigator.storage.getDirectory()
        const opfsName  = `linkdrive_${msg.id}`
        const fileHandle = await root.getFileHandle(opfsName, { create: true })
        const writable  = await fileHandle.createWritable()
        opfsNames.current.push(opfsName)
        transfer = { meta: msg, writable, fileHandle, mode: 'opfs', received: 0 }
      } catch {
        // OPFS desteklenmiyor (eski tarayıcı) — belleğe al
        transfer = { meta: msg, chunks: new Array(Math.max(msg.totalChunks, 1)), mode: 'memory', received: 0 }
      }

      incoming.current[msg.id] = transfer
      setIncomingMeta({ name: msg.name, size: msg.size, totalChunks: msg.totalChunks })
      setRecvProgress(0)

    // ── Chunk geldi ────────────────────────────────────────────────────────
    } else if (msg.type === 'FILE_CHUNK') {
      const t = incoming.current[msg.id]
      if (!t) return
      const buf = base64ToBuf(msg.data)

      if (t.mode === 'opfs') {
        await t.writable.write(buf) // diske yaz, RAM'den düşür
      } else {
        t.chunks[msg.index] = buf
      }

      t.received++
      setRecvProgress(Math.round((t.received / Math.max(t.meta.totalChunks, 1)) * 100))

    // ── Transfer bitti ────────────────────────────────────────────────────
    } else if (msg.type === 'FILE_END') {
      const t = incoming.current[msg.id]
      if (!t) return

      let url
      if (t.mode === 'opfs') {
        await t.writable.close()
        const file = await t.fileHandle.getFile()
        url = URL.createObjectURL(file) // tarayıcı büyük dosyaları stream eder
      } else {
        const blob = new Blob(t.chunks, { type: t.meta.mime || 'application/octet-stream' })
        url = URL.createObjectURL(blob)
      }

      setReceivedFiles(prev => [...prev, { name: t.meta.name, size: t.meta.size, url }])
      setIncomingMeta(null)
      setRecvProgress(0)
      delete incoming.current[msg.id]
    }

  }, [])

  useEffect(() => {
    onRegisterHandler(handleMessage)
  }, [handleMessage, onRegisterHandler])

  // ── Gönderim ─────────────────────────────────────────────────────────────
  async function sendFile(file) {
    if (!dcReady || !dcRef.current || sending) return
    const dc = dcRef.current

    setSending(true)
    setSendingName(file.name)
    setSendProgress(0)
    setSendError('')

    try {
      const id          = crypto.randomUUID()
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1

      await send({ type: 'FILE_START', id, name: file.name, size: file.size, totalChunks, mime: file.type })

      for (let i = 0; i < totalChunks; i++) {
        // Backpressure: DataChannel buffer doluyorsa bekle
        while (dc.bufferedAmount > 8 * CHUNK_SIZE) {
          await new Promise(r => setTimeout(r, 10))
        }
        const slice = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        const buf   = await slice.arrayBuffer()
        await send({ type: 'FILE_CHUNK', id, index: i, data: bufToBase64(buf) })
        // Kesirli ilerleme — büyük dosyalarda 0%'de kalmaz
        setSendProgress(((i + 1) / totalChunks) * 100)
      }

      await send({ type: 'FILE_END', id })
    } catch (err) {
      setSendError(err?.message || 'Dosya gönderilemedi.')
    } finally {
      setSending(false)
      setSendingName('')
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    setSendError('')

    // Klasör kontrolü
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

  function fmt(bytes) {
    if (bytes < 1024)        return `${bytes} B`
    if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`
    return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  }

  const off = !dcReady || sending

  return (
    <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-4">
      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Dosya Transferi</p>

      {/* Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); if (!off) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={off ? (e) => e.preventDefault() : handleDrop}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 text-center transition-colors select-none
          ${off
            ? 'border-gray-700 opacity-40 cursor-not-allowed'
            : dragOver
            ? 'border-emerald-400 bg-emerald-950 cursor-copy'
            : 'border-gray-700 hover:border-gray-500 cursor-pointer'
          }`}
      >
        <input type="file" className="hidden" onChange={handleInput} disabled={off} />
        {sending ? (
          <span className="text-gray-400 text-sm">Gönderiliyor...</span>
        ) : dcReady ? (
          <>
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-gray-300 text-sm">Dosyayı sürükle veya tıkla</span>
          </>
        ) : (
          <span className="text-gray-600 text-sm">Bağlantı bekleniyor...</span>
        )}
      </label>

      {/* Hata */}
      {sendError && (
        <p className="text-red-400 text-xs px-1">{sendError}</p>
      )}

      {/* Gönderim ilerlemesi */}
      {sending && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-gray-400">
            <span className="truncate max-w-[75%]">↑ {sendingName}</span>
            <span>{sendProgress.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-75" style={{ width: `${sendProgress}%` }} />
          </div>
        </div>
      )}

      {/* Alım ilerlemesi */}
      {incomingMeta && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-gray-400">
            <span className="truncate max-w-[75%]">↓ {incomingMeta.name}</span>
            <span>{recvProgress}%</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-75" style={{ width: `${recvProgress}%` }} />
          </div>
        </div>
      )}

      {/* Alınan dosyalar */}
      {receivedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Alınan Dosyalar</p>
          {receivedFiles.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5 gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-sm text-white truncate">{f.name}</span>
                <span className="text-xs text-gray-500">{fmt(f.size)}</span>
              </div>
              <a
                href={f.url}
                download={f.name}
                className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                İndir
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
