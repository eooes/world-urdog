import * as THREE from 'three';
import { terrainHeight } from './terrain.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGradTex(w, h, stops) {
  const cv  = document.createElement('canvas');
  cv.width  = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const gr  = ctx.createLinearGradient(0, 0, 0, h);
  for (const [pos, color] of stops) gr.addColorStop(pos, color);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, w, h);
  return new THREE.CanvasTexture(cv);
}

function makeRadialTex(r, inner, outer) {
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = r * 2;
  const ctx = cv.getContext('2d');
  const gr  = ctx.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, r * 2, r * 2);
  return new THREE.CanvasTexture(cv);
}

// ── God rays ──────────────────────────────────────────────────────────────────

const RAY_TEX = makeGradTex(32, 256, [
  [0,    'rgba(180,150,255,0)'],
  [0.22, 'rgba(190,160,255,0.32)'],
  [0.55, 'rgba(200,170,255,0.52)'],
  [0.80, 'rgba(210,180,255,0.28)'],
  [1,    'rgba(220,195,255,0)'],
]);
const RAY_MAT = new THREE.SpriteMaterial({
  map:      RAY_TEX,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite:  false,
  fog:         false,
});

// ── Glow sprites ─────────────────────────────────────────────────────────────

const GLOW_TEX = makeRadialTex(64, 'rgba(220,200,255,0.9)', 'rgba(160,130,255,0)');
const GLOW_MAT = new THREE.SpriteMaterial({
  map:         GLOW_TEX,
  blending:    THREE.AdditiveBlending,
  transparent: true,
  depthWrite:  false,
  fog:         false,
});

// Stage-area light glow tex (warmer)
const STAGE_GLOW_TEX = makeRadialTex(64, 'rgba(255,210,140,0.85)', 'rgba(255,180,80,0)');
const STAGE_GLOW_MAT = new THREE.SpriteMaterial({
  map:         STAGE_GLOW_TEX,
  blending:    THREE.AdditiveBlending,
  transparent: true,
  depthWrite:  false,
  fog:         false,
});

/**
 * Build atmospheric effects: god rays + glow sprites.
 * Returns { update(t, intensity) } where intensity is 0..1 from the audio timeline.
 */
export function buildGodRays(scene) {
  const rays  = [];
  const glows = [];

  // ── Helper: add a ray sprite ────────────────────────────────────────────
  function addRay(x, y, z, scaleX, scaleY, baseOpacity) {
    const sp = new THREE.Sprite(RAY_MAT.clone());
    sp.scale.set(scaleX, scaleY, 1);
    sp.position.set(x, y, z);
    sp.material.opacity = baseOpacity;
    sp.userData.base    = baseOpacity;
    scene.add(sp);
    rays.push(sp);
  }

  function addGlow(x, y, z, size, mat) {
    const sp = new THREE.Sprite(mat.clone());
    sp.scale.set(size, size, 1);
    sp.position.set(x, y, z);
    scene.add(sp);
    glows.push(sp);
  }

  // ── Stage god rays (downward beams) ─────────────────────────────────────
  const stageY = terrainHeight(0, -120);
  addRay(  -8, stageY + 22, -120, 3.5, 18, 0.55);
  addRay(   8, stageY + 24, -120, 2.8, 22, 0.48);
  addRay(  -3, stageY + 26, -122, 2.2, 20, 0.42);
  addRay( -18, stageY + 18, -115, 2.0, 14, 0.38);
  addRay(  16, stageY + 20, -117, 2.0, 16, 0.35);

  // Warm stage glow spots (on the actual stage rig position)
  addGlow(  0, stageY + 15, -120, 12, STAGE_GLOW_MAT);
  addGlow(-14, stageY +  8, -115,  7, STAGE_GLOW_MAT);
  addGlow( 14, stageY +  8, -115,  7, STAGE_GLOW_MAT);

  // ── Tripod glow spheres ──────────────────────────────────────────────────
  const t1y = terrainHeight(70, -30);
  addGlow(70, t1y + 13.5 * 1.1, -30, 5, GLOW_MAT);
  addRay( 70, t1y + 16,         -30, 1.8, 12, 0.28);

  const t2y = terrainHeight(120, 40);
  addGlow(120, t2y + 13.5 * 0.8, 40, 4, GLOW_MAT);
  addRay( 120, t2y + 14,          40, 1.5, 10, 0.22);

  // ── Ambient sky haze rays scattered around the field ────────────────────
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const r = 50 + i * 18;
    const rx = Math.cos(a) * r;
    const rz = Math.sin(a) * r - 20;
    const ry = terrainHeight(rx, rz) + 10 + i * 3;
    addRay(rx, ry, rz, 1.5 + i * 0.3, 10 + i * 2, 0.15 + i * 0.04);
  }

  return {
    update(t, intensity = 0.5) {
      const beat = 0.7 + intensity * 0.3;
      for (const ray of rays) {
        const pulse = Math.sin(t * 1.4 + ray.position.x * 0.1) * 0.18 + beat;
        ray.material.opacity = Math.max(0, Math.min(1, ray.userData.base * pulse));
      }
      // Glows pulse with a slightly different frequency
      for (const g of glows) {
        const p = 0.8 + Math.sin(t * 2.1 + g.position.z * 0.05) * 0.2 * intensity;
        g.material.opacity = Math.max(0, Math.min(1, p));
      }
    },
  };
}
