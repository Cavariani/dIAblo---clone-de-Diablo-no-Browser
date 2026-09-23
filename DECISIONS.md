# Decisões de Design e Técnica

Registro das decisões tomadas de forma autônoma, sempre buscando a opção mais fiel ao espírito de Diablo (D2/D3/D4).

## Técnica

### D-001 — Renderização: PixiJS v8 (WebGL) em vez de Canvas 2D
- **Por quê**: precisamos de 100+ inimigos animados, milhares de partículas, iluminação dinâmica (render texture de luz multiplicada sobre a cena), fog of war suave, bloom e shaders de cor (tint de armadura, variação de biomas). Canvas 2D não faz composição de luz/bloom a 60 FPS; Pixi v8 faz batching automático de sprites (até 16 texturas por draw call), tem `ParticleContainer` novo (muito rápido), filtros (pixi-filters v6: bloom, glow, shockwave) e render textures.
- WebGL é preferido explicitamente (`preference: 'webgl'`) pela compatibilidade Chrome/Firefox.

### D-002 — UI em DOM/CSS sobre o canvas
- Menus, inventário, tooltips, HUD (orbes, hotbar) são HTML/CSS/SVG. CSS dá molduras ornamentadas, fontes góticas (Google Fonts), animações e acessibilidade de texto muito superiores ao texto em WebGL, e simplifica drag & drop do inventário.
- Números de dano, nomes de itens no chão e barras de vida sobre inimigos ficam no Pixi (desempenho).

### D-003 — Vanilla TypeScript (sem framework de UI)
- Menos dependências e controle total sobre atualizações por frame. Painéis são classes com `mount/render/unmount` e um helper `el()`.

### D-004 — Simulação em passo fixo (60 Hz) separada do render
- Determinismo, hit-stop via `timeScale`, física estável. O renderer lê o estado (pull) e a simulação empurra efeitos (FxAPI).

### D-005 — Entidades "bag of components" em vez de ECS puro
- `Actor` com componentes opcionais (`monster`, `ai`, `character`, `minion`...) + sistemas separados (input, movimento/colisão, IA, combate, loot, fog, save...). Mantém tipagem forte e simplicidade; os sistemas continuam desacoplados via `GameCtx`, registries por id e `EventBus`.

## Arte e assets

### D-010 — Assets do projeto Flare (CC-BY-SA 3.0) como base visual
- Flare (Free Libre Action Roleplaying Engine) é um ARPG isométrico open-source claramente inspirado em Diablo. Seus assets são pré-renderizados em 8 direções, com herói em **camadas** (cabeça, peito, pernas, pés, mãos, arma, escudo) — ou seja, **o equipamento aparece no personagem**, como em Diablo.
- Inclui: 15+ inimigos (esqueletos, zumbis, goblins, minotauro, wyverns, formigas, antlions...), chefes (cavaleiro esqueleto, liches), tilesets de masmorra, caverna, campos, ruínas e neve, efeitos de magias, ícones de itens/skills, sfx e trilhas sonoras.
- Licença CC-BY-SA 3.0: atribuição completa em `CREDITS.md`. Assets convertidos para WebP (menor download).
- Complementos gerados por código: partículas, luzes, glow, telegraphs, feixes de loot, UI inteira (CSS/SVG), sons procedurais (Web Audio).
- Não usamos assets da Blizzard (apesar de permitido pelo usuário) para manter o repositório público livre de problemas de copyright.

### D-011 — Tiles 64×32 e escala 1:1 com a arte do Flare
- A arte do Flare foi feita para tiles 64×32; mantemos a escala nativa para nitidez. Zoom da câmera limitado (0.8×–1.3×).

## Game design

### D-020 — Idioma pt-BR
- Todo texto do jogo em português do Brasil, com terminologia inspirada na localização brasileira de Diablo (Fenda, Tormento, Pergaminho de Portal, Santuário...), mas com nomes próprios originais.

### D-021 — 4 classes
- O briefing pede 3 no conteúdo mínimo e 4 na fase 2; entregamos 4, cada uma com recurso próprio:
  - **Berserker** (corpo a corpo, **Fúria**: gerada ao golpear, decai fora de combate)
  - **Arcanista** (conjurador elemental, **Mana**: regenera)
  - **Espreitador** (atirador ágil, **Energia**: regenera rápido, custos pequenos)
  - **Ossomante** (invocador de ossos/necromante, **Essência**: gerada por habilidades primárias e cadáveres)

### D-022 — Slots de equipamento
- Cabeça, amuleto, peito, mãos, cinto, pernas, pés, 2 anéis, arma principal, secundária (escudo/orbe/aljava/grimório). Pernas e cinto adicionados por fidelidade a D3 (e pernas têm camada visual no avatar).

### D-023 — Percentuais como frações
- Todos os stats percentuais armazenados como frações (0.05 = 5%) para evitar erros de fórmula; a UI formata.
