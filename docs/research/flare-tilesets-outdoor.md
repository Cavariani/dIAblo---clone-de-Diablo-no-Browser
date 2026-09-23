# Flare outdoor tilesets: cave, grassland, snowplains

Research notes for the procedural generator. They cover three Flare tilesets: **cave**, **grassland** (forest, farm, town) and **snowplains**. The notes explain how to build caves, a corrupted forest, a hell variant and the fixed town hub from them.

- Catalogs (one entry per tile: index, image, rect, offset, group, tag, orientation, layer, blocks, footprint, animation, usage stats taken from the real Flare maps):
  - `scripts/assets/catalog/tileset-cave.json` (170 tiles)
  - `scripts/assets/catalog/tileset-grassland.json` (229 tiles; `img` is `tileset_grassland.png` or `tileset_grassland_water.png`)
  - `scripts/assets/catalog/tileset-snowplains.json` (407 tiles; 4 images: base, `_water`, `_ice`, `_other`)
  - Each file also has `groups`, `rules` (autotile palettes) and `compositions` (multi-tile objects with cell offsets).
- Tools: `scripts/assets/tileset-outdoor-tools.mjs` provides `parseTilesetDef`, `parseMap`, `contactSheet`, `renderIso` and the CLI commands `sheet`, `map` and `usage`. Its Flare map renders match the game (checked on black_oak_city, black_oak_farm and goblin_camp).
- The catalog builder and the test scenes are in `.assets-src/scratch/outdoor-tilesets/v2/`: `build-catalog.mjs` and `scenes.mjs`. The labelled contact sheets are there too: `cave1-3.png`, `gr1-6.png`, `sn1-5.png`.
- License: CC-BY-SA 3.0. We must give credit (see the flare-game CREDITS files). Snowplains art is by rubberduck (OpenGameArt).

## 0. Engine facts (verified)

| Item | Value |
|---|---|
| Tile size | 192x96 (HD, 3x the classic 64x32) |
| Anchor | `tile=i,x,y,w,h,ox,oy`: pixel `(ox,oy)` of the crop goes on the **centre** of the cell diamond. `centre = ((col-row)*96, (col+row)*48 + 48)` |
| Axes | map **+x = screen down-right**, **+y = screen down-left**, -x = up-left, -y = up-right |
| Draw order | background, then bridge (cave), then object sorted by `col+row`, then by `col` |
| Collision | 0 walkable · 1 blocks all (walls, trees) · 2 blocks movement only (water, pits, props; projectiles pass) · 3/4 hidden versions of 1/2 (off-map void) |
| Animation | `animation=i;x,y,ms;...`: water and pools have 2 frames at 250 ms; waypoint 265 has 4 frames at 66 ms; the dungeon brazier has 8 frames at 66 ms |
| Water level | Grassland/snowplains water 176-191 uses `oy=-48`, so it is drawn half a tile lower. The shore pieces 144-167 (192x192) contain the drop from land down to water. |

**Orientation vocabulary** (used by every wall, cliff and shore piece). The name says which neighbour is **open**, meaning floor for walls or land for water:
`open+x`, `open+y` = visible textured faces; `open-x`, `open-y` = back faces, drawn as black silhouettes;
`diag±x±y` = only that diagonal is open (inner corner); `open+x+y`, `open-x+y`, `open-x-y`, `open+x-y` = two sides open (outer corner).
I derived these from 3x3 neighbourhood statistics over every Flare map. Each tile is used in its pattern 95-100% of the time.

## (a) Cave level (tileset_cave)

**Floor**: 16-31 plain dirt (25 and 31 have moss). Decals: 48-51 pebbles, 52-55 bones and skulls. Rails: 32/34 run along x, 33/35 along y, 36-39 are curves, 40-47 are T-junctions. Minecarts 128-131 go on the object layer on top of the rails.

**Wall autotile.** Build a solid mask. For every solid cell that touches floor (8-neighbourhood), choose the piece from its open sides:

| Open side(s) | Pieces (first = plain, rest = themed variants) |
|---|---|
| +x | 64, 68, 96 stalagmites, 100 cobweb, 104 mine beam, 108 shoring, 112 mushrooms |
| +y | 65, 69, 97, 101, 105, 109, 113 |
| -x (black) | 66, 70, 106 beam |
| -y (black) | 67, 71, 107 beam |
| diag +x+y (inner) | 72, 76, 98, 102, 114 |
| diag -x+y | 73, 77 |
| diag -x-y | 74, 78 |
| diag +x-y | 75, 79 |
| +x & +y (outer) | 80, 84 rubble, 99, 103, 115 |
| -x & +y | 81, 85, 117, 119, 121 |
| -x & -y | 82, 86 |
| +x & -y | 83, 87, 116, 118, 120 |

Rules:
- Test the two-sided outer corners first, then single sides, then diagonals (see `autotileWalls` in `scenes.mjs`).
- Keep walls at least 2 cells thick. Flare has no piece for a wall with floor on opposite sides.
- Interior solid cells get no object and background 0, with collision 1.
- **Background under wall cells:**
  - visible faces: a normal floor tile
  - `open-x` and `diag-x+y`: 57 (left half-diamond floor)
  - `open-y` and `diag+x-y`: 56 (right half)
  - `open-x-y` and `diag-x-y`: 0 (void)
- Walls are about 300-340 px tall (3+ tiles). The front walls (`open-x`/`open-y`) are black silhouettes and hide whatever is behind them. Two options for our renderer:
  - Keep rooms at least 8 cells deep, as in the test render.
  - Better: fade or cut away front walls near the player, the way D3/D4 do.
- Use the plain pieces about 70% of the time. Themes: stalagmites/cobwebs/mushrooms for natural caves; 104-111 (beams, shoring, free-standing Y-support 110/111) only for mines.

**Pools** (animated, collision 2):
- Use the same 8-neighbour logic with water as "solid": edges 192/196 (land -x), 193/197 (-y), 194/198 (+x), 195/199 (+y).
- Outer corners: 200/204 (-x+y), 201/205 (-x-y), 202/206 (+x-y), 203/207 (+x+y). Inner corners: 208/212 (diag -x+y), 209/213 (-x-y), 210/214 (+x-y), 211/215 (+x+y). Full water: 216-219.
- **Bridges** go on the `bridge` layer with collision 0: 232/233/236/237 run along y, 234/235/238/239 along x, 224-227 are broken ends, 228-231 are framed landings.

**Props and blockers**:
- stalagmites 144-147 and boulders 150-152 (collision 2)
- tall pillars 148/149 and rock pillar 153 (collision 1)
- mushrooms 132-135 (decor)
- chests 160/161 (open versions 176/177), barrel 162/178, crate 163/179, boss chests 266-269
- **Light**: 240/241 blue light shafts are the only native cave light. `tileset_cave_and_dungeon.txt` contains the same cave indices plus dungeon tiles at **index+250**, so the dungeon brazier 167 becomes **417** there (animated, 8 frames).
- **Waypoint** 264, active version 265: a 2x2 tile on the background layer. The anchor cell (x,y) covers x..x+1 and y-1..y; leave the other 3 cells at 0.
- Entrances or exits: none are drawn inside the cave tileset. Flare uses events at the map edge. For stairs or doors, use the dungeon tiles through cave_and_dungeon.

Render: `docs/research/img/cave-test.png` shows an autotiled 20x20 room with a pool, waypoint, 4 braziers, light shafts and props.

## (b) Corrupted forest (tileset_grassland)

- **Floor**: grass 16-31. Flare lays them as `16 + (row%4)*4 + (col%4)`.
- **Paths**: 32-39 are full cobble; 40-47 are sparse cobble fading into grass, used for path borders and worn trails. Paths have no orientation rules, so just paint 1-3 cells wide.
- **Trees** (object layer, 1-cell trunk, collision 1):

| Group | Indices | Look |
|---|---|---|
| Dead | 244-247 | Leafless, 390-585 px. The main tree of the corruption |
| Pine | 248-251 | Dark conifers, about 550-585 px |
| Oak | 252-255 | Large olive trees, about 430 px, wide canopy |
| Birch | 240-243 | Light green, about 340 px (keep these out of the corrupted zone) |

- **Tree walls**: canopies overlap, so a checkerboard of trees (`(x+y)%2==0`, about 85% fill) plus bushes in the gaps reads as a solid wall. Mark every cell of the band as collision 1, including the gaps, so it cannot leak.
- Clearings are radius-4-6 blobs joined by 1-2-cell paths.
- **Undergrowth** (no collision): 122/123 dark shrubs, 112/113 ferns, 124-127 grass tufts, 114/115 reeds (near water), 118/119 purple flowers.
- **Rocks**: 128-131 small (collision 2), 132-135 tall pillars (collision 1).
- **Graves** 140-143 and stumps 136/137 make good corruption set dressing.
- **Cliffs** (cliff lines or plateau edges) use the same scheme as cave walls:
  - open+x 48/52, open+y 49/53, open-x 50/54, open-y 51/55
  - inner corners 56-59 / 60-63 (diag +x+y, -x+y, -x-y, +x-y)
  - outer corners 64-67 / 68-71 (+x+y, -x+y, -x-y, +x-y)
  - Keep grass under them.
- **Water** (river or swamp) sits lower than the land:
  - shore edges 144/148 (land -x), 145/149 (-y), 146/150 (+x), 147/151 (+y)
  - outer corners 152/156 (-x-y), 153/157 (+x-y), 154/158 (+x+y), 155/159 (-x+y)
  - inner corners 160/164 (diag -x-y), 161/165 (+x-y), 162/166 (+x+y), 163/167 (-x+y)
  - full water 176-191, collision 2
  - docks/bridges 192-207 on the background layer with collision 0: 192-195 meet the shore at -x/-y/+x/+y; even indices run along x, odd along y; 204-207 are broken
  - rowboat 168-170 along x, 171-173 along y
- **Cave mouths in cliffs**:
  - 224 (x,y) + 225 (x,y-1) in a cliff facing +x
  - 226 (x,y) + 227 (x+1,y) facing +y
  - mine versions 228/229 and 230/231
  - Flare places the purple floor arrows 92-95 in front of exits
- **Sickly tint**: `sharp.modulate({brightness:0.7, saturation:0.55, hue:25})` plus `tint(150,170,110)` on every tile (`img/forest-test.png`). The result reads as rotten. For the game, prefer a Pixi ColorMatrix:
  - desaturate about 50%, brightness 0.7, then a green-purple split (canopies toward olive, shadows toward violet)
  - add a dark vignette and fog sprites
  - tint water 176-191 toward swamp green

## (c) HELL biome (cave tinted)

No tileset in fantasycore or empyrean has **lava or fire floor tiles**. Only the candidates below exist:

| Need | Candidate | Notes |
|---|---|---|
| Lava pools | cave pools 192-219 (2 animated frames) | Recolour orange/red. Tint only the liquid, not the dirt rim. Luminance-key or shift hue on the dark-green pixels, add an additive glow sprite and a heat-shimmer shader. `img/hell-test.png` shows a naive full-tile tint: the rim glows too, so key the liquid instead |
| Rock walls/floor | whole cave set | Multiply toward (200,70,55) at brightness 0.8. Swap decals to 52-55 bones |
| Fire/light | dungeon brazier 167 (cave_and_dungeon **417**), 8 frames 66 ms | Keep it untinted so it pops |
| Hell-fire (alt) | ruins brazier **296** in `empyrean_campaign/tilesetdefs/tileset_ruins.txt` (purple flame, 8 frames) | Hue-rotate to red or green for "fel fire" |
| Portal / rune circle | waypoint 264/265 (tint red); ruins 381 (4 frames) | |
| Purple pit | grassland/snow 219 (tower trapdoor), cave-mouth interiors 224-231 | A "void" look |
| Enemy fire FX | `fire_ant`, `wyvern_fire`, `grave_fire` enemy sheets | Not tiles, but reusable as ambient flames |

For real lava edges we need custom art, or we reuse the pool edge set with keyed recolouring (same indices and rules as the cave pools).

## (d) Fixed TOWN hub (tileset_grassland, plus snowplains_other and dungeon extras)

`img/town-test.png` shows a 22x22 plaza that uses only the tiles below.

| Town element | Tiles | Composition (anchor = (x,y)) |
|---|---|---|
| Houses (log cabin A, door on the +x face) | 208-211 | 209 (x,y), 208 (x-1,y), 210 (x,y-1), 211 (x,y-2). Collision 1 on x-1..x, y-2..y |
| Houses (cabin B, rotated) | 212-215 | 212 (x-2,y), 213 (x-1,y), 214 (x,y), 215 (x,y-1). Collision 1 on x-2..x, y-1..y |
| Big stone hall (blacksmith forge / town hall / crypt) | 296 (888x1051) | Single tile at (x,y). Collision on x+1..x+5, y-5..y-1 (source: black_oak_farm 37,71). Snowy version: snowplains 744 |
| Blacksmith area | 103 anvil on stump, 100/101 log piles, 137 chopping block, 102 stone fire pit (not animated), plus a dungeon brazier 167 as the forge fire | Put them at the door of hall 296 |
| Market stalls | tents 72+73 (along y: 72 (x,y), 73 (x,y-1)) and 74+75 (along x: 74 (x,y), 75 (x+1,y)); goods 96-99 (crates, rope, grain sacks); **handcarts** snowplains 540-543 (4 angles, slight snow) | Tents have collision 2 |
| Fences | along y: 105 (x,y-1) + 104 (x,y); along x: 106 (x-1,y) + 107 (x,y); broken: 109+108 / 110+111 | Repeat the pair every 2 cells. The art is a rustic fence with gaps, like Flare's own. Use collision 2 on every cell |
| Palisade / town wall | none | Use cliffs 48-71, tree bands, or rock pillars 132-135 |
| Well | **none in any Flare tileset** | Needs custom art. Placeholder: waypoint platform, or a ruined-tower corner |
| Braziers / light | dungeon 167 (animated fire, the only lit brazier); cave light shafts 240/241 | Render from the dungeon tileset as an extra sheet (`renderIso` `extra`) |
| Waypoint | 264 (inactive) / 265 (active, animated) | 2x2 on the background layer: anchor covers x..x+1, y-1..y |
| Paths / plaza | 32-39 core, 40-47 border | |
| Dungeon entrance in town | stairs down 232-238 (background): 232 (x-3,y), 233 (x-2,y), 234 (x-1,y), 235 (x,y), 236 (x,y-1), 237 (x,y-2), 238 (x,y-3). Or ruined tower 216-222 (L of 7 tiles, trapdoor 219). Or cave/mine mouth 224-231 in a cliff | |
| Signs, graves, dressing | 138/139 signposts (collision 1), 140-143 graves, 136 stump, bushes 112-127 | |
| Watchtower | snowplains 544+545 (544 (x,y), 545 (x+1,y-1)); variants 546/547, 548/549, 550/551 | Has a snow tint; a warm colour-matrix pass fixes it |
| Boats / docks | 168-173, 192-207 | For a riverside town |

Suggested layout for the hub:
- waypoint at the centre of a cobble plaza, ringed by 4 braziers
- two roads (2 wide) crossing through it
- stone hall 296 on the west as the blacksmith, with anvil, logs and forge fire
- market tents and carts to the south, behind fences
- cabins north and east
- dungeon stairs 232-238 or a cave mouth at the end of one road
- tree bands on the edges for the map boundary

Snowplains uses the same indices as grassland for 16-265, so a winter town can reuse all of these compositions with snow-covered art.

## Notes and caveats

- Flare's own procgen (`maps/procgen_rules/*.txt`) only assembles hand-made **chunks** (rooms, doors, links) with the ruins tileset (Iron Labyrinth). It has no autotiling, so our cave generator must use the neighbour rules above.
- Snowplains maps add overlay layers `background_fringe`, `snow_bottom` and `snow_top`: ice 344-447 and snow-over-dirt 584-623 are drawn on them to break tile edges.
- The `blocks` field in the catalog comes from how often each collision value appears under the tile in real maps, overridden by hand where Flare was inconsistent (mushrooms 132-135 are 0 or 2; I chose none).
- A few orientations are plausible but not checked against maps: snowplains watchtower pair 548/549, the angles of carts 540-543, and the direction of exit arrows 92-95. Check the contact sheets before relying on them.
