import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor(camera, colliders = []) {
    this.camera    = camera;
    this.colliders = colliders;

    this.yaw      = 0.4;
    this.pitch    = 0.32;
    this.dist     = 7;
    this.distGoal = 7;

    this._target = new THREE.Vector3();
    this._ray    = new THREE.Raycaster();
    this._dir    = new THREE.Vector3();
  }

  update(playerPos, dt) {
    this._target.set(playerPos.x, playerPos.y + 1.8, playerPos.z);

    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    this._dir.set(
      Math.sin(this.yaw) * cp,
      sp,
      Math.cos(this.yaw) * cp,
    );

    // Occlusion: shrink arm when geometry is between player and camera
    this._ray.set(this._target, this._dir);
    const hits = this._ray.intersectObjects(this.colliders, true);
    let maxD = this.distGoal;
    if (hits.length && hits[0].distance < maxD) {
      maxD = Math.max(1.6, hits[0].distance - 0.4);
    }
    this.dist += (maxD - this.dist) * Math.min(1, dt * 12);

    const pos = this._target.clone().addScaledVector(this._dir, this.dist);
    this.camera.position.lerp(pos, Math.min(1, dt * 10));
    this.camera.lookAt(this._target);
  }

  orbit(dx, dy) {
    this.yaw   -= dx * 0.005;
    this.pitch  = THREE.MathUtils.clamp(this.pitch - dy * 0.004, -0.15, 1.1);
  }

  zoom(delta) {
    this.distGoal = THREE.MathUtils.clamp(this.distGoal + delta * 0.01, 3, 16);
  }

  get forwardAngle() {
    return this.yaw;
  }
}
