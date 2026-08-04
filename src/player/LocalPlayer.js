import * as THREE from 'three';
import { buildAvatar, animateAvatar, buildNameplate, setAvatarColor } from './avatar.js';
import { terrainHeight } from '../world/terrain.js';
import { PHYSICS, ANIM_STATE, PLAYER_COLORS } from '../constants.js';
import { wind } from '../world/wind.js';
import { MODEL_COUNT } from './ModelLoader.js';
import { Cape } from './Cape.js';

export class LocalPlayer {
  constructor(scene) {
    this.colorIndex  = 7;
    this.color       = PLAYER_COLORS[this.colorIndex].hex;
    this.modelIndex  = 0;   // Mixamo — the only character model
    this.username    = 'guest';

    this.avatar = buildAvatar(this.color, this.modelIndex);
    this.avatar.position.set(0, terrainHeight(0, 0), 0);

    // Nameplate above the head
    this.nameplate = buildNameplate(this.username, 'you');
    this.nameplate.position.y = 2.5;
    this.avatar.add(this.nameplate);

    scene.add(this.avatar);

    // Cape — cloth physics (disabled temporarily)
    // this.cape = new Cape(scene, this.avatar, 0xcc6633);
    this.cape = null;

    this.vy            = 0;
    this.grounded      = true;
    this.flying        = false;
    this.animState     = ANIM_STATE.IDLE;
    this.emoteT        = 0;
    this.emoting       = false;
    this.currentEmoteId = null;
    this._prevPos = this.avatar.position.clone();
  }

  get position() { return this.avatar.position; }

  jump() {
    console.log('[LocalPlayer] jump() called, grounded:', this.grounded);
    if (!this.flying) {
      this.vy        = PHYSICS.JUMP_IMPULSE;
      this.grounded  = false;
      this.animState = ANIM_STATE.JUMP;
    }
  }

  toggleFly() {
    this.flying = !this.flying;
    if (this.flying) {
      this.grounded = false;
      this.vy = 0;
      const minY = terrainHeight(this.position.x, this.position.z) + 1.4;
      if (this.position.y < minY) this.position.y = minY;
    }
    return this.flying;
  }

  playEmote(id) {
    this.emoting        = true;
    this.emoteT         = 0;
    this.currentEmoteId = id;
    this.animState      = ANIM_STATE.EMOTE;
    setTimeout(() => {
      this.emoting        = false;
      this.currentEmoteId = null;
    }, 2500);
  }

  setColor(hex) {
    this.color = hex;
    setAvatarColor(this.avatar, hex);
  }

  setUsername(name) {
    this.username = name;
    // Rebuild nameplate
    if (this.nameplate) {
      this.avatar.remove(this.nameplate);
      this.nameplate.material.map?.dispose();
      this.nameplate.material.dispose();
    }
    this.nameplate = buildNameplate(name, 'you');
    this.nameplate.position.y = 2.5;
    this.avatar.add(this.nameplate);
  }

  update(dt, inputVec, camYaw, energy, t) {
    const p = this.position;

    // Movement
    const speed = inputVec.run
      ? PHYSICS.RUN_SPEED
      : (inputVec.x !== 0 || inputVec.y !== 0) ? PHYSICS.WALK_SPEED : 0;
    const moving = speed > 0;

    if (moving) {
      const angle = camYaw + Math.atan2(inputVec.x, inputVec.y);
      p.x -= Math.sin(angle) * speed * dt;
      p.z -= Math.cos(angle) * speed * dt;
      this.avatar.rotation.y = angle + Math.PI;
    }

    // Vertical
    if (this.flying) {
      if (inputVec.rise) p.y += PHYSICS.FLY_SPEED * dt;
      if (inputVec.fall) p.y -= PHYSICS.FLY_SPEED * dt;
      const minY = terrainHeight(p.x, p.z) + 0.05;
      if (p.y < minY) { p.y = minY; this.flying = false; }
    } else {
      this.vy += PHYSICS.GRAVITY * dt;
      p.y += this.vy * dt;
      const ground = terrainHeight(p.x, p.z);
      if (p.y <= ground + 0.5) { p.y = ground; this.vy = 0; this.grounded = true; }
    }

    // Clamp to world
    p.x = THREE.MathUtils.clamp(p.x, -200, 200);
    p.z = THREE.MathUtils.clamp(p.z, -200, 200);

    // Anim state
    if (!this.emoting) {
      if (this.flying)                         this.animState = ANIM_STATE.FLY;
      else if (!this.grounded && this.vy > 1.0)  this.animState = ANIM_STATE.JUMP;
      else if (!this.grounded)                   this.animState = ANIM_STATE.FALL;
      else if (speed >= PHYSICS.RUN_SPEED)     this.animState = ANIM_STATE.RUN;
      else if (moving)                         this.animState = ANIM_STATE.WALK;
      else                                     this.animState = ANIM_STATE.IDLE;
    }

    animateAvatar(this.avatar, this.animState, t, energy, dt, this.currentEmoteId, wind);

    // Cape physics — compute velocity from position delta
    const pos = this.avatar.position;
    if (this.cape) {
      const charVel = new THREE.Vector3(
        pos.x - this._prevPos.x,
        pos.y - this._prevPos.y,
        pos.z - this._prevPos.z,
      ).divideScalar(Math.max(dt, 0.001));
      this.cape.update(dt, wind.dir.clone().multiplyScalar(wind.strength), charVel);
    }
    this._prevPos.copy(pos);
  }

  getNetworkState(username) {
    const p = this.position;
    return {
      transform: {
        position:  { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) },
        rotationY: +this.avatar.rotation.y.toFixed(3),
      },
      state: {
        animState:     this.animState,
        activeEmoteId: this.emoting ? this.currentEmoteId : null,
        color:         this.color,
        modelIndex:    this.modelIndex,
      },
      username,
    };
  }
}
