export class HUD {
  constructor() {
    this._fps     = document.getElementById('pFps');
    this._draw    = document.getElementById('pDraw');
    this._tri     = document.getElementById('pTri');
    this._net     = document.getElementById('pNet');
    this._pop     = document.getElementById('pop');
    this._clock   = document.getElementById('setTime');
    this._track   = document.getElementById('trackName');
    this._room    = document.getElementById('roomTag');
    this._roomCode = document.getElementById('roomCode');

    this._frames  = 0;
    this._fpsAcc  = 0;
    this._fps60   = 60;
  }

  update(dt, info, netHz, playerCount, clockStr, trackName, roomId) {
    // Rolling FPS average
    this._frames++;
    this._fpsAcc += dt;
    if (this._fpsAcc >= 0.5) {
      this._fps60 = Math.round(this._frames / this._fpsAcc);
      this._frames = 0;
      this._fpsAcc = 0;
    }

    const fps  = this._fps60;
    const draw = info.render.calls;
    const tri  = info.render.triangles;

    if (this._fps) {
      this._fps.textContent = fps;
      this._fps.className = 'val ' + (fps >= 55 ? 'ok' : fps >= 30 ? 'warn' : 'bad');
    }
    if (this._draw) {
      this._draw.textContent = draw;
      this._draw.className = 'val ' + (draw <= 120 ? 'ok' : draw <= 200 ? 'warn' : 'bad');
    }
    if (this._tri) {
      this._tri.textContent = tri > 1000 ? (tri / 1000).toFixed(1) + 'k' : tri;
      this._tri.className = 'val ' + (tri <= 50000 ? 'ok' : tri <= 80000 ? 'warn' : 'bad');
    }
    if (this._net) {
      this._net.textContent = netHz + ' Hz';
      this._net.className = 'val ok';
    }
    if (this._pop)    this._pop.textContent    = playerCount;
    if (this._clock)  this._clock.textContent  = clockStr;
    if (this._track)  this._track.textContent  = trackName;
    if (this._room)   this._room.textContent   = roomId || '——';
    if (this._roomCode) this._roomCode.textContent = roomId || '——';
  }
}
