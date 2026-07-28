import * as THREE from 'three';
import { scene } from './renderer.js';
import { terrainH } from './terrain.js';
import { buildAvatar, makeNameplate } from './avatar.js';
import { PLAYER_COLORS, PEER_NAMES, PEER_LOCS, EMOTES } from './config.js';

export const npcs = [];

function pickTarget(n) {
  const ang = Math.random() * Math.PI * 2;
  const rad = 6 + Math.random() * 30;
  n.target.set(Math.cos(ang) * rad, 0, -14 + Math.sin(ang) * rad * 0.6);
  n.t = 3 + Math.random() * 5;
}

/* ------------------------------------------------------------------
   setCrowd — rebuild NPC pool to `count` peers
   spawnBubble(obj, text, color) provided by ui/chat module
   ------------------------------------------------------------------ */
export function setCrowd(count, spawnBubble) {
  npcs.forEach(n => scene.remove(n.obj));
  npcs.length = 0;

  for (let i = 0; i < count; i++) {
    const col = PLAYER_COLORS[(i * 3 + 2) % PLAYER_COLORS.length].hex;
    const a   = buildAvatar(col);

    const ang = Math.random() * Math.PI * 2;
    const rad = 8 + Math.random() * Math.min(70, 22 + count * 1.8);
    a.position.set(Math.cos(ang) * rad, 0, -14 + Math.sin(ang) * rad * 0.5);
    a.position.y = terrainH(a.position.x, a.position.z);

    const np = makeNameplate(PEER_NAMES[i % PEER_NAMES.length], PEER_LOCS[i % PEER_LOCS.length]);
    np.position.y = 2.5;
    a.add(np);
    scene.add(a);

    const npc = {
      obj:    a,
      np,
      target: new THREE.Vector3(),
      t:      Math.random() * 5,
      phase:  Math.random() * 6,
      speed:  0,
    };
    npcs.push(npc);
    pickTarget(npc);
  }

  const popEl = document.getElementById('pop');
  if (popEl) popEl.textContent = npcs.length + 1;
}

/* ------------------------------------------------------------------
   updateNPCs — per-frame NPC movement + animation + random emotes
   ------------------------------------------------------------------ */
export function updateNPCs(dt, spawnBubble) {
  const t = performance.now() / 1000;

  npcs.forEach(n => {
    n.t -= dt;
    if (n.t <= 0) pickTarget(n);

    const o  = n.obj;
    const dx = n.target.x - o.position.x;
    const dz = n.target.z - o.position.z;
    const d  = Math.hypot(dx, dz);

    if (d > 0.6) {
      const spd = 2.2;
      o.position.x += dx / d * spd * dt;
      o.position.z += dz / d * spd * dt;

      const ty   = Math.atan2(dx, dz);
      const diff = ((ty - o.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      o.rotation.y += diff * Math.min(1, dt * 8);
      o.position.y  = terrainH(o.position.x, o.position.z) + Math.abs(Math.sin(t * 8 + n.phase)) * 0.07;
      n.speed = spd;
    } else {
      n.speed     *= 0.9;
      o.position.y = terrainH(o.position.x, o.position.z);
    }

    // Wing flap
    const f = Math.sin(t * 3 + n.phase) * 0.16;
    o.userData.wings[0].rotation.z = f;
    o.userData.wings[1].rotation.z = -f;
    o.userData.halo.rotation.z    += dt * 0.5;

    // Occasional random emote bubble (simulates network broadcast)
    if (Math.random() < 0.0008) {
      const em = EMOTES[(Math.random() * EMOTES.length) | 0];
      spawnBubble(o, em.i, 0xffffff);
    }
  });
}
