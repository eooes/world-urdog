import * as THREE from 'three';
import { toon } from '../shaders/toon.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { instantiateModel, MODEL_COUNT } from './ModelLoader.js';
import { Animator }   from './Animator.js';
import { CapeCloth }  from './CapeCloth.js';
import { getMixamoClip } from './MixamoLoader.js';
import { PHYSICS } from '../constants.js';

// ── Shared shadow texture (one canvas, reused across all characters) ─────────
let _shadowTex = null;
function getShadowTex() {
  if (_shadowTex) return _shadowTex;
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = 128;
  const ctx = cv.getContext('2d');
  const gr  = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0,   'rgba(0,0,0,0.55)');
  gr.addColorStop(0.45,'rgba(0,0,0,0.20)');
  gr.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 128, 128);
  _shadowTex = new THREE.CanvasTexture(cv);
  return _shadowTex;
}

// ── Shared shadow geometry ───────────────────────────────────────────────────
let _shadowGeo = null;
function getShadowGeo() {
  if (_shadowGeo) return _shadowGeo;
  _shadowGeo = new THREE.PlaneGeometry(2.0, 2.0);
  _shadowGeo.rotateX(-Math.PI / 2);
  return _shadowGeo;
}

// ── Procedural angel avatar (fallback when GLB fails) ───────────────────────
const _eyesGeo = mergeGeometries([
  new THREE.SphereGeometry(0.045, 8, 8).translate(-0.085, 1.70, 0.205),
  new THREE.SphereGeometry(0.045, 8, 8).translate( 0.085, 1.70, 0.205),
]);
const _wingShape = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.15, 0.5,  0.15, 0.95, 0.58, 1.2);
  s.bezierCurveTo(0.52, 0.9,  0.64, 0.85, 0.9,  0.95);
  s.bezierCurveTo(0.74, 0.62, 0.76, 0.57, 0.96, 0.58);
  s.bezierCurveTo(0.76, 0.42, 0.74, 0.37, 0.88, 0.3);
  s.bezierCurveTo(0.64, 0.24, 0.58, 0.2,  0.64, 0.06);
  s.bezierCurveTo(0.42, 0.14, 0.2,  0.03, 0,    0);
  return s;
})();
const _wingGeo = new THREE.ExtrudeGeometry(_wingShape,
  { depth: 0.05, bevelEnabled: false, curveSegments: 3 });

function buildProceduralAvatar(accentHex) {
  const g     = new THREE.Group();
  const white = toon(0xeef1f8);

  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.7, 14), white);
  robe.position.y = 0.85;
  robe.castShadow = true;
  g.add(robe);

  const hem = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.06, 8, 22),
    new THREE.MeshBasicMaterial({ color: accentHex }),
  );
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.05;
  g.add(hem);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 9), white);
  head.position.y = 1.68;
  head.castShadow = true;
  g.add(head);

  const eyes = new THREE.Mesh(_eyesGeo,
    new THREE.MeshStandardMaterial({ color: 0x2b3358, roughness: 0.5 }));
  g.add(eyes);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.033, 7, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe6a3 }),
  );
  halo.position.y = 2.06;
  halo.rotation.x = Math.PI * 0.42;
  g.add(halo);

  const wingMat = toon(0xf7f9ff, { side: THREE.DoubleSide });
  const mkWing  = side => {
    const pivot = new THREE.Group();
    pivot.position.set(0.07 * side, 1.22, -0.1);
    pivot.rotation.y = 0.55 * side;
    const flap = new THREE.Group();
    pivot.add(flap);
    const m = new THREE.Mesh(_wingGeo, wingMat);
    m.scale.x = side;
    m.castShadow = true;
    flap.add(m);
    g.add(pivot);
    return flap;
  };

  g.userData = {
    modelType: 'procedural',
    animator:  null,
    cape:      null,
    hem,
    halo,
    wings: [mkWing(-1), mkWing(1)],
  };
  return g;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build a world-space nameplate sprite (shared by local & remote players).
 */
export function buildNameplate(text, sub) {
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

/**
 * Apply / update the accent colour on a Mixamo avatar body (tints the pattern
 * texture via material.color). Falls back to the hem disc on procedural avatars.
 */
export function setAvatarColor(avatar, hex) {
  const ud = avatar.userData;
  if (ud?.bodyMats?.length) {
    for (const m of ud.bodyMats) m.color.setHex(hex);
    return;
  }
  if (ud?.hem) ud.hem.material.color.setHex(hex);
}

/**
 * Build a character avatar.
 *
 * @param {number} colorHex   Accent colour for body tint / procedural fallback / nameplate tint.
 * @param {number} modelIndex 0 = paladin, 1 = detective, 2 = woman, -1 = random.
 * @returns {THREE.Group}
 */
export function buildAvatar(colorHex, modelIndex) {
  // Pick model index
  const idx = (modelIndex != null && modelIndex >= 0 && modelIndex < MODEL_COUNT)
    ? modelIndex
    : Math.floor(Math.random() * MODEL_COUNT);

  const inst = instantiateModel(idx, colorHex);

  if (!inst) {
    // GLB failed to load → use procedural angel
    const g = buildProceduralAvatar(colorHex);
    _addShadow(g);
    return g;
  }

  const { group, innerScene, type, name, hasCape, bones, mixer } = inst;

  // Animator (procedural for rigged/static, keyframe mixer for mixamo)
  const animator = type === 'mixamo' ? null : new Animator(innerScene, type, bones);

  // Cape cloth for paladin
  const cape = hasCape ? new CapeCloth(group) : null;

  // Blob shadow
  _addShadow(group);

  group.userData = {
    modelType: type,
    modelName: name,
    animator,
    mixer:     mixer ?? null,   // AnimationMixer for mixamo keyframe clips
    cape,
    hem:   null,     // no hem for GLB models
    halo:  null,
    wings: null,
    innerScene,
    bodyMats: inst.bodyMats ?? null,
    // Mixamo clip transition state
    _currentClip:   null,
    _currentClipKey: null,
  };

  return group;
}

function _addShadow(group) {
  const shadow = new THREE.Mesh(
    getShadowGeo(),
    new THREE.MeshBasicMaterial({
      map:        getShadowTex(),
      transparent: true,
      depthWrite:  false,
      opacity:     0.70,
    }),
  );
  shadow.position.y = 0.01;
  shadow.renderOrder = -1;
  group.add(shadow);
}

/**
 * Animate an avatar each frame.
 * - GLB avatars: delegates to their Animator + CapeCloth.
 * - Procedural fallback: old wing flap logic.
 *
 * @param {THREE.Group}  avatar
 * @param {string}       state     ANIM_STATE value
 * @param {number}       t         elapsed seconds
 * @param {number}       energy    0..1 concert energy
 * @param {number}       dt        frame delta seconds
 * @param {number|null}  emoteId   current emote id or null
 * @param {object}       wind      { dir: Vector3, strength: number } (optional)
 */
export function animateAvatar(avatar, state, t, energy, dt = 0.016, emoteId = null, wind = null) {
  const ud = avatar.userData;

  if (ud.modelType === 'procedural') {
    _animateProcedural(ud, state, t, energy);
    return;
  }

  // ── Mixamo keyframe animation ────────────────────────────────────────
  if (ud.modelType === 'mixamo' && ud.mixer) {
    _animateMixamo(ud, state, emoteId, dt);
    if (ud.cape && wind) {
      ud.cape.update(dt, wind.dir, wind.strength, avatar.rotation.y);
    }
    return;
  }

  // ── Procedural skeletal / squash-stretch ──────────────────────────────
  if (ud.animator) {
    ud.animator.update(dt, state, emoteId, t, energy);
  }

  if (ud.cape && wind) {
    ud.cape.update(dt, wind.dir, wind.strength, avatar.rotation.y);
  }
}

function _animateProcedural(ud, state, t, energy) {
  const { wings, halo } = ud;
  if (!wings) return;

  const flapSpeed = state === 'FLY'  ? 6   : state === 'RUN' ? 2.5 : 1.2;
  const flapAmp   = state === 'FLY'  ? 0.55: state === 'WALK'? 0.18: 0.08;
  const angle     = Math.sin(t * flapSpeed) * flapAmp * energy;
  wings.forEach((w, i) => { w.rotation.z = angle * (i === 0 ? -1 : 1); });

  if (halo) {
    const pulse = 0.98 + Math.sin(t * 2.1) * 0.02 * energy;
    halo.scale.setScalar(pulse);
  }
}

/* ── Mixamo keyframe animation with cross-fading ───────────────────────────── */
function _animateMixamo(ud, state, emoteId, dt) {
  const mixer = ud.mixer;

  // Determine which clip to play
  let clipKey;
  if (state === 'EMOTE' && emoteId != null) {
    clipKey = `EMOTE_${emoteId}`;
  } else if (state === 'JUMP') {
    clipKey = 'FLY';   // fallback: no jump FBX, use flying anim
  } else {
    clipKey = state;   // IDLE, WALK, RUN, FLY
  }

  // Get clip
  const clip = getMixamoClip(state, state === 'EMOTE' ? emoteId : null);

  // If no clip found, fall back to IDLE
  const finalClip = clip ?? getMixamoClip('IDLE', null);
  if (!finalClip) return;

  // If same clip already playing, just update mixer
  if (ud._currentClipKey === clipKey && ud._currentClip) {
    mixer.update(dt);
    return;
  }

  // Cross-fade to new clip
  if (ud._currentClip) {
    ud._currentClip.fadeOut(0.15);  // 150ms crossfade
  }

  const action = mixer.clipAction(finalClip);
  action.reset();
  action.fadeIn(0.15);
  // Match animation cycle to movement — ~1.2× for natural walk, ~1.5× for run
  if (clipKey === 'WALK') {
    action.setEffectiveTimeScale(1.2);
  } else if (clipKey === 'RUN') {
    action.setEffectiveTimeScale(1.5);
  }
  action.play();

  ud._currentClip    = action;
  ud._currentClipKey = clipKey;
  mixer.update(dt);
}
