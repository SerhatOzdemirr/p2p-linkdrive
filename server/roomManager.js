// roomManager.js — Oda yaşam döngüsü
// Invariant: bir odada maksimum 2 peer

const rooms  = new Map(); // roomId -> Set<socketId>
const timers = new Map(); // roomId -> timeoutHandle

const ORPHAN_TTL_MS = 30 * 60 * 1000; // 30 dakika — guest gelmezse temizle

function createRoom(roomId, socketId) {
  if (rooms.has(roomId)) {
    return { error: 'room_exists' };
  }
  rooms.set(roomId, new Set([socketId]));

  const timer = setTimeout(() => {
    if (rooms.get(roomId)?.size === 1) {
      rooms.delete(roomId);
      timers.delete(roomId);
    }
  }, ORPHAN_TTL_MS);
  timers.set(roomId, timer);

  return { ok: true };
}

function joinRoom(roomId, socketId) {
  if (!rooms.has(roomId)) {
    return { error: 'room_not_found' };
  }
  const room = rooms.get(roomId);
  if (room.size >= 2) {
    return { error: 'room_full' };
  }
  room.add(socketId);

  // Guest katıldı — orphan timer iptal
  clearTimeout(timers.get(roomId));
  timers.delete(roomId);

  return { ok: true, peerCount: room.size };
}

function leaveRoom(socketId) {
  for (const [roomId, members] of rooms.entries()) {
    if (members.has(socketId)) {
      members.delete(socketId);
      if (members.size === 0) {
        rooms.delete(roomId);
        clearTimeout(timers.get(roomId));
        timers.delete(roomId);
        return { roomId, empty: true };
      }
      return { roomId, empty: false, remaining: [...members] };
    }
  }
  return null;
}

function getOtherPeer(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  for (const id of room) {
    if (id !== socketId) return id;
  }
  return null;
}

function getRoomId(socketId) {
  for (const [roomId, members] of rooms.entries()) {
    if (members.has(socketId)) return roomId;
  }
  return null;
}

module.exports = { createRoom, joinRoom, leaveRoom, getOtherPeer, getRoomId };
