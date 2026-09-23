# dIAblo — Arquitetura

ARPG isométrico 2D para browser (TypeScript + Vite + PixiJS v8 + DOM/CSS UI).
Este documento é o **contrato** entre módulos. Os arquivos de contrato são:

| Arquivo | Conteúdo |
|---|---|
| `src/data/schema.ts` | Tipos de TODOS os dados de conteúdo (classes, skills, inimigos, itens, afixos, zonas...) |
| `src/game/types.ts` | Estado de runtime (Actor, Projectile, GroundEffect, GroundItem, Interactable, ItemInstance, CharacterState, SaveFile, Settings) |
| `src/game/api.ts` | Interfaces de serviço: `WorldAPI`, `CombatAPI`, `FxAPI`, `AudioAPI`, `UIAPI`, `GameCtx`, `System`, `SkillImpl`, `AIBehavior`, `PowerHooks`, `EliteModImpl` |
| `src/core/events.ts` | `EventBus` tipado + mapa `GameEvents` |
| `src/world/types.ts` | `TileMap`, `CellKind`, `GeneratedLevel`, `GeneratorParams` |
| `src/render/assets/manifest.ts` | Formato do manifesto de assets gerado pelo pipeline |

Mudanças **aditivas** (novos campos opcionais, novos eventos) são permitidas. Renomear/remover exige atualizar todos os consumidores.

## Convenções

- **Espaço do mundo**: cartesiano, `1 unidade = 1 tile`. `+x` vai para baixo-direita na tela, `+y` para baixo-esquerda. Célula `(i,j)` cobre `[i,i+1)×[j,j+1)`; centro em `(i+.5, j+.5)`.
- **Projeção iso**: `screenX = (x - y) * 96`, `screenY = (x + y) * 48` (tiles **192×96**, arte HD do Flare; herói ≈125 px de altura ≈ raio 0.22 tile, velocidade ≈2.6 tiles/s). Ver `src/core/math.ts` (`worldToScreen`, `screenToWorld`, `isoDepth`).
- **Profundidade**: ordenar por `x + y` (maior = na frente). Paredes/props usam a célula; atores usam `pos`.
- **Tempo**: segundos (float). Simulação em passo fixo **1/60 s**; `timeScale` global (hit-stop) multiplica o dt da simulação.
- **Velocidades**: tiles/segundo. Raios: tiles.
- **Percentuais**: SEMPRE frações (`0.05 = 5%`). A UI formata.
- **Direção**: `Actor.facing` é ângulo no espaço do mundo. O renderer converte para 8 direções de sprite via `worldDirToScreenAngle` + tabela do Flare.
- **Textos do jogo**: pt-BR. Código, ids e comentários: inglês.
- **IDs**: `kebab`/`snake` estáveis em dados (`berserker.cleave`, `skeleton_archer`, `crypt`). Nunca exibir ids na UI.
- **Aleatoriedade de gameplay**: `Rng` com seed (`src/core/rng.ts`). Cosmético: `fxRng`.

## Mapa de módulos (dono lógico entre colchetes)

```
src/
  main.ts                 [app]      bootstrap: fontes, UIRoot, Renderer, AssetManager, SaveManager, App
  app/                    [app]      máquina de telas: loading → menu → seleção/criação → jogo ↔ pausa
  core/                   [arch]     math, rng, events, pool, spatialHash, loop.ts (passo fixo), input.ts (InputManager)
  data/                   [content]  schema.ts + conteúdo em dados (classes, skills, inimigos, itens, afixos, zonas, áudio...)
    index.ts                         registries: getSkill/getEnemy/getItemBase/... + validação em dev
  formulas/               [combat]   funções PURAS e testadas: dano, mitigação, xp, loot, afixos, escalas, preços
  game/
    Game.ts               [engine]   implementa GameCtx; loop, ordem dos sistemas, viagem entre zonas, autosave
    World.ts              [engine]   implementa WorldAPI (listas, spatial hash, colisão, LOS, pathfinding, flow field)
    actors.ts             [engine]   fábricas de Actor (player, monstro, npc, minion)
    systems/              [vários]   PlayerControl, AI, Cast, Movement, Projectile, GroundEffect, Status,
                                     Spawn, Rift, Loot, Interaction, Fog, Death, Quest
    combat/Combat.ts      [combat]   implementa CombatAPI (dano, crítico, mitigação, feedback, morte)
    stats/aggregate.ts    [combat]   stats finais do jogador (atributos + gear + paragon + passivas + buffs)
    skills/               [skills]   registry + impl/<classe>.ts (SkillImpl por id) + passives.ts
    ai/                   [ai]       registry + behaviors/*.ts (AIBehavior por id) + steering
    monsters/             [monsters] spawn (nível/dificuldade/rank), eliteMods.ts (EliteModImpl), nomes, bosses/*.ts
    items/                [items]    geração, inventário em grade, equipar, vendedor, ferreiro, desmontar, powers/*.ts
    progression/          [progress] xp/nível, paragon, árvore de skills (gastar/respec), dificuldade
    save/                 [save]     SaveManager (IndexedDB + fallback localStorage), migrations, defaults, export/import
  world/
    types.ts              [arch]
    gen/                  [worldgen] town.ts, rooms.ts (cripta), cave.ts, forest.ts, hell.ts, index.ts (generateLevel)
    paint/                [worldgen] layout lógico → índices de tiles do tileset (paredes por orientação, variações)
    nav/                  [engine]   A*, flow field
    fov.ts                [world]    shadowcasting para fog of war
  render/                 [render]   Renderer (Pixi app, camadas, câmera), assets/, views/, fx/, lighting/, fog/, post/
  audio/                  [audio]    AudioManager (Web Audio, buses), synth.ts (sfx procedurais), música
  ui/                     [ui]       UIRoot (implementa UIAPI), styles/, components/, hud/, panels/, screens/, map/
public/assets/            [assets]   saída do pipeline (webp + json + ogg) — gerado por scripts/assets
scripts/assets/           [assets]   pipeline de conversão dos assets do Flare
tests/                    unit tests (vitest) — fórmulas obrigatoriamente
e2e/                      Playwright (bot que joga, screenshots, FPS, erros de console)
docs/research/            pesquisas (mecânicas de Diablo, catálogos de assets, notas PixiJS v8, direção de arte)
```

## Fluxo de dados

```
Input ──▶ PlayerControlSystem ──▶ Actor.vel / Actor.cast
AI ─────▶ Actor.vel / Actor.cast
CastSystem ──fire──▶ SkillImpl / monster ability ──▶ CombatAPI (dano, projéteis, AoE, status, summon)
CombatAPI ──▶ EventBus (damage, actorDied...) ──▶ Loot, XP, Quests, Powers, UI, Audio
Simulação ──(push)──▶ FxAPI (partículas, números, shake, luzes) / AudioAPI / UIAPI
Renderer ──(pull, todo frame)──▶ lê World (atores, projéteis, efeitos, itens, interagíveis, TileMap, fog)
```

- A simulação **nunca** importa Pixi nem DOM. Renderer e UI leem estado e escutam eventos.
- `Actor.visual` descreve a aparência; o renderer mantém `Map<id, View>` e cria/destroi views conforme os atores entram/saem.
- Registries por id: `SkillDef.id → SkillImpl`, `EnemyDef.ai → AIBehavior`, `LegendaryDef.powerId / SetDef.bonuses[].powerId / PassiveDef.powerId → PowerHooks`, `EliteModDef.id → EliteModImpl`.

## Ordem de atualização (Game.step, dt fixo 1/60 × timeScale)

1. `InputManager.poll()`
2. PlayerControlSystem → 3. AISystem → 4. CastSystem → 5. MovementSystem
6. ProjectileSystem → 7. GroundEffectSystem → 8. StatusSystem (DoTs, regen, velocidade)
9. SpawnSystem / RiftSystem (gatilhos de pack/boss) → 10. LootSystem (pickup, auto-gold)
11. InteractionSystem → 12. FogSystem → 13. DeathSystem (cadáveres) → 14. QuestSystem
Depois: `renderer.render(alpha)` e `ui.update(dt)` por frame de tela.

## Ciclo de jogo

Cidade (hub fixo: ferreiro, comerciante, baú, waypoint, NPC de missões, obelisco da fenda, altar de dificuldade)
→ waypoint → masmorra procedural (andares) → hordas/elites/baús/santuários → loot
→ portal (tecla T) de volta → vender/guardar/equipar/aprimorar → voltar pelo portal → chefe → próxima zona
→ dificuldade maior / fendas (endgame).

Instância de masmorra fica em memória enquanto o jogador está na cidade via portal (voltar = mesma instância).

## Regras para agentes trabalhando em paralelo

1. Edite **apenas** os arquivos/pastas do seu módulo. Em arquivos compartilhados (`Game.ts`, `data/index.ts`, contratos) faça edições **mínimas e aditivas**; releia antes de editar.
2. **Não** rode `npm install` (dependências já instaladas). Precisa de lib nova? Reporte na resposta final.
3. **Não** faça `git commit` — o arquiteto commita entre fases.
4. Type-check: `npx tsc --noEmit`. Corrija erros dos SEUS arquivos; ignore erros de arquivos de outros módulos em andamento.
5. Pixi v8 (NÃO v7): consulte `docs/research/pixi-v8-notes.md`.
6. Sem `console.log` de spam no loop; nada de erros no console (requisito: zero erros).
7. Performance: nada de alocação por frame em hot paths (use pools / arrays reutilizados); nada de `Array.filter` por frame em listas grandes.

## Performance

- Spatial hash (células de 2 tiles) reconstruído por tick para atores.
- Flow field (BFS) a partir do jogador, recalculado quando o jogador muda de célula, para hordas; A* só para cliques e casos sem LOS.
- Culling fora da câmera (tiles em chunks; atores/efeitos fora do viewport não atualizam view).
- Partículas em `ParticleContainer` v8 com pool; texturas de partículas geradas em atlas.
- Sprite sheets convertidas para WebP; carregadas por zona (lazy) e liberadas ao trocar de bioma.
