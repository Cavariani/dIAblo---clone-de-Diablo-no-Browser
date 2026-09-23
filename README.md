# dIAblo — ARPG no browser

ARPG isométrico 2D inspirado em Diablo 3/4, feito em **TypeScript + Vite + PixiJS 8 (WebGL)**, com UI gótica em DOM/CSS. Todo o texto do jogo é em pt-BR.

> Projeto pessoal, não comercial. Não usa nenhum asset da Blizzard: arte, animações, tilesets e música vêm do projeto **Flare** (CC-BY-SA 3.0) e os efeitos sonoros complementares são CC0 (Kenney / OpenGameArt). Veja [CREDITS.md](CREDITS.md).

## Rodar localmente

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + build de produção em dist/
npm run preview      # serve o dist/
npm test             # testes unitários (vitest)
npm run lint
```

Os assets processados já estão em `public/assets` (commitados). Para regenerá-los a partir das fontes originais do Flare, veja `PROGRESS.md` → "Recriar assets".

### Deploy (Vercel)
Importe o repositório na Vercel: framework **Vite**, build `npm run build`, saída `dist` (já configurado em `vercel.json`). O `base` do Vite é relativo (`./`), então também funciona em qualquer hospedagem estática / subpasta.

## Controles

| Ação | Tecla |
|---|---|
| Andar / atacar / interagir | Botão esquerdo (segurar para seguir o cursor) |
| Habilidade secundária | Botão direito |
| Habilidades 1–4 | `1` `2` `3` `4` |
| Mover com teclado (opcional) | `W` `A` `S` `D` |
| Atacar sem sair do lugar | `Shift` + clique |
| Poção de vida | `Q` |
| Portal para a cidade | `T` |
| Mostrar itens no chão | `Alt` (segurar) |
| Inventário | `I` ou `B` |
| Personagem | `C` |
| Habilidades e passivas | `K` |
| Paragon | `P` |
| Diário de missões | `J` |
| Mapa grande | `Tab` ou `M` |
| Zoom | roda do mouse |
| Pausa / opções | `Esc` |

## O que tem no jogo

- **4 classes** com recurso próprio: Berserker (Fúria), Arcanista (Mana), Espreitador (Energia), Ossomante (Essência). 8 habilidades por classe, cada uma com 3 runas, graduações 1–5; **7 passivas por classe** liberadas por pontos gastos na árvore; atributos Força/Destreza/Inteligência/Vitalidade.
- **Game feel**: hit-stop, tremor de tela, números de dano, knockback, flash de acerto, partículas de morte, som por tipo de golpe, interpolação de render a 60 Hz de simulação fixa.
- **Loop completo**: cidade (Brasaluz) → waypoint → masmorra procedural → elites → loot → portal → vendedor / baú / ferreiro → dificuldade maior.
- **Cidade** com ferreiro (reforjar afixo, aprimorar, desmontar), mercador, baú compartilhado, waypoint, NPCs de missão, Altar do Tormento e Obelisco da Fenda.
- **Biomas**: Cripta, Caverna (autômato celular), Floresta Corrompida e Inferno — salas, portas, armadilhas, baús, santuários; névoa de guerra (linha de visão), minimapa e mapa grande.
- **Inimigos**: 10+ comportamentos (corpo a corpo, tanque, atirador, kiter, conjurador, investida, explosivo, invocador…); **elites** campeões/raros com 15 modificadores e nomes gerados; **3 chefes de ato + 2 guardiões de fenda** com fases e ataques telegrafados.
- **Dificuldades**: Normal, Pesadelo, Tormento I–V.
- **Itens**: comum / mágico / raro / lendário / conjunto; afixos com faixas por nível de item, requisitos de nível, comparação no tooltip, feixes de luz e sons por raridade, ouro com coleta automática; **18 lendários com poderes que mudam a build** e **4 conjuntos de classe** (bônus de 2/4 peças); inventário em grade, slots de equipamento, baú, venda, desmontagem.
- **Fendas**: Fenda normal (grátis) e **Fenda Maior** com cronômetro, barra de progresso, Guardião e níveis escaláveis (selos como chave).
- **Progressão**: nível máximo 50 + **Paragon** (16 nós em 4 categorias).
- **Save**: IndexedDB com fallback em localStorage, vários personagens, autosave ao trocar de zona, migração versionada, exportar/importar JSON.
- **Menus**: principal, criação (retratos por classe, preview 3/4 com rotação por arrasto), seleção, opções (áudio, vídeo, tremor de tela), pausa, morte, créditos.

## Estrutura

```
src/
  core/      loop fixo, input, rng, eventos, spatial hash
  data/      conteúdo (classes, skills, itens, inimigos, zonas, fendas…) — só dados
  formulas/  fórmulas puras (dano, XP, escala, economia) — cobertas por testes
  game/      simulação: Game/World, sistemas (movimento, combate, IA, loot…), skills, itens, chefes, fendas
  world/     geração procedural (cripta, caverna, floresta, cidade) e A*
  render/    PixiJS: tiles, atores, luz, névoa, partículas, câmera
  ui/        HUD e painéis em DOM/CSS
  audio/     AudioManager (música, sfx, ambiente) + sons sintetizados
tests/       vitest (fórmulas, dados, itens, save)
e2e/         scripts Playwright (screenshots, fendas, bot de balanceamento)
```

Mais detalhes: [ARCHITECTURE.md](ARCHITECTURE.md) e [DECISIONS.md](DECISIONS.md).

## Testes e validação

- `npm test` — fórmulas de dano/mitigação, curva de XP, escala de monstros/itens, faixas de afixos, geração de itens por raridade, economia, integridade dos dados, passivas, migração de save.
- `node e2e/ui-check.mjs` — screenshots do menu e da criação (dev server na porta 5288).
- `node e2e/rift.mjs` — abre uma Fenda Maior, mata tudo, confere Guardião, recompensa e saída.
- `node e2e/balance.mjs <classe>` — bot joga a Cripta do nível 1 até o chefe e mede o tempo simulado.

URL de debug: `?quick=<classe>&zone=<zona>&floor=<n>` pula o menu (classes: `berserker`, `arcanist`, `stalker`, `bonemancer`; zonas: `town`, `crypt`, `cave`, `forest`, `hell`).
