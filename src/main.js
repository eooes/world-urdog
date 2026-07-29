import * as THREE from 'three';

// Engine
import { Renderer }          from './engine/renderer.js';
import { buildScene, buildLighting, buildCamera } from './engine/scene.js';
import { ThirdPersonCamera } from './engine/camera.js';

// World
import { buildTerrain, buildTrees, buildRocks } from './world/terrain.js';
import { SkySystem }          from './world/skybox.js';
import {
  buildTripod, buildPillarHall, buildBigScreen,
  buildSkyNumbers, buildMotes, buildDarkBlob, buildCountdown,
} from './world/environment.js';
import { buildEvangelionCrosses } from './world/EvangelionCrosses.js';
import { buildGrassField } from './world/GrassField.js';  // MdsGzS exact shader
import { buildGodRays }    from './world/GodRays.js';
import { wind }            from './world/wind.js';

// Player
import { loadAllModels }         from './player/ModelLoader.js';
import { updateCharacterTime }   from './player/MixamoLoader.js';
import { LocalPlayer }           from './player/LocalPlayer.js';
import { NpcCrowd }              from './player/NpcCrowd.js';
import { KeyboardMouseControls } from './player/controls/KeyboardMouse.js';
import { TouchJoystick }         from './player/controls/TouchJoystick.js';

// Network
import { RoomClient } from './network/RoomClient.js';

// Audio
import { AudioTimeline } from './audio/AudioTimeline.js';

// UI
import { HUD }           from './ui/HUD.js';
import { ChatBar }       from './ui/ChatBar.js';
import { EmoteWheel }    from './ui/EmoteWheel.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { SystemsPanel }  from './ui/SystemsPanel.js';

import { PLAYER_COLORS, NET, TIMELINE_EVENT } from './constants.js';

/* ================================================================
   Bootstrap
   ================================================================ */

const loadEl  = document.getElementById('load');
const loadMsg = document.getElementById('loadMsg');
const canvas  = document.getElementById('canvas');

function setLoadMsg(msg) { if (loadMsg) loadMsg.textContent = msg; }

// Texel-snap helper for shadow camera (avoids shimmer when it follows player)
const _snapVec = new THREE.Vector3();
function snapShadowCamera(sunLight, targetPos, texelSize) {
  _snapVec.copy(targetPos);
  _snapVec.x = Math.round(_snapVec.x / texelSize) * texelSize;
  _snapVec.z = Math.round(_snapVec.z / texelSize) * texelSize;
  sunLight.target.position.set(_snapVec.x, 0, _snapVec.z);
  sunLight.position.set(_snapVec.x + 48, 70, _snapVec.z + 30);
  sunLight.target.updateMatrixWorld();
}

async function main() {
  setLoadMsg('Building renderer…');

  /* ── Renderer ── */
  const rendererSys = new Renderer(canvas);

  /* ── Scene + Lighting ── */
  const scene  = buildScene();
  const lights = buildLighting(scene);
  const camera = buildCamera();
  const SHADOW_TEXEL = 30 / 1024;   // shadow camera size / map resolution

  /* ── Post-processing composer ── */
  rendererSys.initComposer(scene, camera);

  /* ── Camera controller ── */
  const colliders = [];
  const camCtrl   = new ThirdPersonCamera(camera, colliders);

  canvas.addEventListener('wheel', e => { camCtrl.zoom(e.deltaY); e.preventDefault(); }, { passive: false });

  setLoadMsg('Building world…');

  /* ── World ── */
  const sky     = new SkySystem(scene);

  const terrain = buildTerrain(scene);
  colliders.push(terrain);

  buildTrees(scene);
  buildRocks(scene);

  /* ── Evangelion neon crosses (4) ── */
  const evangelionCrosses = buildEvangelionCrosses(scene);

  const { body: tri1 } = buildTripod(scene, 70,  -30, 1.1);
  const { body: tri2 } = buildTripod(scene, 120,  40, 0.8);
  colliders.push(tri1, tri2);

  const pillarColliders = buildPillarHall(scene);
  colliders.push(...pillarColliders);

  const bigScreen  = buildBigScreen(scene);
  bigScreen.mesh.visible = false;  // hide until black-box issue resolved
  const countdown  = buildCountdown(scene);
  const motes      = buildMotes(scene);
  const { blob, basePositions, material: blobMat } = buildDarkBlob(scene);
  blob.visible = false;  // hide — suspected black box culprit

  /* ── Grass (MdsGzS exact shader) + atmospheric FX ── */
  const grassField = buildGrassField(scene);
  const godRays    = buildGodRays(scene);

  /* ── Load 3-D character models (async, with fallback) ── */
  setLoadMsg('Loading character models…');
  await loadAllModels();

  setLoadMsg('Spawning avatars…');

  /* ── Local player ── */
  const localPlayer = new LocalPlayer(scene);

  // Debug hook (dev): measure scales from the console
  window.__game = { scene, camera, localPlayer, camCtrl, THREE };

  /* ── NPC crowd ── */
  const crowd = new NpcCrowd(scene);
  crowd.setCrowd(7);

  /* ── Keyboard controls ── */
  const kb = new KeyboardMouseControls();
  kb.onJump = () => localPlayer.jump();

  /* ── Touch joystick ── */
  const isTouch = matchMedia('(pointer:coarse)').matches;
  const joyEl   = document.getElementById('joy');
  const joystick = new TouchJoystick(joyEl, camCtrl);
  if (isTouch) {
    joyEl.style.display = 'block';
    document.getElementById('hint').style.display = 'none';
  }

  /* ── Jump / fly buttons ── */
  const jumpBtn = document.getElementById('jumpBtn');
  const flyBtn  = document.getElementById('flyBtn');
  jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); localPlayer.jump(); });
  flyBtn.addEventListener('click', () => {
    const on = localPlayer.toggleFly();
    flyBtn.classList.toggle('on', on);
    kb.setFlyMode(on);
  });

  /* ── Timeline / Audio ── */
  const timeline = new AudioTimeline();
  await timeline.loadTimeline('src/timeline/events.json');

  // Background music — load and play (user gesture required for autoplay)
  const musicLoaded = await timeline.loadAudio('assets/music/Echoes in the Static.mp3');
  if (musicLoaded) {
    // Autoplay blocked until user gesture — start on first click/tap
    const startMusic = () => {
      timeline.play();
      document.removeEventListener('click', startMusic);
      document.removeEventListener('touchstart', startMusic);
    };
    document.addEventListener('click', startMusic);
    document.addEventListener('touchstart', startMusic);
  } else {
    // Fallback: start timeline without audio
    timeline.play();
  }

  // Music toggle button
  const musicBtn = document.getElementById('musicBtn');
  if (musicBtn) {
    musicBtn.style.display = musicLoaded ? 'block' : 'none';
    musicBtn.addEventListener('click', () => {
      const muted = !timeline.muted;
      timeline.toggleMute();
      musicBtn.classList.toggle('on', !muted);
      musicBtn.textContent = muted ? '🔇' : '🎵';
    });
  }

  /* ── Energy state ── */
  let curEnergy = 0.3;
  let moodFloor = 0;
  timeline.onEvent = ev => {
    if (ev.type === TIMELINE_EVENT.ENV_CHANGE) {
      sky.setMood(ev.mood ?? 0);
      moodFloor = ev.mood ?? 0;
      // Sync fog colour to sky horizon so haze feels cohesive
      const m = ev.mood ?? 0;
      scene.fog.color.setHex(m < 0.3 ? 0x607090 : m < 0.7 ? 0x1a1030 : 0x050408);
    }
    if (ev.type === TIMELINE_EVENT.LIGHTING_PULSE) {
      const i = ev.intensity ?? 1.2;
      lights.sun.intensity = 1.55 * i;
      rendererSys.triggerGlitch(0.35, 0.8);
      setTimeout(() => { lights.sun.intensity = 1.55; }, 400);
    }
    if (ev.type === TIMELINE_EVENT.SCENE_TRANS) {
      rendererSys.triggerGlitch(0.7, 1.2);
    }
  };

  /* ── UI ── */
  const hud      = new HUD();
  const emoteWhl = new EmoteWheel();
  const settings = new SettingsPanel();
  const sysPan   = new SystemsPanel();
  const chatBar  = new ChatBar(scene, crowd);

  /* ── Emote button ── */
  document.getElementById('emoteBtn').addEventListener('click', () => emoteWhl.toggle());
  emoteWhl.onEmote = id => {
    localPlayer.playEmote(id);
    net.sendEmote(id);
  };
  kb.onEmote = () => emoteWhl.toggle();

  /* ── Settings callbacks ── */
  settings.onColorChange    = hex  => { localPlayer.setColor(hex); };
  settings.onUsernameChange = name => { username = name; };

  /* ── Chat ── */
  kb.onChat = action => {
    if (action === 'open') chatBar.open();
    if (action === 'send') chatBar.send(localPlayer.avatar, localPlayer.color);
  };
  kb.onEscape = () => {
    chatBar.close();
    emoteWhl.close();
    settings.close();
  };

  /* ── Network ── */
  const net    = new RoomClient();
  let username = settings.username || 'guest';
  let netTick  = 0;
  const NET_INTERVAL  = 1000 / NET.TICK_HZ;
  let lastNetTick = 0;

  net.addEventListener('welcome', e => {
    hud.update(0, rendererSys.info, NET.TICK_HZ, crowd.count + 1,
      '00:00', '— warmup —', e.detail.roomId);
  });
  net.connect(username, localPlayer.color);

  /* ── Loading complete ── */
  setLoadMsg('Ready');
  loadEl.classList.add('hide');

  /* ================================================================
     Game loop
     ================================================================ */
  let prev = performance.now();
  let t    = 0;

  function loop(now) {
    requestAnimationFrame(loop);

    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    t   += dt;

    /* -- Wind -- */
    wind.update(dt);

    /* -- Input -- */
    kb.isChatOpen = chatBar.isOpen;
    const kbIn = kb.getInput();
    const jIn  = joystick.getInput();
    const input = {
      x:    kbIn.x  || jIn.x,
      y:    kbIn.y  || jIn.y,
      run:  kbIn.run || jIn.run,
      rise: kbIn.rise,
      fall: kbIn.fall,
    };

    /* -- Energy envelope -- */
    curEnergy += (1.0 - curEnergy) * dt * 0.3;
    const energy = curEnergy;

    /* -- Local player -- */
    if (!chatBar.isOpen && !emoteWhl.isOpen) {
      localPlayer.update(dt, input, camCtrl.yaw, energy, t);
    }

    /* -- Shadow camera follows player (texel-snapped to avoid shimmer) -- */
    snapShadowCamera(lights.sun, localPlayer.position, SHADOW_TEXEL);

    /* -- Camera -- */
    camCtrl.update(localPlayer.position, dt);

    /* -- NPC crowd -- */
    crowd.update(dt, t, energy);

    /* -- Grass wind uniform -- */
    grassField.setWind(wind.dir, wind.strength, t);

    /* -- Ground MdsGzS shader time + cross reflections -- */
    if (terrain.material.userData?._groundMat) {
      terrain.material.uniforms.uTime.value = t;
      const gps = evangelionCrosses.getGroundPositions();
      // Pack up to 4 cross positions + scales into uniforms
      for (let i = 0; i < 4; i++) {
        const gp = gps[i] || { x: 0, z: 0, s: 0 };
        terrain.material.uniforms['uCross' + i].value.set(gp.x, gp.z, gp.s);
      }
    }

    /* -- God rays pulse -- */
    godRays.update(t, energy);

    /* -- Sky / clouds -- */
    sky.update(dt, t);

    /* -- Character shader time -- */
    updateCharacterTime(t);

    /* -- Countdown timer (999 → 0, red sky at 0, loop) -- */
    if (countdown.redMode) {
      countdown.redTimer -= dt;
      // Shake all sprites during red alert
      countdown.sprites.forEach((sp, i) => {
        sp.position.y = sp.userData?.baseY ?? sp.position.y + Math.sin(t * 3 + i) * 3;
      });
      if (countdown.redTimer <= 0) {
        countdown.redMode = false;
        countdown.value = 100;
        countdown.accum = 0;
        countdown.setText(100);
        sky.uniforms.tint.value = 0.95;
      }
    } else {
      countdown.accum += dt;
      if (countdown.accum >= 1.0) {
        countdown.accum -= 1.0;
        countdown.value--;
        countdown.setText(countdown.value);
      }
      if (countdown.value <= 0) {
        countdown.redMode = true;
        countdown.redTimer = 30;
        countdown.value = 0;
        countdown.accum = 0;
        countdown.setText(0);
        sky.flashRed(30);
      }
      // Gentle bob during normal countdown
      countdown.sprites.forEach((sp, i) => {
        sp.position.y = (sp.userData?.baseY ?? sp.position.y) + Math.sin(t * 0.5 + i) * 1.5;
      });
    }

    // Save base Y on first frame
    if (!countdown._baseSaved) {
      countdown.sprites.forEach(sp => { sp.userData = { baseY: sp.position.y }; });
      countdown._baseSaved = true;
    }

    /* -- Blob deform -- */
    const bPos  = blob.geometry.attributes.position;
    const bBase = basePositions;
    for (let i = 0; i < bPos.count; i++) {
      const ox = bBase.getX(i), oy = bBase.getY(i), oz = bBase.getZ(i);
      const wave = Math.sin(ox * 1.1 + t * 1.4) * 0.25 * energy
                 + Math.cos(oz * 0.9 + t * 1.1) * 0.18 * energy;
      bPos.setXYZ(i, ox + wave * 0.4, oy + wave, oz + wave * 0.3);
    }
    bPos.needsUpdate = true;
    blob.geometry.computeVertexNormals();
    // Update tunnel shader time
    if (blobMat) blobMat.uniforms.uTime.value = t;

    /* -- Big screen -- */
    const track = timeline.currentTrack;
    bigScreen.draw(t, track?.name ?? 'warmup', energy);

    /* -- Motes drift -- */
    const mPos = motes.geometry.attributes.position;
    for (let i = 0; i < mPos.count; i++) {
      let y = mPos.getY(i) + dt * (0.4 + energy * 0.5);
      if (y > 40) y -= 40;
      mPos.setY(i, y);
    }
    mPos.needsUpdate = true;

    /* -- Chat bubbles -- */
    chatBar.update(dt);

    /* -- Timeline -- */
    timeline.update();

    /* -- Network tick -- */
    if (now - lastNetTick > NET_INTERVAL) {
      lastNetTick = now;
      net.sendState(localPlayer.getNetworkState(username));
    }

    /* -- HUD -- */
    hud.update(
      dt,
      rendererSys.info,
      NET.TICK_HZ,
      crowd.count + 1,
      timeline.formatClock(),
      track?.name ?? 'warmup',
      net.roomId,
    );

    /* -- Render -- */
    rendererSys.render(scene, camera, t);
  }

  requestAnimationFrame(loop);
}

main().catch(err => {
  console.error(err);
  setLoadMsg('Error: ' + err.message);
});
