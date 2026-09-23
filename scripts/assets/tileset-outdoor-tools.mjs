// Research helpers for Flare outdoor/cave tilesets (cave, grassland, snowplains).
// Parser + contact-sheet + iso renderer. Independent from parse-flare-tileset.mjs (dungeon).
//
// Usage (run from the repo root so `sharp` resolves):
//   node scripts/assets/tileset-outdoor-tools.mjs sheet <tilesetdef.txt> <out.png> [--img <basename>] [--from N --to M] [--cell 200]
//   node scripts/assets/tileset-outdoor-tools.mjs map <map.txt> <out.png> [--tileset <tilesetdef.txt>] [--x0 --y0 --w --h] [--scale 0.5]
//   node scripts/assets/tileset-outdoor-tools.mjs usage <tilesetdef-basename> <maps...>   (object/background usage histogram)
//
// Flare notes (verified in mods/fantasycore/engine/tileset_config.txt): tile_size=192,96 (HD, 3x of classic 64x32).
// A tile `tile=i,x,y,w,h,ox,oy` is drawn with its pixel (ox,oy) placed on the CENTER of the diamond of map cell (col,row):
//   centerX = (col - row) * 96,  centerY = (col + row) * 48 + 48   (plus camera offset)
// Map layers: background (floor), object (walls/props, depth-sorted), collision (0 none, 1 blocks all (wall),
// 2 blocks movement only (pits/water: projectiles pass), 3/4 hidden variants, 5/6 map-only, 7 entities, 8 enemies).

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

export const TILE_W = 192;
export const TILE_H = 96;

export const FLARE_ROOT = path.resolve('.assets-src/flare-game');
export const FC = path.join(FLARE_ROOT, 'mods/fantasycore');

/** Parse a Flare tilesetdef file. Returns { tiles: Map<index, tile>, anims: Map<index, frames>, images: string[] } */
export function parseTilesetDef(file) {
  const text = fs.readFileSync(file, 'utf8');
  const tiles = new Map();
  const anims = new Map();
  const images = [];
  let img = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('img=')) {
      img = line.slice(4);
      images.push(img);
    } else if (line.startsWith('tile=')) {
      const [i, x, y, w, h, ox, oy] = line.slice(5).split(',').map(Number);
      tiles.set(i, { index: i, img, x, y, w, h, ox, oy });
    } else if (line.startsWith('animation=')) {
      const parts = line.slice(10).split(';').filter(Boolean);
      const i = Number(parts[0]);
      const frames = parts.slice(1).map((p) => {
        const [x, y, ms] = p.split(',');
        return { x: Number(x), y: Number(y), ms: parseInt(ms, 10) };
      });
      anims.set(i, { img, frames });
    }
  }
  return { tiles, anims, images };
}

/** Parse a Flare map .txt: header + layers (2D arrays [row][col]). */
export function parseMap(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const header = {};
  const layers = {};
  const sections = [];
  let section = null;
  let cur = null;
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k].trim();
    if (line.startsWith('[')) {
      section = line.slice(1, -1);
      cur = { section, props: {} };
      sections.push(cur);
      continue;
    }
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq);
    const val = line.slice(eq + 1);
    if (section === 'header') header[key] = val;
    if (section === 'layer' && key === 'data') {
      const rows = [];
      const h = Number(header.height);
      for (let r = 0; r < h; r++) {
        const row = lines[k + 1 + r].trim().replace(/,$/, '').split(',').map(Number);
        rows.push(row);
      }
      k += h;
      layers[cur.props.type] = rows;
      continue;
    }
    if (cur) {
      if (cur.props[key] === undefined) cur.props[key] = val;
      else cur.props[key] = [].concat(cur.props[key], val);
    }
  }
  return { header, layers, sections, width: Number(header.width), height: Number(header.height) };
}

const imgCache = new Map();
export async function loadImage(imgRel) {
  let p = path.join(FC, imgRel);
  if (!fs.existsSync(p)) p = path.join(FLARE_ROOT, 'mods/empyrean_campaign', imgRel);
  if (!imgCache.has(p)) {
    const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    imgCache.set(p, { data, info, path: p });
  }
  return imgCache.get(p);
}

/** Extract a tile as PNG buffer (optionally animation frame 0 is the same rect). */
export async function extractTile(tile, frame = null) {
  const im = await loadImage(tile.img);
  const x = frame ? frame.x : tile.x;
  const y = frame ? frame.y : tile.y;
  const { width: IW, height: IH } = im.info;
  const w = Math.min(tile.w, IW - x);
  const h = Math.min(tile.h, IH - y);
  const out = Buffer.alloc(tile.w * tile.h * 4);
  for (let r = 0; r < h; r++) im.data.copy(out, r * tile.w * 4, ((y + r) * IW + x) * 4, ((y + r) * IW + x + w) * 4);
  return sharp(out, { raw: { width: tile.w, height: tile.h, channels: 4 } }).png().toBuffer();
}

function svgLabel(text, w, h, color = '#ffe060', size = 18) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#000" fill-opacity="0.7"/>` +
      `<text x="${w / 2}" y="${h - 5}" font-family="Arial" font-size="${size}" font-weight="bold" fill="${color}" text-anchor="middle">${text}</text></svg>`,
  );
}

/** Build a labelled contact sheet of tiles. Each tile scaled to fit `cell` px. */
export async function contactSheet(tiles, out, { cell = 200, cols = 8, label = (t) => String(t.index) } = {}) {
  const labelH = 24;
  const rows = Math.ceil(tiles.length / cols);
  const W = cols * cell;
  const H = rows * (cell + labelH);
  const comps = [];
  for (let n = 0; n < tiles.length; n++) {
    const t = tiles[n];
    const cx = (n % cols) * cell;
    const cy = Math.floor(n / cols) * (cell + labelH);
    const scale = Math.min(1, (cell - 8) / t.w, (cell - 8) / t.h);
    let buf = await extractTile(t);
    const w = Math.max(1, Math.round(t.w * scale));
    const h = Math.max(1, Math.round(t.h * scale));
    if (scale < 1) buf = await sharp(buf).resize(w, h).png().toBuffer();
    // cell background slightly lighter for bounds
    comps.push({
      input: { create: { width: cell - 2, height: cell - 2, channels: 4, background: { r: 40, g: 40, b: 48, alpha: 1 } } },
      left: cx + 1,
      top: cy + 1,
    });
    comps.push({ input: buf, left: cx + Math.floor((cell - w) / 2), top: cy + Math.floor((cell - h) / 2) });
    comps.push({ input: svgLabel(label(t), cell, labelH), left: cx, top: cy + cell });
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 16, g: 16, b: 20, alpha: 1 } } })
    .composite(comps)
    .png()
    .toFile(out);
  return out;
}

/**
 * Render an iso scene. `cells` = { background: [][], under?: [[][]...], object?: [][], over?: [[][]...] }
 * (rows x cols of tile ids, 0 = empty). A tile id may be a number (main tileset) or "key:index" resolved
 * through opts.extra[key] (another parsed tileset, e.g. the dungeon brazier). Objects are depth-sorted by
 * (col+row) then col, like Flare. opts.tileMod(id) may return sharp.modulate() params to recolor a tile.
 */
export async function renderIso(tileset, cells, out, { scale = 0.5, bg = { r: 8, g: 8, b: 10 }, tint = null, pad = 400, extra = {}, tileMod = null, trim = true } = {}) {
  const H = cells.background.length;
  const W = cells.background[0].length;
  const originX = H * 96 + pad; // so col=0,row=H-1 is inside
  const originY = pad;
  const canvasW = (W + H) * 96 + pad * 2;
  const canvasH = (W + H) * 48 + pad * 2;
  const comps = [];
  const cache = new Map();
  const tileBuf = async (id) => {
    if (!cache.has(id)) {
      let ts = tileset;
      let i = id;
      if (typeof id === 'string') {
        const [k, n] = id.split(':');
        ts = extra[k];
        i = Number(n);
      }
      const t = ts && ts.tiles.get(i);
      let buf = t ? await extractTile(t) : null;
      const mod = t && tileMod ? tileMod(id) : null;
      if (buf && mod) {
        let img = sharp(buf);
        if (mod.modulate) img = img.modulate(mod.modulate);
        if (mod.tint) img = img.tint(mod.tint);
        if (mod.linear) img = img.linear(mod.linear[0], mod.linear[1]);
        buf = await img.png().toBuffer();
      }
      cache.set(id, t ? { t, buf } : null);
    }
    return cache.get(id);
  };
  const place = async (i, c, r) => {
    const e = await tileBuf(i);
    if (!e) return;
    const cx = originX + (c - r) * 96;
    const cy = originY + (c + r) * 48 + 48;
    const left = cx - e.t.ox;
    const top = cy - e.t.oy;
    if (left < 0 || top < 0 || left + e.t.w > canvasW || top + e.t.h > canvasH) return;
    comps.push({ input: e.buf, left, top });
  };
  const flat = async (L) => {
    if (!L) return;
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (L[r][c]) await place(L[r][c], c, r);
  };
  await flat(cells.background);
  for (const L of cells.under || []) await flat(L);
  if (cells.object) {
    const list = [];
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (cells.object[r][c]) list.push([c, r, cells.object[r][c]]);
    list.sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[0] - b[0]);
    for (const [c, r, i] of list) await place(i, c, r);
  }
  for (const L of cells.over || []) await flat(L);
  let buf = await sharp({ create: { width: canvasW, height: canvasH, channels: 4, background: { ...bg, alpha: 1 } } })
    .composite(comps)
    .png()
    .toBuffer();
  if (tint) {
    let img = sharp(buf);
    if (tint.modulate) img = img.modulate(tint.modulate);
    if (tint.color) img = img.tint(tint.color);
    buf = await img.png().toBuffer();
  }
  let img = sharp(buf);
  if (trim) img = sharp(await img.trim({ threshold: 2 }).png().toBuffer());
  const meta = await img.metadata();
  await img.resize({ width: Math.round(meta.width * scale) }).png().toFile(out);
  return out;
}

/** Tile usage histogram across maps for a given layer. */
export function usage(mapFiles, layer) {
  const hist = new Map();
  for (const f of mapFiles) {
    const m = parseMap(f);
    const L = m.layers[layer];
    if (!L) continue;
    for (const row of L) for (const v of row) if (v) hist.set(v, (hist.get(v) || 0) + 1);
  }
  return hist;
}

// ---------------- CLI ----------------
async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const opt = (name, def) => {
    const k = args.indexOf('--' + name);
    return k >= 0 ? args[k + 1] : def;
  };
  if (cmd === 'sheet') {
    const ts = parseTilesetDef(args[0]);
    let tiles = [...ts.tiles.values()];
    const imgFilter = opt('img');
    if (imgFilter) tiles = tiles.filter((t) => t.img.includes(imgFilter));
    const from = Number(opt('from', 0));
    const to = Number(opt('to', 1e9));
    tiles = tiles.filter((t) => t.index >= from && t.index <= to);
    await contactSheet(tiles, args[1], { cell: Number(opt('cell', 200)), cols: Number(opt('cols', 8)) });
    console.log('wrote', args[1], tiles.length, 'tiles');
  } else if (cmd === 'map') {
    const m = parseMap(args[0]);
    const tsFile = opt('tileset', path.join(FC, m.header.tileset));
    const ts = parseTilesetDef(tsFile);
    const x0 = Number(opt('x0', 0));
    const y0 = Number(opt('y0', 0));
    const w = Number(opt('w', m.width));
    const h = Number(opt('h', m.height));
    const crop = (L) => L && L.slice(y0, y0 + h).map((row) => row.slice(x0, x0 + w));
    const names = Object.keys(m.layers).filter((k) => k !== 'collision');
    const oi = names.indexOf('object');
    const under = names.slice(1, oi < 0 ? names.length : oi).map((k) => crop(m.layers[k]));
    const over = oi < 0 ? [] : names.slice(oi + 1).map((k) => crop(m.layers[k]));
    await renderIso(ts, { background: crop(m.layers[names[0]]), under, object: crop(m.layers.object), over }, args[1], {
      scale: Number(opt('scale', 0.5)),
    });
    console.log('wrote', args[1]);
  } else if (cmd === 'usage') {
    const [layer, ...maps] = args;
    const h = usage(maps, layer);
    console.log([...h.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' '));
  } else if (cmd) {
    console.error('unknown command', cmd);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
