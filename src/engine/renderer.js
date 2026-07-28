import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass }      from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GLITCH_VERT, GLITCH_FRAG } from '../shaders/toon.js';

export class Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.info.autoReset = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.composer = null;
    this.glitchPass = null;
    this.glitchStrength = 0;

    this._bound_onResize = this._onResize.bind(this);
    window.addEventListener('resize', this._bound_onResize);
  }

  initComposer(scene, camera) {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    // SSAO disabled — SAOPass conflicts with custom shaders in this scene

    const res = new THREE.Vector2(innerWidth, innerHeight);
    // Bloom: threshold=0.65 — only crosses (green=1.0, luminance≈0.715) bloom
    this.bloomPass = new UnrealBloomPass(res, 0.5, 0.3, 0.65);
    this.composer.addPass(this.bloomPass);

    // ── Glitch (applied on top of bloom) ──────────────────────────────────
    this.glitchPass = new ShaderPass({
      uniforms: {
        tDiffuse:  { value: null },
        time:      { value: 0.0 },
        strength:  { value: 0.0 },
      },
      vertexShader:   GLITCH_VERT,
      fragmentShader: GLITCH_FRAG,
    });
    this.glitchPass.renderToScreen = true;
    this.composer.addPass(this.glitchPass);
  }

  render(scene, camera, t) {
    this.renderer.info.reset();
    if (this.composer) {
      if (this.glitchPass) {
        this.glitchPass.uniforms.time.value = t;
        this.glitchPass.uniforms.strength.value = this.glitchStrength;
      }
      this.composer.render();
    } else {
      this.renderer.render(scene, camera);
    }
  }

  triggerGlitch(duration = 0.4, strength = 1.0) {
    this.glitchStrength = strength;
    clearTimeout(this._glitchTimer);
    this._glitchTimer = setTimeout(() => { this.glitchStrength = 0; }, duration * 1000);
  }

  get info() { return this.renderer.info; }

  _onResize() {
    this.renderer.setSize(innerWidth, innerHeight);
    if (this.composer) this.composer.setSize(innerWidth, innerHeight);
    if (this.bloomPass) this.bloomPass.resolution.set(innerWidth, innerHeight);
  }

  dispose() {
    window.removeEventListener('resize', this._bound_onResize);
    this.renderer.dispose();
  }
}
