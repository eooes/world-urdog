import { EMOTES } from '../constants.js';

export class EmoteWheel {
  constructor() {
    this._wheelEl = document.getElementById('wheel');
    this._ringEl  = document.getElementById('wheelRing');
    this._open    = false;

    this.onEmote = null; // (emoteIndex) =>

    this._build();
    this._wheelEl.addEventListener('click', e => {
      if (e.target === this._wheelEl) this.close();
    });
  }

  get isOpen() { return this._open; }

  _build() {
    EMOTES.forEach((em, i) => {
      const angle = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
      const r = 100;
      const x = Math.cos(angle) * r + 130;
      const y = Math.sin(angle) * r + 130;
      const el = document.createElement('div');
      el.className = 'emo';
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      el.textContent = em.icon;
      el.title = em.name;
      el.addEventListener('click', () => {
        this.onEmote?.(i);
        this.close();
      });
      this._ringEl.appendChild(el);
    });
  }

  toggle() {
    this._open ? this.close() : this.open();
  }

  open() {
    this._open = true;
    this._wheelEl.classList.add('open');
  }

  close() {
    this._open = false;
    this._wheelEl.classList.remove('open');
  }
}
