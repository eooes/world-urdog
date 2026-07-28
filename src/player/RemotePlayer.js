import * as THREE from 'three';
import { buildAvatar, animateAvatar } from './avatar.js';
import { terrainHeight } from '../world/terrain.js';
import { NET } from '../constants.js';
import { wind } from '../world/wind.js';
import { MODEL_COUNT } from './ModelLoader.js';

function buildNameplate(text, sub) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 140;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 512, 140);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#666666';  // lum ~0.40 — safely below any bloom threshold
  ctx.font = '600 46px Inter, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur  = 6;
  ctx.fillText(text, 256, 54);
  if (sub) {
    ctx.font = '400 30px Inter, sans-serif';
    ctx.fillStyle = 'rgba(130,130,140,0.65)';  // below bloom threshold
    ctx.fillText(sub, 256, 100);
  }
  const tex = new THREE.CanvasTexture(cv);
  const sp  = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }),
  );
  sp.scale.set(4.2, 1.15, 1);
  sp.center.set(0.5, 0);
  return sp;
}

export class RemotePlayer {
  constructor(scene, id, username, locationStr, colorHex, modelIndex) {
    this.id       = id;
    this.username = username;

    // Assign a model (network-provided, or random)
    const mIdx = (modelIndex != null && modelIndex >= 0 && modelIndex < MODEL_COUNT)
      ? modelIndex
      : Math.floor(Math.random() * MODEL_COUNT);

    this.avatar = buildAvatar(colorHex, mIdx);
    this.avatar.position.set(0, 0, -14);

    const np = buildNameplate(username, locationStr);
    np.position.y = 2.5;
    this.avatar.add(np);
    this.nameplate = np;

    scene.add(this.avatar);

    // Network interpolation targets
    this._targetPos  = this.avatar.position.clone();
    this._targetRotY = 0;
    this._animState  = 'IDLE';
    this._emoteId    = null;
    this._lastSeen   = performance.now();
  }

  applySnapshot(snapshot) {
    const { transform, state } = snapshot;
    this._targetPos.set(transform.position.x, transform.position.y, transform.position.z);
    this._targetRotY = transform.rotationY;
    this._animState  = state.animState;
    this._emoteId    = state.activeEmoteId ?? null;
    this._lastSeen   = performance.now();
  }

  update(dt, t, energy) {
    this.avatar.position.lerp(this._targetPos, NET.LERP_ALPHA);
    this.avatar.rotation.y += (this._targetRotY - this.avatar.rotation.y) * NET.LERP_ALPHA;

    const ground = terrainHeight(this.avatar.position.x, this.avatar.position.z);
    if (this.avatar.position.y < ground) this.avatar.position.y = ground;

    animateAvatar(this.avatar, this._animState, t, energy, dt, this._emoteId, wind);
  }

  remove(scene) {
    const cape = this.avatar.userData.cape;
    if (cape) cape.dispose();
    scene.remove(this.avatar);
  }
}
