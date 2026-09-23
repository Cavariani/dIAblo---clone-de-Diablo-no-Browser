# Diablopus — UI art direction and design system

Scope: every HUD and menu is **HTML/CSS/SVG layered over the Pixi canvas**. In-world feedback (damage numbers, item beams on the ground, hit flashes) is done in Pixi. Everything here is **original**: no Blizzard art, logos, fonts or traced shapes. We borrow only *structural* ideas that are common to the ARPG genre.

Visual keywords: *gothic, forged iron, cold stone, dried blood, gold filigree, embers*. The style is modern: crisp vector ornaments, restrained texture, smooth motion. It is not skeuomorphic clutter.

---

## 1. What we take from Diablo 3/4 (patterns, not art)

| Element | D3 pattern | D4 pattern | Diablopus decision |
|---|---|---|---|
| Resource globes | Huge sculpted globes flanking the bar; red life, class-colored resource | Smaller, darker globes; muted liquid; subtle surface highlight | Mid-size orbs (112 px), animated liquid with a wave, glass highlight, ember rim. Life is red; the resource color depends on the class. |
| Action bar | 4 skills + LMB/RMB, potion, XP bar under the bar | 6 slots, compact, flat metal | 6 slots (LMB, RMB, 1–4) + potion. Thin XP bar with gold fill above the slots. |
| Inventory / paperdoll | Silhouette with slots around it; grid below | Paperdoll left, grid right, stats tab | Paperdoll with 12 slots around a silhouette, a 10x6 grid, and a gold/shards footer |
| Tooltip | Rarity-colored header plate, big main stat, bullet affixes, orange legendary text, comparison | Header gradient in the rarity color, item power, aspects in orange, compact | Rarity header with a gradient and glow, type line, big main-stat number, affix bullets, legendary power in italic orange, green/red compare deltas, sell value footer |
| Vendor / blacksmith | Tabbed panel next to the inventory | Wide panel with side tabs, material costs | Left panel with vertical tabs (Comprar, Vender, Recompra / Reparar, Aprimorar, Recuperar). The inventory stays open on the right. |
| Skill tree | Rune list (D3), node tree with clusters (D4) | Branching tree with hub nodes | Vertical "root" tree: gold connecting lines, circular active nodes, diamond passive nodes, and ember light running along unlocked paths |
| Loot | Beam and sound per rarity, name labels | Similar, color-coded labels | Pixi beam + label plate in the rarity color. Screen flash and toast for legendary. |

---

## 2. Color tokens

WCAG contrast was measured against the tooltip background `#0d0b0a` and the panel background `#221b16`:

```css
:root {
  /* Stone & metal (backgrounds, frames) */
  --c-void:        #070606;   /* page / modal backdrop base */
  --c-bg-0:        #0d0b0a;   /* tooltip, deepest panel */
  --c-bg-1:        #16120f;   /* panel body */
  --c-bg-2:        #221b16;   /* raised surface, slot bg */
  --c-stone-1:     #2e2722;
  --c-stone-2:     #3d342d;
  --c-stone-3:     #574b41;   /* stone highlight */
  --c-iron-1:      #2a2b2e;   /* cold iron frame */
  --c-iron-2:      #4a4c52;
  --c-iron-3:      #8b8e96;   /* iron specular edge */

  /* Metals & accents */
  --c-gold-0:      #6b4a1a;   /* gold shadow */
  --c-gold-1:      #a67c2e;
  --c-gold-2:      #d4a64a;   /* default gold edge, 8.75:1 */
  --c-gold-3:      #f3d58a;   /* gold highlight */
  --c-blood-0:     #3a0508;
  --c-blood-1:     #7a0a10;
  --c-blood-2:     #b3121b;   /* fills/borders ONLY (2.8:1, never small text) */
  --c-blood-3:     #e0343c;   /* large text only (4.4:1) */
  --c-danger-txt:  #ff5c52;   /* small red text: "Requisito não atendido" 6.5:1 */
  --c-ember-1:     #c2410c;
  --c-ember-2:     #ff6a1a;   /* ember orange 6.9:1 */
  --c-ember-3:     #ffb36b;   /* ember glow core */
  --c-mana:        #2f6bff;   /* resource orb (arcane) */
  --c-fury:        #d9531e;   /* resource orb (fury) */
  --c-spirit:      #d8c35a;   /* resource orb (faith) */

  /* Text */
  --c-text:        #e6dcc6;   /* parchment white 14.4:1 */
  --c-text-muted:  #a89f8e;   /* 7.5:1 */
  --c-text-dim:    #8c8374;   /* 5.3:1 — minimum for small text */
  --c-positive:    #5fe07a;   /* compare delta up */
  --c-negative:    #ff5c52;   /* compare delta down */

  /* Rarity (text on #0d0b0a: all >= 5.3:1) */
  --r-junk:        #8a8580;   /* Sucata       5.4:1 */
  --r-common:      #c8c4bc;   /* Comum        11.3:1 */
  --r-magic:       #6c8cff;   /* Mágico       6.4:1 */
  --r-rare:        #ffd84a;   /* Raro         14.2:1 */
  --r-legendary:   #ff8a1c;   /* Lendário     8.3:1 */
  --r-set:         #3fdc5a;   /* Conjunto     10.8:1 */
  --r-unique:      #c7a26b;   /* Único/mítico 8.2:1 (optional tier) */

  /* Motion */
  --ease-out:      cubic-bezier(.16, 1, .3, 1);      /* expo-out: panels, tooltips */
  --ease-in-out:   cubic-bezier(.65, 0, .35, 1);
  --ease-back:     cubic-bezier(.34, 1.56, .64, 1);  /* slight overshoot: toasts, level-up */
  --t-fast: 120ms; --t-med: 220ms; --t-slow: 420ms;

  /* Geometry */
  --radius-0: 2px; --radius-1: 4px;
  --slot: 56px; --slot-sm: 44px;
  --shadow-deep: 0 12px 40px rgba(0,0,0,.75), 0 2px 6px rgba(0,0,0,.9);
}
```

Rarity also has to be encoded **without color**, for color-blind players:

| Rarity | Header treatment | Slot corner pip |
|---|---|---|
| Common | plain header | none |
| Magic | 1 diamond ◆ | 1 pip |
| Rare | 2 diamonds | 2 pips |
| Legendary | flame glyph, animated border | 3 pips |
| Set | chain-link glyph | 3 pips |

The rarity name is always written in the type line ("Espada Rara").

Rarity glow values (reused by CSS and Pixi):

| Rarity | Hex | Glow rgba | Pixi tint |
|---|---|---|---|
| Common | `#c8c4bc` | none | 0xc8c4bc |
| Magic | `#6c8cff` | `rgba(108,140,255,.45)` | 0x6c8cff |
| Rare | `#ffd84a` | `rgba(255,216,74,.45)` | 0xffd84a |
| Legendary | `#ff8a1c` | `rgba(255,138,28,.6)` | 0xff8a1c |
| Set | `#3fdc5a` | `rgba(63,220,90,.5)` | 0x3fdc5a |

---

## 3. Typography (Google Fonts, pt-BR verified)

All fonts were downloaded from `fonts.googleapis.com/css2` and their `cmap` tables were checked. Every one of them contains `ÁÀÂÃÉÊÍÓÔÕÚÜÇ áàâãéêíóôõúüç ºª – — … « » “ ” ‘ ’ • × ± −`, with nothing missing. The check script is `.assets-src/scratch/ui-research/fonts/cmap.cjs`.

| Role | Font | Weights | Notes |
|---|---|---|---|
| Logo, big banners ("NÍVEL 12", "LENDÁRIO") | **Cinzel Decorative** | 400/700/900 | Caps-only look, 350 glyphs. Use it only for words of 1–3 tokens. |
| Panel titles, item names, buttons | **Cinzel** | 400–900 (variable) | Lowercase renders as small caps. Use `letter-spacing: .06em`. |
| Body, tooltips, affixes, dialog | **Alegreya Sans** (UI) / **Spectral** (lore/dialog) | 400/500/700 · 300/400/600 | Alegreya Sans is very legible at 13–14 px. Spectral is book-like for quest text. |
| Numbers in tooltips | Alegreya Sans with `font-variant-numeric: tabular-nums lining-nums` | 700 | Keeps stat columns aligned |
| Alt. headers | **Alegreya SC**, **Marcellus SC** | 400–700 | Softer small caps for tabs and labels |
| Flavor text | **EB Garamond** italic | 400i | Legendary flavor quote |
| Rejected | Pirata One | — | Blackletter hurts pt-BR readability with accents at small sizes |

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@500;700&family=Alegreya+Sans:wght@400;500;700&family=Spectral:ital,wght@0,400;1,400&family=EB+Garamond:ital@1&display=swap" rel="stylesheet">
```
For shipping, self-host woff2 files with the `latin` + `latin-ext` subsets under `public/fonts/` so the game works offline, with `font-display: swap`. Pixi BitmapText damage fonts are generated after `document.fonts.load('700 32px Cinzel')`.

```css
:root {
  --f-display: 'Cinzel Decorative', 'Cinzel', serif;
  --f-title:   'Cinzel', 'Times New Roman', serif;
  --f-ui:      'Alegreya Sans', system-ui, sans-serif;
  --f-lore:    'Spectral', Georgia, serif;
  --f-flavor:  'EB Garamond', Georgia, serif;
  --fs-xs: 12px; --fs-sm: 13px; --fs-md: 15px; --fs-lg: 18px; --fs-xl: 24px; --fs-xxl: 40px;
}
```
Minimum size is 12 px, and only for muted meta text. Body text in tooltips is 14 px, and the UI is sized in `rem` so the UI-scale option can change `html { font-size }`.

---

## 4. Materials and ornament techniques

1. **Stone texture without images.** Use an inline SVG `feTurbulence` noise as a data URI and layer it over gradients with `background-blend-mode: overlay`, at about 6–10 % strength.
2. **Forged frame.** Build the frame from layers:
   - `border` of 1 px dark iron;
   - an inset `box-shadow` stack for bevel, gold hairline and inner shadow;
   - an outer shadow for depth.
   This needs no raster assets and scales perfectly.
3. **Filigree corners.** A `::before` and `::after` pair, each holding a small inline-SVG corner ornament, is mirrored with `transform: scale(-1, 1)`. To get all 4 corners from 2 pseudo-elements, place 2 SVG backgrounds in each pseudo-element (top and bottom).
4. **`border-image` with an SVG 9-slice** for ornate panels. A 48x48 SVG has 16 px corners, and `border-image-slice: 16 fill` stretches the edges.
5. **Gold text.** Use `background: linear-gradient(...)` with `-webkit-background-clip: text` and a thin `text-shadow` for embossing. Only for titles.
6. **Ember light.** Use a radial gradient from `--c-ember-3` to transparent with `mix-blend-mode: screen`, animated with slow `opacity`/`translate` flicker.
7. **Glass (orbs).** Use a radial highlight at the top left, a dark inner rim (`inset 0 0 20px #000`) and a small specular ellipse.

Shared noise token:
```css
:root {
  --noise: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .5 0 0 0 0 .45 0 0 0 0 .4 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  --corner: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M1 31V9L9 1h22' fill='none' stroke='%23d4a64a' stroke-width='1.5'/%3E%3Cpath d='M5 27V11l6-6h16' fill='none' stroke='%236b4a1a' stroke-width='1'/%3E%3Cpath d='M1 9l5 0M9 1v5' stroke='%23f3d58a' stroke-width='1'/%3E%3Ccircle cx='6' cy='6' r='2.2' fill='%23d4a64a'/%3E%3Cpath d='M6 2.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L2.5 6 5 5z' fill='%23f3d58a'/%3E%3C/svg%3E");
  --corner-r: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cg transform='matrix(-1 0 0 1 32 0)'%3E%3Cpath d='M1 31V9L9 1h22' fill='none' stroke='%23d4a64a' stroke-width='1.5'/%3E%3Cpath d='M5 27V11l6-6h16' fill='none' stroke='%236b4a1a' stroke-width='1'/%3E%3Cpath d='M1 9l5 0M9 1v5' stroke='%23f3d58a' stroke-width='1'/%3E%3Ccircle cx='6' cy='6' r='2.2' fill='%23d4a64a'/%3E%3Cpath d='M6 2.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L2.5 6 5 5z' fill='%23f3d58a'/%3E%3C/g%3E%3C/svg%3E");   /* same ornament, mirrored for right-hand corners */
}
```

---

## 5. Copy-paste components

These snippets were render-checked in headless Chrome: `.assets-src/scratch/ui-research/demo/build.cjs` pulls every css/html block out of this file into `demo.html`, and `shot.png` is the result. The panel corners, rarity slots, tooltip, orb waves and cooldown wedge direction all render as intended.

### 5.1 Panel frame
```css
.panel {
  position: relative;
  padding: 28px 24px 22px;
  color: var(--c-text);
  font: 400 var(--fs-md)/1.45 var(--f-ui);
  background:
    var(--noise),
    radial-gradient(120% 80% at 50% 0%, rgba(255,138,28,.06), transparent 60%),
    linear-gradient(180deg, var(--c-bg-2) 0%, var(--c-bg-1) 35%, var(--c-bg-0) 100%);
  background-blend-mode: overlay, screen, normal;
  border: 1px solid #000;
  border-radius: var(--radius-1);
  box-shadow:
    inset 0 0 0 1px var(--c-gold-0),          /* dark gold hairline */
    inset 0 0 0 2px rgba(212,166,74,.35),     /* gold edge */
    inset 0 0 0 5px var(--c-iron-1),          /* iron band */
    inset 0 0 0 6px rgba(0,0,0,.9),
    inset 0 1px 0 6px rgba(255,255,255,.04),  /* top bevel */
    inset 0 -40px 60px -30px rgba(0,0,0,.8),  /* bottom vignette */
    var(--shadow-deep);
  isolation: isolate;
}
.panel::before, .panel::after {               /* 4 filigree corners from 2 pseudos */
  content: ""; position: absolute; inset: -3px; pointer-events: none;
  background: var(--corner)   top left  / 32px 32px no-repeat,   /* TL */
              var(--corner-r) top right / 32px 32px no-repeat;   /* TR (pre-mirrored SVG) */
}
.panel::after { transform: scaleY(-1); }      /* flip the whole top row -> BL + BR */
.panel > .panel__title {
  margin: -12px 0 16px; text-align: center;
  font: 700 var(--fs-lg)/1 var(--f-title); letter-spacing: .08em; text-transform: uppercase;
  background: linear-gradient(180deg, var(--c-gold-3), var(--c-gold-2) 45%, var(--c-gold-1));
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 1px 0 #000) drop-shadow(0 0 6px rgba(255,138,28,.25));
}
.panel > .panel__title::after {               /* ornamental rule under the title */
  content: ""; display: block; height: 9px; margin: 10px auto 0; width: 70%;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 9'%3E%3Cpath d='M0 4.5h88M112 4.5h88' stroke='%23a67c2e'/%3E%3Cpath d='M100 0l5 4.5-5 4.5-5-4.5z' fill='%23d4a64a'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
}
```
`::after` flips the top row vertically to produce the bottom corners. If you need per-corner animation, use 4 absolutely positioned `<svg class="corner">` spans instead, with `.corner--tr { transform: scaleX(-1) } .corner--bl { transform: scaleY(-1) } .corner--br { transform: scale(-1) }`.

### 5.2 Button: stone with a gold edge and a hover glow
```css
.btn {
  --glow: rgba(255,138,28,0);
  position: relative; display: inline-flex; align-items: center; justify-content: center; gap: .5em;
  min-width: 160px; height: 44px; padding: 0 22px;
  font: 700 14px/1 var(--f-title); letter-spacing: .1em; text-transform: uppercase;
  color: var(--c-gold-3); text-shadow: 0 1px 0 #000, 0 0 8px rgba(0,0,0,.8);
  background: var(--noise), linear-gradient(180deg, var(--c-stone-3) 0%, var(--c-stone-2) 8%, var(--c-stone-1) 55%, #1b1612 100%);
  background-blend-mode: overlay, normal;
  border: 1px solid #000; border-radius: var(--radius-0);
  clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0 50%); /* beveled ends */
  box-shadow: inset 0 0 0 1px var(--c-gold-1), inset 0 1px 0 1px rgba(243,213,138,.35),
              inset 0 -8px 14px rgba(0,0,0,.55), 0 0 18px var(--glow);
  cursor: pointer; user-select: none;
  transition: filter var(--t-fast) var(--ease-out), box-shadow var(--t-med) var(--ease-out), transform var(--t-fast);
}
.btn::before {                                           /* sweep highlight */
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(100deg, transparent 30%, rgba(255,220,150,.22) 50%, transparent 70%);
  transform: translateX(-120%); transition: transform 600ms var(--ease-out);
}
.btn:hover  { --glow: rgba(255,138,28,.45); filter: brightness(1.12); color: #fff3d0; }
.btn:hover::before { transform: translateX(120%); }
.btn:active { transform: translateY(1px); filter: brightness(.92); }
.btn:focus-visible { outline: 2px solid var(--c-gold-3); outline-offset: 3px; }
.btn[disabled] { filter: grayscale(.9) brightness(.6); cursor: not-allowed; }
.btn--danger { color: #ffd6d2; box-shadow: inset 0 0 0 1px var(--c-blood-2), inset 0 -8px 14px rgba(0,0,0,.55), 0 0 18px var(--glow); }
```
Because `clip-path` clips the outer glow, a glowing button should use `filter: drop-shadow(...)` on a wrapper. The simplest pattern is `<span class="btn-wrap"><button class="btn">`, with `.btn-wrap:hover { filter: drop-shadow(0 0 10px rgba(255,138,28,.5)) }`.

### 5.3 Item slot with a rarity glow
```css
.slot {
  --rc: transparent;              /* rarity color, set by .r-* */
  --rg: transparent;              /* rarity glow */
  position: relative; width: var(--slot); height: var(--slot);
  background:
    radial-gradient(circle at 50% 60%, color-mix(in srgb, var(--rc) 18%, transparent), transparent 70%),
    linear-gradient(145deg, #0a0908, var(--c-bg-2));
  border: 1px solid #000; border-radius: var(--radius-0);
  box-shadow: inset 0 0 0 1px var(--c-stone-2), inset 0 0 0 2px rgba(0,0,0,.8),
              inset 0 0 14px 2px var(--rg), inset 0 3px 8px rgba(0,0,0,.9);
  transition: box-shadow var(--t-med) var(--ease-out), transform var(--t-fast) var(--ease-out);
}
.slot > img { position: absolute; inset: 4px; width: calc(100% - 8px); height: calc(100% - 8px);
  object-fit: contain; image-rendering: auto; filter: drop-shadow(0 2px 2px #000); }
.slot:hover { box-shadow: inset 0 0 0 1px var(--rc, var(--c-gold-2)), inset 0 0 0 2px rgba(0,0,0,.8),
              inset 0 0 18px 4px var(--rg), 0 0 10px var(--rg); }
.slot.r-magic     { --rc: var(--r-magic);     --rg: rgba(108,140,255,.45); }
.slot.r-rare      { --rc: var(--r-rare);      --rg: rgba(255,216,74,.45); }
.slot.r-legendary { --rc: var(--r-legendary); --rg: rgba(255,138,28,.6); animation: slot-legend 2.4s ease-in-out infinite; }
.slot.r-set       { --rc: var(--r-set);       --rg: rgba(63,220,90,.5); }
@keyframes slot-legend { 50% { --rg: rgba(255,138,28,.85); } }   /* needs @property, below */
@property --rg { syntax: '<color>'; inherits: true; initial-value: transparent; }
.slot[data-pips]::after {       /* non-color rarity cue */
  content: attr(data-pips); position: absolute; top: 2px; right: 4px;
  font: 700 9px/1 var(--f-ui); color: var(--rc); letter-spacing: 1px; text-shadow: 0 0 2px #000;
}
.slot.is-new::before {          /* "novo" item sparkle */
  content: ""; position: absolute; inset: -2px; border-radius: inherit; pointer-events: none;
  background: conic-gradient(from var(--a), transparent 0 80%, var(--rc) 90%, transparent 100%);
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  padding: 2px; animation: spin-a 2s linear infinite;
}
@property --a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes spin-a { to { --a: 360deg; } }
.slot.is-unusable > img { filter: grayscale(1) brightness(.5) sepia(1) hue-rotate(-30deg) saturate(3); }
```
`data-pips="◆◆"` holds the rarity pips. Grid slots in the inventory use `--slot-sm` and a 2 px gap. An item that takes 2x3 cells spans them with `grid-area`.

### 5.4 Tooltip
Structure:
```html
<div class="tt r-legendary" role="tooltip">
  <header class="tt__head"><h3>Presa do Arauto Cinzento</h3><p>Espada Lendária · Duas Mãos</p></header>
  <div class="tt__main"><strong>1.284</strong><span>Dano por segundo</span><em class="up">▲ 212</em></div>
  <ul class="tt__affixes"><li>+142 Força</li><li>+8% Chance de Acerto Crítico</li><li class="socket">Engaste vazio</li></ul>
  <p class="tt__legend">Seus golpes críticos incendeiam o chão por 3 segundos, causando 40% de dano como Fogo.</p>
  <p class="tt__flavor">“Forjada no último suspiro de uma estrela.”</p>
  <footer class="tt__foot"><span>Requer nível 24</span><span class="gold">1.250 ◉</span></footer>
</div>
```
```css
.tt {
  --rc: var(--r-common);
  width: 320px; color: var(--c-text); font: 400 14px/1.4 var(--f-ui);
  background: var(--noise), linear-gradient(180deg, #14100d, var(--c-bg-0) 30%);
  background-blend-mode: overlay, normal;
  border: 1px solid #000;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rc) 55%, #000), inset 0 0 0 2px #000,
              0 0 0 1px rgba(0,0,0,.6), 0 18px 40px rgba(0,0,0,.8), 0 0 24px color-mix(in srgb, var(--rc) 20%, transparent);
  pointer-events: none;
  animation: tt-in var(--t-med) var(--ease-out) both;
}
.tt.r-magic{--rc:var(--r-magic)} .tt.r-rare{--rc:var(--r-rare)} .tt.r-legendary{--rc:var(--r-legendary)} .tt.r-set{--rc:var(--r-set)}
.tt__head { padding: 12px 14px 10px; text-align: center;
  background: linear-gradient(180deg, color-mix(in srgb, var(--rc) 38%, #000) 0%, color-mix(in srgb, var(--rc) 10%, #000) 100%);
  border-bottom: 1px solid color-mix(in srgb, var(--rc) 50%, #000); }
.tt__head h3 { margin: 0; font: 700 17px/1.15 var(--f-title); letter-spacing: .04em; color: var(--rc);
  text-shadow: 0 1px 0 #000, 0 0 12px color-mix(in srgb, var(--rc) 45%, transparent); }
.tt__head p { margin: 4px 0 0; font-size: 13px; color: var(--c-text-muted); }
.tt__main { display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; gap: 8px; padding: 10px 14px 4px; }
.tt__main strong { font: 700 30px/1 var(--f-ui); font-variant-numeric: tabular-nums lining-nums; color: #fff; }
.tt__main span { color: var(--c-text-muted); font-size: 13px; }
.up { color: var(--c-positive); font-style: normal; } .down { color: var(--c-negative); font-style: normal; }
.tt__affixes { list-style: none; margin: 6px 0; padding: 0 14px; }
.tt__affixes li { position: relative; padding-left: 14px; color: var(--r-magic); }
.tt__affixes li::before { content: "◆"; position: absolute; left: 0; top: .1em; font-size: 9px; color: var(--c-text-dim); }
.tt__affixes li.socket { color: var(--c-text-dim); }
.tt__legend { margin: 8px 14px; padding-left: 14px; color: var(--r-legendary); font-style: italic; border-left: 2px solid rgba(255,138,28,.5); }
.tt__flavor { margin: 8px 14px; font: italic 14px/1.35 var(--f-flavor); color: #b5946a; }
.tt__foot { display: flex; justify-content: space-between; padding: 8px 14px 10px; margin-top: 6px;
  border-top: 1px solid var(--c-stone-1); font-size: 12px; color: var(--c-text-dim); }
.tt__foot .gold { color: var(--c-gold-2); }
@keyframes tt-in { from { opacity: 0; transform: translateY(4px) scale(.98); } to { opacity: 1; transform: none; } }
```
Placement rules:
- Place the tooltip beside the cursor or slot and flip it to stay in the viewport.
- The comparison tooltip ("Equipado") docks to the left with `opacity: .92` and a small "EQUIPADO" tab.
- Holding Alt shows affix ranges `[120–150]` in `--c-text-dim`.

### 5.5 Orb: life and resource, with a liquid wave
```html
<div class="orb orb--life" style="--fill:.72" role="meter" aria-label="Vida" aria-valuenow="720" aria-valuemax="1000">
  <div class="orb__liquid">
    <svg class="orb__wave" viewBox="0 0 240 20" preserveAspectRatio="none"><path d="M0 10 Q30 0 60 10 T120 10 T180 10 T240 10 V20 H0Z"/></svg>
    <svg class="orb__wave orb__wave--back" viewBox="0 0 240 20" preserveAspectRatio="none"><path d="M0 10 Q30 20 60 10 T120 10 T180 10 T240 10 V20 H0Z"/></svg>
  </div>
  <div class="orb__glass"></div>
  <span class="orb__label">720 / 1000</span>
</div>
```
```css
.orb { --c1: #ff3b3b; --c2: #7a0a10; --c3: #2a0204; --fill: 1;
  position: relative; width: 112px; aspect-ratio: 1; border-radius: 50%; overflow: hidden;
  background: radial-gradient(circle at 50% 55%, #1a0f0d, #050303 70%);
  box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--c-gold-1), 0 0 0 5px #000, 0 0 0 8px var(--c-iron-1),
              0 0 0 9px #000, 0 6px 20px rgba(0,0,0,.9), inset 0 0 18px #000; }
.orb--mana  { --c1: #6f9bff; --c2: #1d3fa8; --c3: #060d2a; }
.orb--fury  { --c1: #ff9a4a; --c2: #a8360e; --c3: #2a0c03; }
.orb__liquid { position: absolute; inset: 0; top: calc((1 - var(--fill)) * 100%);
  background: radial-gradient(120% 90% at 35% 20%, var(--c1), var(--c2) 45%, var(--c3) 100%);
  transition: top 380ms var(--ease-out); }
.orb__liquid::after {  /* swirling inner caustics */
  content: ""; position: absolute; inset: -40%; opacity: .35; mix-blend-mode: screen;
  background: conic-gradient(from 0deg, transparent, var(--c1) 10%, transparent 25%, var(--c1) 40%, transparent 60%);
  filter: blur(10px); animation: orb-swirl 9s linear infinite; }
.orb__wave { position: absolute; left: 0; top: -9px; width: 200%; height: 12px; fill: var(--c1);
  animation: orb-wave 3.2s linear infinite; }
.orb__wave--back { opacity: .5; top: -7px; animation-duration: 5s; animation-direction: reverse; }
.orb__glass { position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
  background: radial-gradient(40% 28% at 34% 22%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%),
              radial-gradient(90% 90% at 50% 50%, transparent 60%, rgba(0,0,0,.65) 100%); }
.orb__label { position: absolute; inset: auto 0 38% 0; text-align: center; opacity: 0;
  font: 700 13px/1 var(--f-ui); color: #fff; text-shadow: 0 1px 2px #000; transition: opacity var(--t-fast); }
.orb:hover .orb__label { opacity: 1; }
.orb.is-low { animation: orb-pulse 1s var(--ease-in-out) infinite; }   /* < 25% life */
@keyframes orb-wave  { to { transform: translateX(-50%); } }
@keyframes orb-swirl { to { transform: rotate(360deg); } }
@keyframes orb-pulse { 50% { box-shadow: 0 0 0 2px #000, 0 0 0 4px var(--c-blood-3), 0 0 0 5px #000, 0 0 0 8px var(--c-iron-1),
                                         0 0 0 9px #000, 0 0 26px rgba(224,52,60,.8), inset 0 0 18px #000; } }
```
Set `--fill` from JS (`el.style.setProperty('--fill', hp/max)`) at most once per frame, and only when the value changes. For damage feedback, a second "ghost" layer (`.orb__lag`, lighter color, 0.4 opacity) follows the real fill with a 400 ms delay, as in modern ARPGs. The wave widths use 2x the path, so the `translateX(-50%)` loop is seamless.

### 5.6 Hotbar slot with a cooldown sweep
```html
<button class="hk" style="--cd:.35" data-key="2" aria-label="Golpe Sísmico, recarga 3s">
  <img src="icons/skill_07.png" alt=""><span class="hk__cd">3</span><kbd>2</kbd>
</button>
```
```css
@property --cd { syntax: '<number>'; inherits: true; initial-value: 0; }  /* 0 = ready, 1 = just used */
.hk { position: relative; width: var(--slot); height: var(--slot); padding: 0; border: 1px solid #000;
  background: #0a0908; border-radius: var(--radius-0); overflow: hidden;
  box-shadow: inset 0 0 0 1px var(--c-gold-1), inset 0 0 0 2px #000, 0 0 0 1px var(--c-iron-2); }
.hk > img { width: 100%; height: 100%; display: block; }
.hk::before {  /* dark clockwise sweep: covers the remaining fraction */
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: conic-gradient(from 0deg, transparent calc((1 - var(--cd)) * 360deg), rgba(0,0,0,.72) 0);
  /* conic runs clockwise from 12 o'clock: the cleared (transparent) wedge grows clockwise */ }
.hk::after {   /* bright edge line of the sweep */
  content: ""; position: absolute; inset: 0; pointer-events: none; opacity: calc(var(--cd) * 100);
  background: conic-gradient(from calc((1 - var(--cd)) * 360deg), rgba(255,200,120,.9) 0 2deg, transparent 3deg); }
.hk__cd { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none;
  font: 700 18px/1 var(--f-ui); color: #fff; text-shadow: 0 0 3px #000, 0 1px 0 #000; }
.hk kbd { position: absolute; left: 3px; bottom: 2px; font: 700 10px/1 var(--f-ui); color: var(--c-gold-3); text-shadow: 0 0 2px #000; }
.hk.is-ready { animation: hk-ready 380ms var(--ease-out); }   /* add when cd reaches 0 */
@keyframes hk-ready { 0% { filter: brightness(2.2); box-shadow: inset 0 0 0 1px var(--c-gold-3), 0 0 14px var(--c-ember-2); } }
.hk.is-nores > img { filter: saturate(.3) brightness(.6) hue-rotate(200deg); }   /* sem recurso */
.hk:active > img { transform: scale(.94); }
```
Drive the sweep from JS each frame with `el.style.setProperty('--cd', remaining/total)`. Using `@property` lets the value interpolate cleanly. The `.hk__cd` text shows whole seconds, or one decimal below 1 s.

### 5.7 Modal backdrop and panel open animation
```css
.backdrop { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center;
  background: radial-gradient(ellipse at center, rgba(20,6,6,.55) 0%, rgba(4,2,2,.88) 70%), rgba(0,0,0,.35);
  backdrop-filter: blur(3px) saturate(.6);        /* the Pixi canvas behind gets desaturated */
  animation: fade-in var(--t-med) var(--ease-out) both; }
.backdrop > .panel { animation: panel-in var(--t-slow) var(--ease-out) both; }
.backdrop.is-closing { animation: fade-out 160ms ease-in both; }
.backdrop.is-closing > .panel { animation: panel-out 160ms ease-in both; }
@keyframes fade-in  { from { opacity: 0; } }
@keyframes fade-out { to { opacity: 0; } }
@keyframes panel-in { from { opacity: 0; transform: translateY(14px) scale(.97); filter: brightness(1.6) blur(2px); } }
@keyframes panel-out{ to   { opacity: 0; transform: translateY(8px) scale(.98); } }
/* side panels (inventory/vendor) slide from their edge */
.side-panel { animation: side-in var(--t-slow) var(--ease-out) both; }
.side-panel--left { --from: -24px; } .side-panel--right { --from: 24px; }
@keyframes side-in { from { opacity: 0; transform: translateX(var(--from)); } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; } }
```
Backdrop blur over a WebGL canvas costs GPU time, so only use it while the game is paused (menus, not the inventory). For the inventory, use the plain gradient without `backdrop-filter`.

---

## 6. Screen-specific layouts

- **HUD (1920x1080 reference).**
  - Bottom center: `[orb life] [potion][LMB][RMB][1][2][3][4] [orb resource]`, 56 px slots with 6 px gaps.
  - The XP bar is 4 px tall, above the slots, with a gold gradient and a glint that moves on gain.
  - Buffs and debuffs sit above the XP bar as 32 px icons with a radial timer (same conic technique).
  - The minimap is top right; the quest tracker sits below it.
  - Boss bar: top center, 480 px, blood gradient, name in Cinzel, and a trailing ghost bar.
- **Inventory (right side, 440 px).**
  - Paperdoll: 12 slots around a dark silhouette (Cabeça, Ombros, Amuleto, Peito, Mãos, Cintura, Pernas, Pés, Anel ×2, Arma, Mão secundária).
  - Below it, a 10x6 grid. Footer: gold ◉, shards, and a Ordenar button.
- **Character / stats.** Tabs use Alegreya SC. Rows show a label on the left and a tabular number on the right. Hovering a row explains the stat.
- **Vendor / blacksmith (left side, 440 px).**
  - Vertical tabs are icon-only, with a tooltip for each.
  - Items appear in a grid with the price under each (gold, or red if the player cannot afford it).
  - Blacksmith: select an item slot and see the "before → after" affix preview, material cost chips and a big "Aprimorar" button with hold-to-confirm (radial progress on the button, 600 ms).
- **Skill tree (full screen, backdrop).**
  - A vertical trunk with branches. Active nodes are 64 px circles; passive nodes are 40 px diamonds; key passives are 72 px octagons.
  - Links are SVG `<path>` elements with `stroke-dasharray`. An unlocked path animates `stroke-dashoffset` from 100 % to 0 in 500 ms, then gets a slow moving ember gradient (`<linearGradient>` with an animated `gradientTransform`).
  - Locked nodes are desaturated; available ones pulse gold. Point counter: "Pontos: 3".
- **Main menu / character select.**
  - The live Pixi scene (campfire, drifting fog) sits behind.
  - The logo is in Cinzel Decorative 900 with gold gradient text and an ember particle layer.
  - The button stack is left-aligned (`.btn`, 280 px wide).

---

## 7. Celebrations and feedback

**Legendary drop** (fires once per item, stacked if several drop):
1. *Pixi:* an orange beam at the item (a vertical additive gradient sprite, 0→1 in 150 ms, then a soft pulse), a ground ring shockwave and an ember burst of about 80 particles.
2. *Screen flash:* a full-screen `div` with `radial-gradient(circle at X Y, rgba(255,138,28,.35), transparent 60%)`, fading `opacity 1→0` over 450 ms. X and Y come from the item's screen position.
3. *Toast:* top center, "LENDÁRIO" in Cinzel Decorative with the item name below. Timing: `@keyframes toast { 0% {opacity:0; transform:translateY(-12px) scale(.9)} 12% {opacity:1; transform:none} 85% {opacity:1} 100% {opacity:0; transform:translateY(-6px)} }` over 3.2 s with `--ease-back`. Its border uses the rotating conic sweep from `.slot.is-new`.
4. *Audio:* a distinct chime per rarity (see the fx/audio catalog).
5. Set items reuse the same effect in green. Rare items get only a beam and label, with no flash or toast.

**Level up.**
- A banner slides in from the middle of the screen: a 520 px ribbon with a dark center, gold edges and a gradient mask on its ends, reading "NÍVEL 12" (Cinzel Decorative, 40 px, gold text).
- The sub-line reads "+1 Ponto de Habilidade" in Alegreya Sans.
- Motion: scale 1.25→1 with blur 6→0 over 350 ms, hold 2 s, fade 400 ms.
- In Pixi: a golden pillar of light on the player plus a ring, and the XP bar flashes.

**Damage numbers (Pixi BitmapText, pooled).**
- Style:
  - White: normal hit.
  - `#ffd84a` at 1.35x size: critical, with a "!" suffix and a slight shake.
  - `#ff5c52`: damage taken by the player.
  - `#5fe07a`: heals, with a "+" prefix.
  - Elemental tints: fire `#ff8a1c`, cold `#8fd3ff`, poison `#7ddc3f`, lightning `#c9b3ff`.
  - A 4 px black outline is baked into the BitmapFont.
- Motion: spawn with a random x offset of ±12 px, rise 40 px over 700 ms on an ease-out curve, pop scale 1.4→1 in the first 90 ms, and fade over the last 250 ms.
- Merge rapid hits on the same target within 150 ms into one number. Cap the pool at about 120.
- Format numbers in pt-BR (`12.345`, `1,2 mi`) via `Intl.NumberFormat('pt-BR', { notation: 'compact' })`.

**Minimap frame.**
- A 200 px circle with `mask: radial-gradient(circle, #000 70%, transparent 71%)` over a Pixi RenderTexture copied to a `<canvas>`. Alternatively, render the minimap in Pixi on the HUD layer, which is cheaper and recommended.
- The CSS ring gets the same stacked box-shadow as the orb, plus 4 small gold cardinal studs (N, L, S, O) via an SVG overlay.
- The zone name ("Bosque Sussurrante") sits on a small plate under the ring.

---

## 8. Accessibility and legibility

- **Contrast.** All text tokens are ≥ 4.5:1 on `--c-bg-0` and `--c-bg-2`. The table in section 2 was measured with the WCAG formula. `--c-blood-2` (2.8:1) is never used for text.
- **Rarity.** Never encode rarity by color alone: add pips, the rarity word in the type line and header glyphs.
- **Numbers and fonts.** Use tabular numbers in tooltips and stats. Offer a UI scale option from 80 % to 150 % via root `font-size`. Offer a font toggle: "Fonte legível" replaces Cinzel with Alegreya Sans for item names.
- **Keyboard and screen readers.** Every interactive element is a real `<button>` with a visible `:focus-visible` gold outline. Orbs use `role="meter"`, tooltips use `role="tooltip"` and `aria-describedby`.
- **Reduced motion.** `prefers-reduced-motion` and an in-game "Reduzir efeitos" option disable screen flash, shake, swirl and wave, keeping only the fades.
- **Flash safety.** Screen flashes stay ≤ 3 per second and at ≤ 35 % opacity.
- **Pointer events.** HUD containers use `pointer-events: none`, and only the actual widgets set `pointer-events: auto`, so clicks pass through to the canvas.

## 9. Performance rules for the DOM UI

- Animate only `transform`, `opacity` and `filter`, plus the `@property` custom properties used for the cooldown sweep and orb fill.
- Update CSS variables at most once per frame, and only when the value changes.
- Use one `requestAnimationFrame`-synchronized UI update, driven from the Pixi ticker.
- Avoid `backdrop-filter` and large `box-shadow` animations during combat. Put `will-change: transform` only on elements that are currently animating.
- Keep the HUD DOM small: about 40 nodes. Build tooltips on demand.
