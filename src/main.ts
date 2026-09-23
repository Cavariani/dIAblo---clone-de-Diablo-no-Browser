// Bootstrap.
import './game/modules';
import './ui/panels';
import { App } from './app/App';
import type { Rarity } from './data/schema';
import { createItem } from './game/items/generate';
import { addToGrid } from './game/items/inventory';
import { dropItem } from './game/systems/LootSystem';
import { Data } from './data';

const app = new App();
void app.boot();

// Debug hooks (used by the Playwright smoke tests).
(window as unknown as { __app: App }).__app = app;
(window as unknown as { __dbg: unknown }).__dbg = {
  quick(classId = 'berserker', zone = 'crypt', floor = 1) {
    return app.quickStart(classId, zone, floor);
  },
  give(rarity: Rarity, n = 1) {
    const g = app.game!;
    for (let i = 0; i < n; i++) addToGrid(g.character.inventory, createItem(g.rng, { ilvl: Math.max(1, g.character.level), rarity, classId: g.character.classId }));
    g.events.emit('inventoryChanged', {});
  },
  drop(rarity: Rarity) {
    const g = app.game!;
    dropItem(g, g.player.pos, createItem(g.rng, { ilvl: g.character.level, rarity, classId: g.character.classId }));
  },
  open(id: string) {
    app.ui.openPanel(id as never);
  },
  classSkills(): string[] {
    return Data.classDef(app.game!.character.classId).skills;
  },
};
