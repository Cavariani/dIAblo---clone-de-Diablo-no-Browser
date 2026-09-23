# Flare character sprites: research and catalog

Source: Flare RPG `flare-game` assets (CC-BY-SA 3.0), mod stack `fantasycore` then `empyrean_campaign` (a later mod overrides an earlier one). Paths below are relative to `.assets-src/flare-game/mods/<mod>/`.

- Parser and catalog CLI: `scripts/assets/parse-flare-anim.mjs`
- Generated catalog: `scripts/assets/catalog/characters.json` (rebuild with `node scripts/assets/parse-flare-anim.mjs --catalog`)
- Verification renders (gitignored): `.assets-src/scratch/char-catalog/*.png`, made by the `*.mjs` files next to them (`render-lib.mjs` is the shared compositor)
- Engine sources used as the reference for these semantics: `.assets-src/scratch/char-catalog/engine-src/` (AnimationSet.cpp, Animation.cpp, Avatar.cpp, Entity.cpp, MapRenderer.cpp, Utils.cpp, UtilsParsing.cpp)

## 1. Animation file format

```
image=images/enemies/skeleton.png        # header; repeatable as image=path,id for multi-sheet sets
render_size=128,128                       # unpacked format only
render_offset=64,96                       # unpacked format only
color_mod=223,223,255  alpha_mod=127  blend_mode=add   # optional header tint, alpha and blend
INCLUDE animations/enemies/zombie.txt     # spliced in place (variants = tint + include)

[stance]
frames=4
duration=533ms            # "ms" or "s"; this is the whole forward pass
type=back_forth           # looped | back_forth | play_once
active_frame=2            # optional: 'all' or a list; the hit or projectile fires on this frame
frame=index,direction,x,y,w,h,offsetx,offsety[,imageId]
```

- **Packed** (every shipped file): one `frame=` line per (frame index, direction). The direction can also be written as a name, where `SW=0, W=1, NW=2, N=3, NE=4, E=5, SE=6, S=7`.
- **Unpacked** (`animations/avatar/default_unpacked.txt`, a template only): `position=N` gives the first column. Frame `i` in direction `d` is at `rect = (rs.w*(position+i), rs.h*d, rs.w, rs.h)` and every frame has `offset = render_offset`.
- The engine carries section scalars (position, frames, duration, type, image) over to the next section when a section leaves them out. `active_frame` is not carried over. The parser does the same.
- **Default active frame** (used when `active_frame` is absent): `floor((total-1)/2)`, where `total = frames`, doubled for back_forth. It is stored as `activeFrameEffective` in the catalog.
- **Timing:** `frame_ms = duration_ms / frames`. back_forth plays forward and then in reverse, so one full cycle takes `2*duration_ms`. play_once holds its last frame (corpses stay on it). The engine ticks at 60 fps.
- The parser returns `{ image, images, renderSize?, renderOffset?, colorMod?, alphaMod?, blendMode?, includes, format, animations: { name: { frames, duration_ms, type, activeFrame?, rects[frame][dir] = {x,y,w,h,ox,oy,image?} } } }`.
- Every file in the three trees parses with no missing rects: 196 avatar layers, 36 enemies and 15 NPCs.

## 2. Anchor and offset math (feet on the world point)

The Flare engine renders a frame like this (MapRenderer::drawRenderable): `dest = mapToScreen(entity.pos) - (ox, oy)`.

- `(ox, oy)` is the position of the feet inside the frame rect.
- The rect's top-left goes at `(feetScreenX - ox, feetScreenY - oy)`.
- In Pixi, per frame: `sprite.anchor.set(ox / w, oy / h)` and `sprite.position = feetScreen`. You can also bake the anchor into spritesheet JSON with a per-frame `anchor`, or use `pivot = (ox, oy)`.
- The offset is different for every frame and every direction. Never use one anchor per sheet.
- Flying enemies (wyverns, oy ≈ 194; air boss oy 576) already have the lift and the ground shadow baked into the frame. Anchor them the same way.

**Projection** (Flare isometric, `engine/tileset_config.txt`: tile 192x96): `screenX = (mx - my) * 96` and `screenY = (mx + my) * 48`, with the map unit being 1 tile.
**Depth sort:** Flare sorts renderables by map depth (`mx + my`), then by layer priority.

Typical feet offsets and frame sizes (stance):

| Sprite | Typical (ox, oy) | Max frame w x h |
|---|---|---|
| Avatar body layers | about (26, 116) | 124 x 134 |
| Skeleton | (90, 150) | 320 x 239 |
| Zombie | (28, 147) | 206 x 304 |
| Goblin | (39, 82) | 155 x 165 |
| Minotaur | (73, 220) | 280 x 311 |

## 3. Direction convention (verified visually: `dirs.png`, `d_a.png`, `d_b.png`, `comp_*.png`)

| Index | Flare name | Faces on screen | Map delta (Flare axes) |
|---|---|---|---|
| 0 | SW | **left (W)** | (-x, +y) |
| 1 | W | up-left (NW) | -x |
| 2 | NW | **up (N), back to the camera** | (-x, -y) |
| 3 | N | up-right (NE) | -y |
| 4 | NE | **right (E)** | (+x, -y) |
| 5 | E | down-right (SE) | +x |
| 6 | SE | **down (S), facing the camera** | (+x, +y) |
| 7 | S | down-left (SW) | +y |

- The indices go **clockwise on screen, starting at screen-left**. Flare's names are map-space compass names, so do not read them as screen directions.
- The two cardinal map axes line up with screen diagonals: map +x is screen down-right, and map +y is screen down-left.
- Engine formula (Utils::calcDirection, map deltas): `dir = (round(atan2(dy, dx) / 45°) + 5) mod 8`.
- The same result from a screen-space delta (y pointing down): undo the 2:1 squash first, then `dir = (round(atan2(2*sy, sx) / 45°) + 4) mod 8`.
- Our engine should compute the facing from the projected screen delta with this formula. Then any world-axis convention works.

## 4. Avatar layer draw order (`engine/hero_layers.txt`, first = drawn first = bottom)

| Dir | Order (back to front) |
|---|---|
| 0 (W) | main, feet, legs, hands, chest, off, head |
| 1 (NW) | main, feet, legs, hands, chest, off, head |
| 2 (N) | main, feet, legs, hands, chest, off, head |
| 3 (NE) | feet, legs, hands, chest, off, head, main |
| 4 (E) | feet, legs, hands, chest, off, head, main |
| 5 (SE) | feet, legs, hands, chest, off, head, main |
| 6 (S) | feet, legs, hands, main, chest, head, off |
| 7 (SW) | main, feet, legs, hands, chest, head, off |

**Slot resolution** (Avatar.cpp):

- An equipped item's `gfx` names the file: `animations/avatar/<body>/<gfx>.txt`.
- If the head slot is empty, the head layer is the portrait head (`hero_options.txt`: `head_short`, `head_bald` or `head_long`).
- chest, legs, hands and feet fall back to `default_<slot>`: the naked body is `default_chest + default_legs + default_hands + default_feet`.
- There is no default for main or off, so those layers are simply omitted.
- Every layer has the same 8 animations with identical frame counts and timing (template `animations/hero.txt`), so all layers stay in sync on one clock.

**Composite tests (all correct):**

- `comp_warrior.png`: male, head_short + plate set + longsword + shield. Rows: stance, run, swing, block, naked.
- `comp_mage.png`: female, mage set + staff. Rows: stance, run, cast, die.
- `comp_archer.png`: female_dark, leather set + longbow. Rows: stance, run, shoot, hit.
- `armor_sets.png`: every armor tier on all 3 bodies.

## 5. Avatar content

**Bodies and heads:**

- `male` has 66 layers. Heads: `head_short` (19 portraits) and `head_bald` (2).
- `female` and `female_dark` have 65 layers each. The only head is `head_long`.
- female_dark is a darker skin tone with the same rig as female. Its sheets are nearly identical in size, and its head, hands, chest and cloth layers differ.

**Animations** (the same for every layer):

| Animation | Frames | Duration | Type | Default active frame | Note |
|---|---|---|---|---|---|
| stance | 4 | 800 ms | back_forth | | |
| run | 8 | 533 ms | looped | | |
| swing | 4 | 400 ms | play_once | 1 | |
| block | 2 | 66 ms | play_once | | |
| hit | 2 | 133 ms | play_once | | the first 2 frames of die (both start at position 18) |
| die | 6 | 800 ms | play_once | | |
| cast | 4 | 400 ms | play_once | 1 | |
| shoot | 4 | 400 ms | play_once | 1 | |

There is no walk, dodge or critdie for the avatar. Use run for walking (and scale its speed), and use die for crit deaths.

**Armor sets** (the head / chest / hands / legs / feet gfx):

| Set | head | chest | hands | legs | feet |
|---|---|---|---|---|---|
| cloth | none | cloth_shirt | cloth_gloves | cloth_pants | cloth_sandals |
| leather | leather_hood | leather_chest | leather_gloves | leather_pants | leather_boots |
| chain | chain_coif | chain_cuirass | chain_gloves | chain_greaves | chain_boots |
| plate | plate_helm | plate_cuirass | plate_gauntlets | plate_greaves | plate_boots |
| mage (brown) | mage_hood | mage_vest | mage_sleeves | mage_skirt | mage_boots |
| mage_alt1 (blue) | mage_hood_alt1 | mage_vest_alt1 | mage_sleeves_alt1 | mage_skirt_alt1 | mage_boots_alt1 |
| mage_alt2 (red) | mage_hood_alt2 | mage_vest_alt2 | mage_sleeves_alt2 | mage_skirt_alt2 | mage_boots_alt2 |

**Weapons** (from `items/base`):

- **main, melee:** shortsword, longsword, greatsword, zweihander, hand_axe, battle_axe, infantry_axe, club, reinforced_club, mace, war_hammer, maul, dagger, smith_hammer.
- **main, mental:** wand, rod, staff, greatstaff.
- **off:** shields (buckler, iron_buckler, shield, kite_shield). **Bows and the slingshot are also off-hand** (shortbow, longbow, greatbow, slingshot), and they are drawn in the off layer. Flare has no two-hand flag, so our engine must block main+off itself when it treats a weapon as two-handed.

**Recommended class mapping:**

| Class | Body | Armor tiers (low to high) | Weapons (layer) |
|---|---|---|---|
| Warrior | male (head_short/bald) or female | cloth, leather, chain, plate | main: shortsword/longsword/hand_axe/mace/club; 2H: greatsword/zweihander/battle_axe/maul/war_hammer; off: buckler, iron_buckler, shield, kite_shield |
| Elemental caster | female or male | cloth, mage (brown), mage_alt1 (blue), mage_alt2 (red); tier by tint as well | main: wand, rod, staff, greatstaff |
| Archer | female_dark or female | cloth, leather, chain (leather + chain_coif mix) | off: slingshot, shortbow, longbow, greatbow (main empty) |
| Bone necromancer | male (head_bald) | mage_alt2 (red) / mage (brown) with a dark tint `0x9080a0`, plus chain_greaves for a "bone" look | main: wand, rod, dagger; greatstaff for the high tier |

Hair and skin tint: you can apply a Pixi `tint` to the head and default_* layers to get more variety.

## 6. Enemies (36 animation sets; `usedByEnemyDefs` in the catalog lists the Flare stat defs)

**Common set** on the humanoid and ant rigs: stance, run, swing, cast, shoot, block, hit, die, critdie.

| Sheet | Frames / extras | Notes |
|---|---|---|
| antlion, fire_ant, ice_ant, antlion_small | + **spawn** (6f, burrows out) | swing = cast = shoot share rects (one attack anim); critdie 8f |
| antlion_armored (EC) | no spawn | 3705x3221, big frames 368x337: boss (Razu) |
| zombie, zombie_dark (EC) | + **spawn** (8f, rises from the ground) | cast = shoot; critdie 8f vs die 6f |
| skeleton | + **shield_bash** (2f, active 0) | sword + shield |
| skeleton_weak, skeleton_archer (bow), skeleton_mage (staff) | standard | critdie looks the same as die (6f) |
| skeleton_knight_boss (EC), skeleton_mage_boss (EC), skeleton_mage_high_boss (EC) | no shoot on the mage bosses | 3927x3420 / 3973x2343 / 3224x3243 |
| goblin, goblin_elite | + **run_alt** (8f crouched sprint, spear forward) | *_runner variants swap run and run_alt |
| hobgoblin, hobgoblin_archer (EC) | standard, shoot 800 ms | archer has a bow |
| minotaur | 8 split sheets, all anims 8f, + **cast_alt** | hit uses the die sheet; die = critdie |
| wyvern, wyvern_air, wyvern_fire, wyvern_water | 7 split sheets, + **dash_attack** (8f / 400 ms), flying | block uses stance, shoot uses cast, die = critdie |
| wyvern_air_boss (EC) | same as wyvern | **7 sheets of 6144x6144**, frame 768x768 |
| cursed_grave | stance 8f, cast 8f, hit, die, critdie | static spawner/turret; no run |
| boulder (EC) | stance 1f, die 5f | destructible prop |
| goblin_minecart (EC) | stance 1f, run 1f | prop / hazard |

**Tint-only variants** (these INCLUDE a base file and add a header `color_mod`, which is a multiply tint and maps directly to Pixi `tint`):

| Variant | color_mod | Pixi tint | Other |
|---|---|---|---|
| frozen_zombie | 223,223,255 | 0xDFDFFF | |
| zombie_ghost | 191,255,191 | 0xBFFFBF | alpha 127/255 |
| cursed_grave_fire | 255,207,207 | | |
| cursed_grave_ice | 207,207,255 | | |
| skeleton_mage_fire | 255,223,223 | | |
| skeleton_mage_ice | 223,223,255 | | |
| antlion_fossilized | 60,50,45 | | uses ice_ant.png |

**Archetype mapping** (flare def names in parentheses show the original usage):

| Archetype | Sprite | Variant suggestion |
|---|---|---|
| Swarm melee | skeleton_weak (summon_skeleton), zombie (zombie_raised; use `spawn` on entry), antlion_small (hatchling, `spawn`) | scale 0.85-0.9 for trash packs |
| Archer | skeleton_archer, hobgoblin_archer | |
| Caster | skeleton_mage (+ fire/ice tints above), hobgoblin `cast` | |
| Tank | skeleton (shield, `block` + `shield_bash`), minotaur, antlion (large) | scale 1.1-1.2 |
| Suicide exploder | fire_ant (Flare's `antlion_burster` uses it) | scale 0.75, tint 0xFF8060, critdie as the pop |
| Summoner | cursed_grave (stationary, `cast` spawns adds); moving option: minotaur `cast_alt` (Flare `minotaur_necromancer`) | |
| Charger | goblin_runner / goblin_elite_runner (`run_alt` sprint; Flare `goblin_charger`), wyvern `dash_attack` | |
| Fleeing ranged | goblin (Flare `goblin_hurler`: `shoot` = throw), with `run_alt` to kite away | |
| Flying | wyvern / wyvern_fire / wyvern_water | |

**Bosses:**

| Boss | Sprite | Flare original |
|---|---|---|
| Act 1 | skeleton_knight_boss | Seagate, L4 |
| Act 2 | skeleton_mage_boss | Metzger, L12 |
| Final | skeleton_mage_high_boss | Lezaith, L16 |
| Optional | antlion_armored (Razu), wyvern_air_boss (Mez; needs repack) | |
| Rift guardian | minotaur at scale 1.35 with tint 0xC080FF plus an additive glow; or antlion_armored with tint 0x9060FF. Rotate between the two. | |

**Hell / Torment variants** (multiply tint, all animations are shared):

| Variant | Tint | Scale | Other |
|---|---|---|---|
| Hell | 0xFF9080 | | |
| Frozen | 0xDFDFFF | | |
| Shadow | 0x605060 | | |
| Ghost | 0xBFFFBF | | alpha 0.5 |
| Elite / champion | | 1.15 | colored outline |
| Rare | | 1.25 | |

## 7. NPCs (stance only, all 8 dirs)

| Sheet | Frames | Look | Town role |
|---|---|---|---|
| guild_man (1,2 reuse) | 12f / 6.4 s looped | blue vest, arms crossed | **Merchant / general vendor** |
| knight | 4f back_forth | chain + green cape + sword | **Quest giver** (guard captain) |
| wandering_trader (1,2) | 6f / 2 s | purple noble coat | **Jeweler / mystic vendor** |
| peddler_goblin | 4f | goblin with a huge pack | **Gambler / stash keeper** |
| peasant_woman1 | 4f | purple dress, walking staff | **Healer** |
| peasant_man1 | 4f | walking stick | elder / ambient |
| peasant_man2, peasant_woman2 | 4f | villagers | ambient |
| return_obelisk1/2 | 6f / 1.6 s | glowing stone | **Waypoint / town portal** |
| dead_skeleton | 1f | corpse | decoration |

**Blacksmith:** there is no NPC sheet, so composite the avatar layers: male + head_bald + leather_chest + cloth_pants + leather_gloves + smith_hammer, and loop `swing` on an anvil. Idle with `stance`.

## 8. Texture budget

| Group | Images | PNG | GPU (RGBA8) |
|---|---|---|---|
| male | 66 | 77.9 MB | 523 MB |
| female | 65 | 71.0 MB | 484 MB |
| female_dark | 65 | 70.3 MB | 484 MB |
| enemies (excl. air boss) | 57 | 220.9 MB | 981 MB |
| wyvern_air_boss | 7 | 61.3 MB | **1057 MB** |
| npcs | 11 | 4.6 MB | 19 MB |
| **all unique** | 222 | 450 MB | 3.18 GB |

**Sheet sizes:**

- **Over 4096 px:** only `empyrean_campaign/images/enemies/wyvern_air_boss/*.png`, 7 sheets of 6144x6144.
- Frame rects cover only 32.6% of those sheets. A trimmed repack at 1.0 is about 3510² per animation, or use a 0.5 scale (3072²).
- 2049-4096 px (27 sheets): all the single-sheet enemies (up to 3973x2343 / 3927x3420) and greatstaff (1375x3144 / 3012x1479).
- Every other sheet is 2048 px or less.
- The other sheets are already packed tightly: rects cover about 98% of the sheet area, so repacking gains nothing.

**Budget cases:**

- One hero loadout (11 layers, warrior test) is 13.8 MB PNG and 85 MB GPU.
- The recommended enemy set (20 sheets, including the 3 skeleton bosses) is 159 MB PNG and 686 MB GPU if everything is loaded at once. Load per zone: about 6-8 enemy types, roughly 150-250 MB GPU.

**WebP test** (q85, alpha q90, sharp; `webp-test.mjs`, 8 representative sheets):

| Scale | Size vs PNG |
|---|---|
| 1.0 | 30% |
| 0.75 | 23% |
| 0.5 | 13% |

**Estimated total download:**

| Content | 1.0 | 0.75 |
|---|---|---|
| All 450 MB PNG | about 135 MB | about 104 MB |
| Recommended subset (male + female avatars, 20 enemies, NPCs; about 310 MB PNG) | **about 95 MB** | about 70 MB |

**Recommendation:**

- Keep **1.0 scale** for the avatar and NPC sheets. Characters are about 120-130 px tall against 192x96 tiles, and downscaling would blur the thin weapon layers.
- Ship **WebP q85 at 1.0** for enemies, and also generate a **0.5 "low" tier** for low-VRAM and mobile devices (then halve the offsets and scale the sprite by 2).
- Convert wyvern_air_boss to 0.5 (3072² sheets) or drop it.
- Lazy-load per zone and per equipped layer. Destroy textures when leaving a zone.
- Drop female_dark unless we need it for skin variety; a tint on female covers most of it.
