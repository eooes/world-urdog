import * as THREE from 'three';

// Shared scratch objects (avoid per-frame GC)
const _q  = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e  = new THREE.Euler();
const _v3 = new THREE.Vector3();

// ── Character-space axis signs ──────────────────────────────────────────────
// Rigged pose deltas are authored in CHARACTER space: +x = pitch (limb swing
// toward the facing direction), +y = yaw/twist, +z = sideways roll.
// The detective rig ends up facing −Z with +Y up in model-root space, which
// makes a raw +x rotation swing a down-pointing thigh toward the facing
// direction — so all signs default to 1. If a future rig comes out mirrored
// (e.g. legs visibly swinging backward while walking), flip AXIS_SIGN_X here.
const AXIS_SIGN_X = 1;
const AXIS_SIGN_Y = 1;
const AXIS_SIGN_Z = 1;

// Bone keys the rigged animation expects ModelLoader::_findBones to resolve
const EXPECTED_BONES = [
  'root', 'pelvis', 'spine1', 'spine2', 'spine3', 'spine4', 'neck', 'head',
  'shoulderL', 'shoulderR', 'armL', 'armR', 'forearmL', 'forearmR',
  'handL', 'handR', 'thighL', 'thighR', 'calfL', 'calfR', 'footL', 'footR',
];

// Emote durations (ms) – emote auto-ends after this
const EMOTE_DURATION = 2400;

// ── Rigged bone animation amplitudes ────────────────────────────────────────
const WALK_FREQ  = 2.2;   // steps/sec
const WALK_THIGH = 0.42;  // rad
const WALK_CALF  = 0.50;
const WALK_ARM   = 0.28;
const RUN_THIGH  = 0.58;
const RUN_CALF   = 0.65;
const RUN_ARM    = 0.42;
const RUN_LEAN   = 0.10;  // spine forward lean (rad)
// The detective rig's rest pose is a T-pose (arms horizontal). All poses are
// authored for an arms-at-sides rest, so pre-rotate the upper arms down.
// Sign convention: character faces -Z, +Y up ⇒ left arm down = +Z roll.
const ARM_DOWN   = 1.35;  // rad (~77°) — leaves a slight natural outward angle

/**
 * Procedural animator for both rigged (detective) and static (paladin, woman) models.
 * Usage:
 *   const anim = new Animator(innerScene, type, bones);
 *   // each frame:
 *   anim.update(dt, animState, emoteId, t, energy);
 */
export class Animator {
  constructor(innerScene, type, bones) {
    this.inner = innerScene;
    this.type  = type;                 // 'rigged' | 'static'
    this.bones = bones || {};

    this.baseY = innerScene.userData.baseY ?? 0;
    this.baseScale = innerScene.userData.baseScale ?? 1;

    // Blend state
    this._state     = 'IDLE';
    this._emoteId   = null;
    this._emoteT    = 0;
    this._jumpT     = 0;
    this._jumpPhase = 'none';           // 'rise' | 'air' | 'land' | 'none'

    // For rigged: store rest quaternions once, reset each frame.
    // Also precompute each bone parent's rest orientation RELATIVE TO THE
    // MODEL ROOT (innerScene). This lets _rot deltas be interpreted in
    // character space regardless of the rig's arbitrary Blender bone rolls,
    // while staying immune to the outer group's yaw (character turning).
    if (type === 'rigged') {
      this._restQ = {};
      this._qParentRestRel    = {};   // qRootWorld⁻¹ · qParentWorld at rest
      this._qParentRestRelInv = {};
      this._poseDelta = {};           // per-frame accumulated Euler deltas

      innerScene.updateWorldMatrix(true, true);
      const qRootInv = innerScene.getWorldQuaternion(new THREE.Quaternion()).invert();
      for (const [k, b] of Object.entries(this.bones)) {
        if (!b) continue;
        this._restQ[k] = b.quaternion.clone();
        (b.parent ?? innerScene).getWorldQuaternion(_q);
        const rel = qRootInv.clone().multiply(_q);
        this._qParentRestRel[k]    = rel;
        this._qParentRestRelInv[k] = rel.clone().invert();
      }

      // T-pose correction: bring upper arms down to the sides. Uses the same
      // character-space delta math as the pose flush, baked into the rest pose.
      for (const [key, rollZ] of [['armL', ARM_DOWN], ['armR', -ARM_DOWN]]) {
        if (!this.bones[key] || !this._restQ[key]) continue;
        _e.set(0, 0, rollZ, 'XYZ');
        _q.setFromEuler(_e);
        const delta = this._qParentRestRelInv[key].clone()
          .multiply(_q).multiply(this._qParentRestRel[key]);
        this._restQ[key] = delta.multiply(this._restQ[key]).clone();
      }

      const missing = EXPECTED_BONES.filter(k => !this.bones[k]);
      const found   = EXPECTED_BONES.filter(k =>  this.bones[k]);
      console.debug(
        `[Animator] rigged bones matched ${found.length}/${EXPECTED_BONES.length}: ${found.join(', ')}`
        + (missing.length ? ` | MISSING: ${missing.join(', ')}` : ''),
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  update(dt, state, emoteId, t, energy) {
    this._state = state;

    // Track emote timer
    if (state === 'EMOTE' && emoteId != null) {
      if (emoteId !== this._emoteId) { this._emoteId = emoteId; this._emoteT = 0; }
      this._emoteT += dt;
    } else {
      this._emoteId = null;
      this._emoteT  = 0;
    }

    // Track jump phase for squash/stretch timing
    if (state === 'JUMP') {
      this._jumpT += dt;
      if      (this._jumpT < 0.18) this._jumpPhase = 'rise';
      else if (this._jumpT < 0.55) this._jumpPhase = 'air';
      else                          this._jumpPhase = 'land';
    } else {
      this._jumpT    = 0;
      this._jumpPhase = 'none';
    }

    if (this.type === 'rigged') {
      this._animRigged(dt, t, energy);
    } else {
      this._animStatic(dt, t, energy);
    }
  }

  // ── Rigged (detective) ───────────────────────────────────────────────────
  // Two-step: _poseRigged/_emoteRigged only ACCUMULATE character-space Euler
  // deltas via _rot (so multiple _rot calls on one bone compose), then
  // _applyPose converts each accumulated delta to bone-local space and applies
  // it on top of the rest quaternion.
  _animRigged(dt, t, energy) {
    this._beginPose();
    this._poseRigged(dt, t, energy);
    this._applyPose();
  }

  _poseRigged(dt, t, energy) {
    const s = this._state;
    const eId = this._emoteId;
    const eT  = this._emoteT;

    if (s === 'EMOTE' && eId != null) {
      this._emoteRigged(eId, eT, t);
      return;
    }

    if (s === 'IDLE' || s === 'FLY') {
      // Breathing
      const b = Math.sin(t * 1.1) * 0.018 * energy;
      this._rot('spine2', b, 0, 0);
      this._rot('spine3', b * 0.6, 0, 0);
      this._rot('armL',  0, 0,  Math.sin(t * 0.8) * 0.04);
      this._rot('armR',  0, 0, -Math.sin(t * 0.8) * 0.04);
      return;
    }

    const freq  = s === 'RUN' ? WALK_FREQ * 1.45 : WALK_FREQ;
    const phase = t * freq * Math.PI * 2;
    const sp    = Math.sin(phase);
    const cp    = Math.cos(phase);

    if (s === 'WALK' || s === 'RUN') {
      const thighAmp = s === 'RUN' ? RUN_THIGH : WALK_THIGH;
      const calfAmp  = s === 'RUN' ? RUN_CALF  : WALK_CALF;
      const armAmp   = s === 'RUN' ? RUN_ARM   : WALK_ARM;
      const lean     = s === 'RUN' ? RUN_LEAN  : 0.04;

      // Leg swing
      this._rot('thighL',  sp  * thighAmp, 0, 0);
      this._rot('thighR', -sp  * thighAmp, 0, 0);
      // Knee follow-through: calves bend on the backward-swinging leg
      this._rot('calfL',  Math.max(0, -sp) * calfAmp, 0, 0);
      this._rot('calfR',  Math.max(0,  sp) * calfAmp, 0, 0);
      // Opposite arm swing
      this._rot('armL', -sp * armAmp, 0, 0);
      this._rot('armR',  sp * armAmp, 0, 0);
      // Forearm slight bend
      this._rot('forearmL', Math.max(0, -sp) * 0.2, 0, 0);
      this._rot('forearmR', Math.max(0,  sp) * 0.2, 0, 0);
      // Pelvis twist
      this._rot('pelvis', 0, sp * 0.06, 0);
      // Spine lean
      this._rot('spine2', lean, 0, 0);
      // Breathing on top
      const b = Math.sin(t * 1.1) * 0.012;
      this._rot('spine3', lean * 0.5 + b, 0, 0);
    }

    if (s === 'JUMP') {
      if (this._jumpPhase === 'rise') {
        // Anticipation: slight crouch
        this._rot('spine2',  0.12, 0, 0);
        this._rot('thighL', -0.18, 0, 0);
        this._rot('thighR', -0.18, 0, 0);
        this._rot('armL',    0.35, 0, 0);
        this._rot('armR',    0.35, 0, 0);
      } else if (this._jumpPhase === 'air') {
        // Tuck
        this._rot('spine2',  -0.08, 0, 0);
        this._rot('thighL',   0.45, 0, 0);
        this._rot('thighR',   0.45, 0, 0);
        this._rot('calfL',    0.55, 0, 0);
        this._rot('calfR',    0.55, 0, 0);
        this._rot('armL',     0.45, 0, 0.15);
        this._rot('armR',     0.45, 0, -0.15);
      } else {
        // Land absorb
        this._rot('spine2',  0.18, 0, 0);
        this._rot('thighL',  0.25, 0, 0);
        this._rot('thighR',  0.25, 0, 0);
        this._rot('calfL',   0.35, 0, 0);
        this._rot('calfR',   0.35, 0, 0);
      }
    }
  }

  _emoteRigged(eId, eT, t) {
    const loop = t * Math.PI * 2;
    switch (eId) {
      case 0: // wave — raise right arm and wave
        this._rot('shoulderR', -0.3, 0, 0);
        this._rot('armR', -1.1, 0, 0.25);
        this._rot('forearmR', 0, Math.sin(eT * 6) * 0.5, 0);
        break;
      case 1: // love — arms cross to chest
        this._rot('armL',  0.55, 0,  0.55);
        this._rot('armR',  0.55, 0, -0.55);
        this._rot('forearmL', 0.5, 0, 0);
        this._rot('forearmR', 0.5, 0, 0);
        this._rot('spine2', Math.sin(eT * 1.5) * 0.05, 0, 0);
        break;
      case 2: // raise — both arms up
        this._rot('armL', -1.4, 0,  0.1);
        this._rot('armR', -1.4, 0, -0.1);
        this._rot('forearmL', -0.2, 0, 0);
        this._rot('forearmR', -0.2, 0, 0);
        this._rot('spine2', -0.08 + Math.sin(eT * 2) * 0.05, 0, 0);
        break;
      case 3: // sparkle — jazz hands + body sway
        this._rot('armL', -0.9, 0,  0.5);
        this._rot('armR', -0.9, 0, -0.5);
        this._rot('forearmL', -0.3, Math.sin(eT * 8) * 0.4, 0);
        this._rot('forearmR', -0.3, Math.sin(eT * 8 + Math.PI) * 0.4, 0);
        this._rot('spine2', 0, Math.sin(eT * 3) * 0.08, 0);
        break;
      case 4: // dance — hip rock + arm pump
        this._rot('pelvis', 0, Math.sin(eT * 4) * 0.15, 0);
        this._rot('spine2', 0, Math.sin(eT * 4 + 0.5) * 0.1, 0);
        this._rot('armL', -0.4, 0, Math.sin(eT * 4) * 0.3);
        this._rot('armR', -0.4, 0, Math.sin(eT * 4 + Math.PI) * 0.3);
        this._rot('forearmL', 0.6, 0, 0);
        this._rot('forearmR', 0.6, 0, 0);
        break;
      case 5: // wow — step back + arms wide
        this._rot('spine2', -0.12, 0, 0);
        this._rot('armL',  0.1, 0,  0.9);
        this._rot('armR',  0.1, 0, -0.9);
        this._rot('head', -0.1 + Math.sin(eT * 2) * 0.05, 0, 0);
        break;
      case 6: // vibe — head nod + shoulder shrug
        this._rot('head', Math.sin(eT * 4) * 0.18, 0, 0);
        this._rot('shoulderL', Math.sin(eT * 4 + 0.5) * 0.12, 0, 0);
        this._rot('shoulderR', Math.sin(eT * 4 - 0.5) * 0.12, 0, 0);
        this._rot('spine2', Math.sin(eT * 4) * 0.05, 0, 0);
        break;
      case 7: // thanks — deep bow
      default: {
        const bowAmt = Math.min(1, eT * 2) * Math.max(0, 1 - (eT - 1) * 1.5);
        this._rot('spine2',  bowAmt * 0.55, 0, 0);
        this._rot('spine3',  bowAmt * 0.35, 0, 0);
        this._rot('head',   -bowAmt * 0.3,  0, 0);
        break;
      }
    }
  }

  // Clear the per-frame delta accumulator (entries are reused, no GC churn)
  _beginPose() {
    for (const k in this._poseDelta) {
      const d = this._poseDelta[k];
      d.x = 0; d.y = 0; d.z = 0; d.active = false;
    }
  }

  // Accumulate a character-space rotation delta (Euler XYZ) for this frame.
  // x = pitch (swing toward facing), y = yaw/twist, z = sideways roll.
  _rot(key, x, y, z) {
    if (!this.bones[key]) return;
    const d = this._poseDelta[key] ??
      (this._poseDelta[key] = { x: 0, y: 0, z: 0, active: false });
    d.x += x; d.y += y; d.z += z;
    d.active = true;
  }

  // Convert each bone's accumulated character-space delta into bone-local
  // space and compose it with the rest pose:
  //   qDeltaLocal = qParentRestRel⁻¹ · qEuler · qParentRestRel
  //   bone.quaternion = qDeltaLocal · qRestLocal
  // Bones with no delta this frame are restored to their rest quaternion.
  _applyPose() {
    for (const [k, b] of Object.entries(this.bones)) {
      if (!b) continue;
      const rest = this._restQ[k];
      if (!rest) continue;
      const d = this._poseDelta[k];
      if (!d || !d.active) { b.quaternion.copy(rest); continue; }
      _q.setFromEuler(_e.set(
        d.x * AXIS_SIGN_X, d.y * AXIS_SIGN_Y, d.z * AXIS_SIGN_Z, 'XYZ'));
      _q2.copy(this._qParentRestRelInv[k]).multiply(_q).multiply(this._qParentRestRel[k]);
      b.quaternion.copy(_q2).multiply(rest);
    }
  }

  // ── Static (squash-and-stretch on the inner scene) ───────────────────────
  _animStatic(dt, t, energy) {
    this._animStaticBody(dt, t, energy);
    // Re-apply the normalisation scale on top of the unit squash values
    this.inner.scale.multiplyScalar(this.baseScale);
  }

  _animStaticBody(dt, t, energy) {
    const s   = this._state;
    const eId = this._emoteId;
    const eT  = this._emoteT;
    const sc  = this.inner;

    // Reset to base each frame (y is only non-zero during the sparkle emote)
    sc.position.y  = this.baseY;
    sc.rotation.x  = 0;
    sc.rotation.y  = 0;
    sc.rotation.z  = 0;
    sc.scale.set(1, 1, 1);

    if (s === 'EMOTE' && eId != null) {
      this._emoteStatic(eId, eT, t);
      return;
    }

    if (s === 'IDLE' || s === 'FLY') {
      // Gentle breathing sway
      sc.position.y += Math.sin(t * 1.15) * 0.012 * energy;
      sc.rotation.z  = Math.sin(t * 0.7) * 0.008;
      return;
    }

    if (s === 'WALK') {
      const freq  = WALK_FREQ;
      const phase = t * freq * Math.PI * 2;
      const bob   = Math.abs(Math.sin(phase)) * -0.055;
      const lean  = 0.065;
      const rollAmp = 0.022;
      sc.position.y  = this.baseY + bob;
      sc.rotation.x  = lean;
      sc.rotation.z  = Math.sin(phase) * rollAmp;
      // Slight squash on double-support (bob bottom)
      const squash = 1.0 - Math.abs(Math.sin(phase)) * 0.025;
      sc.scale.set(1 / squash, squash, 1 / squash);
      return;
    }

    if (s === 'RUN') {
      const freq  = WALK_FREQ * 1.45;
      const phase = t * freq * Math.PI * 2;
      const bob   = Math.abs(Math.sin(phase)) * -0.09;
      sc.position.y  = this.baseY + bob;
      sc.rotation.x  = 0.13;
      sc.rotation.z  = Math.sin(phase) * 0.038;
      const squash = 1.0 - Math.abs(Math.sin(phase)) * 0.04;
      sc.scale.set(1 / squash, squash, 1 / squash);
      return;
    }

    if (s === 'JUMP') {
      if (this._jumpPhase === 'rise') {
        // Anticipation squash
        const p = Math.min(this._jumpT / 0.18, 1);
        const sy = 1.0 - p * 0.18;
        sc.scale.set(1 / sy, sy, 1 / sy);
        sc.position.y = this.baseY - p * 0.06;
        sc.rotation.x = p * 0.08;
      } else if (this._jumpPhase === 'air') {
        // Stretch upward
        const p = Math.min((this._jumpT - 0.18) / 0.2, 1);
        const sy = 1.0 + p * 0.18;
        sc.scale.set(1 / sy, sy, 1 / sy);
        sc.rotation.x = -0.06;
      } else {
        // Land absorb
        const p = Math.min((this._jumpT - 0.55) / 0.2, 1);
        const sy = 1.0 - p * 0.2 * Math.max(0, 1 - (p - 0.5) * 2);
        sc.scale.set(1 / Math.max(sy, 0.7), Math.max(sy, 0.7), 1 / Math.max(sy, 0.7));
        sc.position.y = this.baseY - p * 0.05;
      }
    }
  }

  _emoteStatic(eId, eT, t) {
    const sc = this.inner;
    switch (eId) {
      case 0: // wave — lean side to side
        sc.rotation.z = Math.sin(eT * 4) * 0.12;
        sc.rotation.x = -0.04;
        break;
      case 1: // love — pulse scale
        { const p = 1 + Math.sin(eT * 3.5) * 0.06;
          sc.scale.set(p, p, p); break; }
      case 2: // raise — stretch tall + bounce
        { const sy = 1.08 + Math.sin(eT * 4) * 0.04;
          sc.scale.set(1 / sy, sy, 1 / sy); break; }
      case 3: // sparkle — quick spin
        sc.rotation.y = eT * 5.0;
        { const sy = 1 + Math.sin(eT * 8) * 0.04;
          sc.scale.set(1, sy, 1); break; }
      case 4: // dance — sway + bob
        sc.rotation.z = Math.sin(eT * 4) * 0.14;
        sc.position.y = this.baseY + Math.abs(Math.sin(eT * 4)) * -0.06;
        break;
      case 5: // wow — lean back
        { const lp = Math.min(eT * 3, 1);
          sc.rotation.x = -lp * 0.14;
          sc.position.y = this.baseY - lp * 0.04; break; }
      case 6: // vibe — head nod (scale.y pulse)
        { const sy = 1 + Math.sin(eT * 6) * 0.05;
          sc.scale.set(1, sy, 1); break; }
      case 7: // thanks — bow forward
      default: {
        const bAmt = Math.min(eT * 2, 1) * Math.max(0, 1 - (eT - 1.2) * 1.5);
        sc.rotation.x = bAmt * 0.38;
        sc.position.y = this.baseY - bAmt * 0.08;
        break;
      }
    }
  }
}
