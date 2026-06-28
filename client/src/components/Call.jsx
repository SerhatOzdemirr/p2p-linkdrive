// components/Call.jsx — sesli/görüntülü arama UI
import { useRef, useEffect } from 'react'

// srcObject'i ref ile bağlayan medya kutusu
function MediaTile({ stream, muted, label, mirror, showVideo }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream || null
    }
  }, [stream])

  return (
    <div className="relative w-full bg-gray-900 dark:bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`w-full h-full object-cover ${showVideo ? '' : 'hidden'} ${mirror ? 'scale-x-[-1]' : ''}`}
      />
      {!showVideo && (
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <span className="text-4xl">🎙️</span>
          <span className="text-xs">Sesli</span>
        </div>
      )}
      <span className="absolute bottom-1.5 left-2 text-[11px] text-white/90 bg-black/40 px-1.5 py-0.5 rounded">
        {label}
      </span>
    </div>
  )
}

export default function Call({
  dcReady,
  callState, withVideo, muted, camOff, localStream, remoteStream, error,
  startCall, acceptCall, declineCall, endCall, toggleMute, toggleCam,
}) {
  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Arama</p>

      {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}

      {/* IDLE — arama başlat */}
      {callState === 'idle' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <span className="text-4xl">📞</span>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {dcReady ? 'Karşı tarafı ara' : 'Bağlantı bekleniyor...'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => startCall(false)}
              disabled={!dcReady}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              🎙️ Sesli Ara
            </button>
            <button
              onClick={() => startCall(true)}
              disabled={!dcReady}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              📹 Görüntülü Ara
            </button>
          </div>
        </div>
      )}

      {/* CALLING — aranıyor */}
      {callState === 'calling' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <span className="text-4xl animate-pulse">📞</span>
          <p className="text-sm text-gray-600 dark:text-gray-300">Aranıyor…</p>
          <button onClick={endCall} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors">
            İptal
          </button>
        </div>
      )}

      {/* INCOMING — gelen arama */}
      {callState === 'incoming' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <span className="text-4xl animate-bounce">{withVideo ? '📹' : '🎙️'}</span>
          <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">
            Gelen {withVideo ? 'görüntülü' : 'sesli'} arama
          </p>
          <div className="flex gap-2">
            <button onClick={declineCall} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors">
              Reddet
            </button>
            <button onClick={acceptCall} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors">
              Kabul Et
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE — görüşme */}
      {callState === 'active' && (
        <div className="flex flex-col gap-3">
          {/* Uzak büyük, yerel küçük */}
          <div className="relative">
            <MediaTile
              stream={remoteStream}
              muted={false}
              label="Karşı taraf"
              showVideo={withVideo}
            />
            {withVideo && (
              <div className="absolute bottom-2 right-2 w-1/3 max-w-[140px] rounded-lg overflow-hidden border-2 border-white/70 shadow-lg">
                <MediaTile
                  stream={localStream}
                  muted={true}
                  label="Sen"
                  mirror
                  showVideo={withVideo && !camOff}
                />
              </div>
            )}
          </div>

          {/* Kontroller */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={toggleMute}
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                muted ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {muted ? '🔇 Sessiz' : '🎙️ Açık'}
            </button>
            {withVideo && (
              <button
                onClick={toggleCam}
                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  camOff ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {camOff ? '📷 Kapalı' : '📹 Açık'}
              </button>
            )}
            <button onClick={endCall} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors">
              📞 Bitir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
