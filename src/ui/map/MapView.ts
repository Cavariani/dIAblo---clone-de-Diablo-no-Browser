// Minimap (corner) and full-screen map overlay (Tab), drawn in isometric projection on a 2D canvas.
import type { GameCtx } from '../../game/api';
import { CellKind } from '../../world/types';

const COLORS = { floor: 'rgba(120,100,80,0.55)', wall: 'rgba(230,190,120,0.9)', door: 'rgba(200,140,60,0.9)', water: 'rgba(60,110,180,0.7)' };

export class MapView {
  readonly canvas = document.createElement('canvas');
  private g = this.canvas.getContext('2d')!;
  private acc = 1;

  constructor(
    private ctx: GameCtx,
    private opts: { big: boolean },
  ) {}

  update(dt: number): void {
    this.acc += dt;
    if (this.acc < (this.opts.big ? 0.1 : 0.2)) return;
    this.acc = 0;
    this.draw();
  }

  private draw(): void {
    const c = this.canvas;
    const rect = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(rect.width * dpr));
    const H = Math.max(1, Math.round(rect.height * dpr));
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    const ctx = this.ctx;
    const w = ctx.world;
    if (!w) return;
    const m = w.map;
    const p = ctx.player.pos;
    const s = (this.opts.big ? 11 : 5.5) * dpr; // px per tile along the iso axis
    const ox = W / 2 - (p.x - p.y) * s;
    const oy = H / 2 - ((p.x + p.y) * s) / 2;
    g.setTransform(s, s / 2, -s, s / 2, ox, oy);
    const span = this.opts.big ? 999 : 26;
    const x0 = Math.max(0, Math.floor(p.x - span));
    const x1 = Math.min(m.width - 1, Math.ceil(p.x + span));
    const y0 = Math.max(0, Math.floor(p.y - span));
    const y1 = Math.min(m.height - 1, Math.ceil(p.y + span));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * m.width + x;
        if (!m.explored[i]) continue;
        const k = m.cells[i];
        if (k === CellKind.Void) continue;
        g.fillStyle = k === CellKind.Wall ? COLORS.wall : k === CellKind.Door ? COLORS.door : k === CellKind.Water || k === CellKind.Lava ? COLORS.water : COLORS.floor;
        if (k === CellKind.Wall) g.fillRect(x + 0.2, y + 0.2, 0.6, 0.6);
        else g.fillRect(x, y, 1.02, 1.02);
      }
    // markers (in screen space)
    g.setTransform(1, 0, 0, 1, 0, 0);
    const toScreen = (wx: number, wy: number) => [ox + (wx - wy) * s, oy + ((wx + wy) * s) / 2];
    const dot = (wx: number, wy: number, r: number, color: string, glow = false) => {
      const [sx, sy] = toScreen(wx, wy);
      if (sx < -10 || sy < -10 || sx > W + 10 || sy > H + 10) return;
      if (glow) {
        g.shadowColor = color;
        g.shadowBlur = 8 * dpr;
      }
      g.fillStyle = color;
      g.beginPath();
      g.arc(sx, sy, r * dpr, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    };
    for (const o of w.interactables) {
      if (!o.alive || !m.explored[Math.floor(o.pos.y) * m.width + Math.floor(o.pos.x)]) continue;
      const col =
        o.kind === 'waypoint' ? '#5ab0ff' : o.kind === 'portal' ? '#9ad8ff' : o.kind === 'stairsDown' || o.kind === 'dungeonEntrance' ? '#ff8a30' : o.kind === 'stairsUp' ? '#d8c090' : o.kind === 'shrine' ? '#ffe070' : o.kind === 'chest' ? (o.state === 'idle' ? '#c8a060' : '') : o.kind === 'stash' ? '#c8a060' : o.kind === 'riftObelisk' ? '#ff4aa0' : '#aaa';
      const exit = o.kind === 'dungeonEntrance' || o.kind === 'stairsDown';
      if (col) dot(o.pos.x, o.pos.y, (this.opts.big ? 5 : 3.5) * (exit ? 1.7 : 1), col, true);
    }
    for (const a of w.actors) {
      if (!a.alive || a.kind === 'player') continue;
      const i = Math.floor(a.pos.y) * m.width + Math.floor(a.pos.x);
      if (a.kind === 'npc') {
        dot(a.pos.x, a.pos.y, 3, '#80ff90');
        continue;
      }
      if (!m.visible[i]) continue;
      if (a.kind === 'minion') dot(a.pos.x, a.pos.y, 2, '#90e0ff');
      else if (a.tags.has('boss')) dot(a.pos.x, a.pos.y, 5, '#ff3020', true);
      else if (a.tags.has('elite')) dot(a.pos.x, a.pos.y, 3, '#ffd84a', true);
      else dot(a.pos.x, a.pos.y, 2, '#e03030');
    }
    // player arrow
    const [px, py] = toScreen(p.x, p.y);
    const f = ctx.player.facing;
    const dx = Math.cos(f) - Math.sin(f);
    const dy = (Math.cos(f) + Math.sin(f)) / 2;
    const l = Math.hypot(dx, dy) || 1;
    const ax = dx / l;
    const ay = dy / l;
    const r = (this.opts.big ? 9 : 6) * dpr;
    g.fillStyle = '#fff';
    g.shadowColor = '#fff';
    g.shadowBlur = 6 * dpr;
    g.beginPath();
    g.moveTo(px + ax * r, py + ay * r);
    g.lineTo(px - ax * r * 0.6 - ay * r * 0.6, py - ay * r * 0.6 + ax * r * 0.6);
    g.lineTo(px - ax * r * 0.6 + ay * r * 0.6, py - ay * r * 0.6 - ax * r * 0.6);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
  }
}
