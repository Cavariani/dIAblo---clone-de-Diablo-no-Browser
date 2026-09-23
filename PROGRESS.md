# PROGRESS — diário de bordo (leia isto primeiro ao retomar)

> Arquivo de handoff entre sessões/contas. Atualizado e commitado a cada passo.
> Ao retomar: leia este arquivo, `ARCHITECTURE.md`, `DECISIONS.md`, rode `git log --oneline | head -20`.

## Modo de trabalho (IMPORTANTE)
- **Sem workflows / sem agentes paralelos** — gastaram tokens demais (2 contas). O arquiteto (Claude principal) escreve o código direto, enxuto.
- Commit + push a cada passo pequeno. Atualizar a seção "Estado atual" e "Próximo passo" aqui.
- Verificação visual pontual (1 screenshot Playwright quando necessário), sem loops longos.

## Estado atual (2026-09-23)
### Feito
- Scaffold Vite 7 + TS 5.9 + PixiJS 8.21 + pixi-filters 6 + vitest 4 + eslint 10 + Playwright. `npm run build/test/lint/assets`.
- Contratos: `src/data/schema.ts`, `src/game/types.ts`, `src/game/api.ts`, `src/core/events.ts`, `src/world/types.ts`, `src/render/assets/{manifest,types}.ts`, `src/render/types.ts`.
- Core: `src/core/{math,rng,pool,spatialHash,events}.ts`. **Tiles 192×96** (arte HD do Flare).
- Registries/stubs: `src/data/index.ts` (+ stubs de dados vazios), `src/game/{skills,ai,items/powers,monsters}/registry`.
- Pesquisa pronta em `docs/research/*.md` e catálogos `scripts/assets/catalog/*.json` (personagens, tilesets dungeon/ruins/cave/grassland/snow, fx, ícones, loot, áudio).
- Assets Flare clonados em `.assets-src/flare-game` (gitignored; recriar com sparse clone — ver abaixo). CC0 áudio em `.assets-src/cc0-audio`.
- UI parcial (de agente interrompido): `src/ui/components/el.ts`, `src/ui/format.ts`, `src/ui/icons.ts`, `src/ui/styles/{tokens,base,controls,frames}.css`.
- **Pipeline de assets** `scripts/assets/build-assets.mjs` → `public/assets/` (manifest.json, sheets/*.json+webp, tilesets, icons). 325 sheets, ~97 MB (inimigos escala 0.6, avatar/npc 0.8 → `sourceScale` no json; renderer deve escalar sprites por `1/sourceScale`).

### Fatos-chave dos assets (não re-pesquisar)
- Direções Flare: 0=esq, 1=cima-esq, 2=cima, 3=cima-dir, 4=dir, 5=baixo-dir, 6=baixo, 7=baixo-esq. `dir = (round(atan2(2*sy, sx)/45°) + 4) mod 8` (sx,sy = delta em tela).
- Âncora: desenhar frame em (pésX - ox, pésY - oy). Tile: centro da célula (x,y) em tela = ((x-y)*96, (x+y)*48+48) → no nosso math, centro (x+.5,y+.5).
- Ordem de camadas do avatar por direção: dirs 0-2: main,feet,legs,hands,chest,off,head | 3-5: feet,legs,hands,chest,off,head,main | 6: feet,legs,hands,main,chest,head,off | 7: main,feet,legs,hands,chest,head,off. Arcos/estilingue são camada "off".
- Avatar anims: stance, run, swing, block, hit, die, cast, shoot. Corpo nu = default_chest/legs/hands/feet + head (male: head_short/head_bald; female/female_dark: head_long).
- Paredes dungeon: ver `docs/research/flare-tilesets-dungeon.md` (altas W/N: 64/68, 65/69; baixas E/S: 82/83; cantos...). Cave/grassland: `docs/research/flare-tilesets-outdoor.md`.

### Recriar assets em máquina nova
```
mkdir .assets-src && cd .assets-src && git clone --depth 1 --filter=blob:none --sparse https://github.com/flareteam/flare-game.git flare-game
cd flare-game && git sparse-checkout set mods/fantasycore/images mods/fantasycore/animations mods/fantasycore/tilesetdefs mods/fantasycore/soundfx mods/fantasycore/music mods/fantasycore/engine mods/empyrean_campaign/images mods/empyrean_campaign/animations mods/empyrean_campaign/tilesetdefs
cd ../.. && npm run assets
```
(public/assets é commitado, então normalmente não precisa.)

## Plano (ordem de execução enxuta)
1. [x] Pipeline de assets
2. [ ] AssetManager (Pixi) + Renderer mínimo (tiles, atores, câmera) + dados mínimos + World/Game/loop/input + gerador cripta simples → **jogável: andar/colidir/atacar 1 tipo de inimigo**
3. [ ] Combate/game feel (números, flash, knockback, partículas, hit-stop, shake) + HUD (orbes, hotbar)
4. [ ] 4 classes × skills (dados + impl), recurso, cooldowns
5. [ ] Mundo: cidade, cripta/caverna/floresta/inferno, waypoints, portal, fog, minimapa, mapa TAB
6. [ ] Loot/itens: raridades, afixos, lendários, inventário, equipamento, lojas, ferreiro, baú
7. [ ] Inimigos (8 comportamentos), elites, 3 chefes, dificuldades
8. [ ] Progressão, árvore de skills, paragon, fendas, save/load/export
9. [ ] Áudio, iluminação, polimento de UI, menus, criação de personagem
10. [ ] QA Playwright, balanceamento, README/CREDITS, deploy

## Próximo passo
- Passo 2 em andamento. Feito: AssetManager, gerador cripta (world/gen/rooms.ts + paint/dungeon.ts), input, loop, World (A*, flow field), fórmulas scaling/damage, stats/aggregate, actors.ts, dados classes/enemies/zones/difficulties. FALTA: combat/Combat.ts, systems (control, movement, cast, ai basic, projectile, groundEffect, status, death), Game.ts, render/Renderer.ts, main.ts + index.html.

## Pendências / notas
- Tamanho total de assets ~97 MB: se o deploy Vercel reclamar, remover tileset snowplains e reduzir avatar female/male não usados.
