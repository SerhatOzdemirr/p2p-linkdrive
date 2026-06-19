// components/FileTransfer.jsx — pure UI
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

function FileIcon({ mime }) {
  if (mime?.startsWith('video/'))                          return <span className="text-3xl">🎬</span>
  if (mime === 'application/pdf')                          return <span className="text-3xl">📄</span>
  if (mime?.startsWith('audio/'))                          return <span className="text-3xl">🎵</span>
  if (mime?.includes('zip') || mime?.includes('rar'))      return <span className="text-3xl">📦</span>
  return <span className="text-3xl">📎</span>
}

function PreviewThumb({ previewUrl, mime, size = 'md' }) {
  const dim = size === 'sm' ? 'w-16 h-16' : 'w-full max-h-52'
  if (previewUrl) {
    return (
      <img src={previewUrl} alt="önizleme" className={`${dim} object-contain rounded-lg bg-gray-100 dark:bg-gray-950`} />
    )
  }
  return (
    <div className={`${dim} flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-950`}>
      <FileIcon mime={mime} />
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
  acceptFile, declineFile, removeFromQueue,
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

      {/* Alıcı: gelen dosyalar (onay bekliyor) */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Gelen Dosya</p>
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

      {/* Alım ilerlemesi */}
      {incomingMeta && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="truncate max-w-[55%]">↓ {incomingMeta.name}</span>
            <span className="shrink-0 text-right">{fmtBytes(recvSpeed)}/s{recvEta > 0 && ` — ${fmtEta(recvEta)} kaldı`}</span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-75" style={{ width: `${recvProgress}%` }} />
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500">{recvProgress.toFixed(1)}%</span>
        </div>
      )}

      {/* Alınan dosyalar */}
      {receivedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider">Alınan Dosyalar</p>
          {receivedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2.5">
              <PreviewThumb previewUrl={f.previewUrl} mime={f.mime} size="sm" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm text-gray-900 dark:text-white truncate">{f.name}</span>
                <span className="text-xs text-gray-500">{fmtBytes(f.size)}</span>
              </div>
              <a href={f.url} download={f.name} className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors">
                İndir
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
