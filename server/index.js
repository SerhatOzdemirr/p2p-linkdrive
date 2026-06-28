// index.js — P2P LinkDrive Signalling Server
require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const { createRoom, joinRoom, leaveRoom, getOtherPeer, getRoomId } = require('./roomManager');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Sağlık kontrolü
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: Date.now() }));

const ROOM_ID_RE = /^[0-9a-f]{32,64}$/i

// Basit per-socket rate limiter: pencere başına max N event
const socketRates = new Map()
function isRateLimited(socketId, max = 30) {
  const now = Date.now()
  let e = socketRates.get(socketId)
  if (!e || now > e.resetAt) e = { count: 0, resetAt: now + 1000 }
  e.count++
  socketRates.set(socketId, e)
  return e.count > max
}

io.on('connection', (socket) => {
  console.log(`[+] Bağlandı: ${socket.id}`);

  // ── Oda oluştur ─────────────────────────────────────────────────────────
  socket.on('create_room', ({ roomId }) => {
    if (isRateLimited(socket.id)) return;
    if (!roomId || !ROOM_ID_RE.test(roomId)) return;

    const result = createRoom(roomId, socket.id);
    if (result.ok) {
      socket.join(roomId);
      socket.emit('room_created', { roomId });
      console.log(`[Room] Oluşturuldu: ${roomId} by ${socket.id}`);
      return;
    }
    if (result.error === 'room_exists') {
      const joinResult = joinRoom(roomId, socket.id);
      if (joinResult.error === 'room_full') {
        socket.emit('error', { code: 'ROOM_FULL' });
        return;
      }
      socket.join(roomId);
      // Odada zaten olanlar initiator olur; yeni katılan (sender) bekler
      socket.to(roomId).emit('peer_joined', { peerCount: joinResult.peerCount });
      socket.emit('room_joined', { peerCount: joinResult.peerCount });
      console.log(`[Room] Katıldı (guest): ${socket.id} → ${roomId}`);
    }
  });

  // ── Odaya katıl ──────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomId }) => {
    if (isRateLimited(socket.id)) return;
    if (!roomId || !ROOM_ID_RE.test(roomId)) return;

    const result = joinRoom(roomId, socket.id);

    if (result.error === 'room_not_found') {
      socket.emit('error', { code: 'ROOM_NOT_FOUND' });
      return;
    }
    if (result.error === 'room_full') {
      socket.emit('error', { code: 'ROOM_FULL' });
      return;
    }

    socket.join(roomId);
    socket.to(roomId).emit('peer_joined', { peerCount: result.peerCount });
    socket.emit('room_joined', { peerCount: result.peerCount });
    console.log(`[Room] Katıldı: ${socket.id} → ${roomId}`);
  });

  // ── WebRTC Sinyalleşme (kör iletim — içerik okunmaz) ────────────────────
  socket.on('offer', ({ roomId, offer }) => {
    if (isRateLimited(socket.id)) return;
    if (!roomId || !ROOM_ID_RE.test(roomId)) return;
    const other = getOtherPeer(roomId, socket.id);
    if (other) io.to(other).emit('offer', { offer });
  });

  socket.on('answer', ({ roomId, answer }) => {
    if (isRateLimited(socket.id)) return;
    if (!roomId || !ROOM_ID_RE.test(roomId)) return;
    const other = getOtherPeer(roomId, socket.id);
    if (other) io.to(other).emit('answer', { answer });
  });

  // Trickle ICE — adaylar geldiği anda ilet (toplu değil)
  socket.on('ice_candidate', ({ roomId, candidate }) => {
    if (isRateLimited(socket.id)) return;
    if (!roomId || !ROOM_ID_RE.test(roomId)) return;
    const other = getOtherPeer(roomId, socket.id);
    if (other) io.to(other).emit('ice_candidate', { candidate });
  });

  // Yeniden bağlanma: dönen taraf (answerer) karşı taraftan offer ister
  socket.on('request_offer', ({ roomId }) => {
    if (isRateLimited(socket.id)) return;
    if (!roomId || !ROOM_ID_RE.test(roomId)) return;
    const other = getOtherPeer(roomId, socket.id);
    if (other) io.to(other).emit('make_offer');
  });

  // ── Ayrılma / bağlantı kopması ───────────────────────────────────────────
  socket.on('leave_room', () => handleLeave(socket));
  socket.on('disconnect', () => {
    console.log(`[-] Ayrıldı: ${socket.id}`);
    socketRates.delete(socket.id);
    handleLeave(socket);
  });
});

function handleLeave(socket) {
  const result = leaveRoom(socket.id);
  if (!result) return;
  const { roomId, empty, remaining } = result;
  if (!empty && remaining) {
    io.to(roomId).emit('peer_left');
  }
  console.log(`[Room] ${socket.id} ayrıldı: ${roomId} (boş: ${empty})`);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 P2P LinkDrive Sunucusu: http://localhost:${PORT}`);
  console.log(`   Sağlık: http://localhost:${PORT}/health\n`);
});
