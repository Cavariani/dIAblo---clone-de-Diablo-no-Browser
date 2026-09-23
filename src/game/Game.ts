// Game session: owns the current World, systems, fixed-step loop, zone travel and autosave.
import { EventBus, type GameEvents } from '../core/events';
import { FixedLoop } from '../core/loop';
import type { InputManager } from '../core/input';
import { hashString, Rng } from '../core/rng';
import { Data } from '../data';
import type { DifficultyDef, ZoneDef } from '../data/schema';
import { monsterLevel as calcMonsterLevel } from '../formulas/scaling';
import type { RendererAPI } from '../render/types';
import { generateLevel } from '../world/gen';
import type { GeneratorParams, InteractableSpawn } from '../world/types';
import { applyPlayerStats, createNpcActor, createPlayerActor, playerVisual } from './actors';
import type { AudioAPI, GameCtx, SaveAPI, System, TravelTarget, UIAPI, ZoneInstanceInfo } from './api';
import { Combat } from './combat/Combat';
import { spawnPack } from './monsters/spawn';
import { gainXp } from './progression/xp';
import './skills';
import './skills/fallback';
import { AISystem } from './systems/AISystem';
import { CastSystem } from './systems/CastSystem';
import { DeathSystem } from './systems/DeathSystem';
import { GroundEffectSystem, ProjectileSystem } from './systems/EffectsSystem';
import { MovementSystem } from './systems/MovementSystem';
import { PlayerControlSystem, registerInteractHandler } from './systems/PlayerControlSystem';
import { StatusSystem } from './systems/StatusSystem';
import type { Actor, CharacterState, Interactable, Settings, StashState } from './types';
import { World } from './World';
import { extraSystems, gameHooks, worldHooks } from './hooks';

export interface GameOptions {
  character: CharacterState;
  stash: StashState;
  settings: Settings;
  renderer: RendererAPI;
  ui: UIAPI;
  audio: AudioAPI;
  input: InputManager;
  save: SaveAPI | null;
}

export { registerSystem, onWorldEntered, onGameCreated } from './hooks';

const INTERACT_NAMES: Partial<Record<Interactable['kind'], string>> = {
  chest: 'Baú',
  door: 'Porta',
  stairsDown: 'Descer',
  stairsUp: 'Subir',
  waypoint: 'Pórtico de Viagem',
  portal: 'Portal da Cidade',
  shrine: 'Santuário',
  stash: 'Baú Compartilhado',
  riftObelisk: 'Obelisco da Fenda',
  riftExit: 'Saída da Fenda',
  breakable: 'Urna',
  bossPortal: 'Covil',
  difficultyAltar: 'Altar do Tormento',
  dungeonEntrance: 'Entrada',
};

export class Game implements GameCtx {
  readonly events = new EventBus<GameEvents>();
  rng = new Rng();
  time = 0;
  world!: World;
  player!: Actor;
  readonly character: CharacterState;
  readonly stash: StashState;
  readonly settings: Settings;
  readonly combat: Combat;
  readonly fx;
  readonly audio: AudioAPI;
  readonly ui: UIAPI;
  readonly input: InputManager;
  readonly renderer: RendererAPI;
  readonly save_: SaveAPI | null;
  readonly loop = new FixedLoop();
  readonly control = new PlayerControlSystem();
  private systems: System[] = [];
  paused = false;
  loading = false;
  /** Dungeon instance kept alive while in town via portal. */
  private portalReturn: { world: World; pos: { x: number; y: number } } | null = null;
  private disposed = false;
  private unsub: (() => void)[] = [];

  constructor(o: GameOptions) {
    this.character = o.character;
    this.stash = o.stash;
    this.settings = o.settings;
    this.renderer = o.renderer;
    this.fx = o.renderer.fx;
    this.ui = o.ui;
    this.audio = o.audio;
    this.input = o.input;
    this.save_ = o.save;
    this.combat = new Combat(
      () => this,
      (s) => this.loop.hitStop(s),
    );
    const core: { order: number; make: () => System }[] = [
      { order: 10, make: () => this.control },
      { order: 20, make: () => new AISystem() },
      { order: 30, make: () => new CastSystem() },
      { order: 40, make: () => new MovementSystem() },
      { order: 50, make: () => new ProjectileSystem() },
      { order: 60, make: () => new GroundEffectSystem() },
      { order: 70, make: () => new StatusSystem() },
      { order: 130, make: () => new DeathSystem() },
    ];
    this.systems = [...core, ...extraSystems].sort((a, b) => a.order - b.order).map((s) => s.make());
    this.unsub.push(this.events.on('actorDied', ({ actor, killer }) => this.onDied(actor, killer)));
    this.registerCoreInteractions();
    for (const h of gameHooks) h(this);
  }

  get difficulty(): DifficultyDef {
    return Data.difficulty(this.character.difficulty);
  }

  refreshPlayerStats(): void {
    if (!this.player) return;
    applyPlayerStats(this.player);
    this.player.visual = playerVisual(this.character);
    this.events.emit('statsChanged', {});
  }

  save(reason: string): void {
    this.character.updatedAt = Date.now();
    this.events.emit('saveRequested', { reason });
    if (!this.save_) return;
    void Promise.all([this.save_.saveCharacter(this.character), this.save_.saveStash(this.stash)]).then(() => this.events.emit('saved', { reason }));
  }

  async start(): Promise<void> {
    const loc = this.character.location;
    const zone = Data.tryZone(loc.zoneId) ?? Data.zones[0];
    await this.enterZone(zone.id, loc.floor || 1, 'start');
  }

  // -------------------------------------------------------------------------------- zones

  private buildInfo(zone: ZoneDef, floor: number, seed: number, rift = false, grLevel = 0): ZoneInstanceInfo {
    const area = zone.baseLevel + zone.levelPerFloor * (floor - 1);
    const d = this.difficulty;
    return {
      zone,
      biome: Data.biome(zone.biome),
      floor,
      monsterLevel: zone.kind === 'town' ? 1 : calcMonsterLevel(area, this.character.level, d.levelOffset, d.scaleToPlayer),
      isTown: zone.kind === 'town',
      isRift: rift,
      greaterRiftLevel: grLevel,
      seed,
    };
  }

  async enterZone(zoneId: string, floor: number, via: 'waypoint' | 'stairs' | 'portal' | 'start' | 'stairsUp', opts: { rift?: boolean; grLevel?: number; zoneOverride?: ZoneDef } = {}): Promise<void> {
    const zone = opts.zoneOverride ?? Data.zone(zoneId);
    this.loading = true;
    this.events.emit('zoneEntering', { zoneId: zone.id, floor });
    const seed = hashString(`${zone.id}:${floor}:${Date.now()}`);
    const info = this.buildInfo(zone, floor, seed, opts.rift, opts.grLevel);
    const params: GeneratorParams = {
      seed,
      biome: zone.biome,
      zoneId: zone.id,
      floor,
      floors: zone.floors,
      width: zone.size[0],
      height: zone.size[1],
      bossFloor: !!zone.bossId && floor === zone.floors && !opts.rift,
      hasWaypoint: zone.waypointFloors.includes(floor),
      rift: !!opts.rift,
      chests: new Rng(seed).int(zone.chestsPerFloor[0], zone.chestsPerFloor[1]),
      shrines: new Rng(seed + 1).int(zone.shrinesPerFloor[0], zone.shrinesPerFloor[1]),
      traps: Data.biome(zone.biome).traps,
      density: zone.density,
    };
    const level = generateLevel(params);
    const world = new World(info, level);
    this.rng = new Rng(seed ^ 0x5bd1e995);
    this.setupWorld(world, via === 'stairsUp' ? (level.interactables.find((i) => i.kind === 'stairsDown')?.pos ?? level.playerStart) : level.playerStart);
    // spawn packs
    for (const pk of level.packs) {
      const r = this.rng.next();
      const kind = r < zone.rareChance ? 'rare' : r < zone.rareChance + zone.championChance ? 'champion' : 'normal';
      spawnPack(this, this.rng, pk.pos, pk.size, kind);
    }
    for (const n of level.npcs ?? []) {
      const def = Data.npcs.find((x) => x.id === n.npcId);
      if (def) world.addActor(createNpcActor(world.nextId(), def, n.pos, n.facing));
    }
    await this.activateWorld(world);
    this.character.location = { zoneId: zone.id, floor };
    if (params.hasWaypoint) this.unlockWaypoint(`${zone.id}:${floor}`);
    this.events.emit('zoneEntered', { zoneId: zone.id, floor, isTown: info.isTown, isRift: info.isRift });
    this.ui.banner(zone.name, zone.kind === 'town' ? zone.subtitle : `Nível ${floor}`, 'zone');
    this.audio.playMusic(info.biome.music, 1.5);
    (this.audio as { playAmbient?: (id: string | null) => void }).playAmbient?.(info.biome.ambientSfx ?? null);
    if (via !== 'start') this.save(`zone:${zone.id}:${floor}`);
  }

  private setupWorld(world: World, start: { x: number; y: number }): void {
    this.world = world;
    const pos = world.nearestWalkable(start, 6) ?? start;
    if (!this.player) {
      this.player = createPlayerActor(world.nextId(), this.character, pos);
    } else {
      this.player.id = world.nextId();
      this.player.pos.x = pos.x;
      this.player.pos.y = pos.y;
      this.player.path = null;
      this.player.cast = null;
      this.player.dash = null;
      this.player.statuses = this.player.statuses.filter((s) => s.id === 'haste' || s.id === 'fortify');
    }
    world.addActor(this.player);
    for (const s of world.level.interactables) this.addInteractable(world, s);
  }

  addInteractable(world: World, s: InteractableSpawn): Interactable {
    const big = s.kind === 'waypoint' || s.kind === 'stairsDown' || s.kind === 'stairsUp' || s.kind === 'riftObelisk';
    return world.addInteractable({
      id: world.nextId(),
      kind: s.kind,
      pos: { ...s.pos },
      radius: big ? 0.9 : 0.4,
      state: 'idle',
      name: s.name ?? INTERACT_NAMES[s.kind] ?? s.kind,
      interactRange: big ? 1.4 : 1,
      blocksMovement: false,
      data: { ...(s.data ?? {}) },
      visual: {},
      alive: true,
    });
  }

  private async activateWorld(world: World): Promise<void> {
    const sheets = new Set<string>();
    for (const a of world.actors) if (a.visual.sheet) sheets.add(a.visual.sheet);
    for (const m of world.info.zone.monsters) {
      const d = Data.tryEnemy(m.enemyId);
      if (d) sheets.add(d.sprite.sheet);
      for (const ab of d?.abilities ?? []) if (ab.summon) sheets.add(Data.enemy(ab.summon.enemyId).sprite.sheet);
    }
    await this.renderer.setWorld(world, [...sheets]);
    this.renderer.snapCamera(this.player.pos);
    for (const h of worldHooks) h(this);
    this.control.reset();
    this.loading = false;
  }

  travel(to: TravelTarget): void {
    if (this.loading) return;
    void this.travelAsync(to);
  }

  private async travelAsync(to: TravelTarget): Promise<void> {
    switch (to.kind) {
      case 'town': {
        if (!this.world.info.isTown) this.portalReturn = { world: this.world, pos: { ...this.player.pos } };
        const town = Data.zones.find((z) => z.kind === 'town');
        if (town) await this.enterZone(town.id, 1, 'portal');
        if (this.portalReturn && town) {
          const p = this.player.pos;
          this.addInteractable(this.world, { kind: 'portal', pos: { x: p.x + 1, y: p.y + 0.5 }, data: { back: true }, name: `Portal: ${this.portalReturn.world.info.zone.name}` });
        }
        break;
      }
      case 'portalBack': {
        const back = this.portalReturn;
        if (!back) return;
        this.portalReturn = null;
        this.loading = true;
        this.world.removeActor(this.player);
        this.world = back.world;
        this.player.pos.x = back.pos.x;
        this.player.pos.y = back.pos.y;
        this.player.id = back.world.nextId();
        back.world.addActor(this.player);
        await this.activateWorld(back.world);
        this.character.location = { zoneId: back.world.info.zone.id, floor: back.world.info.floor };
        this.events.emit('zoneEntered', { zoneId: back.world.info.zone.id, floor: back.world.info.floor, isTown: false, isRift: back.world.info.isRift });
        this.audio.playMusic(back.world.info.biome.music, 1.5);
        break;
      }
      case 'zone':
        this.portalReturn = null;
        await this.enterZone(to.zoneId, to.floor, to.via);
        break;
      case 'rift':
      case 'riftNextFloor':
        // implemented by the rift module
        break;
    }
  }

  unlockWaypoint(key: string): void {
    if (!this.character.waypoints.includes(key)) {
      this.character.waypoints.push(key);
      this.events.emit('waypointUnlocked', { key });
    }
  }

  private registerCoreInteractions(): void {
    registerInteractHandler('stairsDown', (ctx) => {
      const info = ctx.world.info;
      const next = info.floor + 1;
      if (next <= info.zone.floors) ctx.travel({ kind: 'zone', zoneId: info.zone.id, floor: next, via: 'stairs' });
      else if (info.zone.next) ctx.travel({ kind: 'zone', zoneId: info.zone.next, floor: 1, via: 'stairs' });
      ctx.audio.play('stairs');
    });
    registerInteractHandler('stairsUp', (ctx) => {
      const info = ctx.world.info;
      if (info.floor > 1) void (ctx as Game).enterZone(info.zone.id, info.floor - 1, 'stairsUp');
      else ctx.travel({ kind: 'town' });
      ctx.audio.play('stairs');
    });
    registerInteractHandler('portal', (ctx, o) => {
      if (o.data.back) ctx.travel({ kind: 'portalBack' });
    });
  }

  // -------------------------------------------------------------------------------- events

  private onDied(actor: Actor, killer: Actor | null): void {
    if (actor.kind === 'player') {
      this.character.stats.deaths++;
      this.events.emit('playerDied', { killer });
      this.ui.openPanel('death');
      this.audio.play('player_death');
      return;
    }
    if (actor.monster && actor.faction === 'enemy') {
      this.character.stats.kills++;
      if (actor.tags.has('elite')) this.character.stats.eliteKills++;
      gainXp(this, actor.monster.xp, actor.level);
    }
  }

  respawn(inTown: boolean): void {
    const p = this.player;
    p.alive = true;
    p.state = 'idle';
    p.life = p.maxLife;
    p.statuses = [];
    p.anim.name = 'stance';
    p.anim.serial++;
    p.invulnerable = 2;
    this.ui.closePanel('death');
    this.events.emit('playerRespawned', { inTown });
    if (inTown) this.travel({ kind: 'town' });
    else {
      const s = this.world.level.waypointPos ?? this.world.level.playerStart;
      p.pos.x = s.x;
      p.pos.y = s.y;
      this.renderer.snapCamera(p.pos);
    }
  }

  // -------------------------------------------------------------------------------- loop

  frame(realDt: number): void {
    if (this.disposed || !this.world) return;
    const r = this.renderer;
    const input = this.input;
    const mw = r.screenToWorld(input.mouse.x, input.mouse.y);
    input.mouseWorld.x = mw.x;
    input.mouseWorld.y = mw.y;
    const h = r.pick(input.mouse.x, input.mouse.y);
    input.hover.actorId = h.actorId;
    input.hover.groundItemId = h.groundItemId;
    input.hover.interactableId = h.interactableId;
    r.setShowAllLabels(input.isDown('showLabels') || this.settings.alwaysShowItemLabels);
    this.paused = this.ui.isModal() && !this.world.info.isTown && false;
    let alpha = 0;
    if (!this.loading && !this.ui.isModal()) alpha = this.loop.advance(realDt, (dt) => this.step(dt));
    else input.poll();
    r.render(this, realDt, alpha);
    this.ui.update(realDt);
    this.audio.setListener(this.player.pos);
    this.character.stats.playTime += realDt;
    input.endFrame();
  }

  private step(dt: number): void {
    this.time += dt;
    this.input.poll();
    const w = this.world;
    w.rebuildHash();
    w.updateFlow(this.player.pos);
    for (const s of this.systems) s.update(this, dt);
  }

  dispose(): void {
    this.disposed = true;
    for (const u of this.unsub) u();
    this.events.clear();
    this.renderer.clearWorld();
  }
}
