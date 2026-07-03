// hooks/useNearby.js — aynı ağdaki cihazları keşfet (AirDrop/Snapdrop mantığı)
import { useState, useEffect, useRef } from 'react'
import { connectSocket } from '../core/signalling.js'
import { generateHex } from '../core/crypto.js'

export function useNearby() {
  const [self, setSelf]   = useState(null)   // { id, name, emoji }
  const [peers, setPeers] = useState([])      // [{ id, name, emoji }]
  const socketRef = useRef(null)

  useEffect(() => {
    const socket = connectSocket()
    socketRef.current = socket

    const onSelf  = (s) => setSelf(s)
    const onPeers = ({ peers }) => setPeers(peers || [])
    const onInvited = ({ roomId, key }) => {
      // Karşı taraf beni davet etti → aynı odaya git
      if (roomId && key) window.location.href = `/room/${roomId}#${key}`
    }

    socket.on('nearby_self', onSelf)
    socket.on('nearby_peers', onPeers)
    socket.on('nearby_invited', onInvited)
    if (!socket.connected) socket.connect()

    return () => {
      socket.off('nearby_self', onSelf)
      socket.off('nearby_peers', onPeers)
      socket.off('nearby_invited', onInvited)
    }
  }, [])

  // Bir cihaza tıkla → oda üret, karşıya davet gönder, ikisi de odaya gir
  function invite(targetId) {
    const roomId = generateHex(16)
    const key    = generateHex(32)
    const socket = socketRef.current
    socket.emit('nearby_invite', { targetId, roomId, key }, () => {
      window.location.href = `/room/${roomId}#${key}`
    })
    // ack gelmezse yine de git (500ms sonra)
    setTimeout(() => { window.location.href = `/room/${roomId}#${key}` }, 500)
  }

  return { self, peers, invite }
}
