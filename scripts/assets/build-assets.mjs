#!/usr/bin/env node
// Converts Flare (CC-BY-SA 3.0) assets into public/assets following src/render/assets/manifest.ts.
// Sheets keep Flare's original packed rects (source images are already tightly packed and <= 4096 px),
// images are converted to WebP. Idempotent: images are skipped when the output is newer than the source.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { loadFlareAnimation, makeModLocator } from './parse-flare-anim.mjs';
import { parseFlareTileset } from './parse-flare-tileset.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FLARE = path.join(ROOT, '.assets-src/flare-game');
const MODS = ['fantasycore', 'empyrean_campaign'].map((m) => path.join(FLARE, 'mods', m));
const locate = makeModLocator(MODS);
const OUT = path.join(ROOT, 'public/assets');
const catalog = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/assets/catalog', n), 'utf8'));

const SKIP_ENEMIES = new Set(['wyvern_air_boss', 'boulder', 'goblin_minecart']);
const QUALITY = { quality: 82, alphaQuality: 90, effort: 4 };

const jobs = [];
const converted = new Map(); // abs source -> relative output
function webp(absSrc, relOut, scale = 1) {
  if (converted.has(absSrc)) return converted.get(absSrc);
  converted.set(absSrc, relOut);
  const absOut = path.join(OUT, relOut);
  jobs.push(async () => {
    if (fs.existsSync(absOut) && fs.statSync(absOut).mtimeMs >= fs.statSync(absSrc).mtimeMs) return;
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    let img = sharp(absSrc);
    if (scale !== 1) {
      const m = await img.metadata();
      img = img.resize(Math.max(1, Math.round(m.width * scale)), Math.max(1, Math.round(m.height * scale)), { kernel: 'lanczos3' });
    }
    await img.webp(QUALITY).toFile(absOut);
  });
  return relOut;
}

const safe = (id) => id.replace(/\//g, '__');

const SCALE_BY_PREFIX = { enemy: 0.6, avatar: 0.8, npc: 0.8 };
function buildSheet(id, animRel) {
  const sc = SCALE_BY_PREFIX[id.split("/")[0]] ?? 1;
  const S = (n) => Math.round(n * sc);
  const parsed = loadFlareAnimation(animRel.replace(/^mods\/[^/]+\//, ''), locate);
  const imageIds = Object.keys(parsed.images);
  if (!imageIds.length) throw new Error(`${id}: no image`);
  const pages = [];
  const pageOf = {};
  imageIds.forEach((imgId, i) => {
    const abs = locate(parsed.images[imgId]);
    if (!abs) throw new Error(`${id}: missing image ${parsed.images[imgId]}`);
    pageOf[imgId] = i;
    pages.push(webp(abs, `sheets/${safe(id)}${i ? '-' + i : ''}.webp`, sc));
  });
  const animations = {};
  let height = 0;
  for (const [name, a] of Object.entries(parsed.animations)) {
    if (!a.frames || !a.rects.length) continue;
    // Directional unless every rect in dirs 1..7 is missing or a 1x1 blank.
    let dirs = 1;
    for (const row of a.rects) for (let d = 1; d < 8; d++) if (row[d] && row[d].w > 1 && row[d].h > 1) dirs = 8;
    const rects = [];
    for (let f = 0; f < a.frames; f++) {
      const row = a.rects[f] || a.rects[a.rects.length - 1];
      for (let d = 0; d < dirs; d++) {
        const r = row[d] || row.find(Boolean);
        if (!r) {
          rects.push([0, 0, 0, 1, 1, 0, 0]);
          continue;
        }
        rects.push([pageOf[r.image ?? ''] ?? 0, S(r.x), S(r.y), Math.max(1, S(r.w)), Math.max(1, S(r.h)), S(r.ox), S(r.oy)]);
      }
    }
    const def = { frames: a.frames, duration: a.duration_ms, type: a.type || 'looped', dirs, rects };
    if (typeof a.activeFrame === 'number') def.activeFrame = a.activeFrame;
    else if (Array.isArray(a.activeFrame)) def.activeFrame = a.activeFrame[0];
    animations[name] = def;
    if (name === 'stance') for (const r of rects) height = Math.max(height, r[6]);
  }
  if (!height) for (const a of Object.values(animations)) for (const r of a.rects) height = Math.max(height, r[6]);
  const json = { id, pages, animations, sourceScale: sc, height };
  const rel = `sheets/${safe(id)}.json`;
  fs.mkdirSync(path.join(OUT, 'sheets'), { recursive: true });
  fs.writeFileSync(path.join(OUT, rel), JSON.stringify(json));
  return rel;
}

function buildTileset(id, defRel) {
  const abs = locate(defRel);
  const t = parseFlareTileset(fs.readFileSync(abs, 'utf8'));
  const pages = [];
  const pageOf = {};
  t.images.forEach((img, i) => {
    const src = locate(img);
    if (!src) throw new Error(`tileset ${id}: missing ${img}`);
    pageOf[img] = i;
    pages.push(webp(src, `tilesets/${id}${i ? '-' + i : ''}.webp`));
  });
  const tiles = {};
  for (const [idx, r] of Object.entries(t.tiles)) tiles[idx] = [pageOf[r.image] ?? 0, r.x, r.y, r.w, r.h, r.ox, r.oy];
  const animated = {};
  for (const [idx, a] of Object.entries(t.animations ?? {})) {
    // Flare tile animations reference other positions in the same image; store as frame rects.
    const base = t.tiles[idx];
    if (!base) continue;
    animated[idx] = {
      frames: a.frames.map((f) => [pageOf[base.image] ?? 0, f.x, f.y, base.w, base.h, base.ox, base.oy]),
      durations: a.frames.map((f) => f.duration || 100),
    };
  }
  const json = { id, pages, tiles, animated };
  const rel = `tilesets/${id}.json`;
  fs.mkdirSync(path.join(OUT, 'tilesets'), { recursive: true });
  fs.writeFileSync(path.join(OUT, rel), JSON.stringify(json));
  return rel;
}

function main() {
  const t0 = Date.now();
  const chars = catalog('characters.json');
  const fx = catalog('fx.json');
  const loot = catalog('loot.json');
  const icons = catalog('icons.json');

  const manifest = { version: 1, sheets: {}, tilesets: {}, icons: null, sfx: {}, music: {}, loot: {}, images: {} };
  const add = (id, animRel) => {
    try {
      manifest.sheets[id] = buildSheet(id, animRel);
    } catch (e) {
      console.warn(`skip ${id}: ${e.message}`);
    }
  };

  for (const [body, layers] of Object.entries(chars.avatar)) {
    for (const l of Array.isArray(layers) ? layers : Object.values(layers)) add(`avatar/${body}/${l.id}`, l.animFile);
  }
  for (const e of Object.values(chars.enemies)) if (!SKIP_ENEMIES.has(e.id)) add(`enemy/${e.id}`, e.animFile);
  for (const n of Object.values(chars.npcs)) add(`npc/${n.id}`, n.animFile);
  for (const f of fx.effects) add(`fx/${f.id}`, f.animFile);
  for (const it of loot.items) {
    add(`loot/${it.id}`, it.animFile);
    manifest.loot[it.id] = `loot/${it.id}`;
  }

  const TILESETS = {
    dungeon: 'tilesetdefs/tileset_dungeon.txt',
    cave: 'tilesetdefs/tileset_cave.txt',
    grassland: 'tilesetdefs/tileset_grassland.txt',
    ruins: 'tilesetdefs/tileset_ruins.txt',
    snowplains: 'tilesetdefs/tileset_snowplains.txt',
  };
  for (const [id, rel] of Object.entries(TILESETS)) manifest.tilesets[id] = buildTileset(id, rel);

  // Icon atlases: each source becomes one page; icon index -> [page, x, y].
  const size = icons.iconPx ?? 64;
  const ic = { pages: [], size, columns: 8, icons: {}, named: {} };
  icons.atlases.forEach((a, p) => {
    ic.pages.push(webp(path.join(FLARE, a.file), `icons/icons-${p}.webp`));
    for (let s = 0; s < a.slots; s++) ic.icons[a.firstIndex + s] = [p, (s % a.columns) * size, Math.floor(s / a.columns) * size];
  });
  const named = icons.proposedForDiablo?.itemBases ?? {};
  const flat = (prefix, v) => {
    if (typeof v === 'number') ic.named[prefix] = v;
    else if (Array.isArray(v)) v.forEach((n, i) => typeof n === 'number' && (ic.named[i ? `${prefix}.${i}` : prefix] = n));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) flat(`${prefix}.${k}`, x);
  };
  for (const [k, v] of Object.entries(named)) flat(k, v);
  manifest.icons = ic;

  return Promise.all(Array.from({ length: 6 }, async () => {
    while (jobs.length) await jobs.shift()();
  })).then(() => {
    fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
    const sizes = {};
    const walk = (d) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) walk(p);
        else {
          const k = path.relative(OUT, p).split(path.sep)[0];
          sizes[k] = (sizes[k] ?? 0) + fs.statSync(p).size;
        }
      }
    };
    walk(OUT);
    const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
    console.log(`sheets: ${Object.keys(manifest.sheets).length}, tilesets: ${Object.keys(manifest.tilesets).length}`);
    for (const [k, v] of Object.entries(sizes)) console.log(`  ${k}: ${mb(v)}`);
    console.log(`  total: ${mb(Object.values(sizes).reduce((a, b) => a + b, 0))} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  });
}

await main();
