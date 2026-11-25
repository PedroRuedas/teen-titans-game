'use strict';
// Modo 3D (fase 13): no meio da fase a tela 2D se desmonta em ladrilhos e o mundo vira 3D de verdade.
// A lógica continua a do jogo 2D (x = ao longo da rua, y = profundidade no chão, z = altura); aqui só muda o
// DESENHO: a cidade, os Titãs e os inimigos viram modelos 3D (Three.js, carregado só nesta fase), animados
// pelos mesmos ângulos de pose dos bonecos 2D — então todo golpe que já existe ganha a versão 3D.
// Efeitos 2D (faíscas, textos, raios) são desenhados por cima, presos no plano vertical da profundidade de
// cada um; marcas no chão (avisos dos chefes) viram uma textura deitada sobre o asfalto.
// Uma "câmera diretora" escolhe o enquadramento: arena em 3/4, perseguição pela avenida, vista de cima,
// close no COMBO FINAL, volta completa no chefe e, na DOBRA DIMENSIONAL do Vértice, de volta ao plano.
(function () {
  const TT = window.TT, W = TT.W, H = TT.H, FT = TT.FLOOR_TOP, FB = TT.FLOOR_BOTTOM;
  const KD = 2.4, YMID = (FT + FB) / 2;
  const Zof = (y) => (y - YMID) * KD; // profundidade do jogo -> eixo Z do 3D (câmera do lado +Z)
  const PITCH_FLAT = Math.atan(1 / KD); // inclinação que imita a projeção do jogo 2D
  let T = null; // THREE
  let loading = null;
  function loadThree() {
    if (window.THREE) { T = window.THREE; return Promise.resolve(T); }
    if (loading) return loading;
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/three.min.js';
      s.onload = () => { T = window.THREE; if (T) res(T); else rej(new Error('THREE ausente')); };
      s.onerror = () => rej(new Error('falha ao carregar js/vendor/three.min.js'));
      document.head.appendChild(s);
    });
    return loading;
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const seeded = TT.seeded;

  // ------------------------------------------------------------ Pintura dos rostos 3D
  // Textura 512x256 enrolada na esfera da cabeça: o centro (256, 128) é a frente do rosto (+X), x = longitude
  // (canvas para a direita = esquerda do personagem), y = latitude. Desenha no espaço dos rostos 2D de faces.js
  // (cabeça de raio 100, y para baixo), só que de frente: 1 unidade = 0,8 px. Mesmos olhos, bocas e cores do 2D.
  const FK = 0.8, INK3 = '#140a22';
  function faceSpace(g, fn) { g.save(); g.translate(256, 128); g.scale(FK, FK); fn(); g.restore(); }
  // tudo cabelo, depois a "janela" de pele do rosto com a linha do cabelo contornada a nanquim
  function hairWindow(g, K, hair, skin, win) {
    g.fillStyle = hair; g.fillRect(0, 0, 512, 256);
    faceSpace(g, () => K.fill(g, win, skin, 6));
  }
  const nose = (g, K, skin) => K.line(g, 'M 3 12 Q 9 26 0 31', 4, K.shade(skin));
  const SIDES = (y) => `L 150 10 L 330 ${y} L 330 300 L -330 300 L -330 ${y} L -150 10 `;
  const R_MASK = 'M -92 -42 L -62 -27 C -42 -35 -16 -31 0 -23 C 16 -31 42 -35 62 -27 L 92 -42 L 86 -10 C 76 6 52 12 36 8 C 22 6 9 2 0 -2 C -9 2 -22 6 -36 8 C -52 12 -76 6 -86 -10 Z';
  const R_LENS = ['M -60 -16 C -52 -27 -25 -27 -14 -14 C -20 -4 -36 0 -47 -2 C -55 -4 -60 -10 -60 -16 Z', 'M 60 -16 C 52 -27 25 -27 14 -14 C 20 -4 36 0 47 -2 C 55 -4 60 -10 60 -16 Z'];
  const FACE3D = {
    robin(g, K, pose) {
      const skin = '#f6c7a2';
      hairWindow(g, K, '#141419', skin, 'M -150 10 L -122 -20 L -104 -50 L -84 -32 L -64 -58 L -42 -38 L -20 -62 L 0 -42 L 20 -62 L 42 -38 L 64 -58 L 84 -32 L 104 -50 L 122 -20 ' + SIDES(40) + 'Z');
      faceSpace(g, () => {
        nose(g, K, skin);
        K.fill(g, R_MASK, '#141318', 0);
        if (pose.eyes !== 'shut' && pose.eyes !== 'x') { K.fill(g, R_LENS[0], '#ffffff', 0); K.fill(g, R_LENS[1], '#ffffff', 0); }
        else K.line(g, 'M -54 -11 L -18 -11 M 18 -11 L 54 -11', 4, '#ffffff');
        K.mouth(g, 0, 58, pose);
      });
    },
    starfire(g, K, pose) {
      const skin = '#f2a14a';
      // franja reta e cheia; mechas dos lados descem emoldurando o rosto
      hairWindow(g, K, '#b81f2b', skin, 'M -76 300 L -76 -18 L -72 -34 L -58 -25 L -46 -36 L -32 -26 L -18 -37 L -4 -27 L 10 -37 L 24 -26 L 38 -36 L 52 -25 L 66 -35 L 76 -18 L 76 300 Z');
      faceSpace(g, () => {
        nose(g, K, skin);
        const o = { rx: 22, ry: 26, sclera: '#3fd36e', iris: '#a6ffbf', irisK: 0.55, pupil: '#0d7a35', look: 0, lashes: true };
        K.eye(g, -34, 2, pose, Object.assign({ lash: 1 }, o));
        K.eye(g, 34, 2, pose, Object.assign({ lash: -1 }, o));
        K.mouth(g, 0, 62, pose, { def: 'smile' });
      });
    },
    beastboy(g, K, pose) {
      const skin = '#86c95a';
      hairWindow(g, K, '#2c5e20', skin, 'M -150 10 L -120 -24 L -100 -42 L -84 -28 L -70 -52 L -52 -32 L -36 -56 L -18 -34 L 0 -58 L 18 -34 L 36 -56 L 52 -32 L 70 -52 L 84 -28 L 100 -42 L 120 -24 ' + SIDES(40) + 'Z');
      faceSpace(g, () => {
        nose(g, K, skin);
        const o = { rx: 20, ry: 23, iris: '#2f8f22', irisK: 0.56, look: 0, browCol: '#1d4214', browW: 6 };
        K.eye(g, -32, -2, pose, Object.assign({ brow: 'M -54 -30 Q -32 -40 -10 -30' }, o));
        K.eye(g, 32, -2, pose, Object.assign({ brow: 'M 10 -30 Q 32 -40 54 -30' }, o));
        K.mouth(g, 0, 56, pose, { grin: true, fang: true });
      });
    },
    cyborg(g, K, pose) {
      const skin = '#6e4329';
      g.fillStyle = '#d6dce4'; g.fillRect(0, 0, 512, 256);
      faceSpace(g, () => {
        K.line(g, 'M -330 -78 L 330 -78 M -150 -78 L -150 160 M 150 -78 L 150 160', 3, '#a8b0bc'); // emendas das placas do crânio
        // metade humana (lado direito dele) e placa de metal sobre o olho vermelho
        K.fill(g, 'M -98 -44 C -60 -52 -20 -52 4 -50 L 10 -18 L 4 30 L 12 98 C -20 106 -62 98 -86 76 C -102 50 -106 0 -98 -44 Z', skin, 5);
        nose(g, K, skin);
        K.eye(g, -34, -8, pose, { rx: 16, ry: 15, iris: '#3a2214', irisK: 0.6, look: 0, lidW: 7, brow: 'M -58 -32 L -14 -27', browW: 8 });
        g.fillStyle = '#25252c'; g.beginPath(); g.arc(36, -8, 15, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(36, -8, 9.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#ffd0d0'; g.beginPath(); g.arc(32, -12, 3.5, 0, Math.PI * 2); g.fill();
        K.mouth(g, -6, 62, pose);
      });
    },
    raven(g, K, pose, st) {
      const skin = '#c9c3d7', demon = st.faceOpt && st.faceOpt.demon;
      // cabelo violeta em chanel, franja repartida no meio deixando o chakra à mostra
      hairWindow(g, K, '#46307a', skin, 'M -78 300 L -78 -22 L -60 -34 L -20 -36 L 0 -62 L 20 -36 L 60 -34 L 78 -22 L 78 300 Z');
      faceSpace(g, () => {
        nose(g, K, skin);
        if (!demon) { g.fillStyle = '#e0233f'; g.beginPath(); g.ellipse(0, -44, 6, 7.5, 0, 0, Math.PI * 2); g.fill(); }
        const o = { rx: 22, ry: 19, iris: '#5c3fa6', irisDark: '#3a2672', irisK: 0.56, pupil: '#1a1238', look: 0, lid: skin, lidK: 0.34, lidW: 8, browCol: '#2e1d5c', browW: 4.5 };
        K.eye(g, -32, 2, pose, Object.assign({ brow: 'M -54 -20 Q -32 -28 -10 -22' }, o));
        K.eye(g, 32, 2, pose, Object.assign({ brow: 'M 10 -22 Q 32 -28 54 -20' }, o));
        if (pose.eyes !== 'shut' && pose.eyes !== 'x') K.line(g, 'M -50 18 Q -32 26 -14 16 M 14 16 Q 32 26 50 18', 3, '#7b6f92');
        K.mouth(g, 0, 62, pose);
        if (demon) { // tomada por Trigon: quatro olhos vermelhos
          for (const [ex, ey, rr] of [[-32, 4, 14], [32, 4, 14], [-22, -40, 9], [22, -40, 9]]) {
            g.fillStyle = '#ff2a3a'; g.beginPath(); g.ellipse(ex, ey, rr, rr * 0.7, 0, 0, Math.PI * 2); g.fill();
            g.fillStyle = '#ffe0e0'; g.beginPath(); g.ellipse(ex, ey, rr * 0.35, rr * 0.25, 0, 0, Math.PI * 2); g.fill();
          }
        }
      });
    },
  };
  FACE3D.apprentice = FACE3D.robin;
  FACE3D.clownbb = FACE3D.beastboy;

  // ------------------------------------------------------------ Pintura dos uniformes (tronco)
  // Textura 256x128 enrolada no cilindro do tronco: x = 64 é a frente (+X), 192 as costas, 128 o lado esquerdo
  // do personagem; y = 0 nos ombros e 128 na cintura.
  function beltBand(g, col, dark, y, h) {
    g.fillStyle = col; g.fillRect(0, y, 256, h);
    g.strokeStyle = INK3; g.lineWidth = 2; g.strokeRect(-4, y, 264, h);
    if (dark) { g.fillStyle = dark; for (let x = 4; x < 256; x += 20) g.fillRect(x, y + 4, 9, h - 8); }
  }
  function emblem(g, x, y, col, ch, chCol) {
    g.beginPath(); g.ellipse(x, y, 19, 16, 0, 0, Math.PI * 2); g.fillStyle = col; g.fill();
    g.strokeStyle = INK3; g.lineWidth = 3; g.stroke();
    g.fillStyle = chCol; g.font = 'bold 24px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, y + 1);
  }
  const TORSO3D = {
    robin(g, st) {
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      g.strokeStyle = '#7d0d14'; g.lineWidth = 3; g.beginPath(); g.moveTo(66, 0); g.lineTo(63, 98); g.stroke(); // fecho da túnica
      beltBand(g, '#f2c21c', '#b88c0e', 98, 22); // cinto de utilidades
      emblem(g, 86, 40, '#f2c21c', 'R', INK3);
    },
    apprentice(g, st) {
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#ff7a1a'; g.fillRect(0, 0, 58, 98); g.fillRect(198, 0, 58, 98); // metade laranja
      g.strokeStyle = INK3; g.lineWidth = 2; for (const x of [58, 198]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 98); g.stroke(); }
      beltBand(g, '#8a909a', '#5e646e', 98, 22);
      emblem(g, 86, 40, '#8a909a', 'S', '#ff7a1a');
    },
    starfire(g, st) {
      g.fillStyle = st.skin; g.fillRect(0, 0, 256, 128); // barriga à mostra
      g.beginPath(); g.moveTo(0, 0); g.lineTo(256, 0);
      for (let x = 256; x >= 0; x -= 8) g.lineTo(x, 54 + 8 * Math.cos((x - 64) / 256 * Math.PI * 2));
      g.closePath(); g.fillStyle = st.torso; g.fill(); g.strokeStyle = INK3; g.lineWidth = 3; g.stroke(); // top roxo
    },
    beastboy(g, st) {
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#1d1a24'; g.fillRect(0, 0, 36, 128); g.fillRect(92, 0, 72, 128); g.fillRect(220, 0, 36, 128); // laterais pretas
      g.strokeStyle = INK3; g.lineWidth = 2; for (const x of [36, 92, 164, 220]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
      beltBand(g, '#b6bcc5', null, 104, 18); // cinto prata
    },
    clownbb(g, st) {
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      const cols = ['#e8343a', '#3a6ee8', '#3ec46a'];
      for (let i = 0; i < 18; i++) { g.beginPath(); g.arc((i * 47) % 256 + 10, 14 + ((i * 29) % 100), 9, 0, Math.PI * 2); g.fillStyle = cols[i % 3]; g.fill(); }
    },
    cyborg(g, st) {
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      for (const cx of [64, 192]) { // placas azuis no peito e nas costas
        g.beginPath(); g.moveTo(cx - 46, 6); g.lineTo(cx + 46, 6); g.lineTo(cx + 38, 58); g.lineTo(cx, 78); g.lineTo(cx - 38, 58); g.closePath();
        g.fillStyle = '#3b78d8'; g.fill(); g.strokeStyle = INK3; g.lineWidth = 3; g.stroke();
      }
      g.fillStyle = '#3a3d47'; g.fillRect(64 - 30, 82, 60, 26); // abdômen escuro segmentado
      g.fillStyle = '#7a808c'; for (const y of [89, 97]) g.fillRect(64 - 26, y, 52, 3);
      g.strokeStyle = INK3; g.lineWidth = 2; g.strokeRect(64 - 30, 82, 60, 26);
      beltBand(g, '#3a3d47', null, 110, 18); // cintura
      g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(64, 34, 10, 0, Math.PI * 2); g.fill(); // luz vermelha no peito
      g.fillStyle = '#ffd0d0'; g.beginPath(); g.arc(61, 31, 3.5, 0, Math.PI * 2); g.fill();
    },
    raven(g, st) {
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      for (let x = 10; x < 256; x += 24) { // cinto de discos dourados com gemas vermelhas
        g.beginPath(); g.arc(x, 116, 9, 0, Math.PI * 2); g.fillStyle = '#e2b23c'; g.fill(); g.strokeStyle = INK3; g.lineWidth = 2; g.stroke();
        g.beginPath(); g.arc(x, 116, 4, 0, Math.PI * 2); g.fillStyle = '#d61f3a'; g.fill();
      }
    },
    slade(g, st) { // armadura: placa do peito cinza, cinto de utilidades
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#3a3e46'; g.beginPath(); g.moveTo(28, 6); g.lineTo(100, 6); g.lineTo(92, 64); g.lineTo(64, 78); g.lineTo(36, 64); g.closePath(); g.fill();
      g.strokeStyle = INK3; g.lineWidth = 2.5; g.stroke();
      g.strokeStyle = '#5a5f68'; g.lineWidth = 2; g.beginPath(); g.moveTo(64, 8); g.lineTo(64, 74); g.moveTo(40, 34); g.lineTo(88, 34); g.stroke();
      g.fillStyle = '#2a2d33'; g.fillRect(150, 10, 84, 70); g.strokeStyle = INK3; g.strokeRect(150, 10, 84, 70);
      beltBand(g, '#80868f', '#5a5f68', 98, 18);
      g.fillStyle = '#c9ced8'; g.fillRect(56, 96, 16, 22); g.strokeStyle = INK3; g.strokeRect(56, 96, 16, 22);
    },
    cinderblock(g, st) { // blocos de pedra
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      const r = seeded(77);
      for (let y = 0; y < 128; y += 26) for (let x = (y / 26) % 2 ? -20 : 0; x < 256; x += 44) {
        g.fillStyle = 'rgba(' + (r() < 0.5 ? '255,255,255,0.08' : '0,0,0,0.10') + ')'; g.fillRect(x + 2, y + 2, 40, 22);
        g.strokeStyle = 'rgba(40,36,34,0.7)'; g.lineWidth = 2.5; g.strokeRect(x, y, 44, 26);
      }
    },
    gizmo(g, st) { // macacão verde com alças e cinto de ferramentas
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      g.strokeStyle = '#2a3a22'; g.lineWidth = 9;
      g.beginPath(); g.moveTo(40, 0); g.lineTo(80, 96); g.moveTo(88, 0); g.lineTo(48, 96); g.moveTo(170, 0); g.lineTo(170, 96); g.moveTo(214, 0); g.lineTo(214, 96); g.stroke();
      beltBand(g, '#5a4a3a', '#d0a040', 96, 18);
      g.fillStyle = '#e0e4ea'; g.beginPath(); g.arc(64, 44, 8, 0, Math.PI * 2); g.fill(); g.strokeStyle = INK3; g.lineWidth = 2; g.stroke();
    },
    plasmus(g, st) { // gosma: manchas claras e escuras
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      const r = seeded(31);
      for (let i = 0; i < 26; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(120,0,60,0.16)'; g.beginPath(); g.ellipse(r() * 256, r() * 128, 6 + r() * 14, 5 + r() * 10, r() * 3, 0, Math.PI * 2); g.fill(); }
    },
    jinx(g, st) { // vestido escuro com gola em V e listra roxa
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#7a4ab0'; g.beginPath(); g.moveTo(44, 0); g.lineTo(64, 30); g.lineTo(84, 0); g.closePath(); g.fill();
      g.strokeStyle = '#7a4ab0'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 104); g.lineTo(256, 104); g.stroke();
    },
    mammoth(g, st) { // regata cinza com o símbolo da H.I.V.E. e cinto amarelo
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#e7b28a'; g.fillRect(0, 0, 256, 10); g.fillRect(20, 0, 22, 26); g.fillRect(86, 0, 22, 26); g.fillRect(150, 0, 22, 26); g.fillRect(214, 0, 22, 26);
      beltBand(g, '#f0c62e', null, 104, 16);
      g.fillStyle = '#f0c62e'; g.font = 'bold 28px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 64, 52);
    },
    mumbo(g, st) { // fraque preto, camisa branca e gravata-borboleta vermelha
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#f4f4f8'; g.beginPath(); g.moveTo(40, 0); g.lineTo(88, 0); g.lineTo(72, 110); g.lineTo(56, 110); g.closePath(); g.fill();
      g.strokeStyle = INK3; g.lineWidth = 2.5; g.stroke();
      g.fillStyle = '#c8102e'; g.beginPath(); g.moveTo(64, 10); g.lineTo(46, 2); g.lineTo(46, 20); g.closePath(); g.moveTo(64, 10); g.lineTo(82, 2); g.lineTo(82, 20); g.closePath(); g.fill(); g.stroke();
      for (const y of [40, 60, 80]) { g.fillStyle = INK3; g.beginPath(); g.arc(64, y, 3, 0, Math.PI * 2); g.fill(); }
    },
    bunnyguard(g, st) { // colete roxo com botões dourados
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#6a3ab0'; g.fillRect(0, 10, 44, 118); g.fillRect(84, 10, 172, 118);
      g.strokeStyle = INK3; g.lineWidth = 2; g.strokeRect(-2, 10, 46, 120); g.strokeRect(84, 10, 174, 120);
      for (const y of [40, 66, 92]) { g.fillStyle = '#f2c230'; g.beginPath(); g.arc(88, y, 4, 0, Math.PI * 2); g.fill(); g.stroke(); }
    },
    freak(g, st) { // camisa verde-água abotoada e cinto marrom
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      g.strokeStyle = '#1f6a60'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 100); g.stroke();
      for (const y of [22, 46, 70, 92]) { g.fillStyle = '#f4f4f8'; g.beginPath(); g.arc(70, y, 3.5, 0, Math.PI * 2); g.fill(); }
      beltBand(g, '#6a4028', null, 106, 14);
    },
    madmod(g, st) { // paletó com a bandeira britânica na frente
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      if (TT.drawUnionJack) { g.save(); g.translate(64, 56); TT.drawUnionJack(g, -40, -50, 80, 100); g.restore(); }
      g.strokeStyle = INK3; g.lineWidth = 2.5; g.strokeRect(24, 6, 80, 100);
      g.fillStyle = '#f4f4f8'; g.beginPath(); g.moveTo(52, 0); g.lineTo(64, 18); g.lineTo(76, 0); g.closePath(); g.fill();
    },
    trigon(g, st) { // peito vermelho musculoso com colar dourado
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      g.strokeStyle = 'rgba(80,0,10,0.55)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(64, 20); g.lineTo(64, 90); g.moveTo(36, 40); g.quadraticCurveTo(50, 52, 62, 44); g.moveTo(92, 40); g.quadraticCurveTo(78, 52, 66, 44);
      for (const y of [64, 78, 92]) { g.moveTo(52, y); g.lineTo(76, y); } g.stroke();
      g.fillStyle = '#e2b23c'; g.fillRect(0, 0, 256, 9); g.strokeStyle = INK3; g.lineWidth = 2; g.strokeRect(-2, 0, 260, 9);
    },
    hive(g, st) {
      g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128);
      beltBand(g, '#f0c62e', null, 104, 18);
      g.beginPath(); g.moveTo(64, 14); g.lineTo(84, 26); g.lineTo(84, 50); g.lineTo(64, 62); g.lineTo(44, 50); g.lineTo(44, 26); g.closePath();
      g.fillStyle = '#f0c62e'; g.fill(); g.strokeStyle = INK3; g.lineWidth = 2.5; g.stroke();
      g.fillStyle = INK3; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 64, 39);
    },
  };
  // Quem ganha modelo 3D: os cinco Titãs (e as versões alternativas deles) e os inimigos da fase.
  // Os outros personagens jogáveis continuam com o desenho 2D original, de pé no plano da profundidade
  // (um boneco genérico em 3D não pareceria com eles).
  // ------------------------------------------------------------ Formas em 3D
  // Animais do Mutano, corvo da alma da Ravena e coelho da maldição: esculpidos em js/beasts3d.js
  // (malha lisa de uma peça, esqueleto, olhos, dentes, garras...). Aqui só se escolhe qual montar.
  const FORM_NAMES = ['gorilla', 'trex', 'rhino', 'kangaroo', 'ram', 'elephant', 'beast', 'cheetah', 'cheetahAtk', 'soulraven', 'rabbit'];
  const FORM3D = {};
  for (const n of FORM_NAMES) FORM3D[n] = function (F, M, f) { TT.Beasts3D.make(this, n, F, M, f); };

  // ---- rostos 3D dos vilões (de frente, no mesmo traço dos Titãs)
  const shut = (pose) => pose.eyes === 'shut' || pose.eyes === 'x';
  // boca de dentes à mostra (Plasmus, Trigon, Gizmo...): w = meia largura
  function teethMouth(g, K, x, y, w, h, pose, o) {
    o = o || {};
    const open = pose.mouth === 'shout' || pose.mouth === 'open', hh = open ? h * 1.8 : h;
    const d = `M ${x - w} ${y - hh * 0.3} Q ${x} ${y + hh * 0.2} ${x + w} ${y - hh * 0.3} Q ${x + w * 0.8} ${y + hh} ${x} ${y + hh * 1.1} Q ${x - w * 0.8} ${y + hh} ${x - w} ${y - hh * 0.3} Z`;
    K.fill(g, d, o.inside || '#4a0f1c', 5);
    g.save(); g.clip(new Path2D(d));
    g.fillStyle = o.teeth || '#fbf8ec';
    const n = o.n || 6, tw = (w * 2) / n;
    for (let i = 0; i < n; i++) { const tx = x - w + i * tw; g.fillRect(tx + 1.5, y - hh * 0.6, tw - 3, hh * 0.55); }
    if (o.fangs) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + s * w * 0.55 - 6, y - hh * 0.2); g.lineTo(x + s * w * 0.55 + 6, y - hh * 0.2); g.lineTo(x + s * w * 0.55, y + hh * 0.75); g.closePath(); g.fill(); }
    if (open) { g.fillStyle = '#d24a64'; g.beginPath(); g.ellipse(x, y + hh * 0.85, w * 0.45, hh * 0.3, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
    K.line(g, d, 5);
  }
  const blush = (g, x, y, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, 14, 8, 0, 0, Math.PI * 2); g.fill(); };
  const VFACE = {
    hive(g, K, pose) { // capacete cinza e viseira amarela
      const skin = '#e8b98f';
      g.fillStyle = skin; g.fillRect(0, 0, 512, 256);
      g.fillStyle = '#5a6170'; g.fillRect(0, 0, 512, 104);
      faceSpace(g, () => {
        K.fill(g, 'M -330 -300 L 330 -300 L 330 -14 Q 160 -6 120 -8 L 104 -14 Q 0 -22 -104 -14 L -120 -8 Q -160 -6 -330 -14 Z', '#5a6170', 6);
        K.line(g, 'M -330 -70 L 330 -70', 4, '#454b58');
        K.fill(g, 'M -82 -54 L 82 -54 L 76 -14 Q 0 -6 -76 -14 Z', '#f0c62e', 6);
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(-60, -46, 70, 8);
        nose(g, K, skin);
        K.mouth(g, 0, 58, pose, { def: 'frown' });
      });
    },
    slade(g, K, pose) { // máscara dividida: metade preta (lado direito dele) e metade cobre com o olho
      g.fillStyle = '#18191d'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#d0711f'; g.fillRect(256, 0, 256, 256);
      faceSpace(g, () => {
        K.line(g, 'M 0 -330 L 0 330', 5);
        // reflexo do metal
        g.fillStyle = 'rgba(255,220,170,0.35)'; g.beginPath(); g.ellipse(60, -50, 26, 40, 0.3, 0, Math.PI * 2); g.fill();
        // olho: furo escuro com a pupila vermelha
        K.fill(g, 'M 10 -12 Q 34 -30 58 -12 Q 34 4 10 -12 Z', '#100808', 4);
        if (!shut(pose)) { g.fillStyle = '#ff4a2a'; g.beginPath(); g.arc(34, -12, 6.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffd0b0'; g.beginPath(); g.arc(32, -14, 2.2, 0, Math.PI * 2); g.fill(); }
        // respiros da boca
        for (const x of [22, 34, 46]) K.line(g, `M ${x} 44 L ${x} 76`, 5, '#18191d');
        // furo do olho do lado preto (só um contorno)
        K.line(g, 'M -58 -12 Q -34 -26 -10 -12', 3, '#2e3036');
      });
    },
    gizmo(g, K, pose) { // careca, óculos verdes e sorriso de canto com dentinho
      const skin = '#f2c7a5';
      g.fillStyle = skin; g.fillRect(0, 0, 512, 256);
      faceSpace(g, () => {
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(-10, -78, 60, 22, 0, 0, Math.PI * 2); g.fill(); // brilho da careca
        K.fill(g, 'M -330 -44 L 330 -44 L 330 -12 L -330 -12 Z', '#2c2c34', 0); // tira dos óculos
        for (const x of [-34, 34]) {
          K.fill(g, `M ${x - 29} -26 A 29 29 0 1 0 ${x + 29} -26 A 29 29 0 1 0 ${x - 29} -26 Z`, '#3a4048', 6);
          K.fill(g, `M ${x - 21} -26 A 21 21 0 1 0 ${x + 21} -26 A 21 21 0 1 0 ${x - 21} -26 Z`, shut(pose) ? '#3a8a3a' : '#7dff6a', 0);
          g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(x - 8, -34, 7, 5, -0.5, 0, Math.PI * 2); g.fill();
        }
        K.line(g, 'M -5 -26 L 5 -26', 6, '#3a4048');
        nose(g, K, skin);
        if (pose.mouth === 'shout' || pose.mouth === 'open') K.mouth(g, 0, 60, pose);
        else { K.line(g, 'M -22 56 Q 0 66 24 50', 5.5); K.fill(g, 'M 6 61 L 14 59 L 11 69 Z', '#ffffff', 2.5); }
      });
    },
    plasmus(g, K, pose, st) { // gosma rosa: olhos amarelos pequenos e sorriso de dentes
      const skin = st.skin || '#e8559a', kid = st.headR >= 20 && st.torsoH < 30;
      g.fillStyle = skin; g.fillRect(0, 0, 512, 256);
      const r = seeded(kid ? 5 : 9);
      for (let i = 0; i < 18; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(120,0,60,0.14)'; g.beginPath(); g.ellipse(r() * 512, r() * 256, 6 + r() * 16, 5 + r() * 10, r() * 3, 0, Math.PI * 2); g.fill(); }
      faceSpace(g, () => {
        g.fillStyle = 'rgba(255,220,240,0.55)'; g.beginPath(); g.ellipse(-30, -66, 34, 14, -0.3, 0, Math.PI * 2); g.fill();
        const er = kid ? 20 : 15;
        const o = { rx: er, ry: er, sclera: '#ffe14a', pupil: '#140a22', irisK: 0.9, look: 0, lidW: 5 };
        K.eye(g, -30, -4, pose, o); K.eye(g, 30, -4, pose, o);
        teethMouth(g, K, 0, 50, kid ? 38 : 46, 12, pose, { n: kid ? 5 : 7 });
      });
    },
    jinx(g, K, pose) { // pele clara, franja rosa, olhos de gato rosados e batom roxo
      const skin = '#d9d3e4';
      hairWindow(g, K, '#ff6fb8', skin, 'M -150 10 L -96 -30 L -70 -52 L -40 -30 L -18 -56 L 6 -32 L 30 -56 L 54 -30 L 78 -50 L 98 -28 ' + SIDES(30) + 'Z');
      faceSpace(g, () => {
        nose(g, K, skin);
        const o = { rx: 24, ry: 18, sclera: '#ff8ad0', irisK: 0.3, pupil: '#2a0a24', look: 0, lashes: true, lidW: 7, tilt: 0 };
        K.eye(g, -34, 0, pose, Object.assign({ lash: 1, tilt: 0.18 }, o));
        K.eye(g, 34, 0, pose, Object.assign({ lash: -1, tilt: -0.18 }, o));
        if (pose.mouth === 'shout' || pose.mouth === 'open') K.mouth(g, 0, 60, pose);
        else K.fill(g, 'M -18 58 Q -6 52 0 56 Q 6 52 18 58 Q 4 68 -18 58 Z', '#6b3f93', 3);
      });
    },
    mammoth(g, K, pose) { // juba laranja, monocelha, olhinhos e queixo largo
      const skin = '#e7b28a';
      hairWindow(g, K, '#e8762a', skin, 'M -150 10 L -110 -40 L -60 -46 L -20 -52 L 20 -50 L 60 -46 L 110 -40 ' + SIDES(40) + 'Z');
      faceSpace(g, () => {
        K.fill(g, 'M -62 -26 Q 0 -40 62 -26 L 60 -14 Q 0 -26 -60 -14 Z', '#c0581e', 3);
        for (const x of [-26, 26]) { if (shut(pose)) K.line(g, `M ${x - 9} -2 L ${x + 9} -2`, 5); else { g.fillStyle = '#140a22'; g.beginPath(); g.ellipse(x, -2, 7, 9, 0, 0, Math.PI * 2); g.fill(); } }
        K.fill(g, 'M -6 4 Q 0 0 8 4 L 14 30 Q 0 38 -14 30 Z', TT.shade(skin, -0.12), 4); // nariz largo
        K.line(g, 'M -70 60 Q -60 96 0 104 Q 60 96 70 60', 4, TT.shade(skin, -0.25)); // queixão
        for (let i = 0; i < 26; i++) { const a = -0.9 + i * 0.07; g.fillStyle = 'rgba(120,70,40,0.35)'; g.beginPath(); g.arc(Math.sin(a) * 72, 70 + Math.cos(a) * 24, 2, 0, Math.PI * 2); g.fill(); } // barba por fazer
        K.mouth(g, 0, 62, pose, { def: 'frown' });
      });
    },
    mumbo(g, K, pose) { // pele azul, cabelo branco dos lados, sobrancelhas e bigode brancos (o nariz é 3D)
      const skin = '#86aee6';
      hairWindow(g, K, '#f4f4f8', skin, 'M -96 300 L -96 -60 L 96 -60 L 96 300 Z');
      faceSpace(g, () => {
        const o = { rx: 17, ry: 19, iris: '#2a3a7a', irisK: 0.5, look: 0, lidW: 6 };
        K.eye(g, -30, -12, pose, Object.assign({ brow: 'M -56 -40 Q -30 -54 -8 -38' }, o));
        K.eye(g, 30, -12, pose, Object.assign({ brow: 'M 8 -38 Q 30 -54 56 -40' }, o));
        for (const s of [-1, 1]) K.fill(g, `M 0 30 Q ${s * 30} 22 ${s * 52} 36 Q ${s * 38} 48 ${s * 18} 44 Q ${s * 6} 42 0 40 Z`, '#f4f4f8', 4); // bigode
        K.mouth(g, 0, 64, pose, { def: 'smile' });
      });
    },
    bunnyguard(g, K, pose) { // coelho branco enfeitiçado: olhos vermelhos, focinho rosa, dentões e bigodes
      const skin = '#f6f4fa';
      g.fillStyle = skin; g.fillRect(0, 0, 512, 256);
      faceSpace(g, () => {
        for (const s of [-1, 1]) {
          if (shut(pose)) K.line(g, `M ${s * 32 - 12} -6 Q ${s * 32} 0 ${s * 32 + 12} -6`, 5);
          else { K.fill(g, `M ${s * 32 - 11} -6 A 11 15 0 1 0 ${s * 32 + 11} -6 A 11 15 0 1 0 ${s * 32 - 11} -6 Z`, '#e01a3a', 3); g.fillStyle = '#ffd0d8'; g.beginPath(); g.arc(s * 32 - 3, -12, 3.5, 0, Math.PI * 2); g.fill(); }
          K.line(g, `M ${s * 54} -36 L ${s * 16} -24`, 5); // sobrancelha brava
          blush(g, s * 50, 22, 'rgba(255,150,180,0.45)');
          K.line(g, `M ${s * 14} 30 L ${s * 70} 22 M ${s * 14} 36 L ${s * 72} 38`, 2.5, '#9a96a8'); // bigodes
        }
        K.fill(g, 'M -10 20 Q 0 14 10 20 Q 6 30 0 30 Q -6 30 -10 20 Z', '#ff8fb5', 3);
        K.line(g, 'M 0 30 L 0 40 M -16 44 Q -8 50 0 40 Q 8 50 16 44', 4);
        K.fill(g, 'M -9 44 L 9 44 L 9 62 L -9 62 Z', '#ffffff', 3); K.line(g, 'M 0 44 L 0 62', 2.5);
        if (pose.mouth === 'shout' || pose.mouth === 'open') K.fill(g, 'M -14 64 Q 0 84 14 64 Z', '#5a1020', 3);
      });
    },
    freak(g, K, pose) { // cabelo laranja espetado, sardas, bochechas coradas e sorriso
      const skin = '#f3c9a6';
      hairWindow(g, K, '#d65a24', skin, 'M -150 10 L -96 -36 L -70 -56 L -44 -40 L -22 -62 L 2 -42 L 26 -64 L 48 -42 L 72 -58 L 98 -34 ' + SIDES(40) + 'Z');
      faceSpace(g, () => {
        nose(g, K, skin);
        const o = { rx: 12, ry: 16, iris: false, pupil: '#140a22', irisK: 1.6, look: 0, sclera: skin, lidW: 0 };
        for (const s of [-1, 1]) {
          if (shut(pose)) K.line(g, `M ${s * 30 - 10} -4 Q ${s * 30} 2 ${s * 30 + 10} -4`, 5);
          else { g.fillStyle = '#140a22'; g.beginPath(); g.ellipse(s * 30, -4, 8, 12, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 30 - 2, -8, 2.5, 0, Math.PI * 2); g.fill(); }
          K.fill(g, `M ${s * 46} -30 L ${s * 14} -28 L ${s * 14} -22 L ${s * 46} -24 Z`, '#a8481e', 0); // sobrancelhas
          blush(g, s * 54, 26, 'rgba(230,110,90,0.4)');
          for (const [fx, fy] of [[40, 16], [52, 12], [46, 24], [60, 22]]) { g.fillStyle = '#c87a50'; g.beginPath(); g.arc(s * fx, fy, 2.6, 0, Math.PI * 2); g.fill(); } // sardas
        }
        void o;
        K.mouth(g, 0, 60, pose, { def: 'smile' });
        K.line(g, 'M -50 86 Q 0 104 50 86', 3.5, TT.shade(skin, -0.22)); // queixo duplo
      });
    },
    madmod(g, K, pose) { // cabelo em cuia laranja, óculos redondos azuis e sorriso de dentes separados
      const skin = '#f2c8a8';
      hairWindow(g, K, '#e8682a', skin, 'M -150 30 L -104 -6 Q -70 -24 -30 -24 Q 30 -30 82 -14 L 104 -6 ' + SIDES(50) + 'Z');
      faceSpace(g, () => {
        K.fill(g, 'M -4 4 Q 2 2 6 6 L 18 36 Q 8 44 -8 38 Z', TT.shade(skin, -0.08), 4); // narigão
        for (const x of [-32, 32]) {
          K.fill(g, `M ${x - 22} 2 A 22 22 0 1 0 ${x + 22} 2 A 22 22 0 1 0 ${x - 22} 2 Z`, '#5fc8ff', 5);
          if (!shut(pose)) { g.fillStyle = '#140a22'; g.beginPath(); g.arc(x + 2, 4, 5, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(x - 8, -6, 6, 4, -0.5, 0, Math.PI * 2); g.fill();
        }
        K.line(g, 'M -10 0 Q 0 -6 10 0 M -54 0 L -96 -6 M 54 0 L 96 -6', 4);
        teethMouth(g, K, 2, 62, 28, 9, pose, { n: 4 });
        K.line(g, 'M -40 52 Q -46 60 -40 70 M 44 52 Q 50 60 44 70', 3, TT.shade(skin, -0.25)); // vincos do sorriso
      });
    },
    trigon(g, K, pose) { // pele vermelha, quatro olhos amarelos, cabelo e barba negros, presas
      const skin = '#c8102e';
      hairWindow(g, K, '#1a1018', skin, 'M -150 -10 L -96 -44 L -50 -60 L 0 -66 L 50 -60 L 96 -44 ' + SIDES(20) + 'Z');
      faceSpace(g, () => {
        g.fillStyle = 'rgba(80,0,10,0.35)'; g.beginPath(); g.ellipse(0, -20, 70, 18, 0, 0, Math.PI * 2); g.fill();
        for (const [x, y, w] of [[-34, -6, 19], [34, -6, 19], [-24, -36, 14], [24, -36, 14]]) {
          const s = Math.sign(x), d = `M ${x - w} ${y + s * 0} Q ${x} ${y - w * 0.55} ${x + w} ${y} Q ${x} ${y + w * 0.4} ${x - w} ${y} Z`;
          if (shut(pose)) { K.line(g, `M ${x - w} ${y} L ${x + w} ${y}`, 5); continue; }
          g.save(); g.translate(x, y); g.rotate(s * 0.25); g.translate(-x, -y);
          K.fill(g, d, '#ffe14a', 4);
          g.fillStyle = '#ff9a1a'; g.beginPath(); g.ellipse(x, y, w * 0.35, w * 0.22, 0, 0, Math.PI * 2); g.fill();
          g.restore();
        }
        K.line(g, 'M -64 -50 L -10 -30 M 64 -50 L 10 -30', 7, '#1a1018');
        nose(g, K, skin);
        teethMouth(g, K, 0, 56, 34, 9, pose, { n: 6, fangs: true, inside: '#3a0610' });
        K.fill(g, 'M -46 76 Q 0 92 46 76 L 0 160 Z', '#1a1018', 4); // cavanhaque pontudo
      });
    },
  };
  VFACE.minion = VFACE.slade;
  VFACE.plasmuskid = VFACE.plasmus;
  for (const k in VFACE) FACE3D[k] = VFACE[k];
  // ---- peças 3D dos vilões (cabeça e corpo); "this" é o World3D
  const VHEAD = {
    jinx(M, hd, r) { // chifres de cabelo rosa presos com elástico preto
      for (const s of [-1, 1]) {
        const base = this.part(M, hd, this.sph(r * 0.34, 14, 10), this.toon('#e85aa8')); base.position.set(-r * 0.15, r * 0.72, s * r * 0.55);
        const h1 = this.part(M, hd, this.cone(r * 0.3, r * 1.15, 12), this.toon('#e85aa8')); h1.position.set(-r * 0.2, r * 1.25, s * r * 0.9); h1.rotation.set(s * 0.75, 0, 0.25);
        const band = this.part(M, hd, this.cyl(r * 0.3, r * 0.3, 2.4, 14), this.toon('#1a1420'), { outline: false }); band.position.set(-r * 0.17, r * 0.86, s * r * 0.64); band.rotation.set(s * 0.75, 0, 0.25);
      }
      const bang = this.part(M, hd, this.geo('jcap' + r, () => new T.SphereGeometry(r * 1.06, 24, 10, 0, Math.PI * 2, 0, 1.1)), this.toon('#e85aa8')); bang.position.x = -r * 0.08; bang.rotation.z = 0.2;
    },
    mammoth(M, hd, r) { // juba laranja espetada
      const cap = this.part(M, hd, this.geo('mcap' + r, () => new T.SphereGeometry(r * 1.08, 24, 10, 0, Math.PI * 2, 0, 1.25)), this.toon('#e8762a')); cap.position.x = -r * 0.1; cap.rotation.z = 0.25;
      for (const [x, y, z, l, rz, rx] of [[-0.2, 1, 0, 0.8, 0.3, 0], [0.25, 0.9, 0, 0.6, -0.3, 0], [-0.6, 0.75, 0, 0.8, 1.0, 0], [-0.3, 0.85, 0.5, 0.7, 0.4, 0.7], [-0.3, 0.85, -0.5, 0.7, 0.4, -0.7], [-0.85, 0.2, 0.35, 0.7, 1.6, 0.4], [-0.85, 0.2, -0.35, 0.7, 1.6, -0.4], [-0.75, -0.25, 0, 0.8, 2.2, 0]]) {
        const sp = this.part(M, hd, this.cone(r * 0.3, r * l, 8), this.toon('#e8762a')); sp.position.set(x * r, y * r, z * r); sp.rotation.set(rx, 0, rz);
      }
    },
    mumbo(M, hd, r) { // cartola com fita vermelha e narigão pontudo
      const nz = this.part(M, hd, this.cone(r * 0.2, r * 0.85, 12), this.toon('#86aee6')); nz.position.set(r * 1.18, -r * 0.08, 0); nz.rotation.z = -Math.PI / 2 - 0.25;
      const brim = this.part(M, hd, this.cyl(r * 1.25, r * 1.25, 3, 28), this.toon('#121118')); brim.position.set(-r * 0.05, r * 0.85, 0); brim.rotation.z = -0.12;
      const top = this.part(M, hd, this.cyl(r * 0.8, r * 0.85, r * 1.5, 24), this.toon('#121118')); top.position.set(-r * 0.15, r * 1.6, 0); top.rotation.z = -0.12;
      const band = this.part(M, hd, this.cyl(r * 0.87, r * 0.87, r * 0.32, 24), this.toon('#c8102e'), { outline: false }); band.position.set(-r * 0.08, r * 1.04, 0); band.rotation.z = -0.12;
    },
    bunnyguard(M, hd, r) { // orelhas de coelho
      for (const s of [-1, 1]) {
        const e = this.part(M, hd, this.cap(r * 0.24, r * 1.4), this.toon('#f6f4fa')); e.position.set(-r * 0.15, r * 1.65, s * r * 0.38); e.rotation.set(s * 0.12, 0, 0.15); e.scale.set(1, 1, 0.55);
        const inr = new T.Mesh(this.cap(r * 0.13, r * 1.1), this.toon('#ffb6c8')); inr.position.set(r * 0.12, 0, 0); inr.scale.set(0.6, 1, 0.9); e.add(inr);
      }
    },
    freak(M, hd, r) { // cabelo laranja espetado
      const cap = this.part(M, hd, this.geo('fcap' + r, () => new T.SphereGeometry(r * 1.07, 24, 10, 0, Math.PI * 2, 0, 1.0)), this.toon('#e8762a')); cap.position.x = -r * 0.08; cap.rotation.z = 0.2;
      for (const [x, y, z, rz, rx] of [[0.2, 1, 0, -0.4, 0], [-0.15, 1.05, 0.3, 0.1, 0.4], [-0.15, 1.05, -0.3, 0.1, -0.4], [-0.5, 0.85, 0, 0.7, 0], [0.45, 0.85, 0.35, -0.7, 0.4], [0.45, 0.85, -0.35, -0.7, -0.4]]) {
        const sp = this.part(M, hd, this.cone(r * 0.22, r * 0.55, 6), this.toon('#e8762a')); sp.position.set(x * r, y * r, z * r); sp.rotation.set(rx, 0, rz);
      }
    },
    madmod(M, hd, r) { // franja laranja em cuia
      const cap = this.part(M, hd, this.geo('mmcap' + r, () => new T.SphereGeometry(r * 1.08, 24, 10, 0, Math.PI * 2, 0, 1.22)), this.toon('#e8682a')); cap.position.x = -r * 0.08; cap.rotation.z = 0.12;
    },
    trigon(M, hd, r) { // galhada negra e brilho dos quatro olhos
      for (const [y, z, sz] of [[0.06, 0.34, 9], [0.06, -0.34, 9], [0.36, 0.24, 7], [0.36, -0.24, 7]]) { const gl = this.glowSprite('#ffd84a', sz, 0.5); gl.position.set(r * 0.98, r * y, r * z); hd.add(gl); }
      for (const s of [-1, 1]) {
        const a = this.part(M, hd, this.cone(r * 0.22, r * 2.2, 8), this.toon('#1a1018')); a.position.set(-r * 0.1, r * 1.7, s * r * 0.55); a.rotation.set(s * 0.35, 0, 0.25);
        const b = this.part(M, hd, this.cone(r * 0.12, r * 1.0, 6), this.toon('#1a1018')); b.position.set(r * 0.2, r * 2.1, s * r * 0.8); b.rotation.set(s * 0.5, 0, -0.6);
        const c2 = this.part(M, hd, this.cone(r * 0.1, r * 0.8, 6), this.toon('#1a1018')); c2.position.set(-r * 0.55, r * 2.3, s * r * 0.75); c2.rotation.set(s * 0.6, 0, 0.9);
      }
    },
    cinderblock(M, hd, r, st, headMesh) { // cabeça de bloco de pedra com olhos brilhando
      headMesh.visible = false;
      const box = this.part(M, hd, this.geo('cbox' + r, () => { const g = new T.BoxGeometry(r * 1.7, r * 1.9, r * 1.6, 3, 3, 3); return g; }), this.toon('#a59f96'));
      box.position.set(-r * 0.05, r * 0.05, 0);
      for (const s of [-1, 1]) { const e = new T.Mesh(this.boxG(2, 3, 5), this.neon('#ffe14a')); e.position.set(r * 0.86, r * 0.25, s * r * 0.35); hd.add(e); const gl = this.glowSprite('#ffe14a', 22, 0.9); gl.position.copy(e.position); hd.add(gl); }
      const brow = this.part(M, hd, this.boxG(4, 4, r * 1.5), this.toon('#7d776f')); brow.position.set(r * 0.86, r * 0.48, 0);
    },
  };
  const VBODY = {
    mumbo(M, st, th) { // capa preta com forro vermelho e varinha
      this.buildCloth(M, { parent: M.torso, at: [-1, th - 1, 0], rows: 9, cols: 11, len: th + st.legL[0] + st.legL[1] * 0.6, aTop: 1.6, aBot: 2.0,
        rx: [st.shW * 0.5, st.shW * 0.75], rz: [st.shW * 0.52, st.shW * 0.95], outer: '#0f0e14', inner: '#c8102e', base: 0.05, swing: 0.7, flutter: 0.07, margin: 2.5 });
      const w = M.wand = new T.Group(); M.armF.end.add(w);
      this.part(M, w, this.cyl(1.6, 1.6, 34, 8), this.toon('#121118')).position.set(4, -14, 0);
      this.part(M, w, this.cyl(1.9, 1.9, 7, 8), this.toon('#f4f4f8')).position.set(4, -32, 0);
      w.rotation.z = 2.3;
    },
    freak(M, st, th) { // capa roxa e controle remoto
      this.buildCloth(M, { parent: M.torso, at: [-1, th - 1, 0], rows: 9, cols: 11, len: th + st.legL[0] + st.legL[1] * 0.3, aTop: 1.6, aBot: 1.9,
        rx: [st.shW * 0.5, st.shW * 0.7], rz: [st.shW * 0.52, st.shW * 0.9], outer: '#6a3ab0', inner: '#3a2060', base: 0.06, swing: 0.7, flutter: 0.07, margin: 3 });
      const rm = M.remote = new T.Group(); M.armF.end.add(rm);
      this.part(M, rm, this.boxG(8, 22, 6), this.toon('#2a2a34')).position.set(2, -8, 0);
      for (const [x, y, c] of [[2, -2, '#ff3b3b'], [2, -8, '#ffe14a'], [2, -14, '#5fd0ff']]) { const b = new T.Mesh(this.sph(1.6, 8, 6), this.neon(c)); b.position.set(x + 4, y, 0); rm.add(b); }
      const tip = this.glowSprite('#7bffea', 26, 0.8); tip.position.set(2, -20, 0); rm.add(tip);
    },
    madmod(M, st) { // bengala com a espiral hipnótica
      const c = M.cane = new T.Group(); M.armF.end.add(c);
      this.part(M, c, this.cyl(1.8, 1.8, 70, 8), this.toon('#1a1218')).position.set(0, -30, 0);
      const disc = this.part(M, c, this.cyl(7, 7, 3, 20), this.toon('#ff7ae0')); disc.position.set(0, 7, 0); disc.rotation.x = Math.PI / 2;
      const sw = new T.Mesh(this.geo('swirl', () => new T.TorusGeometry(4, 0.9, 6, 20)), this.toon('#ffffff')); sw.position.set(0, 7, 1.8); c.add(sw);
      c.rotation.z = 2.2;
    },
    gizmo(M, st, th) { // mochila com quatro patas de aranha mecânicas
      const pack = this.part(M, M.torso, this.boxG(14, th * 0.8, st.shW * 0.7), this.toon('#7a808c')); pack.position.set(-st.shW * 0.32 - 6, th * 0.55, 0);
      const lt = new T.Mesh(this.sph(2.2, 8, 6), this.neon('#ff3b3b')); lt.position.set(-7.5, th * 0.25, 0); pack.add(lt);
      M.spider = [];
      for (const [y, z, a] of [[0.35, 1, 0.9], [0.35, -1, 0.9], [-0.2, 1, 1.4], [-0.2, -1, 1.4]]) {
        const leg = new T.Group(); leg.position.set(-6, th * 0.8 * y, z * st.shW * 0.3); pack.add(leg);
        const up = this.part(M, leg, this.cyl(1.6, 1.6, 24, 6), this.toon('#5a606c')); up.position.y = 12;
        const kn = new T.Group(); kn.position.y = 24; leg.add(kn);
        this.part(M, kn, this.sph(2.4, 8, 6), this.toon('#d0a040'));
        const lo = this.part(M, kn, this.cone(1.6, 22, 6), this.toon('#5a606c')); lo.position.y = 11; kn.rotation.z = -1.9;
        leg.rotation.set(z * 0.5, 0, a); leg.userData.z0 = a; M.spider.push(leg);
      }
    },
    jinx(M, st) { // saia com pontas
      const sk = this.part(M, M.hip, this.cyl(st.hipW * 0.55, st.hipW * 0.95, 14, 10, true), this.toon('#2a1a3a', { side: T.DoubleSide }));
      sk.position.y = -3; sk.scale.z = 0.85;
    },
    plasmus(M, st, th) { // pingos de gosma nos ombros e nas costas
      for (const [x, y, z, s] of [[-0.3, 0.95, 0.4, 1], [-0.4, 0.7, -0.3, 0.8], [0.1, 1.0, -0.45, 0.7], [-0.45, 0.4, 0.2, 0.9]]) {
        const d = this.part(M, M.torso, this.cap(st.armW * 0.22 * s, st.armW * 0.6 * s), this.toon(TT.shade(st.torso, -0.08))); d.position.set(x * st.shW * 0.5, y * th, z * st.shW);
      }
    },
  };
  VBODY.plasmuskid = VBODY.plasmus;
  const VILLAINS = ['minion', 'cinderblock', 'gizmo', 'plasmus', 'plasmuskid', 'jinx', 'mammoth', 'mumbo', 'bunnyguard', 'slade', 'freak', 'madmod', 'trigon'];
  const MODELED = new Set(['robin', 'apprentice', 'starfire', 'raven', 'cyborg', 'beastboy', 'clownbb'].concat(VILLAINS));
  TT.W3D_MODELED = MODELED;

  class World3D {
    constructor(game) {
      this.game = game;
      this.ready = false; this.failed = false; this.pending = false;
      this.models = new Map();
      this.cv = null; // estado atual da câmera
      this.trans = null;
      this.vec = null;
    }
    // Chamado em toda entrada na fase 13: carrega o Three.js (uma vez) e zera o estado da fase.
    prepare() {
      this.triggered = false; this.cv = null; this.trans = null;
      if (this.ready) { this.clearModels(); this.prewarmForms(); return; }
      if (this.failed || this.pending) return;
      this.pending = true;
      loadThree().then(() => {
        try { this.init(); this.ready = true; this.prewarmForms(); } catch (e) { this.fail(e); }
      }, (e) => this.fail(e)).then(() => { this.pending = false; });
    }
    // esculpe aos poucos (durante a parte 2D da fase) as formas que a equipe pode usar
    prewarmForms() {
      if (!TT.Beasts3D) return;
      // corpos esculpidos da equipe primeiro (aparecem assim que o mundo vira 3D)
      for (const t of this.game.team || []) { const k = this.modelKind(t); if (k && t.style && TT.Beasts3D.prewarmBody) TT.Beasts3D.prewarmBody(T, k, t.style); }
      if (TT.STYLES && TT.STYLES.hive && TT.Beasts3D.prewarmBody) TT.Beasts3D.prewarmBody(T, 'hive', TT.STYLES.hive);
      const keys = (this.game.team || []).map((t) => t.base || t.key), n = [];
      if (keys.includes('beastboy')) n.push('gorilla', 'trex', 'rhino', 'elephant', 'beast', 'cheetah', 'kangaroo', 'ram');
      if (keys.includes('raven')) n.push('soulraven');
      TT.Beasts3D.prewarm(T, n);
    }
    fail(e) { this.failed = true; this.pending = false; console.warn('[3D] modo 3D indisponível, a fase segue em 2D:', e && e.message); }

    // ------------------------------------------------------------ Montagem
    init() {
      this.canvas = mkCanvas(W, H);
      // celular/tablet: sem antialias e resolução menor (o WebGL grande por cima do canvas do jogo pesa na GPU do
      // aparelho e o navegador chega a parar de desenhar as camadas por cima, como o analógico)
      this.mobile = TT.isTouchDevice ? TT.isTouchDevice() : false;
      const r = this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: !this.mobile, powerPreference: this.mobile ? 'default' : 'high-performance' });
      r.setPixelRatio(1);
      r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
      r.setClearColor(0x1a0f3c, 1);
      this.vec = new T.Vector3();
      this.scene = new T.Scene();
      this.scene.fog = new T.Fog(0x5a2f6e, 3200, 9500);
      this.cam = new T.PerspectiveCamera(40, W / H, 5, 60000);
      // tons do toon (3 faixas de luz, como o desenho da série)
      const gd = new Uint8Array([105, 105, 105, 255, 185, 185, 185, 255, 255, 255, 255, 255]);
      this.grad = new T.DataTexture(gd, 3, 1, T.RGBAFormat);
      this.grad.minFilter = this.grad.magFilter = T.NearestFilter; this.grad.needsUpdate = true;
      this.mats = new Map(); this.geos = new Map(); this.faces = new Map();
      this.outlineMat = new T.ShaderMaterial({
        uniforms: { thick: { value: 1.35 }, col: { value: new T.Color(0x140a22) } },
        vertexShader: 'uniform float thick; void main(){ vec3 p = position + normal * thick; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
        fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col, 1.0); }',
        side: T.BackSide,
      });
      this.flashMat = new T.MeshBasicMaterial({ color: 0xffffff });
      this.flashMatD = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide });
      this.inkLine = new T.LineBasicMaterial({ color: 0x140a22 });
      this.tmpV = new T.Vector3(); this.invM = new T.Matrix4(); this.segs = [];
      this.glowTex = this.makeGlowTex();
      // luzes: céu roxo, chão quente e o sol do fim de tarde (com sombras)
      this.scene.add(new T.HemisphereLight(0xc6b4ff, 0x4a3040, 0.5));
      this.scene.add(new T.AmbientLight(0x6a5a8a, 0.14));
      const sun = this.sun = new T.DirectionalLight(0xffd6ae, 1.0);
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera; sc.left = -1100; sc.right = 1100; sc.top = 900; sc.bottom = -900; sc.near = 50; sc.far = 5000;
      sun.shadow.bias = -0.0006;
      this.scene.add(sun); this.scene.add(sun.target);
      this.buildSky();
      this.buildCity();
      this.buildGround();
      this.buildFx();
      this.buildOverlay();
      this.hidden = mkCanvas(2, 2).getContext('2d');
      // pós-processamento (js/gfx3d.js): oclusão, contorno, brilho, nitidez e cor
      if (TT.Gfx3D) { try { this.gfx = new TT.Gfx3D(this); } catch (e) { this.gfx = null; console.warn('[3D] pós-processamento desligado:', e && e.message); } }
    }
    // ------------------------------------------------------------ Materiais e geometrias (em cache)
    toon(col, o) {
      const k = 't' + col + (o ? JSON.stringify(o) : '');
      let m = this.mats.get(k);
      if (!m) { m = new T.MeshToonMaterial(Object.assign({ color: new T.Color(col), gradientMap: this.grad }, o)); this.mats.set(k, m); }
      return m;
    }
    gem(col, o) { // facetado e brilhante (cristais, sólidos do Vértice)
      const k = 'g' + col + (o ? JSON.stringify(o) : '');
      let m = this.mats.get(k);
      if (!m) { m = new T.MeshPhongMaterial(Object.assign({ color: new T.Color(col), flatShading: true, shininess: 90, specular: 0xffffff }, o)); this.mats.set(k, m); }
      return m;
    }
    neon(col, o) {
      const k = 'n' + col + (o ? JSON.stringify(o) : '');
      let m = this.mats.get(k);
      if (!m) { m = new T.MeshBasicMaterial(Object.assign({ color: new T.Color(col) }, o)); this.mats.set(k, m); }
      return m;
    }
    geo(key, make) { let g = this.geos.get(key); if (!g) { g = make(); this.geos.set(key, g); } return g; }
    cap(r, len) { r = Math.round(r * 10) / 10; len = Math.round(Math.max(0.5, len)); return this.geo('cap' + r + ':' + len, () => new T.CapsuleGeometry(r, len, 4, 12)); }
    sph(r, ws, hs) { r = Math.round(r * 10) / 10; return this.geo('sph' + r + ':' + (ws || 16), () => new T.SphereGeometry(r, ws || 16, hs || 12)); }
    boxG(w, h, d) { return this.geo('box' + [w, h, d].map((v) => Math.round(v)).join(':'), () => new T.BoxGeometry(w, h, d)); }
    cyl(rt, rb, h, seg, open) { return this.geo('cyl' + [rt, rb, h, seg, open ? 1 : 0].map((v) => Math.round(v * 10) / 10).join(':'), () => new T.CylinderGeometry(rt, rb, h, seg || 14, 1, !!open)); }
    cone(r, h, seg) { return this.geo('cone' + [r, h, seg].map((v) => Math.round(v * 10) / 10).join(':'), () => new T.ConeGeometry(r, h, seg || 8)); }
    makeGlowTex() {
      const c = mkCanvas(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new T.CanvasTexture(c);
    }
    glowSprite(col, size, op) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: this.glowTex, color: new T.Color(col), blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: op == null ? 1 : op, fog: false }));
      s.scale.set(size, size, 1);
      return s;
    }
    // Peça de modelo: malha com contorno preto (casca invertida), sombra e registro para o clarão de dano.
    part(M, parent, geo, mat, o) {
      const m = new T.Mesh(geo, mat);
      m.castShadow = !(o && o.noShadow);
      m.userData.mat = mat;
      if (!(o && o.outline === false)) { const ol = new T.Mesh(geo, this.outlineMat); ol.castShadow = false; m.add(ol); }
      parent.add(m);
      if (M) M.meshes.push(m);
      return m;
    }

    // ------------------------------------------------------------ Rostos (texturas pintadas no canvas)
    // A esfera da cabeça olha para +X: o centro do rosto fica no meio da textura (u = 0.5, v = 0.5).
    face(kind, st, variant) {
      const k = kind + ':' + (st.skin || '') + ':' + (st.cloak || '') + ':' + variant;
      let tx = this.faces.get(k);
      if (tx) return tx;
      if (!FACE3D[kind] && st.drawHead && TT.drawHeadToon) { tx = this.profileFace(st, variant); if (tx) { this.faces.set(k, tx); return tx; } }
      const c = mkCanvas(512, 256), g = c.getContext('2d');
      if (FACE3D[kind] && TT.FACE_KIT) {
        g.lineCap = 'round'; g.lineJoin = 'round';
        FACE3D[kind](g, TT.FACE_KIT, { eyes: variant === 'hurt' ? 'shut' : null, mouth: variant === 'open' ? 'shout' : null }, st);
      } else { g.scale(2, 2); this.simpleFace(g, kind, st, variant); }
      tx = new T.CanvasTexture(c);
      tx.anisotropy = 4;
      this.faces.set(k, tx);
      return tx;
    }
    // O desenho 2D da cabeça é de perfil (olhando para +X). Cada ponto da esfera (textura em longitude x latitude)
    // pega a cor do ponto do perfil que fica na mesma altura e na mesma posição para a frente: o olho do perfil
    // aparece dos dois lados do rosto, o cabelo e a nuca atrás, e a frente do rosto no meio.
    profileFace(st, variant) {
      const RR = 150, N = 1024, src = mkCanvas(N, N), sg = src.getContext('2d');
      sg.translate(N / 2, N / 2); sg.lineCap = sg.lineJoin = 'round';
      const pose = { eyes: variant === 'hurt' ? 'shut' : null, mouth: variant === 'open' ? 'shout' : null, lean: 0, tilt: 0, armF: [0, 0], armB: [0, 0], legF: [0, 0], legB: [0, 0] };
      try { TT.drawHeadToon(sg, st, RR, pose); } catch (e) { return null; }
      const sd = sg.getImageData(0, 0, N, N).data;
      const c = mkCanvas(512, 256), g = c.getContext('2d'), out = g.createImageData(512, 256), od = out.data;
      const sk = new T.Color(st.skin || '#f4c39e'), K = RR * 0.92;
      for (let row = 0; row < 256; row++) {
        const th = (row + 0.5) / 256 * Math.PI, y = Math.cos(th), sn = Math.sin(th);
        for (let col = 0; col < 512; col++) {
          const ph = (col + 0.5) / 512 * Math.PI * 2, x = -Math.cos(ph) * sn;
          const sx = Math.round(N / 2 + x * K), sy = Math.round(N / 2 - y * K), si = (sy * N + sx) * 4, o = (row * 512 + col) * 4;
          if (sd[si + 3] > 100) { od[o] = sd[si]; od[o + 1] = sd[si + 1]; od[o + 2] = sd[si + 2]; } else { od[o] = sk.r * 255; od[o + 1] = sk.g * 255; od[o + 2] = sk.b * 255; }
          od[o + 3] = 255;
        }
      }
      g.putImageData(out, 0, 0);
      const tx = new T.CanvasTexture(c); tx.anisotropy = 8;
      return tx;
    }
    // rosto simples dos inimigos (soldados da H.I.V.E. e outros), num canvas de 256x128
    simpleFace(g, kind, st, variant) {
      const skin = kind === 'slade' ? '#f08a1a' : st.skin || '#f4c39e';
      g.fillStyle = skin; g.fillRect(0, 0, 256, 128);
      const shut = variant === 'hurt', open = variant !== 'n';
      const OUTC = '#150b22';
      const eye = (x, y, w, h, iris) => {
        if (shut) { g.strokeStyle = OUTC; g.lineWidth = 3; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x, y + 5, x + w, y); g.stroke(); return; }
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y, w, h, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = OUTC; g.lineWidth = 2.5; g.stroke();
        g.fillStyle = iris; g.beginPath(); g.ellipse(x + 1, y + 1, w * 0.6, h * 0.66, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = OUTC; g.beginPath(); g.arc(x + 1.5, y + 1, w * 0.3, 0, Math.PI * 2); g.fill();
      };
      const mouth = (x, y) => {
        g.strokeStyle = OUTC; g.lineWidth = 2.5;
        if (open) { g.fillStyle = '#5a1020'; g.beginPath(); g.ellipse(x, y, 7, 6, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
        else { g.beginPath(); g.moveTo(x - 7, y); g.quadraticCurveTo(x, y + 3, x + 7, y - 1); g.stroke(); }
      };
      if (kind === 'hive') {
        g.fillStyle = '#f0c62e'; g.fillRect(84, 52, 88, 22); g.strokeStyle = OUTC; g.lineWidth = 3; g.strokeRect(84, 52, 88, 22);
        mouth(128, 94);
      } else {
        eye(113, 64, 8, 10, '#3a2a4a'); eye(143, 64, 8, 10, '#3a2a4a');
        g.strokeStyle = OUTC; g.lineWidth = 3; g.beginPath(); g.moveTo(102, 48); g.lineTo(120, 53); g.moveTo(136, 53); g.lineTo(154, 48); g.stroke();
        mouth(128, 92);
      }
    }
    // Uniforme pintado no tronco (emblema do Robin, placas do Ciborgue, cinto da Ravena, top da Estelar...)
    torsoMat(kind, st) {
      const P = TORSO3D[kind === 'minion' ? 'slade' : kind === 'plasmuskid' ? 'plasmus' : kind];
      if (!P) return null;
      const key = 'torso:' + kind + ':' + st.torso + ':' + (st.skin || '');
      let m = this.mats.get(key);
      if (!m) {
        const c = mkCanvas(256, 128), g = c.getContext('2d');
        P(g, st);
        const tx = new T.CanvasTexture(c); tx.anisotropy = 4;
        m = new T.MeshToonMaterial({ map: tx, gradientMap: this.grad });
        this.mats.set(key, m);
      }
      return m;
    }
    // Cabeça de desenho animado: crânio mais cheio atrás, maxilar estreito e queixo fino para a frente.
    // (as normais continuam as da esfera: o contorno e a luz ficam lisos)
    headGeo(r) {
      return this.geo('head' + r, () => {
        const g = new T.SphereGeometry(r, 32, 24), p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const nx = x / r, ny = y / r;
          if (nx < 0) x *= 1.06;
          y *= 1.03;
          if (ny < 0) {
            const d = -ny, fr = Math.max(0, nx);
            z *= 1 - 0.3 * d;
            x += r * 0.13 * d * fr;
            y -= r * 0.05 * d * fr;
          }
          p.setXYZ(i, x, y, z);
        }
        return g;
      });
    }
    torsoR(st, k) { const wW = st.waistW || st.hipW * 0.9; return lerp(wW * 0.5, st.shW * 0.47, k); }

    // ------------------------------------------------------------ Bonecos 3D
    // Esqueleto igual ao do 2D: quadril -> tronco (inclinação "lean") -> braços/cabeça; pernas no quadril.
    // Ângulos: 0 = para baixo, +PI/2 = para a frente (+X local), PI = para cima.
    buildHumanoid(f, kind) {
      const st = f.style;
      const M = { root: new T.Group(), meshes: [], kind, st, faceMats: [], cloths: [] };
      const L1 = st.legL[0], L2 = st.legL[1];
      const shape = kind === 'cuboid' ? 'box' : kind === 'vertice' ? 'crystal' : 'toon';
      const MAT = (c) => (shape === 'crystal' ? this.gem(c) : this.toon(c));
      M.rp = new T.Group(); M.rp.position.y = 12; M.root.add(M.rp);
      M.rpi = new T.Group(); M.rpi.position.y = -12; M.rp.add(M.rpi);
      M.sp = new T.Group(); M.rpi.add(M.sp);
      M.spi = new T.Group(); M.sp.add(M.spi);
      M.hip = new T.Group(); M.spi.add(M.hip);
      M.torso = new T.Group(); M.hip.add(M.torso);
      const th = st.torsoH, shW = st.shW, wW = st.waistW || st.hipW * 0.9;
      const i0 = M.meshes.length; // peças do corpo simples (tronco e membros): trocadas pelo corpo esculpido
      // ---- tronco
      if (shape === 'box') {
        this.part(M, M.torso, this.boxG(wW, th * 0.5, wW * 0.8), MAT(TT.shade(st.torso, -0.1))).position.y = th * 0.25;
        this.part(M, M.torso, this.boxG(shW, th * 0.55, shW * 0.7), MAT(st.torso)).position.y = th * 0.74;
        const core = new T.Mesh(this.boxG(10, 10, 10), this.neon(TT.F13.NEON)); core.position.set(shW * 0.36, th * 0.74, 0); M.torso.add(core);
        const g = this.glowSprite(TT.F13.NEON, 46, 0.8); g.position.copy(core.position); M.torso.add(g);
      } else if (shape === 'crystal') {
        this.part(M, M.torso, this.cyl(shW * 0.56, wW * 0.3, th, 6), MAT(st.torso)).position.y = th * 0.5;
        const core = new T.Mesh(this.geo('octa8', () => new T.OctahedronGeometry(8)), this.neon(TT.F13.NEON)); core.position.set(shW * 0.3, th * 0.55, 0); M.torso.add(core);
        M.core = core;
        const g = this.glowSprite(TT.F13.NEON, 60, 0.9); g.position.copy(core.position); M.torso.add(g);
        for (const s of [-1, 1]) { const o = this.part(M, M.torso, this.geo('octa13', () => new T.OctahedronGeometry(13)), this.gem('#a8e8ff')); o.position.set(0, th - 2, s * shW * 0.5); }
      } else {
        const t1 = this.part(M, M.torso, this.cyl(shW * 0.47, wW * 0.5, th, 24), this.torsoMat(kind, st) || MAT(st.torso));
        t1.position.y = th / 2; t1.scale.z = 0.66;
        const chest = this.part(M, M.torso, this.geo('dome' + Math.round(shW), () => new T.SphereGeometry(shW * 0.47, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2)), MAT(st.torso));
        chest.position.y = th; chest.scale.set(1, 0.4, 0.66);
        const pel = this.part(M, M.hip, this.sph(st.hipW * 0.55), MAT(kind === 'raven' || kind === 'starfire' ? st.torso : st.leg));
        pel.position.y = -1; pel.scale.set(1, 0.62, 0.74);
        this.part(M, M.torso, this.cyl(st.headR * 0.32, st.headR * 0.34, (st.neck || 3) + 8, 10), MAT(st.neckCol || st.skin)).position.y = th + (st.neck || 3) / 2 + 2;
      }
      // ---- membros
      const legOpt = st.legOpt || {}, armOpt = st.armOpt || {};
      M.legB = this.limb(M, M.hip, -3, 0, -st.hipW * 0.33, L1, L2, st.legW, st.leg, st.boot, legOpt, st.footR, st.boot, true, shape);
      M.legF = this.limb(M, M.hip, 3, 0, st.hipW * 0.33, L1, L2, st.legW, st.leg, st.boot, legOpt, st.footR, st.boot, true, shape);
      M.armB = this.limb(M, M.torso, -shW * 0.16, th - 5, -shW * 0.47, st.armL[0], st.armL[1], st.armW, st.arm, st.glove, armOpt, st.handR, st.hand, false, shape);
      M.armF = this.limb(M, M.torso, shW * 0.12, th - 6, shW * 0.47, st.armL[0], st.armL[1], st.armW, st.arm, st.glove, armOpt, st.handR, st.hand, false, shape);
      const i1 = M.meshes.length;
      // ---- cabeça
      M.head = new T.Group(); M.torso.add(M.head);
      M.headY = th + (st.neck || 3) + st.headR * 0.85;
      M.head.position.set(st.headOff || 0, M.headY, 0);
      this.buildHead(M, f, kind, st, shape);
      // ---- brilhos das mãos (auras da Ravena e da Estelar, poderes)
      M.glowF = this.glowSprite('#ffffff', 40, 0); M.armF.end.add(M.glowF);
      M.glowB = this.glowSprite('#ffffff', 34, 0); M.armB.end.add(M.glowB);
      this.buildExtras(M, f, kind, st);
      // corpo esculpido (roupa com detalhe: mãos com dedos, punhos, botas com sola...) em js/beasts3d.js
      if (shape === 'toon' && TT.Beasts3D && TT.Beasts3D.humanBody) {
        try {
          TT.Beasts3D.humanBody(this, M, kind, st, TORSO3D[kind] || null);
          for (const m of M.meshes.slice(i0, i1)) m.visible = false;
          M.meshes.splice(i0, i1 - i0);
          M.sculpted = true;
        } catch (e) { console.warn('[3D] corpo esculpido falhou:', e && e.message); }
      }
      return M;
    }
    limb(M, parent, x, y, z, L1, L2, w, c1, c2, opt, endR, endCol, isLeg, shape) {
      const up = new T.Group(); up.position.set(x, y, z); parent.add(up);
      const lo = new T.Group(); lo.position.y = -L1; up.add(lo);
      const r0 = w * (isLeg ? 0.56 : 0.54), r1 = w * 0.47;
      const split = opt.split != null ? opt.split : 2;
      const seg = (g, from, to, r, col) => {
        const len = to - from; if (len < 0.6) return;
        let geo;
        if (shape === 'box') geo = this.boxG(w, len + 2, w);
        else if (shape === 'crystal') geo = this.cyl(r * 1.05, r * 0.75, len + 2, 5);
        else geo = this.cap(r, Math.max(0.5, len - r * 0.4));
        const m = this.part(M, g, geo, shape === 'crystal' ? this.gem(col) : this.toon(col));
        m.position.y = -(from + to) / 2;
      };
      if (split >= 1) seg(up, 0, L1, r0, c1); else { seg(up, 0, split * L1, r0, c1); seg(up, split * L1, L1, r0 * 1.04, c2); }
      if (split <= 1) seg(lo, 0, L2, r1, c2);
      else if (split < 2) { seg(lo, 0, (split - 1) * L2, r1, c1); seg(lo, (split - 1) * L2, L2, r1 * 1.05, c2); }
      else seg(lo, 0, L2, r1, c1);
      if (shape === 'toon') {
        if (opt.sleeve) { const m = this.part(M, up, this.cap(r0 * 1.14, opt.sleeve.len * L1), this.toon(opt.sleeve.col)); m.position.y = -opt.sleeve.len * L1 / 2; }
        for (const b of opt.band || []) { // braçadeiras e faixas (Ciborgue, Estelar, Aprendiz)
          const onUp = b.at < 1, L = onUp ? L1 : L2, r = (onUp ? r0 : r1) * 1.16;
          const m = this.part(M, onUp ? up : lo, this.cyl(r, r, Math.max(1.5, b.len * L), 12), this.toon(b.col), { outline: false });
          m.position.y = -((onUp ? b.at : b.at - 1) + b.len / 2) * L;
          if (b.gem) { const gm = new T.Mesh(this.sph(2.2, 8, 6), this.neon(b.gem)); gm.position.set(r, 0, 0); m.add(gm); }
        }
      }
      const end = new T.Group(); end.position.y = -L2; lo.add(end);
      if (isLeg) {
        let m;
        if (shape === 'box') { m = this.part(M, end, this.boxG(endR * 2.6, endR * 1.3, endR * 1.6), this.toon(endCol)); m.position.set(endR * 0.7, -endR * 0.2, 0); }
        else { m = this.part(M, end, this.sph(endR), shape === 'crystal' ? this.gem(endCol) : this.toon(endCol)); m.position.set(endR * 0.55, -endR * 0.15, 0); m.scale.set(1.6, 0.72, 0.9); }
      } else if (shape === 'box') this.part(M, end, this.boxG(endR * 1.8, endR * 1.8, endR * 1.8), this.toon(endCol));
      else this.part(M, end, this.sph(endR), shape === 'crystal' ? this.gem(endCol) : this.toon(endCol));
      return { up, lo, end };
    }
    // Cabeça de cada personagem: rosto pintado + volume do cabelo, capuz, orelhas, peças de metal...
    buildHead(M, f, kind, st, shape) {
      const r = st.headR, hd = M.head;
      if (shape === 'box') {
        this.part(M, hd, this.boxG(r * 1.8, r * 1.7, r * 1.7), this.toon(st.skin));
        const eye = new T.Mesh(this.boxG(4, 6, 10), this.neon('#ffffff')); eye.position.set(r * 0.92, 2, r * 0.25); hd.add(eye);
        const pupil = new T.Mesh(this.boxG(3, 4, 5), this.neon(TT.F13.NEON2)); pupil.position.set(r * 0.96, 2, r * 0.3); hd.add(pupil);
        return;
      }
      if (shape === 'crystal') {
        this.part(M, hd, this.geo('ico' + r, () => new T.IcosahedronGeometry(r * 1.2, 0)), this.gem('#dff9ff', { emissive: 0x203050 }));
        const eye = new T.Mesh(this.sph(r * 0.36, 12, 8), this.neon(TT.F13.NEON2)); eye.position.set(r * 0.95, 0, r * 0.15); eye.scale.set(0.5, 0.8, 1.2); hd.add(eye);
        const eg = this.glowSprite(TT.F13.NEON2, 50, 0.9); eg.position.copy(eye.position); hd.add(eg);
        M.halo = [];
        for (let i = 0; i < 2; i++) {
          const ring = new T.Mesh(this.geo('halo' + i, () => new T.TorusGeometry(r * (2 + i * 0.5), 1.2, 6, 40)), this.neon(i ? TT.F13.NEON2 : TT.F13.NEON));
          ring.position.set(-r * 0.6, r * 0.2, 0); hd.add(ring); M.halo.push(ring);
        }
        M.orbit = [];
        const shapes = [new T.TetrahedronGeometry(7), new T.BoxGeometry(9, 9, 9), new T.OctahedronGeometry(7), new T.TetrahedronGeometry(6), new T.DodecahedronGeometry(6)];
        shapes.forEach((g, i) => { const m = new T.Mesh(g, this.gem(i % 2 ? '#ff9ae8' : '#9af5ff', { emissive: i % 2 ? 0x601040 : 0x104060 })); m.castShadow = true; M.torso.add(m); M.orbit.push(m); });
        return;
      }
      const variants = {};
      const faceMat = (v) => variants[v] || (variants[v] = new T.MeshToonMaterial({ map: this.face(kind, st, v), gradientMap: this.grad }));
      const headMesh = this.part(M, hd, FACE3D[kind] ? this.headGeo(r) : this.sph(r, 24, 16), faceMat('n'));
      M.faceMesh = headMesh; M.faceMat = faceMat;
      // volume do cabelo: calota sobre o crânio (a linha do cabelo na testa vem pintada no rosto)
      const capG = (len) => this.geo('hcap' + r + ':' + len, () => new T.SphereGeometry(r * 1.1, 28, 10, 0, Math.PI * 2, 0, Math.PI * len));
      const hairCap = (col, len, tilt) => { const m = this.part(M, hd, capG(len), this.toon(col, { side: T.DoubleSide })); m.position.x = -r * 0.05; m.rotation.z = tilt || 0; return m; };
      const spikes = (col, list) => {
        for (const [ax, ay, az, len] of list) {
          const dir = new T.Vector3(ax, ay, az).normalize(), h = r * len;
          const c = this.part(M, hd, this.cone(r * 0.3, h, 6), this.toon(col));
          c.position.copy(dir).multiplyScalar(r * 0.98 + h * 0.22); c.position.x -= r * 0.06;
          c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
        }
      };
      const skinBit = (x, y, z, sx, sy, sz) => { const e = this.part(M, hd, this.sph(r * 0.3, 10, 8), this.toon(st.skin)); e.position.set(x, y, z); e.scale.set(sx, sy, sz); return e; };
      if (kind === 'robin' || kind === 'apprentice') {
        // mechas grossas e curtas penteadas para cima e para trás
        hairCap('#141419', 0.3, 0.18);
        spikes('#141419', [[-0.5, 0.86, 0, 0.95], [-0.85, 0.5, 0.26, 0.95], [-0.85, 0.5, -0.26, 0.95], [-0.97, 0.1, 0.42, 0.8], [-0.97, 0.1, -0.42, 0.8], [-0.97, -0.25, 0, 0.75],
          [-0.12, 1, 0.34, 0.78], [-0.12, 1, -0.34, 0.78], [0.32, 0.95, 0, 0.62], [0.3, 0.9, 0.4, 0.5], [0.3, 0.9, -0.4, 0.5], [-0.45, 0.62, 0.64, 0.7], [-0.45, 0.62, -0.64, 0.7]]);
        for (const s of [-1, 1]) skinBit(-r * 0.05, -r * 0.08, s * r * 0.98, 0.55, 0.85, 0.38); // orelhas
      } else if (kind === 'beastboy' || kind === 'clownbb') {
        hairCap('#2c5e20', 0.3, 0.18);
        spikes('#2c5e20', [[-0.6, 0.8, 0, 0.75], [-0.9, 0.42, 0.3, 0.7], [-0.9, 0.42, -0.3, 0.7], [-0.97, 0, 0.4, 0.6], [-0.97, 0, -0.4, 0.6], [-0.1, 1, 0.3, 0.6], [-0.1, 1, -0.3, 0.6],
          [0.7, 0.66, 0, 0.5], [0.62, 0.7, 0.35, 0.45], [0.62, 0.7, -0.35, 0.45], [-0.4, 0.66, 0.62, 0.55], [-0.4, 0.66, -0.62, 0.55]]);
        for (const s of [-1, 1]) { // orelhas pontudas (élficas), para trás e para cima
          const e = this.part(M, hd, this.cone(r * 0.2, r * 0.95, 6), this.toon(st.skin));
          e.position.set(-r * 0.35, r * 0.05, s * r * 1.02); e.rotation.set(s * 1.15, 0, 0.95);
        }
        if (kind === 'clownbb') {
          const nose = this.part(M, hd, this.sph(r * 0.24, 12, 10), this.toon('#ff2a3a')); nose.position.set(r * 1.08, -r * 0.12, 0);
          const hat = this.part(M, hd, this.cone(r * 0.42, r * 0.95, 12), this.toon('#3a6ee8')); hat.position.set(-r * 0.1, r * 1.38, 0); hat.rotation.z = 0.28;
          const pom = this.part(M, hd, this.sph(r * 0.16, 10, 8), this.toon('#ffd23a')); pom.position.set(-r * 0.34, r * 1.85, 0);
        }
      } else if (kind === 'starfire') {
        hairCap('#b81f2b', 0.36, 0.05);
        for (const s of [-1, 1]) { // mechas descendo dos lados do rosto
          const l = this.part(M, hd, this.cap(r * 0.2, r * 1.35), this.toon('#b81f2b')); l.position.set(r * 0.28, -r * 0.45, s * r * 0.9); l.scale.set(1.15, 1, 0.42); l.rotation.x = s * 0.06;
        }
      } else if (kind === 'raven') {
        hairCap('#46307a', 0.38, 0.12);
        for (const s of [-1, 1]) { // chanel até o queixo
          const l = this.part(M, hd, this.cap(r * 0.3, r * 0.75), this.toon('#46307a')); l.position.set(r * 0.1, -r * 0.35, s * r * 0.9); l.scale.set(1, 1, 0.6);
        }
        // capuz levantado: aberto na frente, forro escuro por dentro, descendo até os ombros
        const hc = (st.faceOpt && st.faceOpt.hood) || ['#10153f', st.cloak || '#2a3a9e'];
        const hg = this.geo('hood' + r, () => new T.SphereGeometry(r * 1.32, 28, 16, Math.PI + 1.0, Math.PI * 2 - 2.0, 0, Math.PI * 0.8));
        const hood = this.part(M, hd, hg, this.toon(st.cloak || hc[1], { side: T.FrontSide }));
        hood.position.set(-r * 0.14, r * 0.1, 0);
        const lining = new T.Mesh(hg, this.toon(hc[0], { side: T.BackSide })); lining.userData.mat = lining.material; hood.add(lining); M.meshes.push(lining);
      } else if (kind === 'cyborg') {
        for (const s of [-1, 1]) { // peças dos ouvidos
          const e = this.part(M, hd, this.cyl(r * 0.42, r * 0.42, 5, 16), this.toon('#3a3d47')); e.position.set(-r * 0.12, -r * 0.05, s * r * 0.98); e.rotation.x = Math.PI / 2;
          const b = new T.Mesh(this.cyl(r * 0.2, r * 0.2, 1, 12), this.neon('#3b78d8')); b.position.y = s * 2.6; e.add(b);
        }
      } else if (VHEAD[kind]) {
        VHEAD[kind].call(this, M, hd, r, st, headMesh);
      } else if (kind === 'hive') {
        const helm = this.part(M, hd, this.geo('hhelm' + r, () => new T.SphereGeometry(r * 1.07, 24, 10, 0, Math.PI * 2, 0, 1.05)), this.toon('#5a6170')); helm.position.x = -r * 0.1; helm.rotation.z = 0.35;
      } else if (!VFACE[kind]) { // (os vilões com rosto próprio já têm o cabelo/careca pintado)
        hairCap(st.hairCol || '#2a2038', 0.4, 0.2);
      }
    }
    buildExtras(M, f, kind, st) {
      const th = st.torsoH, r = st.headR, shW = st.shW;
      if (kind === 'robin') {
        // gola alta e capa: preta por fora, forro amarelo por dentro
        const col = this.part(M, M.torso, this.cyl(shW * 0.25, shW * 0.33, 7, 18, true), this.toon('#17171d', { side: T.DoubleSide }));
        col.position.y = th + 1.5;
        this.buildCloth(M, { parent: M.torso, at: [-1, th - 1, 0], rows: 9, cols: 9, len: th + st.legL[0] + st.legL[1] * 0.4, aTop: 1.2, aBot: 1.4,
          rx: [shW * 0.5, shW * 0.5], rz: [shW * 0.5, shW * 0.84], outer: '#1c1b22', inner: '#efb81e', base: 0.07, swing: 0.9, flutter: 0.08, margin: 2.5 });
      } else if (kind === 'apprentice') {
        for (const s of [-1, 1]) { const p = this.part(M, M.torso, this.sph(st.armW * 0.95, 12, 8), this.toon('#8a909a')); p.position.set(0, th - 3, s * shW * 0.47); p.scale.set(1, 0.7, 1); } // ombreiras
      } else if (kind === 'raven') {
        // manto longo preso nos ombros, aberto na frente
        const hc = (st.faceOpt && st.faceOpt.hood) || ['#10153f', st.cloak || '#2a3a9e'];
        this.buildCloth(M, { parent: M.torso, at: [0, th + 1, 0], rows: 9, cols: 15, len: th + st.legL[0] + st.legL[1] - 4, aTop: 2.45, aBot: 2.7,
          rx: [shW * 0.5, shW * 0.95], rz: [shW * 0.52, shW * 0.98], outer: st.cloak || '#2a3a9e', inner: hc[0], base: 0.03, swing: 0.55, flutter: 0.05, margin: 2 });
        const br = this.part(M, M.torso, this.cyl(3.4, 3.4, 1.6, 14), this.toon('#e2b23c')); br.rotation.z = Math.PI / 2; br.position.set(this.torsoR(st, 1) * 0.85 + 1.5, th - 1, 0); // broche
        const gm = new T.Mesh(this.sph(1.7, 8, 6), this.neon('#d61f3a')); gm.position.y = 1; br.add(gm);
      } else if (kind === 'starfire') {
        // cabelão vermelho, liso, descendo pelas costas até a cintura
        this.buildCloth(M, { parent: M.head, at: [-r * 0.08, r * 0.2, 0], rows: 8, cols: 9, len: r * 0.9 + th * 0.85, aTop: 1.45, aBot: 1.0,
          rx: [r * 1.14, r * 0.74], rz: [r * 1.14, r * 0.72], outer: '#b81f2b', inner: '#7e1018', base: 0.1, swing: 0.45, flutter: 0.06, margin: 2 });
        const collar = this.part(M, M.torso, this.geo('collar', () => new T.TorusGeometry(shW * 0.3, 2.2, 6, 16)), this.toon('#c9cfd8'), { outline: false });
        collar.rotation.x = Math.PI / 2; collar.position.y = th + 1;
        const gm = new T.Mesh(this.sph(2.6, 8, 6), this.neon('#3ee07a')); gm.position.set(shW * 0.3 + 1, th, 0); M.torso.add(gm);
        // minissaia roxa
        const sk = this.part(M, M.hip, this.cyl(st.hipW * 0.56, st.hipW * 0.8, 13, 18, true), this.toon(st.torso, { side: T.DoubleSide }));
        sk.position.y = -2.5; sk.scale.z = 0.8;
      } else if (kind === 'cyborg') {
        const R = this.torsoR(st, 0.73);
        const light = new T.Mesh(this.cyl(5, 5, 1.6, 16), this.neon('#ff3b3b')); light.rotation.z = Math.PI / 2; light.position.set(R + 0.6, th * 0.73, 0); M.torso.add(light);
        const lg = this.glowSprite('#ff3b3b', 26, 0.8); lg.position.copy(light.position); M.torso.add(lg);
        for (const s of [-1, 1]) { // ombros de metal com placa azul
          const sh = this.part(M, M.torso, this.sph(st.armW * 0.66), this.toon('#c9ced8')); sh.position.set(0, th - 3, s * shW * 0.47); sh.scale.set(1, 0.85, 1);
          const pl = this.part(M, sh, this.sph(st.armW * 0.55, 14, 10), this.toon('#3b78d8'), { outline: false }); pl.position.z = s * st.armW * 0.42; pl.scale.z = 0.45;
        }
        // canhão sônico: o antebraço da frente vira canhão nos golpes de canhão (pose.form = 'cannon')
        const L2 = st.armL[1], cn = M.cannon = new T.Group(); M.armF.lo.add(cn); cn.visible = false;
        this.part(M, cn, this.cyl(9, 10, 27, 18), this.toon('#9aa2ae')).position.y = -L2 + 0.5;
        this.part(M, cn, this.cyl(10.6, 10.6, 7, 18), this.toon('#3b78d8'), { outline: false }).position.y = -L2 + 3;
        const mz = new T.Mesh(this.cyl(6.5, 6.5, 1.5, 16), this.neon('#bfe6ff')); mz.position.y = -L2 - 13.6; cn.add(mz);
        const mg = this.glowSprite('#4fb4ff', 52, 1); mg.position.y = -L2 - 17; cn.add(mg);
      } else if (kind === 'clownbb') {
        const ruff = this.part(M, M.torso, this.geo('ruff', () => new T.TorusGeometry(shW * 0.32, 3.2, 8, 18)), this.toon('#ffffff'));
        ruff.rotation.x = Math.PI / 2; ruff.position.y = th + 1;
      }
      if (VBODY[kind]) VBODY[kind].call(this, M, st, th, r, shW);
      // bastão do Robin (aparece nos golpes de bastão)
      M.staff = new T.Group(); M.armF.end.add(M.staff); M.staff.visible = false;
      const sm = new T.Mesh(this.cyl(2.6, 2.6, 1, 8), this.toon('#c3cad6')); sm.castShadow = true; M.staff.add(sm); M.staffMesh = sm;
    }

    // ------------------------------------------------------------ Tecido (capa, manto, cabelo longo)
    // Faixa de N linhas x K colunas, cada linha um arco em volta do eixo do corpo (aberto na frente).
    // A cada quadro as linhas pendem do ponto de apoio, balançam PARA TRÁS com o movimento e são empurradas
    // para fora do corpo (tronco, braços e pernas), então o pano nunca atravessa o boneco.
    buildCloth(M, o) {
      const N = o.rows, K = o.cols;
      const pos = new Float32Array(N * K * 3), uv = new Float32Array(N * K * 2), idx = [];
      for (let i = 0; i < N; i++) for (let j = 0; j < K; j++) { uv[(i * K + j) * 2] = j / (K - 1); uv[(i * K + j) * 2 + 1] = 1 - i / (N - 1); }
      for (let i = 0; i < N - 1; i++) for (let j = 0; j < K - 1; j++) { const a = i * K + j, b = a + K; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
      geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      const border = [];
      for (let i = 0; i < N; i++) border.push(i * K);
      for (let j = 1; j < K; j++) border.push((N - 1) * K + j);
      for (let i = N - 2; i >= 0; i--) border.push(i * K + K - 1);
      const lp = new Float32Array(border.length * 3), lg = new T.BufferGeometry();
      lg.setAttribute('position', new T.BufferAttribute(lp, 3).setUsage(T.DynamicDrawUsage));
      const line = new T.Line(lg, this.inkLine);
      line.frustumCulled = false; M.root.add(line);
      for (const [col, side] of [[o.outer, T.FrontSide], [o.inner, T.BackSide]]) { // fora: faces da frente; forro: as de trás
        const m = new T.Mesh(geo, this.toon(col, { side }));
        m.castShadow = true; m.frustumCulled = false;
        m.userData.mat = m.material; m.userData.flash = this.flashMatD;
        M.root.add(m); M.meshes.push(m);
      }
      const anchor = new T.Object3D(); anchor.position.set(o.at[0], o.at[1], o.at[2]); o.parent.add(anchor);
      M.cloths.push(Object.assign({ geo, pos, lp, lg, border, anchor, cur: new Float32Array(N * 2), init: false }, o));
    }
    // Contorno do corpo visto de lado (no espaço do modelo): segmentos [x0, y0, x1, y1, raio]
    bodySegs(M) {
      const S = this.segs, inv = this.invM, v = this.tmpV, st = M.st;
      S.length = 0;
      const P = (obj, x, y) => { v.set(x, y, 0).applyMatrix4(obj.matrixWorld).applyMatrix4(inv); return [v.x, v.y]; };
      const back = [P(M.hip, -st.hipW * 0.55, -1)];
      for (const k of [0, 0.5, 1]) back.push(P(M.torso, -this.torsoR(st, k), k * st.torsoH));
      for (let i = 0; i < back.length - 1; i++) S.push([back[i][0], back[i][1], back[i + 1][0], back[i + 1][1], 0.5]);
      const limb = (L, rad, endR) => {
        const a = P(L.up, 0, 0), b = P(L.lo, 0, 0), c = P(L.end, 0, 0);
        S.push([a[0], a[1], b[0], b[1], rad], [b[0], b[1], c[0], c[1], Math.max(rad, endR)]);
      };
      limb(M.legB, st.legW * 0.6, st.footR * 0.8); limb(M.legF, st.legW * 0.6, st.footR * 0.8);
      limb(M.armB, st.armW * 0.6, st.handR); limb(M.armF, st.armW * 0.6, st.handR);
      return S;
    }
    // x mais para trás ocupado pelo corpo na altura h
    backAt(S, h) {
      let m = 1e9;
      for (const s of S) {
        const lo = Math.min(s[1], s[3]) - s[4], hi = Math.max(s[1], s[3]) + s[4];
        if (h < lo || h > hi) continue;
        const dy = s[3] - s[1];
        const x = Math.abs(dy) < 1e-3 ? Math.min(s[0], s[2]) : s[0] + (s[2] - s[0]) * TT.clamp((h - s[1]) / dy, 0, 1);
        if (x - s[4] < m) m = x - s[4];
      }
      return m;
    }
    updateCloths(M, f, pose) {
      M.root.updateMatrixWorld(true);
      this.invM.copy(M.root.matrixWorld).invert();
      const S = this.bodySegs(M), v = this.tmpV, t = f.animT || 0;
      const drag = Math.min(1.25, (pose.cape || 0) + (f.z > 2 ? 0.3 : 0));
      for (const C of M.cloths) {
        const N = C.rows, K = C.cols, cur = C.cur, pos = C.pos;
        C.anchor.getWorldPosition(v); v.applyMatrix4(this.invM);
        const ax = v.x, ay = v.y, az = v.z, seg = C.len / (N - 1), sw = C.base + drag * C.swing;
        // alvo: corrente pendurada, curvando para trás conforme o personagem corre/pula/gira
        let px = 0, py = 0;
        const sm = C.init ? 0.3 : 1; C.init = true;
        let push = 0;
        for (let i = 0; i < N; i++) {
          const k = i / (N - 1);
          if (i > 0) {
            const a = sw * (0.45 + 0.9 * k) + Math.sin(t * 0.13 + i * 0.75) * C.flutter * k * (0.5 + sw);
            px -= Math.sin(a) * seg; py -= Math.cos(a) * seg;
            if (ay + py < 1) { px -= 1 - (ay + py); py = 1 - ay; } // chegou no chão: escorrega para trás
          }
          cur[i * 2] += (px - cur[i * 2]) * sm; cur[i * 2 + 1] += (py - cur[i * 2 + 1]) * sm;
          // não deixa o pano entrar no corpo
          const rx = lerp(C.rx[0], C.rx[1], k), lim = this.backAt(S, ay + cur[i * 2 + 1]) - C.margin;
          push = Math.max(push * 0.85, ax + cur[i * 2] - rx - lim, 0);
          cur[i * 2] -= push;
        }
        for (let i = 0; i < N; i++) {
          const k = i / (N - 1), rx = lerp(C.rx[0], C.rx[1], k), rz = lerp(C.rz[0], C.rz[1], k), al = lerp(C.aTop, C.aBot, k);
          const cx = ax + cur[i * 2], cy = ay + cur[i * 2 + 1];
          for (let j = 0; j < K; j++) {
            const s = j / (K - 1) * 2 - 1, a = s * al, o = (i * K + j) * 3;
            pos[o] = cx - rx * Math.cos(a) + Math.sin(t * 0.21 + j * 1.1 + i * 0.6) * C.flutter * 12 * k;
            pos[o + 1] = cy;
            pos[o + 2] = az + rz * Math.sin(a);
          }
        }
        C.geo.attributes.position.needsUpdate = true;
        C.geo.computeVertexNormals();
        C.border.forEach((bi, n) => { C.lp[n * 3] = pos[bi * 3]; C.lp[n * 3 + 1] = pos[bi * 3 + 1]; C.lp[n * 3 + 2] = pos[bi * 3 + 2]; });
        C.lg.attributes.position.needsUpdate = true;
      }
    }
    // Sólido voador (Tetraedro)
    buildTetra() {
      const M = { root: new T.Group(), meshes: [], kind: 'tetra' };
      const g = this.geo('tetra30', () => new T.TetrahedronGeometry(30));
      const body = new T.Mesh(g, this.gem('#c88aff', { emissive: 0x301050 })); body.castShadow = true; body.userData.mat = body.material;
      M.body = body; M.meshes.push(body); M.root.add(body);
      const edges = new T.LineSegments(this.geo('tetraE', () => new T.EdgesGeometry(g)), new T.LineBasicMaterial({ color: 0xffffff }));
      body.add(edges);
      const eye = new T.Mesh(this.sph(5, 10, 8), this.neon('#ffffff')); M.eye = eye; M.root.add(eye);
      M.eyeGlow = this.glowSprite(TT.F13.NEON2, 50, 0.9); M.root.add(M.eyeGlow);
      M.aura = this.glowSprite(TT.F13.NEON, 120, 0.35); M.root.add(M.aura);
      return M;
    }
    buildCrate() {
      const M = { root: new T.Group(), meshes: [], kind: 'crate' };
      if (!this.crateTex) {
        const c = mkCanvas(128, 128), g = c.getContext('2d');
        g.fillStyle = '#b77b42'; g.fillRect(0, 0, 128, 128);
        g.fillStyle = '#d99a5a'; g.fillRect(8, 8, 112, 14);
        g.strokeStyle = '#7d4f26'; g.lineWidth = 8; g.beginPath(); g.moveTo(10, 118); g.lineTo(118, 10); g.stroke();
        g.strokeStyle = '#17121f'; g.lineWidth = 6; g.strokeRect(6, 6, 116, 116);
        this.crateTex = new T.CanvasTexture(c);
      }
      const m = new T.Mesh(this.boxG(68, 64, 60), new T.MeshToonMaterial({ map: this.crateTex, gradientMap: this.grad }));
      m.position.y = 32; m.castShadow = true; m.receiveShadow = true; m.userData.mat = m.material;
      const ol = new T.Mesh(this.boxG(73, 69, 65), this.outlineMat); m.add(ol);
      M.meshes.push(m); M.root.add(m); M.box = m;
      return M;
    }
    // Qual modelo usar para cada coisa do jogo (null = continua desenhada em 2D, presa na profundidade dela)
    modelKind(d) {
      if (d.isProp) return 'crate';
      if (d.model3d) return d.model3d;
      if (!d.style || !d.pose || typeof d.think !== 'function') return null;
      if (d.key === 'apprentice') return 'apprentice';
      if (d.key === 'hivesoldier') return 'hive';
      if (d.key === 'clownbb') return 'clownbb';
      if (d.key) { const k = d.key === 'redraven' || d.key === 'whiteraven' ? 'raven' : d.key; return MODELED.has(k) ? k : null; }
      if (d.kind === 'hive') return 'hive';
      return null;
    }
    modelFor(d) {
      let M = this.models.get(d);
      if (M) return M;
      const kind = this.modelKind(d);
      if (!kind) return null;
      if (kind === 'tetra') M = this.buildTetra();
      else if (kind === 'crate') M = this.buildCrate();
      else M = this.buildHumanoid(d, kind);
      M.root.traverse((o) => { if (o.isMesh && o.material === this.outlineMat) o.castShadow = false; });
      this.scene.add(M.root);
      this.models.set(d, M);
      return M;
    }
    clearModels() { for (const M of this.models.values()) this.scene.remove(M.root); this.models.clear(); }
    // ------------------------------------------------------------ Formas 3D (animais do Mutano, corvo da alma, coelho)
    // Mesmas regras do desenho 2D (Titan.draw): qual forma o Titã está agora e em que quadro dela.
    formOf(d) {
      if (!d.key) return null;
      if (d.bunny > 0 && !d.ko) return { name: 'rabbit', t: d.animT || 0 };
      const a = d.atk, fa = a && a.def.formAt ? a.def.formAt(a.t) : null, form = fa ? fa.form : a && a.def.form;
      if (form && TT.TITAN_FORMS && TT.TITAN_FORMS[form] && a.t > 1 && a.t < a.def.s + a.def.a + a.def.r - 1) {
        return fa ? { name: form, t: fa.t, s: fa.s, end: fa.end } : { name: form, t: a.t, s: a.def.s, end: a.def.s + a.def.a };
      }
      if (d.state === 'dash') {
        if (d.base === 'beastboy') return { name: 'cheetah', t: d.animT || 0 };
        if (d.def.drawDash) return { name: 'custom' };
        if (d.base === 'raven') return { name: 'soulraven', t: d.animT || 0 };
      }
      return null;
    }
    // Titã numa forma que só existe desenhada em 2D: esconde o modelo e usa o desenho
    flat2D(d) { const fm = this.formOf(d); return !!fm && !(FORM3D[fm.name] && TT.Beasts3D); }
    formModel(M, name, f) {
      M.forms = M.forms || {};
      let F = M.forms[name];
      if (!F) {
        F = { g: new T.Group(), name };
        F.g.visible = false;
        FORM3D[name].call(this, F, M, f);
        F.g.traverse((o) => { if (o.isMesh && o.material === this.outlineMat) o.castShadow = false; });
        M.root.add(F.g);
        (M.formSet = M.formSet || new Set()).add(F.g);
        M.forms[name] = F;
      }
      return F;
    }
    // liga a forma (ou volta ao corpo normal): esconde todo o resto do boneco enquanto a forma aparece
    showForm(M, F) {
      if (M.curForm === F) return;
      M.curForm = F;
      for (const c of M.root.children) c.visible = M.formSet && M.formSet.has(c) ? c === (F && F.g) : !F;
    }
    // peça com contorno: posição e escala (sx, sy, sz)
    fp(M, parent, geo, col, x, y, z, sx, sy, sz, o) {
      const m = this.part(M, parent, geo, typeof col === 'string' ? this.toon(col) : col, o);
      m.position.set(x, y, z);
      if (sx != null) m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
      return m;
    }
    ell(rx, ry, rz) { const k = [rx, ry, rz].map((v) => Math.round(v * 10) / 10); return this.geo('ell' + k.join(':'), () => new T.SphereGeometry(1, 20, 14).scale(k[0], k[1], k[2])); }
    pivot(parent, x, y, z) { const p = new T.Group(); p.position.set(x, y, z); parent.add(p); return p; }
    // membro de dois segmentos pendurado no pivô (0 = para baixo, + = para a frente), com peça na ponta
    flimb(M, parent, x, y, z, L1, L2, r1, r2, col, endGeo, endCol) {
      const up = this.pivot(parent, x, y, z);
      this.fp(M, up, this.cap(r1, L1), col, 0, -L1 / 2, 0);
      const lo = this.pivot(up, 0, -L1, 0);
      this.fp(M, lo, this.cap(r2, L2), col, 0, -L2 / 2, 0);
      const end = this.pivot(lo, 0, -L2, 0);
      if (endGeo) this.fp(M, end, endGeo, endCol || col, 0, 0, 0);
      return { up, lo, end, L1, L2 };
    }
    // dois ossos: leva a ponta do membro até (tx, ty) no plano do pai; bend = lado da dobra (+1 para a frente)
    reach(L, sx, sy, tx, ty, bend) {
      const dx = tx - sx, dy = ty - sy;
      const d = TT.clamp(Math.hypot(dx, dy), Math.abs(L.L1 - L.L2) + 0.01, L.L1 + L.L2 - 0.01);
      const c1 = Math.acos(TT.clamp((d * d + L.L1 * L.L1 - L.L2 * L.L2) / (2 * d * L.L1), -1, 1));
      const c2 = Math.acos(TT.clamp((L.L1 * L.L1 + L.L2 * L.L2 - d * d) / (2 * L.L1 * L.L2), -1, 1));
      L.up.rotation.z = Math.atan2(dx, -dy) + bend * c1;
      L.lo.rotation.z = -bend * (Math.PI - c2);
    }
    // olho de bicho (branco + pupila; iris = olho amarelo com fenda); dir = 1 do lado da câmera, -1 do outro
    feye(M, parent, x, y, z, r, iris, slit) {
      const w = this.fp(M, parent, this.sph(r, 12, 10), iris ? '#fff8d0' : '#ffffff', x, y, z, 1, 0.9, 0.75);
      const pz = Math.sign(z) * r * 0.35;
      const p = new T.Mesh(this.sph(r * 0.58, 10, 8), this.neon(iris || '#150b22')); p.position.set(r * 0.55, -r * 0.05, pz); w.add(p);
      if (slit) { const s = new T.Mesh(this.boxG(1, 1, 1), this.neon('#150b22')); s.scale.set(r * 0.22, r * 0.95, r * 0.22); s.position.set(r * 0.98, 0, pz * 1.2); w.add(s); }
      const hl = new T.Mesh(this.sph(r * 0.22, 6, 5), this.neon('#ffffff')); hl.position.set(r * 0.8, r * 0.35, pz * 0.6); w.add(hl);
      return w;
    }
    dark(parent, geo, col, x, y, z, sx, sy, sz) { // peça sem contorno (boca, narinas, pintas)
      const m = new T.Mesh(geo, this.toon(col)); m.position.set(x, y, z); if (sx != null) m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz); parent.add(m); return m;
    }
    fang(M, parent, x, y, z, r, h, down) { // dente/garra (cone branco)
      const m = this.fp(M, parent, this.cone(r, h, 6), '#f6f2e0', x, y, z, null, null, null, { outline: false });
      if (down) m.rotation.z = Math.PI;
      return m;
    }
    syncModel(d, M) {
      const f = d, root = M.root;
      if (M.kind === 'crate') {
        root.position.set(f.x + Math.sin(f.wob * 1.5) * 3, 0, Zof(f.y));
        M.box.material = f.flash > 3 ? this.flashMat : M.box.userData.mat;
        return;
      }
      const blinkOut = (f.dead && f.state === 'down' && f.st > 25 && (f.st >> 2) % 2 === 0) || (f.invul > 0 && f.state !== 'getup' && f.state !== 'dash' && (f.invul >> 2) % 2 === 0 && f.team === 'hero');
      root.visible = !blinkOut && (f.alpha == null || f.alpha > 0.05);
      const fl = f.flash > 3 || (f.tellFlash && f.tellFlash()) || (f.team === 'enemy' && f.atk && f.state === 'attack' && f.atk.t < f.atk.def.s && f.atk.t / f.atk.def.s > 0.55 && (f.atk.t >> 1) % 2 === 0);
      for (const m of M.meshes) m.material = fl ? (m.userData.flash || this.flashMat) : m.userData.mat;
      const grow = f.alpha != null && f.alpha < 1 ? 0.3 + 0.7 * f.alpha : 1;
      if (M.kind === 'tetra') {
        const hz = f.hoverZ ? f.hoverZ() : 80;
        root.position.set(f.x, f.z + hz + 12, Zof(f.y));
        M.body.rotation.set(f.state === 'down' ? Math.min(1.4, f.st * 0.1) : 0.5, f.spinAngle ? f.spinAngle() : 0, f.state === 'hurt' ? -0.4 : 0);
        M.eye.position.set(f.facing * 16, 0, 10); M.eyeGlow.position.copy(M.eye.position);
        M.aura.material.color.set((f.animT >> 4) % 2 ? TT.F13.NEON : TT.F13.NEON2);
        root.scale.setScalar(grow);
        return;
      }
      const st = M.st, pose = TT.computePose(f, f.pose);
      if (f.state === 'open' && M.kind === 'vertice') { pose.lean = -0.3; pose.tilt = 0.4; pose.armF[0] = -0.4; }
      if (f.aged > 0 && f.state !== 'down') { pose.lean += 0.32; pose.bob += 5; pose.tilt += 0.15; }
      const sc = st.scale * grow;
      root.position.set(f.x + (f.tellShake ? f.tellShake() : 0), f.z, Zof(f.y));
      root.scale.set(sc, sc, sc);
      // o modelo vira o rosto um pouco para a câmera (como nos jogos de briga em 3D)
      root.rotation.y = f.facing > 0 ? -0.42 : Math.PI + 0.42;
      // forma (animal do Mutano, corvo da alma, coelho): esconde o boneco e anima o modelo da forma
      const fm = M.st && this.formOf(f), Fm = fm && FORM3D[fm.name] && TT.Beasts3D ? this.formModel(M, fm.name, f) : null;
      this.showForm(M, Fm);
      if (Fm) { Fm.g.scale.setScalar(1 / st.scale); Fm.upd(fm, f); return; }
      const L1 = st.legL[0], L2 = st.legL[1];
      const hipH = L1 + L2 - 4 - pose.bob;
      M.rp.rotation.z = -(pose.rot || 0);
      const py = hipH + st.torsoH * 0.35;
      M.sp.position.y = py; M.spi.position.y = -py; M.sp.rotation.z = -(pose.spin || 0);
      M.hip.position.y = hipH;
      const sq = pose.squash || 0; M.hip.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
      M.torso.rotation.z = -pose.lean;
      M.legF.up.rotation.z = pose.legF[0]; M.legF.lo.rotation.z = pose.legF[1] - pose.legF[0];
      M.legB.up.rotation.z = pose.legB[0]; M.legB.lo.rotation.z = pose.legB[1] - pose.legB[0];
      M.armF.up.rotation.z = pose.armF[0] + pose.lean; M.armF.lo.rotation.z = pose.armF[1] - pose.armF[0];
      M.armB.up.rotation.z = pose.armB[0] + pose.lean; M.armB.lo.rotation.z = pose.armB[1] - pose.armB[0];
      M.head.rotation.z = pose.lean * 0.6 - pose.tilt;
      // rosto: boca aberta no grito, olhos fechados quando apanha
      if (M.faceMesh && !fl) {
        const v = pose.eyes === 'shut' || pose.eyes === 'x' ? 'hurt' : pose.mouth === 'shout' || pose.mouth === 'open' ? 'open' : 'n';
        const m = M.faceMat(v); M.faceMesh.material = m; M.faceMesh.userData.mat = m;
      }
      const t = f.animT || 0;
      // bastão
      const staff = pose.weapon === 'staff' || st.staff;
      M.staff.visible = !!staff;
      if (staff) {
        const ext = pose.staffLen == null ? 1 : pose.staffLen, b = 34 - 16 * ext, fw = 34 + 18 * ext;
        M.staff.rotation.z = pose.staff || 0;
        M.staffMesh.scale.set(1, b + fw, 1); M.staffMesh.position.y = -(fw - b) / 2;
      }
      if (M.cannon) M.cannon.visible = pose.form === 'cannon';
      if (M.wand) M.wand.visible = !pose.noWand;
      if (M.remote) M.remote.visible = !pose.noRemote;
      if (M.cane) M.cane.visible = !pose.noCane;
      if (M.spider) M.spider.forEach((L, i) => { const ph = (f.animT || 0) * 0.08 + i * 1.7; L.rotation.z = L.userData.z0 + Math.sin(ph) * 0.12; });
      // auras e brilhos das mãos
      const auraCol = { dark: '#8a4dff', green: '#7dff6a', red: '#ff2a44', white: '#e8eeff' }[st.aura] || '#ffffff';
      const gF = pose.glow ? 0.95 : (pose.auraF || 0), gB = pose.glow ? 0.75 : (pose.auraB || 0);
      M.glowF.material.opacity = Math.min(1, gF); M.glowB.material.opacity = Math.min(1, gB);
      if (gF > 0) M.glowF.material.color.set(pose.glow || auraCol);
      if (gB > 0) M.glowB.material.color.set(pose.glow || auraCol);
      M.glowF.scale.setScalar(38 + 14 * Math.sin(t * 0.3)); M.glowB.scale.setScalar(32 + 10 * Math.sin(t * 0.3 + 1));
      // peças que giram sozinhas (Vértice)
      if (M.halo) { M.halo[0].rotation.set(t * 0.03, 1.2, t * 0.02); M.halo[1].rotation.set(-t * 0.025, 0.8, -t * 0.03); }
      if (M.orbit) M.orbit.forEach((o, i) => { const a = t * 0.04 + i * (Math.PI * 2 / M.orbit.length); o.position.set(Math.cos(a) * 46, st.torsoH * 0.6 + Math.sin(a * 2) * 10, Math.sin(a) * 46); o.rotation.set(t * 0.05 + i, t * 0.07, 0); });
      if (M.core) M.core.rotation.y = t * 0.05;
      // capa / manto / cabelo longo (depois da pose: o pano segue o corpo já posicionado)
      if (M.cloths && M.cloths.length && root.visible) this.updateCloths(M, f, pose);
    }

    // ------------------------------------------------------------ Cenário: céu
    buildSky() {
      const c = mkCanvas(1024, 512), g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 512);
      gr.addColorStop(0, '#0d0828'); gr.addColorStop(0.32, '#2a1556'); gr.addColorStop(0.44, '#6a2f80'); gr.addColorStop(0.49, '#e0607a'); gr.addColorStop(0.53, '#ffb070'); gr.addColorStop(0.6, '#5a2f6e'); gr.addColorStop(1, '#1a0f2c');
      g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
      const r = seeded(1313);
      for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.6) + ')'; g.fillRect(r() * 1024, r() * 190, r() < 0.1 ? 3 : 2, r() < 0.1 ? 3 : 2); }
      // sol se pondo (lado -Z, atrás da cidade) e nuvens alongadas
      const sx = 768, sy = 246;
      const sg = g.createRadialGradient(sx, sy, 0, sx, sy, 120); sg.addColorStop(0, 'rgba(255,230,160,1)'); sg.addColorStop(0.25, 'rgba(255,200,130,0.8)'); sg.addColorStop(1, 'rgba(255,120,120,0)');
      g.fillStyle = sg; g.fillRect(sx - 120, sy - 120, 240, 240);
      g.fillStyle = '#fff0c0'; g.beginPath(); g.arc(sx, sy, 22, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(255,' + (120 + r() * 60 | 0) + ',140,' + (0.18 + r() * 0.25) + ')'; g.fillRect(r() * 1024, 180 + r() * 70, 60 + r() * 160, 3 + r() * 5); }
      const tex = new T.CanvasTexture(c);
      this.sky = new T.Mesh(new T.SphereGeometry(30000, 40, 20), new T.MeshBasicMaterial({ map: tex, side: T.BackSide, fog: false, depthWrite: false }));
      this.sky.renderOrder = -10;
      this.scene.add(this.sky);
    }

    // ------------------------------------------------------------ Cenário: a cidade (x ~1800 a 7800)
    facadeTex(seed, base, win) {
      // 512x1024 cobrindo 256x512 do mundo (o dobro de nitidez): tijolo, lajes, janelas com moldura, peitoril e
      // verga, cortinas nas janelas acesas, aparelhos de ar-condicionado; emissiva separada para as luzes
      const c = mkCanvas(512, 1024), g = c.getContext('2d'), e = mkCanvas(512, 1024), ge = e.getContext('2d');
      const r = seeded(seed), dk = TT.shade(base, -0.22), lt = TT.shade(base, 0.12);
      g.fillStyle = base; g.fillRect(0, 0, 512, 1024);
      for (let y = 0; y < 1024; y += 12) for (let x = (y / 12) % 2 ? -14 : 0; x < 512; x += 28) { // tijolinhos
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)'; g.fillRect(x + 1, y + 1, 26, 10);
      }
      g.fillStyle = 'rgba(0,0,0,0.10)'; for (let y = 0; y < 1024; y += 12) g.fillRect(0, y, 512, 1.5);
      ge.fillStyle = '#000'; ge.fillRect(0, 0, 512, 1024);
      for (let y = 0; y < 1024; y += 128) { g.fillStyle = dk; g.fillRect(0, y + 114, 512, 14); g.fillStyle = lt; g.fillRect(0, y + 114, 512, 3); } // lajes
      const curtain = ['#d8506a', '#5aa0d8', '#e0b040', '#8a5ad0', '#f0e0c0'];
      for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
        const x = 36 + col * 124, y = 24 + row * 128, lit = r() < 0.42, ww = 68, hh = 80;
        g.fillStyle = dk; g.fillRect(x - 8, y - 10, ww + 16, 10); // verga
        g.fillStyle = '#1a1230'; g.fillRect(x - 5, y - 4, ww + 10, hh + 8); // moldura
        const gl = g.createLinearGradient(x, y, x + ww, y + hh);
        if (lit) { gl.addColorStop(0, TT.shade(win, 0.1)); gl.addColorStop(1, TT.shade(win, -0.2)); } else { gl.addColorStop(0, '#3a3a68'); gl.addColorStop(0.5, '#262448'); gl.addColorStop(1, '#1c1a38'); }
        g.fillStyle = gl; g.fillRect(x, y, ww, hh);
        if (!lit) { g.fillStyle = 'rgba(190,210,255,0.16)'; g.beginPath(); g.moveTo(x, y + hh * 0.6); g.lineTo(x + ww * 0.55, y); g.lineTo(x + ww * 0.8, y); g.lineTo(x, y + hh); g.closePath(); g.fill(); } // reflexo
        if (lit && r() < 0.55) { const cc = curtain[Math.floor(r() * curtain.length)]; g.fillStyle = cc; g.fillRect(x, y, ww * 0.3, hh); g.fillRect(x + ww * 0.7, y, ww * 0.3, hh); }
        g.strokeStyle = '#140a22'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + hh); g.moveTo(x, y + hh * 0.42); g.lineTo(x + ww, y + hh * 0.42); g.stroke();
        g.fillStyle = lt; g.fillRect(x - 9, y + hh + 4, ww + 18, 7); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 9, y + hh + 11, ww + 18, 4); // peitoril
        if (lit) { ge.fillStyle = win; ge.fillRect(x, y, ww, hh); if (r() < 0.4) { ge.fillStyle = 'rgba(0,0,0,0.55)'; ge.fillRect(x, y + hh / 2, ww, hh / 2); } }
        if (!lit && r() < 0.12) { // ar-condicionado
          g.fillStyle = '#c9ccd6'; g.fillRect(x + 8, y + hh - 26, 40, 26); g.strokeStyle = '#140a22'; g.lineWidth = 3; g.strokeRect(x + 8, y + hh - 26, 40, 26);
          g.strokeStyle = '#8a8e9a'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x + 12, y + hh - 21 + k * 5); g.lineTo(x + 44, y + hh - 21 + k * 5); g.stroke(); }
        }
      }
      for (const x of [0, 506]) { g.fillStyle = dk; g.fillRect(x, 0, 6, 1024); } // quinas
      const t1 = new T.CanvasTexture(c), t2 = new T.CanvasTexture(e);
      for (const t of [t1, t2]) { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 16; }
      return [t1, t2];
    }
    treeGeo(cb) {
      if (!TT.Beasts3D || !TT.Beasts3D.sculptStaticAsync) return false;
      try {
        TT.Beasts3D.sculptStaticAsync(T, 'static:tree', 3.2, (S, H) => {
          const bark = (x, y, z, nx, ny, nz, c) => H.mix(c, H.rgb('#4a3226'), Math.max(0, Math.sin(Math.atan2(z, x) * 9 + y * 0.05)) * 0.45);
          S.cone([0, -4, 0], [3, 100, 2], 16, 9, { col: '#6a4a36', k: 6, paint: bark });
          for (const a of [0, 2.1, 4.2]) S.cone([0, 6, 0], [Math.cos(a) * 26, -2, Math.sin(a) * 26], 9, 4, { col: '#5a3e2e', k: 6 });
          S.cone([2, 80, 0], [32, 118, 12], 6, 4, { col: '#6a4a36', k: 4 });
          const leaf = (x, y, z, nx, ny, nz, c) => { const n = H.noise3(x * 0.06, y * 0.06, z * 0.06); return H.mix(c, n > 0 ? H.rgb('#7fd06a') : H.rgb('#2a6e34'), Math.min(1, Math.abs(n) * 0.8 + (ny > 0.4 ? 0.15 : 0))); };
          for (const [x, y, z, rr] of [[0, 150, 0, 58], [-40, 128, 24, 40], [42, 132, -16, 42], [10, 120, -44, 38], [-14, 126, 46, 36], [24, 184, 10, 38], [-30, 170, -18, 36], [44, 158, 34, 30]]) S.ell([x, y, z], [rr, rr * 0.86, rr], { col: '#3f9a4a', k: 18, bump: 3.2, bf: 0.09, paint: leaf });
        }, cb);
        return true;
      } catch (e) { console.warn('[3D] árvore:', e && e.message); return false; }
    }
    signTex(text, bg, fg, w, h) {
      const c = mkCanvas(w || 512, h || 128), g = c.getContext('2d');
      g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = '#140a22'; g.lineWidth = 10; g.strokeRect(5, 5, c.width - 10, c.height - 10);
      TT.drawText(g, text, c.width / 2, c.height / 2 + 2, Math.round(c.height * 0.5), fg, '#140a22', 'center', 8);
      return new T.CanvasTexture(c);
    }
    edges(mesh, col) {
      const l = new T.LineSegments(new T.EdgesGeometry(mesh.geometry), new T.LineBasicMaterial({ color: col || 0x140a22 }));
      mesh.add(l); return l;
    }
    buildCity() {
      const S = this.scene, r = seeded(1777);
      const X0 = 1700, X1 = 7900, NEON = TT.F13.NEON, NEON2 = TT.F13.NEON2;
      // asfalto da avenida
      const ac = mkCanvas(512, 512), ag = ac.getContext('2d');
      ag.fillStyle = '#3b3446'; ag.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 5200; i++) { ag.fillStyle = r() < 0.5 ? 'rgba(255,255,255,' + (0.03 + r() * 0.05) + ')' : 'rgba(0,0,0,' + (0.06 + r() * 0.1) + ')'; const sz = 1 + r() * 2.5; ag.fillRect(r() * 512, r() * 512, sz, sz); }
      for (let i = 0; i < 3; i++) { ag.fillStyle = 'rgba(20,14,30,0.22)'; ag.beginPath(); ag.ellipse(r() * 512, r() * 512, 20 + r() * 40, 12 + r() * 20, r() * 3, 0, Math.PI * 2); ag.fill(); } // manchas de óleo
      ag.fillStyle = 'rgba(70,62,84,0.6)'; ag.fillRect(300, 60, 120, 80); ag.strokeStyle = 'rgba(20,14,30,0.5)'; ag.lineWidth = 2; ag.strokeRect(300, 60, 120, 80); // remendo
      ag.strokeStyle = 'rgba(16,10,24,0.55)'; ag.lineWidth = 1.6;
      for (let i = 0; i < 6; i++) { let x = r() * 512, y = r() * 512; ag.beginPath(); ag.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 50; y += (r() - 0.3) * 30; ag.lineTo(x, y); } ag.stroke(); } // rachaduras
      const at = new T.CanvasTexture(ac); at.wrapS = at.wrapT = T.RepeatWrapping; at.repeat.set((X1 - X0) / 256, 760 / 256);
      const road = new T.Mesh(new T.PlaneGeometry(X1 - X0, 760), new T.MeshToonMaterial({ map: at, gradientMap: this.grad }));
      road.rotation.x = -Math.PI / 2; road.position.set((X0 + X1) / 2, 0, 0); road.receiveShadow = true; S.add(road);
      // faixas: tracejado amarelo no meio e linhas brancas nas bordas
      const dashN = Math.floor((X1 - X0) / 130);
      const dash = new T.InstancedMesh(this.boxG(70, 1, 7), this.neon('#ffd84a'), dashN);
      const mtx = new T.Matrix4();
      for (let i = 0; i < dashN; i++) { mtx.makeTranslation(X0 + 40 + i * 130, 0.6, 0); dash.setMatrixAt(i, mtx); }
      S.add(dash);
      for (const z of [-292, 292]) { const l = new T.Mesh(this.boxG(X1 - X0, 1, 5), this.neon('#e8e4f0')); l.position.set((X0 + X1) / 2, 0.6, z); S.add(l); }
      // calçadas e meio-fio
      const pc = mkCanvas(128, 128), pg = pc.getContext('2d');
      pg.fillStyle = '#8a7f96'; pg.fillRect(0, 0, 128, 128);
      for (const [tx, ty] of [[0, 0], [64, 0], [0, 64], [64, 64]]) { // lajotas com relevo
        pg.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; pg.fillRect(tx, ty, 64, 64);
        pg.fillStyle = 'rgba(255,255,255,0.22)'; pg.fillRect(tx + 2, ty + 2, 60, 3); pg.fillRect(tx + 2, ty + 2, 3, 60);
        pg.fillStyle = 'rgba(20,12,30,0.28)'; pg.fillRect(tx + 2, ty + 59, 60, 3); pg.fillRect(tx + 59, ty + 2, 3, 60);
      }
      for (let i = 0; i < 700; i++) { pg.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'; pg.fillRect(r() * 128, r() * 128, 1.5, 1.5); }
      pg.strokeStyle = 'rgba(30,20,40,0.55)'; pg.lineWidth = 2.5; pg.strokeRect(0, 0, 64, 64); pg.strokeRect(64, 64, 64, 64); pg.strokeRect(64, 0, 64, 64); pg.strokeRect(0, 64, 64, 64);
      const pt = new T.CanvasTexture(pc); pt.wrapS = pt.wrapT = T.RepeatWrapping; pt.repeat.set((X1 - X0) / 128, 2);
      for (const [z, d] of [[-385, 170], [370, 140]]) {
        const sw = new T.Mesh(new T.BoxGeometry(X1 - X0, 10, d), new T.MeshToonMaterial({ map: pt, gradientMap: this.grad }));
        sw.position.set((X0 + X1) / 2, 5, z); sw.receiveShadow = true; S.add(sw);
        const curb = new T.Mesh(this.boxG(X1 - X0, 12, 8), this.toon('#5a5068')); curb.position.set((X0 + X1) / 2, 6, z > 0 ? z - d / 2 : z + d / 2); S.add(curb);
      }
      // chão em volta (o vazio não aparece na frente da calçada) e cerca viva
      const base = new T.Mesh(new T.PlaneGeometry(9000, 9000), this.toon('#2e2640'));
      base.rotation.x = -Math.PI / 2; base.position.set(4800, -1.5, 2000); base.receiveShadow = true; S.add(base);
      const hedge = new T.Mesh(this.boxG(X1 - X0, 26, 40), this.toon('#2f7a3a')); hedge.position.set((X0 + X1) / 2, 13, 470); hedge.castShadow = true; hedge.receiveShadow = true; S.add(hedge);
      // grade luminosa "dimensional" no asfalto, mais forte perto do chefe
      const gc = mkCanvas(128, 128), gg = gc.getContext('2d');
      gg.strokeStyle = 'rgba(95,242,255,1)'; gg.lineWidth = 3; gg.strokeRect(0, 0, 128, 128);
      const gt = new T.CanvasTexture(gc); gt.wrapS = gt.wrapT = T.RepeatWrapping;
      for (const [a, b, op] of [[2300, 4250, 0.1], [4250, 5900, 0.2], [5900, 7900, 0.38]]) {
        const tt = gt.clone(); tt.needsUpdate = true; tt.repeat.set((b - a) / 128, 580 / 128);
        const m = new T.Mesh(new T.PlaneGeometry(b - a, 580), new T.MeshBasicMaterial({ map: tt, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.set((a + b) / 2, 0.8, 0); S.add(m);
      }
      // ---- prédios do fundo
      const styles = [['#5a3a6e', '#ffe2a0'], ['#3a4a7e', '#bfe8ff'], ['#6e3a4a', '#ffd08a'], ['#4a5a6a', '#fff0b0'], ['#3d2a5e', '#ff9ad0']].map(([b, w], i) => ({ tex: this.facadeTex(900 + i, b, w), base: b }));
      const shops = ['PIZZARIA', 'FLIPERAMA', 'CAFÉ', 'GIBIS', 'TACOS', 'SORVETES', 'ELETRÔNICOS', 'SUSHI'].map((n, i) => this.signTex(n, ['#e0404a', '#3a6ad8', '#2f9a3e', '#e0a020', '#8a3ad8', '#20a0a0', '#d85a20', '#d02a6a'][i], '#ffe14a'));
      const awnCols = ['#e0404a', '#2f9a3e', '#e0a020', '#3a6ad8', '#8a3ad8'];
      this.screens = [];
      let x = X0;
      while (x < X1) {
        const w = 230 + r() * 200, plaza = x + w > 3020 && x < 4180;
        const h = plaza ? 700 + r() * 500 : 260 + r() * 640;
        const zf = plaza ? -980 : -472, d = 320;
        const stl = styles[Math.floor(r() * styles.length)];
        const ft = stl.tex[0].clone(), fe = stl.tex[1].clone(); ft.needsUpdate = fe.needsUpdate = true;
        ft.repeat.set(w / 256, h / 512); fe.repeat.set(w / 256, h / 512);
        const mat = new T.MeshToonMaterial({ map: ft, emissiveMap: fe, emissive: 0xffffff, emissiveIntensity: 0.9, gradientMap: this.grad });
        const b = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
        b.position.set(x + w / 2, h / 2, zf - d / 2); b.castShadow = true; b.receiveShadow = true;
        S.add(b);
        this.edges(b, x > 5800 ? 0x5ff2ff : 0x140a22);
        // cornija no topo
        const cor = new T.Mesh(this.boxG(w + 16, 14, d + 16), this.toon(TT.shade(stl.base, -0.25))); cor.position.set(x + w / 2, h + 7, zf - d / 2); S.add(cor);
        if (!plaza) {
          // loja no térreo: vitrine, letreiro e toldo
          const shop = new T.Mesh(new T.PlaneGeometry(w - 30, 70), new T.MeshBasicMaterial({ map: shops[Math.floor(r() * shops.length)] }));
          shop.position.set(x + w / 2, 150, zf + 1.5); S.add(shop);
          const win = new T.Mesh(new T.PlaneGeometry(w - 50, 95), new T.MeshBasicMaterial({ color: 0x9adcff, transparent: true, opacity: 0.55 }));
          win.position.set(x + w / 2, 60, zf + 1.2); S.add(win);
          const aw = new T.Mesh(new T.BoxGeometry(w - 26, 6, 58), this.toon(awnCols[Math.floor(r() * awnCols.length)]));
          aw.position.set(x + w / 2, 118, zf + 26); aw.rotation.x = 0.32; aw.castShadow = true; S.add(aw); this.edges(aw);
        }
        // telhado: caixa d'água, antena com luz piscando, outdoor
        const roll = r();
        if (roll < 0.35) {
          const tank = new T.Mesh(this.cyl(34, 34, 60, 12), this.toon('#7a5a4a')); tank.position.set(x + w * 0.3, h + 52, zf - d / 2); S.add(tank); this.edges(tank);
          const roof = new T.Mesh(this.cone(40, 26, 12), this.toon('#5a3a2a')); roof.position.set(x + w * 0.3, h + 95, zf - d / 2); S.add(roof);
          for (const s of [-1, 1]) { const leg = new T.Mesh(this.boxG(4, 24, 4), this.toon('#3a2a2a')); leg.position.set(x + w * 0.3 + s * 22, h + 12, zf - d / 2); S.add(leg); }
        } else if (roll < 0.6) {
          const ant = new T.Mesh(this.cyl(2, 3, 160, 6), this.toon('#3a3048')); ant.position.set(x + w * 0.6, h + 80, zf - d / 2); S.add(ant);
          const bl = this.glowSprite('#ff3050', 40, 0.9); bl.position.set(x + w * 0.6, h + 162, zf - d / 2); S.add(bl);
          (this.blinkers || (this.blinkers = [])).push(bl);
        } else if (roll < 0.85 && !plaza) {
          const txt = ['JUMP CITY', 'PIZZA!', 'TORRE TITÃ', 'BOOYAH COLA', 'SUPER TOFU'][Math.floor(r() * 5)];
          const bb = new T.Mesh(new T.PlaneGeometry(220, 70), new T.MeshBasicMaterial({ map: this.signTex(txt, '#20163a', ['#ffd84a', '#5ff2ff', '#ff5fd2'][Math.floor(r() * 3)], 512, 160) }));
          bb.position.set(x + w / 2, h + 70, zf - 30); S.add(bb);
          for (const s of [-1, 1]) { const p = new T.Mesh(this.boxG(5, 50, 5), this.toon('#3a3048')); p.position.set(x + w / 2 + s * 90, h + 20, zf - 32); S.add(p); }
        }
        // telões gigantes na avenida (trecho da 2ª arena 3D): mostram o olho do Vértice
        if (x > 4150 && x < 5700 && !plaza && h > 420 && this.screens.length < 3) {
          const sc = mkCanvas(256, 160), sTex = new T.CanvasTexture(sc);
          const scr = new T.Mesh(new T.PlaneGeometry(Math.min(w - 40, 300), 190), new T.MeshBasicMaterial({ map: sTex }));
          scr.position.set(x + w / 2, Math.min(h - 120, 380), zf + 2); S.add(scr);
          const fr = new T.Mesh(this.boxG(Math.min(w - 40, 300) + 16, 206, 8), this.toon('#1a1230')); fr.position.set(x + w / 2, scr.position.y, zf - 2); S.add(fr);
          this.screens.push({ c: sc, g: sc.getContext('2d'), tex: sTex, seed: this.screens.length });
        }
        x += w + 8 + (r() < 0.2 ? 60 : 0);
      }
      // ---- praça (1ª arena 3D): piso, fonte com o "T" dourado, árvores e bancos
      const plc = mkCanvas(128, 128), plg = plc.getContext('2d');
      plg.fillStyle = '#a89890'; plg.fillRect(0, 0, 128, 128); plg.fillStyle = '#928280'; plg.fillRect(0, 0, 64, 64); plg.fillRect(64, 64, 64, 64);
      const plt = new T.CanvasTexture(plc); plt.wrapS = plt.wrapT = T.RepeatWrapping; plt.repeat.set(1200 / 128, 520 / 128);
      const plaza = new T.Mesh(new T.BoxGeometry(1200, 10, 520), new T.MeshToonMaterial({ map: plt, gradientMap: this.grad }));
      plaza.position.set(3600, 5, -720); plaza.receiveShadow = true; S.add(plaza);
      const fx = 3600, fz = -700;
      const basin = new T.Mesh(this.cyl(170, 180, 34, 32), this.toon('#c9b8b0')); basin.position.set(fx, 17, fz); basin.castShadow = true; S.add(basin); this.edges(basin);
      const water = new T.Mesh(this.cyl(158, 158, 4, 32), new T.MeshBasicMaterial({ color: 0x5fc8ff, transparent: true, opacity: 0.85 })); water.position.set(fx, 33, fz); S.add(water);
      const col = new T.Mesh(this.cyl(22, 30, 120, 16), this.toon('#c9b8b0')); col.position.set(fx, 90, fz); S.add(col); this.edges(col);
      const gold = this.toon('#f2c230');
      const tv = new T.Mesh(this.boxG(36, 150, 36), gold); tv.position.set(fx, 225, fz); tv.castShadow = true; S.add(tv); this.edges(tv);
      const thz = new T.Mesh(this.boxG(170, 40, 40), gold); thz.position.set(fx, 300, fz); thz.castShadow = true; S.add(thz); this.edges(thz);
      this.fountainJets = [];
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        const jet = new T.Mesh(this.cone(10, 90, 8), new T.MeshBasicMaterial({ color: 0xbff0ff, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false }));
        jet.position.set(fx + Math.cos(a) * 110, 75, fz + Math.sin(a) * 110); S.add(jet); this.fountainJets.push(jet);
      }
      // árvores esculpidas: copa fofa com volume e tons, tronco com raízes (uma malha, repetida girada);
      // a escultura sai aos poucos (sem travar o começo da fase) e as árvores aparecem quando fica pronta
      const treeMat = new T.MeshToonMaterial({ vertexColors: true, gradientMap: this.grad });
      const trees = [[3080, -560], [3260, -900], [3940, -900], [4120, -560], [3080, -880], [4120, -880]].map(([tx, tz]) => {
        const g = new T.Group(); g.position.set(tx, 0, tz); g.rotation.y = (tx * 0.013 + tz * 0.007) % 6.28; g.scale.setScalar(0.92 + ((tx + tz) % 7) * 0.03); S.add(g); return g;
      });
      const plant = (geo) => { for (const g of trees) { const tr = new T.Mesh(geo, treeMat); tr.castShadow = tr.receiveShadow = true; tr.add(new T.Mesh(geo, this.outlineMat)); g.add(tr); } };
      if (!this.treeGeo(plant)) for (const g of trees) { // sem o escultor: árvore simples
        const tr = new T.Mesh(this.cyl(10, 14, 90, 8), this.toon('#6a4a3a')); tr.position.y = 45; tr.castShadow = true; g.add(tr);
        const top = new T.Mesh(this.geo('tree', () => new T.IcosahedronGeometry(70, 1)), this.toon('#3f9a4a')); top.position.y = 140; top.castShadow = true; g.add(top);
      }
      // ---- trilho elevado com trem (atrás da 2ª arena 3D)
      const deck = new T.Mesh(this.boxG(2200, 26, 90), this.toon('#5a5068')); deck.position.set(5000, 300, -420); deck.castShadow = true; S.add(deck); this.edges(deck);
      for (let px = 4000; px <= 6000; px += 250) { const p = new T.Mesh(this.boxG(30, 290, 30), this.toon('#4a4058')); p.position.set(px, 145, -420); p.castShadow = true; S.add(p); this.edges(p); }
      this.train = new T.Group(); this.train.position.set(4300, 360, -420); S.add(this.train);
      for (let i = 0; i < 3; i++) {
        const car = new T.Mesh(this.boxG(230, 80, 70), this.toon(i ? '#d8dde6' : '#e0404a')); car.position.x = i * 240; car.castShadow = true; this.train.add(car); this.edges(car);
        const wb = new T.Mesh(this.boxG(200, 22, 72), this.neon('#ffe9a0')); wb.position.set(i * 240, 10, 0); this.train.add(wb);
      }
      // ---- postes, hidrantes, lixeiras e bancos na calçada da frente (baixos para não tapar a luta)
      for (let px = 2000; px < 5700; px += 560) {
        for (const dx of [-40, 40]) { const bo = new T.Mesh(this.cyl(6, 7, 30, 8), this.toon('#ffd84a')); bo.position.set(px + dx, 20, 330); bo.castShadow = true; S.add(bo); this.edges(bo); }
        if ((px / 560 | 0) % 2) { const hy = new T.Mesh(this.cyl(9, 11, 34, 10), this.toon('#e0404a')); hy.position.set(px + 140, 22, 390); hy.castShadow = true; S.add(hy); this.edges(hy); }
        else { const bin = new T.Mesh(this.cyl(14, 12, 44, 12), this.toon('#3a7a4a')); bin.position.set(px + 160, 27, 395); bin.castShadow = true; S.add(bin); this.edges(bin); }
      }
      for (let px = 1900; px < 7700; px += 700) { // postes do lado de trás (iluminam a calçada)
        const pole = new T.Mesh(this.cyl(4, 6, 240, 8), this.toon('#2a2236')); pole.position.set(px + 300, 120, -330); pole.castShadow = true; S.add(pole);
        const lamp = new T.Mesh(this.boxG(26, 10, 18), this.neon('#ffe9a0')); lamp.position.set(px + 300, 236, -300); S.add(lamp);
        const gl = this.glowSprite('#ffe9a0', 120, 0.6); gl.position.set(px + 300, 230, -300); S.add(gl);
      }
      // ---- horizonte: Torre Titã na baía e prédios distantes
      const tw = this.toon('#3a2a5a'), twin = this.neon('#ffe9a0');
      const tower = new T.Group(); tower.position.set(4700, 0, -5200); S.add(tower);
      const tv1 = new T.Mesh(this.boxG(220, 1200, 220), tw); tv1.position.y = 600; tower.add(tv1);
      const th1 = new T.Mesh(this.boxG(820, 240, 260), tw); th1.position.y = 1250; tower.add(th1);
      const th2 = new T.Mesh(this.boxG(220, 500, 260), tw); th2.position.set(-300, 1050, 0); tower.add(th2);
      for (let i = 0; i < 9; i++) { const wn = new T.Mesh(this.boxG(60, 30, 4), twin); wn.position.set(-320 + i * 80, 1260, 131); tower.add(wn); }
      const island = new T.Mesh(this.cyl(700, 900, 120, 24), this.toon('#2a3a3a')); island.position.set(4700, -40, -5200); S.add(island);
      const sea = new T.Mesh(new T.PlaneGeometry(40000, 12000), new T.MeshBasicMaterial({ color: 0x2a2a6a })); sea.rotation.x = -Math.PI / 2; sea.position.set(4800, -20, -7600); S.add(sea);
      const far = this.toon('#2c1a46');
      for (let i = 0; i < 40; i++) { const bw = 200 + r() * 300, bh = 500 + r() * 1400; const fb = new T.Mesh(this.boxG(bw, bh, 200), far); fb.position.set(-2000 + i * 320 + r() * 100, bh / 2, -2300 - r() * 700); S.add(fb); }
      // ---- o NÚCLEO: plataforma de hexágonos, poliedro gigante girando no céu e o feixe de luz
      const hexTop = mkCanvas(128, 128), hg = hexTop.getContext('2d');
      hg.fillStyle = '#2a1a4a'; hg.fillRect(0, 0, 128, 128);
      hg.strokeStyle = NEON; hg.lineWidth = 8; hg.beginPath();
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; hg[i ? 'lineTo' : 'moveTo'](64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); }
      hg.closePath(); hg.stroke();
      const hexMat = [this.toon('#3a2860'), new T.MeshToonMaterial({ map: new T.CanvasTexture(hexTop), gradientMap: this.grad, emissive: 0x201040 }), this.toon('#1a1030')];
      const cols = 17, rows = 7, R = 62, hexes = new T.InstancedMesh(new T.CylinderGeometry(R, R, 14, 6), hexMat, cols * rows);
      this.hexes = { mesh: hexes, base: [] };
      let k = 0;
      for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) {
        const hx = 5900 + c * R * 1.5, hz = -320 + rr * R * 1.73 + (c % 2 ? R * 0.86 : 0), hy = 7 + r() * 3;
        mtx.makeTranslation(hx, hy, hz); hexes.setMatrixAt(k, mtx); this.hexes.base.push([hx, hy, hz, r() * 6]); k++;
      }
      hexes.receiveShadow = true; S.add(hexes);
      this.core = new T.Group(); this.core.position.set(6640, 820, -1000); S.add(this.core);
      const big = new T.Mesh(new T.IcosahedronGeometry(320, 0), new T.MeshBasicMaterial({ color: 0x5ff2ff, wireframe: true, transparent: true, opacity: 0.8 }));
      const inner = new T.Mesh(new T.OctahedronGeometry(120), this.gem('#ff5fd2', { emissive: 0x801060 }));
      const ring1 = new T.Mesh(new T.TorusGeometry(420, 4, 8, 80), this.neon(NEON2));
      const ring2 = new T.Mesh(new T.TorusGeometry(500, 3, 8, 80), this.neon(NEON));
      this.core.add(big, inner, ring1, ring2); this.coreParts = { big, inner, ring1, ring2 };
      this.core.add(this.glowSprite(NEON2, 900, 0.5));
      const beam = new T.Mesh(new T.CylinderGeometry(60, 60, 8000, 16, 1, true), new T.MeshBasicMaterial({ color: 0x5ff2ff, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      beam.position.set(6640, 4800, -1000); S.add(beam);
      // ---- cubos e pirâmides flutuando no céu (a "falha" da dimensão), mais densos perto do núcleo
      const nF = 90;
      this.floaters = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), this.gem('#9a7aff', { emissive: 0x2a1a50 }), nF);
      this.floatData = [];
      for (let i = 0; i < nF; i++) {
        const u = Math.pow(r(), 0.7);
        this.floatData.push({ x: 2200 + u * 5600, y: 260 + r() * 900, z: -500 - r() * 1600, s: 14 + r() * 40, ph: r() * 6, sp: 0.004 + r() * 0.01 });
      }
      S.add(this.floaters);
    }
    // ------------------------------------------------------------ Chão: marcas dos ataques (textura deitada)
    buildGround() {
      this.GM = 384; this.GY0 = FT - 50; this.GW = 2048; this.GH = 320;
      this.gcan = mkCanvas(this.GW, this.GH); this.gctx = this.gcan.getContext('2d');
      this.gtex = new T.CanvasTexture(this.gcan); this.gtex.generateMipmaps = false; this.gtex.minFilter = T.LinearFilter;
      const z0 = Zof(this.GY0), z1 = Zof(this.GY0 + this.GH);
      this.decal = new T.Mesh(new T.PlaneGeometry(this.GW, z1 - z0), new T.MeshBasicMaterial({ map: this.gtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      this.decal.rotation.x = -Math.PI / 2; this.decal.position.set(0, 1.5, (z0 + z1) / 2); this.decal.renderOrder = 2;
      this.scene.add(this.decal);
    }
    // ------------------------------------------------------------ Efeitos 3D (paredes de laser, poliedros, cubos)
    buildFx() {
      const wc = mkCanvas(16, 128), wg = wc.getContext('2d'), gr = wg.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
      wg.fillStyle = gr; wg.fillRect(0, 0, 16, 128);
      this.wallTex = new T.CanvasTexture(wc);
      this.walls = [];
      for (let i = 0; i < 8; i++) {
        const m = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: this.wallTex, color: 0x5ff2ff, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
        m.visible = false; this.scene.add(m); this.walls.push(m);
      }
      this.cubes = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), this.gem('#ffffff', { emissive: 0x302060 }), 60);
      this.cubes.instanceColor = new T.InstancedBufferAttribute(new Float32Array(60 * 3), 3);
      this.cubes.castShadow = true; this.cubes.count = 0; this.scene.add(this.cubes);
      this.tetras = new T.InstancedMesh(new T.TetrahedronGeometry(1), this.gem('#ff9ae8', { emissive: 0x501040 }), 12);
      this.tetras.castShadow = true; this.tetras.count = 0; this.scene.add(this.tetras);
      this.tmpM = new T.Matrix4(); this.tmpQ = new T.Quaternion(); this.tmpE = new T.Euler(); this.tmpS = new T.Vector3(); this.tmpP = new T.Vector3(); this.tmpC = new T.Color();
    }
    syncFx() {
      const g = this.game, b = g.boss;
      // paredes da Grade Vetorial
      const ws = b && b.walls ? b.walls : [];
      this.walls.forEach((m, i) => {
        const w = ws[i];
        if (!w) { m.visible = false; return; }
        const z = w.z, h = 150 * w.k;
        m.visible = true;
        m.material.opacity = w.on ? 0.95 : 0.3 + 0.25 * Math.sin(g.frame * 0.6);
        m.material.color.set(w.on ? '#5ff2ff' : '#ff5fd2');
        if (z.wall === 1) { m.rotation.set(0, 0, 0); m.scale.set(z.x1 - z.x0, h, 1); m.position.set((z.x0 + z.x1) / 2, h / 2, Zof(z.y)); }
        else { m.rotation.set(0, Math.PI / 2, 0); m.scale.set(z.d * 2 * KD, h, 1); m.position.set((z.x0 + z.x1) / 2, h / 2, Zof(z.y)); }
      });
      // poliedros caindo + cubos que brotam do chão
      let nc = 0, nt = 0;
      const put = (mesh, idx, x, y, z, s, rot, col) => {
        this.tmpE.set(rot, rot * 0.7, rot * 0.3); this.tmpQ.setFromEuler(this.tmpE);
        this.tmpP.set(x, y, z); this.tmpS.set(s, s, s);
        this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS); mesh.setMatrixAt(idx, this.tmpM);
        if (col && mesh.instanceColor) { this.tmpC.set(col); mesh.setColorAt(idx, this.tmpC); }
      };
      if (b && b.rocks) for (const rk of b.rocks) {
        if (rk.kind && nt < 12) put(this.tetras, nt++, rk.x, rk.h + rk.s * 0.5, Zof(rk.y), rk.s * 0.7, rk.rot);
        else if (nc < 60) put(this.cubes, nc++, rk.x, rk.h + rk.s * 0.5, Zof(rk.y), rk.s, rk.rot, '#8a5cff');
      }
      for (const ef of g.effects) {
        if (!ef.cube3d || nc >= 60) continue;
        const c = ef.cube3d(); if (!c || c.s < 1) continue;
        put(this.cubes, nc++, c.x, c.h + c.s / 2, Zof(c.y), c.s, c.rot, c.col);
      }
      this.cubes.count = nc; this.tetras.count = nt;
      this.cubes.instanceMatrix.needsUpdate = true; if (this.cubes.instanceColor) this.cubes.instanceColor.needsUpdate = true;
      this.tetras.instanceMatrix.needsUpdate = true;
    }
    animateCity() {
      const f = this.game.frame;
      if (this.core) { const P = this.coreParts; P.big.rotation.set(f * 0.003, f * 0.005, 0); P.inner.rotation.set(0, -f * 0.01, f * 0.006); P.ring1.rotation.set(1.2 + Math.sin(f * 0.01) * 0.2, f * 0.004, 0); P.ring2.rotation.set(0.4, 0, f * 0.006); this.core.position.y = 820 + Math.sin(f * 0.02) * 30; }
      if (this.train) { this.train.position.x = 3600 + ((f * 2.2) % 3200); }
      if (this.fountainJets) this.fountainJets.forEach((j, i) => { j.scale.y = 0.8 + 0.25 * Math.sin(f * 0.15 + i); });
      if (this.blinkers) this.blinkers.forEach((b, i) => { b.material.opacity = ((f + i * 17) % 60) < 30 ? 0.95 : 0.15; });
      if (this.floaters && f % 2 === 0) {
        this.floatData.forEach((d, i) => {
          const a = f * d.sp + d.ph;
          this.tmpE.set(a, a * 1.3, a * 0.6); this.tmpQ.setFromEuler(this.tmpE);
          this.tmpP.set(d.x, d.y + Math.sin(a) * 30, d.z); this.tmpS.set(d.s, d.s, d.s);
          this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS); this.floaters.setMatrixAt(i, this.tmpM);
        });
        this.floaters.instanceMatrix.needsUpdate = true;
      }
      if (this.hexes && f % 3 === 0) { // hexágonos do núcleo "respiram"
        const HX = this.hexes, b = this.game.boss, k = b && !b.dead ? 1 : 0.4;
        HX.base.forEach(([x, y, z, ph], i) => { this.tmpM.makeTranslation(x, y + Math.max(0, Math.sin(f * 0.04 + ph)) * 8 * k, z); HX.mesh.setMatrixAt(i, this.tmpM); });
        HX.mesh.instanceMatrix.needsUpdate = true;
      }
      if (this.screens && f % 4 === 0) this.screens.forEach((s) => this.paintScreen(s, f));
    }
    paintScreen(s, f) {
      const g = s.g, w = 256, h = 160;
      g.fillStyle = '#100a24'; g.fillRect(0, 0, w, h);
      const glitch = (f >> 5) % 5 === s.seed % 5;
      g.save(); g.translate(w / 2 + (glitch ? (Math.random() - 0.5) * 12 : 0), h / 2 - 8);
      const open = 0.6 + 0.4 * Math.abs(Math.sin(f * 0.02 + s.seed));
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, 0, 60, 34 * open, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff5fd2'; g.beginPath(); g.arc(Math.sin(f * 0.03 + s.seed) * 18, 0, 20 * open, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#100a24'; g.beginPath(); g.arc(Math.sin(f * 0.03 + s.seed) * 18, 0, 8 * open, 0, Math.PI * 2); g.fill();
      g.restore();
      TT.drawText(g, ['VÉRTICE', 'A 3ª DIMENSÃO', 'NADA É PLANO'][(f >> 7) % 3], w / 2, h - 18, 22, '#5ff2ff', '#100a24', 'center', 4);
      g.fillStyle = 'rgba(255,255,255,0.06)'; for (let y = (f % 4); y < h; y += 4) g.fillRect(0, y, w, 1);
      s.tex.needsUpdate = true;
    }

    // ------------------------------------------------------------ Ladrilhos da transição (a tela 2D se desmontando)
    buildOverlay() {
      this.oScene = new T.Scene();
      const fov = 30, D = (H / 2) / Math.tan(fov * Math.PI / 360);
      this.oCam = new T.PerspectiveCamera(fov, W / H, 10, D * 3);
      this.oCam.position.set(W / 2, H / 2, D); this.oCam.lookAt(W / 2, H / 2, 0);
      this.snap = mkCanvas(W, H); this.snapTex = new T.CanvasTexture(this.snap);
      this.tiles = [];
      const C = 16, R = 9, tw = W / C, th = H / R;
      for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) {
        const g = new T.PlaneGeometry(tw, th), uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (c + uv.getX(i)) / C, 1 - (r + 1 - uv.getY(i)) / R);
        const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: this.snapTex, transparent: true, side: T.DoubleSide }));
        m.userData = { c, r, x: c * tw + tw / 2, y: H - (r * th + th / 2), d: Math.random(), s: Math.random() < 0.5 ? -1 : 1 };
        this.oScene.add(m); this.tiles.push(m);
      }
    }
    snapshot() {
      const g = this.game, sctx = this.snap.getContext('2d');
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      const rs = TT.renderScale; TT.renderScale = 1;
      g.drawWorld(sctx);
      TT.renderScale = rs;
      this.snapTex.needsUpdate = true;
    }
    // ------------------------------------------------------------ Gatilho e transição
    checkTrigger() {
      const g = this.game, d3 = g.stage.dim3;
      if (!d3 || g.dim3On || g.dimTrans || this.triggered || !this.ready) return;
      if (g.camX < d3.at - 1 || g.camX > d3.at + 400 || g.secActive || g.enemies.length || g.story || g.state !== 'play') return;
      this.triggered = true;
      if (d3.story && TT.storyOn()) g.story = new TT.Story(g, d3.story, () => this.beginTransition());
      else this.beginTransition();
    }
    beginTransition() {
      const g = this.game;
      this.snapshot();
      g.dimTrans = { t: 0, dur: 250 };
      this.cv = null;
      TT.audio.play('zap');
      if (g.stage.song3d) TT.audio.playSong(g.stage.song3d);
    }
    stepTransition() {
      const g = this.game, tr = g.dimTrans; if (!tr) return;
      tr.t++;
      if (tr.t === 20) { TT.audio.play('super'); g.shake = 10; }
      if (tr.t === 140) { TT.audio.play('boom'); g.whiteFlash = 6; }
      if (tr.t === 150) g.banner = { text: 'TERCEIRA DIMENSÃO!', sub: 'O mundo ganhou profundidade! Os controles continuam os mesmos.', t: 0, dur: 190, power: true };
      if (tr.t >= tr.dur) { g.dimTrans = null; g.dim3On = true; }
    }
    // Liga o 3D na hora (atalho de testes / depuração).
    forceOn() { if (!this.ready) return false; const g = this.game; this.triggered = true; g.dimTrans = null; g.dim3On = true; this.cv = null; return true; }

    // ------------------------------------------------------------ Câmera diretora
    fitDist(fov, width) { return (width / 2) / (Math.tan(fov * Math.PI / 360) * (W / H)); }
    flatShot() {
      const g = this.game, fov = 5;
      return { x: g.camX + W / 2, y: 223, z: 0, yaw: 0, pitch: PITCH_FLAT, fov, dist: this.fitDist(fov, W) * 0.96, roll: 0 };
    }
    shot() {
      const g = this.game, b = g.boss, p = g.player, fr = g.frame, sec = g.section;
      // o alvo puxa um pouco para o meio dos Titãs (a câmera fica mais perto da ação)
      const ps = g.players().filter((t) => !t.ko), px = ps.length ? ps.reduce((a, t) => a + t.x, 0) / ps.length : g.camX + W / 2;
      const cx = TT.clamp(lerp(g.camX + W / 2, px, 0.4), g.camX + 520, g.camX + W - 520);
      const base = { x: cx, y: 70, z: -20, yaw: 0.42 + Math.sin(fr * 0.006) * 0.07, pitch: 0.3, fov: 40, dist: 0, roll: 0, sm: 0.05, frame: 1060 };
      let s = base;
      const ct = g.comboTag;
      if (b && g.bossIntro > 0) {
        // volta completa em torno do chefe enquanto ele se monta
        const k = 1 - g.bossIntro / 170;
        s = { x: b.x, y: 150 + k * 60, z: Zof(b.y), yaw: -0.5 + k * Math.PI * 2 * 0.85, pitch: 0.12 + k * 0.25, fov: 44, dist: 620 + k * 380, roll: 0, sm: 0.12 };
      } else if (b && (b.state === 'dying' || b.dead)) {
        s = { x: b.x, y: 140, z: Zof(b.y), yaw: 0.3 + fr * 0.012, pitch: 0.2, fov: 42, dist: 700, roll: 0, sm: 0.06 };
      } else if (ct && ct.f && ct.t < 78 && !ct.f.ko) {
        // close no COMBO FINAL: câmera baixa na frente do Titã
        const f = ct.f;
        s = { x: f.x + f.facing * 90, y: 80 + f.z * 0.6, z: Zof(f.y), yaw: f.facing * 0.38, pitch: 0.13, fov: 46, dist: 500, roll: f.facing * -0.05, sm: 0.14 };
      } else if (b) {
        // luta contra o chefe: enquadra os dois; na fase 2 a câmera passeia de um lado para o outro
        const mx = p ? (p.x + b.x) / 2 : b.x, my = p ? (p.y + b.y) / 2 : b.y;
        const p2 = b.phase2 && b.phase2();
        s = { x: TT.clamp(mx, g.camX + 520, g.camX + W - 520), y: 90, z: Zof(my) * 0.5, yaw: p2 ? Math.sin(fr * 0.004) * 0.62 : -0.38, pitch: p2 ? 0.34 : 0.28, fov: 42, dist: 0, roll: 0, sm: 0.04, frame: 1120 };
      } else if (!g.secActive && !g.enemies.length && p) {
        // entre as arenas: perseguição pela avenida, câmera baixa olhando para a frente
        s = { x: p.x + 260, y: 90, z: Zof(p.y) * 0.6, yaw: -0.92, pitch: 0.2, fov: 50, dist: 700, roll: 0, sm: 0.04 };
      } else if (sec && g.secIdx === 3) {
        // 2ª arena 3D: vista de cima, quase um tabuleiro
        s = { x: cx, y: 40, z: 20, yaw: 0.12, pitch: 0.8, fov: 40, dist: 0, roll: 0, sm: 0.05, frame: 1180 };
      }
      if (!s.dist) {
        // ninguém importante fica fora do quadro: alarga e desloca o enquadramento para caber os Titãs (e o chefe)
        let lo = 1e9, hi = -1e9;
        for (const t of ps) { lo = Math.min(lo, t.x); hi = Math.max(hi, t.x); }
        if (b && !b.dead) { lo = Math.min(lo, b.x); hi = Math.max(hi, b.x); }
        let fw = s.frame || W;
        if (hi > lo - 1) {
          const m = 170 + Math.abs(Math.sin(s.yaw)) * 120;
          lo -= m; hi += m;
          if (hi - lo > fw) { fw = hi - lo; s.x = (lo + hi) / 2; }
          else s.x = TT.clamp(s.x, hi - fw / 2, lo + fw / 2);
        }
        s.dist = this.fitDist(s.fov, fw);
      }
      // DOBRA DIMENSIONAL: o chefe achata o mundo e a câmera volta a ser plana
      const fl = b && b.flat ? b.flat : 0;
      if (fl > 0) {
        const F = this.flatShot(), k = smooth(TT.clamp(fl, 0, 1));
        s = { x: lerp(s.x, F.x, k), y: lerp(s.y, F.y, k), z: lerp(s.z, F.z, k), yaw: lerp(s.yaw, F.yaw, k), pitch: lerp(s.pitch, F.pitch, k), fov: lerp(s.fov, F.fov, k), dist: lerp(s.dist, F.dist, k), roll: 0, sm: 0.2 };
      }
      return s;
    }
    transShot(t) {
      // ladrilhos caem com a câmera ainda "plana"; depois a perspectiva entra num dolly-zoom e a câmera gira
      const F = this.flatShot(), g = this.game;
      const keys = [[0, 0, PITCH_FLAT, 5, 1], [70, 0, PITCH_FLAT, 5, 1], [150, -0.7, 0.22, 50, 0.72], [205, 1.0, 0.46, 44, 0.9], [250, 0.42, 0.3, 40, 1]];
      let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
      const a = keys[i], b = keys[i + 1], k = smooth(TT.clamp((t - a[0]) / (b[0] - a[0]), 0, 1));
      const fov = lerp(a[3], b[3], k), mul = lerp(a[4], b[4], k);
      const yE = 70, tk = smooth(TT.clamp((t - 70) / 120, 0, 1));
      return { x: g.camX + W / 2, y: lerp(F.y, yE, tk), z: lerp(0, -20, tk), yaw: lerp(a[1], b[1], k), pitch: lerp(a[2], b[2], k), fov, dist: this.fitDist(fov, lerp(W, 1060, tk)) * mul, roll: 0 };
    }
    updateCamera() {
      const g = this.game;
      let s;
      if (g.dimTrans) { s = this.transShot(g.dimTrans.t); this.cv = Object.assign({}, s); }
      else {
        s = this.shot();
        if (!this.cv) this.cv = Object.assign({}, s);
        else {
          const k = s.sm || 0.05, c = this.cv;
          for (const key of ['x', 'y', 'z', 'yaw', 'pitch', 'fov', 'roll']) c[key] += (s[key] - c[key]) * Math.min(1, k * 1.6);
          // a distância acompanha o fov em escala logarítmica (o dolly-zoom fica suave)
          c.dist = Math.exp(Math.log(c.dist) + (Math.log(s.dist) - Math.log(c.dist)) * Math.min(1, k * 1.6));
        }
      }
      const c = this.cv, cam = this.cam;
      const sh = g.shake || 0;
      const ox = sh ? TT.rand(-sh, sh) * 1.4 : 0, oy = sh ? TT.rand(-sh, sh) : 0;
      const cp = Math.cos(c.pitch);
      cam.position.set(c.x + Math.sin(c.yaw) * cp * c.dist + ox, c.y + Math.sin(c.pitch) * c.dist + oy, c.z + Math.cos(c.yaw) * cp * c.dist);
      cam.up.set(Math.sin(c.roll || 0), Math.cos(c.roll || 0), 0);
      cam.lookAt(c.x + ox, c.y + oy, c.z);
      cam.fov = c.fov; cam.near = Math.max(5, c.dist * 0.05); cam.far = c.dist + 45000; cam.updateProjectionMatrix();
      this.scene.fog.near = c.dist + 2200; this.scene.fog.far = c.dist + 9000;
      this.sky.position.copy(cam.position);
      // o sol (e a caixa das sombras) segue a ação
      this.sun.target.position.set(c.x, 0, c.z);
      this.sun.position.set(c.x - 700, 1300, c.z + 900);
    }

    // ------------------------------------------------------------ Projeção (2D -> tela, preso no plano da profundidade)
    project(x, h, z, out) {
      const v = this.vec.set(x, h, z).project(this.cam);
      out[0] = (v.x + 1) * W / 2; out[1] = (1 - v.y) * H / 2; out[2] = v.z;
      return out;
    }
    // Ponto (u, v) do desenho 2D -> mundo (u + camX, altura gy - v, Z(gy)): transformação afim que gruda o
    // desenho no plano vertical da profundidade gy, ao redor do ponto (ax, ay).
    planeXf(ctx, gy, ax, ay) {
      const g = this.game, camX = g.camX, Z = Zof(gy), P = this.p0 || (this.p0 = [0, 0, 0]), U = this.p1 || (this.p1 = [0, 0, 0]), V = this.p2 || (this.p2 = [0, 0, 0]);
      this.project(ax + camX, gy - ay, Z, P);
      if (P[2] > 1 || P[2] < -1) return false;
      this.project(ax + camX + 10, gy - ay, Z, U);
      this.project(ax + camX, gy - ay - 10, Z, V);
      let a = (U[0] - P[0]) / 10, b = (U[1] - P[1]) / 10;
      const c = (V[0] - P[0]) / 10, d = (V[1] - P[1]) / 10;
      // câmera muito de lado: não deixa o desenho virar um risco
      const lu = Math.hypot(a, b), lv = Math.hypot(c, d);
      if (lu < lv * 0.45) { const k = (lv * 0.45) / Math.max(1e-4, lu); a *= k; b *= k; }
      const s = g.scale;
      ctx.setTransform(a * s, b * s, c * s, d * s, (P[0] - a * ax - c * ay) * s, (P[1] - b * ax - d * ay) * s);
      return true;
    }

    // ------------------------------------------------------------ Desenho do quadro
    syncSize() {
      const cw = this.game.canvas.width, ch = this.game.canvas.height;
      const res = this.gfx ? this.gfx.res : 1, k = Math.min(1, (this.mobile ? 1280 : 2560) / cw) * res, w = Math.round(cw * k), h = Math.round(ch * k);
      if (this.canvas.width !== w || this.canvas.height !== h) this.renderer.setSize(w, h, false);
      if (this.gfx) this.gfx.setSize(w, h);
    }
    drawWorld(ctx) {
      const g = this.game, camX = g.camX, s = g.scale;
      this.syncSize();
      this.updateCamera();
      // modelos
      const used = new Set();
      const list = [];
      if (g.state !== 'clear') for (const p of g.players()) list.push(p);
      for (const e of g.enemies) list.push(e);
      for (const c of g.props) list.push(c);
      for (const d of list) {
        const M = this.modelFor(d);
        if (!M) continue;
        used.add(d);
        if (this.flat2D(d)) { M.root.visible = false; continue; }
        this.syncModel(d, M);
      }
      for (const [d, M] of this.models) if (!used.has(d)) { this.scene.remove(M.root); this.models.delete(d); }
      this.syncFx();
      this.animateCity();
      this.drawGroundDecal();
      const t0 = performance.now();
      if (this.gfx) { try { this.gfx.render(this.scene, this.cam); } catch (e) { console.warn('[3D] pós-processamento falhou:', e && e.message); this.gfx = null; this.renderer.setRenderTarget(null); this.renderer.render(this.scene, this.cam); } }
      else this.renderer.render(this.scene, this.cam);
      if (g.dimTrans) this.renderTiles(g.dimTrans.t);
      ctx.save();
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.drawImage(this.canvas, 0, 0, W, H);
      ctx.restore();
      if (this.gfx) this.gfx.track(performance.now() - t0);
      if (!g.dimTrans || g.dimTrans.t > 60) this.drawOverlay(ctx, list);
    }
    renderTiles(t) {
      const r = this.renderer;
      for (const m of this.tiles) {
        const u = m.userData, start = 18 + (u.c / 15) * 60 + u.d * 14 + (u.r % 2) * 4;
        const k = TT.clamp((t - start) / 46, 0, 1), e = k * k;
        m.visible = k < 1;
        const jit = t < 18 && (t >> 1) % 2 ? (Math.random() - 0.5) * 14 : 0; // falha: linhas tremendo antes de cair
        m.position.set(u.x + jit + u.s * e * 120, u.y - e * e * 700, e * 340);
        m.rotation.set(e * 1.1 * u.d, u.s * e * Math.PI * 0.95, u.s * e * 0.5);
        m.material.opacity = 1 - Math.max(0, (k - 0.55) / 0.45);
      }
      r.autoClear = false; r.clearDepth(); r.render(this.oScene, this.oCam); r.autoClear = true;
    }
    drawGroundDecal() {
      const g = this.game, camX = g.camX, gc = this.gctx;
      let any = false;
      for (const e of g.enemies) if (e.atk && e.atk.zones && e.state === 'attack') { any = true; break; }
      if (!any) for (const ef of g.effects) if (ef.drawGround) { any = true; break; }
      if (!any) for (const pr of g.projectiles) if (pr.drawGround) { any = true; break; }
      if (!any) for (const p of g.particles.list) if (p.type === 'ring' && p.flat && p.flat < 0.6) { any = true; break; }
      this.decal.visible = any;
      if (!any) return;
      gc.setTransform(1, 0, 0, 1, 0, 0); gc.clearRect(0, 0, this.GW, this.GH);
      gc.setTransform(1, 0, 0, 1, this.GM, -this.GY0);
      for (const ef of g.effects) if (ef.drawGround) ef.drawGround(gc, camX);
      for (const e of g.enemies) if (e.drawGround) e.drawGround(gc, camX);
      for (const pr of g.projectiles) if (pr.drawGround) pr.drawGround(gc, camX);
      g.particles.draw(gc, camX, (p) => p.type === 'ring' && p.flat && p.flat < 0.6);
      gc.setTransform(1, 0, 0, 1, 0, 0);
      this.gtex.needsUpdate = true;
      this.decal.position.x = camX - this.GM + this.GW / 2;
      this.decal.position.y = camX > 5500 ? 19 : 1.5; // na arena do chefe o chão é a plataforma de hexágonos
    }
    // Efeitos 2D por cima do 3D, cada um preso na profundidade dele.
    drawOverlay(ctx, list) {
      const g = this.game, camX = g.camX, s = g.scale;
      const D = [];
      for (const d of list) D.push(d);
      for (const k of g.pickups) D.push(k);
      for (const pr of g.projectiles) D.push(pr);
      for (const ef of g.effects) if (ef.draw) D.push(ef);
      if (g.drill) D.push(g.drill);
      D.sort((a, b) => (a.y || 0) - (b.y || 0));
      // passada escondida dos Titãs: mantém as posições das mãos (rigOut) que os golpes usam para soltar raios
      const ps = g.particles, spawn0 = ps.spawn, nop = () => ({});
      ps.spawn = nop;
      TT.renderScale = 1;
      for (const d of list) if (d.key && d.rigOut) { try { d.draw(this.hidden, camX); } catch (e) { /* desenho de apoio */ } }
      ps.spawn = spawn0;
      TT.renderScale = s;
      ctx.save();
      for (const d of D) {
        const M = this.models.get(d), modeled = !!M && !this.flat2D(d);
        if (typeof d.y !== 'number') { ctx.setTransform(s, 0, 0, s, 0, 0); TT.SKIP_RIG = false; d.draw(ctx, camX); continue; }
        if (d.isProp && M) continue;
        if (!this.planeXf(ctx, d.y, d.x - camX, d.y - (d.z || 0))) continue;
        TT.SKIP_RIG = modeled;
        try { d.draw(ctx, camX); } finally { TT.SKIP_RIG = false; }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      // partículas (os anéis deitados já foram para o chão)
      ps.draw(ctx, camX, (p) => {
        if (p.type === 'ring' && p.flat && p.flat < 0.6) return false;
        return this.planeXf(ctx, p.gy, p.x - camX, p.y);
      });
      ctx.setTransform(s, 0, 0, s, 0, 0);
      const P = [0, 0, 0];
      g.drawBubbles(ctx, camX, (f) => {
        const hz = f.hoverZ ? f.hoverZ() : 0;
        this.project(f.x, f.z + hz + (f.height || 120) * (f.isBoss ? 1 : 1.05) + 30, Zof(f.y), P);
        return P[2] > 1 ? null : [P[0], P[1]];
      });
      ctx.restore();
    }
  }
  TT.World3D = World3D;
  TT.W3D_Zof = Zof;
})();
