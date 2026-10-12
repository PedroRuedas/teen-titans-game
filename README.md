# Jovens Titãs — A Batalha de Jump City (rascunho jogável)

Beat 'em up 2.5D inspirado no *Teen Titans* de PS2 (2006): as duas primeiras fases
(**Torre Titã** e **Perfuratriz do Terror**), os 5 Titãs jogáveis com troca em tempo real
e inimigos da série.

## Como jogar

Dê **dois cliques em `JOGAR.bat`** (ou abra `index.html` no Chrome/Edge/Firefox).
Não precisa instalar nada nem de internet.

| Ação | Teclado | Controle |
|---|---|---|
| Mover | WASD / Setas | Analógico / D-pad |
| Ataque (combo de 3) | J ou Z | X / □ |
| Ataque forte | K ou X | Y / △ |
| Especial (gasta energia) | L ou C | B / ○ |
| Pular | Espaço | A / ✕ |
| Esquiva (invencível) | Shift | RT |
| Trocar Titã | 1–5, Q / E | LB / RB |
| **Titãs, avante!** (energia cheia) | U ou V | LT |
| Pausa / Som | Esc ou P / M | Start / Select |

## Os Titãs

| Titã | Combo | Forte | Especial |
|---|---|---|---|
| **Robin** | bastão | voadora | 3 birdarangues |
| **Mutano** | socos/garra | vira **gorila** | vira **T-Rex** e atropela |
| **Ciborgue** | socos pesados | soco no chão (onda) | **canhão sônico** ("BOOYAH!") |
| **Ravena** | garras de energia | corvo sombrio | *"Azarath Metrion Zinthos!"* (área) |
| **Estelar** | socos + starbolt | starbolt carregado | **raios oculares** |

- Cada Titã tem vida própria. Quem está fora de campo recupera vida aos poucos.
- Se o Titã ativo cair, entra o próximo. Ao fim de cada seção, os caídos voltam com 30% de vida.
- Acertar inimigos enche a energia. Com a barra cheia, **Titãs, avante!** acerta todos na tela.
- Caixas guardam **pizza** (vida) e **cristais** (energia).

## Fases

1. **Torre Titã**: a H.I.V.E. invade a ilha e a torre. Você enfrenta Soldados H.I.V.E., Robôs do Slade
   e Drones do Gizmo. O chefe é o **Cinderblock**, com soco giratório, onda de choque (pule!),
   investida (desvie e ele fica tonto ao bater na parede) e arremesso de pedras.
2. **Perfuratriz do Terror**: túneis sob Jump City, com uma **perseguição** contra uma
   perfuratriz gigante da H.I.V.E. O chefe é o **Gizmo** num robô-aranha, com broca, chuva de
   mísseis (fuja dos círculos vermelhos), invocação de drones e, na fase 2, um laser.

## Tecnologia

- **HTML5 Canvas + JavaScript puro**, sem bibliotecas nem arquivos externos. Todos os gráficos são
  desenhados em vetor, em estilo cartoon com contorno grosso, e todo o áudio (efeitos e 5 músicas
  originais) é sintetizado na hora com WebAudio.
- **Por que não Unity/Unreal:** o objetivo era entregar algo pronto e **testado de verdade** sem
  ninguém por perto. Com Canvas eu pude rodar e jogar o jogo de forma automatizada, tirar prints
  e conferir cada tela.
- **Otimização:**
  - Passo fixo de 60 Hz.
  - Cenários com parallax pré-renderizados em blocos cacheados (só um `drawImage` por bloco),
    com pré-geração à frente da câmera.
  - Pool de partículas, brilhos pré-renderizados (nada de `shadowBlur`) e retratos do HUD em cache.
  - Resolução interna adaptada à tela (nítido em 1080p e 4K).
  - Medição: cerca de **0,6 ms por quadro**, 150+ FPS.

```
index.html        página do jogo
js/util.js        constantes, matemática, teclado e gamepad
js/audio.js       efeitos e músicas sintetizados
js/render.js      rig dos personagens, poses e rostos
js/backgrounds.js cenários em camadas (cache em blocos)
js/entities.js    Titãs, inimigos, chefes, projéteis, itens
js/stages.js      roteiro das fases (ondas, perseguição, chefes)
js/game.js        laço do jogo, câmera, HUD e telas
js/main.js        inicialização, bot de teste e API de depuração
tests/            testes automatizados (Playwright)
```

## Testes automatizados

```
node tests/serve.js                       # serve em http://localhost:8765
playwright-cli open http://localhost:8765/
playwright-cli run-code --filename=tests/run-tests.js
```

A suíte tem 25 verificações e todas passam:

- Teclado real: iniciar, andar, atacar, trocar de Titã, pular e pausar.
- Cada golpe de cada Titã acerta.
- Titãs, avante!
- Regressões.
- 3 partidas completas do início ao fim com um bot.
- Os dois chefes vencidos pelo bot **sem trapaça**.
- Desempenho e zero erros de JavaScript.

## Próximos passos sugeridos

- Mais fases (Power Plant, Academia H.I.V.E., Mumbo…).
- Modo cooperativo local.
- Ataques em equipe.
- Seleção de dificuldade.
