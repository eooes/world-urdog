import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from './terrain.js';

/* Wing shape (bezier-extruded) — built once, shared across all avatars */
const wingGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.15, 0.5,  0.15, 0.95, 0.58, 1.20);
  s.bezierCurveTo(0.52, 0.9,  0.64, 0.85, 0.90, 0.95);
  s.bezierCurveTo(0.74, 0.62, 0.76, 0.57, 0.96, 0.58);
  s.bezierCurveTo(0.76, 0.42, 0.74, 0.37, 0.88, 0.30);
  s.bezierCurveTo(0.64, 0.24, 0.58, 0.20, 0.64, 0.06);
  s.bezierCurveTo(0.42, 0.14, 0.20, 0.03, 0.00, 0.00);
  return new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false, curveSegments: 3 });
})();

/* Pre-merged eye geometry */
const eyesGeo = mergeGeometries([
  new THREE.SphereGeometry(0.045, 8, 8).translate(-0.085, 1.70, 0.205),
  new THREE.SphereGeometry(0.045, 8, 8).translate( 0.085, 1.70, 0.205),
]);

/* ------------------------------------------------------------------
   buildAvatar — returns a THREE.Group with userData.{hem,head,halo,wings}
   ------------------------------------------------------------------ */
export function buildAvatar(accentHex) {
  const g     = new THREE.Group();
  const white = toon(0xeef1f8);

  // Robe body
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.7, 14), white);
  robe.position.y = 0.85; robe.castShadow = true;
  g.add(robe);

  // Glowing hem (accent color identifies the player)
  const hem = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.06, 8, 22),
    new THREE.MeshBasicMaterial({ color: accentHex }),
  );
  hem.rotation.x = Math.PI / 2; hem.position.y = 0.05;
  g.add(hem);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 9), white);
  head.position.y = 1.68; head.castShadow = true;
  g.add(head);

  // Eyes
  const eyes = new THREE.Mesh(eyesGeo, new THREE.MeshStandardMaterial({ color: 0x2b3358, roughness: 0.5 }));
  g.add(eyes);

  // Halo
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.033, 7, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe6a3 }),
  );
  halo.position.y = 2.06; halo.rotation.x = Math.PI * 0.42;
  g.add(halo);

  // Wings — pivot(sweep) > flap > mesh
  const wingMat = toon(0xf7f9ff, { side: THREE.DoubleSide });
  const mkWing = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.07 * side, 1.22, -0.1);
    pivot.rotation.y = 0.55 * side;
    const flap = new THREE.Group();
    pivot.add(flap);
    const mesh = new THREE.Mesh(wingGeo, wingMat);
    mesh.scale.x = side; mesh.castShadow = true;
    flap.add(mesh);
    g.add(pivot);
    return flap;
  };
  const wL = mkWing(-1), wR = mkWing(1);

  g.userData = { hem, head, halo, wings: [wL, wR] };
  return g;
}

/* ------------------------------------------------------------------
   makeNameplate — returns a billboarded Sprite above avatar head
   ------------------------------------------------------------------ */
export function makeNameplate(text, sub) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 140;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 512, 140);
  ctx.textAlign = 'center';
  ctx.font = '600 46px Inter, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 6;
  ctx.fillText(text, 256, 54);
  if (sub) {
    ctx.font = '400 30px Inter, sans-serif';
    ctx.fillStyle = 'rgba(230,232,240,0.75)';
    ctx.shadowBlur = 0;
    ctx.fillText(sub, 256, 100);
  }
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }),
  );
  s.scale.set(4.2, 1.15, 1);
  s.center.set(0.5, 0);
  return s;
}
