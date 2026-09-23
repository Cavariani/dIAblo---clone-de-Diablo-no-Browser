// Pooled particles in world-screen space (additive + normal containers) with named presets.
import { Container, Particle, ParticleContainer, Rectangle } from 'pixi.js';
import { fxRng } from '../../core/rng';
import { particleTex } from '../textures';

interface P {
  p: Particle;
  vx: number;
  vy: number;
  vz: number;
  z: number;
  baseY: number;
  life: number;
  max: number;
  gravity: number;
  drag: number;
  s0: number;
  s1: number;
  a0: number;
  add: boolean;
  spin: number;
  floor: boolean;
}

export interface Preset {
  tex: 'soft' | 'dot' | 'spark' | 'shard';
  colors: number[];
  count: number;
  speed: [number, number]; // px/s
  up: [number, number]; // initial vertical speed px/s
  life: [number, number];
  size: [number, number]; // start scale
  end: number; // end scale multiplier
  gravity: number; // px/s^2 (positive pulls down)
  drag: number;
  add: boolean;
  alpha?: number;
  spread?: number; // radians around dir (default full circle)
  floor?: boolean; // stop on the ground (blood)
  spin?: number;
}

const PRESETS: Record<string, Preset> = {
  blood: { tex: 'dot', colors: [0x9a0a0a, 0x6a0404, 0xc01818], count: 8, speed: [60, 220], up: [60, 240], life: [0.4, 0.8], size: [0.18, 0.4], end: 0.6, gravity: 900, drag: 1.5, add: false, spread: 1.4, floor: true },
  blood_green: { tex: 'dot', colors: [0x5a8a1a, 0x3a6a0a, 0x8ab030], count: 8, speed: [60, 220], up: [60, 240], life: [0.4, 0.8], size: [0.18, 0.4], end: 0.6, gravity: 900, drag: 1.5, add: false, spread: 1.4, floor: true },
  bone: { tex: 'shard', colors: [0xe8e0c8, 0xc8c0a8, 0xa8a090], count: 8, speed: [80, 260], up: [80, 300], life: [0.5, 0.9], size: [0.35, 0.7], end: 0.8, gravity: 1100, drag: 1, add: false, spread: 1.6, floor: true, spin: 12 },
  dust: { tex: 'soft', colors: [0x8a7a6a, 0x6a5a4a], count: 10, speed: [30, 120], up: [10, 60], life: [0.5, 1], size: [0.5, 1], end: 2, gravity: -20, drag: 2, add: false, alpha: 0.5 },
  sparks: { tex: 'spark', colors: [0xffd080, 0xffa040, 0xffffff], count: 10, speed: [150, 420], up: [40, 200], life: [0.2, 0.45], size: [0.25, 0.5], end: 0.2, gravity: 700, drag: 1, add: true },
  fire: { tex: 'soft', colors: [0xff8a20, 0xff5010, 0xffd040], count: 16, speed: [40, 180], up: [60, 200], life: [0.35, 0.8], size: [0.5, 1.1], end: 0.2, gravity: -250, drag: 1.5, add: true },
  embers: { tex: 'dot', colors: [0xff9a30, 0xffd060, 0xff5010], count: 2, speed: [5, 30], up: [20, 60], life: [0.4, 0.9], size: [0.12, 0.25], end: 0.3, gravity: -80, drag: 1, add: true },
  ice: { tex: 'shard', colors: [0xbfe8ff, 0x7ac8ff, 0xffffff], count: 12, speed: [80, 260], up: [60, 220], life: [0.4, 0.8], size: [0.3, 0.6], end: 0.5, gravity: 800, drag: 1, add: true, spin: 10 },
  lightning: { tex: 'spark', colors: [0xd0d8ff, 0x9aa8ff, 0xffffff], count: 12, speed: [200, 500], up: [0, 120], life: [0.12, 0.3], size: [0.3, 0.6], end: 0.2, gravity: 0, drag: 2, add: true },
  poison: { tex: 'soft', colors: [0x7ad030, 0x4a9a10, 0xb0f060], count: 12, speed: [20, 90], up: [20, 80], life: [0.6, 1.2], size: [0.4, 0.9], end: 1.6, gravity: -60, drag: 1.5, add: true, alpha: 0.7 },
  arcane: { tex: 'soft', colors: [0xd070ff, 0x9a40ff, 0xffb0ff], count: 14, speed: [40, 200], up: [20, 120], life: [0.4, 0.8], size: [0.35, 0.8], end: 0.2, gravity: -60, drag: 2, add: true },
  holy: { tex: 'soft', colors: [0xfff0a0, 0xffd060, 0xffffff], count: 14, speed: [40, 200], up: [40, 160], life: [0.5, 0.9], size: [0.4, 0.8], end: 0.2, gravity: -80, drag: 2, add: true },
  shadow: { tex: 'soft', colors: [0x3a1060, 0x200830, 0x6a2090], count: 14, speed: [30, 140], up: [20, 100], life: [0.5, 1], size: [0.6, 1.2], end: 1.4, gravity: -40, drag: 2, add: false, alpha: 0.7 },
  heal: { tex: 'soft', colors: [0x60ff80, 0xb0ffc0, 0x20c040], count: 20, speed: [20, 60], up: [60, 160], life: [0.6, 1.1], size: [0.25, 0.5], end: 0.2, gravity: -120, drag: 1, add: true },
  portal: { tex: 'soft', colors: [0x6ab8ff, 0xb0e0ff, 0x3a6aff], count: 10, speed: [30, 90], up: [60, 180], life: [0.5, 1], size: [0.25, 0.55], end: 0.2, gravity: -60, drag: 1, add: true },
  gold_glint: { tex: 'spark', colors: [0xffe080, 0xffffff], count: 3, speed: [10, 40], up: [30, 80], life: [0.3, 0.6], size: [0.2, 0.35], end: 0.2, gravity: 0, drag: 2, add: true },
  levelup: { tex: 'soft', colors: [0xffd060, 0xfff0b0, 0xffa020], count: 60, speed: [40, 260], up: [200, 600], life: [0.8, 1.6], size: [0.3, 0.7], end: 0.1, gravity: -60, drag: 1.2, add: true },
  legendary_sparkles: { tex: 'spark', colors: [0xffb040, 0xffe0a0, 0xff7010], count: 3, speed: [10, 40], up: [60, 200], life: [0.5, 1.2], size: [0.2, 0.4], end: 0.2, gravity: -40, drag: 0.5, add: true },
  set_sparkles: { tex: 'spark', colors: [0x60ff80, 0xc0ffc8, 0x20c040], count: 3, speed: [10, 40], up: [60, 200], life: [0.5, 1.2], size: [0.2, 0.4], end: 0.2, gravity: -40, drag: 0.5, add: true },
  dust_motes: { tex: 'dot', colors: [0xc8b898, 0xa89878], count: 1, speed: [4, 14], up: [-6, 6], life: [3, 6], size: [0.06, 0.12], end: 1, gravity: 0, drag: 0, add: true, alpha: 0.35 },
  embers_ambient: { tex: 'dot', colors: [0xff9a30, 0xffd060], count: 1, speed: [5, 20], up: [20, 50], life: [2, 4], size: [0.08, 0.14], end: 0.4, gravity: -10, drag: 0, add: true, alpha: 0.7 },
  spores: { tex: 'dot', colors: [0xb0e080, 0x80b060], count: 1, speed: [4, 16], up: [4, 20], life: [3, 6], size: [0.08, 0.14], end: 1, gravity: -4, drag: 0, add: true, alpha: 0.5 },
  ash: { tex: 'dot', colors: [0x6a5a50, 0xff7a30, 0x3a3030], count: 1, speed: [6, 24], up: [-10, 10], life: [3, 6], size: [0.08, 0.16], end: 1, gravity: 10, drag: 0, add: false, alpha: 0.6 },
  footstep: { tex: 'soft', colors: [0x6a5a4a], count: 3, speed: [10, 30], up: [5, 20], life: [0.3, 0.6], size: [0.25, 0.4], end: 1.8, gravity: 0, drag: 2, add: false, alpha: 0.35 },
};
// Death explosions: big satisfying bursts.
const death = (base: Preset, extra: Partial<Preset>): Preset => ({ ...base, count: 26, speed: [120, 420], up: [120, 420], life: [0.5, 1.1], size: [base.size[0] * 1.3, base.size[1] * 1.5], ...extra });
PRESETS.death_blood = death(PRESETS.blood, {});
PRESETS.death_blood_green = death(PRESETS.blood_green, {});
PRESETS.death_bone = death(PRESETS.bone, { count: 20 });
PRESETS.death_fire = death(PRESETS.fire, { count: 30 });
PRESETS.death_ice = death(PRESETS.ice, { count: 24 });
PRESETS.death_poison = death(PRESETS.poison, {});
PRESETS.hit_physical = PRESETS.sparks;
PRESETS.hit_fire = { ...PRESETS.fire, count: 8 };
PRESETS.hit_cold = { ...PRESETS.ice, count: 6 };
PRESETS.hit_lightning = { ...PRESETS.lightning, count: 8 };
PRESETS.hit_poison = { ...PRESETS.poison, count: 6 };
PRESETS.hit_arcane = { ...PRESETS.arcane, count: 8 };

export function hasPreset(id: string): boolean {
  return id in PRESETS;
}

const MAX = 3000;

export class Particles {
  readonly addLayer: ParticleContainer;
  readonly normalLayer: ParticleContainer;
  readonly root = new Container();
  private live: P[] = [];
  private free: P[] = [];

  constructor() {
    const t = particleTex();
    const bounds = new Rectangle(-1e6, -1e6, 2e6, 2e6);
    const dyn = { position: true, rotation: true, color: true, vertex: true, uvs: true };
    this.normalLayer = new ParticleContainer({ texture: t.soft, boundsArea: bounds, dynamicProperties: dyn });
    this.addLayer = new ParticleContainer({ texture: t.soft, boundsArea: bounds, dynamicProperties: dyn });
    this.addLayer.blendMode = 'add';
    this.root.addChild(this.normalLayer, this.addLayer);
  }

  get count(): number {
    return this.live.length;
  }

  emit(id: string, x: number, y: number, o: { count?: number; color?: number; dirX?: number; dirY?: number; z?: number; scale?: number; speed?: number } = {}): void {
    const pr = PRESETS[id] ?? PRESETS.sparks;
    const n = Math.round(o.count ?? pr.count);
    const t = particleTex()[pr.tex];
    const hasDir = o.dirX !== undefined && (o.dirX !== 0 || o.dirY !== 0);
    const baseAng = hasDir ? Math.atan2(o.dirY!, o.dirX!) : 0;
    const spread = hasDir ? (pr.spread ?? Math.PI) : Math.PI;
    const sc = o.scale ?? 1;
    for (let i = 0; i < n; i++) {
      if (this.live.length >= MAX) break;
      const q = this.free.pop() ?? this.make();
      const ang = hasDir ? baseAng + (fxRng.next() - 0.5) * 2 * spread : fxRng.next() * Math.PI * 2;
      const sp = fxRng.range(pr.speed[0], pr.speed[1]) * (o.speed ?? 1) * Math.sqrt(sc);
      q.vx = Math.cos(ang) * sp;
      q.vy = Math.sin(ang) * sp * 0.5;
      q.vz = fxRng.range(pr.up[0], pr.up[1]);
      q.z = (o.z ?? 0) * 48;
      q.baseY = y;
      q.life = 0;
      q.max = fxRng.range(pr.life[0], pr.life[1]);
      q.gravity = pr.gravity;
      q.drag = pr.drag;
      q.s0 = fxRng.range(pr.size[0], pr.size[1]) * Math.min(2, sc);
      q.s1 = q.s0 * pr.end;
      q.a0 = pr.alpha ?? 1;
      q.add = pr.add;
      q.spin = pr.spin ? fxRng.range(-pr.spin, pr.spin) : 0;
      q.floor = !!pr.floor;
      const p = q.p;
      p.texture = t;
      p.x = x;
      p.y = y - q.z;
      p.tint = o.color !== undefined && id.startsWith('blood') ? o.color : pr.colors[Math.floor(fxRng.next() * pr.colors.length)];
      p.rotation = pr.tex === 'spark' ? ang : fxRng.next() * 6.28;
      p.scaleX = p.scaleY = q.s0;
      p.alpha = q.a0;
      (q.add ? this.addLayer : this.normalLayer).addParticle(p);
      this.live.push(q);
    }
  }

  private make(): P {
    return {
      p: new Particle({ texture: particleTex().soft, anchorX: 0.5, anchorY: 0.5 }),
      vx: 0,
      vy: 0,
      vz: 0,
      z: 0,
      baseY: 0,
      life: 0,
      max: 1,
      gravity: 0,
      drag: 0,
      s0: 1,
      s1: 1,
      a0: 1,
      add: true,
      spin: 0,
      floor: false,
    };
  }

  update(dt: number): void {
    let removed = false;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const q = this.live[i];
      q.life += dt;
      if (q.life >= q.max) {
        this.live[i] = this.live[this.live.length - 1];
        this.live.pop();
        this.free.push(q);
        removed = true;
        continue;
      }
      const k = Math.exp(-q.drag * dt);
      q.vx *= k;
      q.vy *= k;
      q.vz -= q.gravity * dt;
      q.z += q.vz * dt;
      if (q.floor && q.z <= 0) {
        q.z = 0;
        q.vx = q.vy = q.vz = 0;
      }
      const p = q.p;
      p.x += q.vx * dt;
      q.baseY += q.vy * dt;
      p.y = q.baseY - q.z;
      const t = q.life / q.max;
      const s = q.s0 + (q.s1 - q.s0) * t;
      p.scaleX = p.scaleY = s;
      p.alpha = q.a0 * (t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
      if (q.spin) p.rotation += q.spin * dt;
    }
    if (removed) {
      const keep = (c: ParticleContainer, add: boolean) => {
        c.particleChildren.length = 0;
        for (const q of this.live) if (q.add === add) c.particleChildren.push(q.p);
        c.update();
      };
      keep(this.addLayer, true);
      keep(this.normalLayer, false);
    }
  }

  clear(): void {
    for (const q of this.live) this.free.push(q);
    this.live.length = 0;
    this.addLayer.particleChildren.length = 0;
    this.normalLayer.particleChildren.length = 0;
    this.addLayer.update();
    this.normalLayer.update();
  }
}
