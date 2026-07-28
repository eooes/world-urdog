import * as THREE from 'three';
import { terrainHeight } from './terrain.js';

/* ========================================================================
   EXACT Shadertoy MdsGzS grass shader ("polyanka" by w23)
   All noise/hash/shade_grass functions used verbatim.
   Adapted from raymarching to 3D instanced blades.
   ======================================================================== */

/* ── Blade-type descriptors ─────────────────────────────────────────── */
const TYPES = {
  field:  { count: 28_000, width: 0.028, hMin: 0.40, hMax: 0.85, crossed: false, flatTop: true },
  accent: { count: 12_000, width: 0.022, hMin: 0.30, hMax: 0.65, crossed: true,  flatTop: true },
  tuft:   { count:  8_000, width: 0.100, hMin: 0.18, hMax: 0.42, crossed: false, flatTop: false },
};

/* ── Geometry ───────────────────────────────────────────────────────── */
function makeBladeGeo(width, crossed, flatTop) {
  const W = width;
  const geo = new THREE.BufferGeometry();
  const positions = [], uvs = [];

  const pushQuad = (x0, z0, x1, z1, x2, z2, x3, z3) => {
    positions.push(x0, 0.0, z0, x1, 0.0, z1, x2, 1.0, z2, x3, 1.0, z3);
    uvs.push(0, 0, 1, 0, 0, 1, 1, 1);
  };

  const hw = W / 2;

  if (crossed) {
    const tipW = flatTop ? hw * 0.90 : hw * 0.25;
    pushQuad(-hw, 0, hw, 0, -tipW, 0, tipW, 0);
    pushQuad(0, -hw, 0, hw, 0, -tipW, 0, tipW);
    geo.setIndex([0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6]);
  } else {
    const tipW = flatTop ? hw * 0.92 : hw * 0.20;
    pushQuad(-hw, 0, hw, 0, -tipW, 0, tipW, 0);
    geo.setIndex([0, 1, 2, 1, 3, 2]);
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/* ── EXACT MdsGzS shader injection ──────────────────────────────────── */
function injectMdsGzSShader(material, uniforms) {
  material.onBeforeCompile = shader => {
    if (shader.uniforms) Object.assign(shader.uniforms, uniforms);

    // ── Vertex: wind animation + world position ──
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vWorldPos;
uniform float uTime;
uniform float uWindX;
uniform float uWindZ;
uniform float uWindS;
`);

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `vec3 transformed = vec3(position);

float ipx = instanceMatrix[3][0];
float ipz = instanceMatrix[3][2];

float wave  = sin(uTime * 0.58 + ipx * 0.22) * cos(uTime * 0.44 + ipz * 0.19);
wave       += sin(uTime * 0.95 + (ipx + ipz) * 0.15) * 0.35;
wave       += sin(uTime * 0.30 + ipx * 0.35 - ipz * 0.25) * 0.20;
float micro = sin(ipx * 4.91 + ipz * 6.73 + uTime * 1.7) * 0.06;
float gust  = wave + micro;

float bladeH = clamp(position.y, 0.0, 1.0);
float sway   = bladeH * bladeH * gust * uWindS;

transformed.x += uWindX * sway * 0.55;
transformed.z += uWindZ * sway * 0.55;

vWorldPos = (instanceMatrix * vec4(transformed, 1.0)).xyz;
`);

    // ── Fragment: verbatim MdsGzS functions ──
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vWorldPos;
uniform float uTime;

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

const float c_gscale  = 15.0;
const float c_gheight = 1.5;

vec2 wind_displacement(in vec2 p) {
    return noise2(p*0.1+uTime) - 0.5;
}

float grass_height(in vec3 p) {
    float base_h = -99.0; // unused for 3D — we use terrainHeight
    float depth = 1.0 - (base_h - p.y) / c_gheight;
    vec2 gpos = (p.xz + depth * wind_displacement(p.xz));
    return base_h - noise(gpos * c_gscale) * c_gheight;
}

vec3 shade_grass(in vec3 pos) {
    vec2 typepos = pos.xz + wind_displacement(pos.xz);
    float typemask1 = fnoise(2.5*typepos);
    float typemask2 = pow(fnoise(0.4*typepos), 3.0);
    float typemask3 = step(0.71, fnoise(0.8*typepos));
    vec3 col1 = vec3(0.6, 0.95, 0.4);        // bright soft green
    vec3 col2 = vec3(0.8, 0.85, 0.3)*0.5;     // yellow-green
    vec3 col3 = vec3(1.0, 1.0, 0.3);           // bright yellow
    vec3 col4 = vec3(1.0, 0.5, 0.8);           // pink flowers
    float ambient = 0.35;                        // dark — below bloom threshold
    vec3 color = mix(mix(mix(col1, col2, typemask1),
            col3, typemask2), col4, typemask3) * ambient;
    return color;
}
`);

    // Replace diffuseColor with shade_grass()
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      `vec3 grassCol = shade_grass(vWorldPos);
vec4 diffuseColor = vec4(grassCol, opacity);`
    );

    material.userData._shader = shader;
  };
}

/* ── Exclusion zones ─────────────────────────────────────────────────── */
function inExclusionZone(x, z) {
  if (Math.abs(x) < 38 && z < -90 && z > -148) return true;
  if (Math.abs(x + 60) < 16 && z > -14 && z < 54) return true;
  return false;
}

/* ── Main ────────────────────────────────────────────────────────────── */
export function buildGrassField(scene) {
  const dummy = new THREE.Object3D();

  const windUniforms = {
    uTime:  { value: 0 },
    uWindX: { value: 1 },
    uWindZ: { value: 0 },
    uWindS: { value: 0.7 },
  };

  const meshes = [];

  for (const [name, cfg] of Object.entries(TYPES)) {
    const geo = makeBladeGeo(cfg.width, cfg.crossed, cfg.flatTop);

    const mat = new THREE.MeshBasicMaterial({
      side:         THREE.DoubleSide,
      transparent:  true,
      fog:          true,
      depthWrite:   true,
    });

    injectMdsGzSShader(mat, windUniforms);

    const mesh = new THREE.InstancedMesh(geo, mat, cfg.count);
    mesh.receiveShadow = false;
    mesh.castShadow    = false;

    let placed = 0, attempts = 0;
    const isTuft = name === 'tuft';

    while (placed < cfg.count && attempts < cfg.count * 5) {
      attempts++;
      const a = Math.random() * Math.PI * 2;
      const r = 6 + Math.random() * 194;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;

      if (inExclusionZone(x, z)) continue;

      const y = terrainHeight(x, z);

      let h;
      if (Math.random() < 0.4) {
        h = cfg.hMin + Math.random() * (cfg.hMax - cfg.hMin) * 0.35;
      } else {
        h = cfg.hMin + (cfg.hMax - cfg.hMin) * 0.25 + Math.random() * (cfg.hMax - cfg.hMin) * 0.75;
      }

      const leanX = (Math.random() - 0.5) * 0.30;
      const leanZ = (Math.random() - 0.5) * 0.20;

      if (isTuft) {
        const clusterSize = 3 + Math.floor(Math.random() * 4);
        for (let ci = 0; ci < clusterSize && placed < cfg.count; ci++) {
          const ox = (Math.random() - 0.5) * 0.25;
          const oz = (Math.random() - 0.5) * 0.25;
          const ch = cfg.hMin + Math.random() * (cfg.hMax - cfg.hMin);
          dummy.position.set(x + ox, y, z + oz);
          dummy.rotation.set(
            (Math.random() - 0.5) * 0.5,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 0.4,
          );
          dummy.scale.setScalar(ch);
          dummy.updateMatrix();
          mesh.setMatrixAt(placed, dummy.matrix);
          placed++;
        }
      } else {
        dummy.position.set(x, y, z);
        dummy.rotation.set(leanX, Math.random() * Math.PI * 2, leanZ);
        dummy.scale.setScalar(h);
        dummy.updateMatrix();
        mesh.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
    }

    if (placed < cfg.count) {
      dummy.position.set(0, -999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      for (let i = placed; i < cfg.count; i++) {
        mesh.setMatrixAt(i, dummy.matrix);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    meshes.push(mesh);
  }

  return {
    meshes,
    setWind(dirVec, strength, t) {
      windUniforms.uTime.value  = t;
      windUniforms.uWindX.value = dirVec.x;
      windUniforms.uWindZ.value = dirVec.z;
      windUniforms.uWindS.value = strength;
    },
  };
}
