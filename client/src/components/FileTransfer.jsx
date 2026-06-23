// components/FileTransfer.jsx — pure UI
import { useState } from 'react'
import { isEditable } from '../hooks/useDocEditor.js'
import { isHeicName, convertAndDownload } from '../core/heic.js'
function fmtBytes(bytes) {
  if (bytes < 1024)      return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function fmtEta(sec) {
  if (!isFinite(sec) || sec <= 0) return ''
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m > 0 ? `${m}dk ${s}sn` : `${s}sn`
}

function FileIcon({ mime, name }) {
  if (isHeicName(name))                                    return <span className="text-3xl">📷</span>
  if (mime?.startsWith('image/'))                          return <span className="text-3xl">🖼️</span>
  if (mime?.startsWith('video/'))                          return <span className="text-3xl">🎬</span>
  if (mime === 'application/pdf')                          return <span className="text-3xl">📄</span>
  if (mime?.startsWith('audio/'))                          return <span className="text-3xl">🎵</span>
  if (mime?.includes('zip') || mime?.includes('rar'))      return <span className="text-3xl">📦</span>
  return <span className="text-3xl">📎</span>
}

// Alınan tek dosya satırı — HEIC için JPG/PNG çevir-indir
function ReceivedFileRow({ f, onEditFile }) {
  const [converting, setConverting] = useState(null) // 'jpg' | 'png' | null
  const heic = isHeicName(f.name)

  async function convert(toType, label) {
    setConverting(label)
    try { await convertAndDownload(f.url, f.name, toType) }
    catch { /* dönüştürme başarısız */ }
    finally { setConverting(null) }
  }

  return (
    <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2.5">
      <PreviewThumb previewUrl={f.previewUrl} mime={f.mime} name={f.name} size="sm" />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm text-gray-900 dark:text-white truncate">{f.name}</span>
        <span className="text-xs text-gray-500">{fmtBytes(f.size)}</span>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {heic ? (
          <>
            <button
              onClick={() => convert('image/jpeg', 'jpg')}
              disabled={!!converting}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {converting === 'jpg' ? '…' : 'JPG'}
            </button>
            <button
              onClick={() => convert('image/png', 'png')}
              disabled={!!converting}
              className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              {converting === 'png' ? '…' : 'PNG'}
            </button>
            <a href={f.url} download={f.name} className="px-2.5 py-1.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-white text-xs font-semibold rounded-lg transition-colors">
              HEIC
            </a>
          </>
        ) : (
          <>
            {isEditable(f.name, f.size) && (
              <button
                onClick={() => onEditFile(f.name, f.url)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Düzenle
              </button>
            )}
            <a href={f.url} download={f.name} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors">
              İndir
            </a>
          </>
        )}
      </div>
    </div>
  )
}

// Kompakt grid hücresi — çok dosya olunca isim gizli, yan yana
function ReceivedFileCell({ f }) {
  const [converting, setConverting] = useState(null)
  const heic = isHeicName(f.name)

  async function convert(toType, label) {
    setConverting(label)
    try { await convertAndDownload(f.url, f.name, toType) }
    catch {}
    finally { setConverting(null) }
  }

  return (
    <div className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800" title={f.name}>
      {f.previewUrl
        ? <img src={f.previewUrl} alt={f.name} className="w-full h-full object-cover" />
        : <div className="w-full h-full flex items-center justify-center"><FileIcon mime={f.mime} name={f.name} /></div>
      }
      {/* Hover overlay — indirme butonları */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
        {heic ? (
          <>
            <button onClick={() => convert('image/jpeg', 'jpg')} disabled={!!converting}
              className="w-full py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-bold rounded">
              {converting === 'jpg' ? '…' : 'JPG'}
            </button>
            <button onClick={() => convert('image/png', 'png')} disabled={!!converting}
              className="w-full py-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[10px] font-bold rounded">
              {converting === 'png' ? '…' : 'PNG'}
            </button>
            <a href={f.url} download={f.name}
              className="w-full py-1 bg-gray-400 hover:bg-gray-300 text-gray-900 text-[10px] font-bold rounded text-center">
              HEIC
            </a>
          </>
        ) : (
          <a href={f.url} download={f.name}
            className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded text-center">
            İndir
          </a>
        )}
      </div>
    </div>
  )
}

function PreviewThumb({ previewUrl, mime, name, size = 'md' }) {
  const dim = size === 'sm' ? 'w-16 h-16' : 'w-full max-h-52'
  if (previewUrl) {
    return (
      <img src={previewUrl} alt="önizleme" className={`${dim} object-contain rounded-lg bg-gray-100 dark:bg-gray-950`} />
    )
  }
  return (
    <div className={`${dim} flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-950`}>
      <FileIcon mime={mime} name={name} />
    </div>
  )
}

export default function FileTransfer({
  dcReady,
  sending, sendProgress, sendingName, sendError, sendSpeed, sendEta,
  waitingAccept, queuedFiles,
  pendingFiles, receivedFiles,
  incomingMeta, recvProgress, recvSpeed, recvEta,
  dragOver, setDragOver,
  resumeRequest,
  handleDrop, handleInput, handleResumeFile,
  cancelTransfer, dismissResume,
  acceptFile, declineFile, acceptAll, autoAccept, disableAutoAccept, removeFromQueue,
  onEditFile,
}) {
  const off = !dcReady || sending || !!waitingAccept

  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Dosya Transferi</p>

      {/* Resume talebi */}
      {resumeRequest && (
        <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-300 dark:border-yellow-800 rounded-xl p-3 flex flex-col gap-2">
          <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">Yarıda kalan transfer</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <span className="text-gray-900 dark:text-white">{resumeRequest.name}</span>
            {' '}— {resumeRequest.fromChunk}/{resumeRequest.totalChunks} chunk tamamlandı. Aynı dosyayı seç.
          </p>
          <div className="flex gap-2">
            <label className="cursor-pointer px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors">
              Dosya Seç
              <input type="file" className="hidden" onChange={handleResumeFile} />
            </label>
            <button onClick={dismissResume} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white text-xs font-semibold rounded-lg transition-colors">
              Sil
            </button>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <label
        onDragOver={(e) => { e.preventDefault(); if (!off) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={off ? (e) => e.preventDefault() : handleDrop}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 text-center transition-colors select-none
          ${off
            ? 'border-gray-300 dark:border-gray-700 opacity-40 cursor-not-allowed'
            : dragOver
            ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950 cursor-copy'
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer'
          }`}
      >
        <input type="file" multiple className="hidden" onChange={handleInput} disabled={off} />
        {sending ? (
          <span className="text-gray-500 dark:text-gray-400 text-sm">Gönderiliyor...</span>
        ) : waitingAccept ? (
          <span className="text-gray-500 dark:text-gray-400 text-sm">Karşı taraf inceliyor...</span>
        ) : dcReady ? (
          <>
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-gray-600 dark:text-gray-300 text-sm">Dosyayı sürükle veya tıkla</span>
          </>
        ) : (
          <span className="text-gray-400 dark:text-gray-600 text-sm">Bağlantı bekleniyor...</span>
        )}
      </label>

      {sendError && <p className="text-red-500 dark:text-red-400 text-xs px-1">{sendError}</p>}

      {/* Gönderen: kabul bekleniyor */}
      {waitingAccept && (
        <div className="flex flex-col gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-3">
          <div className="flex items-center gap-3">
            <PreviewThumb previewUrl={waitingAccept.previewUrl} mime={null} size="sm" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm text-gray-900 dark:text-white truncate">{waitingAccept.name}</span>
              <span className="text-xs text-yellow-600 dark:text-yellow-400">Karşı tarafın onayı bekleniyor…</span>
            </div>
          </div>
          <button onClick={cancelTransfer} className="self-end text-xs text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300 transition-colors">
            İptal
          </button>
        </div>
      )}

      {/* Gönderim ilerlemesi */}
      {sending && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="truncate max-w-[55%]">↑ {sendingName}</span>
            <span className="shrink-0 text-right">{fmtBytes(sendSpeed)}/s{sendEta > 0 && ` — ${fmtEta(sendEta)} kaldı`}</span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-75" style={{ width: `${sendProgress}%` }} />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400 dark:text-gray-500">{sendProgress.toFixed(1)}%</span>
            <button onClick={cancelTransfer} className="text-xs text-red-500 dark:text-red-400 hover:text-red-400 dark:hover:text-red-300 transition-colors">İptal</button>
          </div>
        </div>
      )}

      {/* Gönderme kuyruğu */}
      {queuedFiles.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Sırada ({queuedFiles.length})
          </p>
          {queuedFiles.map(({ uid, file }) => (
            <div key={uid} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2">
              <span className="text-sm text-gray-900 dark:text-white truncate flex-1">{file.name}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{fmtBytes(file.size)}</span>
              <button
                onClick={() => removeFromQueue(uid)}
                className="shrink-0 text-gray-400 hover:text-red-400 dark:hover:text-red-400 transition-colors text-xs leading-none"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Auto-accept aktif göstergesi */}
      {autoAccept && (
        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              Otomatik kabul açık — gelen dosyalar sırayla indiriliyor
            </span>
          </div>
          <button
            onClick={disableAutoAccept}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Alıcı: gelen dosyalar (onay bekliyor) */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Gelen Dosya</p>
            {pendingFiles.length >= 1 && (
              <button
                onClick={acceptAll}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Tümünü Kabul Et ↓
              </button>
            )}
          </div>
          {pendingFiles.map(f => (
            <div key={f.id} className="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden">
              <div className="w-full bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-2 min-h-[80px]">
                {f.previewUrl ? (
                  <img src={f.previewUrl} alt="önizleme" className="max-h-52 max-w-full object-contain rounded" />
                ) : (
                  <div className="flex flex-col items-center gap-1 py-3">
                    <FileIcon mime={f.mime} />
                    <span className="text-xs text-gray-400 dark:text-gray-600">Önizleme yükleniyor…</span>
                  </div>
                )}
              </div>
              <div className="p-3 flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-gray-900 dark:text-white font-medium truncate">{f.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">{fmtBytes(f.size)}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => declineFile(f.id)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white text-xs font-semibold rounded-lg transition-colors">
                    Reddet
                  </button>
                  <button onClick={() => acceptFile(f.id)} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors">
                    İndir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* /pending files */}

      {/* Alım ilerlemesi */}
      {incomingMeta && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="truncate max-w-[55%]">↓ {incomingMeta.name}</span>
            <span className="shrink-0 text-right">
              {recvSpeed > 0
                ? `${fmtBytes(recvSpeed)}/s${recvEta > 0 ? ` — ${fmtEta(recvEta)} kaldı` : ''}`
                : 'Başlatılıyor…'}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            {recvProgress > 0
              ? <div className="h-full bg-blue-500 transition-all duration-75" style={{ width: `${recvProgress}%` }} />
              : <div className="h-full w-1/3 bg-blue-400 animate-pulse rounded-full" />
            }
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {recvProgress > 0 ? `${recvProgress.toFixed(1)}%` : `${fmtBytes(incomingMeta.size)}`}
            </span>
            {recvSpeed > 0 && recvProgress > 0 && (
              <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">
                {fmtBytes(incomingMeta.size * recvProgress / 100)} / {fmtBytes(incomingMeta.size)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Alınan dosyalar */}
      {receivedFiles.length > 0 && (() => {
        const hasHeic   = receivedFiles.some(f => isHeicName(f.name))
        const gridMode  = receivedFiles.length > 4   // çok dosya → isimsiz grid

        const downloadAll = () => {
          receivedFiles.forEach((f, i) => {
            setTimeout(() => {
              const a = document.createElement('a')
              a.href = f.url
              a.download = f.name
              a.click()
            }, i * 200)
          })
        }
        const convertAll = async (toType) => {
          for (const f of receivedFiles) {
            if (isHeicName(f.name)) {
              try { await convertAndDownload(f.url, f.name, toType) } catch {}
            }
          }
        }

        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Alınan Dosyalar ({receivedFiles.length})
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {hasHeic && (
                  <>
                    <button onClick={() => convertAll('image/jpeg')}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
                      Tümünü JPG
                    </button>
                    <button onClick={() => convertAll('image/png')}
                      className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors">
                      Tümünü PNG
                    </button>
                  </>
                )}
                {receivedFiles.length > 1 && (
                  <button onClick={downloadAll}
                    className="px-2.5 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white text-xs font-semibold rounded-lg transition-colors">
                    {hasHeic ? 'Tümünü HEIC' : 'Tümünü İndir ↓'}
                  </button>
                )}
              </div>
            </div>

            {gridMode ? (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {receivedFiles.map((f, i) => <ReceivedFileCell key={i} f={f} />)}
              </div>
            ) : (
              receivedFiles.map((f, i) => (
                <ReceivedFileRow key={i} f={f} onEditFile={onEditFile} />
              ))
            )}
          </div>
        )
      })()}
    </div>
  )
}
