// pages/Room.jsx — WebRTC bağlantı kurma ve test
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { connectSocket, disconnectSocket } from '../core/signalling.js'
import { PeerConnection } from '../core/webrtc.js'
import { deriveKey } from '../core/crypto.js'
import ShareLink from '../components/ShareLink.jsx'
import ConnectionStatus from '../components/ConnectionStatus.jsx'
import MessageTest from '../components/MessageTest.jsx'

export default function Room() {
  const { roomId }         = useParams()
  const secretKey          = window.location.hash.slice(1)

  const [role, setRole]            = useState(null)        // 'host' | 'guest'
  const [connState, setConnState]  = useState('idle')      // idle|connecting|connected|failed
  const [dcReady, setDcReady]      = useState(false)
  const [messages, setMessages]    = useState([])
  const [socketErr, setSocketErr]  = useState(null)

  const peerRef   = useRef(null)
  const cryptoKey = useRef(null)
  const socketRef = useRef(null)

  const addMsg = useCallback((text, from = 'system') => {
    setMessages((prev) => [...prev, { text, from, ts: Date.now() }])
  }, [])

  // DataChannel mesajı gelince
  const handleDCMessage = useCallback((e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'PING') {
        addMsg(`← PING alındı: "${msg.text}"`, 'peer')
        // Otomatik PONG
        peerRef.current?.dc?.send(JSON.stringify({ type: 'PONG', text: msg.text }))
      } else if (msg.type === 'PONG') {
        addMsg(`← PONG: "${msg.text}"`, 'peer')
      } else {
        addMsg(`← ${JSON.stringify(msg)}`, 'peer')
      }
    } catch {
      addMsg(`← (binary: ${e.data.byteLength ?? '?'} bytes)`, 'peer')
    }
  }, [addMsg])

  // DataChannel açıldı
  const handleDCOpen = useCallback((dc) => {
    dc.onmessage = handleDCMessage
    dc.onclose   = () => { setDcReady(false); addMsg('DataChannel kapandı.') }
    dc.onopen    = () => { setDcReady(true);  addMsg('✓ DataChannel açık — bağlantı hazır!', 'system') }
    if (dc.readyState === 'open') {
      setDcReady(true)
      addMsg('✓ DataChannel açık — bağlantı hazır!', 'system')
    }
  }, [handleDCMessage, addMsg])

  useEffect(() => {
    if (!secretKey) { setSocketErr('URL\'de şifreleme anahtarı yok (#key kısmı eksik).'); return }

    let isMounted = true

    async function init() {
      // AES key türet
      try {
        cryptoKey.current = await deriveKey(secretKey)
        addMsg('✓ AES-GCM 256-bit anahtar türetildi.')
      } catch {
        setSocketErr('Geçersiz şifreleme anahtarı.')
        return
      }

      const socket = connectSocket()
      socketRef.current = socket

      // ── Socket event handlers ───────────────────────────────────────────
      socket.on('connect', () => {
        if (!isMounted) return
        addMsg(`✓ Sunucuya bağlandı. (${socket.id.slice(0, 8)}...)`)
        // İlk bağlanan → oda oluştur (host)
        socket.emit('create_room', { roomId })
      })

      socket.on('room_created', () => {
        if (!isMounted) return
        setRole('host')
        setConnState('waiting')
        addMsg('✓ Oda oluşturuldu. Guest bekleniyor...')
      })

      socket.on('peer_joined', async ({ peerCount }) => {
        if (!isMounted) return
        addMsg(`✓ Peer katıldı (toplam: ${peerCount}).`)

        if (peerCount === 2 && role === 'host') {
          // Host: offer oluştur
          setConnState('connecting')
          const offer = await peerRef.current.createOffer()
          socket.emit('offer', { roomId, offer })
          addMsg('→ Offer gönderildi.')
        }
      })

      socket.on('offer', async ({ offer }) => {
        if (!isMounted) return
        setRole('guest')
        setConnState('connecting')
        addMsg('← Offer alındı. Answer üretiliyor...')
        const answer = await peerRef.current.handleOffer(offer)
        socket.emit('answer', { roomId, answer })
        addMsg('→ Answer gönderildi.')
      })

      socket.on('answer', async ({ answer }) => {
        if (!isMounted) return
        addMsg('← Answer alındı.')
        await peerRef.current.handleAnswer(answer)
      })

      socket.on('ice_candidate', async ({ candidate }) => {
        if (!isMounted) return
        await peerRef.current.addIceCandidate(candidate)
      })

      socket.on('peer_left', () => {
        if (!isMounted) return
        addMsg('⚠ Karşı taraf ayrıldı.')
        setConnState('idle')
        setDcReady(false)
      })

      socket.on('error', ({ code }) => {
        if (!isMounted) return
        if (code === 'ROOM_FULL') {
          setSocketErr('Oda dolu (maks. 2 kişi).')
        } else if (code === 'ROOM_NOT_FOUND') {
          // Guest: oda yok → join dene
          socket.emit('join_room', { roomId })
        }
      })

      socket.on('connect_error', (err) => {
        setSocketErr(`Sunucuya bağlanılamadı: ${err.message}`)
      })

      // ── PeerConnection ──────────────────────────────────────────────────
      const peer = new PeerConnection({
        onDataChannel: handleDCOpen,
        onConnectionChange: (state) => {
          if (!isMounted) return
          setConnState(state)
          addMsg(`⟳ Bağlantı durumu: ${state}`)
        },
        onIceCandidate: (candidate) => {
          socket.emit('ice_candidate', { roomId, candidate })
        },
      })
      peerRef.current = peer

      // Guest tarafı: odaya katılmayı dene
      // (host zaten create_room emit etti; guest join_room dener)
      socket.on('connect', () => {
        // İlk connect'te create_room emit edildi.
        // Eğer oda yoksa ROOM_NOT_FOUND gelir → join_room emit edilir.
      })

      // Guest olarak join dene (room_created gelmezse)
      setTimeout(() => {
        if (!isMounted) return
        if (!role) {
          socket.emit('join_room', { roomId })
          setRole('guest')
          addMsg('→ Odaya katılmaya çalışılıyor...')
        }
      }, 500)

      // Guest: DataChannel'ı Host açar, guest ondatachannel ile yakalar.
      // Host: DataChannel'ı kendisi açar.
      if (role === 'host') {
        peer.createDataChannel('linkdrive')
      }
    }

    init()

    return () => {
      isMounted = false
      peerRef.current?.close()
      disconnectSocket()
    }
  }, [roomId, secretKey]) // eslint-disable-line

  // Host DataChannel'ı peer_joined sonrası açmalı
  useEffect(() => {
    if (role === 'host' && peerRef.current && !peerRef.current.dc) {
      peerRef.current.createDataChannel('linkdrive')
    }
  }, [role])

  if (socketErr) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-red-950 border border-red-800 rounded-2xl p-6 max-w-md w-full text-center">
          <p className="text-red-400 font-semibold mb-2">Hata</p>
          <p className="text-gray-300 text-sm">{socketErr}</p>
          <a href="/" className="mt-4 inline-block text-emerald-400 text-sm hover:underline">← Ana sayfa</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 gap-6 max-w-2xl mx-auto">

      <div className="w-full flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">
          P2P <span className="text-emerald-400">LinkDrive</span>
          {role && <span className="ml-2 text-sm font-normal text-gray-400">({role})</span>}
        </h1>
        <a href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">✕ Çık</a>
      </div>

      <ConnectionStatus state={connState} dcReady={dcReady} />

      {role === 'host' && <ShareLink roomId={roomId} secretKey={secretKey} />}

      <MessageTest
        dcReady={dcReady}
        messages={messages}
        onSend={(text) => {
          peerRef.current?.dc?.send(JSON.stringify({ type: 'PING', text }))
          addMsg(`→ PING gönderildi: "${text}"`, 'self')
        }}
      />

    </div>
  )
}
