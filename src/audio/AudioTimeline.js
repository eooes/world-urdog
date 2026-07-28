import { TIMELINE_EVENT } from '../constants.js';

/**
 * Drives world events against the Web Audio API clock (or system clock fallback).
 * Load a JSON timeline and call update() each frame.
 *
 * Timeline JSON schema:
 * {
 *   "tracks": [
 *     { "startTime": 0,    "endTime": 120, "name": "warmup" },
 *     { "startTime": 120,  "endTime": 240, "name": "act 1" }
 *   ],
 *   "events": [
 *     { "t": 5.0,  "type": "ENVIRONMENT_CHANGE", "mood": 0.4 },
 *     { "t": 10.0, "type": "LIGHTING_PULSE",      "color": "#e0524d" },
 *     { "t": 30.0, "type": "SCENE_TRANSITION",    "scene": "stage" }
 *   ]
 * }
 */
export class AudioTimeline {
  constructor() {
    this._ctx      = null;
    this._source   = null;
    this._tracks   = [];
    this._events   = [];
    this._fired    = new Set();
    this._startAt  = 0;
    this._clock    = 0;
    this.playing   = false;

    // Callbacks — set these from outside
    this.onTrackChange  = null; // (track) =>
    this.onEvent        = null; // (event) =>
  }

  async loadTimeline(url) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      this._tracks = data.tracks ?? [];
      this._events = data.events ?? [];
    } catch (_) {
      // Fallback demo timeline
      this._tracks = [
        { startTime: 0,   endTime: 60,  name: 'warmup'  },
        { startTime: 60,  endTime: 180, name: 'act 1'   },
        { startTime: 180, endTime: 300, name: 'the drop' },
      ];
      this._events = [
        { t:  5,  type: TIMELINE_EVENT.ENV_CHANGE,    mood: 0.4 },
        { t: 30,  type: TIMELINE_EVENT.LIGHTING_PULSE, intensity: 1.5 },
        { t: 60,  type: TIMELINE_EVENT.SCENE_TRANS,    scene: 'stage' },
        { t: 65,  type: TIMELINE_EVENT.ENV_CHANGE,    mood: 0.85 },
        { t: 180, type: TIMELINE_EVENT.ENV_CHANGE,    mood: 0.0 },
      ];
    }
  }

  async loadAudio(url) {
    try {
      this._ctx = new AudioContext();
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const decoded = await this._ctx.decodeAudioData(buf);
      this._source = this._ctx.createBufferSource();
      this._source.buffer = decoded;
      this._source.connect(this._ctx.destination);
      this._source.loop = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this._fired.clear();
    if (this._ctx && this._source) {
      this._startAt = this._ctx.currentTime;
      this._source.start(0);
    } else {
      this._startAt = performance.now() / 1000;
    }
  }

  stop() {
    this.playing = false;
    try { this._source?.stop(); } catch (_) {}
  }

  get clock() { return this._clock; }

  get currentTrack() {
    return this._tracks.find(tr => this._clock >= tr.startTime && this._clock < tr.endTime) ?? this._tracks[0];
  }

  update() {
    if (!this.playing) return;

    const now = this._ctx
      ? this._ctx.currentTime - this._startAt
      : performance.now() / 1000 - this._startAt;

    this._clock = now;

    // Fire timeline events once each
    for (const ev of this._events) {
      if (!this._fired.has(ev) && now >= ev.t) {
        this._fired.add(ev);
        this.onEvent?.(ev);
      }
    }
  }

  formatClock() {
    const total = Math.floor(this._clock);
    const m = (total / 60) | 0;
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
