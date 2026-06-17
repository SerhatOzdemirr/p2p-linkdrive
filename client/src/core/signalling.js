// core/signalling.js — Socket.io sinyal sunucusu bağlantısı

import { io } from 'socket.io-client'

// VITE_SERVER_URL boşsa Nginx üzerinden same-origin bağlantısı (Docker prod)
const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''

let socket = null

export function getSocket() {
  if (!socket) {
    const opts = { autoConnect: false }
    socket = SERVER_URL ? io(SERVER_URL, opts) : io(opts)
  }
  return socket
}

export function connectSocket() {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect()
}
