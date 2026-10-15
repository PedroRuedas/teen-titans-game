# Publicar no itch.io (fan game gratuito)

Tudo o que você precisa está nesta pasta:

| Arquivo | Para quê |
|---|---|
| `jovens-titas-itch.zip` | o jogo (vai em **Uploads**) |
| `capa-630x500.png` | **Cover image** (a `capa-1260x1000.png` é a mesma, em alta resolução, se preferir) |
| `screenshots/` | 8 imagens para **Screenshots** |
| `descricao.html` | texto formatado para **Description** (abra no navegador e copie) |
| `montar_zip.py` | refaz o zip quando sair versão nova: `python itch-io/montar_zip.py` |

Entre na sua conta do itch.io (crie uma se ainda não tiver), abra https://itch.io/game/new e
preencha os campos de cima para baixo.

## 1. Campos do topo

**Title**
```
Jovens Titãs — A Batalha de Jump City
```

**Project URL** (o final do endereço; o itch.io já preenche a partir do título, deixe assim):
```
jovens-titas-a-batalha-de-jump-city
```

**Short description or tagline**
```
Beat 'em up de fã com os 5 Titãs: 9 fases, chefes, co-op local e online. Joga no navegador e no celular.
```

**Classification:** `Games`

**Kind of project:** `HTML` (o jogo roda no navegador)

**Release status:** `In development` (ainda vêm fases novas; troque para `Released` quando quiser)

## 2. Pricing

Marque **`No payments`**.

Não use "$0 or donate" nem preço: pedir dinheiro, mesmo como doação, transforma o fan game em uso
comercial dos personagens. É isso que costuma gerar pedido de remoção.

## 3. Uploads

1. Clique em **Upload files** e escolha `jovens-titas-itch.zip`.
2. Depois do envio, marque **This file will be played in the browser** nesse arquivo.

## 4. Embed options (aparece depois de marcar o item acima)

| Opção | Valor |
|---|---|
| Embed in page | **Manually set size** |
| Viewport dimensions | **1280** × **720** |
| Mobile friendly | ✅ marcado, com Orientation: **Landscape** |
| Automatically start on page load | ❌ desmarcado (com o botão "Run game" o som começa direito) |
| Fullscreen button | ✅ marcado |
| Enable scrollbars | ❌ desmarcado |
| SharedArrayBuffer support | ❌ desmarcado |

## 5. Details

**Description:** abra `descricao.html` no navegador (dois cliques), selecione a partir de
"Jovens Titãs — A Batalha de Jump City" até o fim, copie (Ctrl+C) e cole (Ctrl+V) no campo.
Os títulos, o negrito e a tabela de controles vão junto.

**Genre:** `Action`

**Tags** (digite uma por vez e escolha a sugestão):
```
beat-em-up
fangame
co-op
local-co-op
local-multiplayer
online
superhero
cartoon
2d
browser
```

**AI generation disclosure:** responda **Sim**. O código do jogo foi escrito com ajuda de IA
(Claude), e os gráficos e sons são desenhados por esse código. Marque as categorias que o
formulário oferecer para código, gráficos e textos.

**App store links:** deixe vazio.

**Custom noun:** deixe vazio.

## 6. Metadata (seção "Metadata", às vezes atrás de "More options")

- **Languages:** Portuguese (Brazil)
- **Inputs:** Keyboard, Mouse, Xbox controller, Playstation controller, Touchscreen
- **Accessibility:** Configurable difficulty
- **Multiplayer:** Local multiplayer, Server-based networked multiplayer
  (se tiver "Player count", coloque **1–2**)
- **Average session:** About an hour

## 7. Imagens

- **Cover image:** `capa-630x500.png`
- **Screenshots:** envie as 8 imagens de `screenshots/`, na ordem dos números
- **Gameplay video or trailer:** opcional, pode deixar vazio

## 8. Comunidade e visibilidade

- **Community:** `Comments` (os jogadores deixam comentários na página)
- **Visibility & access:** salve primeiro como **Draft**. Clique em **Save & view page**,
  teste o jogo pelo botão "Run game" e depois volte em **Edit game** e troque para **Public**.

## Bom saber

- **Jogo online:** dentro do itch.io, o botão "COPIAR LINK" da sala gera o link do site
  (pedroruedas.github.io/teen-titans-game). O amigo pode entrar por esse link ou digitando o
  código da sala no itch.io: os dois funcionam juntos.
- **Fala da Ravena:** a versão do itch.io não leva o trecho de "Azarath Metrion Zinthos" recortado
  da dublagem, porque esse áudio é da série. Lá a fala usa o som gerado pelo próprio jogo. O site
  no Netlify continua com a voz.
- **Se a Warner pedir remoção:** o itch.io avisa por e-mail e tira a página do ar. Com o jogo
  gratuito e sem doações, o mais comum é parar na remoção, mas isso não é garantido.
- **Versão nova:** rode `python itch-io/montar_zip.py`, entre em **Edit game** e troque o
  arquivo em **Uploads** (apague o zip antigo e envie o novo, marcando de novo "played in the
  browser").
