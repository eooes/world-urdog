/**
 * SHIN SEKAI — WebSocket Room Server
 * Node.js 18+  ·  no extra dependencies (uses built-in `ws` via package.json)
 *
 * Protocol (newline-delimited JSON):
 *   server → client:
 *     welcome      { type:'welcome', playerId, roomCode, count, max }
 *     snapshot     { type:'snapshot', players:[PlayerState] }
 *     join         { type:'join', player:PlayerState }
 *     leave        { type:'leave', playerId }
 *     chat         { type:'chat', playerId, text }
 *     emote        { type:'emote', playerId, emoteId }
 *     roomUpdate   { type:'roomUpdate', players:[...], roomCode, count, max }
 *     roomList     { type:'roomList', rooms:[{code, count, max}] }
 *     playerState  { type:'playerState', playerId, transform, state, username }
 *
 *   client → server:
 *     join         { type:'join', username, color }
 *     state        { type:'state', transform, state, username }
 *     chat         { type:'chat', text }
 *     emote        { type:'emote', emoteId }
 *     joinRoom     { type:'joinRoom', code }
 *     roomList     { type:'roomList' }
 *     hello        { type:'hello' }
 */

const { WebSocketServer } = require('ws');
const { randomBytes }     = require('crypto');

// Dual-mode: standalone `node index.js` OR Firebase Cloud Function (see index.js wrapper)
const PORT = process.env.PORT || 3030;
const TICK_HZ   = 25;
const MAX_PLAYERS = 10;
const ROOM_CODE_LEN = 4;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/I/1 to avoid confusion
const wss = new WebSocketServer({ noServer: true });

// ── Room state ──────────────────────────────────────────────────────
const rooms       = new Map(); // roomCode  → Room
const clientRoom  = new Map(); // ws        → roomCode

/** @typedef {{ code: string, clients: Map<WebSocket, PlayerState> }} Room */

// ── Helpers ─────────────────────────────────────────────────────────

function generateRoomCode() {
  const bytes = randomBytes(ROOM_CODE_LEN);
  let code = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  // Ensure uniqueness (extremely rare collision, but guard anyway)
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

function broadcast(room, msg, except = null) {
  const payload = JSON.stringify(msg);
  for (const [ws] of room.clients) {
    if (ws !== except && ws.readyState === 1) ws.send(payload);
  }
}

/** Send a message to a single client */
function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg));
}

/** Create a new room with given code */
function createRoom(code) {
  const room = { code, clients: new Map() };
  rooms.set(code, room);
  return room;
}

/** Find the first room with available capacity; returns null if none */
function findAvailableRoom() {
  for (const room of rooms.values()) {
    if (room.clients.size < MAX_PLAYERS) return room;
  }
  return null;
}

/** Build a roomUpdate payload for a room */
function buildRoomUpdate(room) {
  const players = [];
  for (const [, state] of room.clients) players.push(state);
  return {
    type: 'roomUpdate',
    roomCode: room.code,
    count: room.clients.size,
    max: MAX_PLAYERS,
    players,
  };
}

/** Build the players array for a room */
function buildPlayerArray(room, excludeId = null) {
  const players = [];
  for (const [, state] of room.clients) {
    if (state.playerId !== excludeId) players.push(state);
  }
  return players;
}

// ── Connection handler ──────────────────────────────────────────────

wss.on('connection', ws => {
  const playerId = randomBytes(8).toString('hex');

  // Default player state (filled in on 'join')
  let playerState = {
    playerId,
    username: 'guest_' + playerId.slice(0, 4),
    transform: { position: { x: 0, y: 0, z: 0 }, rotationY: 0 },
    state: { animState: 'IDLE', activeEmoteId: null, color: 0x9184d9 },
  };

  /* ── Join protocol: client sends {type:'join', username, color} ── */
  let joined = false;

  function doJoinRoom(room) {
    joined = true;
    room.clients.set(ws, playerState);
    clientRoom.set(ws, room.code);

    // Welcome with room info
    send(ws, {
      type: 'welcome',
      playerId,
      roomCode: room.code,
      count: room.clients.size,
      max: MAX_PLAYERS,
    });

    // Snapshot of existing players
    const others = buildPlayerArray(room, playerId);
    if (others.length) send(ws, { type: 'snapshot', players: others });

    // Announce join to others
    broadcast(room, { type: 'join', player: playerState }, ws);

    // Broadcast updated room info
    broadcast(room, buildRoomUpdate(room));
  }

  function assignPlayerToRoom() {
    // Try to find a room with space
    let room = findAvailableRoom();
    if (!room) {
      // All existing rooms are full — create a new one
      const code = generateRoomCode();
      room = createRoom(code);
    }
    doJoinRoom(room);
  }

  /* ── Message handler ─────────────────────────────────────────── */

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }

    switch (msg.type) {

      /* ── Initial join ── */
      case 'join': {
        if (joined) return; // already joined
        if (msg.username) playerState.username = String(msg.username).slice(0, 20);
        if (msg.color !== undefined) playerState.state.color = msg.color;
        assignPlayerToRoom();
        break;
      }

      /* ── Per-tick state update ── */
      case 'state': {
        if (!joined) return;
        if (msg.transform) playerState.transform = msg.transform;
        if (msg.state)     playerState.state     = { ...playerState.state, ...msg.state };
        if (msg.username)  playerState.username  = String(msg.username).slice(0, 20);
        break;
      }

      /* ── Chat ── */
      case 'chat': {
        if (!joined) return;
        const room = rooms.get(clientRoom.get(ws));
        if (!room) return;
        broadcast(room, {
          type: 'chat',
          playerId,
          text: String(msg.text || '').slice(0, 256),
        });
        break;
      }

      /* ── Emote ── */
      case 'emote': {
        if (!joined) return;
        const room = rooms.get(clientRoom.get(ws));
        if (!room) return;
        broadcast(room, {
          type: 'emote',
          playerId,
          emoteId: msg.emoteId,
        }, ws);
        break;
      }

      /* ── Manual room switch ── */
      case 'joinRoom': {
        if (!joined) return;
        const code = String(msg.code || '').toUpperCase().trim();
        if (!code || code.length !== ROOM_CODE_LEN) {
          send(ws, { type: 'error', message: 'Invalid room code. Must be 4 characters.' });
          return;
        }

        const oldCode = clientRoom.get(ws);
        if (oldCode === code) {
          send(ws, { type: 'error', message: 'Already in that room.' });
          return;
        }

        const newRoom = rooms.get(code);
        if (!newRoom) {
          send(ws, { type: 'error', message: `Room ${code} does not exist.` });
          return;
        }
        if (newRoom.clients.size >= MAX_PLAYERS) {
          send(ws, { type: 'error', message: `Room ${code} is full (${MAX_PLAYERS}/${MAX_PLAYERS}).` });
          return;
        }

        // Leave old room
        const oldRoom = rooms.get(oldCode);
        if (oldRoom) {
          oldRoom.clients.delete(ws);
          broadcast(oldRoom, { type: 'leave', playerId });
          broadcast(oldRoom, buildRoomUpdate(oldRoom));
          if (oldRoom.clients.size === 0) rooms.delete(oldCode);
        }

        // Join new room
        newRoom.clients.set(ws, playerState);
        clientRoom.set(ws, code);

        // Tell client they've moved
        send(ws, {
          type: 'roomSwitched',
          roomCode: code,
          count: newRoom.clients.size,
          max: MAX_PLAYERS,
        });

        // Snapshot of new room's players
        const others = buildPlayerArray(newRoom, playerId);
        if (others.length) send(ws, { type: 'snapshot', players: others });

        // Announce arrival to new room
        broadcast(newRoom, { type: 'join', player: playerState }, ws);
        broadcast(newRoom, buildRoomUpdate(newRoom));

        console.log(`[room] ${playerState.username} moved from ${oldCode} → ${code}`);
        break;
      }

      /* ── Query room list ── */
      case 'roomList': {
        const list = [];
        for (const [code, room] of rooms) {
          list.push({ code, count: room.clients.size, max: MAX_PLAYERS });
        }
        send(ws, { type: 'roomList', rooms: list });
        break;
      }

      /* ── Hello / ping ── */
      case 'hello': {
        send(ws, { type: 'hello', serverTime: Date.now() });
        break;
      }
    }
  });

  /* ── Disconnect ── */
  ws.on('close', () => {
    const code = clientRoom.get(ws);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    room.clients.delete(ws);
    clientRoom.delete(ws);

    broadcast(room, { type: 'leave', playerId });
    broadcast(room, buildRoomUpdate(room));

    if (room.clients.size === 0) {
      rooms.delete(code);
      console.log(`[room] Room ${code} deleted (empty)`);
    }
  });
});

// ── Periodic state snapshots ────────────────────────────────────────

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.clients.size < 2) continue;
    const players = [];
    for (const [, state] of room.clients) players.push(state);
    const payload = JSON.stringify({ type: 'snapshot', players });
    for (const [ws] of room.clients) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }
}, 1000 / TICK_HZ);

// ── Dual-mode exports ───────────────────────────────────────────────
// 1) Standalone: `node server-core.js` → listen on PORT
// 2) Cloud Function: `index.js` calls attachUpgrade(req, socket, head)
function attachUpgrade(req, socket, head) {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
}

module.exports = { wss, attachUpgrade, rooms, get MAX_PLAYERS() { return MAX_PLAYERS; } };

if (require.main === module) {
  const { createServer } = require('http');
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SHIN SEKAI room server');
  });
  server.on('upgrade', (req, socket, head) => attachUpgrade(req, socket, head));
  server.listen(PORT, () => {
    console.log(`SHIN SEKAI room server listening on ws://localhost:${PORT}`);
  });
}
