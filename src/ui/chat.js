import * as THREE from 'three';
import { EMOTES, PLAYER_COLORS } from '../config.js';

/* ------------------------------------------------------------------
   World-space chat bubbles
   ------------------------------------------------------------------ */
const bubbles = [];

export function spawnBubble(target, text, colorHex) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const ctx = cv.getContext('2d');

  ctx.font = '500 42px Inter, sans-serif';
  const w = Math.min(480, ctx.measureText(text).width + 56);
  const rx = (512 - w) / 2, ry = 24, rw = w, rh = 72, r = 20;

  ctx.fillStyle = 'rgba(20,22,34,0.86)';
  ctx.beginPath();
  ctx.moveTo(rx + r, ry);
  ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
  ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
  ctx.arcTo(rx, ry + rh, rx, ry, r);
  ctx.arcTo(rx, ry, rx + rw, ry, r);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(145,132,217,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, ry + rh / 2);

  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv),
      transparent: true, depthWrite: false, depthTest: false,
    }),
  );
  s.scale.set(6.4, 1.6, 1);
  s.center.set(0.5, 0);
  s.position.y = 2.9;

  target.add(s);
  bubbles.push({ s, target, t: 3.2 });
}

export function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.t -= dt;
    b.s.material.opacity = Math.min(1, b.t);
    if (b.t <= 0) {
      b.target.remove(b.s);
      bubbles.splice(i, 1);
    }
  }
}

/* ------------------------------------------------------------------
   Chat bar
   ------------------------------------------------------------------ */
export function setupChat(player, npcs, gameState) {
  const chatBar   = document.getElementById('chatbar');
  const chatInput = document.getElementById('chatInput');
  const chatBtn   = document.getElementById('chatBtn');
  const playerColorHex = PLAYER_COLORS[7].hex; // default; updated via settings

  const REPLIES = ['hi!', 'こんばんは', 'same :)', '💜', 'by my side', 'so pretty'];

  const openChat = () => {
    gameState.chatting = true;
    chatBar.classList.add('open');
    chatInput.focus();
  };
  const closeChat = () => {
    gameState.chatting = false;
    chatBar.classList.remove('open');
    chatInput.blur();
    chatInput.value = '';
  };
  const sendChat = () => {
    const txt = chatInput.value.trim().slice(0, 30);
    if (txt) {
      spawnBubble(player, txt, playerColorHex);
      if (npcs.length) {
        const n = npcs[(Math.random() * npcs.length) | 0];
        setTimeout(() => spawnBubble(n.obj, REPLIES[(Math.random() * REPLIES.length) | 0], 0xffffff),
          700 + Math.random() * 900);
      }
    }
    closeChat();
  };

  chatBtn?.addEventListener('click', () => { gameState.chatting ? closeChat() : openChat(); });

  // Exposed for player.js keyboard handler
  return { openChat, closeChat, sendChat };
}

/* ------------------------------------------------------------------
   Emote wheel
   ------------------------------------------------------------------ */
// onEmote(index) callback lets main.js update playerState directly
export function setupEmoteWheel(player, gameState, onEmote) {
  const wheelEl  = document.getElementById('wheel');
  const ring     = document.getElementById('wheelRing');
  const emoteBtn = document.getElementById('emoteBtn');

  const openWheel   = () => wheelEl.classList.add('open');
  const closeWheel  = () => wheelEl.classList.remove('open');
  const toggleWheel = () => wheelEl.classList.contains('open') ? closeWheel() : openWheel();

  EMOTES.forEach((em, i) => {
    const a  = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
    const el = document.createElement('div');
    el.className   = 'emo';
    el.textContent = em.i;
    el.style.left  = (130 + Math.cos(a) * 100) + 'px';
    el.style.top   = (130 + Math.sin(a) * 100) + 'px';
    el.addEventListener('click', () => {
      onEmote(i);
      spawnBubble(player, EMOTES[i].i + ' ' + EMOTES[i].n, 0x9184d9);
      closeWheel();
    });
    ring.appendChild(el);
  });

  emoteBtn?.addEventListener('click', toggleWheel);
  wheelEl?.addEventListener('click', e => { if (e.target === wheelEl) closeWheel(); });

  return { openWheel, closeWheel, toggleWheel };
}

/* ------------------------------------------------------------------
   Fly toggle button — onFly() callback defined by main.js
   ------------------------------------------------------------------ */
export function setupFlyButton(onFly) {
  const flyBtn  = document.getElementById('flyBtn');
  const jumpBtn = document.getElementById('jumpBtn');

  const setFlyUI = (on) => {
    flyBtn?.classList.toggle('on', on);
    if (jumpBtn) jumpBtn.title = on ? 'Hold to rise (Space)' : 'Jump (Space)';
  };

  flyBtn?.addEventListener('click', () => onFly());

  return { setFlyUI };
}
