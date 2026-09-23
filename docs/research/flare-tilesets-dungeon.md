# Flare tilesets: dungeon (crypt) and ruins

Research notes for the procedural level generator. Assets: Flare RPG (`flare-game`), CC-BY-SA 3.0.

| Artifact | Path |
|---|---|
| Parser + render helpers | `scripts/assets/parse-flare-tileset.mjs` (`parseFlareTileset`, `parseFlareMap`, `renderContactSheet`, `renderIsoMap`, `isoCellCenter`, `isoDepthKey`) |
| Dungeon catalog | `scripts/assets/catalog/tileset-dungeon.json` (189 tiles, 27 groups) |
| Ruins catalog | `scripts/assets/catalog/tileset-ruins.json` (298 tiles, 29 groups) |
| Test renders | `docs/research/img/dungeon-room-test.png`, `docs/research/img/ruins-room-test.png` |
| Scratch (builders, contact sheets) | `.assets-src/scratch/tileset-catalog/` (`build-catalog.mjs`, `testroom.mjs`, `testruins.mjs`, `sheets/`, `tagged/`) |

Inputs: `mods/fantasycore/tilesetdefs/tileset_dungeon.txt` + `images/tilesets/tileset_dungeon.png`,
`mods/empyrean_campaign/tilesetdefs/tileset_ruins.txt` + `images/tilesets/tileset_ruins.png`. Usage
statistics come from 25 shipped maps that use the dungeon tileset and 40 that use the ruins tileset.

## 1. Formats

### Tile size is 192x96, not 64x32
`mods/*/engine/tileset_config.txt`: `orientation=isometric`, `tile_size=192,96`. The current flare-game
ships HD art, 3x the classic 64x32. Divide every number by 3 to get 64x32 units. Recommendation:
keep the HD atlas, use 192x96 as the world grid, and zoom the camera.

### Tileset definition (`tilesetdefs/*.txt`)
```
[tileset]
img=images/tilesets/tileset_dungeon.png
tile=<id>,<x>,<y>,<w>,<h>,<ox>,<oy>
animation=<id>;<x>,<y>,<dur>;<x>,<y>,<dur>;...      e.g. animation=167;0,1612,66ms;...
```
- `x,y,w,h` is the source rect in the atlas. Rects are tightly packed, not on a grid.
- `ox,oy` is the anchor: the sprite pixel that lands on the centre of the cell's ground diamond.
- Animation frames only change the atlas `x,y`. They reuse the tile's `w,h,ox,oy`.
  Dungeon animations: 167 (brazier, 8 x 66 ms) and 265 (teleporter, 4 x 66 ms).
  Ruins animations: 296 (blue brazier, 8 x 66 ms) and 381 (portal, 4 x 66 ms).
- Ids are sparse. Dungeon ids run 16-291 and ruins ids run 24-387. They match Tiled gids. The Tiled
  sheet `tiled/tilesheets/dungeon.png` is a regular 16-column grid of 192x384 cells with firstgid 16,
  so `id = 16 + row*16 + col`. For ruins, firstgid is 24.

### Map files (`maps/*.txt`)
- `[header]` holds `width`, `height`, `tileset=tilesetdefs/tileset_dungeon.txt` and `hero_pos`.
- The `[layer]` sections are `type=background` (floor), `background_fringe` (ruins only: curb
  overlays), `object` (walls and props, depth-sorted with entities) and `collision`. Data is CSV and
  indexed as `data[y][x]`.
- The collision layer uses these codes: 0 = walkable, 1 = BLOCKS_ALL (walls; also blocks projectiles
  and line of sight), 2 = BLOCKS_MOVEMENT (props, pits; projectiles fly over), 3 = BLOCKS_ALL_HIDDEN
  (outside void), 4 = BLOCKS_MOVEMENT_HIDDEN.
- Interactivity lives in `[event]` blocks: `mapmod=layer,x,y,id;...` swaps tiles (doors, chests,
  levers) and `intermap=` handles stairs.

## 2. Anchor math (verified in engine source and in renders)
From `MapRenderer.cpp` / `Utils::mapToScreen` (units_per_pixel = 2/tile_w, 2/tile_h), `centerTile()` adds `tile_h/2`,
and then `dest = p - tile.offset`:

```
cellCenter(x, y) = ( (x - y) * 96 ,  (x + y) * 48 + 48 )   // relative to the TOP vertex of cell (0,0)
spriteTopLeft    = cellCenter - (ox, oy)
entity at map position (fx, fy) (floats; cell centre = x+0.5): screen = ((fx-fy)*96, (fx+fy)*48)
```
- The offset is measured from the sprite's top-left corner to the diamond centre. It is not a
  bottom-centre anchor. Flat floors have `ox=96, oy=48` (192x96) or 47. Tall walls have
  `ox≈96, oy≈287` (178x328). The contact sheets draw the red diamond and a yellow dot at the anchor.
- Multi-cell sprites are anchored on the west cell, which is the leftmost cell on screen. A WxH
  footprint covers `x..x+W-1, y-(H-1)..y`. Examples: teleporter 264/265 is 2x2 (384x192, ox=96,
  oy=96); stairs 286/287 are 4x4 in the background layer; stairs 284/285 are 4x4 in the object layer.
- Two-part props, where each sprite sits on its own cell: sarcophagus 194@(x,y) + 195@(x,y-1),
  200+201@(x,y-1), 196@(x-1,y) + 197@(x,y), 198+199, beds 202+203 and 204+205.

## 3. Depth sorting
- The background and fringe layers are drawn first, unsorted, in row order.
- Object-layer tiles and entities are drawn together in screen rows of constant `x+y`, back to
  front. Within a row, `x` increases (`calculatePriosIso`: `(tx+ty)<<37 | tx<<20 | (fracx+fracy)<<8`).
  `isoDepthKey(x,y)` in the parser reproduces this key.
- Flare adds a special case: an entity standing between the tiles SW (x-1,y+1) and NE (x+1,y-1)
  of its row is drawn before them if its sprite fits inside their bounds. It also fades walls that
  overlap the hero (`fade_wall_alpha`). In Pixi, sort by `isoDepthKey` and add wall fading; that is
  enough.
- Multi-cell objects sort by their anchor (west) cell. Flare uses this too, and it works because
  big sprites such as stairs sit against walls or in open space.

## 4. Wall orientation rules
Axes: +x is screen down-right, +y is down-left. The camera looks from +x+y. For a room with floor
at `x∈[x0,x1], y∈[y0,y1]`:

| Cell | Role | Dungeon (tall / short) | Ruins |
|---|---|---|---|
| `(x0-1, y)` | west wall, floor at +x: `wall_y_front` | 64, 68 + decor 96/98/100/102/104/106/108 / short 80 | 136,140,168,170,174,176,178,195,199,213,215,235,238,240,248 |
| `(x, y0-1)` | north wall, floor at +y: `wall_x_front` | 65, 69 + 97/99/101/103/105/107/109 / short 81 | 137,141,169,171,175,177,179,196,200,214,216,236,237,239,249 |
| `(x1+1, y)` | east wall, floor at -x: `wall_y_back` | **82 short** (2784 uses); tall 66; tall→short transition 70 at `(x1+1,y0)` | 138 (+142,172,180,197,217) |
| `(x, y1+1)` | south wall, floor at -y: `wall_x_back` | **83 short** (2526 uses); tall 67; transition 71 at `(x0,y1+1)` | 139 (+143,173,181,198,218) |
| `(x0-1,y0-1)` | inner corner, top (+x+y) | 77 / 93 | 148 |
| `(x0-1,y1+1)` | inner corner, left (+x-y) | 76 / 92 | 151 |
| `(x1+1,y0-1)` | inner corner, right (-x+y) | 78 / 94 | 149 |
| `(x1+1,y1+1)` | inner corner, bottom (-x-y) | 79 (rare) / **95** | 150 |
| convex (+x,+y) | wall end or jamb | 73 / 89 | 144,201,205,209,219 |
| convex (+x,-y) | | 72 / 88 | 147,204,208,212,222 |
| convex (-x,+y) | | 74 / 90 | 145,202,206,210,220 |
| convex (-x,-y) | | 75 / 91 | 146,203,207,211,221 |
| free pillar | | 110, 111 | 152, 223-231; broken 232-234 |
| void outside | | nothing (black) + collision 3 | **153-160** wall-top fill, 161-166 rare; object layer, collision 3 |

How to read a tile's orientation:
- The textured face on the right half of a sprite is the +x face. The textured left half is the +y face.
- Black parts are exterior faces.

How Flare builds walls:
- Dungeon: tall on the west and north (camera-facing inside), short ledges on the east and south, so
  the room stays visible. The tall corners 76 and 78 connect to the short runs through 70 and 71.
- Ruins: never uses short walls. Rooms are carved from a solid masonry block. Every non-floor cell
  gets a void-top tile, and back walls are top-only pieces.

Wall decor is 1 in 3 to 1 in 5 cells, from the usage counts:
- Dungeon: torch sconces 102/103 (≈410 uses each), banners 106/107 (≈320), statue niches 98/99,
  bookshelves 100/101, chains 96/97, crumbling 104/105.
- Ruins: torch 248/249, niches 235-240.

## 5. Floors, edges, pits
Dungeon floor weights (map counts):
- plain 16-19: 3704, 3020, 3018, 3057
- worn/cracked 36-47: ≈1950-2450 each
- small flagstones 32-35: an alternative pattern for whole areas

Dungeon pits and bridges. These are background tiles:
- `floor_rim` 20-31 marks the last floor cell before void. Straight edges: 20 (-x), 21 (-y),
  22 (+x), 23 (+y). Outer corners: 24 (-x,-y), 25 (-y,+x), 26 (+x,+y), 27 (-x,+y). Inner corners:
  28 (-x-y), 29 (+x-y), 30 (+x+y), 31 (-x+y).
- Cliff faces go on the void cell with collision 2: 49 at floor+(1,0), 50 at floor+(0,1), 48 at a
  notch (floor at -x and -y). Only camera-facing edges get a face.
- Low railing 118-127 (collision 2) runs along rims: 122 along y, 123 along x, 118/120/119/121 are
  ends, 124-127 are corners.
- Grate 51 is walkable and can bridge void. 52 is the red-glowing grate.

Ruins floors:
- slabs 24-31: ≈1200-1485 each
- inlay 38-43: ≈430-620
- grass 74-79
- dirt 104-119
- slab/dirt transitions 32-37, 44-47, 64-73, 83-86
- dirt with curb 88-103

The fringe layer draws curb overlays: 48-51 and 52-55 are edges, 56-59 are L pieces, 60-63 are
nubs. Ruins cliffs are 122, 123 and 124, the equivalents of dungeon 48, 49 and 50.

## 6. Doors, gates, stairs, interactables
- **Dungeon double door, x-spanning.** Leaves 282@(x,y) and 283@(x+1,y). The sprites are shifted
  half a cell toward -y, so the door plane is the back edge of row y. Closed collision is 1 on
  `(x..x+1, y-1..y)`. To open, set the leaves to 0 and the collision to 0. Jamb swaps are optional:
  64→208 (jamb one row behind) or 212 (same row), 80→216, 82→222 or 218.
- **Dungeon double door, y-spanning.** Leaves 281@(x,y) and 280@(x,y+1), shifted half a cell toward
  -x. Jamb swaps: 65→209 or 213, 83→223 or 219.
- **Recipe for a 1-thick wall**, used in the test render.
  - In the north wall: the leaves sit on the gap cells, jamb 73 (+x,+y) is on the left and jamb
    74 (-x,+y) on the right.
  - In the west wall: jambs 73 (above) and 72 (below).
  - The corridor behind continues with 64 on its west side and 82 on its east side.
- **Ruins iron gate** fills a 4-wide corridor. For x-spanning: 368, 378, 379, 370, with the open
  jambs 368→364 and 370→362. For y-spanning: 369, 377, 376, 371, with 369→361 and 371→367
  (`iron_labyrinth/door_ns1.txt` and `door_we1.txt`). Sound: `soundfx/door_open.ogg`.
- **Portcullis.** Dungeon: 114/115 closed → 112/113 open (open is collision 0). Ruins barred arches:
  252→253 and 250→251.
- **Magic barrier** (dungeon 240-245, blue): collision 1, set to 0 by mapmod.
- **Stairs up, dungeon 284.** 4x4 in the object layer with collision 1. The exit cells are
  (x+1,y) and (x+2,y) with an `intermap` event. 285 is the mirror, opening on +x.
- **Stairs down, dungeon 286/287.** 4x4 in the background layer.
- **Ruins stairs.**
  - Stairs up: 5 object parts on a 3x3 block. Set A: 330 main at (x0+2,y0+2), 329 (+1,+2),
    328 (0,+2), 331 (+2,+1), 332 (+2,0). Set B: 333-337.
  - Stairs down: background parts 344-348 or 349-353, same layout.
- **Teleporter.** Dungeon 264→265 (2x2). Ruins portal 380→381 (2x2, fringe layer).
- **State changes from mapmods.**
  - Dungeon: chests 144/145→160/161, boss chests 288→289 and 290→291, barrel 146→162,
    crate 147→163, lectern 148/149→164/165, lever 150→166, runes 56-59→60-63.
  - Ruins: chests 264/265→266/267, urn 268→269, crate 285→286, barrel 287→288, levers 270→271 and
    272↔273, orb pedestal 293→294, boss chests 384→385 and 386→387.

### Light sources (attach dynamic lights; `light` field in the JSON)
- Dungeon:
  - 167 lit brazier (animated, orange; 151 is unlit)
  - 102/103 wall torch
  - 60-63 lit runes and 265 teleporter (blue)
  - 52 hot grate (red)
  - 240-245 barrier (blue)
- Ruins:
  - 296 blue brazier (animated; 295 unlit)
  - 248/249 wall torch
  - 278 crystal obelisk and 293 orb pedestal (green)
  - 281-284 candle tables
  - 381 portal
  - 121 hot grate

No traps exist in either tileset. The only candidates are the levers and the barriers.

## 7. How Flare itself does procgen
`maps/procgen_rules/iron_labyrinth*.txt` does not generate tiles. It stitches hand-made 28x28
chunks from `maps/iron_labyrinth/*.txt`, each tagged `procgen_type=start|end|door_north_south|door_west_east|room|links|key|treasure|vendor`.
Rules: `doors_max=2`, `door_spacing_min=2`, `main_path_length_min/max=10/20`, `branch_length 5..10`,
`branches_per_door_level_max=2`. Doors are locked events with `procgen_door_level`, each needing a key
item (1105).

Tiled also has editor-side automap rules (`tiled/dungeon/rules/dungeon_ruleset0-4.tmx`), which paint
walls from a region layer. We must implement the equivalent ourselves, using the tables above.

## 8. Recipe for our generator

The algorithm is the same for both biomes:
1. Carve rooms and corridors on a boolean grid.
2. Paint floor in the background layer everywhere walkable, and under wall cells too.
3. For each non-floor cell, look at its 8 neighbours:
   - an orthogonal floor on exactly one side gives a straight wall;
   - two orthogonal floors give a convex corner;
   - only a diagonal floor gives an inner corner.
4. Pick the variant from section 4. Front walls are tall. Back walls are short in the dungeon, or
   top-only plus void fill in the ruins.
5. In the dungeon, set collision 1 on walls and 3 on void. In the ruins, set 1 on walls and 3 on
   void-top cells.
6. Doors go into 2-wide gaps. Enforce corridor widths of 2 (dungeon doors) or 4 (ruins gates).
   Pillars and props must keep a 1-cell walkable margin.

**Crypt biome** (dungeon tileset):
- Floors: 16-19 at weight 30 and 36-47 at weight 22. 32-35 fill whole "chapel" rooms.
- Walls: 64/65 at 55%, 68/69 at 20%, decor at 25% (102/103 torch about every 4-5 cells, plus
  106/107 banner, 98/99 niche, 100/101 shelf, 96/97 chains, 104/105 crumble).
- Props: bones 176-183 as non-blocking decor, 1-3 per room.
  - sarcophagi 194+195, 196+197, 200+201
  - statues 128-131 and altars 134/135
  - braziers 167
  - containers 144/145, 146, 147
- Stairs: 286 down, 284 up. Chasm areas use rims 20-31, cliffs 48-50 and railings 118-127.

**Hell biome** (same dungeon tiles with a tint):
- Walls: raise the share of 108/109 (bloody bricks) to about 30%. Replace plain floor accents with
  grate 52 (red glow, about 3%).
- Place many 167 braziers and 176-183 bones.
- Tint the background and object layers with a multiply of about `0xFF8A70`, i.e. RGB
  (1.0, 0.54, 0.44). Or use a Pixi ColorMatrix: saturation +0.2 and hue -15°. Darken ambient light
  to about 0.35.
- Leave light-emitting tiles (`light` field: 167, 52, 102/103) untinted, or tint them lightly, and
  give their lights a red-orange colour (#ff5020).
- Tint the magic barrier 240-245 red (hue shift +180°) for a "hellfire wall".

**Ruins biome**:
- Floors: slabs 24-31 at 75%, inlay 38-43 at 20%, grass 74-79 at 5%.
- Surround everything with 153-160. Walls come from section 4. Decor walls are 235-240 and torch 248/249.
- Props: pillars 223-231, rubble 188-194, statues 241-244, braziers 296 (a blue light suits this
  biome), chests 264/265, urns 268, bushes 312-317.

## 9. Test render
`docs/research/img/dungeon-room-test.png` was produced by `.assets-src/scratch/tileset-catalog/testroom.mjs`
with `renderIsoMap`. The room is 6x6: floor at 1..6 x 1..6, plus a corridor stub at 2..5 x -3..-1.
- Top corner 77; west wall 64/102/106/98/64/68; north wall 65, 73, door 282+283, 74, 107.
- Right corner 78, then transition 70, then short 82. Left corner 76, then 71, then short 83.
  Bottom corner 95.
- Corridor: 64, 64 | 82, 82; top 77, 65, 103, 78.
- Props: brazier 167, barrel 146, broken barrel 162, crate 147, chest 144, sarcophagus 194+195,
  bones 178/182/176, statue 128.

Every piece lines up with the anchor formula above and the (x+y, x) sort, with no manual nudging.
`ruins-room-test.png` (`testruins.mjs`) checks the ruins rules: void-top fill, back walls 138/139,
corners 148-151, the gate 368-378-379-370 and brazier 296.
