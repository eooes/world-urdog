import { initMixamo, createMixamoAvatar } from './MixamoLoader.js';

const MODEL_DEFS = [
  { path: 'assets/mixamo/low-poly-walking.glb', type: 'mixamo', name: 'mixamo', hasCape: false },
];
export const MODEL_COUNT = MODEL_DEFS.length;

export async function loadAllModels() {
  try {
    await initMixamo();
  } catch (err) {
    console.warn('[ModelLoader] Mixamo init failed:', err.message ?? err);
  }
}

/**
 * Create a normalised instance of model `index`.
 * Returns null if loading failed (caller must use procedural fallback).
 *
 * Returned object:
 *   { group, innerScene, type, name, hasCape, bones }
 *
 *  - group      : outer THREE.Group – set this as the character's scene node
 *  - innerScene : the cloned GLB scene (used by Animator for scale/rotation)
 *  - type       : 'rigged' | 'static'
 *  - name       : 'paladin' | 'detective' | 'woman'
 *  - hasCape    : boolean
 *  - bones      : bone map (non-null for 'rigged')
 */
export function instantiateModel(index) {
  // Only Mixamo model available
  const result = createMixamoAvatar();
  if (!result) return null;
  return {
    group:      result.group,
    innerScene: result.inner,
    type:       'mixamo',
    name:       'mixamo',
    hasCape:    false,
    bones:      null,
    mixer:      result.mixer,
  };
}
