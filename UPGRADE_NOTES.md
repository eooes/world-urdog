# SHIN SEKAI – Upgrade Notes

## Goals delivered

### Goal 1 — Real 3D characters

| File | Role |
|---|---|
| `src/player/ModelLoader.js` | Async GLB loading via GLTFLoader + SkeletonUtils.clone(); normalises each model to 1.8 m height, feet at Y=0 |
| `src/player/Animator.js` | Procedural animation; rigged detective gets bone-rotation walk/run/jump/emote cycles; paladin & woman get squash-and-stretch on the inner scene |
| `src/player/CapeCloth.js` | 10×14 particle verlet cloth for the paladin cape; gravity + wind; pinned top edge; max 12 active cloths |
| `src/player/avatar.js` | `buildAvatar(colorHex, modelIndex)` – picks model (random if −1), falls back to original procedural angel on load failure; adds blob shadow disc; `animateAvatar()` now delegates to Animator + CapeCloth |

**Animator bone matching** uses defensive substring matching (`\.l[_.\d]`, substring includes for `thigh|upleg`, `calf|shin`, etc.) so it works with the detective's `boneName_index` convention.  If bone orientations produce reversed swings, negate the amplitude constants in `Animator.js` (`WALK_THIGH`, `WALK_ARM`, etc.).

**Model assignment**
- Local player: random on construction, broadcast via `state.modelIndex` in network packets.
- NPCs: cycle through all 3 models (paladin 0, detective 1, woman 2).
- Remote players: use received `modelIndex` from snapshot; random if absent.

---

### Goal 2 — Realistic ground + grass

| File | Role |
|---|---|
| `src/world/GrassField.js` | Single `InstancedMesh` of ~4 200 crossed-quad grass tufts; `onBeforeCompile` injects wind sway into MeshBasicMaterial vertex shader; zero per-frame CPU allocation beyond one uniform update |
| `src/world/wind.js` | Shared singleton `wind.{dir, strength, _t}`; call `wind.update(dt)` once per frame in main.js |

**Grass exclusion zones**: radius < 16 m (plaza), stage band (|x| < 35, z ∈ [−145,−95]), pillar hall (x ≈ −60, z ∈ [−10, 50]).

**Wind tunables** (edit `src/world/wind.js`):
```js
this.strength = 0.4 + (slow + fast) * 0.7;   // base + gust scale
const baseAngle = Math.PI * 0.15;             // predominant wind direction
```

**Grass tunables** (edit `src/world/GrassField.js`):
```js
const GRASS_COUNT = 4200;                     // instance count
const W = 0.14, H = 0.62;                    // blade width / height
// In onBeforeCompile:
gust += sin(uTime * 3.80 + ...)             // gust frequency
transformed.x += uWindX * sway * 0.45;     // sway amplitude
```

---

### Goal 3 — Fog + fake lighting

| File | Role |
|---|---|
| `src/engine/scene.js` | `FogExp2(0x1a1a3a, 0.0062)` — night-sky indigo haze; stage glows visibly through it; also adds a warm `PointLight` at the stage (no shadow) |
| `src/world/GodRays.js` | 9 god-ray Sprites (AdditiveBlending, vertical gradient) + 5 glow Sprites around stage & tripods; `godRays.update(t, energy)` pulses opacity with beat |

**Shadow camera**: reduced to 30 m box (was 140 m), follows local player each frame with texel-snap (eliminates shimmer). Defined in `buildLighting()` and snapped in `main.js → snapShadowCamera()`.

**Blob shadows**: a shared 128×128 radial-gradient `CanvasTexture` disc (MeshBasicMaterial, depthWrite false) added to every character group at Y=0.01; keeps characters grounded outside the shadow box.

**Tunables** (edit `src/world/GodRays.js`):
- `addRay(x, y, z, scaleX, scaleY, baseOpacity)` — move / resize god rays
- `addGlow(x, y, z, size, mat)` — add glow sprites
- Fog density: `new THREE.FogExp2(color, density)` in `scene.js`

---

## Known limitations

1. **Bone axis ambiguity** – procedural skeletal rotations use the most common Blender humanoid convention (X = pitch forward/back). If the detective's limbs swing in the wrong axis, flip signs in `Animator.js`.
2. **Cape anchor** – paladin shoulder anchors are estimated from bounding-box proportions (`±0.23 m, 1.44 m`). If the model's shoulders are at a different position tweak `L_ANCHOR`/`R_ANCHOR` in `CapeCloth.js`.
3. **Static model rotation** – `innerScene.rotation.y` is not reset each frame (only `.x` and `.z` are), so the sparkle emote's spin accumulates as designed; if it causes drift in other states, add `sc.rotation.y = 0` at the top of `_animStatic`.
4. **Grass shader compile** – `onBeforeCompile` fires once per material on first render; until then the grass draws with default material (no sway). This is invisible in practice.
5. **Mobile GPU budget** – on very low-end devices consider reducing `GRASS_COUNT` to 2 000 and cape cloth grid to 6×8.

## Files created
- `src/world/wind.js`
- `src/player/ModelLoader.js`
- `src/player/Animator.js`
- `src/player/CapeCloth.js`
- `src/world/GrassField.js`
- `src/world/GodRays.js`
- `UPGRADE_NOTES.md`

## Files modified
- `src/player/avatar.js` — full rewrite
- `src/player/LocalPlayer.js` — Animator/cape integration, modelIndex in net state
- `src/player/RemotePlayer.js` — modelIndex param, Animator/cape integration
- `src/player/NpcCrowd.js` — cycle modelIndex per NPC
- `src/engine/scene.js` — fog colour/density, tighter shadow box, stage PointLight
- `src/main.js` — loadAllModels(), wind update, grassField, godRays integration

---

## Fix: character-space bone rotation (rigged animation)

The original rigged path applied `_rot()` Euler deltas in **bone-local** space
(`bone.quaternion.multiply(qEuler)`). The detective rig has arbitrary Blender
bone rolls, so local +X is not "swing forward" — limbs rotated around wrong
axes during walk/run/jump/emotes. Known limitation #1 above is now resolved.

**New mechanism** (`src/player/Animator.js`):

1. At construction (rigged only), for each tracked bone we precompute
   `qParentRestRel = qRootWorld⁻¹ · qParentWorld` at rest pose — the parent's
   orientation relative to the **model root** (`innerScene`). Because it is
   root-relative, turning the character (outer group yaw) does not skew the
   animation axes, and nothing world-space is computed per frame.
2. `_rot(key, x, y, z)` no longer touches quaternions; it **accumulates**
   per-bone Euler deltas in a map (so e.g. spine2 lean + breathing in the same
   frame compose instead of overwriting).
3. A flush step (`_applyPose`, run at the end of the rigged update) converts
   each accumulated delta from character space to bone-local space and stacks
   it on the rest pose:
   `bone.quaternion = (qParentRestRel⁻¹ · qEuler · qParentRestRel) · qRestLocal`.
   Bones without deltas are restored to their rest quaternion (replaces the
   old `_resetBones`).

Delta semantics are now **character space**: `+x` = pitch (limb swing toward
facing), `+y` = yaw/twist, `+z` = sideways roll. All amplitudes, frequencies
and emote definitions are unchanged; the static-model path is untouched.

**Sign-flip constants**: `AXIS_SIGN_X / AXIS_SIGN_Y / AXIS_SIGN_Z` at the top
of `Animator.js` globally flip each character-space axis in the flush step.
This rig faces −Z with +Y up in model-root space (verified from the GLB's
rest-pose foot-bone directions and the `metarig.001` conversion matrix), which
makes raw `+x` swing the legs toward the facing direction — so all signs
default to `1`. If a future rig walks with legs swinging backward, set
`AXIS_SIGN_X = -1`.

**Debug aid**: the Animator constructor logs one `console.debug` line listing
which of the 22 expected bone keys were matched by `_findBones` and which are
missing — check devtools if a limb ever stops animating.
