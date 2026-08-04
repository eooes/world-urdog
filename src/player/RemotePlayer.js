import * as THREE from 'three';
import { buildAvatar, animateAvatar, buildNameplate, setAvatarColor } from './avatar.js';
import { terrainHeight } from '../world/terrain.js';
import { NET } from '../constants.js';
import { wind } from '../world/wind.js';
import { MODEL_COUNT } from './ModelLoader.js';

export class RemotePlayer {
  constructor(scene, id, username, locationStr, colorHex, modelIndex) {
    this.id       = id;
    this.username = username;
    this._color   = colorHex;

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
    if (transform) {
      this._targetPos.set(transform.position.x, transform.position.y, transform.position.z);
      this._targetRotY = transform.rotationY ?? 0;
    }
    if (state) {
      this._animState  = state.animState ?? this._animState;
      this._emoteId    = state.activeEmoteId ?? null;
      // Live color sync — repaint body if the remote player changed colour
      if (state.color !== undefined && state.color !== this._color) {
        this._color = state.color;
        setAvatarColor(this.avatar, state.color);
      }
    }
    if (snapshot.username && snapshot.username !== this.username) {
      this.username = snapshot.username;
      this._updateNameplate();
    }
    this._lastSeen = performance.now();
  }

  _updateNameplate() {
    if (!this.nameplate) return;
    const pos = this.nameplate.position.clone();
    this.avatar.remove(this.nameplate);
    this.nameplate.material.map?.dispose();
    this.nameplate.material.dispose();
    this.nameplate = buildNameplate(this.username, 'online');
    this.nameplate.position.copy(pos);
    this.avatar.add(this.nameplate);
  }

  /** Show a floating chat bubble above this player (incoming network chat). */
  showChat(text, colorHex) {
    const cv = document.createElement('canvas');
    cv.width = 420; cv.height = 70;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 420, 70);

    const c = new THREE.Color(colorHex ?? this._color ?? 0xffffff);
    ctx.fillStyle = `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.55)`;
    ctx.beginPath();
    ctx.roundRect(4, 4, 412, 62, 28);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '500 26px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text).slice(0, 30), 210, 37);

    const tex = new THREE.CanvasTexture(cv);
    const sp  = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }),
    );
    sp.scale.set(3.5, 0.58, 1);
    sp.center.set(0.5, 0);
    sp.position.y = 2.8;
    this.avatar.add(sp);

    this._bubble = { sp, t: 0, life: 3.5 };
  }

  update(dt, t, energy) {
    this.avatar.position.lerp(this._targetPos, NET.LERP_ALPHA);
    this.avatar.rotation.y += (this._targetRotY - this.avatar.rotation.y) * NET.LERP_ALPHA;

    const ground = terrainHeight(this.avatar.position.x, this.avatar.position.z);
    if (this.avatar.position.y < ground) this.avatar.position.y = ground;

    // Chat bubble lifecycle
    if (this._bubble) {
      this._bubble.t += dt;
      const b = this._bubble;
      b.sp.material.opacity = Math.max(0, 1 - (b.t / b.life));
      b.sp.position.y = 2.8 + b.t * 0.15;
      if (b.t >= b.life) {
        this.avatar.remove(b.sp);
        b.sp.material.map?.dispose();
        b.sp.material.dispose();
        this._bubble = null;
      }
    }

    animateAvatar(this.avatar, this._animState, t, energy, dt, this._emoteId, wind);
  }

  remove(scene) {
    const cape = this.avatar.userData.cape;
    if (cape) cape.dispose();
    scene.remove(this.avatar);
  }
}
