import * as THREE from 'three';
import { TIMELINE, SET_LEN } from './config.js';

/* ------------------------------------------------------------------
   Master audio clock — in production, replace .now() to read
   AudioContext.currentTime for sample-accurate sync.
   ------------------------------------------------------------------ */
export const audioClock = {
  _start: performance.now(),
  now()  { return (performance.now() - this._start) / 1000; },
  reset(){ this._start = performance.now(); },
};

function evAt(t) {
  let e = TIMELINE[0];
  for (const ev of TIMELINE) { if (t >= ev.t) e = ev; }
  return e;
}

/* ------------------------------------------------------------------
   tickTimeline — drives sky tint, fog colour, and light intensity
   from the event clock. Returns current set time in seconds.
   ------------------------------------------------------------------ */
export function tickTimeline(gameState, tweaks, skyUniforms, sun, hemi, scene) {
  const t = audioClock.now() % SET_LEN;
  gameState.curEv     = evAt(t);
  gameState.curEnergy = Math.min(1.6, gameState.curEv.energy * tweaks.energyMul);

  // Lerp sky tint toward event target (clamped by atmosphere tweak)
  const tintTarget = Math.max(gameState.curEv.tint, tweaks.moodFloor);
  skyUniforms.tint.value += (tintTarget - skyUniforms.tint.value) * 0.02;

  // Fog colour: daytime blue → deep midnight
  const fogC = new THREE.Color(0xcfe4f2).lerp(new THREE.Color(0x1a2140), skyUniforms.tint.value);
  scene.fog.color.copy(fogC);

  // Lighting dims as the set gets darker
  sun.intensity  = 2.3 - skyUniforms.tint.value * 1.4;
  hemi.intensity = 0.9 - skyUniforms.tint.value * 0.4;

  // Update set-clock and track name in the HUD
  const mm = String(Math.floor(t / 60)).padStart(2, '0');
  const ss = String(Math.floor(t % 60)).padStart(2, '0');
  const setTimeEl   = document.getElementById('setTime');
  const trackNameEl = document.getElementById('trackName');
  if (setTimeEl)   setTimeEl.textContent   = `${mm}:${ss}`;
  if (trackNameEl) trackNameEl.textContent = gameState.curEv.track;

  return t;
}
