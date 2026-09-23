import { describe, expect, it } from 'vitest';
import { migrate } from '../src/game/save/SaveManager';
import { SAVE_VERSION } from '../src/game/save/defaults';

describe('save migrations', () => {
  it('migrates a v0 save and fills defaults', () => {
    const f = migrate({ characters: [{ id: 'a', classId: 'berserker', name: 'X' }] });
    expect(f.version).toBe(SAVE_VERSION);
    expect(f.settings.masterVolume).toBeGreaterThan(0);
    expect(f.stash.tabs.length).toBe(4);
    expect(f.characters[0].inventory).toEqual([]);
  });
  it('rejects garbage', () => {
    expect(() => migrate(null)).toThrow();
    expect(() => migrate({ version: 999, characters: [] })).toThrow();
  });
});
