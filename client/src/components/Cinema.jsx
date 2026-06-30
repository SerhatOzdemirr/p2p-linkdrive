// components/Cinema.jsx — beraber izleme (ekran/sekme paylaşımı) + sinema ambiyansı
import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { IconFilm, IconStop, IconScreen, IconMaximize, IconMinimize } from './icons.jsx'

export default function Cinema({
  dcReady,
  mode, movieName, localStream, remoteStream, error,
  startShare, stopShare,
}) {
  const videoRef = useRef(null)
  const fsRef    = useRef(null)
  const [isFs, setIsFs] = useState(false)

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const stream = mode === 'host' ? localStream : remoteStream
  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream || null
    }
  }, [stream])

  function toggleFullscreen() {
    if (!document.fullscreenElement) fsRef.current?.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.()
  }

  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <IconFilm width={14} height={14} /> Sinema
        </p>
        {mode !== 'idle' && (
          <button onClick={stopShare} className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 hover:text-red-400 transition-colors">
            <IconStop width={14} height={14} /> Bitir
          </button>
        )}
      </div>

      {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}

      {/* IDLE — paylaşım başlat */}
      {mode === 'idle' && (
        <div className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-950 flex items-center justify-center text-violet-600 dark:text-violet-400">
            <IconFilm width={26} height={26} />
          </div>
          <button
            onClick={startShare}
            disabled={!dcReady}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <IconScreen width={18} height={18} /> Ekran / Sekme Paylaş
          </button>
          <span className="text-xs text-gray-400 dark:text-gray-600 max-w-xs">
            YouTube vb. açtığın sekmeyi seç — <b>“Sekme sesini paylaş”</b> işaretle, karşı taraf seninle izler.
          </span>
        </div>
      )}

      {/* İZLEME — sinema salonu ambiyansı (tam ekranda da) */}
      {mode !== 'idle' && (
        <div
          ref={fsRef}
          className={`relative overflow-hidden flex flex-col items-center justify-center bg-gradient-to-b from-[#1a0e0e] via-black to-[#0a0a12] ${
            isFs ? 'fixed inset-0 z-50 p-8 pt-12' : 'rounded-2xl p-5 pt-9'
          }`}
        >
          {/* Üst perde (kırmızı kadife saçak) */}
          <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-red-900 to-red-950/0 pointer-events-none ${isFs ? 'h-12' : 'h-6'}`}
            style={{ maskImage: 'repeating-linear-gradient(90deg,#000 0 14px,transparent 14px 16px)', WebkitMaskImage: 'repeating-linear-gradient(90deg,#000 0 14px,transparent 14px 16px)' }} />
          {/* Yan perdeler */}
          <div className={`absolute top-0 bottom-0 left-0 bg-gradient-to-r from-red-950 to-transparent pointer-events-none ${isFs ? 'w-20' : 'w-5'}`} />
          <div className={`absolute top-0 bottom-0 right-0 bg-gradient-to-l from-red-950 to-transparent pointer-events-none ${isFs ? 'w-20' : 'w-5'}`} />
          {/* Şimdi oynatılıyor marquee */}
          <div className={`absolute left-0 right-0 flex justify-center pointer-events-none ${isFs ? 'top-3' : 'top-1.5'}`}>
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`tracking-[0.3em] text-amber-300/90 font-semibold uppercase ${isFs ? 'text-sm' : 'text-[10px]'}`}
            >
              🍿 Şimdi Oynatılıyor 🍿
            </motion.span>
          </div>

          {/* Perde içinde ekran — sıcak ışık halesi */}
          <div className={`relative rounded-lg overflow-hidden shadow-[0_0_70px_-5px_rgba(0,0,0,0.9)] ring-1 ring-white/10 ${
            isFs ? 'max-h-full max-w-full' : 'w-full'
          }`}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={mode === 'host'}
              controls={mode === 'guest'}
              className={`bg-black ${isFs ? 'max-h-[calc(100vh-7rem)] max-w-full object-contain' : 'w-full block'}`}
            />
          </div>

          <button onClick={toggleFullscreen}
            className="absolute top-2 right-2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur transition-colors">
            {isFs ? <IconMinimize /> : <IconMaximize />}
          </button>

          <p className={`text-amber-200/50 text-center ${isFs ? 'text-xs mt-4' : 'text-[11px] mt-3'}`}>
            {mode === 'host' ? '🎬 Paylaşıyorsun — karşı taraf izliyor' : '🎬 Karşı taraf oynatıyor — keyifli seyirler'}
          </p>
        </div>
      )}
    </div>
  )
}
