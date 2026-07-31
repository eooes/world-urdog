import { PLAYER_COLORS } from '../constants.js';

export class SettingsPanel {
  constructor(net) {
    this._net       = net;
    this._el       = document.getElementById('settings');
    this._openBtn  = document.getElementById('openSet');
    this._closeBtn = document.getElementById('closeSet');
    this._swatches = document.getElementById('swatches');
    this._nameInput = document.getElementById('usernameInput');
    this._roomCodeEl = document.getElementById('roomCode');
    this._roomCountEl = document.getElementById('roomCount');
    this._roomInput = document.getElementById('roomInput');
    this._switchBtn = document.getElementById('switchRoomBtn');
    this._roomListBox = document.getElementById('roomListBox');
    this._open = false;

    this.onColorChange    = null; // (hex) =>
    this.onUsernameChange = null; // (name) =>

    this._buildSwatches();
    this._openBtn.addEventListener('click',  () => this.open());
    this._closeBtn.addEventListener('click', () => this.close());
    this._nameInput.addEventListener('change', () => {
      this.onUsernameChange?.(this._nameInput.value.trim() || 'guest');
    });

    // Room switching
    this._switchBtn.addEventListener('click', () => {
      const code = this._roomInput.value.trim().toUpperCase();
      if (code.length === 4 && net) {
        net.joinRoom(code);
        this._roomInput.value = '';
      }
    });
    this._roomInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._switchBtn.click();
    });

    // Auto-refresh room list when settings opened
    this._openBtn.addEventListener('click', () => {
      if (net) net.getRoomList();
    });
  }

  _buildSwatches() {
    PLAYER_COLORS.forEach((col, i) => {
      const sw = document.createElement('div');
      sw.className = 'sw' + (i === 7 ? ' sel' : '');
      sw.style.background = '#' + col.hex.toString(16).padStart(6, '0');
      sw.addEventListener('click', () => {
        this._swatches.querySelectorAll('.sw').forEach(s => s.classList.remove('sel'));
        sw.classList.add('sel');
        this.onColorChange?.(col.hex);
      });
      this._swatches.appendChild(sw);
    });
  }

  open()  { this._open = true;  this._el.classList.add('open'); if (this._net) this._net.getRoomList(); }
  close() { this._open = false; this._el.classList.remove('open'); }

  setRoomInfo(code, count, max) {
    if (this._roomCodeEl) this._roomCodeEl.textContent = code || '——';
    if (this._roomCountEl) this._roomCountEl.textContent = `${count || 0} / ${max || 10} players`;
  }

  setRoomList(rooms) {
    if (!this._roomListBox) return;
    if (!rooms || !rooms.length) {
      this._roomListBox.textContent = 'No other rooms';
      return;
    }
    this._roomListBox.innerHTML = rooms
      .map(r => `<div style="padding:2px 0;cursor:pointer" data-code="${r.code}">🏠 ${r.code} — ${r.count}/${r.max}</div>`)
      .join('');
    this._roomListBox.querySelectorAll('div').forEach(el => {
      el.addEventListener('click', () => {
        this._roomInput.value = el.dataset.code;
        this._switchBtn.click();
      });
    });
  }

  get username() { return this._nameInput.value.trim() || 'guest'; }
}
