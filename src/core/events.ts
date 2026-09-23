// Typed event bus. Systems publish gameplay events; UI, audio, quests, achievements
// and legendary powers subscribe. Keep payloads plain objects (no Pixi/DOM).

import type { Vec2 } from './math';
import type {
  Actor,
  DamageResult,
  DamageSpec,
  GroundItem,
  Interactable,
  ItemInstance,
} from '../game/types';
import type { DifficultyId, EquipSlot, HotbarSlot, Rarity } from '../data/schema';

export interface GameEvents {
  // --- combat ---
  damage: { source: Actor | null; target: Actor; spec: DamageSpec; result: DamageResult };
  actorDied: { actor: Actor; killer: Actor | null };
  skillCast: { caster: Actor; skillId: string; target: Vec2 };
  skillFailed: { caster: Actor; skillId: string; reason: 'resource' | 'cooldown' | 'range' | 'blocked' };
  statusApplied: { target: Actor; statusId: string };
  playerHealed: { amount: number; source: 'potion' | 'globe' | 'regen' | 'leech' | 'skill' | 'other' };
  potionUsed: { charges: number };
  playerDied: { killer: Actor | null };
  playerRespawned: { inTown: boolean };

  // --- monsters ---
  eliteSpawned: { actor: Actor };
  bossSpawned: { actor: Actor };
  bossPhase: { actor: Actor; phase: number; announce?: string };
  bossDefeated: { actor: Actor; bossId: string };

  // --- progression ---
  xpGained: { amount: number; total: number };
  levelUp: { level: number };
  paragonUp: { paragonLevel: number };
  skillsChanged: Record<string, never>;
  hotbarChanged: { slot: HotbarSlot | null };
  statsChanged: Record<string, never>;

  // --- items ---
  itemDropped: { ground: GroundItem; rarity: Rarity | null };
  itemPickedUp: { item: ItemInstance };
  goldPickedUp: { amount: number };
  inventoryFull: Record<string, never>;
  inventoryChanged: Record<string, never>;
  equipmentChanged: { slot: EquipSlot };
  stashChanged: Record<string, never>;
  itemSold: { item: ItemInstance; gold: number };
  itemSalvaged: { item: ItemInstance };
  itemCrafted: { item: ItemInstance; action: 'enchant' | 'upgrade' | 'buy' };
  goldChanged: { gold: number };

  // --- world ---
  zoneEntering: { zoneId: string; floor: number };
  zoneEntered: { zoneId: string; floor: number; isTown: boolean; isRift: boolean };
  interacted: { target: Interactable };
  waypointUnlocked: { key: string };
  portalOpened: { pos: Vec2 };
  chestOpened: { target: Interactable };
  shrineActivated: { shrineId: string };
  doorOpened: { target: Interactable };
  difficultyChanged: { difficulty: DifficultyId };

  // --- rifts ---
  riftOpened: { greater: boolean; level: number };
  riftProgress: { progress: number };
  riftGuardianSpawned: { actor: Actor };
  riftCompleted: { greater: boolean; level: number; timeLeft: number };
  riftFailed: Record<string, never>;

  // --- quests ---
  questAccepted: { questId: string };
  questProgress: { questId: string; progress: number; goal: number };
  questCompleted: { questId: string };
  questTurnedIn: { questId: string };

  // --- ui / meta ---
  toast: { text: string; kind?: 'info' | 'warn' | 'error' | 'legendary' | 'set' | 'levelup' | 'quest' | 'rift' };
  saveRequested: { reason: string };
  saved: { reason: string };
  settingsChanged: Record<string, never>;
  gamePaused: { paused: boolean };
}

type Handler<T> = (payload: T) => void;

export class EventBus<E extends object = GameEvents> {
  private handlers = new Map<keyof E, Set<Handler<any>>>();

  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => this.off(type, handler);
  }

  once<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    const off = this.on(type, (p) => {
      off();
      handler(p);
    });
    return off;
  }

  off<K extends keyof E>(type: K, handler: Handler<E[K]>): void {
    this.handlers.get(type)?.delete(handler);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers.get(type);
    if (!set || set.size === 0) return;
    // Copy so handlers can unsubscribe during dispatch.
    for (const h of Array.from(set)) {
      try {
        h(payload);
      } catch (err) {
        console.error(`[events] handler for "${String(type)}" threw`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
