import * as THREE from 'three';

/* ========================================================================
   Cloth Cape — Verlet-integrated cloth physics
   Attaches to character, waves/flutters with wind and movement
   ======================================================================== */

const SEGS_X = 12;  // horizontal segments
const SEGS_Y = 16;  // vertical segments (length)
const CAPE_W = 2.2;  // width at top
const CAPE_H = 2.6;  // length
const STIFFNESS = 0.85;  // constraint iterations (higher = stiffer)
const DAMPING = 0.98;     // velocity damping
const GRAVITY = -5.0;

export class Cape {
  constructor(scene, attachTo, color = 0xcc6633) {
    this.scene = scene;
    this.attachTo = attachTo;  // the character group
    this.color = color;

    this._vertsX = SEGS_X + 1;
    this._vertsY = SEGS_Y + 1;
    const totalVerts = this._vertsX * this._vertsY;

    // Position buffers (current and previous for Verlet)
    this._pos = new Float32Array(totalVerts * 3);
    this._prev = new Float32Array(totalVerts * 3);
    this._pinned = new Uint8Array(totalVerts);

    // Geometry
    const geo = new THREE.PlaneGeometry(CAPE_W, CAPE_H, SEGS_X, SEGS_Y);
    geo.rotateX(-Math.PI / 2);  // hang down

    // Initialize positions from geometry
    const startPos = geo.attributes.position;
    for (let i = 0; i < totalVerts; i++) {
      this._pos[i * 3]     = startPos.getX(i);
      this._pos[i * 3 + 1] = startPos.getY(i);
      this._pos[i * 3 + 2] = startPos.getZ(i);
      this._prev[i * 3]     = this._pos[i * 3];
      this._prev[i * 3 + 1] = this._pos[i * 3 + 1];
      this._prev[i * 3 + 2] = this._pos[i * 3 + 2];

      // Pin top row (shoulders)
      if (Math.floor(i / this._vertsX) === 0) {
        this._pinned[i] = 1;
      }
    }

    // Material — warm Journey-like orange
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Attach to character
    this.mesh.position.set(0, 1.5, -0.15);  // shoulder height, slightly behind
    this.mesh.scale.set(1, 1, 1);

    if (attachTo) {
      attachTo.add(this.mesh);
    } else {
      scene.add(this.mesh);
    }

    this._geo = geo;
    this._posAttr = geo.attributes.position;
    this._totalVerts = totalVerts;
  }

  update(dt, windVec, charVelocity) {
    // Clamp dt to avoid explosion
    const step = Math.min(dt, 0.033);  // ~30fps cap
    const subSteps = Math.max(1, Math.floor(dt / 0.016));
    const subDt = dt / subSteps;

    for (let s = 0; s < subSteps; s++) {
      this._step(subDt, windVec, charVelocity);
    }

    // Write positions back to geometry
    this._posAttr.array.set(this._pos);
    this._posAttr.needsUpdate = true;
    this._geo.computeVertexNormals();
  }

  _step(dt, windVec, charVelocity) {
    const vx = this._vertsX;
    const n = this._totalVerts;

    // ── Verlet integration ──
    for (let i = 0; i < n; i++) {
      if (this._pinned[i]) continue;

      const i3 = i * 3;
      const px = this._pos[i3];
      const py = this._pos[i3 + 1];
      const pz = this._pos[i3 + 2];

      // Velocity from previous position
      let vx_ = (px - this._prev[i3]) * DAMPING;
      let vy = (py - this._prev[i3 + 1]) * DAMPING;
      let vz = (pz - this._prev[i3 + 2]) * DAMPING;

      // Store current as previous
      this._prev[i3]     = px;
      this._prev[i3 + 1] = py;
      this._prev[i3 + 2] = pz;

      // Gravity
      vy += GRAVITY * dt * dt;

      // Wind — stronger near bottom, turbulent
      const row = Math.floor(i / vx);
      const t = row / SEGS_Y;  // 0 at top, 1 at bottom
      const windForce = t * t * 3.0;  // quadratic — more at tips
      vx_ += windVec.x * windForce * dt * dt;
      vy  += windVec.y * windForce * dt * dt * 0.5;
      vz  += windVec.z * windForce * dt * dt;

      // Character movement drag (opposite direction)
      vx_ -= charVelocity.x * t * 0.8 * dt * dt;
      vz  -= charVelocity.z * t * 0.8 * dt * dt;

      // Apply
      this._pos[i3]     = px + vx_;
      this._pos[i3 + 1] = py + vy;
      this._pos[i3 + 2] = pz + vz;
    }

    // ── Constraint solving ──
    // Structural constraints (horizontal + vertical edges)
    for (let iter = 0; iter < 3; iter++) {
      for (let y = 0; y <= SEGS_Y; y++) {
        for (let x = 0; x < SEGS_X; x++) {
          const iA = y * vx + x;
          const iB = y * vx + (x + 1);
          this._satisfyConstraint(iA, iB, CAPE_W / SEGS_X);
        }
      }
      for (let y = 0; y < SEGS_Y; y++) {
        for (let x = 0; x <= SEGS_X; x++) {
          const iA = y * vx + x;
          const iB = (y + 1) * vx + x;
          this._satisfyConstraint(iA, iB, CAPE_H / SEGS_Y);
        }
      }
      // Shear constraints (diagonal — reduces stretching)
      for (let y = 0; y < SEGS_Y; y++) {
        for (let x = 0; x < SEGS_X; x++) {
          const iA = y * vx + x;
          const iB = (y + 1) * vx + (x + 1);
          const diagLen = Math.sqrt(
            (CAPE_W / SEGS_X) ** 2 + (CAPE_H / SEGS_Y) ** 2,
          );
          this._satisfyConstraint(iA, iB, diagLen);
        }
      }
    }
  }

  _satisfyConstraint(iA, iB, restLen) {
    const pinnedA = this._pinned[iA];
    const pinnedB = this._pinned[iB];
    if (pinnedA && pinnedB) return;

    const i3A = iA * 3;
    const i3B = iB * 3;
    let dx = this._pos[i3B]     - this._pos[i3A];
    let dy = this._pos[i3B + 1] - this._pos[i3A + 1];
    let dz = this._pos[i3B + 2] - this._pos[i3A + 2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 0.0001) return;

    const diff = (dist - restLen) / dist;
    let moveX = dx * diff * STIFFNESS;
    let moveY = dy * diff * STIFFNESS;
    let moveZ = dz * diff * STIFFNESS;

    if (!pinnedA) {
      this._pos[i3A]     += moveX;
      this._pos[i3A + 1] += moveY;
      this._pos[i3A + 2] += moveZ;
    }
    if (!pinnedB) {
      this._pos[i3B]     -= moveX;
      this._pos[i3B + 1] -= moveY;
      this._pos[i3B + 2] -= moveZ;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
  }
}
