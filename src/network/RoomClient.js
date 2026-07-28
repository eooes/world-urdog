import { NET } from '../constants.js';

/**
 * Thin WebSocket room client with automatic fallback to offline mock mode.
 * Protocol: newline-delimited JSON frames.
 *
 * Server messages:
 *   { type: 'welcome',  roomId, playerId }
 *   { type: 'snapshot', players: [PlayerState] }
 *   { type: 'join',     player: PlayerState }
 *   { type: 'leave',    playerId }
 *   { type: 'chat',     playerId, text }
 *
 * Client messages:
 *   { type: 'state',    ...PlayerState }
 *   { type: 'chat',     text }
 *   { type: 'emote',    emoteId }
 */
export class RoomClient extends EventTarget {
  constructor() {
    super();
    this.playerId = null;
    this.roomId   = null;
    this.online   = false;
    this._ws      = null;
    this._tickTimer = null;
  }

  connect(username, colorHex) {
    this._username = username;
    this._colorHex = colorHex;

    try {
      const ws = new WebSocket(NET.WS_URL);
      ws.onopen = () => {
        this.online = true;
        this._ws = ws;
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

  disconnect() {
    clearInterval(this._tickTimer);
    this._ws?.close();
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        this.playerId = msg.playerId;
        this.roomId   = msg.roomId;
        this._emit('welcome', msg);
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
    }
  }

  _startMockMode() {
    // Offline: generate a room ID and fake presence
    this.playerId = 'local_' + Math.random().toString(36).slice(2, 8);
    this.roomId   = Math.random().toString(36).slice(2, 8) + '-' + Math.random().toString(36).slice(2, 8);
    this._emit('welcome', { playerId: this.playerId, roomId: this.roomId, mock: true });
  }

  _emit(type, detail) {
    this.dispatchEvent(Object.assign(new Event(type), { detail }));
  }
}
