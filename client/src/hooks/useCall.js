// hooks/useCall.js — sesli/görüntülü arama (native WebRTC, renegotiation DataChannel'dan)
import { useState, useRef, useCallback, useEffect } from 'react'

export function useCall({ dcReady, peerRef, sendEncrypted, registerMessageHandler }) {
  const [callState, setCallState]   = useState('idle') // idle | calling | incoming | active
  const [withVideo, setWithVideo]   = useState(false)
  const [muted, setMuted]           = useState(false)
  const [camOff, setCamOff]         = useState(false)
  const [localStream, setLocalStream]   = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [error, setError]           = useState('')

  const localStreamRef   = useRef(null)
  const incomingVideoRef = useRef(false)

  // Peer hazır olunca uzak track dinleyicisini bağla
  useEffect(() => {
    peerRef.current?.setOnTrack((e) => {
      if (e.streams[0]) setRemoteStream(e.streams[0])
    })
  }, [dcReady]) // eslint-disable-line

  async function getLocal(video) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video })
    localStreamRef.current = stream
    setLocalStream(stream)
    return stream
  }

  function cleanupLocal() {
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    setLocalStream(null)
  }

  function endCallLocal() {
    peerRef.current?.stopLocalTracks()
    cleanupLocal()
    setRemoteStream(null)
    setCallState('idle')
    setMuted(false)
    setCamOff(false)
  }

  // ── Aksiyonlar ────────────────────────────────────────────────────────────
  async function startCall(video) {
    if (!dcReady) return
    try {
      setError('')
      setWithVideo(video)
      await getLocal(video)                       // önce izin/medya al
      sendEncrypted({ type: 'CALL_REQUEST', video })
      setCallState('calling')
    } catch (err) {
      setError('Mikrofon/kamera erişilemedi: ' + (err?.message || ''))
      cleanupLocal()
    }
  }

  async function acceptCall() {
    try {
      setError('')
      const video = incomingVideoRef.current
      setWithVideo(video)
      const stream = await getLocal(video)
      peerRef.current.addLocalStream(stream)      // track ekle — caller offer üretecek
      sendEncrypted({ type: 'CALL_ACCEPT' })
      setCallState('active')
    } catch (err) {
      setError('Mikrofon/kamera erişilemedi: ' + (err?.message || ''))
      declineCall()
    }
  }

  function declineCall() {
    sendEncrypted({ type: 'CALL_END' })
    endCallLocal()
  }

  function endCall() {
    sendEncrypted({ type: 'CALL_END' })
    endCallLocal()
  }

  function toggleMute() {
    const t = localStreamRef.current?.getAudioTracks()[0]
    if (t) { t.enabled = !t.enabled; setMuted(!t.enabled) }
  }

  function toggleCam() {
    const t = localStreamRef.current?.getVideoTracks()[0]
    if (t) { t.enabled = !t.enabled; setCamOff(!t.enabled) }
  }

  // ── Sinyalleşme (DataChannel üzerinden) ────────────────────────────────────
  const handleMessage = useCallback(async (msg) => {
    const peer = peerRef.current
    if (!peer) return

    if (msg.type === 'CALL_REQUEST') {
      incomingVideoRef.current = msg.video
      setWithVideo(msg.video)
      setCallState('incoming')
    }
    else if (msg.type === 'CALL_ACCEPT') {
      // Karşı taraf kabul etti → caller track ekler + renegotiation offer üretir
      const stream = localStreamRef.current
      if (stream) peer.addLocalStream(stream)
      const offer = await peer.createRenegotiationOffer()
      sendEncrypted({ type: 'RTC_OFFER', sdp: offer })
      setCallState('active')
    }
    else if (msg.type === 'RTC_OFFER') {
      const answer = await peer.handleOffer(msg.sdp)
      sendEncrypted({ type: 'RTC_ANSWER', sdp: answer })
    }
    else if (msg.type === 'RTC_ANSWER') {
      await peer.handleAnswer(msg.sdp)
    }
    else if (msg.type === 'CALL_END') {
      endCallLocal()
    }
  }, []) // eslint-disable-line

  useEffect(() => {
    ['CALL_REQUEST', 'CALL_ACCEPT', 'RTC_OFFER', 'RTC_ANSWER', 'CALL_END']
      .forEach(t => registerMessageHandler(t, handleMessage))
  }, []) // eslint-disable-line

  return {
    callState, withVideo, muted, camOff, localStream, remoteStream, error,
    startCall, acceptCall, declineCall, endCall, toggleMute, toggleCam,
  }
}
