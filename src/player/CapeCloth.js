import * as THREE from 'three';

const COLS = 10;
const ROWS = 14;
const N    = COLS * ROWS;

// Fixed shoulder anchor positions in character-local space (paladin ~1.8m tall)
const L_ANCHOR = new THREE.Vector3(-0.23, 1.44, -0.04);
const R_ANCHOR = new THREE.Vector3( 0.23, 1.44, -0.04);

// Rest lengths derived from the spread of anchors
const REST_H = (R_ANCHOR.x - L_ANCHOR.x) / (COLS - 1);   // ~0.051m per column step
const REST_V = 0.78 / (ROWS - 1);                          // ~0.060m per row step
const GRAVITY = -8.5;
const DAMPING = 0.985;
const MAX_CLOTHS = 12;

let _activeCloths = 0;

// Shared shadow-like cape colour: dark red
const CAPE_COLOR = 0x7a1515;

/**
 * Verlet cloth simulator for the paladin cape.
 * Add one per paladin character; respects MAX_CLOTHS budget.
 * Attach result to the character's outer Group (not the innerScene).
 */
export class CapeCloth {
  constructor(parentGroup) {
    if (_activeCloths >= MAX_CLOTHS) {
      this.mesh   = null;
      this._skip  = true;
      return;
    }
    _activeCloths++;
    this._skip = false;

    // Particle arrays (N particles, 3 floats each)
    this._pos  = new Float32Array(N * 3);
    this._prev = new Float32Array(N * 3);
    this._pin  = new Uint8Array(N);      // 1 = pinned to anchor

    // Initialise particles hanging straight down
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col;
        const t   = col / (COLS - 1);
        const x   = L_ANCHOR.x + (R_ANCHOR.x - L_ANCHOR.x) * t;
        const y   = L_ANCHOR.y - row * REST_V;
        const z   = L_ANCHOR.z - row * 0.008;   // slight backward drape
        this._pos[idx*3]   = x;
        this._pos[idx*3+1] = y;
        this._pos[idx*3+2] = z;
        this._prev[idx*3]   = x;
        this._prev[idx*3+1] = y;
        this._prev[idx*3+2] = z;
        if (row === 0) this._pin[idx] = 1;
      }
    }

    // ── Geometry ──────────────────────────────────────────────────────────
    const geo = new THREE.BufferGeometry();

    const verts = new Float32Array(N * 3);
    const uvs   = new Float32Array(N * 2);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col;
        uvs[idx*2]   = col / (COLS - 1);
        uvs[idx*2+1] = 1 - row / (ROWS - 1);
      }
    }

    const indices = [];
    for (let row = 0; row < ROWS - 1; row++) {
      for (let col = 0; col < COLS - 1; col++) {
        const a = row * COLS + col;
        const b = a + 1;
        const c = a + COLS;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(uvs,   2));
    geo.setIndex(indices);

    const mat = new THREE.MeshStandardMaterial({
      color:     CAPE_COLOR,
      side:      THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0.0,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow    = true;
    this.mesh.frustumCulled = false;    // cloth can extend past group bbox
    parentGroup.add(this.mesh);

    this._posAttr = geo.attributes.position;
  }

  /**
   * @param {number}          dt          seconds since last frame
   * @param {THREE.Vector3}   windDirWorld world-space wind direction (normalised)
   * @param {number}          windStrength scalar strength
   * @param {number}          charRotY    character's world Y rotation (radians)
   */
  update(dt, windDirWorld, windStrength, charRotY) {
    if (this._skip || !this.mesh) return;

    // Transform wind into character-local XZ plane
    const cosY = Math.cos(-charRotY);
    const sinY = Math.sin(-charRotY);
    const wlx  = windDirWorld.x * cosY - windDirWorld.z * sinY;
    const wlz  = windDirWorld.x * sinY + windDirWorld.z * cosY;
    const wfx  = wlx * windStrength * 0.22;
    const wfz  = wlz * windStrength * 0.22;

    const dt2 = dt * dt;

    // ── Verlet integration ───────────────────────────────────────────────
    for (let i = 0; i < N; i++) {
      if (this._pin[i]) continue;
      const pi  = i * 3;
      const px  = this._pos[pi],  py  = this._pos[pi+1],  pz  = this._pos[pi+2];
      const opx = this._prev[pi], opy = this._prev[pi+1], opz = this._prev[pi+2];

      const vx = (px - opx) * DAMPING;
      const vy = (py - opy) * DAMPING;
      const vz = (pz - opz) * DAMPING;

      this._prev[pi]   = px; this._prev[pi+1] = py; this._prev[pi+2] = pz;
      this._pos[pi]    = px + vx + wfx * dt2;
      this._pos[pi+1]  = py + vy + GRAVITY * dt2;
      this._pos[pi+2]  = pz + vz + wfz * dt2;
    }

    // ── Constraint relaxation (2 passes) ────────────────────────────────
    for (let iter = 0; iter < 2; iter++) {
      // Horizontal
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS - 1; col++) {
          this._constrain(row * COLS + col, row * COLS + col + 1, REST_H);
        }
      }
      // Vertical
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS - 1; row++) {
          this._constrain(row * COLS + col, (row + 1) * COLS + col, REST_V);
        }
      }
      // Diagonal (adds stiffness)
      for (let row = 0; row < ROWS - 1; row++) {
        for (let col = 0; col < COLS - 1; col++) {
          const diag = Math.sqrt(REST_H * REST_H + REST_V * REST_V);
          this._constrain(row * COLS + col,       (row + 1) * COLS + col + 1, diag);
          this._constrain(row * COLS + col + 1,   (row + 1) * COLS + col,     diag);
        }
      }
    }

    // ── Upload to GPU ────────────────────────────────────────────────────
    const pa = this._posAttr;
    for (let i = 0; i < N; i++) {
      pa.setXYZ(i, this._pos[i*3], this._pos[i*3+1], this._pos[i*3+2]);
    }
    pa.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  _constrain(a, b, rest) {
    const pi = a * 3, qi = b * 3;
    const dx = this._pos[qi]   - this._pos[pi];
    const dy = this._pos[qi+1] - this._pos[pi+1];
    const dz = this._pos[qi+2] - this._pos[pi+2];
    const d  = Math.sqrt(dx*dx + dy*dy + dz*dz);
    if (d < 0.0001) return;
    const diff = (d - rest) / d * 0.5;
    const cx = dx * diff, cy = dy * diff, cz = dz * diff;
    if (!this._pin[a]) { this._pos[pi]   += cx; this._pos[pi+1] += cy; this._pos[pi+2] += cz; }
    if (!this._pin[b]) { this._pos[qi]   -= cx; this._pos[qi+1] -= cy; this._pos[qi+2] -= cz; }
  }

  dispose() {
    if (!this._skip) _activeCloths = Math.max(0, _activeCloths - 1);
    this.mesh?.geometry.dispose();
    this.mesh?.material.dispose();
  }
}
