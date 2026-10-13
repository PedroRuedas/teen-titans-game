# Jovens Titãs — A Batalha de Jump City (rascunho jogável)

Beat 'em up 2.5D inspirado no *Teen Titans* de PS2 (2006): sete fases
(**Torre Titã**, **Perfuratriz do Terror**, **Usina de Energia**, **Fábrica de Gosma**, **Academia H.I.V.E.**,
**O Show do Mumbo** e **O Covil do Slade**), os 5 Titãs jogáveis com troca
em tempo real (e **golpes novos** a partir da fase 7), inimigos da série, **3 níveis de dificuldade** e
**co-op local para 2 jogadores**.

**Jogue online:** https://jovens-titas-jump-city.netlify.app

## Como jogar

Dê **dois cliques em `JOGAR.bat`** (ou abra `index.html` no Chrome/Edge/Firefox).
Não precisa instalar nada nem de internet.

No título escolha **JOGAR**, **JOGADORES (1 ou 2)**, **DIFICULDADE** e **CONTROLES**
(↑↓ escolhe, ←→ muda, ENTER confirma). A dificuldade também pode ser trocada no menu de pausa
e fica salva no navegador. Para **voltar ao menu inicial**, use **MENU INICIAL** na pausa (pede
confirmação, porque a fase em andamento é perdida) ou **Esc / II** na tela de game over.

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

### Celular e tablet (botões na tela)

Abra o link do jogo no navegador do celular, **na horizontal**. Os botões aparecem sozinhos em aparelhos
de toque:

- **Analógico** no lado esquerdo: encoste em qualquer ponto da metade esquerda e arraste (também
  navega nos menus).
- À direita: **ATAQUE**, **FORTE**, **ESPECIAL**, **PULO** e **ESQUIVA**. Nos menus, ATAQUE confirma.
- No alto: **AVANTE!** (pisca quando a energia está cheia), **TROCAR** Titã, **II** (pausa) e tela cheia.
- O item **BOTÕES NA TELA** (no título e na pausa) liga e desliga os botões e muda a **opacidade**
  (25% a 100%) com ← →. A escolha fica salva no navegador. No computador eles começam desligados.
- Os botões controlam o P1; teclado e controle (gamepad) continuam funcionando juntos.

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

### Golpes novos (fase 7 em diante)

Na fase 7 os Titãs liberam os poderes máximos: **todos os golpes dão mais dano** e o golpe forte e o
especial de cada um mudam, com referências da série:

| Titã | Forte (novo) | Especial (novo) | Também |
|---|---|---|---|
| **Robin** | **disco congelante**: atravessa a fila e prende os inimigos num bloco de gelo | **discos explosivos** (três, explodem no impacto) | o fim do combo vira o **bastão elétrico**, com descarga no chão |
| **Mutano** | **elefante**: empina e pisa com tudo | **A Fera** (de *A Fera Interior*): avança dando seis garradas | animais do combo mais fortes |
| **Ciborgue** | **mísseis do ombro**, teleguiados, que explodem no impacto | **canhão sônico na potência máxima** (mais largo e mais forte) | canhão à queima-roupa com mais alcance |
| **Ravena** | **telecinese**: arranca um pedaço do chão e arremessa | *"Azarath Metrion Zinthos!"* agora faz **tentáculos de sombra** saírem do chão embaixo de todos os inimigos da tela | — |
| **Estelar** | **starbolt gigante**, que explode no impacto | **chuva de starbolts** em cima de cada inimigo da tela | dois starbolts de uma vez no combo e no ar |

Os modelos seguem o traço da **série animada de 2003** (a mesma do jogo de PS2): corpos esguios,
rostos de queixo fino, contorno preto e sombra chapada em dois tons. Os rostos são arte vetorial
(caminhos SVG em `js/faces.js`) e a capa do Robin tem física de tecido.

- Cada Titã tem vida própria. Quem está fora de campo recupera vida aos poucos.
- Se o Titã ativo cair, entra o próximo. Ao fim de cada seção, os caídos voltam com 30% de vida.
- Acertar inimigos enche a energia. Com a barra cheia, **Titãs, avante!** acerta todos na tela.
- Caixas guardam **pizza** (vida) e **cristais** (energia).
- Todo ataque de chefe tem aviso: pose exagerada, brilho na cor do golpe, um **"!"** sobre a cabeça e
  a **área exata** marcada em vermelho no chão, que vai se preenchendo até o impacto.

## Fases

Dá para escolher a fase inicial no título (item **FASE**, com ← →), útil para testar.

1. **Torre Titã**: a H.I.V.E. invade a ilha e a torre. Inimigos: **Soldados H.I.V.E.** e os
   **Robôs do Slade** (máscara laranja). O chefe é o **Cinderblock**, com soco giratório, onda de
   choque (pule!), investida (desvie e ele fica tonto ao bater na parede) e arremesso de pedras.
2. **Perfuratriz do Terror**: túneis sob Jump City, com uma **perseguição** contra uma
   perfuratriz gigante da H.I.V.E. Inimigos: **Soldados H.I.V.E.** e **Abelhas H.I.V.E.** (listradas,
   com asas; dão uma ferroada em voo rasante e recuam). O chefe é o **Gizmo** num robô-aranha, com
   broca, chuva de mísseis (fuja dos círculos vermelhos), invocação de drones e, na fase 2, um laser.
3. **Usina de Energia**: pátio de transformadores, galpão de turbinas e o núcleo com bobinas de Tesla.
   Inimigos: só **Soldados Elétricos** (bastão elétrico, bate e recua). O chefe é o
   **Overload**: raio em linha, poças elétricas, teleporte com descarga e, abaixo de 50% de vida,
   anel de descarga e raio duplo. **Fraqueza:** depois do teleporte ele superaquece e fica com o
   **chip exposto** — dano dobrado!
4. **Fábrica de Gosma**: linha de envase com esteiras e potes, salão dos misturadores de vidro e a
   câmara de contenção estourada — tudo em azulejo verde-água e gosma rosa. Inimigos: **Gosmas**
   (pulam em cima de você; as grandes se dividem em duas pequenas) e **Soldados Químicos** (roupa
   amarela e máscara de gás; jato de gosma). O chefe é o **Plasmus**, um gigante musculoso de
   lodo: soco esticado em linha, cusparada de lodo (fuja dos círculos), onda de lodo (pule!) e,
   abaixo de 50% de vida, mergulho no chão para emergir embaixo de você. **Fraqueza:** depois do
   soco esticado o braço fica **grudado no chão** — ele trava no lugar e leva dano dobrado!
5. **Academia H.I.V.E.**: pátio da escola do crime à noite, corredor de armários e salas de aula
   ("Vilania Avançada", "Laboratório do Mal") e o salão vermelho do diretor. Inimigos: **Alunos da
   H.I.V.E.** (hipnotizados, de olhos vermelhos), **Jinx** (raio de azar rosa que corre pelo chão e
   estrela girando de perto) e **Mammoth** (super armadura: não cai com golpe comum; soco de varrer
   e pisão, ambos marcados no chão). O chefe é o **Irmão Sangue**: empurrão psíquico, raio do braço
   cibernético, **hipnose** (o círculo segue você; quem fica dentro fica tonto) e telecinese que
   arremessa carteiras e armários nos círculos marcados; abaixo de 50% chama alunos para ajudar.
   **Fraqueza:** depois da telecinese a **mente fica esgotada** — ele para e leva dano dobrado!
6. **O Show do Mumbo**: rua do teatro à noite (letreiro "MUMBO — O MAGNÍFICO"), bastidores do palco e o
   mundo **dentro da cartola**, com espiral hipnótica e cartas e cartolas flutuando. Inimigos:
   **Soldados-Carta** (cartas de baralho vivas com lança; estocada em investida) e **Coelhos Mágicos**
   gigantes (bote e salto esmagador). O chefe é o **Mumbo**: raio da varinha, leque de cartas em três
   faixas (fique no vão entre elas!), coelhos que saem de cartolas nos círculos marcados e o feitiço
   **"MUMBO JUMBO!"**, que transforma o Titã em **coelho** por alguns segundos (só anda e pula).
   **Fraqueza:** depois dos coelhos da cartola ele **deixa a varinha cair** — fica sem magia e leva
   dano dobrado!
7. **O Covil do Slade**: Jump City em ruínas sob o céu vermelho de Trigon (com os quatro olhos dele no
   céu e os cidadãos virados pedra, como em *O Fim*), o covil subterrâneo cheio de engrenagens, canos e
   telões com a máscara, e o salão do trono com o "S" gigante. **Os Titãs ganham os golpes novos.**
   Inimigos: **Robôs do Slade**, **Comandos do Slade** (armadura cobre e bastão; estocada em investida e
   giro do bastão) e **Demônios de Fogo** de Trigon (bola de fogo no círculo marcado e garrada). O chefe
   é o **Slade**, com mais vida que todos: sequência de bastão, bombas de disco nos círculos marcados e
   o **salto com o bastão** (o círculo segue você até a metade do aviso). Abaixo de 50% ganha o fogo
   de Trigon: **anel de chamas** em volta dele (fique colado nele ou bem longe) e chama comandos.
   **Fraqueza:** depois do salto ele aterrissa de joelho — **guarda aberta**, leva dano dobrado!

## Música e vozes

- A trilha das fases e do título é a **abertura de Teen Titans**, num arranjo sintetizado feito de
  memória. Os chefes têm músicas próprias.
- Por enquanto só a **Ravena fala**: "Azarath Metrion Zinthos!" no especial. O jogo toca
  `audio/vozes/ravena-azarath.mp3` (recortado da dublagem brasileira de *O Contrato de Judas*); se o
  arquivo não existir, usa a voz sintetizada do navegador.
  Os outros Titãs só mostram o balão de fala.
- Para usar a **música original** ou mais falas reais, coloque os arquivos (mp3/ogg/wav) na pasta
  `audio/` e escreva os caminhos em `audio/arquivos.js`. Se algum não for encontrado, o jogo volta
  sozinho para o som sintetizado.

## Tecnologia

- **HTML5 Canvas + JavaScript puro**, sem bibliotecas nem arquivos externos. Todos os gráficos são
  desenhados em vetor, em estilo cartoon com contorno grosso, e o áudio (efeitos e músicas) é
  sintetizado na hora com WebAudio; as vozes usam a síntese de fala do navegador.
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
js/audio.js       efeitos, músicas e vozes sintetizados
audio/arquivos.js seus próprios arquivos de música e voz (opcional)
js/render.js      modelos (rig sombreado), rostos e formas animais
js/faces.js       rostos dos Titãs em arte vetorial (caminhos SVG)
js/anim.js        animações: quadros-chave, locomoção e golpes de cada Titã
js/backgrounds.js cenários em camadas (cache em blocos)
js/entities.js    Titãs, inimigos, chefes, projéteis, itens
js/stages.js      roteiro das fases (ondas, perseguição, chefes)
js/game.js        laço do jogo, câmera, HUD e telas
js/touch.js       botões na tela para celular (analógico, golpes, opacidade)
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
página e chame a função serve.) A suíte tem 148 verificações e todas passam:

- Teclado real: iniciar, andar, atacar, trocar de Titã, pular e pausar.
- Dificuldade: troca no título e na pausa, persistência, storage bloqueado, multiplicadores e
  NORMAL igual ao balanceamento original.
- Cada golpe de cada Titã acerta (incluindo o ataque em corrida e o rinoceronte do Mutano).
- Voltar ao menu inicial pela pausa (com confirmação) e pelo game over.
- Botões na tela: o item do menu liga/desliga e muda a opacidade (e salva); o analógico navega nos
  menus e anda; ATAQUE, FORTE, ESPECIAL, PULO, TROCAR e pausa funcionam.
- Golpes novos: só a partir da fase 7, e cada golpe novo dá mais dano que o original; disco
  congelante prende o inimigo no gelo.
- Cada ataque dos chefes: aviso no chão antes do golpe e hitbox igual à marcação (dentro acerta,
  fora não acerta). Golpes e tokens do Soldado Elétrico; fraquezas do Overload, do Plasmus, do Irmão Sangue, do Mumbo
  e do Slade; golpes da Jinx, do Mammoth, do Soldado-Carta, do Coelho Mágico, do Comando do Slade e do
  Demônio de Fogo com aviso no chão; Titã virando coelho; Slade chamando comandos.
- Só a Ravena fala nos golpes; a abertura toca em todas as fases; escolha de fase no título.
- Titãs, avante! e regressões.
- 3 partidas completas (7 fases) do início ao fim com um bot.
- Os sete chefes vencidos pelo bot **sem trapaça** no NORMAL.
- Co-op: seleção no título, controles independentes, Titãs distintos, inimigos atacando os dois,
  câmera, game over e uma fase inteira jogada por dois bots.
- Desempenho (render médio < 2 ms) e zero erros de JavaScript.

## Publicar na web (Netlify)

O jogo fica em https://jovens-titas-jump-city.netlify.app. Para publicar uma versão nova, copie só
`index.html`, `js/` e `audio/` para uma pasta (ex.: `site/`) e rode, na pasta do projeto:

```
npx netlify-cli deploy --prod --no-build --dir site
```

A pasta `.netlify/` (fora do git) guarda o vínculo com o site; sem ela, use `--site jovens-titas-jump-city`.
Na primeira vez em outro computador, rode antes `npx netlify-cli login`.

## Próximos passos sugeridos

- Mais fases (Control Freak, Irmão Sangue de volta, Trigon…).
- Ataques em equipe no co-op.
- Remapeamento de teclas.
