import * as THREE from 'three';

/* ========================================================================
   Evangelion Neon Crosses — separated for clarity
   Pure neon green, only objects above bloom threshold
   ======================================================================== */

function _makeCross(armW, armH, crossW, crossH) {
  const green = 0x00ff00;  // pure neon — green channel 1.0
  const g = new THREE.Group();

  const mat = new THREE.MeshBasicMaterial({ color: green });

  // Vertical arm
  const vGeo = new THREE.BoxGeometry(armW, crossH, 0.5);
  const vMesh = new THREE.Mesh(vGeo, mat);
  vMesh.position.set(0, crossH / 2, 0);
  g.add(vMesh);

  // Horizontal arm
  const hGeo = new THREE.BoxGeometry(crossW, armH, 0.5);
  const hMesh = new THREE.Mesh(hGeo, mat);
  hMesh.position.set(0, crossH * 0.7, 0);
  g.add(hMesh);

  return g;
}

export function buildEvangelionCrosses(scene) {
  const crosses = [];

  // 8 crosses spanning the horizon
  const configs = [
    { w: 12, h: 80, aw: 6,  ah: 3, x: -200, y: 45, z: -100, s: 1.8 },
    { w: 10, h: 65, aw: 5,  ah: 2, x: -100, y: 50, z: -90,  s: 1.5 },
    { w: 15, h: 100, aw: 8,  ah: 4, x: 0,    y: 55, z: -85,  s: 2.2 },
    { w: 11, h: 70, aw: 5,  ah: 3, x: 100,  y: 48, z: -95,  s: 1.6 },
    { w: 14, h: 90, aw: 7,  ah: 3, x: 200,  y: 52, z: -90,  s: 2.0 },
    { w: 9,  h: 55, aw: 4,  ah: 2, x: -260, y: 42, z: -105, s: 1.3 },
    { w: 10, h: 60, aw: 5,  ah: 2, x: 260,  y: 44, z: -100, s: 1.4 },
    { w: 8,  h: 50, aw: 4,  ah: 2, x: -320, y: 40, z: -110, s: 1.1 },
  ];

  configs.forEach(cfg => {
    const c = _makeCross(cfg.aw, cfg.ah, cfg.w, cfg.h);
    c.position.set(cfg.x, cfg.y, cfg.z);
    crosses.push({
      group: c,
      groundPos: new THREE.Vector3(cfg.x, 0, cfg.z),
      scale: cfg.s,
    });
  });

  crosses.forEach(c => scene.add(c.group));

  return {
    crosses,
    getGroundPositions: () => crosses.map(c => ({
      x: c.groundPos.x,
      z: c.groundPos.z,
      s: c.scale,
    })),
  };
}