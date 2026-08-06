import * as THREE from 'three';

/* ========================================================================
   Giant Geometric Monoliths — "2001: A Space Odyssey" vibe
   Massive dark slabs leaning slightly, scattered across the horizon.
   Thin neon edge-trim echoes the Evangelion theme of the world.
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
  const slabGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth, 1, 1, 1);
  const slab = new THREE.Mesh(slabGeo, slabMat);
  slab.position.y = cfg.height / 2;
  g.add(slab);

  // Neon edge trim (thin bright boxes along the 4 vertical edges — blooms)
  const trimMat = new THREE.MeshBasicMaterial({ color: cfg.trim ?? 0x00ffcc });
  const trimW = 0.35;
  const hx = cfg.width / 2, hz = cfg.depth / 2;
  const edges = [
    { x: -hx, z: -hz }, { x: hx, z: -hz },
    { x: -hx, z:  hz }, { x: hx, z:  hz },
  ];
  edges.forEach(e => {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(trimW, cfg.height - 2, trimW),
      trimMat,
    );
    bar.position.set(e.x, cfg.height / 2, e.z);
    g.add(bar);
  });

  // Slight lean (like the reference image)
  g.rotation.z = cfg.lean ?? 0.02;
  g.rotation.x = cfg.tilt ?? 0.0;

  g.position.set(cfg.x, 0, cfg.z);

  // Pulse data
  g.userData = { pulse: cfg.pulse ?? 0.15, phase: cfg.phase ?? 0 };

  return { group: g, trimMat, cfg };
}

export function buildMonoliths(scene) {
  const items = [];

  const configs = [
    // Left horizon cluster
    { x: -520, z: -420, width: 26,  height: 300, depth: 18, lean:  0.05, color: 0x232c40, phase: 0.0 },
    { x: -430, z: -480, width: 14,  height: 190, depth: 10, lean: -0.04, color: 0x303b52, trim: 0x66ccff, phase: 1.3 },
    { x: -610, z: -360, width: 10,  height: 120, depth: 8,  lean:  0.08, color: 0x1d2436, phase: 2.1 },
    // Center horizon (the big one)
    { x: 0,    z: -560, width: 40,  height: 460, depth: 26, lean:  0.03, color: 0x1a2233, trim: 0x00ffcc, phase: 0.6, pulse: 0.25 },
    { x: 70,   z: -500, width: 16,  height: 230, depth: 11, lean: -0.03, color: 0x2a3449, phase: 2.6 },
    // Right horizon cluster
    { x: 480,  z: -400, width: 22,  height: 270, depth: 15, lean: -0.05, color: 0x232c40, phase: 1.1 },
    { x: 570,  z: -470, width: 12,  height: 160, depth: 9,  lean:  0.06, color: 0x303b52, trim: 0x66ccff, phase: 0.3 },
    { x: 660,  z: -340, width: 9,   height: 105, depth: 7,  lean: -0.09, color: 0x1d2436, phase: 2.9 },
    // Far background giants
    { x: -800, z: -700, width: 60,  height: 700, depth: 40, lean:  0.02, color: 0x141a28, trim: 0x00ffcc, phase: 1.8, pulse: 0.3 },
    { x: 820,  z: -680, width: 55,  height: 640, depth: 36, lean: -0.02, color: 0x141a28, trim: 0x66ccff, phase: 2.2, pulse: 0.28 },
  ];

  configs.forEach(cfg => {
    const { group, trimMat } = _makeMonolith(cfg);
    scene.add(group);
    items.push({ group, trimMat, cfg });
  });

  return {
    items,
    /** Pulse the neon trim gently; t = elapsed seconds, energy = 0..1 */
    update(t, energy = 1) {
      for (const it of items) {
        const p = it.cfg.pulse ?? 0.15;
        const ph = it.cfg.phase ?? 0;
        const k = 0.55 + 0.45 * Math.sin(t * 0.8 + ph) * (0.4 + energy * 0.6);
        it.trimMat.opacity = 0.6 + 0.4 * k;
        it.trimMat.transparent = true;
      }
    },
  };
}
