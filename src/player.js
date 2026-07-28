import * as THREE from 'three';
import { camera } from './renderer.js';
import { terrainH, colliders } from './terrain.js';
import { WALK_SPEED, RUN_SPEED, FLY_SPEED } from './config.js';

/* ------------------------------------------------------------------
   Input state — exported so peers.js can read joyVec for debug tools
   ------------------------------------------------------------------ */
export const keys   = {};
export const joyVec = { x: 0, y: 0 };

/* ------------------------------------------------------------------
   Camera rig
   ------------------------------------------------------------------ */
export const camRig = { yaw: 0.4, pitch: 0.32, dist: 7, distGoal: 7 };

const camTarget = new THREE.Vector3();
const ray       = new THREE.Raycaster();

/* ------------------------------------------------------------------
   Per-frame player physics state
   ------------------------------------------------------------------ */
export const playerState = {
  vy: 0, grounded: true, speed: 0, emote: 0, emoteT: 0,
};

/* ------------------------------------------------------------------
   setupInput — wires keyboard, joystick, camera drag, wheel zoom
   callbacks: { onJump, onEmote, onFly, onChat(action) }
   ------------------------------------------------------------------ */
export function setupInput(domElement, gameState, callbacks) {
  const { onJump, onEmote, onFly, onChat } = callbacks;

  // Keyboard
  window.addEventListener('keydown', e => {
    if (gameState.chatting) {
      if (e.code === 'Enter')  { onChat('send');  return; }
      if (e.code === 'Escape') { onChat('close'); return; }
      return;
    }
    if (e.target.tagName === 'INPUT') return;
    keys[e.code] = true;
    if (e.code === 'KeyE')  { onEmote(); }
    if (e.code === 'KeyF')  { onFly();   }
    if (e.code === 'Enter') { onChat('open'); e.preventDefault(); }
    if (e.code === 'Space') { if (!gameState.flying) onJump(); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  // Virtual joystick (mobile)
  const joyEl  = document.getElementById('joy');
  const nubEl  = joyEl.querySelector('.nub');
  const isTouch = matchMedia('(pointer:coarse)').matches;
  if (isTouch) {
    joyEl.style.display = 'block';
    const hint = document.getElementById('hint');
    if (hint) hint.style.display = 'none';
  }

  let joyId = null, joyCenter = { x: 0, y: 0 };

  const startJoy = (e) => {
    joyId = e.pointerId;
    const r = joyEl.getBoundingClientRect();
    joyCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    moveJoy(e);
  };
  const moveJoy = (e) => {
    let dx = e.clientX - joyCenter.x, dy = e.clientY - joyCenter.y;
    const max = 48, d = Math.hypot(dx, dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    nubEl.style.transform = `translate(${dx}px,${dy}px)`;
    joyVec.x = dx / max; joyVec.y = dy / max;
  };
  const endJoy = () => {
    joyId = null; joyVec.x = 0; joyVec.y = 0;
    nubEl.style.transform = 'translate(0,0)';
  };

  joyEl.addEventListener('pointerdown', e => { joyEl.setPointerCapture(e.pointerId); startJoy(e); });
  joyEl.addEventListener('pointermove', e => { if (e.pointerId === joyId) moveJoy(e); });
  joyEl.addEventListener('pointerup',     endJoy);
  joyEl.addEventListener('pointercancel', endJoy);

  // Camera drag (right half of screen or mouse)
  let lookId = null, lookLast = { x: 0, y: 0 };

  domElement.addEventListener('pointerdown', e => {
    if (joyId !== null && e.pointerId === joyId) return;
    lookId = e.pointerId; lookLast = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointermove', e => {
    if (e.pointerId !== lookId) return;
    const dx = e.clientX - lookLast.x, dy = e.clientY - lookLast.y;
    lookLast = { x: e.clientX, y: e.clientY };
    camRig.yaw   -= dx * 0.005;
    camRig.pitch  = THREE.MathUtils.clamp(camRig.pitch - dy * 0.004, -0.15, 1.1);
  });
  window.addEventListener('pointerup', e => { if (e.pointerId === lookId) lookId = null; });

  // Scroll zoom
  domElement.addEventListener('wheel', e => {
    camRig.distGoal = THREE.MathUtils.clamp(camRig.distGoal + e.deltaY * 0.01, 3, 16);
    e.preventDefault();
  }, { passive: false });

  // Jump button (mobile)
  const jumpBtn = document.getElementById('jumpBtn');
  jumpBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    gameState.jumpHeld = true;
    if (!gameState.flying) onJump();
  });
  jumpBtn.addEventListener('pointerup',     () => { gameState.jumpHeld = false; });
  jumpBtn.addEventListener('pointercancel', () => { gameState.jumpHeld = false; });

  return joyEl;
}

/* ------------------------------------------------------------------
   updatePlayer — movement, gravity/flight, animation
   ------------------------------------------------------------------ */
export function updatePlayer(player, dt, gameState) {
  // Build input vector
  let ix = 0, iz = 0;
  if (!gameState.chatting) {
    if (keys['KeyW']    || keys['ArrowUp'])    iz -= 1;
    if (keys['KeyS']    || keys['ArrowDown'])  iz += 1;
    if (keys['KeyA']    || keys['ArrowLeft'])  ix -= 1;
    if (keys['KeyD']    || keys['ArrowRight']) ix += 1;
  }
  if (joyVec.x || joyVec.y) { ix = joyVec.x; iz = joyVec.y; }

  const running = !gameState.flying && (
    keys['ShiftLeft'] || keys['ShiftRight'] || Math.hypot(ix, iz) > 0.85
  );
  const mag = Math.min(1, Math.hypot(ix, iz));
  const gY  = terrainH(player.position.x, player.position.z);

  // Horizontal movement (camera-relative)
  if (mag > 0.05) {
    const ca = Math.cos(camRig.yaw), sa = Math.sin(camRig.yaw);
    const fx = -sa, fz = -ca, rx = ca, rz = -sa;
    let dx = fx * (-iz) + rx * ix, dz = fz * (-iz) + rz * ix;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;

    const spd = (gameState.flying ? FLY_SPEED : running ? RUN_SPEED : WALK_SPEED) * mag;
    player.position.x += dx * spd * dt;
    player.position.z += dz * spd * dt;

    const tYaw = Math.atan2(dx, dz);
    const diff  = ((tYaw - player.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    player.rotation.y += diff * Math.min(1, dt * 12);
    playerState.speed = spd;
  } else {
    playerState.speed *= 0.8;
  }

  // World boundary clamp
  const R  = 195;
  const pr = Math.hypot(player.position.x, player.position.z);
  if (pr > R) { player.position.x *= R / pr; player.position.z *= R / pr; }

  // Vertical: flight or gravity
  if (gameState.flying) {
    const up = keys['Space'] || gameState.jumpHeld;
    player.position.y += (up ? 6.0 : -1.6) * dt;
    const minY = gY + 0.2;
    if (player.position.y <= minY) {
      player.position.y = minY;
      if (!up) { gameState.flying = false; playerState.grounded = true; }
    }
  } else {
    playerState.vy      -= 20 * dt;
    player.position.y   += playerState.vy * dt;
    if (player.position.y <= gY) {
      player.position.y   = gY;
      playerState.vy      = 0;
      playerState.grounded = true;
    }
  }

  // Avatar animation
  const t      = performance.now() / 1000;
  const moving = playerState.speed > 0.2;
  const fast   = playerState.speed > 4;
  const ud     = player.userData;
  let flap;

  if (playerState.emoteT > 0) {
    playerState.emoteT -= dt;
    if (playerState.emote === 5) player.rotation.y += dt * 6;
    player.position.y = (gameState.flying ? player.position.y : gY)
      + Math.abs(Math.sin(t * 8)) * (playerState.emote === 3 ? 0.4 : 0.15);
    flap = Math.sin(t * 10) * 0.5;
  } else {
    const bob = moving ? Math.sin(t * (fast ? 16 : 10)) * 0.06 : Math.sin(t * 2) * 0.02;
    ud.head.position.y  = 1.68 + bob * 0.5;
    ud.halo.position.y  = 2.06 + bob * 0.5;
    player.rotation.z   = moving ? Math.sin(t * (fast ? 16 : 10)) * 0.04 : 0;
    flap = Math.sin(t * (gameState.flying ? 9 : 3)) * (gameState.flying ? 0.6 : 0.16);
  }
  ud.wings[0].rotation.z = flap;
  ud.wings[1].rotation.z = -flap;
  ud.halo.rotation.z    += dt * 0.6;
}

/* ------------------------------------------------------------------
   updateCamera — spring-arm with raycast occlusion
   ------------------------------------------------------------------ */
export function updateCamera(player, dt) {
  const { x: px, z: pz, y: py } = player.position;
  camTarget.set(px, py + 1.8, pz);

  const cp  = Math.cos(camRig.pitch), sp = Math.sin(camRig.pitch);
  const dir = new THREE.Vector3(Math.sin(camRig.yaw) * cp, sp, Math.cos(camRig.yaw) * cp);

  ray.set(camTarget, dir);
  const hits = ray.intersectObjects(colliders, true);
  let maxD = camRig.distGoal;
  if (hits.length && hits[0].distance < maxD) maxD = Math.max(1.6, hits[0].distance - 0.4);
  camRig.dist += (maxD - camRig.dist) * Math.min(1, dt * 12);

  const pos  = camTarget.clone().add(dir.multiplyScalar(camRig.dist));
  const minY = terrainH(pos.x, pos.z) + 0.6;
  if (pos.y < minY) pos.y = minY;
  camera.position.lerp(pos, Math.min(1, dt * 10));
  camera.lookAt(camTarget);
}
