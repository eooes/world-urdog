import { NET } from '../constants.js';

/**
 * Thin WebSocket room client with automatic fallback to offline mock mode.
 * Protocol: newline-delimited JSON frames.
 *
 * Server messages:
 *   { type: 'welcome',      playerId, roomCode, count, max }
 *   { type: 'snapshot',     players: [PlayerState] }
 *   { type: 'join',         player: PlayerState }
 *   { type: 'leave',        playerId }
 *   { type: 'chat',         playerId, text }
 *   { type: 'emote',        playerId, emoteId }
 *   { type: 'roomUpdate',   players: [...], roomCode, count, max }
 *   { type: 'roomSwitched', roomCode, count, max }
 *   { type: 'roomList',     rooms: [{code, count, max}] }
 *   { type: 'error',        message }
 *
 * Client messages:
 *   { type: 'join',         username, color }
 *   { type: 'state',        ...PlayerState }
 *   { type: 'chat',         text }
 *   { type: 'emote',        emoteId }
 *   { type: 'joinRoom',     code }
 *   { type: 'roomList' }
 */
export class RoomClient extends EventTarget {
  constructor() {
    super();
    this.playerId    = null;
    this.roomId      = null;   // legacy alias
    this.roomCode    = null;
    this.playerCount = 0;
    this.maxPlayers  = 0;
    this.online      = false;
    this._ws         = null;
    this._tickTimer  = null;
    this._username   = 'guest';
    this._colorHex   = 0x9184d9;
  }

  // ── Public API ──────────────────────────────────────────────────

  connect(username, colorHex) {
    this._username = username || 'guest';
    this._colorHex = colorHex !== undefined ? colorHex : 0x9184d9;

    try {
      const ws = new WebSocket(NET.WS_URL);
      ws.onopen = () => {
        this.online = true;
        this._ws = ws;
        // Send initial join with credentials
        ws.send(JSON.stringify({
          type: 'join',
          username: this._username,
          color: this._colorHex,
        }));
        this._emit('connected', {});
      };
      ws.onmessage = e => {
        try { this._handleMessage(JSON.parse(e.data)); } catch (_) {}
      };
      ws.onerror = ws.onclose = () => {
        if (!this.online) this._startMockMode();
        else              this._emit('disconnected', {});
        this.online = false;
      };
    } catch (_) {
      this._startMockMode();
    }
  }

  sendState(playerState) {
    if (!this.online || !this._ws) return;
    this._ws.send(JSON.stringify({ type: 'state', ...playerState }));
  }

  sendChat(text) {
    if (this.online && this._ws) {
      this._ws.send(JSON.stringify({ type: 'chat', text }));
    }
  }

  sendEmote(emoteId) {
    if (this.online && this._ws) {
      this._ws.send(JSON.stringify({ type: 'emote', emoteId }));
    }
  }

  sendHello() {
    if (this.online && this._ws) {
      this._ws.send(JSON.stringify({ type: 'hello' }));
    }
  }

  /**
   * Join a specific room by its 4-character code.
   * The server responds with 'roomSwitched' on success or 'error' on failure.
   */
  joinRoom(code) {
    if (!this.online || !this._ws) {
      this._emit('error', { message: 'Not connected to server.' });
      return;
    }
    if (!code || code.length !== 4) {
      this._emit('error', { message: 'Room code must be exactly 4 characters.' });
      return;
    }
    this._ws.send(JSON.stringify({ type: 'joinRoom', code: code.toUpperCase() }));
  }

  /**
   * Query the server for the list of all rooms and their occupancy.
   * Dispatches a 'roomList' event on response.
   */
  getRoomList() {
    if (!this.online || !this._ws) return;
    this._ws.send(JSON.stringify({ type: 'roomList' }));
  }

  disconnect() {
    clearInterval(this._tickTimer);
    this._ws?.close();
  }

  // ── Internal ────────────────────────────────────────────────────

  _handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        this.playerId    = msg.playerId;
        this.roomCode    = msg.roomCode;
        this.roomId      = msg.roomCode;  // legacy alias
        this.playerCount = msg.count || 0;
        this.maxPlayers  = msg.max || 0;
        this._emit('welcome', msg);
        break;

      case 'roomSwitched':
        this.roomCode    = msg.roomCode;
        this.roomId      = msg.roomCode;
        this.playerCount = msg.count || 0;
        this.maxPlayers  = msg.max || 0;
        this._emit('roomSwitched', msg);
        // Also emit welcome-style so existing handlers work
        this._emit('welcome', {
          playerId: this.playerId,
          roomCode: msg.roomCode,
          count: msg.count,
          max: msg.max,
        });
        break;

      case 'roomUpdate':
        // Update local state if this is our room
        if (msg.roomCode === this.roomCode) {
          this.playerCount = msg.count || 0;
          this.maxPlayers  = msg.max || 0;
        }
        this._emit('roomUpdate', msg);
        break;

      case 'roomList':
        this._emit('roomList', msg);
        break;

      case 'snapshot':
        this._emit('snapshot', msg);
        break;

      case 'join':
        this._emit('join', msg);
        break;

      case 'leave':
        this._emit('leave', msg);
        break;

      case 'chat':
        this._emit('chat', msg);
        break;

      case 'emote':
        this._emit('emote', msg);
        break;

      case 'error':
        this._emit('error', msg);
        break;
    }
  }

  _startMockMode() {
    // Offline: generate a 4-char room code and fake presence
    const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code   = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    this.playerId    = 'local_' + Math.random().toString(36).slice(2, 8);
    this.roomCode    = code;
    this.roomId      = code;
    this.playerCount = 1;
    this.maxPlayers  = 10;
    this._emit('welcome', {
      playerId: this.playerId,
      roomCode: code,
      count: 1,
      max: 10,
      mock: true,
    });
  }

  _emit(type, detail) {
    this.dispatchEvent(Object.assign(new Event(type), { detail }));
  }
}
