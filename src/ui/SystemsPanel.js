export const PHASES = [
  {
    id: 'P1', title: 'Core Mechanics & Player Controls', weeks: 'Wk 1–2',
    items: [
      { label: 'Three.js renderer + scene bootstrap', done: true },
      { label: 'Third-person spring-arm camera w/ occlusion', done: true },
      { label: 'Desktop WASD + mouse-orbit controls', done: true },
      { label: 'Mobile virtual joystick + camera drag zone', done: true },
      { label: 'Angel avatar mesh (robe, wings, halo)', done: true },
      { label: 'Jump + fly movement + terrain snap', done: true },
    ],
  },
  {
    id: 'P2', title: 'Environment, Shaders & VFX', weeks: 'Wk 3–4',
    items: [
      { label: 'Toon/cel shader (4-step gradient ramp)', done: true },
      { label: 'Sky dome (vertex-shader gradient + mood uniforms)', done: true },
      { label: 'Procedural terrain w/ vertex colours', done: true },
      { label: 'Instanced trees + rocks', done: true },
      { label: 'Alien tripod structures + pillar hall', done: true },
      { label: 'Big screen render-texture surface', done: true },
      { label: 'Floating sky numbers + glowing motes', done: true },
      { label: 'Screen-space glitch / chromatic aberration pass', done: true },
      { label: 'Dark fluid blob', done: true },
    ],
  },
  {
    id: 'P3', title: 'Multiplayer Networking', weeks: 'Wk 5–6',
    items: [
      { label: 'WebSocket room client (ws://localhost:3030)', done: true },
      { label: 'Offline mock-mode fallback', done: true },
      { label: 'NPC crowd simulation (local lerp-walk AI)', done: true },
      { label: 'World-space nameplates (billboard sprites)', done: true },
      { label: 'Floating chat bubbles', done: true },
      { label: 'Node.js authoritative room server', done: true },
      { label: 'Position/rotation lerp interpolation', done: true },
      { label: 'Radial emote wheel (8 emotes)', done: true },
    ],
  },
  {
    id: 'P4', title: 'Audio Synchronisation & Event Timeline', weeks: 'Wk 7–8',
    items: [
      { label: 'AudioTimeline: Web Audio API clock driver', done: true },
      { label: 'JSON event timeline parser + runner', done: true },
      { label: 'ENVIRONMENT_CHANGE / LIGHTING_PULSE events', done: true },
      { label: 'SCENE_TRANSITION events (stub)', done: true },
      { label: 'PLAY_VIDEO_OVERLAY events (stub)', done: true },
      { label: 'Live audio file loading (mp3/ogg)', done: false },
      { label: 'Server-side timeline broadcast sync', done: false },
    ],
  },
  {
    id: 'P5', title: 'Optimisation & Deployment', weeks: 'Wk 9–10',
    items: [
      { label: 'Draw-call perf HUD (FPS / draws / triangles)', done: true },
      { label: 'Instanced mesh batching (trees, rocks)', done: true },
      { label: 'Draco mesh compression', done: false },
      { label: 'KTX2 texture compression', done: false },
      { label: 'CDN static build (Vercel / Cloudflare Pages)', done: false },
      { label: 'Node.js cluster server deployment', done: false },
      { label: 'Cross-device testing (iOS Safari, Android Chrome)', done: false },
    ],
  },
];

export class SystemsPanel {
  constructor() {
    this._el      = document.getElementById('systems');
    this._openBtn = document.getElementById('openSys');
    this._closeBtn = document.getElementById('closeSys');
    this._listEl  = document.getElementById('phaseList');

    this._build();
    this._openBtn.addEventListener('click',  () => this._el.classList.add('open'));
    this._closeBtn.addEventListener('click', () => this._el.classList.remove('open'));
  }

  _build() {
    PHASES.forEach(ph => {
      const div = document.createElement('div');
      div.className = 'phase';
      const done  = ph.items.filter(i => i.done).length;
      const total = ph.items.length;
      div.innerHTML = `
        <div class="ph-h">
          <span class="ph-n">${ph.id}</span>
          <span class="ph-t">${ph.title}</span>
          <span class="ph-w">${done}/${total} · ${ph.weeks}</span>
        </div>
        <ul>${ph.items.map(it => `<li class="${it.done ? '' : 'pending'}">${it.label}</li>`).join('')}</ul>
      `;
      this._listEl.appendChild(div);
    });
  }
}
