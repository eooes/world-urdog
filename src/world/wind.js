import * as THREE from 'three';

/**
 * Global wind state shared by grass shader, cape cloth, and fog.
 * Update once per frame in main.js via wind.update(dt).
 */
export const wind = {
  /** World-space direction (XZ plane, normalised). */
  dir: new THREE.Vector3(1, 0, 0.3).normalize(),
  /** Scalar strength in m/s (0..2). */
  strength: 0.8,
  _t: 0,

  update(dt) {
    this._t += dt;
    const slow  = Math.sin(this._t * 0.11) * 0.5 + 0.5;
    const fast  = Math.sin(this._t * 0.37) * 0.25;
    this.strength = 0.4 + (slow + fast) * 0.7;

    const baseAngle = Math.PI * 0.15;                      // mostly +X direction
    const drift = Math.sin(this._t * 0.07) * 0.5
                + Math.sin(this._t * 0.031) * 0.25;
    const angle = baseAngle + drift;
    this.dir.set(Math.cos(angle), 0, Math.sin(angle) * 0.35).normalize();
  },
};
