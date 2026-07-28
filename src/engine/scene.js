import * as THREE from 'three';
import { WORLD } from '../constants.js';

export function buildScene() {
  const scene = new THREE.Scene();
  // Exponential fog — things beyond ~150 units fade to haze
  scene.fog = new THREE.FogExp2(0x1a1a3a, 0.0001);
  return scene;
}

export function buildLighting(scene) {
  // Key light – follows player in main.js; small shadow box for efficiency
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.55);
  sun.position.set(48, 70, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius        = 6;
  sun.shadow.blurSamples   = 12;
  sun.shadow.bias          = -0.0005;
  const sc = sun.shadow.camera;
  // 30m box – tight frustum; main.js snaps it to the player each frame
  sc.left = sc.bottom = -15;
  sc.right = sc.top   =  15;
  sc.near = 1; sc.far = 80;
  scene.add(sun, sun.target);

  // Hemisphere light matched to Nocturne palette
  const hemi = new THREE.HemisphereLight(0x9baeff, 0x2a4a2a, 1.35);
  scene.add(hemi);

  // Soft ambient — ensures characters are always visible
  const amb = new THREE.AmbientLight(0xaabbcc, 0.7);
  scene.add(amb);

  // Subtle cool fill from behind
  const fill = new THREE.DirectionalLight(0x7080ff, 0.35);
  fill.position.set(-40, 30, -30);
  scene.add(fill);

  // Warm stage point-light substitute (no shadow, just colour)
  const stage = new THREE.PointLight(0xff9944, 1.8, 120, 1.5);
  stage.position.set(0, 22, -118);
  scene.add(stage);

  return { sun, hemi, amb, fill, stage };
}

export function buildCamera() {
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, WORLD.FAR_PLANE);
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });
  return camera;
}
