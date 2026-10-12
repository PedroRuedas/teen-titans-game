# Jovens Titãs — A Batalha de Jump City (rascunho jogável)

Beat 'em up 2.5D inspirado no *Teen Titans* de PS2 (2006): três fases
(**Torre Titã**, **Perfuratriz do Terror** e **Usina de Energia**), os 5 Titãs jogáveis com troca
em tempo real, inimigos da série, **3 níveis de dificuldade** e **co-op local para 2 jogadores**.

## Como jogar

Dê **dois cliques em `JOGAR.bat`** (ou abra `index.html` no Chrome/Edge/Firefox).
Não precisa instalar nada nem de internet.

No título escolha **JOGAR**, **JOGADORES (1 ou 2)**, **DIFICULDADE** e **CONTROLES**
(↑↓ escolhe, ←→ muda, ENTER confirma). A dificuldade também pode ser trocada no menu de pausa
e fica salva no navegador.

| Ação | Teclado (P1) | Controle |
|---|---|---|
| Mover | WASD / Setas (setas só no modo 1 jogador) | Analógico / D-pad |
| Ataque (combo de 3) | J ou Z | X / □ |
| Ataque forte | K ou X | Y / △ |
| Especial (gasta energia) | L ou C | B / ○ |
| Pular | Espaço | A / ✕ |
| Esquiva (invencível) | Shift | RT |
| Trocar Titã | 1–5, Q / E | LB / RB |
| **Titãs, avante!** (energia cheia) | U ou V | LT |
| Ataque em corrida | Shift + J (Mutano vira **rinoceronte**) | RT + X |
| Pausa / Som | Esc ou P / M | Start / Select |

### Jogador 2 (co-op local)

| Ação | Teclado (P2) |
|---|---|
| Mover | Setas |
| Ataque / Forte / Especial | Numpad 1 / 2 / 3 |
| Pular / Esquiva | Numpad 0 / Numpad , (decimal) |
| Trocar Titã | Numpad 4 / 6 |
| Titãs, avante! | Numpad 5 |

O P2 também pode usar o **2º controle**. Cada jogador controla um Titã diferente (a troca pula o
Titã do parceiro), a câmera segue o meio dos dois e ninguém sai da tela. Pontos e energia são
compartilhados. Se um jogador ficar sem Titã livre, ele volta na próxima área; o jogo só acaba quando
**todos** os Titãs caírem.

## Dificuldade

| | Fácil | Normal | Difícil |
|---|---|---|---|
| Vida dos inimigos / chefes | 75% / 80% | 100% | 130% |
| Dano recebido | 60% | 100% | 140% |
| Agressividade e ataques simultâneos | menor, −1 | normal | maior, +1 |
| Aviso dos ataques dos chefes | 45% mais longo | normal | 28% mais curto |
| Pizzas dropadas / cura fora de campo | mais | normal | menos |

Todos os valores ficam na tabela `TT.DIFFICULTY` em `js/util.js`.

## Os Titãs

Cada Titã tem modelo, corrida, pulo, esquiva e golpes próprios:

| Titã | Correr / pular / esquivar | Combo (J J J) | Forte | Especial |
|---|---|---|---|---|
| **Robin** | corrida atlética, arrancada baixa na esquiva | bastão: **estocada → golpe lateral → golpe por cima** | **chute lateral** | 3 birdarangues |
| **Mutano** | corrida agitada, vira **guepardo** na esquiva | socos e chute giratório, e no fim vira um **animal aleatório** (gorila, rinoceronte, canguru ou carneiro) | **gorila** | **T-Rex** |
| **Ciborgue** | passada pesada, **propulsores** na esquiva e no pulo | **punho-pistão**, gancho, **canhão à queima-roupa** | martelo duplo no chão | canhão sônico |
| **Ravena** | **flutua** e desliza, levita no pulo, vira **corvo de alma** na esquiva | **mãos de energia negra com círculo mágico**, e no fim abre um **portal** de onde sai a garra | corvo de energia | *"Azarath Metrion Zinthos!"* |
| **Estelar** | **voa**, esquiva como **cometa verde** | **punhos de energia verde** com círculo, starbolt à queima-roupa | starbolt carregado | raios oculares |

Os modelos seguem o traço da **série animada de 2003** (a mesma do jogo de PS2): corpos esguios,
rostos de queixo fino, contorno preto e sombra chapada em dois tons.

- Cada Titã tem vida própria. Quem está fora de campo recupera vida aos poucos.
- Se o Titã ativo cair, entra o próximo. Ao fim de cada seção, os caídos voltam com 30% de vida.
- Acertar inimigos enche a energia. Com a barra cheia, **Titãs, avante!** acerta todos na tela.
- Caixas guardam **pizza** (vida) e **cristais** (energia).
- Todo ataque de chefe tem aviso: pose exagerada, brilho na cor do golpe, um **"!"** sobre a cabeça e
  a **área exata** marcada em vermelho no chão, que vai se preenchendo até o impacto.

## Fases

1. **Torre Titã**: a H.I.V.E. invade a ilha e a torre. Você enfrenta Soldados H.I.V.E., Robôs do Slade
   e Drones do Gizmo. O chefe é o **Cinderblock**, com soco giratório, onda de choque (pule!),
   investida (desvie e ele fica tonto ao bater na parede) e arremesso de pedras.
2. **Perfuratriz do Terror**: túneis sob Jump City, com uma **perseguição** contra uma
   perfuratriz gigante da H.I.V.E. O chefe é o **Gizmo** num robô-aranha, com broca, chuva de
   mísseis (fuja dos círculos vermelhos), invocação de drones e, na fase 2, um laser.
3. **Usina de Energia**: pátio de transformadores, galpão de turbinas e o núcleo com bobinas de Tesla.
   Novo inimigo: o **Soldado Elétrico** da H.I.V.E. (bastão elétrico, bate e recua). O chefe é o
   **Overload**: raio em linha, poças elétricas, teleporte com descarga e, abaixo de 50% de vida,
   anel de descarga e raio duplo. **Fraqueza:** depois do teleporte ele superaquece e fica com o
   **chip exposto** — dano dobrado!

## Tecnologia

- **HTML5 Canvas + JavaScript puro**, sem bibliotecas nem arquivos externos. Todos os gráficos são
  desenhados em vetor, em estilo cartoon com contorno grosso, e todo o áudio (efeitos e 7 músicas
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
  - Medição: cerca de **0,8 ms por quadro** de renderização.

```
index.html        página do jogo
js/util.js        constantes, matemática, teclado e gamepad
js/audio.js       efeitos e músicas sintetizados
js/render.js      modelos (rig sombreado), rostos e formas animais
js/anim.js        animações: quadros-chave, locomoção e golpes de cada Titã
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

(`tests/run-tests.js` é uma função `async page => {...}`; qualquer runner do Playwright que abra a
página e chame a função serve.) A suíte tem 77 verificações e todas passam:

- Teclado real: iniciar, andar, atacar, trocar de Titã, pular e pausar.
- Dificuldade: troca no título e na pausa, persistência, storage bloqueado, multiplicadores e
  NORMAL igual ao balanceamento original.
- Cada golpe de cada Titã acerta (incluindo o ataque em corrida e o rinoceronte do Mutano).
- Cada ataque dos 3 chefes: aviso no chão antes do golpe e hitbox igual à marcação (dentro acerta,
  fora não acerta). Golpes e tokens do Soldado Elétrico; fraqueza do Overload.
- Titãs, avante! e regressões.
- 3 partidas completas (3 fases) do início ao fim com um bot.
- Os três chefes vencidos pelo bot **sem trapaça** no NORMAL.
- Co-op: seleção no título, controles independentes, Titãs distintos, inimigos atacando os dois,
  câmera, game over e uma fase inteira jogada por dois bots.
- Desempenho (render médio < 2 ms) e zero erros de JavaScript.

## Próximos passos sugeridos

- Mais fases (Academia H.I.V.E., Mumbo, Slade…).
- Ataques em equipe no co-op.
- Remapeamento de teclas.
