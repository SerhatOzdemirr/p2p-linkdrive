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
    try { dc.send(buf) } catch { /* buffer full — caller'ın backpressure'ı yakalaması lazım */ }
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

    // Mesajları sıralı işle: FILE_START async OPFS kurulumu bitmeden
    // FILE_CHUNK gelirse chunk düşüyor. Zincir Promise ile önlüyoruz.
    let msgChain = Promise.resolve()
    dc.onmessage = (e) => {
      msgChain = msgChain.then(async () => {
        try {
          const plain = await decrypt(keyRef.current, e.data)
          const msg   = JSON.parse(new TextDecoder().decode(plain))

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
          // Şifre çözme hatası veya JSON parse hatası — zinciri kırma
        }
      })
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
    let removeVisibility = () => {}

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

      // ── Bağlantı kurulumu (refresh/rejoin'e dayanıklı — tam yeniden anlaşma) ──
      let peer              = null
      let isInitiator       = false
      let reconnectTimer    = null
      let reconnectAttempts = 0
      let negotiating       = false
      let hasConnectedOnce  = false

      const onConnChange = (state) => {
        if (destroyed) return
        setConnState(state)
        addMsg(`⟳ Bağlantı: ${state}`)
        if (state === 'connected') {
          clearTimeout(reconnectTimer)
          reconnectAttempts = 0
        }
        // Geçici kopma (mobil arka plan vb.) — sadece initiator yeniden dener
        if ((state === 'disconnected' || state === 'failed') && isInitiator) {
          clearTimeout(reconnectTimer)
          reconnectTimer = setTimeout(tryReconnect, state === 'failed' ? 1000 : 3000)
        }
      }

      function buildPeer() {
        if (peer) { peer._onConnChange = () => {}; peer.close() }
        peer = new PeerConnection({
          onDataChannel:      (dc) => setupDC(dc),
          onConnectionChange: onConnChange,
          onIceCandidate:     (candidate) => socket.emit('ice_candidate', { roomId, candidate }),
        })
        peerRef.current = peer
      }

      // Odada zaten olan taraf: temiz bağlantı kurup offer üretir
      async function becomeInitiator() {
        if (negotiating) return        // çift negotiation'ı önle (peer_left + peer_joined yarışı)
        negotiating = true
        clearTimeout(reconnectTimer)
        isInitiator = true
        roleRef.current = 'host'
        setRole('host')
        buildPeer()
        setConnState('connecting')
        peer.createDataChannel('linkdrive') // onDataChannel → setupDC
        try {
          const offer = await peer.createOffer()
          socket.emit('offer', { roomId, offer })
          addMsg('→ Offer gönderildi.')
        } catch { addMsg('Offer üretilemedi.') }
        negotiating = false
      }

      // Yeni katılan taraf: gelen offer'a temiz bağlantıyla cevap verir
      async function becomeAnswerer(offer) {
        isInitiator = false
        roleRef.current = 'guest'
        setRole('guest')
        buildPeer()
        setConnState('connecting')
        try {
          const answer = await peer.handleOffer(offer)
          socket.emit('answer', { roomId, answer })
          addMsg('→ Answer gönderildi.')
        } catch { addMsg('Answer üretilemedi.') }
      }

      async function tryReconnect() {
        if (destroyed || !isInitiator) return
        if (peer?.connectionState === 'connected') { reconnectAttempts = 0; return }
        if (reconnectAttempts >= 6) {
          addMsg('⚠ Yeniden bağlanılamadı — sayfayı yenileyin.')
          return
        }
        reconnectAttempts++
        addMsg(`⟳ Yeniden bağlanılıyor (${reconnectAttempts})...`)
        await becomeInitiator()
        reconnectTimer = setTimeout(tryReconnect, 5000)
      }

      buildPeer() // başlangıç peer'i

      socket.on('connect', () => {
        if (destroyed) return
        addMsg(`✓ Sunucuya bağlandı. (${socket.id.slice(0, 8)}...)`)
        hasConnectedOnce = true
        // Her (yeniden) bağlanmada odaya tekrar katıl → rejoin akışı tetiklenir
        socket.emit('create_room', { roomId })
      })

      socket.on('room_created', () => {
        if (destroyed) return
        roleRef.current = 'host'
        setRole('host')
        setConnState('waiting')
        addMsg('✓ Oda oluşturuldu — bekleniyor...')
      })

      // Ben zaten odadaydım, yeni biri katıldı → initiator olup offer üretirim
      socket.on('peer_joined', async ({ peerCount }) => {
        if (destroyed) return
        addMsg(`✓ Peer katıldı (toplam: ${peerCount}).`)
        await becomeInitiator()
      })

      // Ben yeni katıldım → offer beklerim
      socket.on('room_joined', ({ peerCount }) => {
        if (destroyed) return
        roleRef.current = 'guest'
        setRole('guest')
        setConnState('connecting')
        addMsg(`✓ Odaya katıldım (toplam: ${peerCount}) — offer bekleniyor...`)
      })

      socket.on('offer', async ({ offer }) => {
        if (destroyed) return
        addMsg('← Offer alındı.')
        await becomeAnswerer(offer)
      })

      socket.on('answer', async ({ answer }) => {
        if (destroyed) return
        addMsg('← Answer alındı.')
        try { await peer.handleAnswer(answer) } catch {}
      })

      socket.on('ice_candidate', async ({ candidate }) => {
        if (destroyed) return
        try { await peer.addIceCandidate(candidate) } catch {}
      })

      // Karşı taraf "offer iste" dedi (o, arka plandan döndü) → ben offer üretirim
      socket.on('make_offer', () => {
        if (destroyed) return
        addMsg('← Yeniden bağlanma isteği — offer üretiliyor.')
        becomeInitiator()
      })

      socket.on('peer_left', () => {
        if (destroyed) return
        // Karşı taraf socket'ten ayrıldı (refresh veya çıkış).
        // Reconnect timer'ını durdur — temiz dönüş 'peer_joined' ile gelecek,
        // aksi halde tryReconnect + peer_joined çift negotiation yapıp kanalı bozuyor.
        clearTimeout(reconnectTimer)
        reconnectAttempts = 0
        addMsg('⚠ Karşı taraf ayrıldı — yeniden katılması bekleniyor.')
        setConnState('disconnected')
        setDcReady(false)
      })

      socket.on('error', ({ code }) => {
        if (destroyed) return
        if (code === 'ROOM_FULL') setFatalErr('Oda dolu. Maksimum 2 kişi.')
      })

      socket.on('connect_error', (err) => {
        if (destroyed) return
        // Sadece İLK bağlantı başarısızsa fatal. Sonraki (reconnect) xhr poll error'ları
        // geçici — Socket.io kendi yeniden dener; odayı kapatma.
        if (!hasConnectedOnce) {
          setFatalErr(`Sunucuya bağlanılamadı: ${err.message}`)
        } else {
          addMsg(`⟳ Sunucu bağlantısı koptu, yeniden deneniyor... (${err.message})`)
          setConnState('connecting')
        }
      })

      // ── Mobil: dosya seçici/arka plandan dönünce bağlantıyı anında kurtar ──
      // ICE'in kopmayı fark etmesini (saniyeler) bekleme; visible olur olmaz tetikle.
      const onVisible = () => {
        if (destroyed || document.visibilityState !== 'visible') return
        if (peer?.connectionState === 'connected') return
        reconnectAttempts = 0
        clearTimeout(reconnectTimer)
        addMsg('⟳ Öne geldi — bağlantı kontrol ediliyor...')
        if (isInitiator) becomeInitiator()           // ben offer üretebilirim
        else socket.emit('request_offer', { roomId }) // karşıdan offer iste
      }
      document.addEventListener('visibilitychange', onVisible)
      removeVisibility = () => document.removeEventListener('visibilitychange', onVisible)

      socket.connect()
    }

    init()

    return () => {
      destroyed = true
      removeVisibility()
      peerRef.current?.close()
      disconnectSocket()
    }
  }, []) // eslint-disable-line

  return {
    role, connState, dcReady, fatalErr, messages,
    dcRef, peerRef, sendEncrypted, registerMessageHandler, sendPing,
  }
}
