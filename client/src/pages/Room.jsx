// pages/Room.jsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { connectSocket, disconnectSocket } from '../core/signalling.js'
import { PeerConnection } from '../core/webrtc.js'
import { deriveKey } from '../core/crypto.js'
import ShareLink from '../components/ShareLink.jsx'
import ConnectionStatus from '../components/ConnectionStatus.jsx'
import MessageTest from '../components/MessageTest.jsx'

export default function Room() {
  const { roomId } = useParams()

  // Hash'i component mount anında bir kere oku ve sabitle
  // useRef kullanıyoruz çünkü render'lar arasında değişmemeli
  const secretKey = useRef(window.location.hash.slice(1))

  const [role, setRole]           = useState(null)
  const [connState, setConnState] = useState('idle')
  const [dcReady, setDcReady]     = useState(false)
  const [messages, setMessages]   = useState([])
  const [fatalErr, setFatalErr]   = useState(null)

  const peerRef   = useRef(null)
  const socketRef = useRef(null)
  const roleRef   = useRef(null)
  const dcRef     = useRef(null)

  const addMsg = useCallback((text, from = 'system') => {
    setMessages(prev => [...prev, { text, from, ts: Date.now() }])
  }, [])

  function setupDC(dc) {
    dcRef.current = dc
    dc.binaryType = 'arraybuffer'

    dc.onopen = () => {
      setDcReady(true)
      addMsg('✓ DataChannel açık — bağlantı hazır!')
    }
    dc.onclose = () => {
      setDcReady(false)
      addMsg('DataChannel kapandı.')
    }
    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'PING') {
          addMsg(`← PING: "${msg.text}"`, 'peer')
          dc.send(JSON.stringify({ type: 'PONG', text: msg.text }))
        } else if (msg.type === 'PONG') {
          addMsg(`← PONG: "${msg.text}"`, 'peer')
        }
      } catch {
        addMsg(`← binary (${e.data?.byteLength ?? '?'} bytes)`, 'peer')
      }
    }

    if (dc.readyState === 'open') {
      setDcReady(true)
      addMsg('✓ DataChannel açık — bağlantı hazır!')
    }
  }

  useEffect(() => {
    const key = secretKey.current

    if (!key) {
      setFatalErr('URL\'de şifreleme anahtarı yok (#key kısmı eksik). Linki tam kopyala.')
      return
    }

    let destroyed = false

    async function init() {
      try {
        await deriveKey(key)
        addMsg('✓ AES-GCM 256-bit anahtar türetildi.')
      } catch {
        setFatalErr('Geçersiz şifreleme anahtarı.')
        return
      }

      const socket = connectSocket()
      socketRef.current = socket

      const peer = new PeerConnection({
        onDataChannel: (dc) => setupDC(dc),
        onConnectionChange: (state) => {
          if (destroyed) return
          setConnState(state)
          addMsg(`⟳ Bağlantı: ${state}`)
        },
        onIceCandidate: (candidate) => {
          socket.emit('ice_candidate', { roomId, candidate })
        },
      })
      peerRef.current = peer

      socket.on('connect', () => {
        if (destroyed) return
        addMsg(`✓ Sunucuya bağlandı. (${socket.id.slice(0, 8)}...)`)
        socket.emit('create_room', { roomId })
      })

      socket.on('room_created', () => {
        if (destroyed) return
        roleRef.current = 'host'
        setRole('host')
        setConnState('waiting')
        addMsg('✓ Oda oluşturuldu — HOST olarak bekleniyor...')
        const dc = peer.createDataChannel('linkdrive')
        setupDC(dc)
      })

      socket.on('peer_joined', async ({ peerCount }) => {
        if (destroyed) return
        addMsg(`✓ Peer katıldı (toplam: ${peerCount}).`)
        if (roleRef.current === 'host' && peerCount === 2) {
          setConnState('connecting')
          const offer = await peer.createOffer()
          socket.emit('offer', { roomId, offer })
          addMsg('→ Offer gönderildi.')
        }
      })

      socket.on('offer', async ({ offer }) => {
        if (destroyed) return
        roleRef.current = 'guest'
        setRole('guest')
        setConnState('connecting')
        addMsg('← Offer alındı. Answer üretiliyor...')
        const answer = await peer.handleOffer(offer)
        socket.emit('answer', { roomId, answer })
        addMsg('→ Answer gönderildi.')
      })

      socket.on('answer', async ({ answer }) => {
        if (destroyed) return
        addMsg('← Answer alındı.')
        await peer.handleAnswer(answer)
      })

      socket.on('ice_candidate', async ({ candidate }) => {
        if (destroyed) return
        await peer.addIceCandidate(candidate)
      })

      socket.on('peer_left', () => {
        if (destroyed) return
        addMsg('⚠ Karşı taraf ayrıldı.')
        setConnState('disconnected')
        setDcReady(false)
      })

      socket.on('error', ({ code }) => {
        if (destroyed) return
        if (code === 'ROOM_FULL') {
          setFatalErr('Oda dolu. Maksimum 2 kişi.')
          return
        }
        if (code === 'ROOM_NOT_FOUND') {
          roleRef.current = 'guest'
          setRole('guest')
          addMsg('→ Odaya katılıyor (GUEST)...')
          socket.emit('join_room', { roomId })
        }
      })

      socket.on('connect_error', (err) => {
        if (destroyed) return
        setFatalErr(`Sunucuya bağlanılamadı: ${err.message}`)
      })

      socket.connect()
    }

    init()

    return () => {
      destroyed = true
      peerRef.current?.close()
      disconnectSocket()
    }
  }, []) // eslint-disable-line

  if (fatalErr) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-red-950 border border-red-800 rounded-2xl p-6 max-w-md w-full text-center">
          <p className="text-red-400 font-semibold mb-2">Hata</p>
          <p className="text-gray-300 text-sm">{fatalErr}</p>
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

      {role === 'host' && (
        <ShareLink roomId={roomId} secretKey={secretKey.current} />
      )}

      <MessageTest
        dcReady={dcReady}
        messages={messages}
        onSend={(text) => {
          if (dcRef.current?.readyState === 'open') {
            dcRef.current.send(JSON.stringify({ type: 'PING', text }))
            addMsg(`→ PING: "${text}"`, 'self')
          }
        }}
      />
    </div>
  )
}
