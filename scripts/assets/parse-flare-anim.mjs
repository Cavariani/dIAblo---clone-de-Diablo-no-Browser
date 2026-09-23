#!/usr/bin/env node
// Parser for Flare RPG animation definition files (animations/**/*.txt).
//
// Mirrors flare-engine src/AnimationSet.cpp + Animation.cpp semantics:
//  - Header (before first [section]): image=path[,id] (repeatable, id selects the
//    sheet per frame), render_size=w,h, render_offset=x,y (unpacked only),
//    blend_mode=normal|add, alpha_mod=0..255, color_mod=r,g,b.
//  - Section [name]: frames=N, duration=800ms|1s, type=play_once|looped|back_forth,
//    active_frame=i[,j...]|all, active_sub_frame=end|start|all,
//    position=N (unpacked: column of first frame), image=id (unpacked only).
//  - Packed frames: frame=index,direction,x,y,w,h,offsetx,offsety[,imageId]
//    direction is 0..7 or N/NE/E/SE/S/SW/W/NW (N=3,NE=4,E=5,SE=6,S=7,SW=0,W=1,NW=2).
//  - Unpacked (no frame= lines in a section): rect.x = render_size.w*(position+i),
//    rect.y = render_size.h*direction, w/h = render_size, offset = render_offset.
//  - Like the engine, section scalars (position/frames/duration/type/image) carry
//    over to the next section when not re-specified; active_frame does not.
//  - INCLUDE <path> lines are spliced in place when opts.resolveInclude is given.
//
// Offsets (ox, oy) are the anchor inside the frame: draw the frame with its
// top-left at (screenX - ox, screenY - oy), where (screenX, screenY) is the
// entity's feet position projected to screen.
//
// Usage (CLI):
//   node scripts/assets/parse-flare-anim.mjs <file.txt> [--mod-root <dir>]   -> JSON dump
//   node scripts/assets/parse-flare-anim.mjs --catalog [--out <file.json>]    -> characters catalog

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIRECTIONS = 8;
export const ENGINE_FPS = 60; // flare default max_frames_per_sec

const DIR_NAMES = { SW: 0, W: 1, NW: 2, N: 3, NE: 4, E: 5, SE: 6, S: 7 };

export function parseDirection(s) {
  const t = String(s).trim();
  if (t in DIR_NAMES) return DIR_NAMES[t];
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 && n <= 7 ? n : 0;
}

/** Flare Parse::toDuration -> milliseconds ("800ms", "1s"; bare numbers are treated as ms like the engine). */
export function parseDurationMs(s) {
  const m = String(s).trim().match(/^(-?\d+(?:\.\d+)?)\s*(ms|s)?$/i);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  return (m[2] || 'ms').toLowerCase() === 's' ? v * 1000 : v;
}

/** Engine tick count for a duration (60 fps, rounded, min 1). */
export function durationTicks(ms, fps = ENGINE_FPS) {
  if (!ms) return 0;
  return Math.max(1, Math.floor((ms * fps) / 1000 + 0.5));
}

/** Default active frame used by the engine when none is given: (total_frame_count-1)/2, with total doubled for back_forth. */
export function defaultActiveFrame(frames, type) {
  const total = type === 'back_forth' ? frames * 2 : frames;
  return Math.floor((total - 1) / 2);
}

function splitLines(text, opts, depth = 0) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const inc = line.match(/^INCLUDE\s+(.+)$/);
    if (inc) {
      const p = inc[1].trim();
      out.push({ include: p });
      if (opts.resolveInclude && depth < 16) {
        const t = opts.resolveInclude(p);
        if (t != null) out.push(...splitLines(t, opts, depth + 1));
      }
      continue;
    }
    out.push({ line });
  }
  return out;
}

/**
 * @param {string} text  animation file contents
 * @param {{resolveInclude?: (p:string)=>string|null}} [opts]
 * @returns {{image:string|null, images:Record<string,string>, renderSize?:{w:number,h:number},
 *   renderOffset?:{x:number,y:number}, blendMode?:string, alphaMod?:number, colorMod?:number[],
 *   includes:string[], format:'packed'|'unpacked'|'mixed'|'none', directions:number,
 *   animations: Record<string,{frames:number,duration_ms:number,type:string,
 *     activeFrame?: number|number[]|'all', activeSubFrame?:string, position?:number, image?:string,
 *     rects: {x:number,y:number,w:number,h:number,ox:number,oy:number,image?:string}[][]}>}}
 */
export function parseFlareAnimation(text, opts = {}) {
  const result = {
    image: null,
    images: {},
    includes: [],
    format: 'none',
    directions: DIRECTIONS,
    animations: {},
  };
  // carried-over section state (engine behaviour)
  let section = null;
  let position = 0;
  let frames = 0;
  let durationMs = 0;
  let type = '';
  let imageId = '';
  let cur = null; // current animation being built
  let packedCount = 0;
  let unpackedCount = 0;

  const finishSection = () => {
    if (!cur) return;
    cur.frames = frames;
    cur.duration_ms = durationMs;
    cur.type = type;
    if (!cur._packed) {
      // unpacked layout
      cur.position = position;
      if (imageId) cur.image = imageId;
      const rs = result.renderSize || { w: 0, h: 0 };
      const ro = result.renderOffset || { x: 0, y: 0 };
      cur.rects = [];
      for (let i = 0; i < frames; i++) {
        const row = [];
        for (let d = 0; d < DIRECTIONS; d++) {
          const r = { x: rs.w * (position + i), y: rs.h * d, w: rs.w, h: rs.h, ox: ro.x, oy: ro.y };
          if (imageId) r.image = imageId;
          row.push(r);
        }
        cur.rects.push(row);
      }
      unpackedCount++;
    } else {
      // make sure the array is dense [frames][8]
      const rects = [];
      for (let i = 0; i < Math.max(frames, cur.rects.length); i++) {
        const row = cur.rects[i] || [];
        rects.push(Array.from({ length: DIRECTIONS }, (_, d) => row[d] || null));
      }
      cur.rects = rects;
      packedCount++;
    }
    delete cur._packed;
    result.animations[section] = cur;
    cur = null;
  };

  for (const item of splitLines(text, opts)) {
    if (item.include) {
      result.includes.push(item.include);
      continue;
    }
    const { line } = item;
    const sec = line.match(/^\[(.+)\]$/);
    if (sec) {
      finishSection();
      section = sec[1].trim();
      cur = { frames: 0, duration_ms: 0, type: '', rects: [], _packed: false };
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();

    if (section === null) {
      if (key === 'image') {
        const [p, id = ''] = val.split(',').map((s) => s.trim());
        result.images[id] = p;
        if (result.image === null) result.image = p;
      } else if (key === 'render_size') {
        const [w, h] = val.split(',').map((n) => parseInt(n, 10));
        result.renderSize = { w, h };
      } else if (key === 'render_offset') {
        const [x, y] = val.split(',').map((n) => parseInt(n, 10));
        result.renderOffset = { x, y };
      } else if (key === 'blend_mode') result.blendMode = val;
      else if (key === 'alpha_mod') result.alphaMod = parseInt(val, 10);
      else if (key === 'color_mod') result.colorMod = val.split(',').map((n) => parseInt(n, 10));
      continue;
    }

    switch (key) {
      case 'position': position = parseInt(val, 10) || 0; break;
      case 'frames': frames = parseInt(val, 10) || 0; break;
      case 'duration': durationMs = parseDurationMs(val); break;
      case 'type': type = val; break;
      case 'image': imageId = val; break;
      case 'active_frame': {
        if (val === 'all') cur.activeFrame = 'all';
        else {
          const list = [...new Set(val.split(',').map((n) => parseInt(n, 10)).filter(Number.isFinite))].sort((a, b) => a - b);
          cur.activeFrame = list.length === 1 ? list[0] : list;
        }
        break;
      }
      case 'active_sub_frame': cur.activeSubFrame = val; break;
      case 'frame': {
        cur._packed = true;
        const parts = val.split(',').map((s) => s.trim());
        const index = parseInt(parts[0], 10);
        const dir = parseDirection(parts[1]);
        const [x, y, w, h, ox, oy] = parts.slice(2, 8).map((n) => parseInt(n, 10));
        const r = { x, y, w, h, ox, oy };
        if (parts[8]) r.image = parts[8];
        (cur.rects[index] ||= [])[dir] = r;
        break;
      }
      default: break;
    }
  }
  finishSection();
  result.format = packedCount && unpackedCount ? 'mixed' : packedCount ? 'packed' : unpackedCount ? 'unpacked' : 'none';
  return result;
}

// ---------------------------------------------------------------------------
// Helpers used by the catalog / other scripts
// ---------------------------------------------------------------------------

/** Mod-stack resolver: later mods override earlier ones (flare mods/mods.txt order). */
export function makeModLocator(modDirs) {
  const order = [...modDirs].reverse();
  return (rel) => {
    for (const d of order) {
      const p = path.join(d, rel);
      if (fs.existsSync(p)) return p;
    }
    return null;
  };
}

export function loadFlareAnimation(relPath, locate) {
  const abs = locate(relPath);
  if (!abs) throw new Error(`not found in mod stack: ${relPath}`);
  const text = fs.readFileSync(abs, 'utf8');
  const parsed = parseFlareAnimation(text, {
    resolveInclude: (p) => {
      const a = locate(p);
      return a ? fs.readFileSync(a, 'utf8') : null;
    },
  });
  parsed.source = abs;
  return parsed;
}

/** Image path for a rect (handles multi-image sets keyed by id). */
export function rectImage(parsed, rect) {
  const id = rect && rect.image ? rect.image : '';
  return parsed.images[id] ?? parsed.image;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function summarizeAnimation(anim) {
  const all = anim.rects.flat().filter(Boolean);
  const sum = {
    frames: anim.frames,
    duration_ms: anim.duration_ms,
    frame_ms: anim.frames ? Math.round((anim.duration_ms / anim.frames) * 100) / 100 : 0,
    type: anim.type,
  };
  if (anim.activeFrame !== undefined) sum.activeFrame = anim.activeFrame;
  sum.activeFrameEffective = anim.activeFrame !== undefined ? anim.activeFrame : defaultActiveFrame(anim.frames, anim.type);
  if (anim.activeSubFrame) sum.activeSubFrame = anim.activeSubFrame;
  const imgs = [...new Set(all.map((r) => r.image || ''))].filter(Boolean);
  if (imgs.length) sum.imageIds = imgs;
  sum.maxW = Math.max(0, ...all.map((r) => r.w));
  sum.maxH = Math.max(0, ...all.map((r) => r.h));
  // bounds relative to the feet anchor (screen px): left/up negative
  sum.bounds = {
    left: Math.min(0, ...all.map((r) => -r.ox)),
    top: Math.min(0, ...all.map((r) => -r.oy)),
    right: Math.max(0, ...all.map((r) => r.w - r.ox)),
    bottom: Math.max(0, ...all.map((r) => r.h - r.oy)),
  };
  sum.missingRects = anim.frames * DIRECTIONS - all.length;
  return sum;
}

export function summarizeSet(parsed) {
  const anims = {};
  const allRects = [];
  for (const [name, a] of Object.entries(parsed.animations)) {
    anims[name] = summarizeAnimation(a);
    allRects.push(...a.rects.flat().filter(Boolean));
  }
  const stance = parsed.animations.stance ? parsed.animations.stance.rects.flat().filter(Boolean) : allRects;
  return {
    animations: anims,
    maxFrameW: Math.max(0, ...allRects.map((r) => r.w)),
    maxFrameH: Math.max(0, ...allRects.map((r) => r.h)),
    typicalOffset: { ox: median(stance.map((r) => r.ox)), oy: median(stance.map((r) => r.oy)) },
    offsetRange: {
      ox: [Math.min(...allRects.map((r) => r.ox)), Math.max(...allRects.map((r) => r.ox))],
      oy: [Math.min(...allRects.map((r) => r.oy)), Math.max(...allRects.map((r) => r.oy))],
    },
    bounds: {
      left: Math.min(0, ...allRects.map((r) => -r.ox)),
      top: Math.min(0, ...allRects.map((r) => -r.oy)),
      right: Math.max(0, ...allRects.map((r) => r.w - r.ox)),
      bottom: Math.max(0, ...allRects.map((r) => r.h - r.oy)),
    },
    frameCount: allRects.length,
  };
}

// ---------------------------------------------------------------------------
// Catalog builder
// ---------------------------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..', '..');
const FLARE = path.join(PROJECT, '.assets-src', 'flare-game');
const MODS = ['fantasycore', 'empyrean_campaign'].map((m) => path.join(FLARE, 'mods', m));

function listTxt(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort();
}

function relToFlare(abs) {
  return path.relative(FLARE, abs).split(path.sep).join('/');
}

/** Parse flare enemy definition files (INCLUDE-resolved, last key wins). */
function loadEnemyDefs(locate) {
  const defs = [];
  const readDef = (rel, depth = 0) => {
    const abs = locate(rel);
    if (!abs || depth > 8) return [];
    const lines = [];
    for (const raw of fs.readFileSync(abs, 'utf8').split(/\r?\n/)) {
      const l = raw.trim();
      if (!l || l.startsWith('#')) continue;
      const inc = l.match(/^INCLUDE\s+(.+)$/);
      if (inc) lines.push(...readDef(inc[1].trim(), depth + 1));
      else lines.push(l);
    }
    return lines;
  };
  for (const mod of MODS) {
    for (const sub of ['enemies', 'enemies/base']) {
      for (const f of listTxt(path.join(mod, sub))) {
        const rel = `${sub}/${f}`;
        const lines = readDef(rel);
        const d = { file: relToFlare(path.join(mod, rel)), powers: [], flags: {} };
        for (const l of lines) {
          const eq = l.indexOf('=');
          if (eq < 0) continue;
          const k = l.slice(0, eq);
          const v = l.slice(eq + 1);
          if (k === 'power') {
            const [state, id, chance] = v.split(',');
            d.powers.push({ state, id: Number(id), chance: Number(chance) });
          } else if (['name', 'level', 'animations', 'rarity', 'speed', 'categories', 'flying', 'humanoid', 'melee_range', 'threat_range', 'passive_powers', 'xp'].includes(k)) {
            d.flags[k] = v;
          } else if (k === 'stat' && v.startsWith('hp,')) d.flags.hp = v.slice(3);
        }
        if (d.flags.animations) defs.push(d);
      }
    }
  }
  return defs;
}

async function imageInfo(sharp, rel, locate, cache) {
  if (cache.has(rel)) return cache.get(rel);
  const abs = locate(rel);
  let info;
  if (!abs) info = { path: rel, missing: true };
  else {
    const meta = await sharp(abs).metadata();
    const bytes = fs.statSync(abs).size;
    info = {
      path: relToFlare(abs),
      width: meta.width,
      height: meta.height,
      channels: meta.channels,
      bytes,
      gpuBytesRGBA: meta.width * meta.height * 4,
      over4096: meta.width > 4096 || meta.height > 4096,
      over2048: meta.width > 2048 || meta.height > 2048,
    };
  }
  cache.set(rel, info);
  return info;
}

async function buildCatalog(outFile) {
  const { default: sharp } = await import('sharp');
  const locate = makeModLocator(MODS);
  const imgCache = new Map();
  const enemyDefs = loadEnemyDefs(locate);

  const entry = async (category, group, relAnim) => {
    const parsed = loadFlareAnimation(relAnim, locate);
    const sum = summarizeSet(parsed);
    const images = [];
    for (const [id, p] of Object.entries(parsed.images)) {
      images.push({ id: id || undefined, ...(await imageInfo(sharp, p, locate, imgCache)) });
    }
    const e = {
      id: path.basename(relAnim, '.txt'),
      category,
      group,
      animFile: relToFlare(parsed.source),
      includes: parsed.includes.length ? parsed.includes : undefined,
      format: parsed.format,
      colorMod: parsed.colorMod,
      alphaMod: parsed.alphaMod,
      blendMode: parsed.blendMode,
      image: parsed.image,
      images,
      imageBytesTotal: images.reduce((a, i) => a + (i.bytes || 0), 0),
      gpuBytesTotal: images.reduce((a, i) => a + (i.gpuBytesRGBA || 0), 0),
      ...sum,
    };
    if (category === 'enemy') {
      const used = enemyDefs.filter((d) => d.flags.animations === relAnim);
      e.usedByEnemyDefs = used.map((d) => ({
        file: d.file,
        name: d.flags.name,
        level: d.flags.level ? Number(d.flags.level) : undefined,
        rarity: d.flags.rarity,
        hp: d.flags.hp ? Number(d.flags.hp) : undefined,
        speed: d.flags.speed ? Number(d.flags.speed) : undefined,
        flying: d.flags.flying ? true : undefined,
        powers: d.powers.map((p) => `${p.state}:${p.id}@${p.chance}`),
      }));
    }
    return e;
  };

  const catalog = {
    generatedBy: 'scripts/assets/parse-flare-anim.mjs --catalog',
    flareRoot: '.assets-src/flare-game',
    modStack: ['fantasycore', 'empyrean_campaign'],
    conventions: {
      directions: '0=screen W (left), 1=NW (up-left), 2=N (up), 3=NE (up-right), 4=E (right), 5=SE (down-right), 6=S (down), 7=SW (down-left); clockwise on screen starting at screen-left. Flare map names: 0=SW,1=W,2=NW,3=N,4=NE,5=E,6=SE,7=S (map axes: +x = screen down-right, +y = screen down-left).',
      anchor: 'draw frame top-left at (feetScreenX - ox, feetScreenY - oy)',
      duration: 'duration_ms is the whole forward pass; frame_ms = duration_ms/frames; back_forth plays forward then reverse (cycle = 2*duration_ms)',
      activeFrameEffective: 'engine default when absent = floor((total-1)/2), total = frames (x2 for back_forth)',
      tileSize: [192, 96],
    },
    avatarTemplate: null,
    heroLayers: null,
    heroOptions: [],
    avatar: {},
    enemies: [],
    npcs: [],
    totals: {},
  };

  // avatar template (parent anim for all layers)
  const hero = loadFlareAnimation('animations/hero.txt', locate);
  catalog.avatarTemplate = { file: relToFlare(hero.source), animations: Object.fromEntries(Object.entries(hero.animations).map(([k, a]) => [k, { position: a.position, frames: a.frames, duration_ms: a.duration_ms, type: a.type }])) };

  // hero layers
  const layerTxt = fs.readFileSync(locate('engine/hero_layers.txt'), 'utf8');
  const layers = {};
  for (const l of layerTxt.split(/\r?\n/)) {
    const m = l.trim().match(/^layer=([^,]+),(.+)$/);
    if (!m) continue;
    const dir = parseDirection(m[1]);
    layers[dir] = { flareName: m[1], order: m[2].split(',').map((s) => s.trim()) };
  }
  catalog.heroLayers = layers;
  for (const l of fs.readFileSync(locate('engine/hero_options.txt'), 'utf8').split(/\r?\n/)) {
    const m = l.trim().match(/^option=(\d+),([^,]+),([^,]+),([^,]+),(.+)$/);
    if (m) catalog.heroOptions.push({ index: Number(m[1]), base: m[2], head: m[3], portrait: m[4], name: m[5] });
  }

  for (const body of ['male', 'female', 'female_dark']) {
    catalog.avatar[body] = [];
    for (const f of listTxt(path.join(MODS[0], 'animations', 'avatar', body))) {
      catalog.avatar[body].push(await entry('avatar', body, `animations/avatar/${body}/${f}`));
    }
  }
  const seen = new Set();
  for (const mod of [...MODS].reverse()) {
    for (const f of listTxt(path.join(mod, 'animations', 'enemies'))) {
      if (seen.has(f)) continue;
      seen.add(f);
      const e = await entry('enemy', path.basename(mod), `animations/enemies/${f}`);
      catalog.enemies.push(e);
    }
  }
  catalog.enemies.sort((a, b) => a.id.localeCompare(b.id));
  const seenN = new Set();
  for (const mod of [...MODS].reverse()) {
    for (const f of listTxt(path.join(mod, 'animations', 'npcs'))) {
      if (seenN.has(f)) continue;
      seenN.add(f);
      catalog.npcs.push(await entry('npc', path.basename(mod), `animations/npcs/${f}`));
    }
  }
  catalog.npcs.sort((a, b) => a.id.localeCompare(b.id));

  // unique image totals
  const uniq = [...imgCache.values()].filter((i) => !i.missing);
  const byCat = (pred) => {
    const list = uniq.filter(pred);
    return {
      images: list.length,
      pngBytes: list.reduce((a, i) => a + i.bytes, 0),
      gpuBytesRGBA: list.reduce((a, i) => a + i.gpuBytesRGBA, 0),
      over4096: list.filter((i) => i.over4096).map((i) => `${i.path} (${i.width}x${i.height})`),
      over2048: list.filter((i) => i.over2048).length,
    };
  };
  catalog.totals = {
    all: byCat(() => true),
    avatar: byCat((i) => i.path.includes('/images/avatar/')),
    enemies: byCat((i) => i.path.includes('/images/enemies/')),
    npcs: byCat((i) => i.path.includes('/images/npcs/')),
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(catalog, null, 1));
  return catalog;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args[0] === '--catalog') {
    const oi = args.indexOf('--out');
    const out = oi >= 0 ? path.resolve(args[oi + 1]) : path.join(HERE, 'catalog', 'characters.json');
    buildCatalog(out).then((c) => {
      const n = Object.values(c.avatar).reduce((a, l) => a + l.length, 0);
      console.log(`wrote ${out}: ${n} avatar layers, ${c.enemies.length} enemies, ${c.npcs.length} npcs`);
      console.log(JSON.stringify(c.totals, null, 1));
    }).catch((e) => { console.error(e); process.exit(1); });
  } else if (args[0]) {
    const mi = args.indexOf('--mod-root');
    const file = path.resolve(args[0]);
    let locate;
    if (mi >= 0) locate = makeModLocator([path.resolve(args[mi + 1])]);
    else locate = makeModLocator(MODS);
    const parsed = parseFlareAnimation(fs.readFileSync(file, 'utf8'), {
      resolveInclude: (p) => { const a = locate(p); return a ? fs.readFileSync(a, 'utf8') : null; },
    });
    const summary = args.includes('--summary');
    console.log(JSON.stringify(summary ? { image: parsed.image, images: parsed.images, format: parsed.format, ...summarizeSet(parsed) } : parsed, null, 1));
  } else {
    console.log('usage: parse-flare-anim.mjs <anim.txt> [--summary] [--mod-root dir] | --catalog [--out file.json]');
  }
}
