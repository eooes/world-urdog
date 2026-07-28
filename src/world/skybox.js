import * as THREE from 'three';

export class SkySystem {
  constructor(scene) {
    this.uniforms = {
      top:   { value: new THREE.Color(0x050010) },  // dark Evangelion night
      mid:   { value: new THREE.Color(0x0d0218) },
      bot:   { value: new THREE.Color(0x150520) },
      tint:  { value: 0.95 },
      night: { value: new THREE.Color(0x020008) },
      uTime: { value: 0.0 },
    };

    // Smooth transition state
    this._currentTint = 0.95;
    this._targetTint = 0.95;
    // Palette presets (top, mid, night)
    this._palettes = [
      { top: 0x3d8ae6, mid: 0x9fd2f7, night: 0x0d1230 },  // day
      { top: 0x1a1a5e, mid: 0xe08f5f, night: 0x0d1230 },  // dusk
      { top: 0x050618, mid: 0x0a0e2a, night: 0x0d1230 },  // midnight
    ];

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(600, 32, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: this.uniforms,
        vertexShader: /* glsl */`
          varying vec3 vP;
          void main() {
            vP = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */`
          varying vec3 vP;
          uniform vec3 top, mid, bot, night;
          uniform float tint;
          uniform float uTime;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                       mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
          }
          float fbm(vec2 p) {
            float v = 0.0, a = 0.5;
            vec2 shift = vec2(100.0);
            for (int i = 0; i < 5; i++) {
              v += a * noise(p);
              p = p * 2.0 + shift;
              a *= 0.5;
            }
            return v;
          }

          void main() {
            vec3 dir = normalize(vP);
            float h = dir.y;

            // Sky gradient
            vec3 c = h > 0.0 ? mix(mid, top, h) : mix(mid, bot, -h * 3.0);

            // ── Seamless clouds using 3D direction (no atan wrapping) ──
            float cloudMask = smoothstep(-0.1, 0.05, h);
            // Sample noise in 3D — naturally seamless on a sphere
            vec3 cloudP = dir * 4.0 + vec3(uTime * 0.02, uTime * 0.008, uTime * 0.006);
            float cloud = fbm(cloudP.xy) * 0.6 + fbm(cloudP.yz) * 0.4;
            cloud = smoothstep(0.38, 0.62, cloud);
            cloud *= cloudMask * 0.55;

            // Warm sunset/morning tint at horizon for clouds
            float horizonGlow = exp(-abs(h) * 4.0);
            vec3 cloudColor = mix(vec3(0.95, 0.92, 0.88), vec3(0.98, 0.8, 0.55), horizonGlow);

            // Blend clouds into sky
            c = mix(c, cloudColor, cloud);

            // Day/night tint transition
            c = mix(c, night, tint);

            gl_FragColor = vec4(c, 1.0);
          }
        `,
      }),
    );
    scene.add(mesh);

    // Clouds
    this._clouds = this._buildClouds(scene);
  }

  _buildClouds(scene) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    const gr = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.2, fog: true });

    const group = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Group();
      const n = 1 + ((Math.random() * 2) | 0);
      for (let j = 0; j < n; j++) {
        const sp = new THREE.Sprite(mat);
        const w = 36 + Math.random() * 26;
        sp.scale.set(w, w * 0.6, 1);
        sp.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 6, 0);
        puff.add(sp);
      }
      puff.position.set(
        (Math.random() - 0.5) * 440,
        70 + Math.random() * 70,
        (Math.random() - 0.5) * 440,
      );
      puff.userData.speed = 0.6 + Math.random() * 0.8;
      group.add(puff);
    }
    scene.add(group);
    return group;
  }

  // mood: 0 = day, 0.4 = dusk, 0.85 = midnight
  setMood(mood) {
    this._targetTint = mood;

    // Determine target palette based on mood
    let paletteIdx;
    if (mood < 0.2) {
      paletteIdx = 0; // day
    } else if (mood < 0.6) {
      paletteIdx = 1; // dusk
    } else {
      paletteIdx = 2; // midnight
    }
    this._targetPalette = this._palettes[paletteIdx];
  }

  update(dt, t) {
    // Update cloud animation time
    this.uniforms.uTime.value = t;

    // Smooth tint transition (5-second lerp)
    const lerpFactor = dt / 5.0;
    this._currentTint += (this._targetTint - this._currentTint) * Math.min(lerpFactor * 3.0, 1.0);
    this.uniforms.tint.value = this._currentTint;

    // Smooth palette color transition
    if (this._targetPalette) {
      const prevColor = new THREE.Color(
        this.uniforms.top.value.getHex(),
      );
      const targetColor = new THREE.Color(this._targetPalette.top);
      prevColor.lerp(targetColor, Math.min(lerpFactor * 3.0, 1.0));
      this.uniforms.top.value.copy(prevColor);

      const prevMid = new THREE.Color(this.uniforms.mid.value.getHex());
      const targetMid = new THREE.Color(this._targetPalette.mid);
      prevMid.lerp(targetMid, Math.min(lerpFactor * 3.0, 1.0));
      this.uniforms.mid.value.copy(prevMid);
    }

    this._clouds.children.forEach(puff => {
      puff.position.x += puff.userData.speed * dt;
      if (puff.position.x > 220) puff.position.x = -220;
    });
  }
}
