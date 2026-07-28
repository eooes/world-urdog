import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

/* ========================================================================
   MixamoLoader — uses FBX directly (avoids GLB↔FBX bone name mismatch)
   Character material: 3 random canvas-textured color patterns
   ======================================================================== */

const MIXAMO_DIR = 'assets/mixamo/';

const ANIM_MAP = [
  { file: 'Idle.fbx',      state: 'IDLE'  },
  { file: 'Walking.fbx',   state: 'WALK'  },
  { file: 'Running.fbx',   state: 'RUN'   },
  { file: 'Flying.fbx',    state: 'FLY'   },
  { file: 'Wave.fbx',      state: 'EMOTE', emoteId: 0 },
  { file: 'love.fbx',      state: 'EMOTE', emoteId: 1 },
  { file: 'raise.fbx',     state: 'EMOTE', emoteId: 2 },
  { file: 'sparkle.fbx',   state: 'EMOTE', emoteId: 3 },
  { file: 'dance.fbx',     state: 'EMOTE', emoteId: 4 },
  { file: 'wow.fbx',       state: 'EMOTE', emoteId: 5 },
  { file: 'vibe.fbx',      state: 'EMOTE', emoteId: 6 },
  { file: 'thanks.fbx',    state: 'EMOTE', emoteId: 7 },
];

let _fbxLoader  = null;
let _baseFbx    = null;
let _clipCache  = null;

export const MIXAMO_AVAILABLE = true;

/* ── 3 character color patterns (canvas textures) ──────────────────── */
const PATTERNS = [
  { name: 'ember',   body: '#e85d3a', accent: '#f4a460', detail: '#ffd700' },  // warm orange/gold
  { name: 'ocean',   body: '#2d8cf0', accent: '#6ce5e8', detail: '#1a1a4e' },  // blue/teal
  { name: 'forest',  body: '#4caf50', accent: '#8bc34a', detail: '#2e3b1f' },  // green
];

function _makePatternTexture(pat) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  // Base fill
  ctx.fillStyle = pat.body;
  ctx.fillRect(0, 0, size, size);

  // Horizontal stripes
  ctx.fillStyle = pat.accent;
  const stripeH = size / 8;
  for (let y = stripeH; y < size; y += stripeH * 2) {
    ctx.fillRect(0, y, size, stripeH);
  }

  // Diagonal detail lines
  ctx.strokeStyle = pat.detail;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.3;
  for (let i = -size; i < size * 2; i += 14) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Dot pattern overlay
  ctx.fillStyle = pat.detail;
  ctx.globalAlpha = 0.2;
  for (let y = 8; y < size; y += 16) {
    for (let x = 8; x < size; x += 16) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Pre-generate the 3 textures once
let _patternTextures = null;
function _getPatternTextures() {
  if (!_patternTextures) {
    _patternTextures = PATTERNS.map(p => _makePatternTexture(p));
    console.log('[Mixamo] 3 character patterns ready:', PATTERNS.map(p => p.name).join(', '));
  }
  return _patternTextures;
}

// Pick a random pattern texture
function _randomCharTexture() {
  const textures = _getPatternTextures();
  return textures[Math.floor(Math.random() * textures.length)];
}

/* ── Init ────────────────────────────────────────────────────────────── */
export async function initMixamo() {
  _fbxLoader  = _fbxLoader ?? new FBXLoader();
  _clipCache  = new Map();

  _baseFbx = await new Promise((res, rej) =>
    _fbxLoader.load(MIXAMO_DIR + 'Walking.fbx', res, null, rej),
  );
  console.log('[Mixamo] base FBX loaded');

  const walkClip = _baseFbx.animations?.[0];
  if (walkClip) {
    walkClip.tracks = walkClip.tracks.filter(t =>
      !(t.name.includes('Hips') && t.name.endsWith('.position'))
    );
    _clipCache.set('WALK', walkClip);
  }

  const otherAnims = ANIM_MAP.filter(d => d.file !== 'Walking.fbx');
  const results = await Promise.allSettled(
    otherAnims.map(def =>
      new Promise((res, rej) =>
        _fbxLoader.load(MIXAMO_DIR + def.file,
          fbx => res({ def, fbx }),
          null,
          () => rej(new Error(def.file)),
        ),
      ),
    ),
  );

  for (const r of results) {
    if (r.status === 'rejected') {
      console.warn('[Mixamo] failed:', r.reason?.message ?? r.reason);
      continue;
    }
    const { def, fbx } = r.value;
    const clip = fbx.animations?.[0];
    if (!clip) { console.warn('[Mixamo] no anim in:', def.file); continue; }

    clip.tracks = clip.tracks.filter(t =>
      !(t.name.includes('Hips') && t.name.endsWith('.position'))
    );

    const key = def.emoteId != null ? `EMOTE_${def.emoteId}` : def.state;
    _clipCache.set(key, clip);
  }

  console.log(`[Mixamo] ready — ${_clipCache.size} animations`);
}

/* ── Create character instance ────────────────────────────────────────── */
export function createMixamoAvatar() {
  if (!_baseFbx) return null;

  const inner = cloneSkeleton(_baseFbx);

  const box = new THREE.Box3().setFromObject(inner);
  const h   = box.max.y - box.min.y;
  const sf  = h > 0.001 ? 1.8 / h : 1;
  inner.scale.setScalar(sf);
  inner.position.y = -box.min.y * sf;

  // Random pattern per character
  const tex = _randomCharTexture();

  inner.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow    = true;
      obj.receiveShadow = true;

      // Dispose old materials (FBX can have array materials)
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else if (obj.material) {
        obj.material.dispose();
      }

      obj.material = new THREE.MeshBasicMaterial({
        map: tex,
        skinning: true,
      });
    }
  });
  const group = new THREE.Group();
  group.add(inner);
  const mixer = new THREE.AnimationMixer(inner);

  return { group, inner, mixer };
}

/* ── Get animation clip ──────────────────────────────────────────────── */
export function getMixamoClip(state, emoteId = null) {
  if (!_clipCache) return null;
  if (state === 'EMOTE' && emoteId != null) {
    return _clipCache.get(`EMOTE_${emoteId}`) ?? _clipCache.get('IDLE');
  }
  return _clipCache.get(state) ?? _clipCache.get('IDLE') ?? null;
}

// No-op — no shader to update
export function updateCharacterTime(t) {}
