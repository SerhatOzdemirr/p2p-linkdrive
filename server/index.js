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

io.on('connection', (socket) => {
  console.log(`[+] Bağlandı: ${socket.id}`);

  // ── Oda oluştur ─────────────────────────────────────────────────────────
  socket.on('create_room', ({ roomId }) => {
    const result = createRoom(roomId, socket.id);
    if (result.ok) {
      socket.join(roomId);
      socket.emit('room_created', { roomId });
      console.log(`[Room] Oluşturuldu: ${roomId} by ${socket.id}`);
    }
  });

  // ── Odaya katıl ──────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomId }) => {
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
    // Her iki tarafa da bildir
    io.to(roomId).emit('peer_joined', { peerCount: result.peerCount });
    console.log(`[Room] Katıldı: ${socket.id} → ${roomId}`);
  });

  // ── WebRTC Sinyalleşme (kör iletim — içerik okunmaz) ────────────────────
  socket.on('offer', ({ roomId, offer }) => {
    const other = getOtherPeer(roomId, socket.id);
    if (other) io.to(other).emit('offer', { offer });
  });

  socket.on('answer', ({ roomId, answer }) => {
    const other = getOtherPeer(roomId, socket.id);
    if (other) io.to(other).emit('answer', { answer });
  });

  // Trickle ICE — adaylar geldiği anda ilet (toplu değil)
  socket.on('ice_candidate', ({ roomId, candidate }) => {
    const other = getOtherPeer(roomId, socket.id);
    if (other) io.to(other).emit('ice_candidate', { candidate });
  });

  // ── Ayrılma / bağlantı kopması ───────────────────────────────────────────
  socket.on('leave_room', () => handleLeave(socket));
  socket.on('disconnect', () => {
    console.log(`[-] Ayrıldı: ${socket.id}`);
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
