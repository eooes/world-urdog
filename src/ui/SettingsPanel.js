import { PLAYER_COLORS } from '../constants.js';

export class SettingsPanel {
  constructor() {
    this._el       = document.getElementById('settings');
    this._openBtn  = document.getElementById('openSet');
    this._closeBtn = document.getElementById('closeSet');
    this._swatches = document.getElementById('swatches');
    this._nameInput = document.getElementById('usernameInput');
    this._open = false;

    this.onColorChange    = null; // (hex) =>
    this.onUsernameChange = null; // (name) =>

    this._buildSwatches();
    this._openBtn.addEventListener('click',  () => this.open());
    this._closeBtn.addEventListener('click', () => this.close());
    this._nameInput.addEventListener('change', () => {
      this.onUsernameChange?.(this._nameInput.value.trim() || 'guest');
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

  open()  { this._open = true;  this._el.classList.add('open'); }
  close() { this._open = false; this._el.classList.remove('open'); }

  get username() { return this._nameInput.value.trim() || 'guest'; }
}
