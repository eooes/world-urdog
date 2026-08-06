import * as THREE from 'three';

/* ========================================================================
   Giant Geometric Monoliths — "2001: A Space Odyssey" vibe
   Massive dark slate slabs leaning slightly, scattered across the horizon.
   Plain dark material — no neon trim, no stroke.
   ======================================================================== */

function _makeMonolith(cfg) {
  const g = new THREE.Group();

  // Dark slate slab (lit by sun; too dark to bloom)
  const slabMat = new THREE.MeshStandardMaterial({
    color: cfg.color ?? 0x2a3348,
    roughness: 0.55,
    metalness: 0.35,
    side: THREE.DoubleSide,
  });
  const slabGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth);
  const slab = new THREE.Mesh(slabGeo, slabMat);
  slab.position.y = cfg.height / 2;
  g.add(slab);

  // Slight lean (like the reference image)
  g.rotation.z = cfg.lean ?? 0.02;
  g.rotation.x = cfg.tilt ?? 0.0;

  g.position.set(cfg.x, 0, cfg.z);

  return g;
}

export function buildMonoliths(scene) {
  const configs = [
    // Left horizon cluster
    { x: -520, z: -420, width: 26,  height: 300, depth: 18, lean:  0.05, color: 0x232c40 },
    { x: -430, z: -480, width: 14,  height: 190, depth: 10, lean: -0.04, color: 0x303b52 },
    { x: -610, z: -360, width: 10,  height: 120, depth: 8,  lean:  0.08, color: 0x1d2436 },
    // Center horizon (the big one)
    { x: 0,    z: -560, width: 40,  height: 460, depth: 26, lean:  0.03, color: 0x1a2233 },
    { x: 70,   z: -500, width: 16,  height: 230, depth: 11, lean: -0.03, color: 0x2a3449 },
    // Right horizon cluster
    { x: 480,  z: -400, width: 22,  height: 270, depth: 15, lean: -0.05, color: 0x232c40 },
    { x: 570,  z: -470, width: 12,  height: 160, depth: 9,  lean:  0.06, color: 0x303b52 },
    { x: 660,  z: -340, width: 9,   height: 105, depth: 7,  lean: -0.09, color: 0x1d2436 },
    // Far background giants
    { x: -800, z: -700, width: 60,  height: 700, depth: 40, lean:  0.02, color: 0x141a28 },
    { x: 820,  z: -680, width: 55,  height: 640, depth: 36, lean: -0.02, color: 0x141a28 },
  ];

  const items = [];
  configs.forEach(cfg => {
    const g = _makeMonolith(cfg);
    scene.add(g);
    items.push(g);
  });

  return {
    items,
    /** Static monoliths — no per-frame updates needed */
    update() {},
  };
}
