/**
 * SHIN SEKAI — WebSocket Room Server
 * Node.js 18+  ·  no extra dependencies (uses built-in `ws` via package.json)
 *
 * Protocol (newline-delimited JSON):
 *   server → client: welcome, snapshot, join, leave, chat
 *   client → server: state, chat, emote
 */

const { WebSocketServer } = require('ws');
const { randomBytes }     = require('crypto');

const PORT     = process.env.PORT || 3030;
const TICK_HZ  = 25;
const wss      = new WebSocketServer({ port: PORT });

const rooms    = new Map(); // roomId → { clients: Map<ws, PlayerState> }
const clientRoom = new Map(); // ws → roomId

function makeId(len = 6) { return randomBytes(len).toString('hex').slice(0, len); }

function broadcast(room, msg, except = null) {
  const payload = JSON.stringify(msg);
  for (const [ws] of room.clients) {
    if (ws !== except && ws.readyState === 1) ws.send(payload);
  }
}

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, { clients: new Map() });
  return rooms.get(roomId);
}

wss.on('connection', ws => {
  const playerId = makeId();
  const roomId   = makeId();   // each connection auto-joins a room (lobby logic can expand this)
  const room     = getOrCreateRoom(roomId);

  room.clients.set(ws, {
    playerId,
    username: 'guest_' + playerId.slice(0, 4),
    transform: { position: { x: 0, y: 0, z: 0 }, rotationY: 0 },
    state: { animState: 'IDLE', activeEmoteId: null, color: 0x9184d9 },
  });
  clientRoom.set(ws, roomId);

  // Welcome
  ws.send(JSON.stringify({ type: 'welcome', playerId, roomId }));

  // Snapshot of existing players
  const others = [];
  for (const [, state] of room.clients) {
    if (state.playerId !== playerId) others.push(state);
  }
  if (others.length) ws.send(JSON.stringify({ type: 'snapshot', players: others }));

  // Announce join to others
  broadcast(room, { type: 'join', player: room.clients.get(ws) }, ws);

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }

    const playerState = room.clients.get(ws);
    if (!playerState) return;

    switch (msg.type) {
      case 'state':
        if (msg.transform) playerState.transform = msg.transform;
        if (msg.state)     playerState.state     = msg.state;
        if (msg.username)  playerState.username  = msg.username;
        break;

      case 'chat':
        broadcast(room, { type: 'chat', playerId, text: String(msg.text).slice(0, 30) });
        break;

      case 'emote':
        broadcast(room, { type: 'emote', playerId, emoteId: msg.emoteId }, ws);
        break;
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
    clientRoom.delete(ws);
    broadcast(room, { type: 'leave', playerId });
    if (room.clients.size === 0) rooms.delete(roomId);
  });
});

// Broadcast state snapshots at tick rate
setInterval(() => {
  for (const [roomId, room] of rooms) {
    if (room.clients.size < 2) continue;
    const players = [];
    for (const [, state] of room.clients) players.push(state);
    const payload = JSON.stringify({ type: 'snapshot', players });
    for (const [ws] of room.clients) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }
}, 1000 / TICK_HZ);

console.log(`SHIN SEKAI room server listening on ws://localhost:${PORT}`);
