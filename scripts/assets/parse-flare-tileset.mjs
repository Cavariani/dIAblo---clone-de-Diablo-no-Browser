// Parser + debug helpers for Flare RPG tileset definitions (tilesetdefs/*.txt)
// and Flare map files (maps/*.txt).
//
// Tileset def format (Flare engine, INI-like):
//   [tileset]
//   img=images/tilesets/tileset_dungeon.png   (can appear several times; tiles use the last img=)
//   tile=<id>,<x>,<y>,<w>,<h>,<ox>,<oy>
//   animation=<id>;<x>,<y>,<duration>;<x>,<y>,<duration>;...
//
// (x,y,w,h) is the source rect in the atlas. (ox,oy) is the ANCHOR inside the
// sprite: the pixel of the sprite that must land on the CENTER of the ground
// diamond of the map cell. See docs/research/flare-tilesets-dungeon.md.
// Animation frames reuse the tile's w/h/ox/oy; only the atlas x,y change.
//
// Usage:
//   import { parseFlareTileset, parseFlareMap, renderContactSheet } from './parse-flare-tileset.mjs';

/**
 * @param {string} text contents of a Flare tilesetdefs/*.txt file
 * @returns {{ image: string|null, images: string[], tiles: Record<number,{x:number,y:number,w:number,h:number,ox:number,oy:number,image:string|null}>, animations?: Record<number,{frames:{x:number,y:number,duration:number}[]}> }}
 */
export function parseFlareTileset(text) {
  const tiles = {};
  const animations = {};
  const images = [];
  let currentImage = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('[')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (key === 'img') {
      currentImage = val;
      if (!images.includes(val)) images.push(val);
    } else if (key === 'tile') {
      const p = val.split(',').map((s) => Number(s.trim()));
      if (p.length < 7 || p.some((n) => Number.isNaN(n))) continue;
      const [id, x, y, w, h, ox, oy] = p;
      tiles[id] = { x, y, w, h, ox, oy, image: currentImage };
    } else if (key === 'animation') {
      const parts = val.split(';').map((s) => s.trim()).filter(Boolean);
      const id = Number(parts.shift());
      const frames = parts.map((f) => {
        const [x, y, d] = f.split(',').map((s) => s.trim());
        return { x: Number(x), y: Number(y), duration: parseDuration(d) };
      });
      animations[id] = { frames };
    }
  }
  const out = { image: images[0] ?? null, images, tiles };
  if (Object.keys(animations).length) out.animations = animations;
  return out;
}

/** "66ms" -> 66, "1s" -> 1000, "5" -> 5 (Flare treats bare numbers as frames@60fps; we keep raw) */
export function parseDuration(s) {
  if (s == null) return 0;
  const m = String(s).match(/^([\d.]+)\s*(ms|s)?$/);
  if (!m) return 0;
  const n = Number(m[1]);
  return m[2] === 's' ? n * 1000 : n;
}

/**
 * Parse a Flare map .txt: header, [layer] sections (type + data grid) and [event]/[enemy]/... blocks.
 * @param {string} text
 * @returns {{ header: Record<string,string>, layers: {type:string,width:number,height:number,data:number[][]}[], sections: {name:string, props:[string,string][]}[] }}
 */
export function parseFlareMap(text) {
  const lines = text.split(/\r?\n/);
  const header = {};
  const layers = [];
  const sections = [];
  let section = null;
  let cur = null; // current section object
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const sm = line.match(/^\[(.+)\]$/);
    if (sm) {
      section = sm[1];
      cur = { name: section, props: [] };
      if (section === 'layer') layers.push((cur.layer = { type: '', width: 0, height: 0, data: [] }));
      else if (section !== 'header') sections.push(cur);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (section === 'header') header[key] = val;
    else if (section === 'layer') {
      if (key === 'type') cur.layer.type = val;
      else if (key === 'data') {
        const w = Number(header.width);
        const h = Number(header.height);
        const rows = [];
        while (rows.length < h && i + 1 < lines.length) {
          const r = lines[i + 1].trim();
          if (!r || r.startsWith('[')) break;
          i++;
          rows.push(r.replace(/,$/, '').split(',').map((n) => Number(n)));
        }
        cur.layer.width = w;
        cur.layer.height = h;
        cur.layer.data = rows; // data[y][x]
      }
    } else if (cur) cur.props.push([key, val]);
  }
  return { header, layers, sections };
}

// ---------------------------------------------------------------------------
// Debug rendering helpers (need `sharp`, loaded lazily so the parser stays dependency-free)
// ---------------------------------------------------------------------------

async function loadSharp() {
  const mod = await import('sharp');
  return mod.default ?? mod;
}

/** Decode an atlas png once (raw RGBA) and return an async extractor id-rect -> png Buffer. */
async function atlasExtractor(sharp, atlasPath) {
  const { data, info } = await sharp(atlasPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const raw = { width: info.width, height: info.height, channels: info.channels };
  return (r) => sharp(data, { raw }).extract({ left: r.x, top: r.y, width: r.w, height: r.h }).png().toBuffer();
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Render a labelled contact sheet.
 * Every tile is drawn in its own cell with its anchor aligned to a common baseline,
 * a red 192x96 (tileW x tileH) ground diamond drawn at the anchor, and the tile id
 * plus "w x h" printed under it. Tiles are grouped in rows (`groups`: array of id arrays).
 *
 * @param {object} o
 * @param {string} o.atlasPath   absolute path of the tileset png
 * @param {ReturnType<typeof parseFlareTileset>} o.tileset
 * @param {number[][]} o.groups  rows of tile ids (missing ids are skipped)
 * @param {string} o.outPath     output png
 * @param {number} [o.tileW=192] ground tile width (Flare HD = 192)
 * @param {number} [o.tileH=96]  ground tile height (Flare HD = 96)
 * @param {number} [o.scale=0.5] output scale
 * @param {string} [o.title]
 * @param {Record<number,string>} [o.notes] extra text per id (e.g. semantic tag)
 */
export async function renderContactSheet(o) {
  const sharp = await loadSharp();
  const tileW = o.tileW ?? 192;
  const tileH = o.tileH ?? 96;
  const scale = o.scale ?? 0.5;
  const pad = 12;
  const labelH = o.notes ? 44 : 28;
  const titleH = o.title ? 40 : 0;
  const extract = await atlasExtractor(sharp, o.atlasPath);
  const rows = [];
  for (const group of o.groups) {
    const ids = group.filter((id) => o.tileset.tiles[id]);
    if (!ids.length) continue;
    // per row: common anchor line. above = max(oy), below = max(h-oy, tileH/2)
    let above = tileH / 2;
    let below = tileH / 2;
    const cells = ids.map((id) => {
      const t = o.tileset.tiles[id];
      const left = Math.max(t.ox, tileW / 2);
      const right = Math.max(t.w - t.ox, tileW / 2);
      above = Math.max(above, t.oy);
      below = Math.max(below, t.h - t.oy);
      return { id, t, left, right, cw: left + right + pad };
    });
    rows.push({ cells, above, below, h: above + below + labelH + pad, w: cells.reduce((s, c) => s + c.cw, 0) });
  }
  const W = Math.ceil(Math.max(400, ...rows.map((r) => r.w)) + pad);
  const H = Math.ceil(rows.reduce((s, r) => s + r.h, 0) + titleH + pad);
  const composites = [];
  const svgParts = [];
  let y = titleH + pad;
  for (const r of rows) {
    let x = pad;
    for (const c of r.cells) {
      const ax = x + c.left; // anchor x in sheet
      const ay = y + r.above; // anchor y in sheet
      const buf = await extract(c.t);
      composites.push({ input: buf, left: Math.round(ax - c.t.ox), top: Math.round(ay - c.t.oy) });
      const d = `M${ax},${ay - tileH / 2} L${ax + tileW / 2},${ay} L${ax},${ay + tileH / 2} L${ax - tileW / 2},${ay} Z`;
      svgParts.push(`<path d="${d}" fill="none" stroke="#ff3040" stroke-opacity="0.8" stroke-width="2"/>`);
      svgParts.push(`<circle cx="${ax}" cy="${ay}" r="4" fill="#ffe000"/>`);
      const ly = y + r.above + r.below + 22;
      svgParts.push(
        `<text x="${ax}" y="${ly}" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">${c.id}</text>`,
      );
      if (o.notes && o.notes[c.id]) {
        svgParts.push(
          `<text x="${ax}" y="${ly + 18}" font-family="Arial, sans-serif" font-size="15" fill="#9fd0ff" text-anchor="middle">${esc(o.notes[c.id])}</text>`,
        );
      }
      x += c.cw;
    }
    svgParts.push(`<line x1="0" y1="${y + r.h - 2}" x2="${W}" y2="${y + r.h - 2}" stroke="#333" stroke-width="2"/>`);
    y += r.h;
  }
  if (o.title) {
    svgParts.push(
      `<text x="${pad}" y="30" font-family="Arial, sans-serif" font-size="28" fill="#ffd060">${esc(o.title)}</text>`,
    );
  }
  // tiles first, then overlay (diamonds/labels) on top
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svgParts.join('')}</svg>`);
  const base = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 24, g: 24, b: 30, alpha: 1 } } })
    .composite([...composites, { input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer();
  let img = sharp(base);
  if (scale !== 1) img = img.resize(Math.round(W * scale), Math.round(H * scale));
  await img.png().toFile(o.outPath);
  return { width: Math.round(W * scale), height: Math.round(H * scale) };
}

/**
 * Isometric projection used by Flare (tile_size = tileW x tileH).
 * Returns the screen position of the CENTER of the ground diamond of cell (cx, cy),
 * relative to the screen position of the top vertex of cell (0,0).
 */
export function isoCellCenter(cx, cy, tileW = 192, tileH = 96) {
  return { x: (cx - cy) * (tileW / 2), y: (cx + cy) * (tileH / 2) + tileH / 2 };
}

/**
 * Flare draw order inside the object layer (MapRenderer::renderIsoFrontObjects / calculatePriosIso):
 * screen rows of constant (x+y) from back to front, and inside a row increasing x.
 * Entities use the same key with their fractional position: prio = (floor(x)+floor(y))<<37 | floor(x)<<20 | (fx+fy)<<8.
 * Returns a comparator-friendly numeric key for a tile/entity at map position (x, y) (floats allowed).
 */
export function isoDepthKey(x, y) {
  const tx = Math.floor(x), ty = Math.floor(y);
  return (tx + ty) * 1e6 + tx * 1e3 + (x - tx + (y - ty)) * 100;
}

/**
 * Render a list of layers (Flare semantics) into a png, for previews.
 * layers: [{ type:'background'|'object'|..., data:number[][] }] ; object layers are depth-sorted
 * by (x+y) then x, which reproduces Flare's iso draw order for tiles.
 */
export async function renderIsoMap({ atlasPath, tileset, layers, outPath, tileW = 192, tileH = 96, scale = 0.5, tint = null, background = { r: 0, g: 0, b: 0, alpha: 1 }, extra = [] }) {
  const sharp = await loadSharp();
  const extract = await atlasExtractor(sharp, atlasPath);
  const cache = new Map();
  const getTile = async (id) => {
    if (!cache.has(id)) {
      const t = tileset.tiles[id];
      cache.set(id, await extract(t));
    }
    return cache.get(id);
  };
  const draws = [];
  layers.forEach((layer, li) => {
    layer.data.forEach((row, cy) =>
      row.forEach((id, cx) => {
        if (!id || !tileset.tiles[id]) return;
        draws.push({ id, cx, cy, li });
      }),
    );
  });
  for (const e of extra) draws.push(e); // {id,cx,cy,li,dx?,dy?}
  // painter order: layer index first for non-object layers; object layer sorted by row (cx+cy), then cx
  draws.sort((a, b) => a.li - b.li || a.cx + a.cy - (b.cx + b.cy) || a.cx - b.cx);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const placed = draws.map((d) => {
    const t = tileset.tiles[d.id];
    const c = isoCellCenter(d.cx, d.cy, tileW, tileH);
    const left = c.x - t.ox + (d.dx ?? 0);
    const top = c.y - t.oy + (d.dy ?? 0);
    minX = Math.min(minX, left); minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + t.w); maxY = Math.max(maxY, top + t.h);
    return { ...d, left, top };
  });
  const m = 20;
  const W = Math.ceil(maxX - minX + 2 * m);
  const H = Math.ceil(maxY - minY + 2 * m);
  const composites = [];
  for (const p of placed) composites.push({ input: await getTile(p.id), left: Math.round(p.left - minX + m), top: Math.round(p.top - minY + m) });
  let img = sharp({ create: { width: W, height: H, channels: 4, background } }).composite(composites);
  let buf = await img.png().toBuffer();
  if (tint) buf = await sharp(buf).tint(tint).png().toBuffer();
  let out = sharp(buf);
  if (scale !== 1) out = out.resize(Math.round(W * scale), Math.round(H * scale));
  await out.png().toFile(outPath);
  return { width: Math.round(W * scale), height: Math.round(H * scale), originX: -minX + m, originY: -minY + m };
}
