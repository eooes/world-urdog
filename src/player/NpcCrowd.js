import * as THREE from 'three';
import { RemotePlayer } from './RemotePlayer.js';
import { terrainHeight } from '../world/terrain.js';
import { NPC_NAMES, NPC_LOCS, PLAYER_COLORS } from '../constants.js';
import { MODEL_COUNT } from './ModelLoader.js';

export class NpcCrowd {
  constructor(scene) {
    this.scene = scene;
    this.npcs  = [];
  }

  setCrowd(count) {
    this.npcs.forEach(n => n.player.remove(this.scene));
    this.npcs = [];

    for (let i = 0; i < count; i++) {
      const colorHex  = PLAYER_COLORS[(i * 3 + 2) % PLAYER_COLORS.length].hex;
      const name      = NPC_NAMES[i % NPC_NAMES.length];
      const loc       = NPC_LOCS[i % NPC_LOCS.length];
      const modelIndex = i % MODEL_COUNT;   // cycle through all 3 models

      const rp = new RemotePlayer(this.scene, `npc_${i}`, name, loc, colorHex, modelIndex);

      const ang = Math.random() * Math.PI * 2;
      const rad = 8 + Math.random() * Math.min(70, 22 + count * 1.8);
      const x   = Math.cos(ang) * rad;
      const z   = -14 + Math.sin(ang) * rad * 0.5;
      rp.avatar.position.set(x, terrainHeight(x, z), z);
      rp._targetPos.copy(rp.avatar.position);

      this.npcs.push({
        player: rp,
        target: new THREE.Vector3(),
        timer:  Math.random() * 5,
        phase:  Math.random() * 6,
      });
      this._pickTarget(this.npcs[this.npcs.length - 1]);
    }
  }

  _pickTarget(npc) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 6 + Math.random() * 30;
    npc.target.set(Math.cos(ang) * rad, 0, -14 + Math.sin(ang) * rad * 0.6);
    npc.target.y = terrainHeight(npc.target.x, npc.target.z);
    npc.timer = 3 + Math.random() * 5;
  }

  update(dt, t, energy) {
    for (const npc of this.npcs) {
      npc.timer -= dt;

      const p    = npc.player.avatar.position;
      const dist = p.distanceTo(npc.target);

      if (dist > 0.5) {
        const dir = npc.target.clone().sub(p).normalize();
        npc.player._targetPos.copy(p).addScaledVector(dir, 3.5 * dt);
        npc.player._targetRotY = Math.atan2(-dir.x, -dir.z) + Math.PI;
        npc.player._animState  = 'WALK';
      } else {
        npc.player._animState = 'IDLE';
      }

      if (npc.timer <= 0) this._pickTarget(npc);

      npc.player.update(dt, t, energy);
    }
  }

  get count() { return this.npcs.length; }
}
