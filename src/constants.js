export const ACCENT_HEX = 0x9184d9;
export const ACCENT_CSS = '#9184d9';
export const GOLD_HEX   = 0xe7c86a;

export const PLAYER_COLORS = [
  { name: 'silver', hex: 0xd8d9e0 },
  { name: 'red',    hex: 0xe0524d },
  { name: 'amber',  hex: 0xe0913f },
  { name: 'yellow', hex: 0xe7c86a },
  { name: 'green',  hex: 0x66c489 },
  { name: 'teal',   hex: 0x4bb6c4 },
  { name: 'blue',   hex: 0x5b74e0 },
  { name: 'violet', hex: 0x9184d9 },
  { name: 'pink',   hex: 0xd97fce },
  { name: 'rose',   hex: 0xe0577f },
];

export const EMOTES = [
  { icon: '👋', name: 'wave'    },
  { icon: '💜', name: 'love'    },
  { icon: '🙌', name: 'raise'   },
  { icon: '✨', name: 'sparkle' },
  { icon: '🕺', name: 'dance'   },
  { icon: '😮', name: 'wow'     },
  { icon: '🎧', name: 'vibe'    },
  { icon: '🫶', name: 'thanks'  },
];

export const ANIM_STATE = Object.freeze({
  IDLE:   'IDLE',
  WALK:   'WALK',
  RUN:    'RUN',
  JUMP:   'JUMP',
  FLY:    'FLY',
  EMOTE:  'EMOTE',
});

export const TIMELINE_EVENT = Object.freeze({
  ENV_CHANGE:    'ENVIRONMENT_CHANGE',
  SPAWN_VFX:     'SPAWN_VFX',
  PLAY_VIDEO:    'PLAY_VIDEO_OVERLAY',
  LIGHTING_PULSE:'LIGHTING_PULSE',
  SCENE_TRANS:   'SCENE_TRANSITION',
});

export const PHYSICS = Object.freeze({
  GRAVITY:      -22,
  JUMP_IMPULSE:  7.2,
  WALK_SPEED:    4.8,
  RUN_SPEED:     9.2,
  FLY_SPEED:     6.0,
  GROUND_SNAP:   0.12,
});

export const NET = Object.freeze({
  TICK_HZ: 25,
  LERP_ALPHA: 0.18,
  // Local dev uses the room server on localhost:3030.
  // Production: Cloud Run public WebSocket endpoint (deployed via gcloud).
  // Override anytime with ?ws=wss://host
  WS_URL: (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const override = params.get('ws');
      if (override) return override;
      const { hostname } = window.location;
      if (hostname === 'localhost' || hostname === '127.0.0.1') return 'ws://localhost:3030';
      return 'wss://shin-sekai-ws-442096718896.asia-southeast1.run.app';
    } catch (e) {
      return 'wss://shin-sekai-ws-442096718896.asia-southeast1.run.app';
    }
  })(),
});

export const WORLD = Object.freeze({
  TERRAIN_SIZE:   420,
  TERRAIN_SEGS:   80,
  FAR_PLANE:      900,
  FOG_DENSITY:    0.005,
});

export const PERF = Object.freeze({
  TARGET_FPS:      60,
  MAX_DRAW_CALLS: 120,
  MAX_TRIANGLES:  50000,
});

export const NPC_NAMES = [
  'ショコラ', 'kokorononaka', 'nagi', 'by my side',
  'vauee',    'れいかまま',    'assassss', 'hikari_04',
  'tsuki22',  'moonwave',
];
export const NPC_LOCS = [
  'Florida, US', 'Hawaii, US', 'Netherlands',
  'District of Columbia, US', 'Virginia, US',
  'California, US', 'Tokyo, JP', 'Seoul, KR',
];

export const CHAT_REPLIES = [
  'hi!', 'こんばんは', 'same :)', '💜', 'by my side',
  'so pretty', 'vibing rn', '✨', 'what a night',
];
