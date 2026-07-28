export const ACCENT = 0x9184d9;

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
  { i: '👋', n: 'wave'    },
  { i: '💜', n: 'love'    },
  { i: '🙌', n: 'raise'   },
  { i: '✨', n: 'sparkle' },
  { i: '🕺', n: 'dance'   },
  { i: '😮', n: 'wow'     },
  { i: '🎧', n: 'vibe'    },
  { i: '🫶', n: 'thanks'  },
];

export const PEER_NAMES = ['ショコラ', 'kokorononaka', 'nagi', 'by my side', 'vauee', 'れいかまま', 'assassss'];
export const PEER_LOCS  = ['Florida, US', 'Hawaii, US', 'Netherlands', 'District of Columbia, US', 'Virginia, US', 'Florida, US', 'California, US'];

export const WALK_SPEED = 3.4;
export const RUN_SPEED  = 7.0;
export const FLY_SPEED  = 6.8;
export const SET_LEN    = 120; // seconds per concert loop

export const TIMELINE = [
  { t:  0, type: 'ENVIRONMENT_CHANGE', track: 'warmup',            energy: 0.30, tint: 0.00              },
  { t: 14, type: 'LIGHTING_PULSE',     track: 'DJ POTARO',          energy: 0.55, tint: 0.05              },
  { t: 34, type: 'SPAWN_VFX',          track: 'KERO KERO BONITO',   energy: 0.70, tint: 0.10, glitch: 0.8 },
  { t: 54, type: 'SCENE_TRANSITION',   track: 'IMANU B2B BUUNSHIN', energy: 0.95, tint: 0.55, glitch: 1.4 },
  { t: 78, type: 'PLAY_VIDEO_OVERLAY', track: 'YVETTE YOUNG',       energy: 0.80, tint: 0.35, glitch: 0.6 },
  { t: 98, type: 'LIGHTING_PULSE',     track: 'PORTER ROBINSON',    energy: 1.00, tint: 0.15, glitch: 1.0 },
];

// Shared mutable game state — passed by reference into update functions
export const tweaks = { moodFloor: 0, crowd: 7, energyMul: 1.0 };

export const gameState = {
  curEnergy : 0.3,
  curEv     : TIMELINE[0],
  flying    : false,
  chatting  : false,
  jumpHeld  : false,
};
