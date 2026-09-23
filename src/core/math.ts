// Core math helpers + isometric projection.
// WORLD SPACE: cartesian, 1 unit = 1 tile. +x goes down-right on screen, +y goes down-left.
// SCREEN (iso) SPACE: pixels at zoom 1. Tile diamond is 64x32 px.
// Cell (i, j) covers world [i, i+1) x [j, j+1); its center is (i + 0.5, j + 0.5).

export interface Vec2 {
  x: number;
  y: number;
}

export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_TW = TILE_W / 2;
export const HALF_TH = TILE_H / 2;

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });
export const vclone = (v: Vec2): Vec2 => ({ x: v.x, y: v.y });
export const vset = (out: Vec2, x: number, y: number): Vec2 => {
  out.x = x;
  out.y = y;
  return out;
};
export const vcopy = (out: Vec2, v: Vec2): Vec2 => {
  out.x = v.x;
  out.y = v.y;
  return out;
};
export const vadd = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const vsub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const vscale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const vlen = (a: Vec2): number => Math.hypot(a.x, a.y);
export const vlen2 = (a: Vec2): number => a.x * a.x + a.y * a.y;
export const vdist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const vdist2 = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};
export const vnorm = (a: Vec2): Vec2 => {
  const l = Math.hypot(a.x, a.y);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
};
export const vdot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const vlerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const vfromAngle = (angle: number, len = 1): Vec2 => ({ x: Math.cos(angle) * len, y: Math.sin(angle) * len });
export const vangle = (a: Vec2): number => Math.atan2(a.y, a.x);
export const vangleTo = (from: Vec2, to: Vec2): number => Math.atan2(to.y - from.y, to.x - from.x);
export const vrotate = (a: Vec2, angle: number): Vec2 => {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Frame-rate independent exponential approach. `rate` ~ 1/seconds-to-63%. */
export const damp = (current: number, target: number, rate: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-rate * dt));

/** Shortest signed difference between two angles (radians), in (-PI, PI]. */
export const angleDiff = (a: number, b: number): number => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
};

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Isometric projection
// ---------------------------------------------------------------------------

/** World (tiles) -> screen pixels (zoom 1, camera at origin). */
export const worldToScreen = (wx: number, wy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 => {
  out.x = (wx - wy) * HALF_TW;
  out.y = (wx + wy) * HALF_TH;
  return out;
};

/** Screen pixels (zoom 1, camera at origin) -> world (tiles). */
export const screenToWorld = (sx: number, sy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 => {
  out.x = sx / TILE_W + sy / TILE_H;
  out.y = sy / TILE_H - sx / TILE_W;
  return out;
};

/** Depth key for painter's algorithm: larger = drawn later (in front). */
export const isoDepth = (wx: number, wy: number): number => wx + wy;

/**
 * Converts a world-space direction into the on-screen angle (radians, 0 = screen right, +PI/2 = screen down).
 * Useful for picking 8-direction sprite frames.
 */
export const worldDirToScreenAngle = (dx: number, dy: number): number => Math.atan2((dx + dy) * HALF_TH, (dx - dy) * HALF_TW);

/** Converts an on-screen direction (pixels) back into a normalized world direction. */
export const screenDirToWorld = (sdx: number, sdy: number): Vec2 => {
  const w = screenToWorld(sdx, sdy);
  return vnorm(w);
};

/** Integer cell containing world point. */
export const cellOf = (wx: number, wy: number): { cx: number; cy: number } => ({ cx: Math.floor(wx), cy: Math.floor(wy) });

/** Distance from point p to segment ab. */
export const distPointSegment = (p: Vec2, a: Vec2, b: Vec2): number => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  let t = l2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2 : 0;
  t = clamp01(t);
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
};

/** True if point p lies inside a cone (sector) from origin facing `angle` with half-angle `halfArc` and radius r (+pad). */
export const inCone = (origin: Vec2, angle: number, halfArc: number, r: number, p: Vec2, pad = 0): boolean => {
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  const d = Math.hypot(dx, dy);
  if (d > r + pad) return false;
  if (d < pad + 0.05) return true;
  return Math.abs(angleDiff(angle, Math.atan2(dy, dx))) <= halfArc + Math.asin(Math.min(1, pad / Math.max(d, 1e-6)));
};
