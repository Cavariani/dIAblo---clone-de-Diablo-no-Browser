# Diablo mechanics research (D2 / D3 / D4) and what we take for Diablopus

Status: research reference, written 2026-09. Sources are listed at the end.
Confidence markers:
- **[v]** means the value was checked against a source during this research (maxroll, purediablo, tentonhammer, Arreat Summit and similar).
- **[~]** means the value comes from well-known community knowledge. It may vary by patch, so treat it as approximate.
- **[ours]** is a proposal for Diablopus.

The "Recommendations for Diablopus" section (section 12) turns this material into concrete tables. The engine and data teams should read that section first.

---

## 1. Item rarity tiers

### 1.1 Affix counts per rarity

| Game | Common / Normal | Magic | Rare | Legendary / Unique | Set |
|---|---|---|---|---|---|
| **D2** | 0 (can be Superior or Socketed; Low-Quality is grey) | **1 prefix and/or 1 suffix** (1–2 affixes) [v] | **2–6 affixes, max 3 prefixes + 3 suffixes** (jewels 4, charms n/a) [~] | Uniques: fixed mods with rolled ranges | Fixed mods plus partial-set bonuses (green) |
| **D3 RoS** | 0 (white). Grey = low quality | 1–2 affixes (blue) [~] | Up to **4 primary + 2 secondary = 6** at max level. Fewer at low ilvl [~] | **4 primary + 2 secondary** (armor) plus 1 legendary power. Weapons/jewelry vary [~] | Same as legendary, plus 2/4/6-piece bonuses |
| **D4 S4+ "Loot Reborn"** | 0 (white) | ~1–2 affixes [~] | **2 affixes** [v] | Legendary **3 affixes + 1 aspect**, Unique 3–4 + unique power [v]. **Greater Affix = ×1.5 value**, Ancestral only [v] | (removed. Added back later as set charms) |

D4 has one extra crafted slot, the **Tempered affix**: one per item on rare, legendary and unique items. There are 3 temper charges, or 7 if the item has 4 greater affixes [v].

### 1.2 Colors (hex)
These are the colors community tools use (the D3 wiki and d3planner templates).

| Rarity | D3 text hex | D2 | D4 (approx.) |
|---|---|---|---|
| Low quality / junk | `#9D9D9D` grey | `#696969` | – |
| Common | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| Magic | `#6969FF` | `#6969FF` / `#4850B8` | `#6E79FF` |
| Rare | `#FFFF00` | `#FFFF64` | `#FFFF00` |
| Legendary / Unique | `#BF642F` (tooltip orange; UI often `#FF8000`) | Unique gold `#C7B377` / `#908858` | Legendary `#F68014`, Unique gold `#C7B377` |
| Set | `#00FF00` | `#00C400` | – |
| Ancient / Primal marker | orange border / red border `#FF3C3C` | – | Mythic purple `#B37FEB` |

### 1.3 Naming rules
- **D2 rare items**: `<Prefix word> <Suffix word>`. The prefix list is shared by all items (Beast, Eagle, Raven, Viper, Ghoul, Bone, Blood, Doom, Grim, Storm, Wraith, Dread, Rune, Plague…). The suffix list depends on the item type: helms get Visage/Cowl/Mask/Casque/Crest, weapons get Bite/Scratch/Fang/Edge/Song, rings get Loop/Coil/Band/Spiral, amulets get Heart/Gorget/Collar/Talisman, and boots get Stalker/Trample/Track. Examples: "Grim Visage", "Doom Bite". [~]
- **D2 magic items**: `<prefix> <base> <suffix>`, for example "Cruel Long Sword of the Leech". The name comes straight from the affix names. [v]
- **D3 rares** use the same two-list idea: `<Adjective/Noun> <type-specific Noun>`, for example "Grim Mark" or "Storm Wrap". Magic items show prefix and suffix affix names. [~]
- **Legendary/set names** are hand-authored.

### 1.4 Item level vs required level
- **D2**: `ilvl = monster level` (or `clvl` for vendors). Each affix has an **alvl/qlvl**, and an affix can roll only if `alvl <= ilvl`. The required level is `max(base reqLvl, highest affix reqLvl)`, so strong affixes raise the required level. [v]
- **D3**: `ilvl` is the monster level. The required level is usually close to ilvl, and everything at max level is ilvl 70 / req 70. The number of affixes and their ranges grow with ilvl. [~]
- **D4**: *Item Power* replaces ilvl. There are thresholds (for example Sacred/Ancestral, and today 750/800 as the Ancestral cap). Affix values scale with item power. [~]

### 1.5 Ancient / Primal (D3) and Greater Affixes (D4)
- **Ancient** (D3): **10%** of legendary or set drops at level 70. Primary affix ranges are about **+30% higher**, and weapons get higher base damage. [v]
- **Primal Ancient**: unlocked after a **solo GR70** clear. **10% of ancients**, so about **1 in 400** of all legendaries (patch-dependent. Often quoted as 1/400 = 0.25%). Every affix rolls at its maximum value. [v]
- **D4 Greater Affix**: a single affix at ×1.5, drawn at 1–4 per ancestral item (4 GA items are called "mythic"-like). [v]

---

## 2. Affix catalogue

### 2.1 Structure
- **D2 prefix/suffix**: prefixes are mostly damage, defense and AR ("Cruel" = +ED%, "Sturdy"). Suffixes are mostly utility ("of the Leech" = life leech, "of Speed" = run/walk, "of the Whale" = life). Each affix belongs to a **group**, and two affixes from the same group cannot appear together. [v]
- **D3 primary/secondary**: **Primary** affixes are power affixes (main stat, vitality, crit, attack speed, CDR, elemental %, life %, all resistance, armor). **Secondary** affixes are utility and flavor (single resistance, thorns, pickup radius, gold find, health-globe bonus, crowd control on hit, experience, reduced durability loss). On armor, rares roll up to 4 primary and 2 secondary. [~]
- **D4**: affixes are grouped by category (offensive, defensive, utility, mobility, resource), and each slot has a whitelist.

### 2.2 Reference values (D3 RoS at ilvl 70, approximate) and slots

| # | Affix | Kind | D3 L70 range [~] | Slots (D3 typical) | Scaling with ilvl |
|---|---|---|---|---|---|
| 1 | +Strength | primary stat | 626–750 (armor), 416–500 (small slots), ~1,200–1,400 (2H) | all | linear |
| 2 | +Dexterity | primary stat | same | all | linear |
| 3 | +Intelligence | primary stat | same | all | linear |
| 4 | +Vitality | primary stat | 626–750 | all | linear |
| 5 | +Armor (flat) | defensive | 397–595 | armor, shield | linear |
| 6 | +All Resistance | defensive | 91–100 | armor, jewelry | linear |
| 7 | +Single-element resist | secondary | 91–100 | armor, jewelry | linear |
| 8 | +Life % | defensive | 10–15% (armor/shield); amulet 14–18% | helm, chest, pants, shield, amulet | flat-ish |
| 9 | Life per second | defensive | ≈ 3.7k–5k | armor, jewelry | linear |
| 10 | Life per Hit | defensive | ≈ 18k–26k (× proc coefficient) | weapons, gloves, rings | linear |
| 11 | Life per Kill | defensive | ≈ several k | weapons, belts | linear |
| 12 | Life Steal (D2/early D3) | defensive | D2 3–8%, removed at D3 70 | weapons, rings | – |
| 13 | Crit Hit Chance | offensive | gloves/amulet 8–10%; helm/bracers/rings/quiver/source 4.5–6% | as listed | fixed range |
| 14 | Crit Hit Damage | offensive | gloves/rings 46–50%; amulet 51–100% | gloves, rings, amulet (weapon via gem) | fixed range |
| 15 | Attack Speed % | offensive | 5–7% | gloves, rings, amulet, weapons, quiver | fixed range |
| 16 | Cooldown Reduction % | utility | 5–8% (weapons up to 10%) | helm, shoulders, gloves, rings, amulet, weapons | fixed range |
| 17 | Resource Cost Reduction % | utility | 6–8% | shoulders, rings, amulet, weapons | fixed |
| 18 | Area Damage % | offensive | 20–24% (20% chance to splash 10 yd) | gloves, shoulders, rings, amulet | fixed |
| 19 | Elemental damage % (fire/cold/…) | offensive | 15–20% | bracers, amulet | fixed |
| 20 | Skill damage % (specific skill) | offensive | 10–15% | helm, shoulders, chest, pants, off-hand | fixed |
| 21 | Weapon +% damage | offensive | 6–10% | weapons | fixed |
| 22 | Weapon +min/+max damage | offensive | ~ +1.2k–1.5k avg | weapons, (rings/amulets small) | linear |
| 23 | +Damage vs Elites % | offensive | 5–8% | weapons (primary), gems | fixed |
| 24 | Reduced damage from elites % | defensive | 5–7% | armor | fixed |
| 25 | Reduced melee damage % | defensive | 7–10% | armor | fixed |
| 26 | Reduced ranged damage % | defensive | 7–10% | armor | fixed |
| 27 | Block chance % | defensive | +5–10% (shield base 10–20%) | shield | fixed |
| 28 | Thorns | defensive | linear, big numbers | armor | linear |
| 29 | Movement Speed % | utility | up to 12% on boots, 25% cap total | boots (D3), amulet (D4) | fixed |
| 30 | Max resource | resource | +X Fury/Mana/… | class items | fixed |
| 31 | Resource regen / on hit | resource | e.g. +X Mana/s, +X Fury on crit | class items, weapons | small linear |
| 32 | Gold Find % | secondary | up to ~25% | armor, jewelry | fixed |
| 33 | Magic Find % | secondary | (D2: up to ~50% per item) | armor, jewelry | fixed |
| 34 | Pickup radius | secondary | +1–2 yd | armor | fixed |
| 35 | Health-globe healing bonus | secondary | linear | armor, belts | linear |
| 36 | Experience per kill | secondary | linear | helm, jewelry | linear |
| 37 | Chance on hit to Chill/Stun/Blind/Freeze/Knockback | secondary | ~1.5–3% (× proc coefficient) | weapons, gloves | fixed |
| 38 | Crowd-control duration reduction % | defensive | up to ~30–40% | amulet, armor | fixed |
| 39 | Ignore durability loss / Indestructible | secondary | flag | any | – |
| 40 | Sockets | special | helm 1, chest 3, pants 2, weapon 1–2, amulet 1, rings 1 (leg. gems) | as listed | – |
| 41 | +Rank to skill (D4 "+X to Skill") | skill | +1–3 | helm, chest, amulet | fixed |
| 42 | Damage to Vulnerable / Crowd-controlled / Close / Distant (D4) | conditional | ~10–30% | gloves, weapon, amulet | fixed |

Scaling note: in D3 and D4, flat stats (main stat, life, armor, thorns, weapon damage) grow roughly linearly with ilvl, with a large jump at max level. Percentage stats (crit, IAS, CDR, elemental %) mostly have **the same range at every level** and just appear more often on higher-level items.

---

## 3. Legendary powers and sets

Short summaries of real items (D3 and D4), grouped by the **engine hook** each one needs. Numbers are marked [~].

### 3.1 On hit (proc chance × proc coefficient)
1. **Thunderfury** (D3 sword): chance on hit to blast the target with lightning for weapon damage to up to 3 extra targets, and slow them.
2. **Odyn Son** (D3 mace): 20–40% chance on hit to cast Chain Lightning.
3. **Rimeheart** (D3 sword): 10% chance on hit against **frozen** enemies to deal ~10,000% weapon damage as Cold. This is an on-hit proc with a target-state condition.
4. **Andariel's Visage** (D4 helm): chance on hit to trigger a poison nova, plus lifesteal.
5. **Obsidian Ring of the Zodiac** (D3): hitting with a resource-spending skill reduces one cooldown by 1 s.
6. **Frostburn** (D3 gloves): 34–45% chance for cold damage to Freeze.

### 3.2 On kill / on elite kill
7. **Mad Monarch's Scepter** (D3): after killing 10 enemies, the next attack releases a poison nova (~1,400% WD). This is a kill counter with a charged next attack.
8. **Oculus Ring** (D3): chance on kill to create a zone. Standing in it gives +70–85% damage. This is a kill that spawns a ground buff.
9. **Bane of the Powerful** (D3 legendary gem): +20% damage for 30 s after killing an elite. Each elite kill adds duration.
10. **Nemesis Bracers** (D3): using a shrine or pylon spawns an elite pack. This is an environment hook.

### 3.3 On crit / resource
11. **Kridershot** (D3 bow): Elemental Arrow generates +X Hatred. The skill becomes a resource generator.
12. **Ring of Starless Skies** (D4 unique): each Core skill cast reduces the next Core cost by 5–10% and adds damage (stacks 4). This is a cast-sequence modifier.
13. **Tibault's Will** (D4 pants): +20–40 primary resource when Unstoppable ends.

### 3.4 Skill modifiers (numbers, extra casts, extra projectiles)
14. **Wand of Woh** (D3): Explosive Blast casts **3 additional times**.
15. **Holy Point Shot** (D3 DH): Impale throws **2 additional knives**.
16. **Gloves of the Illuminator** (D4 sorc): Fireball **bounces** as it travels.
17. **Yang's Recurve** (D3 bow): Multishot attacks 50% faster.
18. **Nilfur's Boast** (D3 boots): Meteor +100% damage, and +200–275% more when it hits ≤3 enemies. This is a conditional multiplier based on targets hit.
19. **Black River** (D4 necro scythe): Corpse Explosion consumes up to 4 additional corpses, with damage scaled per corpse.
20. **Hellcat Waistguard** (D3 belt): grenades bounce up to 5 times, and the final bounce explodes for more damage.

### 3.5 Periodic / aura / rotation
21. **Convention of Elements** (D3 ring): cycles through your elements every **4 s**, giving +150–200% damage for the active element. This needs a global timer.
22. **Etched Sigil** (D3 source): while channeling, auto-casts a mapped skill every 1 s.
23. **Fire Walkers** (D3 boots): leaves a burning trail that deals 100% WD per second.
24. **Boots of Disregard** (D3): gain life regeneration for every second standing still (stacks 4). This is a stillness timer.

### 3.6 Defensive procs / conditional defense
25. **Aspect of the Protector** (D4): hitting an elite grants a barrier for 10 s (cooldown ~30 s).
26. **Aspect of Might** (D4): Basic skills give 20% damage reduction for a few seconds.
27. **Pox Faulds** (D3 pants): after taking poison damage for 12 s, erupt for 550% WD poison around you.
28. **Unity** (D3 ring): damage taken is split with a follower that wears Unity. Shows a damage-redirect hook.
29. **Harlequin Crest / "Shako"** (D4 and D3): D4 gives +ranks to all skills and ~10–20% damage reduction. D3 gives +stats and CDR. A pure stat stick.

### 3.7 Minions / summoner hooks (for our Essence class)
30. **Tasker and Theo** (D3 gloves): pets +40–50% attack speed.
31. **Krysbin's Sentence** (D3 necro): +100% damage to slowed enemies, and +250–300% to stunned or immobilized ones.
32. **Nayr's Black Death** (D3 necro): +100–150% damage for 15 s for each different poison skill used. This is a unique-skill counter.
33. **Aspect of Hardened Bones** (D4): skeleton minions gain ~% damage reduction.

### 3.8 Set bonus structure
D3 standard: **2 / 4 / 6 pieces**, and **Ring of Royal Grandeur** lowers the requirement by 1 (to a minimum of 2).
- **Immortal King's Call** (Barb, melee fury). 2: Call of the Ancients lasts until they die. 4: Wrath of the Berserker is extended and grants Fury. 6: huge damage multiplier (~×25–40 in later patches) while Ancients and Wrath are active.
- **Tal Rasha's Elements** (Wiz, elemental). 2: Meteor on elemental hit. 4: Arcane/Fire/Cold/Lightning damage each add a stacking resistance and damage buff. 6: +X% damage per element stack (4 stacks), stacks last 8 s.
- **Bones of Rathma** (Necro, summoner). 2: Army of the Dead per X corpses (reduced cooldown). 4: minions grant damage reduction. 6: minions deal ~×40 damage while Army is active. The engine needs minion aura counters.
- **Natalya's Vengeance** (DH, agile). 2: Rain of Vengeance cooldown reduced per hit. 4: Rain of Vengeance +100% damage. 6: Rain of Vengeance buffs all damage by a large % for 10 s. This is a "spend big skill, then burst window" pattern.
- **Firebird's Finery** (Wiz). 2: death is replaced by a rebirth (cheat death). 4: fire damage stacks Ignite. 6: stacked damage multiplier while moving or standing still.

The **6-piece bonus is normally a single very large multiplier** tied to one skill. That makes it the build-defining piece.

---

## 4. Elite affixes

### 4.1 D3 affixes, precise behavior (maxroll "Elite Affix Mechanics" [v])
| Affix | Behavior |
|---|---|
| **Arcane Enchanted** | Spawns a rotating arcane beam sentry. **2 s** delay after cast, lasts **10 s**, sweeps one full circle over a ~25-yd radius. High damage. Avoid it by moving. |
| **Avenger** (champion) | When a pack member dies, the survivors gain speed, damage and size. Damage taken also rises ~50% per stack. |
| **Desecrator** | Pool under the player, **6 yd** radius, 1 s arm delay, **damage doubles every 0.5 s** while you stand in it. Stepping out resets it. |
| **Electrified** | When hit, releases **4 bolts** that travel outward. |
| **Extra Health** | +X% HP (D3 was about +20%; D4 has "Juggernaut/Life-linked"). |
| **Fast** | +40% movement, +20% attack, +10% cast speed. |
| **Fire Chains** (champion) | Burning chains between pack members, **10 ticks/s**. Needs at least 2 living members. |
| **Frozen** | **6 orbs** per cast, explode after **4 s** within 15 yd, and **Freeze for 2.5 s**. |
| **Frozen Pulse** (rare) | Orb that follows you. Inert for 1.5 s, then pulses for 10 s over 15 yd, applying a 60% slow. |
| **Health Link** (champion) | Damage taken is **split evenly** among pack members within about a screen. |
| **Horde** (rare) | **Doubles the minion count**. |
| **Illusionist** | At ~95% HP the elite spawns illusory copies with **5% HP** that deal real damage. |
| **Jailer** | Roots the player in place for **2.5 s** (cage visual). |
| **Juggernaut** (rare, T-difficulties) | Immune to crowd control and takes 30% more damage. Pushes through. |
| **Knockback** | Knocks back ~30 yd, then **80% slow for 3 s**. |
| **Missile Dampening** (rare) | A bubble around the elite slows player projectiles by **90%**. |
| **Molten** | Fire trail: **5 yd**, lasts 5 s. On death, a **18-yd** explosion after a short delay. |
| **Mortar** | **3 mortars** per cast, 3 yd direct / 11.5 yd splash. Only fires at targets **≥25 yd** away. |
| **Nightmarish** | Chance on hit to **Fear** the player for 1 s. |
| **Orbiter** | Central orb (5 yd) with **5–9 orbiting orbs** (3 yd). Lasts 15 s. |
| **Plagued** | Poison pool, 10-yd radius. Also heals monsters inside it. |
| **Poison Enchanted** | 4 pools per cast in a cross pattern, 2 s trigger, lasts 6 s. |
| **Reflects Damage** | Periodically reflects a % of damage back to you for up to **15 s**. |
| **Shielding** | One pack member at a time becomes **immune for 5 s**. |
| **Teleporter** | Blinks to the player or away. |
| **Thunderstorm** | **5 lightning strikes** per cast, 12-yd impact area. |
| **Vortex** | **Pulls** the player (within 50 yd) to the monster. |
| **Waller** | Creates **one straight wall** (champion) or **3-sided box** (rare). Lasts 6 s. |
| **Wormhole** (rare) | Two 6-yd circles. Standing in one teleports you to the other after 1 s. |

### 4.2 D4 additions (maxroll D4 elite page [v])
- **Suppressor**: a bubble that blocks ranged attacks from outside it. You must go in.
- **Hellbound**: a stone statue that chains players inside its radius (6 s, CD 15 s).
- **Shadow Enchanted**: a shadow clone that attacks once (4 s).
- **Explosive**: fire orbs that explode after 5 s (CD 15 s).
- **Electrified Obelisks**: pillars that chain lightning (6 s, CD 12 s).
- **Shock Lance**: a rotating beam around an orb (15 s, CD 5 s).
- **Teleporter** (D4): 0.33 s cue before teleporting to you (CD 8 s).
- **Summoner**: up to 6 minions, 3 s spawn, CD 20 s.
- **Unstoppable**: CC immune for a period.
- **Death's Grasp, Earthquake, Saw Blades, Splitter, Vengeance, Martyrdom, Soul Drinker, Gilded** (drops gold).

D4 elites carry **2–4 affixes**.

### 4.3 Composition, affix count, naming
- **D3 champion pack**: **3–5 blue champions** of the same monster type. They share **identical** affixes and the name tag "Champion".
- **D3 rare pack**: **1 yellow Rare** with a generated name plus **2–4 minions** (Horde doubles the minions). Minions get a subset of the affixes.
- **D3 affix count by monster level** (maxroll [v]): lvl 1–29 → 1 affix. 30–49 → 2. 50–59 → 3. 60+ → 4. Rares usually get 1 more than champions at the same level.
- **D2 champions** come in groups of 2–4 (Champion / Fanatic / Berserker / Ghostly). **D2 uniques** have 1–3 random mods (Extra Strong, Extra Fast, Cursed, Magic Resistant, Fire/Cold/Lightning Enchanted, Mana Burn, Spectral Hit, Stone Skin, Multiple Shots, Aura Enchanted, Teleportation, Conviction). [~]
- **Exclusivity rules** (D3): Illusionist and Horde do not combine with some affixes. At most 1 "control" affix (Jailer, Vortex, Knockback, Waller, Nightmarish) on lower difficulties. Some combinations are blocked (Molten + Desecrator, and so on). [v / ~]
- **HP multipliers** (approx., not published by Blizzard): champions about ×2.5–3.5 of a normal, rares about ×4–5, minions about ×1.5–2. D2 champions give ~3× XP and D2 uniques give ~5× XP. [~]
- **Loot bonus**: D3 elites are guaranteed extra drops. A rare pack usually drops ≥1 rare, and elites always drop health globes. D3 elites also dropped the legendary-craft material **Death's Breath**. [~]
- **Name generation**: the D2 rare/unique monster formula is `[Prefix][suffix] the [Appellation]`. For example "Gloomrot the Unclean", "Bonerend the Hungry", "Stormskull the Cold". Prefix list: Gloom, Gray, Dire, Black, Shadow, Haze, Wind, Storm, Night, Moon, Pit, Fire, Cold, Ash, Blade, Steel, Stone, Rust, Mold, Blight, Plague, Rot, Bile, Blood, Gut, Gore, Flesh, Bone, Spine, Mind, Spirit, Soul, Wrath, Grief, Foul, Vile, Sin, Chaos, Dread, Doom, Bane, Death, Viper, Dragon, Devil. Suffix list: touch, spell, feast, wound, grin, maim, hack, bite, rend, burn, rip, kill, call, vex, web, shield, razor, drinker, shifter, crawler, dancer, weaver, eater, widow, maggot, spawn, wight, growler, snarl, wolf, crow, raven, hawk, cloud, head, skull, eye, maw, tongue, fang, horn, thorn, claw, fist, heart, skin, wing, pox, fester, blister, slime, sludge, venom, shard, flame, maul, thirst, lust. Appellations: the Hungry, the Unclean, the Wight, the Slasher, the Cold, the Hammer, the Destroyer, the Butcher, the Tainted, the Grim, the Mad, the Fearless… D3 uses the same two-list style ("Gutspike the Unclean"). [~]

---

## 5. Difficulty tables

### 5.1 D3 RoS difficulties [v tentonhammer / purediablo / maxroll]
| Difficulty | Monster HP | Monster dmg | XP bonus | Gold bonus | Legendary drop bonus [~] |
|---|---|---|---|---|---|
| Normal | 100% | 100% | 0 | 0 | 0 |
| Hard | 200% | 130% | +75% | +75% | 0 |
| Expert | 320% | 189% | +100% | +100% | 0 |
| Master | 512% | 273% | +200% | +200% | 0 |
| Torment I | 819% | 396% | +300% | +300% | +15% |
| Torment II | 1,311% | 575% | +400% | +400% | +32% |
| Torment III | 2,097% | 833% | +550% | +550% | +52% |
| Torment IV | 3,355% | 1,208% | +800% | +800% | +75% |
| Torment V | 5,369% | 1,752% | +1,150% | +1,150% | +101% |
| Torment VI | 8,590% | 2,540% | +1,600% | +1,600% | +131% |
| Torment VII | 18,985% | 3,604% | +1,900% | +1,700% | +164% |
| … T13 | – | – | – | – | **+625%** (+461% inside NR) [v] |
| … T16 | ≈ GR75 | – | – | – | ≈ +1,221% [~] |

Rule of thumb [v]: each step adds **+60% HP and +45% damage** over the previous one (Hard is the exception at +100% / +30%). Torment I+ adds torment-only legendaries and sets plus bonus crafting materials.

### 5.2 D4 world tiers / difficulties
- **Legacy world tiers (S0–S5)**: WT1 base. WT2 +50% XP, +20% gold. WT3 "Nightmare" +150% XP, Sacred items. WT4 "Torment" +250% XP, Ancestral items. [v purediablo]
- **S6+**: Normal / Hard / Expert / Penitent, then **Torment I–IV**. Each Torment step gives the player **−250 Armor and −25% all resistance** (T4 = −1,000 / −100%) [v]. Torment tiers are unlocked by clearing **Pit** tiers.
- **Later seasons**: Torment I–XII. Kill XP +300% (T1) up to +1,400% (T12), gold +100% up to +300%. Unlocked by Pit tier 10 → 100 [v maxroll]. Each tier also raises the drop rate of a specific material.

---

## 6. Rifts / Greater Rifts / Pit

### D3 Nephalem Rift (NR)
- Randomized multi-floor dungeon with a random tileset and monster mix. There is **no timer**.
- The progress bar fills with kills. **Progress orbs** drop from elites (**3–4 per pack**, a 5th with a seasonal buff). Each orb is worth about **1%** [v]. Trash is worth fractions of a percent, and big monsters are worth more.
- At 100% the **Rift Guardian** spawns. The NR guardian drops extra legendaries and **one Greater Rift Key**.
- NRs have a bonus legendary rate (T13: +461% in NR vs +625% outside [v]).

### D3 Greater Rift (GR)
- Needs a **GR key** (1 per attempt, dropped by NR guardians) [v].
- **15-minute timer**. The guardian still spawns after the timer runs out, but loot and upgrades are reduced [v].
- The GR guardian teleports to the player if the player kites 2–3 screens away [v].
- **Scaling per level** [v maxroll]:
  - HP ×1.17 per level.
  - Damage ×1.13185 per level (GR1–25), ×1.07177 (26–70), ×1.02337 (71–150).
  - XP ×1.08 per level (26–70) and ×1.05 (71–150).
  - Gold +1.03% per level.
- **Rough equivalents**: GR10 ≈ T1, GR25 ≈ T6, GR45 ≈ T10, GR75 ≈ T16.
- **Rewards**:
  - Guardian loot: 1–2 legendaries at GR1, 3–6 at high GR.
  - **3 legendary-gem upgrade attempts**, +1 for no deaths, +1 if empowered.
  - Upgrade chance by `GRlevel − gemRank`: ≥10 → 100%, 9 → 90%, 1–8 → 60%, then falling to 0% at −16 [v].
  - **Blood Shards = 127 + 3×GR** (cap 500 + 10 per highest solo GR) [v].
  - The next GR level is unlocked based on time left.

### D4 Pit of the Artificers / Nightmare Dungeons
- **Pit**: timer **15 min** [v]. Deaths add **+30 s, then +60 s, then +90 s each** [v]. A boss kill with 4–6 min left unlocks +3 tiers, and 6+ min left unlocks +5 tiers [v]. Rewards are **3 glyph upgrade attempts, +1 for no death** [v]. There are 150 tiers.
- **Nightmare Dungeons**: a consumable **Sigil** with random affixes (bad ones such as more elites, lightning storms, or −resist, and good ones with more rewards). Rewards are glyph XP and masterwork materials.

---

## 7. Paragon (D3) [v maxroll]
- **Earning points**: 1 point per paragon level. Points cycle **Core → Offense → Defense → Utility** (after the first cycle). The cap is 20,000 paragon levels, and Core scales without limit.
- **Core**:
  - Main stat **+5** per point (no cap).
  - Vitality **+5** (no cap).
  - Movement speed **+0.5%** (50 points = +25%).
  - Max primary resource (class-dependent, 50 points).
- **Offense** (all capped at 50 points):
  - Attack speed **+0.2%** (10% max).
  - CDR **+0.2%** (10%).
  - Crit chance **+0.1%** (5%).
  - Crit damage **+1%** (50%).
- **Defense** (50 each):
  - Life **+0.5%** (25%).
  - Armor **+0.5%** (25%).
  - All resist **+5** (250).
  - Life regen **+214.6/s**.
- **Utility** (50 each):
  - Area damage **+1%** (50%).
  - Resource cost reduction **+0.2%** (10%).
  - Life on hit **+82.5**.
  - Pickup radius **+0.1 yd**.
- **XP per paragon level**: rises steadily. It is roughly linear up to about P800, then grows faster. The full table is in maxroll's linked sheet. [~]
- **D4 Paragon** is a board of tiles: normal tiles give +5 stat, magic tiles +% stat, rare tiles add a bonus once a threshold is met, plus legendary nodes and glyph sockets. Each level after 50/60 gives +1 point (4 per level in earlier seasons).

---

## 8. Formulas

### 8.1 D3 damage
```
hit = WeaponDamageRoll                      // uniform [min,max] of main-hand incl. +min/+max affixes
    × SkillCoefficient                      // e.g. 1.55 = "155% weapon damage"
    × (1 + MainStat / 100)                  // 1 Str/Dex/Int = +1% for that class
    × (1 + ΣAdditiveDamage%)                // "+damage%" bucket (paragon, some passives)
    × (1 + Elemental%)                      // e.g. +20% fire
    × (1 + Skill%)                          // "+15% Meteor damage"
    × (isCrit ? (1 + CritDamage) : 1)       // base CHC 5%, base CHD 50%
    × (target is elite ? 1 + Elite% : 1)
    × Π(legendary / set / gem multipliers)  // each is a separate multiplier
    × (1 − targetDamageReduction)
Sheet DPS = avgWeaponDmg × APS × (1+Main/100) × (1 + CHC×CHD) × (1+ΣAdditive)
APS       = weaponBaseAPS × (1 + ΣIAS%)
Area Damage: 20% chance per hit to deal AreaDamage% × hit to every other enemy within 10 yd.
```
- **CDR and Resource Cost Reduction stack multiplicatively**: `final = Π(1 − cdr_i)`. Two 10% sources give 19%, not 20%. [v maxroll CDR page]
- **Proc coefficient** is a per-skill multiplier (0.1–1.0) applied to "chance on hit" and Life-on-hit.

### 8.2 D3 damage reduction [v maxroll]
- **Armor**: `DR = Armor / (Armor + 50 × attackerLevel)`. The constant is 3,500 at level 70.
- **Resistance**: `DR = Res / (Res + 5 × attackerLevel)`. The constant is 350 at level 70.
- **All DR sources multiply**: `taken = dmg × Π(1 − DR_i)`. Block (a flat amount) is applied after the percentage reductions.
- **Melee classes** (Barb, Monk, Crusader) have an innate **30% DR** [~]. In RoS, Strength also grants armor (+1 per point) and Intelligence grants resist (+0.1 per point). [~]

### 8.3 D3 life [v]
- **Life per Vitality**:
  - Levels 1–35: 10.
  - Levels 36–60: +1 per level, reaching **35 at lvl 60**.
  - Levels 61–65: +4 per level (55).
  - Levels 66–70: +5 per level (**100 at lvl 70**).
- Base life is about `36 + 4 × level + Vit × LifePerVit`, then multiplied by `(1 + Life%)`. [~]

### 8.4 Crit, speed and the D4 "damage buckets"
- **Base crit**: CHC 5%, CHD 50% (D3 and D4).
- **D4 buckets**:
  - The additive `[+X%]` bucket.
  - `×` multipliers from aspects and paragon glyphs.
  - **Vulnerable**: ×1.2 base, plus an additive "damage to vulnerable" bonus.
  - **Overpower**: 3% base chance, ×1.5 base, adds your current Life + Fortify to the hit, and cannot crit (older rule).
  - **Critical**: ×1.5 base.
  - The main stat gives about +0.1% damage per point.

### 8.5 XP curve and monster XP
- **D2 total XP by level** [v Arreat Summit]:

  | Level | 2 | 3 | 5 | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 99 |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Total XP | 500 | 1,500 | 7,875 | 57,715 | 537,513 | 4,663,553 | 17,270,791 | 47,116,709 | 117,772,849 | 285,041,630 | 681,027,665 | 1,618,470,619 | 3,520,485,254 |

  The curve is roughly exponential after about level 30.
- **D3**: level 1→2 takes 280 XP and 2→3 takes 2,700 [~]. The curve is steep early and roughly polynomial afterwards, and 1–70 takes a few hours with seasonal buffs.
- **D3 level-difference XP multiplier** (vanilla) [v]:

  | Monster level vs yours | +3 or more | +2 | +1 | 0 | −1 | −2 | −3 | −4 | −5 | ≤ −6 |
  |---|---|---|---|---|---|---|---|---|---|---|
  | XP multiplier | 125% | 120% | 115% | 100% | 90% | 80% | 70% | 60% | 45% | ≤30% (+XP gear disabled) |

- **D2**: XP is split across the party and scales with monster level. At high levels there is a penalty against low-level monsters. You also lose XP on death in NM/Hell (5% / 10% of the current level's XP).

---

## 9. Drops

- **D2 Treasure Classes (TC)**: each monster has a TC with a number of **picks** and a **NoDrop** weight (lowered by players in the game). Item bases are bucketed into TCs by level, in steps of 3 up to TC87. A drop is first rolled as Unique → Set → Rare → Magic → Superior/Normal quality, with each check affected by MF.
- **D2 MF diminishing returns** [v]:
  - Unique: `eff = MF×250/(MF+250)`.
  - Set: `eff = MF×500/(MF+500)`.
  - Rare: `eff = MF×600/(MF+600)`.
  - Magic: no diminishing returns.
  - Example: 500% MF gives about 166% effective unique find.
- **D3 legendary drops**:
  - Base rates per monster type were **never published**.
  - Torment gives a flat bonus (table 5.1) and rifts add more.
  - Smart loot is **~85%** (items for your class/main stat) and ~15% random [v].
  - Ancient 10%, primal 1/400 [v].
  - There is a hidden **bad-luck protection** that raises the legendary chance the longer you go without one (devs confirmed it in 2.0.1, no numbers) [~].
  - Bosses have first-kill guaranteed legendary drops per act boss [~].
- **Gold find / Magic Find** (D3): MF was removed as a primary stat in RoS. Difficulty became the MF equivalent. Gold find stays as a secondary affix.
- **D3 Blood Shards and Kadala (gambling)** [~]:
  - Armor slots, quiver, orb and mojo cost 25.
  - Rings cost 50.
  - 1H and 2H weapons cost 75.
  - Amulets cost 100.
  - Kadala's legendary chance is about 8–10%.
  - The shard cap is `500 + 10 × highest solo GR`.
- **Potions and globes**:
  - D3 health potion heals **60% max life** on a **30 s cooldown** [~ RoS].
  - D3 health globes drop from elites (always) and randomly from trash. They heal a % of max life and share with the party. The health-globe affix adds a flat amount.
  - D4 potions have **charges** (4 base, upgradeable). Charges refill from potion drops in the world, and each potion is an instant ~35% heal. [~]
- **Treasure goblins** (D3) [v list]:
  - Regular: drops gold and items while fleeing.
  - Gem Hoarder: gems only, 20–25 on death.
  - Blood Thief: blood shards only.
  - Odious Collector: crafting materials and plans.
  - Gilded Baron: gold.
  - Rainbow: portal to a secret level.
  - Menagerist: pets and cosmetics.
  - Malevolent Tormentor: summons.
  - Goblins escape through a portal after ~20–30 s of fleeing, are not found in GRs, and appear in Adventure mode.
- **Cursed chests / cursed shrines** (D3 event): clicking one starts a **60 s** wave of monsters or elites. The reward chest scales with kills.
- **D3 shrines (2 min duration)** [~]:
  - Blessed: −25% damage taken.
  - Enlightened: **+25% XP** [v].
  - Fortune: +25% MF and GF.
  - Frenzied: +25% attack speed.
  - Fleeting: +25% move speed, +20 pickup.
  - Empowered: +100% resource regen and −50% cooldowns.
- **D3 pylons (rifts only, 30 s; Conduit 15 s in GR)** [v]:
  - Power: +300–400% damage.
  - Conduit: lightning zaps nearby enemies every tick.
  - Channeling: −75% cooldowns and no resource cost.
  - Shield: immune to damage.
  - Speed: +80% move speed, ignores the cap, walks through monsters.

---

## 10. Town / hub functions

- **Blacksmith** (D3):
  - **Salvages** items into materials: white → Reusable Parts, blue → Arcane Dust, yellow → Veiled Crystal, legendary → Forgotten Soul.
  - Crafts items from learned plans (random affixes, can reach rare or legendary).
  - **Repairs** durability. Durability drops by 10% on death and with use, and a broken item gives no stats.
- **Mystic / enchanting** (D3):
  - Pick **one** affix on an item and reroll it. After the first choice, **that is the only affix you can reroll** on that item (it is locked).
  - Each reroll shows **the current value + 2 new random options**, and you keep one.
  - The cost (gold + mats) **increases with every reroll** on that item.
  - Some affixes cannot be chosen (sockets on jewelry, legendary powers, and so on).
  - The Mystic also does transmogrification (cosmetic).
- **D4 Occultist**: similar enchanting, one affix, cost rises, also rolls aspects (Codex of Power).
- **D4 Blacksmith**:
  - **Tempering**: adds 1 tempered affix from a learned manual. The manual categories are Weapons, Offensive, Defensive, Utility, Mobility and Resource, each limited to certain slots. Each item has 3 reroll charges, restorable with a Scroll of Restoration [v].
  - **Masterworking**:
    - The **original (S4) model** had 12 ranks, each giving +5% to all affixes. Ranks **4, 8 and 12** instead gave **+25% to one random affix** (the "crit").
    - The **current model** has 25 quality ranks at +1% each and a **capstone +50% to a random affix** that can be rerolled for mats + gold.
    - Material cost formula: `floor(3.75 × rank + 10)` [v].
- **Jeweler** (D3):
  - Combines gems (3 → 1 of the next tier, a simplified ladder in RoS).
  - **Removes gems** (for gold).
  - Crafts jewelry.
  - Socket effects:
    - **Weapon**: Ruby = +flat damage, Emerald = +crit damage, Topaz = thorns, Amethyst = life on hit, Diamond = +damage to elites.
    - **Helm**: Ruby = +XP%, Emerald = +gold find, Topaz = MF / resource cost, Amethyst = +life%, Diamond = CDR.
    - **Armor**: Ruby = Str, Emerald = Dex, Topaz = Int, Amethyst = Vit, Diamond = all resist.
  - **Legendary gems** go in jewelry and are upgraded by GR clears.
- **Vendor**:
  - Sells white, blue and occasional yellow items plus potions and dyes.
  - D3 buy-back is available until the game ends.
  - Sell value is a small fraction (≈ 1/5–1/10) of the purchase price, scaled by ilvl and rarity. Legendaries sell for more but are better salvaged.
  - D2 prices depend on base cost plus affix cost modifiers and slot.
- **Stash**:
  - D3: tabs of **7×10 = 70 cells**, bought with gold. Items are 1×1 or 1×2.
  - D3 inventory: **10×6 = 60 cells**.
  - D2 stash: 6×8 (later 10×10 in D2R, plus shared tabs).
  - D4: stash tabs of 50 slots, inventory of 33 slots per category.
- **Waypoints**: one per zone. A waypoint is **discovered by walking near it** and is shared across the account/party. The waypoint map lists zones by act. Using a waypoint is instant (short channel), and you can use it from any waypoint to any discovered waypoint.
- **Town Portal**: a few-second channel, **interrupted by damage**. It opens a two-way portal (D2 scroll/tome; D3 skill) that stays until you step back through. It returns you to the same spot, and closes when you come back and walk away or leave the game.
- **Bounties / quests** (D3 Adventure): **5 bounties per act**. Completing all 5 gives a **Horadric Cache** (loot bag) and **rift key fragments**. Bounty types include kill a unique boss, clear a dungeon, events and cursed chests.

---

## 11. Game-feel notes
- **Potion cadence**: D3 uses a 30 s cooldown and a big heal (60%). This avoids potion spam, and **health globes** carry most of the healing in fights. D4 uses charges that refill from drops, which rewards aggression.
- **Health globes**: drop from elites (always) and ~% of trash kills. They are pulled in by the pickup radius, heal instantly, and give the player a reason to walk into packs.
- **Knockback / hit recovery**:
  - D2 players flinch when a single hit is ≥ 1/12 of max life. FHR breakpoints shorten the flinch.
  - D3 players never flinch, but monsters have hit-reaction animations. Big hits knock monsters back and briefly interrupt them.
  - Use knockback on trash and heavily reduce it on elites and bosses (Juggernaut = immune).
- **Density**: D3 rifts are dense. A screen holds about **10–30 monsters** during a "pull", with an elite pack every ~1–2 screens. Late-D3 design moved toward larger, denser packs so that AoE builds feel good.
- **Time to kill** at the intended difficulty [~]:
  - Trash: dies in 1–3 hits (<1 s).
  - Champion pack: ~5–10 s.
  - Rare pack: ~8–15 s.
  - Rift guardian: ~30–90 s.
  - A campaign act boss with phases: 1.5–4 min.
  - A D3 "speed" GR takes ~2–3 min and a "push" GR takes close to 15:00.

---

## 12. Recommendations for Diablopus  [ours]

### 12.1 Rarity table (drop-in for `data/items/rarities`)
| Rarity (pt-BR) | Key | Color | Affixes | Notes |
|---|---|---|---|---|
| Comum | `common` | `#E6E6E6` (grey `#9D9D9D` for "Gasto" junk) | 0 (implicit only) | Salvages into `sucata` |
| Mágico | `magic` | `#6D7BFF` | **1–2** (≤1 prefix + ≤1 suffix) | Name: `<prefix> <base> <suffix>` |
| Raro | `rare` | `#FFE14A` | **3–4** at ilvl 1–24, **4–5** at ilvl 25–50 (≤3 prefixes, ≤3 suffixes) | Generated name (12.3) |
| Lendário | `legendary` | `#FF8A1F` (beam/border `#BF642F`) | **4** + 1 legendary power | Power from 12.5 |
| Conjunto (set) | `set` | `#3BE36B` | **3–4** + set bonus (2/4/6) | 4 sets of 6 pieces (1 per class), 2/4/6 bonuses |
| (quality) Ancestral-like "**Venerável**" | flag on leg/set | orange border | affix ranges ×1.25 | **10%** of legendary/set drops from Tormento I+ |
| (quality) "**Primevo**" | flag | red border `#FF3C3C` | all affixes at max | **1/20 of Venerável** (0.5% of legs) from Tormento III+ |

Use prefix/suffix **internally** (D2 style): it drives magic names, and the "same group can't repeat" rule. Also tag each affix **primary/secondary** (D3 style), so the tooltip can sort the lines and so enchanting can exclude some affixes.

### 12.2 Item level and requirement
- `ilvl = monsterLevel`, where `monsterLevel = clamp(zoneLevel, playerLevel, zoneLevel + 3)`. Zones scale up to the player level. Pesadelo+ adds a floor of 50 so the endgame is always at level 50.
- `reqLevel = max(1, min(50, ilvl − 2 − floor(affixTierBonus)))`. Legendaries use `reqLevel = ilvl`.
- **Affix tiers**: each affix has **T1..T5** tiers, gated at `ilvl ≥ 1 / 10 / 20 / 35 / 48`. Tier ranges are defined below as a scaling rule.

### 12.3 Rare item name generation (pt-BR)
Format `<Substantivo por slot> <Genitivo>`. Keep the genitive in the form "de/do/da X" so the words never need gender agreement.
- **Slot nouns**:
  - Elmo: Visagem, Semblante, Coroa, Capuz, Elmo.
  - Arma: Presa, Mordida, Lâmina, Ferrão, Talho, Cutelo.
  - Arco: Arco, Sopro, Silvo, Voo.
  - Cajado/Orbe: Cetro, Foco, Olho, Estrela.
  - Peito: Couraça, Manto, Pele, Carapaça.
  - Luvas: Garra, Punho, Aperto, Mão.
  - Botas: Passada, Trilha, Rastro, Marcha.
  - Cinto: Cinta, Laço, Correia.
  - Anel: Elo, Espiral, Aro, Selo.
  - Amuleto: Coração, Talismã, Colar, Amuleto.
- **Genitives**:
  - do Corvo, da Víbora, do Carniçal, do Ossário, da Tormenta, da Ruína, do Sangue, da Cinza, do Crepúsculo, da Peste, do Abismo, da Forja, do Lobo, do Espectro, da Geada, do Trovão, da Brasa, do Eclipse, da Agonia, do Juramento.
  - Also: Sombrio/a (adjective, needs gender agreement; skip if it gets complex).

### 12.4 Affix catalogue for Diablopus (values at **ilvl 50**; scaling rules below)
Scaling types:
- **L** (linear): `v(ilvl) = v50 × (0.08 + 0.92 × ilvl/50)`.
- **P** (percent, mild): `v(ilvl) = v50 × (0.5 + 0.5 × ilvl/50)`.
- **F** (fixed range at every level).

Each roll is uniform inside the range. Venerável multiplies the range by ×1.25.

Slot codes: H helm, C chest, G gloves, P pants, B boots, W belt (waist), A amulet, R ring, M main hand, O off-hand (shield/quiver/orb/phylactery).

| id | pt-BR label | kind | ilvl-50 range | scale | slots |
|---|---|---|---|---|---|
| str | +Força | primary | 40–60 (M 2H: 80–110) | L | all |
| dex | +Destreza | primary | 40–60 | L | all |
| int | +Inteligência | primary | 40–60 | L | all |
| vit | +Vitalidade | primary | 40–60 | L | all |
| armor | +Armadura | primary | 150–250 | L | H C G P B W O |
| allRes | +Resistência a tudo | primary | 30–40 | L | H C P B W A R O |
| resFire / resCold / resLight / resPoison | +Resistência a Fogo/Gelo/Raio/Veneno | secondary | 40–55 | L | armor + jewelry |
| lifePct | +% Vida | primary | 8–12% (A 10–14%) | P | H C P O A |
| lifeFlat | +Vida | primary | 180–280 | L | all non-weapon |
| lifeRegen | Vida por segundo | primary | 20–35 | L | C P W A R |
| lifeOnHit | Vida por acerto | primary | 15–30 (× proc coef) | L | M G R |
| lifeOnKill | Vida por abate | secondary | 60–110 | L | M W |
| critChance | Chance de crítico | primary | G/A 6–8%; H/R/O 3–5% | F | G A H R O |
| critDmg | Dano crítico | primary | G/R 25–35%; A 40–60% | F | G R A |
| atkSpd | Velocidade de ataque | primary | 5–7% | F | G R A M O(quiver) |
| cdr | Redução de recarga | primary | 5–8% | F | H G R A M |
| costRed | Redução de custo de recurso | primary | 5–8% | F | R A M O |
| areaDmg | Dano em área | primary | 10–20% (20% chance, 3 tiles radius) | F | G R A |
| elemPct | +% Dano de Fogo/Gelo/Raio/Veneno/Físico | primary | 10–20% | F | A W O |
| skillPct | +% Dano de <habilidade> | primary | 10–15% | F | H C P O |
| wpnPct | +% Dano da arma | primary | 6–12% | F | M |
| wpnFlat | +X–Y Dano | primary | +(8–12)–(16–24) | L | M (small on R A) |
| eliteDmg | +% Dano contra elites | primary | 5–10% | F | M A |
| eliteDR | −% Dano de elites | primary | 4–7% | F | C P O |
| meleeDR | −% Dano corpo a corpo | secondary | 5–8% | F | C W O |
| rangedDR | −% Dano à distância | secondary | 5–8% | F | C W O |
| block | +% Chance de bloqueio | primary | 6–10% | F | O (shield only) |
| thorns | Espinhos | secondary | 60–120 | L | C P W |
| moveSpd | Velocidade de movimento | primary | 8–12% (cap 25% total) | F | B (A small 3–5%) |
| maxRes | +Recurso máximo (Fúria/Mana/Energia/Essência) | primary | 10–20 | F | class off-hands, H A |
| resRegen | Regeneração de recurso | primary | +8–15% | F | A R O |
| resOnCrit | +Recurso ao acertar crítico | secondary | 2–4 | F | M G |
| goldFind | +% Ouro encontrado | secondary | 10–25% | F | H W A R |
| magicFind | +% Achados mágicos | secondary | 5–15% (diminishing, see 12.9) | F | H A R |
| pickup | +Raio de coleta | secondary | +1–2 tiles | F | B W |
| globeHeal | +Cura por Orbe de Vida | secondary | 80–150 | L | C W A |
| xpKill | +XP por abate | secondary | 10–25 | L | H A R |
| ccOnHit | Chance de Congelar/Atordoar/Cegar/Retardar ao acertar | secondary | 2–4% (× proc coef) | F | M G |
| ccReduce | −% Duração de controle | secondary | 15–30% | F | A B |
| skillRank | +1 nível em <habilidade> | primary | 1 (2 on legendary) | F | H C A |
| vulnDmg | +% Dano contra inimigos controlados | primary | 10–20% | F | M G A |
| sockets | Engastes | special | H 1, C 1–3, P 1–2, M 1 (2H 2), A 1 | – | as listed |
| indestructible | Indestrutível | secondary | flag | – | any |

Rules:
- An item never rolls the same affix group twice.
- Weapons always roll `wpnPct` or `wpnFlat` as their first primary affix.
- Class main stats are **smart-weighted**: 85% of drops use the current class's main stat (see 12.9).

### 12.5 Legendary powers: engine hooks and 20 starter powers
The engine needs an **event bus** with these hooks. A legendary power is a data record `{ hook, condition?, chance?, icd?, effect, params }`.
- **Hooks**:
  - Hit events: `onHit(procCoef)`, `onCrit`, `onKill`, `onEliteKill`.
  - Skill events: `onSkillCast(skillId)`, `onResourceSpent(n)`.
  - Damage-taken events: `onDamaged`, `onLowLife(≤35%)`.
  - Timers: `onTick(1s)`, `onStandStill(ns)`, `onMoveDistance`.
  - Minion events: `onMinionSpawn`, `onMinionDeath`.
- **Modifier records**:
  - `skillModifier`: `+projectiles`, `+bounces`, `+pierce`, `radius×`, `duration×`, `cost×`, `cd×`, `convertElement`.
  - `statMultiplier`: a separate multiplicative bucket.
  - `conditionalMultiplier`: target frozen, controlled, elite, low life, distance, and so on.

| Class | pt-BR name (original) | Hook | Effect |
|---|---|---|---|
| Fúria | Braçadeiras do Trovão Rubro | onHit 15% (icd 1 s) | lightning chain, 150% WD, 3 targets |
| Fúria | Elmo do Carrasco | onKill | next attack +100% dmg (1 charge) |
| Fúria | Cinto do Terremoto | skillModifier(Salto) | landing creates a 3 s tremor zone (60% WD/s) |
| Fúria | Manoplas da Ira Antiga | onResourceSpent(100 Fúria) | −2 s on all cooldowns |
| Fúria | Placas do Juggernaut | onDamaged, icd 20 s | when hit below 35% life: barrier 30% max life, 4 s |
| Mana | Orbe da Convergência | onTick(4 s) | rotates Fogo→Gelo→Raio; +60% damage of active element |
| Mana | Luvas da Centelha Saltitante | skillModifier(Bola de Fogo) | +2 bounces, 70% damage per bounce |
| Mana | Cajado Estilhaça-Gelo | conditionalMultiplier(frozen) | +150% damage to frozen targets |
| Mana | Anel da Catarse | onCrit | refund 3 Mana (icd 0.2 s) |
| Mana | Botas da Chama Andarilha | onMoveDistance | burning trail, 40% WD/s |
| Energia | Arco da Chuva Tripla | skillModifier(Disparo Múltiplo) | +2 projectiles, +20% spread |
| Energia | Aljava Perfurante | skillModifier(Flecha) | pierce +3 |
| Energia | Botas da Evasão | onDamaged | 20% chance to dodge the next hit (icd 3 s) |
| Energia | Olho do Caçador | conditionalMultiplier(distance ≥ 6 tiles) | +40% damage |
| Energia | Colar da Emboscada | onEliteKill | 8 s: +30% attack speed |
| Essência | Filactéria do Enxame | onMinionSpawn | +2 extra skeletons for the same skill |
| Essência | Foice do Ossário | skillModifier(Explosão de Cadáver) | consumes +3 corpses, +50% per extra corpse |
| Essência | Coroa do Necrolorde | statMultiplier(minion) | minions +50% attack speed |
| Essência | Anel da Praga Múltipla | onSkillCast (distinct poison skill) | +40% dmg per distinct skill, 3 stacks, 10 s |
| Any | Pingente do Sino Fúnebre | onKill 10% | spawns an Orbe de Vida |

### 12.6 Sets: 1 per class, 6 pieces, bonuses 2/4/6
- **2 pieces**: a quality-of-life change or skill-flavor modifier. For example, Fúria gets "Grito de Guerra também concede 30% velocidade de movimento".
- **4 pieces**: a defensive or resource engine. For example, "+30% redução de dano enquanto Fúria ≥ 50%".
- **6 pieces**: **one big multiplier ×3–×5** tied to one signature skill. For example, "Redemoinho causa ×4 de dano e gera 5 Fúria por inimigo atingido".
- Add an "**Anel dos Laços Reais**"-style legendary ring that reduces set requirements by 1 (to a minimum of 2). This is optional, to be added later.

### 12.7 Difficulties (7 tiers)
Per step: about ×1.7 HP and ×1.45 damage (D3 uses ×1.6/×1.45). Normal to Pesadelo is ×2.0 / ×1.4.

| # | Tier | Monster HP × | Monster dmg × | XP bonus | Gold bonus | Legendary drop bonus | Elite affixes (champion/rare) | Player resist penalty | Unlock |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Normal | 1.00 | 1.00 | +0% | +0% | +0% | 1/1 (lvl <15), 1/2 (15–29), 2/3 (30+) | 0 | start |
| 1 | Pesadelo | 2.00 | 1.40 | +50% | +50% | +20% | 2/3 | −10 | start (optional), or after Act I boss |
| 2 | Tormento I | 3.40 | 2.03 | +100% | +100% | +50% | 2/3 | −20 | level 50, or clear the final boss on Pesadelo |
| 3 | Tormento II | 5.78 | 2.94 | +150% | +150% | +90% | 3/4 | −30 | timed rift at T-I in < 8:00 |
| 4 | Tormento III | 9.83 | 4.27 | +225% | +200% | +140% | 3/4 | −40 | timed rift at T-II in < 8:00 |
| 5 | Tormento IV | 16.7 | 6.19 | +325% | +250% | +200% | 4/4 | −50 | timed rift at T-III |
| 6 | Tormento V | 28.4 | 8.97 | +450% | +300% | +275% | 4/5 | −60 | timed rift at T-IV |

Additional rules:
- Tormento I+ enables Venerável (10%). Tormento III+ enables Primevo.
- Set items drop only on Pesadelo+ (smart-loot 85%).

**Base monster curve** (before tier and elite multipliers; normal, "standard" monster size):
- `hp(L) = 30 × 1.10^(L−1)`, which gives L1 30, L10 71, L20 183, L30 476, L40 1,234, L50 3,202.
- `dmg(L) = 6 × 1.085^(L−1)`, which gives L1 6, L10 13, L20 28, L30 64, L40 145, L50 327.

These are starting points. Tune them so that trash dies in 1–3 hits with level-appropriate gear on Normal.

**Monster size classes**: `small ×0.5 HP, 0.5 XP` / `standard ×1` / `large ×2.5 HP, 2.5 XP` / `elite unit` (see 12.8).

### 12.8 Elites: composition, multipliers and name generation
- **Champion pack** ("Campeões", blue `#6D7BFF` name plate):
  - 3–4 champions of one monster type, sharing **identical** affixes.
  - **HP ×3.0, dmg ×1.3, XP ×4** each.
  - Drops: 1 guaranteed magic+ item per champion (35% rare), plus 1 Orbe de Vida each.
- **Rare pack** (yellow `#FFE14A`, generated name):
  - 1 rare plus 3 minions ("Lacaios"). Horde makes it 6.
  - Rare: **HP ×5.0, dmg ×1.5, XP ×7**. Minions: HP ×1.8, XP ×2.
  - Minions inherit only the **defensive/passive** affixes (Veloz, Vida Extra, Blindado).
  - Drops: 1 guaranteed rare, plus 1 extra magic+ item, and a legendary chance (see 12.9).
- **Pack frequency**: 1 elite pack per ~12–15 normal monsters in rifts. Open zones have fewer.
- **Affix pool** (original names). Mechanics are adapted from D3. Values are given at "tier" difficulty and scale with monster damage.

  | pt-BR | Source mechanic | Params |
  |---|---|---|
  | Arcano Encantado | rotating beam sentry | 2 s arm, 8 s spin, 360° over 6 tiles |
  | Profanador | ground pool under player | radius 1.5 tiles, 1 s arm, dmg ×2 every 0.5 s while inside |
  | Eletrificado | bolts when hit | 4 bolts, icd 0.8 s |
  | Vida Extra | – | HP ×1.3 |
  | Veloz | – | +40% move, +20% attack |
  | Correntes Ígneas | chains between members (champion only) | 10 ticks/s, needs ≥2 alive |
  | Congelante | orbs that freeze | 4 orbs, 3 s fuse, 2 tiles radius, freeze 1.5 s |
  | Horda | rare only | minions ×2 |
  | Ilusionista | clones at 90% HP | 3 clones, 5% HP, real damage ×0.5 |
  | Carcereiro | root | 2 s, icd 8 s |
  | Repulsão | knockback | 3 tiles, then slow 60% 2 s |
  | Derretido | fire trail + death explosion | trail 4 s; death blast after 1.5 s, radius 4 tiles |
  | Morteiro | lobbed bombs | 3 bombs, targets ≥ 5 tiles away, 1 tile impact |
  | Pesadelo (medo) | fear on hit | 8% chance, 1 s |
  | Pestilento | poison pool that heals monsters | radius 2.5 tiles, 6 s |
  | Refletor | reflects damage | 15% for 4 s, icd 10 s |
  | Blindado | one member immune | 4 s rotating |
  | Teleportador | blinks to player | icd 6 s, 0.3 s telegraph |
  | Tempestade | lightning strikes | 5 strikes, 0.8 s telegraph, 1.2 tiles |
  | Vínculo Vital | damage split (champion only) | shared HP pool |
  | Vampírico | heals on hit | 20% of damage dealt |
  | Vórtice | pull to monster | range 8 tiles, icd 10 s |
  | Muralista | temporary walls | line (champion) / U-box (rare), 5 s |
  | Colosso | CC immune, +20% damage taken | rare only, Tormento II+ |
  | Supressor | anti-ranged bubble | projectiles from outside are destroyed; radius 3 tiles |

- **Exclusivity**:
  - Max **1 control affix** (Carcereiro, Vórtice, Repulsão, Muralista, Pesadelo) per pack below Tormento III, and max 2 at Tormento III or higher.
  - Profanador and Derretido are exclusive.
  - Horda is rare-only, and Correntes Ígneas / Vínculo Vital are champion-only.
- **Rare monster name** = `<Prefixo><sufixo>, <o|a> <Alcunha(m|f)>`. The monster definition needs a `gender` field.
  - **Prefixos**: Sombra, Cinza, Osso, Sangue, Peste, Ruína, Brasa, Geada, Trevas, Carne, Pó, Ferrugem, Tumba, Lodo, Fel, Agouro, Breu, Espinho, Uivo, Fenda.
  - **Sufixos** (join directly, lowercase): -rasga, -mordida, -garra, -chaga, -dente, -fúria, -olho, -presa, -ruído, -punho, -ferrão, -berro, -lamento, -podre, -fome, -gume, -marca, -pele, -cova, -sopro.
  - **Alcunhas**: Faminto/Faminta, Impuro/Impura, Cruel, Insaciável, Profanado/Profanada, Esquecido/Esquecida, Flagelo (inv.), Açougueiro/Açougueira, Pálido/Pálida, Uivante, Carniceiro/Carniceira, Terrível, Maldito/Maldita, Silencioso/Silenciosa, Voraz.
  - **Examples**: "Cinzarasga, o Voraz", "Pestechaga, a Maldita", "Ossogume, o Esquecido".
  - Reject a name if it is longer than 22 characters or if the generated compound is in a blocklist.

### 12.9 Drops
Chances per kill, before bonuses:

| Source | Any item | Magic+ | Rare+ | Legendary/Set | Gold | Orbe de Vida | Potion |
|---|---|---|---|---|---|---|---|
| Normal monster | 12% | 30% of items | 6% of items | **0.10%** | 25% | 4% | 3% |
| Champion (each) | 100% | 100% | 35% | **1.5%** | 100% | 100% | 10% |
| Rare | 100% ×2 | 100% | 100% (1) | **4%** | 100% | 100% | 20% |
| Minion | 20% | 40% | 10% | 0.3% | 40% | 20% | 3% |
| Act boss | 4–6 items | – | ≥2 rares | **first kill 100%**, then 25% | big | – | – |
| Rift Guardian | 4–6 items | – | ≥2 rares | **1 guaranteed**, then 30% for a 2nd | big | – | – |
| Treasure "Diabrete" | 6–10 items + gold burst | – | ≥1 | 10% | huge | – | – |

- **Final legendary chance** = `base × (1 + tierBonus) × (1 + riftBonus 0.5) × badLuck`, where `badLuck = 1 + 0.25 × floor(minutesWithoutLegendary / 5)` (cap ×3).
- **Magic Find**: `effMF = MF × 200 / (MF + 200)`. It applies to Rare+ and Legendary chances. Gold Find is linear.
- **Smart loot**: 85% of items pick the current class's main stat and class-specific bases, and 15% are random.
- **Special currency "Estilhaços Carmesins"** (Blood-Shard-like):
  - Rift Guardian gives 20 + 5×tier, champions 1 each, rares 2.
  - Cap: 500.
  - Spent at the **Apostador** (gambler): armor slots 25, rings 50, weapons 75, amulets 100.
  - Gamble outcome: 10% legendary, 25% rare, 65% magic.
- **Potions**: one "Poção de Vida" button with **3 charges**, each healing **45% of max life** over 0.5 s, with **2 s internal cooldown**. Charges refill at 1 per 40 s and from **Poção** drops. This is a D4-style design, tuned for a browser game where players get hit more.
- **Orbe de Vida**: heals **20% max life + globeHeal**, pickup radius 1.5 tiles (+pickup affix). Elites always drop one.
- **Altares (shrines, 90 s)**:
  - Bênção: −25% damage taken.
  - Sabedoria: +25% XP.
  - Fortuna: +25% MF/GF.
  - Frenesi: +25% attack speed.
  - Ímpeto: +25% movement speed.
  - Poder: +50% resource regen, −30% cooldowns.
- **Pilares (rift-only, 20 s)**:
  - Potência: +200% damage.
  - Condutor: lightning zaps within 5 tiles.
  - Canalização: no resource cost, −75% cooldowns.
  - Égide: immune.
  - Célere: +60% movement speed, pass through monsters.
- **Baú Amaldiçoado**: a 45 s wave event. The reward is `1 item per 10 kills` (max 6).

### 12.10 Rifts ("Fendas")
- **Fenda comum** (normal rift): no timer. Opened with a **Pedra de Fenda** (sold in town for gold, or dropped).
- **Fenda Cronometrada** (timed rift):
  - Needs a **Selo de Fenda** (dropped by the Fenda comum guardian).
  - Timer **10:00** (our maps are smaller than D3's; configurable up to 15:00).
  - Level = tier selector (Tormento I–V × sub-level 1–10 optional later).
- **Progress bar to 100%**:
  - Normal monster: `small 0.25% / standard 0.5% / large 1.25%`.
  - Champion: 2% each.
  - Rare: 4%.
  - Minion: 0.5%.
  - **Orbe de Progresso** drops **3 per elite pack**, **1.5%** each.
  - Target: about **55–70% from trash and 30–45% from elites** (≈ 6–8 elite packs per rift).
- **Guardião da Fenda**:
  - Spawns at 100% at the player's position (≥ 8 tiles away), picked from a pool of 6 guardian templates.
  - HP = `rare HP × 12`. It must **teleport to the player** if the player is more than 20 tiles away.
  - It has 2 phases (at 50%, it adds a summon or arena effect).
- **Rewards**:
  - Guardian: 1 guaranteed legendary, 20+5×tier Estilhaços, plus a 25% chance of an extra Selo.
  - Timed rift in time: **+1 Selo, 3 "Aprimoramento" attempts**, +1 if no deaths. The attempts upgrade legendary-gem-like "Joias Ancestrais", or unlock the next tier.
  - Deaths add **+10 s** to the timer instead of D4's +30/60/90 (our timer is shorter).

### 12.11 Paragon (after level 50)
- 1 point per paragon level, cycling **Núcleo → Ataque → Defesa → Utilidade**. Per-category caps are 50 points, except the main stat and Vitalidade (no cap).
- **Núcleo**: Atributo principal +2/pt (∞), Vitalidade +2/pt (∞), Vel. movimento +0.5% (cap 10 pts = 5%), Recurso máximo +1 (cap 20).
- **Ataque**: Vel. ataque +0.2% (50), Redução de recarga +0.2% (50), Chance crítica +0.1% (50), Dano crítico +1% (50).
- **Defesa**: Vida +0.5% (50), Armadura +0.5% (50), Resistência a tudo +1 (50), Vida/s +2 (50).
- **Utilidade**: Dano em área +1% (50), Redução de custo +0.2% (50), Vida por acerto +1 (50), Raio de coleta +0.05 tile (20).
- **XP per paragon level**: `P(n) = round(xpToNext(49) × (1 + 0.02 × (n−1)), −2)`. This gives P1 ≈ 119,700, P10 ≈ 141,200, P50 ≈ 236,900, P100 ≈ 356,600, P200 ≈ 595,900. The sum of P1–P100 is ≈ 23.8 M. There is no hard cap (the practical cap is 800 points for the UI).

### 12.12 Formulas for Diablopus
```
hit = roll(wpnMin, wpnMax)
    × skillCoef
    × (1 + mainStat/100)
    × (1 + Σadditive%)          // paragon, generic "+dmg%"
    × (1 + elem%)               // element of the skill
    × (1 + skill%)              // "+% Dano de <skill>"
    × (crit ? 1 + critDmg : 1)  // base critChance 5%, critDmg 50%
    × (elite ? 1 + eliteDmg : 1)
    × (controlled ? 1 + vulnDmg : 1)
    × Π(legendary/set multipliers)
    × (1 − targetDR)
playerArmorDR = armor / (armor + 50 × attackerLevel)   // cap 75%;  L50 constant = 2,500
playerResDR   = res   / (res   + 5  × attackerLevel)   // cap 75%;  L50 constant = 250
damageTaken   = raw × (1−armorDR) × (1−resDR[elem]) × (1−classDR) × Π(1−otherDR)
classDR       = Fúria warrior 20%, others 0% (melee compensation, D3 used 30%)
life          = 40 + 5 × L + vit × lifePerVit(L),  lifePerVit(L) = 10 + max(0, L − 10)  // 50 at L50
              then × (1 + life%)
APS           = weaponBaseAPS × (1 + ΣIAS)   // weapon base: 1H 1.4, 2H 1.1, bow 1.4, staff 1.0, dagger 1.5
cdr / costRed = 1 − Π(1 − x_i)   // multiplicative; cap cdr 60%
lifeOnHit    *= skill.procCoef   // procCoef 0.1..1.0 per skill; also scales every onHit chance
monster XP    = round(10 + 3 × mL + 0.1 × mL²) × sizeMult × eliteMult × (1 + tierXP) × levelDiffMult
levelDiffMult = D3 vanilla table (8.5), capped at +3 levels; players at level 50 always get 100%
xpToNext(L)   = round((40 × L^2.05 + 60 × L + 40) / 10) × 10
```
Sample values of the XP curve (from `.assets-src/scratch/research-mechanics/xp.js`):

| L | xpToNext | cumulative | normal-mob XP | kills for that level | cumulative kills |
|---|---|---|---|---|---|
| 1 | 140 | 140 | 13 | 11 | 11 |
| 5 | 1,420 | 3,460 | 28 | 51 | 153 |
| 10 | 5,130 | 20,740 | 50 | 103 | 567 |
| 20 | 19,830 | 144,730 | 110 | 180 | 2,043 |
| 30 | 44,510 | 470,430 | 190 | 234 | 4,157 |
| 40 | 79,400 | 1,098,970 | 290 | 274 | 6,726 |
| 49 | 119,650 | 2,008,590 | 397 | 301 | 9,332 |

Reaching 50 takes about **9.3 k normal-mob-equivalents**. Elites (×4/×7), quests and the Pesadelo bonus cut this to about **5–6 k real kills** (≈ 6–8 h of play at 12–15 kills/min).

### 12.13 Town (Acampamento/"Refúgio") services
- **Ferreiro**:
  - (a) **Desmontar** items into materials:
    - Comum → **Sucata**.
    - Mágico → **Pó Místico**.
    - Raro → **Cristal Turvo**.
    - Lendário/Conjunto → **Brasa Ancestral**.
    - Elites also drop **Sopro Sombrio** (Death's-Breath-like) for legendary crafting.
  - (b) **Reparar**: durability −10% on death. The cost is `(1 − dur%) × itemValue × 0.3`.
  - (c) **Têmpera**:
    - Adds **1 tempered affix** from a learned **Receita** (categories Ofensiva / Defensiva / Utilidade / Mobilidade / Recurso, each limited to certain slots).
    - An item has **3 charges**, and each reroll uses 1.
  - (d) **Aprimorar** (masterwork-like):
    - **10 ranks**. Each rank gives **+4% to all affixes**.
    - Ranks **5 and 10 add +20% to one random affix** (the "crítico"). The rank-10 crit can be rerolled for mats and gold.
    - Cost per rank: `(3 + rank)` Cristal Turvo + gold. Lendário uses Brasa Ancestral.
- **Encantadora** (Mystic):
  - Rerolls **one** affix. Once chosen, **only that affix** can be rerolled on that item.
  - Each attempt shows **current + 2 options**.
  - Cost: `gold = 500 × 1.25^n × rarityMult`, `mats = 1 + floor(n/3)`. Legendary powers and set bonuses cannot be enchanted.
- **Joalheiro**:
  - Gems in 5 tiers (Lascado, Imperfeito, Comum, Lapidado, Real), combined 3 → 1 at a gold cost. Removing a gem is free and keeps the gem.
  - Effects follow the D3 table, with slot-based effects for weapon, helm and armor (Rubi, Esmeralda, Topázio, Ametista, Diamante), plus **Crânio** for resource effects.
  - Can also add a socket to an item without one, but only on items that are allowed sockets, at a cost.
- **Mercador**:
  - Sells potions, Pergaminhos de Portal, Pedra de Fenda, and 8 random common/magic items with a refresh every 10 min.
  - `buy = sell × 4`, where `sell = round(baseValue × (1 + ilvl/10) × rarityMult)` and `rarityMult = common 1, magic 3, rare 8, legendary 20, set 20`.
  - Buyback holds the last 10 items.
- **Baú**: shared **10×8 tabs**. Start with 1 tab, and up to 5 more are bought with gold (10k, 50k, 150k, 400k, 1M).
- **Inventory**: **10×6 grid**. Sizes: 1×1 rings, amulets and gems. 1×2 gloves, boots, belt and wands. 2×2 helm. 2×3 chest and shields. 1×3 or 2×3 weapons.
- **Waypoints** ("Marcos de Viagem"):
  - One per zone, discovered within a 3-tile radius, remembered per character.
  - The map shows them per act. Travel costs 0 and needs a 1 s channel, which damage cancels.
- **Pergaminho de Portal**:
  - 3 s channel, cancelled when you take damage.
  - Opens a two-way portal that stays until you go back through it or change zones.
  - A stack of 20 costs 25 gold each. There is also a reusable "Tomo" upgrade (optional).
- **Quests/bounties**: campaign quests give XP and gold. After the campaign, **5 "Contratos" per act** give a **Cofre do Horadrim-like "Arca do Arauto"** once all 5 are done.

### 12.14 Bosses (3, with phases)
- **Timing**: 90–180 s on first encounter at the intended level.
- **Phase changes**: at 66% and 33%, each announced by a 1.5 s invulnerable roar with a screen shake and the arena changing (fire lines, adds, a shrinking safe zone).
- **Enrage**: at 6 min (+100% damage). This only matters in timed contexts.
- **Staggering**: bosses are immune to hard CC but have a **Atordoamento** bar. Filling it by CC stuns the boss for 3 s. This is a D4-style stagger bar.

### 12.15 Game-feel targets
| Target | Value |
|---|---|
| Trash time-to-kill (level-appropriate) | 1–3 hits |
| Champion pack | 6–10 s |
| Rare pack | 8–15 s |
| Rift guardian | 45–75 s |
| Pull density | 8–20 monsters on screen (rifts) |
| Elite packs | 6–8 per rift |
| Knockback | trash yes (skill-defined); elites 25%; bosses immune |
| Hit reaction | monsters flinch 150 ms when a hit is ≥ 15% of their max HP (icd 1 s); player never flinches, only CC |
| Health globes | pull at 1.5 tiles, heal instantly with a flash |
| Gold | auto-pickup at 2 tiles |

---

## 13. Iconic vocabulary (pt-BR, original)
Avoid Blizzard-specific proper nouns (Nephalem, Horadric, Kadala, Tyrael, Sanctuary as the world name, Blood Shards, Death's Breath, and so on).

| Concept | pt-BR term (ours) | Notes |
|---|---|---|
| Hub/town | **Refúgio** / "Santuário da Última Chama" | "Santuário" alone is fine as a generic word, but not as the world name |
| World | **Terras Cinzentas** / "Mundo de Aldrath" (placeholder) | original |
| Rift | **Fenda** | "Fenda Cronometrada" = timed rift |
| Rift key | **Pedra de Fenda** / **Selo de Fenda** | avoid "Chave de Fenda" (it means *screwdriver* in pt-BR) |
| Rift guardian | **Guardião da Fenda** | |
| Progress orb | **Orbe de Progresso** | |
| Health globe | **Orbe de Vida** | |
| Town portal | **Pergaminho de Portal** / Tomo de Portal | |
| Waypoint | **Marco de Viagem** | |
| Difficulties | Normal, **Pesadelo**, **Tormento I–V** | generic words |
| Champions / Rare / Minions | **Campeões** / **Raro** (or "Elite") / **Lacaios** | |
| Treasure goblin | **Diabrete Ganancioso** | |
| Cursed chest | **Baú Amaldiçoado** | |
| Shrine / Pylon | **Altar** / **Pilar** | |
| Gambler / currency | **Apostador** / **Estilhaços Carmesins** | |
| Salvage mats | **Sucata**, **Pó Místico**, **Cristal Turvo**, **Brasa Ancestral**, **Sopro Sombrio** | |
| Blacksmith / Mystic / Jeweler / Vendor | **Ferreiro** / **Encantadora** / **Joalheiro** / **Mercador** | |
| Enchant / Temper / Masterwork | **Encantar** / **Temperar** / **Aprimorar** (ranks "Aprimoramento +1..+10") | |
| Ancient / Primal | **Venerável** / **Primevo** | |
| Paragon | **Ascensão** (levels "Ascensão 1…") | avoids "Paragão" |
| Stash | **Baú** / **Arca** | |
| Legendary power | **Poder Lendário** | |
| Set bonus | **Bônus de Conjunto (2/4/6)** | |
| Class resources | **Fúria**, **Mana**, **Energia**, **Essência** | |
| Bounties | **Contratos** / reward chest **Arca do Arauto** | |
| Death | "Você morreu" / "Retornar ao Refúgio" | |

---

## Sources
- Maxroll D3: [Elite affixes](https://maxroll.gg/d3/resources/elite-affixes), [Greater Rift mechanics](https://maxroll.gg/d3/resources/greater-rift-explained), [Damage reduction](https://maxroll.gg/d3/resources/damage-reduction-explained), [Experience](https://maxroll.gg/d3/resources/experience-explained), [CDR/RCR](https://maxroll.gg/d3/resources/cooldown-and-resource-cost-reduction-mechanics).
- Maxroll D4: [Masterworking](https://maxroll.gg/d4/resources/masterworking-guide), [Tempering](https://maxroll.gg/d4/resources/tempering-guide), [Difficulty](https://maxroll.gg/d4/resources/difficulty-overview), [Elites](https://maxroll.gg/d4/resources/elites-affixes).
- [TenTonHammer, RoS difficulty](https://www.tentonhammer.com/guides/diablo-3-reaper-of-souls-difficulty-explained). [PureDiablo, Greater Rifts](https://www.purediablo.com/gameinfo/greater-rifts-diablo-3), [D4 difficulties](https://www.purediablo.com/diablo4/Difficulties), [D2 MF diminishing returns](https://www.purediablo.com/diablo-2/magic-find-diminishing-returns).
- [Arreat Summit, D2 XP table](https://classic.battle.net/diablo2exp/basics/levels.shtml). [Diablo III blog, level-difference XP](http://diablo3blog.blogspot.com/2012/05/diablo-3-experience-points-explained.html).
- [Diablo Wiki (diablowiki.net), Pylons / Treasure Goblin / Vitality](https://www.diablowiki.net/Pylons) (via search excerpts; diablo.fandom.com returned HTTP 402 and diablowiki.net returned 403 to direct fetch).
- [Icy Veins D4 Pit guide](https://www.icy-veins.com/d4/guides/the-pit-of-the-artificers-guide/) (via search excerpt).
- [Fextralife D4 Loot Reborn](https://diablo4.wiki.fextralife.com/Loot+Reborn) (via search excerpt).
