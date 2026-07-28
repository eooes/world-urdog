import * as THREE from 'three';
import { toon } from '../shaders/toon.js';
import { terrainHeight } from './terrain.js';
import { ACCENT_HEX, GOLD_HEX } from '../constants.js';

export function buildTripod(scene, x, z, s = 1) {
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(9 * s, 6 * s, 1.1 * s), toon(0x14151c));
  body.position.y = 11 * s;
  body.rotation.y = 0.2;
  body.castShadow = true;
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
    new THREE.MeshBasicMaterial({ color: ACCENT_HEX }),
  );
  glow.position.set(0, 13.5 * s, 0.7 * s);
  g.add(glow);

  g.position.set(x, terrainHeight(x, z), z);
  scene.add(g);
  return { group: g, body };
}

export function buildPillarHall(scene) {
  const grp = new THREE.Group();
  const colliders = [];
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const row = (i / 2) | 0;
    const x = -60 + side * 6;
    const z = 40 - row * 9;
    const h = 12 + Math.random() * 4;
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 1.6), toon(0x191a22));
    p.position.set(x, terrainHeight(x, z) + h / 2, z);
    p.castShadow = true;
    grp.add(p);
    colliders.push(p);
  }
  scene.add(grp);
  return colliders;
}

export function buildBigScreen(scene) {
  const sc = document.createElement('canvas');
  sc.width = 1024; sc.height = 576;
  const ctx = sc.getContext('2d');
  const tex = new THREE.CanvasTexture(sc);

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 19),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  const x = 0, z = -120;
  mesh.position.set(x, terrainHeight(x, z) + 16, z);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(36, 21, 0.6), toon(0x0e0f16));
  frame.position.copy(mesh.position);
  frame.position.z -= 0.4;
  scene.add(frame, mesh);

  return {
    mesh, tex,
    draw(t, trackName, energy) {
      const W = 1024, H = 576;
      const hue1 = (t * 24) % 360;
      const hue2 = (hue1 + 120) % 360;
      const gr = ctx.createLinearGradient(0, 0, W, H);
      gr.addColorStop(0, `hsl(${hue1},80%,55%)`);
      gr.addColorStop(1, `hsl(${hue2},75%,42%)`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);

      // scan lines
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#fff';
      for (let y = 0; y < H; y += 6) ctx.fillRect(0, y + ((t * 60) % 6), W, 2);
      ctx.globalAlpha = 1;

      // waveform
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const bars = 64;
      for (let i = 0; i < bars; i++) {
        const bh = (Math.sin(i * 0.5 + t * 4) * 0.5 + 0.5) * (0.3 + 0.7 * energy) * H * 0.4;
        ctx.fillRect(i * (W / bars) + 3, H * 0.72 - bh, W / bars - 5, bh);
      }

      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '600 74px Inter, sans-serif';
      ctx.fillText('SHIN SEKAI', W / 2, H * 0.4);
      ctx.font = '500 30px "JetBrains Mono", monospace';
      ctx.globalAlpha = 0.85;
      ctx.fillText('// ' + trackName.toUpperCase() + ' //', W / 2, H * 0.5);
      ctx.globalAlpha = 1;

      tex.needsUpdate = true;
    },
  };
}

export function buildSkyNumbers(scene) {
  const group = new THREE.Group();
  scene.add(group);

  for (let i = 0; i < 16; i++) {
    const time = `00:0${1 + ((Math.random() * 3) | 0)}:${(10 + ((Math.random() * 50) | 0))}`;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 96;
    const ctx = cv.getContext('2d');
    ctx.font = '700 66px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(231,200,106,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(231,200,106,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(time, 128, 52);
    const tex = new THREE.CanvasTexture(cv);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 }));
    sprite.scale.set(9, 3.4, 1);
    sprite.position.set(
      (Math.random() - 0.5) * 220,
      24 + Math.random() * 44,
      (Math.random() - 0.5) * 220 - 30,
    );
    sprite.userData.spin = 0.2 + Math.random() * 0.5;
    sprite.userData.baseY = sprite.position.y;
    group.add(sprite);
  }

  return group;
}

export function buildMotes(scene) {
  const N = 600;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 260;
    pos[i * 3 + 1] = Math.random() * 40;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 260;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,240,1)');
  gr.addColorStop(0.4, 'rgba(200,220,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 64, 64);

  const mat = new THREE.PointsMaterial({
    size: 1.1,
    map: new THREE.CanvasTexture(cv),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.8,
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return pts;
}

export function buildDarkBlob(scene) {
  // Tunnel shader adapted from Danilo Guanabara (Shadertoy XsXXDn)
  const blobMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vPos;
      varying vec3 vNormal;
      void main() {
        vPos = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec3 vPos;
      varying vec3 vNormal;

      vec3 digitalRainbow(float value) {
        float r = clamp(sin(value + 0.0) * 0.5 + 0.5, 0.0, 1.0);
        float g = clamp(sin(value + 2.0944) * 0.5 + 0.5, 0.0, 1.0);
        float b = clamp(sin(value + 4.18879) * 0.5 + 0.5, 0.0, 1.0);
        return vec3(r, g, b);
      }

      void main() {
        // Spherical projection of 3D surface position to UV
        vec3 pn = normalize(vPos);
        vec2 uv = vec2(atan(pn.z, pn.x) * 0.31831, pn.y);
        uv = uv * 0.5 + 0.5;

        float randomFactor = fract(sin(dot(uv, vec2(5555555.9898, 9.233))) * 33758.5453);
        float scale = 9.0;
        float angle = sin(uv.x * scale) + cos(uv.y * scale) + uTime;
        vec2 flowDir = vec2(cos(angle), sin(angle));
        vec2 newUV = uv + flowDir * randomFactor * 0.05;
        vec2 scaledUV = newUV * 20.0;
        float pixelValue = 1.0 - step(0.5, mod(scaledUV.x + scaledUV.y, 2.0));
        vec3 backgroundColor = vec3(0.0);
        vec3 rainbowColor = digitalRainbow(mod(uTime + scaledUV.x + scaledUV.y, 6.2831));
        vec3 finalColor = mix(backgroundColor, rainbowColor, pixelValue);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });

  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 4), blobMat);
  const bx = -30, bz = -40;
  blob.position.set(bx, terrainHeight(bx, bz) + 3.4, bz);
  blob.castShadow = false;
  scene.add(blob);

  const basePositions = blob.geometry.attributes.position.clone();

  return { blob, basePositions, material: blobMat };
}
