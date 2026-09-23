// Chests, stairs, waypoints, portals, shrines, stash, rift obelisk.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import { worldToScreen } from '../../core/math';
import type { LightDef } from '../../data/schema';
import type { Interactable } from '../../game/types';
import { assets } from '../assets/AssetManager';
import type { FxService } from '../fx/FxService';
import { tex } from '../textures';

const hoverGlow = new GlowFilter({ distance: 8, outerStrength: 2.2, innerStrength: 0, color: 0xffe8a0, quality: 0.2 });

interface Look {
  tile?: number;
  tileOpen?: number;
  sheet?: string;
  tileset?: string;
  light?: LightDef;
  swirl?: number; // swirl color (portals/waypoints)
  scale?: number;
}

function lookFor(o: Interactable, tileset: string): Look {
  switch (o.kind) {
    case 'chest':
      return tileset === 'cave' ? { tile: 160, tileOpen: 176 } : { tile: 144, tileOpen: 160, tileset: 'dungeon' };
    case 'stairsDown':
      return { swirl: 0x3a1a0a, light: { radius: 2.5, color: 0xff7a30, intensity: 0.7 } };
    case 'stairsUp':
      return { swirl: 0x6a6040, light: { radius: 2, color: 0xffe0b0, intensity: 0.5 } };
    case 'waypoint':
      return { sheet: 'npc/return_obelisk2', swirl: 0x3a8aff, light: { radius: 3.5, color: 0x5aa0ff, intensity: 1.2, flicker: 0.1 } };
    case 'portal':
      return { swirl: 0x4aa8ff, light: { radius: 3.5, color: 0x5ab0ff, intensity: 1.4, flicker: 0.15 } };
    case 'shrine':
      return { sheet: 'npc/return_obelisk1', light: { radius: 3, color: 0xffd060, intensity: 1, flicker: 0.1 } };
    case 'stash':
      return { tile: 145, tileset: 'dungeon', light: { radius: 2.2, color: 0xffd8a0, intensity: 0.6 } };
    case 'dungeonEntrance':
      return { swirl: 0x3a1a0a, light: { radius: 6, color: 0xff7a30, intensity: 1.7, flicker: 0.2 } };
    case 'riftObelisk':
      return { sheet: 'npc/return_obelisk1', swirl: 0xc02060, light: { radius: 4, color: 0xff3080, intensity: 1.3, flicker: 0.2 } };
    case 'difficultyAltar':
      return { sheet: 'npc/return_obelisk2', light: { radius: 3, color: 0xff4020, intensity: 1.1, flicker: 0.2 } };
    default:
      return {};
  }
}

export class InteractableView {
  private root = new Container();
  private sprite = new Sprite();
  private swirl: Graphics | null = null;
  private halo: Sprite | null = null;
  private label: Text;
  private look: Look;
  light: LightDef | undefined;

  constructor(
    readonly obj: Interactable,
    private tileset: string,
    private objects: Container,
    private high: Container,
    private overlay: Container,
  ) {
    this.look = lookFor(obj, tileset);
    this.light = this.look.light;
    this.root.addChild(this.sprite);
    objects.addChild(this.root);
    if (this.look.swirl !== undefined) {
      this.swirl = new Graphics();
      const pit = obj.kind === 'stairsDown' || obj.kind === 'stairsUp' || obj.kind === 'dungeonEntrance';
      this.swirl.blendMode = pit ? 'normal' : 'add';
      if (pit) {
        // pits lie on the floor: first in the depth-sorted object layer
        this.swirl.zIndex = -1e6;
        objects.addChild(this.swirl);
      } else high.addChild(this.swirl);
      this.halo = new Sprite({ texture: tex().soft, anchor: 0.5 });
      this.halo.blendMode = 'add';
      this.halo.tint = this.look.swirl;
      if (!pit) high.addChild(this.halo);
      else if (obj.kind === 'dungeonEntrance') {
        // zone exits get a tall ember beam so they read from across the map
        this.halo.tint = 0xff6a20;
        high.addChild(this.halo);
      }
    }
    this.label = new Text({ text: obj.name, style: { fontFamily: 'Cinzel, Georgia, serif', fontSize: obj.kind === 'dungeonEntrance' ? 26 : 20, fill: obj.kind === 'dungeonEntrance' ? 0xffc070 : 0xf0e0b0, fontWeight: '600', stroke: { color: 0x000000, width: 4 } }, resolution: 2 });
    this.label.anchor.set(0.5, 1);
    this.label.visible = false;
    overlay.addChild(this.label);
  }

  hit(px: number, py: number): boolean {
    const p = worldToScreen(this.obj.pos.x, this.obj.pos.y);
    const b = this.root.getLocalBounds();
    if (this.sprite.visible && b.width > 4) {
      return px > p.x + b.x && px < p.x + b.x + b.width && py > p.y + b.y && py < p.y + b.y + b.height;
    }
    return Math.abs(px - p.x) < 70 && Math.abs(py - p.y) < 40;
  }

  update(time: number, _dt: number, hovered: boolean, fx: FxService): void {
    const o = this.obj;
    const p = worldToScreen(o.pos.x, o.pos.y);
    this.root.position.set(p.x, p.y);
    this.root.zIndex = o.pos.x + o.pos.y;
    const open = o.state === 'open' || o.state === 'used';
    const L = this.look;
    if (L.tile !== undefined) {
      const ts = assets.getTileset(L.tileset ?? this.tileset);
      const t = ts?.tile(open && L.tileOpen !== undefined ? L.tileOpen : L.tile);
      if (t) {
        this.sprite.texture = t.texture;
        this.sprite.position.set(-t.ox, -t.oy + 48);
      }
    } else if (L.sheet) {
      const sheet = assets.getSheet(L.sheet);
      if (!sheet && assets.hasSheet(L.sheet)) void assets.loadSheets([L.sheet]);
      const name = sheet ? Object.keys(sheet.def.animations)[0] : '';
      const ft = sheet?.frame(name, 0, 0);
      if (ft) {
        const sc = L.scale ?? 1;
        this.sprite.texture = ft.texture;
        this.sprite.scale.set(sc * (ft.w / Math.max(1, ft.texture.frame.width)));
        this.sprite.position.set(-ft.ox * sc, -ft.oy * sc);
      }
    } else this.sprite.visible = false;
    if (o.kind === 'shrine' && open) this.sprite.tint = 0x707070;
    this.root.filters = hovered ? [hoverGlow] : [];
    if (this.swirl) {
      const g = this.swirl;
      g.clear();
      const c = L.swirl!;
      const stairs = o.kind === 'stairsDown' || o.kind === 'stairsUp' || o.kind === 'dungeonEntrance';
      if (stairs) {
        // dark descending pit with ember glow ring
        for (let i = 5; i >= 1; i--) g.ellipse(p.x, p.y, 20 * i + 8, 10 * i + 4).fill({ color: i === 5 ? 0x2a1810 : 0x000000, alpha: i === 5 ? 0.9 : 0.25 + (5 - i) * 0.15 });
        g.ellipse(p.x, p.y, 108, 54).stroke({ color: o.kind === 'stairsUp' ? 0xd0c090 : 0xff6020, width: 3, alpha: 0.5 + Math.sin(time * 2) * 0.2 });
        if (o.kind === 'dungeonEntrance' && this.halo) {
          this.halo.position.set(p.x, p.y - 150);
          this.halo.scale.set(1.6, 7);
          this.halo.alpha = 0.5 + Math.sin(time * 2.5) * 0.15;
          if (Math.random() < 0.5) fx.burst('embers', o.pos, { count: 2 });
        }
      } else {
        const n = 5;
        for (let i = 0; i < n; i++) {
          const a = time * (1.5 + i * 0.3) + (i * Math.PI * 2) / n;
          const r = 34 + i * 6;
          g.ellipse(p.x, p.y - 70, r * 0.75, r * 1.25).stroke({ color: c, width: 3, alpha: 0.25 + 0.12 * Math.sin(a) });
        }
        if (o.kind === 'portal') g.ellipse(p.x, p.y - 70, 30, 58).fill({ color: 0xd8f0ff, alpha: 0.35 + Math.sin(time * 5) * 0.1 });
        if (this.halo) {
          this.halo.position.set(p.x, p.y - 60);
          this.halo.scale.set(2.2, 3);
          this.halo.alpha = 0.55 + Math.sin(time * 3) * 0.15;
        }
        if (Math.random() < 0.25) fx.burst('portal', o.pos, { count: 1, color: c, z: 0.5 });
      }
    }
    const showLabel = hovered || o.kind === 'dungeonEntrance';
    this.label.visible = showLabel;
    if (showLabel) this.label.position.set(p.x, p.y - (o.kind === 'dungeonEntrance' ? 210 + Math.sin(time * 2) * 4 : Math.max(90, -this.root.getLocalBounds().y) + 6));
  }

  destroy(): void {
    this.objects.removeChild(this.root);
    this.root.destroy({ children: true });
    this.swirl?.destroy();
    this.halo?.destroy();
    this.label.destroy();
    void this.high;
    void this.overlay;
  }
}
