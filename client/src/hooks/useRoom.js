// hooks/useRoom.js
import { useState, useRef, useEffect, useCallback } from 'react'
import { connectSocket, disconnectSocket } from '../core/signalling.js'
import { PeerConnection } from '../core/webrtc.js'
import { deriveKey, encrypt, decrypt } from '../core/crypto.js'

export function useRoom(roomId, secretKey) {
  const [role, setRole]         = useState(null)
  const [connState, setConnState] = useState('idle')
  const [dcReady, setDcReady]   = useState(false)
  const [messages, setMessages] = useState([])
  const [fatalErr, setFatalErr] = useState(null)

  const peerRef     = useRef(null)
  const socketRef   = useRef(null)
  const roleRef     = useRef(null)
  const dcRef       = useRef(null)
  const keyRef      = useRef(null)
  const handlersRef = useRef({}) // mesaj tipi → handler

  const addMsg = useCallback((text, from = 'system') => {
    setMessages(prev => [...prev, { text, from, ts: Date.now() }])
  }, [])

  // Harici hook'lar kendi mesaj tiplerini buraya kaydeder
  const registerMessageHandler = useCallback((type, handler) => {
    handlersRef.current[type] = handler
  }, [])

  const sendEncrypted = useCallback(async (msg) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    const encoded = new TextEncoder().encode(JSON.stringify(msg))
    const buf = await encrypt(keyRef.current, encoded)
    dc.send(buf)
  }, [])

  const sendPing = useCallback(async (text) => {
    await sendEncrypted({ type: 'PING', text })
    addMsg(`→ PING: "${text}"`, 'self')
  }, [sendEncrypted, addMsg])

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
    dc.onmessage = async (e) => {
      try {
        const plain = await decrypt(keyRef.current, e.data)

        const msg = JSON.parse(new TextDecoder().decode(plain))

        if (msg.type === 'PING') {
          addMsg(`← PING: "${msg.text}"`, 'peer')
          await sendEncrypted({ type: 'PONG', text: msg.text })
          return
        }
        if (msg.type === 'PONG') {
          addMsg(`← PONG: "${msg.text}"`, 'peer')
          return
        }

        const handler = handlersRef.current[msg.type]
        if (handler) await handler(msg)
      } catch {
        addMsg('← şifreli veri çözülemedi', 'system')
      }
    }

    if (dc.readyState === 'open') {
      setDcReady(true)
      addMsg('✓ DataChannel açık — bağlantı hazır!')
    }
  }

  useEffect(() => {
    if (!secretKey) {
      setFatalErr('URL\'de şifreleme anahtarı yok (#key kısmı eksik).')
      return
    }

    let destroyed = false

    async function init() {
      try {
        keyRef.current = await deriveKey(secretKey)
        addMsg('✓ AES-GCM 256-bit anahtar türetildi.')
      } catch {
        setFatalErr('Geçersiz şifreleme anahtarı.')
        return
      }

      const socket = connectSocket()
      socketRef.current = socket

      const peer = new PeerConnection({
        onDataChannel:    (dc) => setupDC(dc),
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
        peer.createDataChannel('linkdrive') // onDataChannel callback setupDC'yi çağırır
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
        if (code === 'ROOM_FULL') setFatalErr('Oda dolu. Maksimum 2 kişi.')
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

  return {
    role, connState, dcReady, fatalErr, messages,
    dcRef, sendEncrypted, registerMessageHandler, sendPing,
  }
}
