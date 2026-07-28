import * as THREE from 'three';
import { scene } from './renderer.js';
import { terrainH, toon, colliders } from './terrain.js';
import { ACCENT } from './config.js';

/* ------------------------------------------------------------------
   Sky dome — gradient shader, tint driven by timeline
   ------------------------------------------------------------------ */
export const skyUniforms = {
  top:   { value: new THREE.Color(0x3d8ae6) },
  mid:   { value: new THREE.Color(0x9fd2f7) },
  bot:   { value: new THREE.Color(0xecf7fc) },
  tint:  { value: 0.0 },
  night: { value: new THREE.Color(0x0d1230) },
};

export function buildSky() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vP;
        void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `
        varying vec3 vP;
        uniform vec3 top, mid, bot, night;
        uniform float tint;
        void main(){
          float h = normalize(vP).y;
          vec3 c = h > 0.0 ? mix(mid, top, h) : mix(mid, bot, -h * 3.0);
          c = mix(c, night, tint);
          gl_FragColor = vec4(c, 1.);
        }`,
    }),
  );
  scene.add(sky);
}

/* ------------------------------------------------------------------
   Clouds
   ------------------------------------------------------------------ */
export const clouds = new THREE.Group();

export function buildClouds() {
  scene.add(clouds);
  const cc = document.createElement('canvas');
  cc.width = cc.height = 128;
  const cx = cc.getContext('2d');
  const gr = cx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0,    'rgba(255,255,255,0.95)');
  gr.addColorStop(0.55, 'rgba(255,255,255,0.5)');
  gr.addColorStop(1,    'rgba(255,255,255,0)');
  cx.fillStyle = gr;
  cx.fillRect(0, 0, 128, 128);

  const cloudTex = new THREE.CanvasTexture(cc);
  const baseMat  = new THREE.SpriteMaterial({
    map: cloudTex, transparent: true, depthWrite: false, opacity: 0.85, fog: false,
  });

  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Group();
    const n = 1 + ((Math.random() * 2) | 0);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Sprite(baseMat.clone());
      const w = 36 + Math.random() * 26;
      s.scale.set(w, w * 0.6, 1);
      s.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 6, 0);
      puff.add(s);
    }
    puff.position.set((Math.random() - 0.5) * 440, 70 + Math.random() * 70, (Math.random() - 0.5) * 440);
    puff.userData.spd = 0.6 + Math.random() * 0.8;
    clouds.add(puff);
  }
}

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */
function scatter(count, minR, maxR) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    out.push([x, terrainH(x, z), z]);
  }
  return out;
}

/* ------------------------------------------------------------------
   Trees (instanced)
   ------------------------------------------------------------------ */
export function buildTrees() {
  const spots  = scatter(46, 22, 190);
  const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 5);
  const foliG  = new THREE.ConeGeometry(1.5, 4.2, 7);
  const trunk  = new THREE.InstancedMesh(trunkG, toon(0x4a3b2f), spots.length);
  const foli   = new THREE.InstancedMesh(foliG,  toon(0x2f6b3c), spots.length);
  trunk.castShadow = foli.castShadow = true;

  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const fcol = new THREE.Color();
  const greens = [0x2f6b3c, 0x3b7d43, 0x276b4e, 0xe0913f];

  spots.forEach(([x, y, z], i) => {
    const s = 0.7 + Math.random() * 0.9;
    m.compose(new THREE.Vector3(x, y + 1.2 * s, z), q, new THREE.Vector3(s, s, s));
    trunk.setMatrixAt(i, m);
    m.compose(
      new THREE.Vector3(x, y + 3.6 * s, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6),
      new THREE.Vector3(s, s + Math.random() * 0.4, s),
    );
    foli.setMatrixAt(i, m);
    fcol.setHex(Math.random() < 0.12 ? greens[3] : greens[(Math.random() * 3) | 0]);
    foli.setColorAt(i, fcol);
  });

  scene.add(trunk, foli);
}

/* ------------------------------------------------------------------
   Rocks (instanced)
   ------------------------------------------------------------------ */
export function buildRocks() {
  const spots = scatter(20, 30, 170);
  const g = new THREE.IcosahedronGeometry(2.4, 0);
  const rocks = new THREE.InstancedMesh(
    g,
    new THREE.MeshStandardMaterial({ color: 0xb9bcc9, roughness: 0.85, flatShading: true }),
    spots.length,
  );
  rocks.castShadow = rocks.receiveShadow = true;

  const m = new THREE.Matrix4(), col = new THREE.Color();
  spots.forEach(([x, y, z], i) => {
    const s = 1 + Math.random() * 2.4;
    m.compose(
      new THREE.Vector3(x, y + s * 0.4, z),
      new THREE.Quaternion().random(),
      new THREE.Vector3(s, s * 0.7, s),
    );
    rocks.setMatrixAt(i, m);
    col.setHSL(0.62, 0.05, 0.55 + Math.random() * 0.2);
    rocks.setColorAt(i, col);
  });

  scene.add(rocks);
}

/* ------------------------------------------------------------------
   Alien tripod structures
   ------------------------------------------------------------------ */
function buildTripod(x, z, s) {
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(9 * s, 6 * s, 1.1 * s), toon(0x14151c));
  body.position.y = 11 * s; body.rotation.y = 0.2; body.castShadow = true;
  g.add(body);

  const legMat = toon(0x1c1d26);
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 15 * s, 6), legMat);
    const a = (i / 3) * Math.PI * 2;
    leg.position.set(Math.cos(a) * 3 * s, 6 * s, Math.sin(a) * 3 * s);
    leg.rotation.z = Math.cos(a) * 0.32;
    leg.rotation.x = -Math.sin(a) * 0.32;
    leg.castShadow = true;
    g.add(leg);
  }

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.6 * s, 12, 12),
    new THREE.MeshBasicMaterial({ color: ACCENT }),
  );
  glow.position.set(0, 13.5 * s, 0.7 * s);
  g.add(glow);

  g.position.set(x, terrainH(x, z), z);
  scene.add(g);
  colliders.push(body);
}

/* ------------------------------------------------------------------
   Pillar hall
   ------------------------------------------------------------------ */
function buildPillars() {
  const grp = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const row  = (i / 2) | 0;
    const x    = -60 + side * 6;
    const z    = 40  - row  * 9;
    const h    = 12  + Math.random() * 4;
    const p    = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.6), toon(0x191a22));
    p.position.set(x, terrainH(x, z) + h / 2, z);
    p.castShadow = true;
    grp.add(p);
    colliders.push(p);
  }
  scene.add(grp);
}

/* ------------------------------------------------------------------
   Sky floating timestamp numbers
   ------------------------------------------------------------------ */
export const skyNums = new THREE.Group();

function makeNumSprite(txt) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 96;
  const x = cv.getContext('2d');
  x.font = '700 66px "JetBrains Mono", monospace';
  x.fillStyle = 'rgba(231,200,106,0.92)';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = 'rgba(231,200,106,0.6)'; x.shadowBlur = 8;
  x.fillText(txt, 128, 52);
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.9 }),
  );
  s.scale.set(9, 3.4, 1);
  return s;
}

export function buildSkyNums() {
  scene.add(skyNums);
  for (let i = 0; i < 16; i++) {
    const t = `00:0${1 + ((Math.random() * 3) | 0)}:${(10 + ((Math.random() * 50) | 0))}`;
    const s = makeNumSprite(t);
    s.position.set((Math.random() - 0.5) * 220, 24 + Math.random() * 44, (Math.random() - 0.5) * 220 - 30);
    s.userData.spin  = 0.2 + Math.random() * 0.5;
    s.userData.baseY = s.position.y;
    skyNums.add(s);
  }
}

/* ------------------------------------------------------------------
   Glowing ambient motes (particle system)
   ------------------------------------------------------------------ */
export let motes;

export function buildMotes() {
  const N = 600, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 260;
    pos[i * 3 + 1] = Math.random() * 40;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 260;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const cx = cv.getContext('2d');
  const grd = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0,   'rgba(255,255,240,1)');
  grd.addColorStop(0.4, 'rgba(200,220,255,0.6)');
  grd.addColorStop(1,   'rgba(255,255,255,0)');
  cx.fillStyle = grd; cx.fillRect(0, 0, 64, 64);

  motes = new THREE.Points(g, new THREE.PointsMaterial({
    size: 1.1, map: new THREE.CanvasTexture(cv),
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.8,
  }));
  scene.add(motes);
  return motes;
}

/* ------------------------------------------------------------------
   Dark fluid blob
   ------------------------------------------------------------------ */
export let blob, blobBase;

export function buildBlob() {
  blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3.2, 3),
    new THREE.MeshStandardMaterial({ color: 0x0c0d14, roughness: 0.25, metalness: 0.4 }),
  );
  const x = -30, z = -40;
  blob.position.set(x, terrainH(x, z) + 3.4, z);
  blob.castShadow = true;
  scene.add(blob);
  blobBase = blob.geometry.attributes.position.clone();
}

/* ------------------------------------------------------------------
   Master build call
   ------------------------------------------------------------------ */
export function buildEnvironment() {
  buildSky();
  buildClouds();
  buildTrees();
  buildRocks();
  buildTripod(70, -30, 1.1);
  buildTripod(120, 40, 0.8);
  buildPillars();
  buildSkyNums();
  buildMotes();
  buildBlob();
}
