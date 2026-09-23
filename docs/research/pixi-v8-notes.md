# PixiJS v8 — verified API notes for Diablopus

Versions checked: **pixi.js 8.21.0**, **pixi-filters 6.1.5** (from `node_modules`).

How these snippets were checked:
- All snippets below come from `.assets-src/scratch/pixi-check/check.ts`. That file compiles clean with `tsc --noEmit` (`strict`, `skipLibCheck: false`, `moduleResolution: bundler`, `lib: DOM`) using `.assets-src/scratch/pixi-check/tsconfig.json`.
- `@typescript-eslint/no-deprecated` also passes on `check.ts`, with 0 deprecated APIs used. Config: `eslint.traps.mjs`.
- Runtime behaviour was checked in Node with a stub DOMAdapter: `runtime-test.mjs` and `matrix-test.mjs`.
- To re-run: `npx tsc -p .assets-src/scratch/pixi-check/tsconfig.json`.

---

## 0. v7 traps (what agents get wrong) — verified against 8.21

These v7 forms come from `v7-traps.ts`. Each row shows what tsc or eslint reports and the correct v8 form.

| v7 code | Result in v8.21 | Correct v8 |
|---|---|---|
| `new Application({width:800})` | compiles, **@deprecated** | `const app = new Application(); await app.init({...})` |
| `app.view` | compiles, **@deprecated** | `app.canvas` |
| `g.beginFill(c).drawRect(..).endFill()` | compiles, **@deprecated** | `g.rect(..).fill(c)` |
| `s.blendMode = BLEND_MODES.ADD` | **TS2693** (BLEND_MODES is a type only) | `s.blendMode = 'add'` |
| `new ParticleContainer(1000, {position:true})` | **TS2554** | `new ParticleContainer({ dynamicProperties: {...} })` |
| `Assets.add('hero','hero.png')` | **TS2554** | `Assets.add({ alias:'hero', src:'hero.png' })` |
| `tex.baseTexture` | compiles, **@deprecated** | `tex.source` (TextureSource) |
| `new Filter(undefined, frag, uniforms)` | **TS2554** | `Filter.from({ gl:{vertex,fragment}, resources })` |
| `new Text('hp', {fontSize:12})` | compiles, **@deprecated** | `new Text({ text:'hp', style:{fontSize:12} })` |
| `new BlurFilter({ repeatEdgePixels:true })` | **TS2769** (not an option) | `blur.repeatEdgePixels = true` (property). This also sets `padding` to 0. |
| `source.scaleMode = SCALE_MODES.NEAREST` | compiles, **@deprecated** | `source.scaleMode = 'nearest'` |
| `renderer.render(c, {renderTexture: rt})` | compiles, **@deprecated** | `renderer.render({ container:c, target:rt, clear:true })` |
| `Texture.from('hero.png')` | compiles, but at **runtime it only reads the Assets cache** (it returns undefined and warns if the file is not loaded) | `await Assets.load('hero.png')` first |
| `new Texture(baseTex, frame)` | **TS2554** | `new Texture({ source, frame })` |
| `c.updateTransform()` | **TS2554** (in v8, `updateTransform(opts)` takes an options object `{x, y, scaleX, rotation, ...}` and sets those transform values) | `c.updateLocalTransform()` / `c.getGlobalTransform()` |
| `TextureGCSystem` / `textureGCActive` | **@deprecated since 8.15** | `GCSystem` options `gcActive`, `gcMaxUnusedTime`, `gcFrequency` |
| `Filter.from({gl:{fragment}})` without a vertex shader | TS error. At runtime it **throws** (`reading 'substring'`). | Pass `vertex: defaultFilterVert` (exported from `pixi.js`) |

---

## 1. Application (async init)

```ts
import { Application, extensions, CullerPlugin } from 'pixi.js';
extensions.add(CullerPlugin);               // Application plugin: must be registered BEFORE init

const app = new Application();
await app.init({
  preference: 'webgl',                      // 'webgl' | 'webgpu' | 'canvas' or an ordered array
  resizeTo: host,                           // Window | HTMLElement
  antialias: false,                         // MSAA only helps Graphics edges; sprites don't need it
  backgroundColor: 0x0b0a0f,                // alias: background
  backgroundAlpha: 1,
  resolution: Math.min(window.devicePixelRatio, 2),
  autoDensity: true,                        // CSS size = logical px; backing store = px * resolution
  powerPreference: 'high-performance',
  useBackBuffer: false,                     // true only for advanced blend modes on WebGL
  gcActive: true, gcMaxUnusedTime: 60_000, gcFrequency: 30_000,   // GCSystem (replaces TextureGCSystem)
  culler: { updateTransform: true },        // CullerPlugin option
});
host.appendChild(app.canvas);
```
For manual frame control, pass `autoStart: false` and call `app.render()` yourself.

## 2. Ticker
```ts
const onTick = (t: Ticker) => { t.deltaMS; t.deltaTime; t.elapsedMS; };  // ms / frame-scaled (1 = 60fps) / uncapped
app.ticker.add(onTick, undefined, UPDATE_PRIORITY.HIGH);
app.ticker.addOnce(() => {});
app.ticker.maxFPS = 0; app.ticker.minFPS = 10;   // minFPS clamps dt after a tab stall
app.ticker.remove(onTick); app.ticker.FPS; app.stop(); app.start();
```
Ticker callbacks receive the **Ticker** (v7 passed `delta`). Run gameplay on a fixed step using `t.deltaMS`.

## 3. Assets (bundles, progress)
```ts
const manifest: AssetsManifest = { bundles: [
  { name: 'boot', assets: [ { alias: 'ui-font', src: 'fonts/Cinzel.woff2', data: { family: 'Cinzel' } } ] },
  { name: 'act1', assets: [ { alias: 'tiles.grass', src: 'tiles/grassland.png', data: { scaleMode: 'nearest' } } ] },
]};
await Assets.init({ basePath: '/assets/', manifest });
await Assets.loadBundle('boot', (p) => bar(p));              // p in 0..1. loadBundle(ids, onProgress?) has NO LoadOptions
const act1 = await Assets.loadBundle('act1');
await Assets.load(['a.png'], { onProgress: bar, strategy: 'retry', retryCount: 3 }); // only load() takes LoadOptions
Assets.add({ alias: 'hero', src: 'hero.png' });
const hero = await Assets.load<Texture>('hero');
const many = await Assets.load<Texture>(['a.png', 'b.png']);   // Record<string, Texture>
void Assets.backgroundLoadBundle('act2');                      // idle prefetch
Assets.get<Texture>('hero');                                   // sync, cache only
await Assets.unloadBundle('act1');
```
`asset.data` is spread into the TextureSource options, so `scaleMode` and `resolution` work there. Verified in `loadTextures.mjs`.

## 4. Sub-frames from a big sheet (Flare atlases)
```ts
const frame = new Texture({
  source: sheet.source,                      // share the TextureSource: no copy, batches together
  frame: new Rectangle(x, y, w, h),
  defaultAnchor: { x: ox / w, y: oy / h },   // Flare render offset expressed as an anchor
  label: 'skeleton/run/3',
});
```
Runtime checks:
- An out-of-bounds frame is **not** validated, so it silently samples garbage. Clamp the rectangle yourself.
- `new Sprite(tex)` takes its anchor from `defaultAnchor`.
- Assigning `sprite.texture = other` later does **not** re-read `defaultAnchor`.
- `AnimatedSprite` with `updateAnchor: true` does re-read it on each frame.

## 5. Sprite / AnimatedSprite
```ts
const s = new Sprite({ texture, anchor: { x: 0.5, y: 1 }, x: 100, y: 200 });
const walk = new AnimatedSprite({ textures: frames, animationSpeed: 12 / 60, loop: true,
  autoPlay: true, autoUpdate: true, updateAnchor: true });
walk.onComplete = () => {}; walk.onFrameChange = (f) => {}; walk.onLoop = () => {};
const attack = new AnimatedSprite({ textures: frames.map((texture) => ({ texture, time: 83 })), // FrameObject[] (ms)
  loop: false, autoUpdate: false });
app.ticker.add((t) => attack.update(t));    // manual update (recommended: one ticker drives everything)
```
With 100+ enemies, prefer `autoUpdate: false` and one system loop. You can also skip AnimatedSprite entirely and set `sprite.texture = frames[i]` from your own animation state machine. Texture swaps within the same source do not break batching.

## 6. Container sorting (zIndex) and its cost
```ts
const actors = new Container({ isRenderGroup: true, sortableChildren: true });
e.zIndex = Math.round(e.y);   // setter: parent.sortableChildren = true, parent.sortDirty = true,
                              //         AND parentRenderGroup.structureDidChange = true
```
Cost, verified in `sortMixin.mjs` and `RenderGroupSystem.mjs`: any zIndex change, `culled` flip, `visible` flip or add/remove sets `structureDidChange`. That causes a **full instruction rebuild of the whole render group** (sort children + re-collect renderables + rebatch) on the next frame. Without it, the frame only updates transforms and uploads data.

Rules:
1. Isolate moving or sorted things in their own render group, separate from static floor chunks.
2. Only assign zIndex when the integer value actually changes (the setter early-outs on equal values).
3. Keep the sorted container flat: one level, sprites only.

`RenderLayer` (v8.7+) decouples draw order from the scene graph:
```ts
const layer = new RenderLayer({ sortableChildren: true, sortFunction: (a, b) => a.zIndex - b.zIndex });
app.stage.addChild(layer); world.addChild(hero); layer.attach(hero); layer.detach(hero);
```

## 7. Render groups
Create one with `new Container({ isRenderGroup: true })`, or toggle with `c.enableRenderGroup()` / `c.disableRenderGroup()`. A render group's transform is applied on the GPU, so moving the camera (the world group) costs almost nothing. Suggested groups: `floor`, `actors`, `fx`, `hud`.

## 8. Culling
```ts
chunk.cullable = true;
chunk.cullArea = new Rectangle(0, 0, 1024, 512);   // LOCAL space; skips the bounds walk (fast)
chunk.cullableChildren = false;                    // don't recurse
Culler.shared.cull(app.stage, app.renderer.screen); // manual; or CullerPlugin does it every render
```
- The Culler walks the tree recursively and compares against `renderer.screen` (global space).
- Culling a node skips its whole subtree.
- Because `culled` flips trigger a render-group rebuild, cull **chunks** (for example 16x16 tiles each), not individual tiles.
- A cheaper alternative is to run your own cull on a spatial grid and set `visible`.

## 9. Graphics (v8: build shape, then fill/stroke)
```ts
new Graphics()
  .rect(0, 0, 200, 20).fill({ color: 0x220000, alpha: 0.8 })
  .circle(100, 100, 40).stroke({ width: 3, color: 0xffd84a, alignment: 0.5 })
  .roundRect(10, 10, 80, 30, 6).fill('#1a1614')
  .moveTo(0, 0).lineTo(64, 32).stroke({ width: 1, color: 0xffffff })
  .poly([0, 16, 32, 0, 64, 16, 32, 32], true).fill({ color: 0x00ff00, alpha: 0.25 })
  .ellipse(50, 50, 30, 15).fill(0x000000);
const diamond = new GraphicsContext().poly([...]).stroke({ width: 1, color: 0xffffff });
const a = new Graphics(diamond), b = new Graphics(diamond);   // shared geometry
```
Calling `g.clear()` and rebuilding every frame re-tessellates the shape, which is expensive. For health bars, use scaled sprites of `Texture.WHITE` instead.

## 10. RenderTexture
```ts
const rt = RenderTexture.create({ width: 512, height: 512, resolution: 1, scaleMode: 'linear', antialias: false });
app.renderer.render({ container: scene, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
app.renderer.render({ container: scene, target: rt, clear: false, transform: new Matrix().translate(-100, -50) });
rt.resize(1024, 1024);
const tex = app.renderer.generateTexture({ target: scene, resolution: 1, antialias: false });
```
A container that you render only to an RT should **not** be on the stage. If `visible === false`, `render()` returns early.

## 11. Blend modes
- **Built in, no import** (WebGL map in `mapWebGLBlendModesToPixi.mjs`): `normal`, `add`, `multiply`, `screen`, `erase`, `none`, `min`, `max`, `normal-npm`, `add-npm`, `screen-npm`.
- **Needs `import 'pixi.js/advanced-blend-modes'`**, plus `useBackBuffer: true` on WebGL: `color`, `color-burn`, `color-dodge`, `darken`, `difference`, `divide`, `exclusion`, `hard-light`, `hard-mix`, `lighten`, `linear-burn`, `linear-dodge`, `linear-light`, `luminosity`, `negation`, `overlay`, `pin-light`, `saturation`, `soft-light`, `subtract`, `vivid-light`.
- Advanced modes break batches and copy the back buffer. Use only `add`, `multiply` and `screen` for gameplay FX.

## 12. ParticleContainer + Particle (v8)
```ts
const pc = new ParticleContainer({
  texture: atlas,                                  // every particle must use this same TextureSource
  boundsArea: new Rectangle(0, 0, 4096, 4096),     // no automatic bounds; required for culling/hit
  dynamicProperties: { position: true, rotation: true, color: true, vertex: true, uvs: false },
  blendMode: 'add',
});
const p = new Particle({ texture: spark, x, y, anchorX: 0.5, anchorY: 0.5, scaleX: 1, scaleY: 1,
  rotation: 0, tint: 0xff8a1c, alpha: 1 });
pc.addParticle(p); pc.removeParticle(p);
pc.particleChildren.length = 0; pc.update();      // bulk edit, then update()
```
- Defaults: `position: true`, and `vertex`, `rotation`, `uvs`, `color` all false.
  - A **dynamic** property is re-uploaded every frame.
  - A **static** property is uploaded only after `pc.update()`.
- `vertex` covers scale and anchor. `uvs` covers texture swaps (flipbook). `color` covers tint and alpha.
- `pc.addChild()` **throws** at runtime.
- A Particle is a plain object with no events, children or filters. Pool Particles; don't `new` them each frame.
- Use one ParticleContainer per blend mode (add / normal).

## 13. Text vs BitmapText
```ts
BitmapFont.install({ name: 'DmgFont', style: { fontFamily: 'Cinzel', fontSize: 32, fill: '#fff',
  stroke: { color: '#000', width: 4 }, fontWeight: 'bold' }, chars: [['0', '9'], '!.,+-%kKM '], resolution: 2, padding: 4 });
const dmg = new BitmapText({ text: '1234', style: { fontFamily: 'DmgFont', fontSize: 28 } });
dmg.tint = 0xffd84a;                               // per-instance color, still batched
const title = new Text({ text: 'Catedral Profanada', style: { fontFamily: 'Cinzel', fontSize: 36, fill: '#e8d9b0',
  dropShadow: { color: '#000', blur: 4, distance: 2, alpha: 0.8, angle: Math.PI / 4 } }, resolution: 2 });
```
- `Text` re-rasterizes a canvas and uploads a texture on every text change. Keep it for rare text: titles and names.
- `BitmapText` is quads from a glyph atlas, so it batches with sprites. Use it for damage numbers, timers and labels.
- The web font must be loaded (Assets or `document.fonts.load`) before `install`.
- Include accented glyphs in `chars` if BitmapText shows pt-BR words.

## 14. Tint
`s.tint = 0xff0000 | '#ff8a1c' | [1, .5, .5]`. In v8, **Containers tint too**, and the tint cascades to children, so `enemyRoot.tint` works for hit flashes. Tinting is multiplicative: it cannot brighten to white. For a white hit flash use a ColorMatrixFilter or a shader, which is costly, or an additive white copy of the sprite.

## 15. Filters
```ts
const cm = new ColorMatrixFilter(); cm.desaturate(); cm.brightness(0.6, true);
const blur = new BlurFilter({ strength: 6, quality: 3, kernelSize: 5 }); blur.repeatEdgePixels = true;
const alpha = new AlphaFilter({ alpha: 0.5 });
world.filters = [cm, blur, alpha]; world.filterArea = app.screen;  // filterArea skips bounds measuring

const vignette = Filter.from({
  gl: { vertex: defaultFilterVert, fragment: `
    in vec2 vTextureCoord; out vec4 finalColor;
    uniform sampler2D uTexture; uniform float uStrength; uniform vec3 uTint;
    void main(){ vec4 c = texture(uTexture, vTextureCoord);
      float v = smoothstep(0.35, 0.8, distance(vTextureCoord, vec2(0.5))) * uStrength;
      finalColor = vec4(mix(c.rgb, c.rgb * uTint, v), c.a); }` },
  resources: { vignetteUniforms: {
    uStrength: { value: 0.8, type: 'f32' },
    uTint: { value: new Float32Array([0.4, 0.05, 0.05]), type: 'vec3<f32>' } } },
});
vignette.resources.vignetteUniforms.uniforms.uStrength = 1.0;

const custom = new Filter({ glProgram: GlProgram.from({ vertex: VERT, fragment: FRAG, name: 'wobble' }),
  resources: { myUniforms: { uTime: { value: 0, type: 'f32' } } }, padding: 0, resolution: 1, antialias: 'off' });
```
- GLSL is ES 3.0 style: use `in`/`out` and `finalColor`, with `uTexture` and `vTextureCoord`. Do not declare `#version`, because Pixi adds it.
- A full vertex shader (`filterVertexPosition` using `uOutputFrame` / `uOutputTexture` / `uInputSize`) is in `check.ts`.
- Uniform types are WGSL-style strings: `'f32'`, `'vec2<f32>'`, `'vec3<f32>'`, `'mat3x3<f32>'`, `'i32'`.

## 16. pixi-filters v6 (all options-object constructors)
```ts
import { AdvancedBloomFilter, GlowFilter, OutlineFilter, ShockwaveFilter, GodrayFilter } from 'pixi-filters';
// or tree-shaken: import { GlowFilter } from 'pixi-filters/glow';
new AdvancedBloomFilter({ threshold: 0.6, bloomScale: 1.2, brightness: 1, blur: 6, quality: 4 });
new GlowFilter({ distance: 12, outerStrength: 2.5, innerStrength: 0, color: 0xff8a1c, alpha: 1, quality: 0.2, knockout: false });
new OutlineFilter({ thickness: 2, color: 0xffd84a, alpha: 1, quality: 0.15, knockout: false });
const shock = new ShockwaveFilter({ center: { x: 400, y: 300 }, speed: 600, amplitude: 25, wavelength: 140,
  brightness: 1.1, radius: 300, time: 0 });
const rays = new GodrayFilter({ angle: 25, gain: 0.45, lacunarity: 2.6, parallel: true, time: 0, alpha: 0.6 });
app.ticker.add((t) => { shock.time += t.deltaMS / 1000; rays.time += t.deltaMS / 1000; }); // time in seconds
```
- Runtime defaults: GlowFilter padding = `distance`, OutlineFilter padding = `thickness`, and ShockwaveFilter speed defaults to 500.
- `GlowFilter` bakes its sample-loop length into the shader when it is constructed (`__DIST__`). Setting `distance` later only changes the uniform and padding. Construct it with the maximum distance you will need, then animate `outerStrength`.
- **Filters are the most expensive thing in the scene.** Each filtered object costs an extra render target, one draw call per pass and a batch break.
- Use at most one full-screen filter chain on `world` (bloom and shockwave with `filterArea = app.screen`), plus filters on a few hero, boss or loot objects.

## 17. Destroy and GC
```ts
s.destroy();                                                        // keeps the texture
s.destroy({ children: true, texture: true, textureSource: true });  // frees the GPU source too
frameTex.destroy(false);            // frame-only texture: KEEP the shared sheet source
tex.source.unload();                // drop the GPU copy now; it re-uploads on next use
tex.source.autoGarbageCollect = true;
await Assets.unload('hero');        // right way for loaded assets (clears the cache as well)
```
`GCSystem` (8.15+) unloads GPU resources that have not been used for `gcMaxUnusedTime` ms (default 60 s), checking every `gcFrequency` ms (default 30 s). CPU data stays, so a resource reappears after re-upload with a hitch. Call `app.renderer.prepare.upload(container)` (needs `import 'pixi.js/prepare'`) before a boss fight to avoid that.

## 18. Mesh / MeshSimple
```ts
const quad = new MeshSimple({ texture, vertices: new Float32Array([0,0,100,0,100,100,0,100]),
  uvs: new Float32Array([0,0,1,0,1,1,0,1]), indices: new Uint32Array([0,1,2,0,2,3]) });
quad.vertices[0] = 5;               // autoUpdate (default true) uploads the vertex buffer every frame
const geometry = new MeshGeometry({ positions, uvs, indices });
const mesh = new Mesh({ geometry, texture });
const buf = geometry.getBuffer('aPosition'); buf.data[0] = 0.1; buf.update();
```
Use a mesh for light cones, trails and ground decals that bend. In v8, meshes with ≤100 vertices batch with sprites when `geometry.batchMode` is `'auto'`.

## 19. scaleMode
```ts
tex.source.scaleMode = 'nearest';                        // or tex.source.style.scaleMode
tex.source.style = new TextureStyle({ scaleMode: 'nearest', addressMode: 'clamp-to-edge' });
TextureSource.defaultOptions.scaleMode = 'nearest';      // global default; set before loading anything
```
`TextureStyle.defaultOptions` is `{ scaleMode: 'linear', addressMode: 'clamp-to-edge' }`. Flare art is painted, not pixel art, so use `linear` for sprites. Use `nearest` for UI pixel icons and for crisp fog.

## 20. Fog of war: 1 texel per tile, mapped into isometric space
```ts
const data = new Uint8Array(mapW * mapH * 4);                 // rgb 0, alpha = fog
for (let i = 3; i < data.length; i += 4) data[i] = 255;
const source = new BufferImageSource({ resource: data, width: mapW, height: mapH,
  format: 'rgba8unorm',          // Uint8Array defaults to 'bgra8unorm' (swaps R/B on WebGPU)
  scaleMode: 'linear',           // soft, interpolated edges between tiles
  addressMode: 'clamp-to-edge', alphaMode: 'premultiply-alpha-on-upload' });
const fog = new Sprite(new Texture({ source }));
// texel (u,v) -> iso: x = (u - v) * TW/2 + ox, y = (u + v) * TH/2 + oy
fog.setFromMatrix(new Matrix(TW / 2, TH / 2, -TW / 2, TH / 2, originX, originY));
world.addChild(fog);                                          // inside the camera container, above actors
data[(ty * mapW + tx) * 4 + 3] = 128;  source.update();       // at most once per frame (one full re-upload)
```
Verified in `matrix-test.mjs`:
- `setFromMatrix` decomposes the matrix into scale (35.78, 35.78), skew (-1.107, 0.464) and rotation 0.
- `localTransform` rebuilds exactly as (32, 16, -32, 16, 500, 20).
- Tile (3,5) maps to (436, 148), matching the formula `(3-5)*32+500`, `(3+5)*16+20`.
- Tile (u,v) covers texel `[u,u+1]`, so the diamond's top corner is at tile origin (u,v). Offset by 0.5 texel if your tile coordinates refer to tile centres.
- For soft, blurred edges without a filter, use a map at 2x (2 texels per tile) with `linear` sampling.
- Alternative source: a `CanvasSource` (draw on a 2D canvas, then call `cs.update()`).

## 21. Other useful items
- `c.cacheAsTexture({ resolution: 1 })`, `c.updateCacheTexture()`, `c.cacheAsTexture(false)`: v8 replacement for `cacheAsBitmap`. Good for static UI and for baking floor chunks.
- Events: `world.eventMode = 'passive'; world.interactiveChildren = false;` on the big world. Use `'static'` plus `hitArea` only where needed. Do your own picking in world space for enemies.
- Light map: build a dark RenderTexture, draw additive radial light sprites into it each frame at half resolution, then overlay it on the world with a sprite using `blendMode: 'multiply'` (full example in `check.ts` `extrasDemo`).

---

## Performance plan: 100+ animated enemies, 2000 particles and lighting at 60 FPS

1. **Atlases.** Put every enemy, player and loot sprite into a few 2048/4096 atlases so that textures come from ≤16 TextureSources per batch. On WebGL, batches break when more than about 16 sources are in use, or on a blend, filter or mask change.
2. **Render groups.**
   - `floor` is static. Build its chunks with `cacheAsTexture` or large baked RenderTextures, set `cullArea` on each chunk, and use chunk-level culling.
   - `actors` is flat, sorted by integer y, and sprites only.
   - Add `fxAdd` (ParticleContainer, add blend), `fxNormal`, `lights` and `hud`.
3. **Sorting.** The actors render group is rebuilt every frame anyway, and that is fine for about 300 sprites. Never sort the floor group. Update zIndex only when the rounded y changes.
4. **Animation.** One system loop sets `sprite.texture = frame` using `autoUpdate: false`. No per-sprite ticker callbacks.
5. **Particles.** Use 1–2 ParticleContainers from one FX atlas.
   - `dynamicProperties: { position, color, vertex: true, rotation: false, uvs: false }`.
   - Pool Particle objects in a free-list and prefer swap-remove over `removeParticle`.
   - About 2000 particles is cheap: one draw call per container.
6. **Lighting.**
   - Use a half-resolution light RenderTexture: clear it to the ambient color, draw about 50 additive radial sprites from an atlas, then apply it over the world with one multiply sprite.
   - That is one extra pass, which is far cheaper than per-light filters.
   - Apply bloom once on the final world only if frame budget allows, with `quality` ≤ 4 and `resolution` 0.5.
7. **Filters.** No per-enemy filters. For hover or elite outlines, use at most 1–3 objects at a time, or a pre-rendered outline texture. Hit flash can use tint on a Container or an additive white overlay sprite.
8. **Text.** Damage numbers use BitmapText from one installed font, pooled. No `Text` in gameplay.
9. **Graphics.** Do not rebuild every frame. Use `Texture.WHITE` sprites for bars and shared `GraphicsContext` for selection circles.
10. **Culling.** Cull enemies yourself with a spatial grid (set `visible = false` offscreen). Keep CullerPlugin for floor chunks only. Every `culled` or `visible` flip rebuilds that render group, so avoid toggling each frame. Add hysteresis (a margin) at the screen edge.
11. **Resolution.** Cap `resolution` at 2. Consider a DPR of 1 when FPS drops, as a dynamic quality setting.
12. **GC and hitches.** Keep `gcMaxUnusedTime` ≥ 60 s. Call `prepare.upload` for the act's bundle during loading, and use `Assets.backgroundLoadBundle` for the next zone.
13. **Measure.** Check `app.ticker.FPS` and browser DevTools. Draw calls can be inspected with Spector.js.
