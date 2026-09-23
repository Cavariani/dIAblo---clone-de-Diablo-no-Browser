// Ground loot: drop arc, loot sprite, rarity label, and light beams (spectacular for legendary/set).
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { worldToScreen } from '../../core/math';
import { Data } from '../../data';
import type { LightDef, Rarity } from '../../data/schema';
import type { GroundItem } from '../../game/types';
import { assets } from '../assets/AssetManager';
import type { FxService } from '../fx/FxService';
import { tex } from '../textures';
import { frameAt } from './ActorView';

const RARITY_COLOR: Record<Rarity, number> = { common: 0xc8c4bc, magic: 0x6c8cff, rare: 0xffd84a, legendary: 0xff8a1c, set: 0x3fdc5a };

export function itemLabel(g: GroundItem): { text: string; color: number } {
  if (g.kind === 'gold') return { text: `${g.gold} Ouro`, color: 0xffd84a };
  if (g.kind === 'potion') return { text: 'Poção de Vida', color: 0xff6060 };
  if (g.kind === 'globe') return { text: '', color: 0xff3030 };
  if (g.kind === 'material') return { text: `${Data.material(g.materialId!)?.name ?? 'Material'}${g.amount > 1 ? ` x${g.amount}` : ''}`, color: 0xc8a0ff };
  if (g.kind === 'consumable') return { text: Data.consumable(g.consumableId!)?.name ?? 'Item', color: 0xe8e0d0 };
  const it = g.item!;
  return { text: it.name, color: RARITY_COLOR[it.rarity] };
}

export class ItemView {
  private sprite = new Sprite();
  private labelBox = new Container();
  private label: Text;
  private labelBg = new Graphics();
  private beam: Sprite | null = null;
  private beam2: Sprite | null = null;
  private rays: Sprite | null = null;
  private sparkT = 0;
  private landed = false;
  private animT = 0;
  light: LightDef | undefined;
  lightMult = 1;
  private lx = 0;
  private ly = 0;
  private lw = 0;
  private lh = 0;

  constructor(
    readonly item: GroundItem,
    private objects: Container,
    private high: Container,
    private overlay: Container,
  ) {
    const { text, color } = itemLabel(item);
    this.label = new Text({ text, style: { fontFamily: 'Cinzel, Georgia, serif', fontSize: 18, fill: color, fontWeight: '600' }, resolution: 2 });
    this.label.anchor.set(0.5);
    this.labelBox.addChild(this.labelBg, this.label);
    const w = this.label.width + 14;
    const h = this.label.height + 6;
    this.labelBg.roundRect(-w / 2, -h / 2, w, h, 3).fill({ color: 0x07060a, alpha: 0.82 }).stroke({ color, alpha: 0.55, width: 1 });
    this.lw = w;
    this.lh = h;
    this.overlay.addChild(this.labelBox);
    this.labelBox.visible = false;
    objects.addChild(this.sprite);
    const rarity = item.item?.rarity;
    if (item.kind === 'globe') this.light = { radius: 1.2, color: 0xff2020, intensity: 0.9 };
    if (rarity && rarity !== 'common') {
      const big = rarity === 'legendary' || rarity === 'set';
      const c = RARITY_COLOR[rarity];
      this.beam = new Sprite({ texture: tex().beam, anchor: { x: 0.5, y: 1 } });
      this.beam.blendMode = 'add';
      this.beam.tint = c;
      this.beam.scale.set(big ? 1.1 : 0.45, big ? 2.4 : rarity === 'rare' ? 1 : 0.6);
      this.beam.alpha = big ? 0.95 : 0.55;
      high.addChild(this.beam);
      if (big) {
        this.beam2 = new Sprite({ texture: tex().beam, anchor: { x: 0.5, y: 1 } });
        this.beam2.blendMode = 'add';
        this.beam2.tint = 0xffffff;
        this.beam2.scale.set(0.35, 2.6);
        high.addChild(this.beam2);
        this.rays = new Sprite({ texture: tex().ring, anchor: 0.5 });
        this.rays.blendMode = 'add';
        this.rays.tint = c;
        high.addChild(this.rays);
      }
      this.light = { radius: big ? 3.2 : 1.4, color: c, intensity: big ? 1.4 : 0.7 };
    }
  }

  hit(px: number, py: number): boolean {
    if (this.labelBox.visible && Math.abs(px - this.lx) < this.lw / 2 && Math.abs(py - this.ly) < this.lh / 2) return true;
    const s = this.sprite;
    return s.visible && px > s.x - 20 && px < s.x + Math.max(40, s.width) && py > s.y - 20 && py < s.y + Math.max(30, s.height) + 10;
  }

  update(time: number, dt: number, showLabel: boolean, hovered: boolean, fx: FxService): void {
    const g = this.item;
    const p = worldToScreen(g.pos.x, g.pos.y);
    const t = Math.min(1, (time - g.droppedAt) / Math.max(0.01, g.dropDuration));
    const f = worldToScreen(g.from.x, g.from.y);
    const x = f.x + (p.x - f.x) * t;
    const y = f.y + (p.y - f.y) * t - Math.sin(t * Math.PI) * 70;
    this.animT += dt;
    const rarity = g.item?.rarity;
    const big = rarity === 'legendary' || rarity === 'set';
    if (t >= 1 && !this.landed) {
      this.landed = true;
      if (big) {
        fx.shockwave(g.pos, { radius: 3, duration: 0.6 });
        fx.burst(rarity === 'set' ? 'set_sparkles' : 'legendary_sparkles', g.pos, { count: 40, z: 0.2 });
      }
    }
    // sprite
    const base = g.item ? Data.tryItemBase(g.item.baseId) : undefined;
    const sheetId = g.kind === 'gold' ? `loot/${g.gold! >= 100 ? 'coins100' : g.gold! >= 25 ? 'coins25' : 'coins5'}` : g.kind === 'potion' ? 'loot/hp_potion' : base?.groundSprite ? `loot/${base.groundSprite}` : g.kind === 'material' ? 'loot/gem' : 'loot/pouch';
    const sheet = assets.getSheet(sheetId);
    if (!sheet && assets.hasSheet(sheetId)) void assets.loadSheets([sheetId]);
    if (g.kind === 'globe') {
      this.sprite.texture = tex().soft;
      this.sprite.tint = 0xff2a2a;
      this.sprite.blendMode = 'add';
      this.sprite.anchor.set(0.5);
      this.sprite.scale.set(0.5 + Math.sin(time * 5) * 0.05);
      this.sprite.position.set(x, y - 22 - Math.sin(time * 3) * 5);
    } else if (sheet) {
      const name = Object.keys(sheet.def.animations)[0];
      const a = sheet.anim(name)!;
      const fr = t >= 1 ? a.frames - 1 : frameAt(a, t * (a.duration / 1000), false);
      const ft = sheet.frame(name, fr, 0);
      if (ft) {
        this.sprite.texture = ft.texture;
        this.sprite.scale.set(0.75 * (ft.w / Math.max(1, ft.texture.frame.width)));
        this.sprite.position.set(x - ft.ox * 0.75, (t >= 1 ? p.y : y) - ft.oy * 0.75);
      }
    }
    this.sprite.zIndex = g.pos.x + g.pos.y - 0.3;
    // label
    const always = rarity === 'rare' || big;
    const show = t >= 1 && g.kind !== 'globe' && (showLabel || always || hovered);
    this.labelBox.visible = show;
    if (show) {
      this.lx = p.x;
      this.ly = p.y - 34;
      this.labelBox.position.set(this.lx, this.ly);
      this.labelBox.scale.set(hovered ? 1.08 : 1);
    }
    // beams
    if (this.beam) {
      const pulse = 0.85 + Math.sin(time * 4) * 0.15;
      this.beam.position.set(p.x, p.y);
      this.beam.alpha = (big ? 0.95 : 0.55) * pulse * Math.min(1, t * 2);
      if (this.beam2) {
        this.beam2.position.set(p.x, p.y);
        this.beam2.alpha = 0.6 * pulse;
      }
      if (this.rays) {
        this.rays.position.set(p.x, p.y);
        this.rays.scale.set(0.9 + Math.sin(time * 3) * 0.1, 0.45 + Math.sin(time * 3) * 0.05);
        this.rays.alpha = 0.7;
      }
      this.lightMult = pulse;
      if (big) {
        this.sparkT -= dt;
        if (this.sparkT <= 0) {
          this.sparkT = 0.06;
          fx.burst(rarity === 'set' ? 'set_sparkles' : 'legendary_sparkles', g.pos, { count: 1, z: 0.1 });
        }
      }
    }
  }

  destroy(): void {
    this.objects.removeChild(this.sprite);
    this.sprite.destroy();
    this.labelBox.destroy({ children: true });
    this.beam?.destroy();
    this.beam2?.destroy();
    this.rays?.destroy();
    void this.high;
  }
}
