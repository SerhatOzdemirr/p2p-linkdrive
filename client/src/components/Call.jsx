// components/Call.jsx — sesli/görüntülü arama UI (modern SVG ikonlar)
import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  IconMic, IconMicOff, IconVideo, IconVideoOff,
  IconPhone, IconPhoneOff, IconScreen, IconMaximize, IconMinimize,
} from './icons.jsx'

function MediaTile({ stream, muted, label, mirror, showVideo, fill }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null
  }, [stream])

  return (
    <div className={`relative w-full ${fill ? 'h-full' : 'aspect-video'} bg-gray-900 dark:bg-black rounded-2xl overflow-hidden flex items-center justify-center`}>
      <video ref={ref} autoPlay playsInline muted={muted}
        className={`w-full h-full ${fill ? 'object-contain' : 'object-cover'} ${showVideo ? '' : 'hidden'} ${mirror ? 'scale-x-[-1]' : ''}`} />
      {!showVideo && (
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <div className="w-14 h-14 rounded-full bg-gray-700/50 flex items-center justify-center text-gray-300"><IconMic width={24} height={24} /></div>
          <span className="text-xs">Sesli</span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 text-[11px] text-white/90 bg-black/40 backdrop-blur px-2 py-0.5 rounded-full">{label}</span>
    </div>
  )
}

// Yuvarlak kontrol butonu
function CtrlBtn({ onClick, variant = 'gray', children, label }) {
  const map = {
    gray:   'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600',
    red:    'bg-red-600/90 hover:bg-red-600 text-white',
    blue:   'bg-blue-600 hover:bg-blue-500 text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
  }
  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={onClick} title={label}
      className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors shadow-sm ${map[variant]}`}>
      {children}
    </motion.button>
  )
}

export default function Call({
  dcReady,
  callState, withVideo, muted, camOff, sharing, localStream, remoteStream, error,
  startCall, acceptCall, declineCall, endCall, toggleMute, toggleCam, toggleScreenShare,
}) {
  const fsRef = useRef(null)
  const [isFs, setIsFs] = useState(false)

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  function toggleFullscreen() {
    if (!document.fullscreenElement) fsRef.current?.requestFullscreen?.().catch(() => {})
    else document.exitFullscreen?.()
  }

  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Arama</p>

      {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}

      {/* IDLE */}
      {callState === 'idle' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <IconPhone width={28} height={28} />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">{dcReady ? 'Karşı tarafı ara' : 'Bağlantı bekleniyor...'}</p>
          <div className="flex gap-3">
            <button onClick={() => startCall(false)} disabled={!dcReady}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
              <IconMic width={18} height={18} /> Sesli
            </button>
            <button onClick={() => startCall(true)} disabled={!dcReady}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
              <IconVideo width={18} height={18} /> Görüntülü
            </button>
          </div>
        </div>
      )}

      {/* CALLING */}
      {callState === 'calling' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
            className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <IconPhone width={28} height={28} />
          </motion.div>
          <p className="text-sm text-gray-600 dark:text-gray-300">Aranıyor…</p>
          <CtrlBtn onClick={endCall} variant="danger" label="İptal"><IconPhoneOff /></CtrlBtn>
        </div>
      )}

      {/* INCOMING */}
      {callState === 'incoming' && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 py-6">
          <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ repeat: Infinity, duration: 1 }}
            className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
            {withVideo ? <IconVideo width={28} height={28} /> : <IconMic width={28} height={28} />}
          </motion.div>
          <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">
            Gelen {withVideo ? 'görüntülü' : 'sesli'} arama
          </p>
          <div className="flex gap-4">
            <CtrlBtn onClick={declineCall} variant="danger" label="Reddet"><IconPhoneOff /></CtrlBtn>
            <motion.button onClick={acceptCall} whileTap={{ scale: 0.9 }}
              animate={{ boxShadow: ['0 0 0 0 rgba(16,185,129,0.5)', '0 0 0 12px rgba(16,185,129,0)'] }}
              transition={{ repeat: Infinity, duration: 1.3 }}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow">
              <IconPhone />
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* ACTIVE */}
      {callState === 'active' && (
        <div ref={fsRef} className={isFs ? 'fixed inset-0 z-50 bg-black flex flex-col' : 'flex flex-col gap-3'}>
          <div className={`relative ${isFs ? 'flex-1 min-h-0' : ''}`}>
            <MediaTile stream={remoteStream} muted={false} label="Karşı taraf" showVideo={withVideo} fill={isFs} />
            {withVideo && (
              <div className={`absolute rounded-xl overflow-hidden border-2 border-white/70 shadow-lg ${
                isFs ? 'bottom-24 right-4 w-44' : 'bottom-2 right-2 w-1/3 max-w-[140px]'}`}>
                <MediaTile stream={localStream} muted label="Sen" mirror showVideo={withVideo && !camOff} />
              </div>
            )}
            <button onClick={toggleFullscreen} title={isFs ? 'Çık' : 'Tam ekran'}
              className="absolute top-2 right-2 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur transition-colors">
              {isFs ? <IconMinimize /> : <IconMaximize />}
            </button>
          </div>

          {/* Kontrol çubuğu */}
          <div className={`flex items-center justify-center gap-3 ${
            isFs ? 'absolute bottom-6 left-0 right-0' : ''}`}>
            <CtrlBtn onClick={toggleMute} variant={muted ? 'red' : 'gray'} label={muted ? 'Sesi aç' : 'Sustur'}>
              {muted ? <IconMicOff /> : <IconMic />}
            </CtrlBtn>
            {withVideo && !sharing && (
              <CtrlBtn onClick={toggleCam} variant={camOff ? 'red' : 'gray'} label={camOff ? 'Kamerayı aç' : 'Kamerayı kapat'}>
                {camOff ? <IconVideoOff /> : <IconVideo />}
              </CtrlBtn>
            )}
            <CtrlBtn onClick={toggleScreenShare} variant={sharing ? 'blue' : 'gray'} label={sharing ? 'Paylaşımı durdur' : 'Ekran paylaş'}>
              <IconScreen />
            </CtrlBtn>
            <CtrlBtn onClick={endCall} variant="danger" label="Bitir"><IconPhoneOff /></CtrlBtn>
          </div>
        </div>
      )}
    </div>
  )
}
