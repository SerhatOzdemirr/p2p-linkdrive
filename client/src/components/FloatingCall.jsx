// components/FloatingCall.jsx — başka sekmedeyken sağ altta küçük arama penceresi
import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

export default function FloatingCall({ remoteStream, withVideo, onExpand, onEnd }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== remoteStream) {
      ref.current.srcObject = remoteStream || null
    }
  }, [remoteStream])

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed bottom-4 right-4 z-40 w-48 rounded-2xl overflow-hidden shadow-2xl bg-black border border-gray-700 cursor-grab active:cursor-grabbing"
    >
      <div className="relative aspect-video bg-black flex items-center justify-center">
        <video
          ref={ref}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${withVideo ? '' : 'hidden'}`}
        />
        {!withVideo && (
          <div className="flex flex-col items-center gap-1 text-gray-300">
            <span className="text-2xl">🎙️</span>
            <span className="text-[11px]">Görüşme sürüyor</span>
          </div>
        )}
        <span className="absolute top-1.5 left-2 flex items-center gap-1 text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Canlı
        </span>
      </div>
      <div className="flex">
        <button
          onClick={onExpand}
          className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold transition-colors"
        >
          ⤢ Genişlet
        </button>
        <button
          onClick={onEnd}
          className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
        >
          📞 Bitir
        </button>
      </div>
    </motion.div>
  )
}
