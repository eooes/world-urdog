import * as THREE from 'three';

let _gradMap = null;

function buildGradMap(steps = 4) {
  const data = new Uint8Array(steps * 4);
  for (let i = 0; i < steps; i++) {
    const v = Math.round(50 + 205 * (i / (steps - 1)));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export function getGradMap() {
  if (!_gradMap) _gradMap = buildGradMap(4);
  return _gradMap;
}

export function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: getGradMap(), ...opts });
}

export function toonBasic(color) {
  return new THREE.MeshBasicMaterial({ color });
}

export const GLITCH_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const GLITCH_FRAG = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform float time;
  uniform float strength;
  varying vec2 vUv;

  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
  }

  void main() {
    float s = strength;
    if (s < 0.001) { gl_FragColor = texture2D(tDiffuse, vUv); return; }

    float noise = rand(vec2(floor(vUv.y * 64.0) / 64.0, time * 0.3));
    float shift = (noise - 0.5) * 0.018 * s;

    vec2 uvR = vUv + vec2( shift, 0.0);
    vec2 uvB = vUv + vec2(-shift, 0.0);

    float r = texture2D(tDiffuse, uvR).r;
    float g = texture2D(tDiffuse, vUv ).g;
    float b = texture2D(tDiffuse, uvB).b;

    float scanline = step(0.5, sin(vUv.y * 400.0 + time * 6.0)) * 0.04 * s;
    gl_FragColor = vec4(r - scanline, g - scanline, b - scanline, 1.0);
  }
`;
