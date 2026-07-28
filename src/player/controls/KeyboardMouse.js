export class KeyboardMouseControls {
  constructor() {
    this._keys = {};
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);

    // Callbacks for one-shot actions
    this.onJump    = null;
    this.onFly     = null;
    this.onChat    = null;
    this.onEmote   = null;
    this.onEscape  = null;
    this.isChatOpen = false;
  }

  _onKeyDown(e) {
    if (this.isChatOpen) {
      if (e.code === 'Enter')  this.onChat?.('send');
      if (e.code === 'Escape') this.onEscape?.();
      return;
    }
    if (e.target.tagName === 'INPUT') return;

    this._keys[e.code] = true;

    if (e.code === 'Space')  { console.log('[KB] Space pressed, onJump:', !!this.onJump); e.preventDefault(); this.onJump?.(); }
    if (e.code === 'KeyF')   this.onFly?.();
    if (e.code === 'KeyE')   this.onEmote?.();
    if (e.code === 'Enter')  { e.preventDefault(); this.onChat?.('open'); }
    if (e.code === 'Escape') this.onEscape?.();
  }

  _onKeyUp(e) {
    this._keys[e.code] = false;
  }

  /** Returns a normalised movement vector {x, y, run, rise, fall} */
  getInput() {
    const k = this._keys;
    let x = 0, y = 0;
    if (k['KeyW'] || k['ArrowUp'])    y += 1;
    if (k['KeyS'] || k['ArrowDown'])  y -= 1;
    if (k['KeyA'] || k['ArrowLeft'])  x += 1;
    if (k['KeyD'] || k['ArrowRight']) x -= 1;

    // Normalise diagonal
    if (x !== 0 && y !== 0) { x *= 0.707; y *= 0.707; }

    return {
      x,
      y,
      run:  !!(k['ShiftLeft'] || k['ShiftRight']),
      rise: !!(k['Space'] && this._keys._flyMode),
      fall: !!(k['KeyC'] || k['ControlLeft']),
    };
  }

  setFlyMode(on) {
    this._keys._flyMode = on;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
  }
}
