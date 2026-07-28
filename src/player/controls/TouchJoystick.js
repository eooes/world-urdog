import * as THREE from 'three';

export class TouchJoystick {
  constructor(joyEl, cameraOrbitTarget) {
    this.joyEl  = joyEl;
    this.nubEl  = joyEl.querySelector('.nub');
    this._orbitTarget = cameraOrbitTarget; // camera controller with .orbit(dx,dy)

    this.vec = { x: 0, y: 0 };
    this._joyId   = null;
    this._lookId  = null;
    this._lookLast = { x: 0, y: 0 };
    this._center  = { x: 0, y: 0 };
    this._radius  = 48;

    this._bindJoy();
    this._bindLook();
  }

  _bindJoy() {
    const el = this.joyEl;
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId);
      this._joyId = e.pointerId;
      const r = el.getBoundingClientRect();
      this._center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this._moveJoy(e);
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerId === this._joyId) this._moveJoy(e);
    });
    el.addEventListener('pointerup',     () => this._endJoy());
    el.addEventListener('pointercancel', () => this._endJoy());
  }

  _moveJoy(e) {
    let dx = e.clientX - this._center.x;
    let dy = e.clientY - this._center.y;
    const d = Math.hypot(dx, dy);
    if (d > this._radius) { dx = dx / d * this._radius; dy = dy / d * this._radius; }
    this.nubEl.style.transform = `translate(${dx}px,${dy}px)`;
    this.vec = { x: dx / this._radius, y: dy / this._radius };
  }

  _endJoy() {
    this._joyId = null;
    this.vec = { x: 0, y: 0 };
    this.nubEl.style.transform = 'translate(0,0)';
  }

  _bindLook() {
    const canvas = document.getElementById('canvas');
    // Bind on canvas so non-UI touches route here; joystick uses joyEl capture so it won't fire here
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerId === this._joyId) return;
      this._lookId = e.pointerId;
      this._lookLast = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId !== this._lookId) return;
      const dx = e.clientX - this._lookLast.x;
      const dy = e.clientY - this._lookLast.y;
      this._lookLast = { x: e.clientX, y: e.clientY };
      this._orbitTarget?.orbit(dx, dy);
    });
    canvas.addEventListener('pointerup', e => {
      if (e.pointerId === this._lookId) this._lookId = null;
    });
    canvas.addEventListener('pointercancel', e => {
      if (e.pointerId === this._lookId) this._lookId = null;
    });
  }

  getInput() {
    return {
      x:    this.vec.x,
      y:   -this.vec.y,
      run:  Math.hypot(this.vec.x, this.vec.y) > 0.7,
      rise: false,
      fall: false,
    };
  }
}
