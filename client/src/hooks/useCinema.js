// hooks/useCinema.js — beraber izleme: ekran/sekme paylaşımı (YouTube vb.) WebRTC ile
import { useState, useRef, useCallback, useEffect } from 'react'

const CINEMA_BITRATE = 4 * 1000 * 1000 // 4 Mbps — akıcılık öncelikli (takılmasın)

export function useCinema({
  peerRef, sendEncrypted, registerMessageHandler,
  registerStreamRoute, unregisterStreamRoute,
}) {
  const [mode, setMode]           = useState('idle') // idle | host | guest
  const [movieName, setMovieName] = useState('')
  const [localStream, setLocalStream]   = useState(null) // host: paylaşılan önizleme
  const [remoteStream, setRemoteStream] = useState(null) // guest: gelen yayın
  const [error, setError]         = useState('')

  const shareStreamRef = useRef(null)
  const streamIdRef    = useRef(null)

  const handleMessage = useCallback((msg) => {
    if (msg.type === 'CINEMA_START') {
      streamIdRef.current = msg.streamId
      setMovieName(msg.name || 'İzleme')
      setMode('guest')
      registerStreamRoute(msg.streamId, (e) => setRemoteStream(e.streams[0]))
    }
    else if (msg.type === 'CINEMA_STOP') {
      if (streamIdRef.current) unregisterStreamRoute(streamIdRef.current)
      streamIdRef.current = null
      setRemoteStream(null)
      setMode('idle')
      setMovieName('')
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    registerMessageHandler('CINEMA_START', handleMessage)
    registerMessageHandler('CINEMA_STOP', handleMessage)
  }, []) // eslint-disable-line

  // ── Gönderen: ekran/sekme paylaş (YouTube sekmesi + sesi) ──────────────────
  async function startShare() {
    const peer = peerRef.current
    if (!peer) return
    try {
      setError('')
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, // film/müzik sesi bozulmasın
      })
      shareStreamRef.current = stream
      streamIdRef.current    = stream.id
      setLocalStream(stream)
      setMovieName('Ekran paylaşımı')
      setMode('host')

      await sendEncrypted({ type: 'CINEMA_START', streamId: stream.id, name: 'İzleme' })
      peer.addLocalStream(stream)
      const v = stream.getVideoTracks()[0]
      if (v) {
        v.contentHint = 'motion' // film/hareketli içerik → kodlayıcı buna göre ayarlar
        await peer.setTrackMaxBitrate(v, CINEMA_BITRATE)
        v.onended = () => stopShare() // tarayıcının "paylaşımı durdur"u
      }
      const offer = await peer.createRenegotiationOffer()
      await sendEncrypted({ type: 'RTC_OFFER', sdp: offer })
    } catch {
      setError('Paylaşım başlatılamadı.')
      setMode('idle')
    }
  }

  function stopShare() {
    const peer = peerRef.current
    shareStreamRef.current?.getTracks().forEach(t => t.stop())
    shareStreamRef.current = null
    peer?.stopLocalTracks()
    if (streamIdRef.current) sendEncrypted({ type: 'CINEMA_STOP', streamId: streamIdRef.current })
    streamIdRef.current = null
    setLocalStream(null)
    setMovieName('')
    setMode('idle')
  }

  return {
    mode, movieName, localStream, remoteStream, error,
    startShare, stopShare,
  }
}
