import * as THREE from 'three';
import { scene } from './renderer.js';

export const colliders = [];

export function terrainH(x, z) {
  const d = Math.sqrt(x * x + z * z);
  const amp = Math.min(1, Math.max(0, (d - 14) / 34));
  return (Math.sin(x * 0.05) * 2.4  + Math.cos(z * 0.045) * 2.2 +
          Math.sin((x + z) * 0.021) * 3.4 + Math.cos((x - z) * 0.03) * 1.6) * amp;
}

function makeRamp(steps) {
  const d = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    const v = Math.round(50 + 205 * (i / (steps - 1)));
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(d, steps, 1, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

export const gradMap = makeRamp(4);

export function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradMap, ...opts });
}

export function buildTerrain() {
  const GSEG = 80, GSIZE = 420;
  const geo = new THREE.PlaneGeometry(GSIZE, GSIZE, GSEG, GSEG);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const cols = [];
  const cLow = new THREE.Color(0x6fae5a);
  const cHi  = new THREE.Color(0xa6cf7e);
  const cDip = new THREE.Color(0x4f8a52);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = terrainH(x, z);
    pos.setY(i, y);
    const t = THREE.MathUtils.clamp((y + 4) / 9, 0, 1);
    const c = t < 0.5
      ? cDip.clone().lerp(cLow, t * 2)
      : cLow.clone().lerp(cHi, (t - 0.5) * 2);
    cols.push(c.r, c.g, c.b);
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  geo.computeVertexNormals();

  const ground = new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);
  colliders.push(ground);
  return ground;
}
