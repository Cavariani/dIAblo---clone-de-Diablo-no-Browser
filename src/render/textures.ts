// Procedurally generated textures (lights, particles, shadows, decals, vignette). Created once.
import { Rectangle, Texture } from 'pixi.js';

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return Texture.from(c);
}

function radial(size: number, stops: [number, string][]): Texture {
  return canvasTex(size, size, (g) => {
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    for (const [o, c] of stops) grad.addColorStop(o, c);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  });
}

let cache: ReturnType<typeof build> | null = null;

function build() {
  return {
    /** White radial light falloff (for additive lighting). */
    light: radial(256, [
      [0, 'rgba(255,255,255,1)'],
      [0.25, 'rgba(255,255,255,0.75)'],
      [0.55, 'rgba(255,255,255,0.3)'],
      [0.8, 'rgba(255,255,255,0.08)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
    /** Soft round particle. */
    soft: radial(64, [
      [0, 'rgba(255,255,255,1)'],
      [0.35, 'rgba(255,255,255,0.8)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
    /** Hard-ish dot. */
    dot: radial(32, [
      [0, 'rgba(255,255,255,1)'],
      [0.6, 'rgba(255,255,255,0.95)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
    /** Elongated spark. */
    spark: canvasTex(64, 16, (g) => {
      const grad = g.createLinearGradient(0, 0, 64, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.7, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(32, 8, 32, 4, 0, 0, Math.PI * 2);
      g.fill();
    }),
    /** Bone/rock shard. */
    shard: canvasTex(24, 24, (g) => {
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(4, 12);
      g.lineTo(12, 3);
      g.lineTo(21, 10);
      g.lineTo(14, 21);
      g.closePath();
      g.fill();
    }),
    /** Actor ground shadow (ellipse). */
    shadow: radial(128, [
      [0, 'rgba(0,0,0,0.55)'],
      [0.6, 'rgba(0,0,0,0.35)'],
      [1, 'rgba(0,0,0,0)'],
    ]),
    /** Blood splat decal (irregular blobs). */
    splat: canvasTex(128, 128, (g) => {
      g.fillStyle = '#fff';
      const rnd = mulberry(1234);
      for (let i = 0; i < 18; i++) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * 40;
        const r = 4 + rnd() * (i < 4 ? 26 : 10);
        g.globalAlpha = 0.5 + rnd() * 0.5;
        g.beginPath();
        g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, Math.PI * 2);
        g.fill();
      }
    }),
    /** Scorch mark. */
    scorch: radial(128, [
      [0, 'rgba(255,255,255,0.9)'],
      [0.5, 'rgba(255,255,255,0.6)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
    /** Vertical beam gradient for loot pillars. */
    beam: canvasTex(64, 256, (g) => {
      const v = g.createLinearGradient(0, 0, 0, 256);
      v.addColorStop(0, 'rgba(255,255,255,0)');
      v.addColorStop(0.55, 'rgba(255,255,255,0.35)');
      v.addColorStop(1, 'rgba(255,255,255,0.9)');
      g.fillStyle = v;
      g.fillRect(0, 0, 64, 256);
      const h = g.createLinearGradient(0, 0, 64, 0);
      h.addColorStop(0, 'rgba(0,0,0,1)');
      h.addColorStop(0.5, 'rgba(0,0,0,0)');
      h.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = h;
      g.fillRect(0, 0, 64, 256);
    }),
    /** Screen vignette (transparent center, dark edges). */
    vignette: canvasTex(512, 512, (g) => {
      const grad = g.createRadialGradient(256, 256, 120, 256, 256, 362);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.65, 'rgba(0,0,0,0.25)');
      grad.addColorStop(1, 'rgba(0,0,0,0.85)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 512, 512);
    }),
    /** Ring (shockwaves, portal edges). */
    ring: canvasTex(256, 256, (g) => {
      const grad = g.createRadialGradient(128, 128, 90, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.7, 'rgba(255,255,255,0.9)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
    }),
  };
}

export function tex() {
  if (!cache) cache = build();
  return cache;
}

function mulberry(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let pcache: { soft: Texture; dot: Texture; spark: Texture; shard: Texture } | null = null;

/** Particle textures packed in ONE source (ParticleContainer requirement). */
export function particleTex() {
  if (pcache) return pcache;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  const rad = (cx: number, cy: number, r: number, stops: [number, string][]) => {
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const [o, col] of stops) grad.addColorStop(o, col);
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  rad(32, 32, 32, [
    [0, 'rgba(255,255,255,1)'],
    [0.35, 'rgba(255,255,255,0.8)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  rad(80, 16, 16, [
    [0, 'rgba(255,255,255,1)'],
    [0.6, 'rgba(255,255,255,0.95)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  const lg = g.createLinearGradient(96, 0, 160, 0);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.7, 'rgba(255,255,255,0.9)');
  lg.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = lg;
  g.beginPath();
  g.ellipse(128, 40, 31, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(172, 12);
  g.lineTo(180, 3);
  g.lineTo(189, 10);
  g.lineTo(182, 21);
  g.closePath();
  g.fill();
  const base = Texture.from(c);
  const sub = (x: number, y: number, w: number, h: number) => new Texture({ source: base.source, frame: new Rectangle(x, y, w, h) });
  pcache = { soft: sub(0, 0, 64, 64), dot: sub(64, 0, 32, 32), spark: sub(96, 32, 64, 16), shard: sub(168, 0, 24, 24) };
  return pcache;
}
