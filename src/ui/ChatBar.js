import * as THREE from 'three';
import { CHAT_REPLIES } from '../constants.js';

function buildBubble(text, colorHex) {
  const cv = document.createElement('canvas');
  cv.width = 420; cv.height = 70;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 420, 70);

  // background pill
  const c = new THREE.Color(colorHex);
  ctx.fillStyle = `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},0.55)`;
  ctx.beginPath();
  ctx.roundRect(4, 4, 412, 62, 28);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = '500 26px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.slice(0, 30), 210, 37);

  const tex = new THREE.CanvasTexture(cv);
  const sp  = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }),
  );
  sp.scale.set(3.5, 0.58, 1);
  sp.center.set(0.5, 0);
  return sp;
}

export class ChatBar {
  constructor(scene, npcs, net) {
    this._scene    = scene;
    this._npcs     = npcs; // NpcCrowd instance
    this._net      = net ?? null; // RoomClient — send chat over the network
    this._barEl    = document.getElementById('chatbar');
    this._inputEl  = document.getElementById('chatInput');
    this._btnEl    = document.getElementById('chatBtn');
    this._open     = false;
    this._bubbles  = [];

    this._btnEl.addEventListener('click', () => this._open ? this.close() : this.open());
  }

  get isOpen() { return this._open; }

  open() {
    this._open = true;
    this._barEl.classList.add('open');
    this._inputEl.focus();
  }

  close() {
    this._open = false;
    this._barEl.classList.remove('open');
    this._inputEl.blur();
    this._inputEl.value = '';
  }

  send(playerAvatar, colorHex) {
    const txt = this._inputEl.value.trim().slice(0, 30);
    if (txt) {
      this.spawnBubble(playerAvatar, txt, colorHex);

      // Send over the network so other players see it
      if (this._net?.online) {
        this._net.sendChat(txt);
      } else {
        // Offline — simulated NPC reply
        const npcs = this._npcs?.npcs;
        if (npcs?.length) {
          const n = npcs[(Math.random() * npcs.length) | 0];
          const reply = CHAT_REPLIES[(Math.random() * CHAT_REPLIES.length) | 0];
          setTimeout(() => this.spawnBubble(n.player.avatar, reply, 0xffffff), 700 + Math.random() * 900);
        }
      }
    }
    this.close();
  }

  spawnBubble(avatar, text, colorHex) {
    const sp = buildBubble(text, colorHex);
    sp.position.y = 2.8;
    avatar.add(sp);
    this._bubbles.push({ sp, avatar, t: 0, life: 3.5 });
  }

  update(dt) {
    for (let i = this._bubbles.length - 1; i >= 0; i--) {
      const b = this._bubbles[i];
      b.t += dt;
      const fade = Math.max(0, 1 - (b.t / b.life));
      b.sp.material.opacity = fade;
      b.sp.position.y = 2.8 + b.t * 0.15;
      if (b.t >= b.life) {
        b.avatar.remove(b.sp);
        this._bubbles.splice(i, 1);
      }
    }
  }
}
