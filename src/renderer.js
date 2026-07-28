import * as THREE from 'three';

const app = document.getElementById('app');

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.info.autoReset = false;
app.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xdceffb, 0.005);

export const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 900);

// Directional sun — exported so timeline can modulate its intensity
export const sun = new THREE.DirectionalLight(0xfff4e6, 1.75);
sun.position.set(48, 70, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 7;
sun.shadow.blurSamples = 20;
sun.shadow.bias = -0.0004;
const sc = sun.shadow.camera;
sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 220;

// Hemisphere + ambient — exported so timeline can modulate
export const hemi = new THREE.HemisphereLight(0xd6ecff, 0x6f8f66, 1.15);
export const amb  = new THREE.AmbientLight(0xe3eeff, 0.55);
const fill = new THREE.DirectionalLight(0xbcd0ff, 0.45);
fill.position.set(-40, 30, -30);

scene.add(sun, sun.target, hemi, amb, fill);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
