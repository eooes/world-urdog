import * as THREE from 'three';
import { toon } from '../shaders/toon.js';
import { WORLD } from '../constants.js';

/* ── Terrain height (same procedural hills) ────────────────────────── */
export function terrainHeight(x, z) {
  const d = Math.sqrt(x * x + z * z);
  const amp = Math.min(1, Math.max(0, (d - 14) / 34));
  return (
    Math.sin(x * 0.05) * 2.4 +
    Math.cos(z * 0.045) * 2.2 +
    Math.sin((x + z) * 0.021) * 3.4 +
    Math.cos((x - z) * 0.03) * 1.6
  ) * amp;
}

/* ── Ground with MdsGzS shade_grass() shader ───────────────────────── */
export function buildTerrain(scene) {
  const geo = new THREE.PlaneGeometry(
    WORLD.TERRAIN_SIZE, WORLD.TERRAIN_SIZE,
    WORLD.TERRAIN_SEGS, WORLD.TERRAIN_SEGS,
  );
  geo.rotateX(-Math.PI / 2);

  // Apply terrain height to vertices
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  geo.computeVertexNormals();

  // ── MdsGzS ground shader ──
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    lights: false,
    uniforms: {
      uTime: { value: 0 },
      uCross0: { value: new THREE.Vector3(-80, -110, 1.2) },
      uCross1: { value: new THREE.Vector3(-40, -100, 1.0) },
      uCross2: { value: new THREE.Vector3(10, -95, 1.3) },
      uCross3: { value: new THREE.Vector3(50, -105, 0.85) },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorldPos;
      varying vec3 vNormal;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      uniform float uTime;
      uniform vec3 uCross0;  // xy=pos, z=scale
      uniform vec3 uCross1;
      uniform vec3 uCross2;
      uniform vec3 uCross3;

      /* === EXACT Shadertoy MdsGzS functions (verbatim) === */

      float hash(in float p) { return fract(sin(p) * 43758.2317); }
      float hash(in vec2 p) { return hash(dot(p, vec2(87.1, 313.7))); }
      vec2 hash2(in float p) {
          float x = hash(p);
          return vec2(x, hash(p+x));
      }
      vec2 hash2(in vec2 p) { return hash2(dot(p, vec2(87.1, 313.7))); }

      float noise(in vec2 p) {
          vec2 F = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
              mix(hash(F),           hash(F+vec2(1.0,0.0)), f.x),
              mix(hash(F+vec2(0.0,1.0)), hash(F+vec2(1.0)),    f.x), f.y);
      }

      vec2 noise2(in vec2 p) {
          vec2 F = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
              mix(hash2(F),            hash2(F+vec2(1.0,0.0)), f.x),
              mix(hash2(F+vec2(0.0,1.0)), hash2(F+vec2(1.0)),    f.x), f.y);
      }

      float fnoise(in vec2 p) {
          return 0.5 * noise(p) + 0.25 * noise(p*2.03) + 0.125 * noise(p*3.99);
      }

      vec2 wind_displacement(in vec2 p) {
          return noise2(p*0.1+uTime) - 0.5;
      }

      // shade_grass() from MdsGzS — verbatim, using world xz
      vec3 shade_grass(in vec2 posXZ) {
          vec2 typepos = posXZ + wind_displacement(posXZ);
          float typemask1 = fnoise(2.5*typepos);
          float typemask2 = pow(fnoise(0.4*typepos), 3.0);
          float typemask3 = step(0.71, fnoise(0.8*typepos));
          vec3 col1 = vec3(0.6, 0.87, 0.5);        // soft green
          vec3 col2 = vec3(0.7, 0.73, 0.4)*0.3;     // dark yellow-green
          vec3 col3 = vec3(1.0, 1.0, 0.1);           // bright yellow
          vec3 col4 = vec3(1.0, 0.4, 0.7);           // pink (flowers)
          float ambient = 0.8;
          vec3 color = mix(mix(mix(col1, col2, typemask1),
                  col3, typemask2), col4, typemask3) * ambient;
          return color;
      }

      void main() {
        // Ground color from MdsGzS shade_grass (80% darker)
        vec3 col = shade_grass(vWorldPos.xz) * 0.2;

        // Simple diffuse lighting from sky
        float NdotU = vNormal.y * 0.5 + 0.5;
        col *= 0.6 + 0.4 * NdotU;

        // Occlusion: darken flat/low areas slightly
        float slope = 1.0 - abs(vNormal.y);
        col *= 1.0 - slope * 0.15;

        // ── Evangelion cross ground reflections ──
        float totalGlow = 0.0;
        vec3 neonGreen = vec3(0.0, 1.0, 0.33);
        for (int ci = 0; ci < 4; ci++) {
          vec3 cp = (ci == 0) ? uCross0 : (ci == 1) ? uCross1 : (ci == 2) ? uCross2 : uCross3;
          if (cp.z < 0.01) continue;
          vec2 toCross = vWorldPos.xz - cp.xy;
          float scl = cp.z;
          // Horizontal ripple stretch (water reflection)
          float ripple = exp(-abs(toCross.x) / (20.0 * scl) - abs(toCross.y) / (8.0 * scl));
          // Subtle vertical smear
          float smear  = exp(-length(toCross) / (12.0 * scl));
          float glow = max(ripple * 0.7, smear * 0.4);
          totalGlow += glow;
        }
        totalGlow = clamp(totalGlow, 0.0, 1.0);
        col = mix(col, neonGreen, totalGlow * 0.55);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  mat.userData._groundMat = mat;  // tag for time updates

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  return mesh;
}

/* ── Trees ──────────────────────────────────────────────────────────── */
export function buildTrees(scene) {
  const spots = scatter(46, 22, 190);
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.4, 5);
  const trunk = new THREE.InstancedMesh(trunkGeo, toon(0x4a3b2f), spots.length);
  const foliGeo = new THREE.ConeGeometry(1.5, 4.2, 7);
  const foli = new THREE.InstancedMesh(
    foliGeo,
    new THREE.MeshStandardMaterial({ color: 0x3a6b3a, roughness: 0.7, metalness: 0.0 }),
    spots.length,
  );
  trunk.castShadow = foli.castShadow = true;

  const mat = new THREE.Matrix4();
  const q   = new THREE.Quaternion();

  spots.forEach(([x, y, z], i) => {
    const s = 0.7 + Math.random() * 0.9;
    mat.compose(new THREE.Vector3(x, y + 1.2 * s, z), q, new THREE.Vector3(s, s, s));
    trunk.setMatrixAt(i, mat);
    mat.compose(
      new THREE.Vector3(x, y + 3.6 * s, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6),
      new THREE.Vector3(s, s + Math.random() * 0.4, s),
    );
    foli.setMatrixAt(i, mat);
    // all foliage uses the bright base color for bloom
  });

  scene.add(trunk, foli);
}

/* ── Rocks ──────────────────────────────────────────────────────────── */
export function buildRocks(scene) {
  const rockCanvas = document.createElement('canvas');
  rockCanvas.width = rockCanvas.height = 256;
  const rctx = rockCanvas.getContext('2d');
  rctx.fillStyle = '#8a8a8a';
  rctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 2 + Math.random() * 20;
    const shade = 100 + Math.random() * 100;
    rctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    rctx.beginPath();
    rctx.arc(x, y, r, 0, Math.PI * 2);
    rctx.fill();
  }
  const rockTex = new THREE.CanvasTexture(rockCanvas);
  rockTex.wrapS = rockTex.wrapT = THREE.RepeatWrapping;

  const spots = scatter(20, 30, 170);
  const geo = new THREE.IcosahedronGeometry(2.4, 0);
  const rocks = new THREE.InstancedMesh(
    geo,
    new THREE.MeshStandardMaterial({
      map: rockTex,
      color: 0x888888,
      roughness: 0.8,
      metalness: 0.05,
    }),
    spots.length,
  );
  rocks.castShadow = rocks.receiveShadow = true;

  const mat = new THREE.Matrix4();
  spots.forEach(([x, y, z], i) => {
    const s = 1 + Math.random() * 2.4;
    mat.compose(
      new THREE.Vector3(x, y + s * 0.4, z),
      new THREE.Quaternion().random(),
      new THREE.Vector3(s, s * 0.7, s),
    );
    rocks.setMatrixAt(i, mat);
    // rocks use bright base color for bloom
  });

  scene.add(rocks);
}

/* ── Helpers ────────────────────────────────────────────────────────── */
function scatter(count, minR, maxR) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    out.push([x, terrainHeight(x, z), z]);
  }
  return out;
}
