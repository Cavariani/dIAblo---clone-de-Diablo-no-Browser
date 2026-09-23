// Web Audio manager: buses (master/music/sfx/ui/ambient), lazy sample loading, positional sfx,
// voice limiting, music crossfade, biome ambience. Never throws on missing sounds.
import type { Vec2 } from '../core/math';
import type { AudioAPI } from '../game/api';
import type { Settings } from '../game/types';
import { renderRecipe, RECIPES } from './synth';

interface Manifest {
  sfx: Record<string, { files: string[]; volume: number }>;
  music: Record<string, { files: string[]; volume: number }>;
}

const BASE = `${import.meta.env.BASE_URL}assets/audio/`;
const UI_IDS = /^ui_|^inventory_full|^quest_complete|^drop_legendary|^drop_set|^level_up|^paragon_up|^skill_unlock/;
/** Sounds layered together (file + synth). */
const LAYERS: Record<string, string[]> = { drop_legendary: ['legendary_chime'], drop_set: ['legendary_chime'], level_up: [], rift_complete: ['legendary_chime'] };

export class AudioManager implements AudioAPI {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses: Record<'music' | 'sfx' | 'ui' | 'ambient', GainNode> = {} as never;
  private manifest: Manifest = { sfx: {}, music: {} };
  private buffers = new Map<string, AudioBuffer | null>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private lastPlay = new Map<string, number>();
  private voices = 0;
  private listener: Vec2 = { x: 0, y: 0 };
  private music: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private ambient: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private pendingMusic: string | null = null;
  private settings: Settings | null = null;

  async init(): Promise<void> {
    try {
      const r = await fetch(BASE + 'audio-manifest.json');
      if (r.ok) this.manifest = await r.json();
    } catch {
      /* audio optional */
    }
  }

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master = this.ctx.createGain();
    this.master.connect(comp).connect(this.ctx.destination);
    for (const k of ['music', 'sfx', 'ui', 'ambient'] as const) {
      const g = this.ctx.createGain();
      g.connect(this.master);
      this.buses[k] = g;
    }
    if (this.settings) this.applySettings(this.settings);
    if (this.pendingMusic) {
      const m = this.pendingMusic;
      this.pendingMusic = null;
      this.playMusic(m, 1);
    }
  }

  applySettings(s: Settings): void {
    this.settings = s;
    if (!this.ctx) return;
    this.master.gain.value = s.masterVolume;
    this.buses.music.gain.value = s.musicVolume;
    this.buses.sfx.gain.value = s.sfxVolume;
    this.buses.ui.gain.value = s.uiVolume;
    this.buses.ambient.gain.value = s.sfxVolume * 0.8;
  }

  setListener(pos: Vec2): void {
    this.listener.x = pos.x;
    this.listener.y = pos.y;
  }

  private load(key: string, url: string): Promise<AudioBuffer | null> {
    if (this.buffers.has(key)) return Promise.resolve(this.buffers.get(key) ?? null);
    let p = this.loading.get(key);
    if (!p && this.ctx) {
      const ctx = this.ctx;
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((ab) => ctx.decodeAudioData(ab))
        .catch(() => null)
        .then((b) => {
          this.buffers.set(key, b);
          this.loading.delete(key);
          return b;
        });
      this.loading.set(key, p);
    }
    return p ?? Promise.resolve(null);
  }

  private synth(id: string): Promise<AudioBuffer | null> {
    const key = `synth:${id}`;
    if (this.buffers.has(key)) return Promise.resolve(this.buffers.get(key) ?? null);
    let p = this.loading.get(key);
    if (!p && this.ctx) {
      p = renderRecipe(id, this.ctx.sampleRate)
        .catch(() => null)
        .then((b) => {
          this.buffers.set(key, b);
          this.loading.delete(key);
          return b;
        });
      this.loading.set(key, p);
    }
    return p ?? Promise.resolve(null);
  }

  /** Preload a list of sfx ids (e.g. at zone load). */
  preload(ids: string[]): void {
    if (!this.ctx) return;
    for (const id of ids) {
      const e = this.manifest.sfx[id];
      if (e) for (const f of e.files) void this.load(f, BASE + f);
      else if (RECIPES[id]) void this.synth(id);
    }
  }

  play(id: string, opts: { pos?: Vec2; volume?: number; pitch?: number; pitchVar?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const last = this.lastPlay.get(id) ?? -1;
    if (now - last < 0.045) return; // anti-spam
    if (this.voices > 32) return;
    this.lastPlay.set(id, now);
    let vol = opts.volume ?? 1;
    let pan = 0;
    if (opts.pos) {
      const dx = opts.pos.x - this.listener.x;
      const dy = opts.pos.y - this.listener.y;
      const d = Math.hypot(dx, dy);
      if (d > 22) return;
      vol *= Math.max(0, 1 - d / 22) ** 1.3;
      pan = Math.max(-0.8, Math.min(0.8, (dx - dy) / 10));
    }
    const entry = this.manifest.sfx[id];
    const bus = UI_IDS.test(id) || !opts.pos ? (id.startsWith('amb_') ? this.buses.ambient : UI_IDS.test(id) ? this.buses.ui : this.buses.sfx) : this.buses.sfx;
    const rate = (opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * (opts.pitchVar ?? 0));
    const start = (buf: AudioBuffer | null, v: number) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = v;
      let node: AudioNode = src.connect(g);
      if (pan !== 0 && this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = pan;
        node = node.connect(p);
      }
      node.connect(bus);
      this.voices++;
      src.onended = () => this.voices--;
      src.start();
    };
    if (entry) {
      const f = entry.files[Math.floor(Math.random() * entry.files.length)];
      void this.load(f, BASE + f).then((b) => start(b, vol * entry.volume));
    } else if (RECIPES[id]) void this.synth(id).then((b) => start(b, vol * 0.9));
    for (const l of LAYERS[id] ?? []) if (l !== id) this.play(l, { volume: vol * 0.8 });
    if ((id === 'drop_legendary' || id === 'drop_set') && entry) void this.synth(id).then((b) => start(b, vol * 0.9));
  }

  playMusic(id: string, fade = 1.5): void {
    if (!this.ctx) {
      this.pendingMusic = id;
      return;
    }
    if (this.music?.id === id) return;
    const entry = this.manifest.music[id];
    this.stopMusic(fade);
    if (!entry) return;
    const f = entry.files[0];
    void this.load(f, BASE + f).then((buf) => {
      if (!buf || !this.ctx) return;
      if (this.music && this.music.id !== id) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(entry.volume, this.ctx.currentTime + fade);
      src.connect(g).connect(this.buses.music);
      src.start();
      this.music = { id, src, gain: g };
    });
    this.music = { id, src: null as unknown as AudioBufferSourceNode, gain: null as unknown as GainNode };
  }

  stopMusic(fade = 1.5): void {
    const m = this.music;
    this.music = null;
    if (!m || !m.src || !this.ctx) return;
    const t = this.ctx.currentTime;
    m.gain.gain.cancelScheduledValues(t);
    m.gain.gain.setValueAtTime(Math.max(0.0001, m.gain.gain.value), t);
    m.gain.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    m.src.stop(t + fade + 0.05);
  }

  /** Looping ambience bed (wind, cave drips...). */
  playAmbient(id: string | null): void {
    if (!this.ctx || this.ambient?.id === id) return;
    if (this.ambient) {
      const a = this.ambient;
      const t = this.ctx.currentTime;
      a.gain.gain.setValueAtTime(a.gain.gain.value, t);
      a.gain.gain.linearRampToValueAtTime(0, t + 1.5);
      a.src.stop(t + 1.6);
      this.ambient = null;
    }
    if (!id) return;
    const entry = this.manifest.sfx[id];
    if (!entry) return;
    const f = entry.files[0];
    void this.load(f, BASE + f).then((buf) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(entry.volume, this.ctx.currentTime + 2);
      src.connect(g).connect(this.buses.ambient);
      src.start();
      this.ambient = { id, src, gain: g };
    });
  }
}

export const audio = new AudioManager();
