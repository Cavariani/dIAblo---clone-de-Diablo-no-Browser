// Persistent save: IndexedDB (fallback localStorage), versioned with migrations, JSON export/import.
import type { SaveAPI } from '../api';
import type { CharacterState, SaveFile, Settings, StashState } from '../types';
import { defaultSettings, emptySave, emptyStash, SAVE_VERSION } from './defaults';

const DB = 'diablo-browser';
const STORE = 'save';
const KEY = 'main';
const LS_KEY = 'diablo-browser-save';

/** Migrations: index = from version. Each returns data at version+1. */
const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {
  0: (d) => ({ ...d, version: 1, settings: { ...defaultSettings(), ...((d.settings as object) ?? {}) } }),
};

export function migrate(raw: unknown): SaveFile {
  if (!raw || typeof raw !== 'object') throw new Error('Arquivo de save inválido.');
  let d = raw as Record<string, unknown>;
  let v = typeof d.version === 'number' ? d.version : 0;
  if (v > SAVE_VERSION) throw new Error('Este save foi criado por uma versão mais nova do jogo.');
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`Não há migração para a versão ${v}.`);
    d = m(d);
    v = d.version as number;
  }
  const base = emptySave();
  const file: SaveFile = {
    ...base,
    ...(d as unknown as SaveFile),
    settings: { ...base.settings, ...((d.settings as Settings) ?? {}) },
    stash: (d.stash as StashState) ?? emptyStash(),
  };
  if (!Array.isArray(file.characters)) throw new Error('Save sem personagens válidos.');
  for (const c of file.characters) {
    if (!c.id || !c.classId || !c.name) throw new Error('Personagem corrompido no save.');
    c.inventory ??= [];
    c.equipment ??= {};
    c.materials ??= { scrap: 0, arcaneDust: 0, veiledCrystal: 0, forgottenSoul: 0, riftShard: 0 };
    c.quests ??= {};
    c.waypoints ??= ['town:1'];
    c.bossesKilled ??= {};
    c.paragonAlloc ??= {};
  }
  while (file.stash.tabs.length < 4) file.stash.tabs.push([]);
  return file;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export class SaveManager implements SaveAPI {
  file: SaveFile = emptySave();
  private db: IDBDatabase | null = null;
  private writing: Promise<void> = Promise.resolve();
  private pending = false;

  async init(): Promise<SaveFile> {
    this.db = await openDb();
    let raw: unknown = null;
    if (this.db) raw = await this.idbGet();
    if (!raw) {
      try {
        const s = localStorage.getItem(LS_KEY);
        if (s) raw = JSON.parse(s);
      } catch {
        raw = null;
      }
    }
    if (raw) {
      try {
        this.file = migrate(raw);
      } catch (e) {
        console.warn('[save] could not load save, starting fresh', e);
        this.file = emptySave();
      }
    }
    return this.file;
  }

  private idbGet(): Promise<unknown> {
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(STORE, 'readonly');
        const r = tx.objectStore(STORE).get(KEY);
        r.onsuccess = () => resolve(r.result ?? null);
        r.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  /** Serialized, coalesced write. */
  private persist(): Promise<void> {
    if (this.pending) return this.writing;
    this.pending = true;
    this.writing = this.writing.then(async () => {
      this.pending = false;
      this.file.meta.updatedAt = Date.now();
      const json = JSON.stringify(this.file);
      const data = JSON.parse(json);
      let ok = false;
      if (this.db) {
        ok = await new Promise<boolean>((resolve) => {
          try {
            const tx = this.db!.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(data, KEY);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
          } catch {
            resolve(false);
          }
        });
      }
      try {
        localStorage.setItem(LS_KEY, json);
        ok = true;
      } catch {
        /* quota — IndexedDB copy is enough */
      }
      if (!ok) console.warn('[save] failed to persist');
    });
    return this.writing;
  }

  saveCharacter(c: CharacterState): Promise<void> {
    const i = this.file.characters.findIndex((x) => x.id === c.id);
    if (i >= 0) this.file.characters[i] = c;
    else this.file.characters.push(c);
    this.file.lastCharacterId = c.id;
    return this.persist();
  }

  deleteCharacter(id: string): Promise<void> {
    this.file.characters = this.file.characters.filter((c) => c.id !== id);
    if (this.file.lastCharacterId === id) this.file.lastCharacterId = this.file.characters[0]?.id ?? null;
    return this.persist();
  }

  saveStash(stash: StashState): Promise<void> {
    this.file.stash = stash;
    return this.persist();
  }

  saveSettings(settings: Settings): Promise<void> {
    this.file.settings = settings;
    return this.persist();
  }

  exportJson(): string {
    return JSON.stringify(this.file, null, 2);
  }

  async importJson(json: string): Promise<SaveFile> {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      throw new Error('O arquivo não é um JSON válido.');
    }
    this.file = migrate(raw);
    await this.persist();
    return this.file;
  }
}
