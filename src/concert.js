import * as THREE from 'three';
import { scene } from './renderer.js';
import { terrainH, toon } from './terrain.js';

let screenCtx, screenTex;
export let bigScreen;

export function buildConcertScreen() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 576;
  screenCtx = canvas.getContext('2d');
  screenTex = new THREE.CanvasTexture(canvas);

  bigScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 19),
    new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
  );

  const x = 0, z = -120;
  bigScreen.position.set(x, terrainH(x, z) + 16, z);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(36, 21, 0.6), toon(0x0e0f16));
  frame.position.copy(bigScreen.position);
  frame.position.z -= 0.4;

  scene.add(frame, bigScreen);
}

export function drawScreen(t, ev, curEnergy) {
  const c = screenCtx, W = 1024, H = 576;

  // Animated gradient background
  const hue1 = (t * 24) % 360, hue2 = (hue1 + 120) % 360;
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, `hsl(${hue1},80%,55%)`);
  g.addColorStop(1, `hsl(${hue2},75%,42%)`);
  c.fillStyle = g; c.fillRect(0, 0, W, H);

  // Scan-line overlay
  c.globalAlpha = 0.08; c.fillStyle = '#fff';
  for (let y = 0; y < H; y += 6) c.fillRect(0, y + ((t * 60) % 6), W, 2);
  c.globalAlpha = 1;

  // Waveform bars synced to energy
  c.fillStyle = 'rgba(255,255,255,0.85)';
  const bars = 64;
  for (let i = 0; i < bars; i++) {
    const bh = (Math.sin(i * 0.5 + t * 4) * 0.5 + 0.5) * (0.3 + 0.7 * curEnergy) * H * 0.4;
    c.fillRect(i * (W / bars) + 3, H * 0.72 - bh, W / bars - 5, bh);
  }

  // Title + track
  c.fillStyle = '#fff'; c.textAlign = 'center';
  c.font = '600 74px Inter, sans-serif';
  c.fillText('SHIN SEKAI', W / 2, H * 0.4);
  c.font = '500 30px "JetBrains Mono", monospace';
  c.globalAlpha = 0.85;
  c.fillText('// ' + ev.track.toUpperCase() + ' //', W / 2, H * 0.5);
  c.globalAlpha = 1;

  screenTex.needsUpdate = true;
}
