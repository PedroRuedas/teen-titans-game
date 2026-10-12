'use strict';
// Rostos dos Titãs desenhados como arte vetorial (caminhos SVG), no estilo da série de 2003.
// Espaço de desenho: cabeça com "raio" 100, olhando para a direita (vista 3/4). y para baixo.
(function () {
  const TT = window.TT;
  const INK = '#120d18', LW = 7.5, TAU = Math.PI * 2;
  const cache = new Map();
  const P = (d) => { let p = cache.get(d); if (!p) { p = new Path2D(d); cache.set(d, p); } return p; };

  let FL = false; // feixe branco de dano
  function fill(ctx, d, col, lw) {
    const p = P(d);
    ctx.fillStyle = FL ? '#ffffff' : col; ctx.fill(p);
    if (lw !== 0) { ctx.strokeStyle = INK; ctx.lineWidth = lw || LW; ctx.stroke(p); }
  }
  function line(ctx, d, lw, col) { ctx.strokeStyle = col || INK; ctx.lineWidth = lw || LW; ctx.stroke(P(d)); }
  // reflexos do cabelo recortados dentro das mechas (não vazam para fora)
  function shine(ctx, clips, d, col) {
    if (FL) return;
    for (const c of clips) { ctx.save(); ctx.clip(P(c)); line(ctx, d, 5, col); ctx.restore(); }
  }
  // sombra chapada recortada dentro de um caminho
  function shadow(ctx, clipD, shD, col) {
    if (FL) return;
    ctx.save(); ctx.clip(P(clipD)); ctx.fillStyle = col; ctx.fill(P(shD)); ctx.restore();
  }

  // Formatos de cabeça (3/4 para a direita): crânio redondo, maçã do rosto e queixo fino.
  const HEAD = 'M -84 -8 C -86 -66 -36 -100 14 -99 C 62 -98 94 -64 96 -18 C 97 8 93 26 88 38 C 82 58 66 78 50 92 C 44 98 36 101 28 100 C 6 98 -24 86 -46 66 C -68 48 -82 22 -84 -8 Z';
  const HEAD_SH = 'M -120 -120 L -10 -120 C -40 -60 -44 10 -6 110 L -120 110 Z';
  const JAW_SH = 'M -60 60 C -20 84 20 96 50 92 L 40 130 L -80 130 Z';
  const NOSE = 'M 86 2 L 97 25 L 84 30';
  const EAR = 'M -44 -10 C -58 -24 -76 -8 -70 14 C -66 30 -52 34 -42 26';
  const EAR_IN = 'M -50 -2 C -58 -6 -62 6 -58 14';

  // Olho no estilo da série. o: { rx, ry, iris, pupil, sclera, irisK, lid (cor da pálpebra), lidK, lash (+1 canto externo à esq.), look, brow: [d], tilt }
  function eye(ctx, x, y, pose, o) {
    if (FL) return;
    const rx = o.rx, ry = o.ry;
    if (pose.eyes === 'x') {
      line(ctx, `M ${x - rx * 0.7} ${y - ry * 0.6} L ${x + rx * 0.7} ${y + ry * 0.6} M ${x + rx * 0.7} ${y - ry * 0.6} L ${x - rx * 0.7} ${y + ry * 0.6}`, 6);
      return;
    }
    if (pose.eyes === 'shut') { line(ctx, `M ${x - rx} ${y} Q ${x} ${y + ry * 0.7} ${x + rx} ${y}`, 6.5); return; }
    ctx.save();
    ctx.translate(x, y); ctx.rotate(o.tilt || 0);
    const shape = new Path2D();
    shape.moveTo(-rx, ry * 0.05);
    shape.bezierCurveTo(-rx * 0.9, -ry * 1.05, rx * 0.9, -ry * 1.15, rx, -ry * 0.05);
    shape.bezierCurveTo(rx * 0.95, ry * 0.85, -rx * 0.85, ry * 0.95, -rx, ry * 0.05);
    ctx.fillStyle = o.sclera || '#ffffff'; ctx.fill(shape);
    ctx.save(); ctx.clip(shape);
    const lx = rx * (o.look == null ? 0.22 : o.look), ik = o.irisK || 0.62;
    if (o.iris) {
      ctx.beginPath(); ctx.ellipse(lx, ry * 0.08, rx * ik, ry * 0.78, 0, 0, TAU); ctx.fillStyle = o.iris; ctx.fill();
      if (o.irisDark) { ctx.beginPath(); ctx.ellipse(lx, ry * 0.08, rx * ik, ry * 0.78, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(lx, ry * 0.08); ctx.fillStyle = o.irisDark; ctx.fill(); }
    }
    if (o.pupil !== false) { ctx.beginPath(); ctx.ellipse(lx, ry * 0.1, rx * ik * 0.48, ry * 0.42, 0, 0, TAU); ctx.fillStyle = o.pupil || '#0b0810'; ctx.fill(); }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(lx - rx * 0.2, -ry * 0.25, rx * 0.16, ry * 0.15, 0, 0, TAU); ctx.fill();
    if (o.lid) { // pálpebra semicerrada (Ravena)
      ctx.fillStyle = o.lid; ctx.beginPath(); ctx.rect(-rx * 1.2, -ry * 1.3, rx * 2.4, ry * (1.3 * (o.lidK || 0.5) + 0.35)); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(shape);
    // pálpebra de cima grossa + cílio no canto externo
    const L = o.lash || 1, lidY = o.lid ? -ry * 1.05 + ry * 2.3 * (o.lidK || 0.5) * 0.55 : 0;
    ctx.lineWidth = o.lidW || 8; ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.lid) { ctx.moveTo(-rx * 1.02, lidY + ry * 0.1); ctx.quadraticCurveTo(0, lidY - ry * 0.12, rx * 1.02, lidY + ry * 0.05); }
    else { ctx.moveTo(-rx, ry * 0.05); ctx.bezierCurveTo(-rx * 0.9, -ry * 1.05, rx * 0.9, -ry * 1.15, rx, -ry * 0.05); }
    ctx.stroke();
    if (o.lashes) { // cílios femininos (Estelar)
      ctx.lineWidth = 5;
      const sx = L > 0 ? -rx : rx, sy = (o.lid ? lidY : 0);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - L * rx * 0.35, sy - ry * 0.25, sx - L * rx * 0.55, sy - ry * 0.55); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + L * rx * 0.25, sy - ry * 0.55); ctx.quadraticCurveTo(sx - L * rx * 0.05, sy - ry * 0.8, sx - L * rx * 0.25, sy - ry * 1.05); ctx.stroke();
    }
    ctx.restore();
    if (o.brow) line(ctx, o.brow, o.browW || 6, o.browCol || INK);
  }

  // Boca: neutra, sorriso, grito (aberta) e sorriso com presa (Mutano).
  function mouth(ctx, x, y, pose, o) {
    if (FL) return;
    o = o || {};
    const m = pose.mouth || o.def;
    if (m === 'shout' || m === 'open') {
      const d = `M ${x - 18} ${y - 4} Q ${x + 2} ${y - 9} ${x + 16} ${y - 6} Q ${x + 14} ${y + 18} ${x} ${y + 20} Q ${x - 14} ${y + 16} ${x - 18} ${y - 4} Z`;
      fill(ctx, d, '#4a0f1c', 5);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 14, y - 6, 27, 6);
      ctx.fillStyle = '#d24a64'; ctx.beginPath(); ctx.ellipse(x - 1, y + 13, 8, 4.5, 0, 0, TAU); ctx.fill();
    } else if (m === 'smile' || o.grin) {
      if (o.grin) { // sorriso largo de canto, com presa
        fill(ctx, `M ${x - 24} ${y - 6} Q ${x - 2} ${y + 12} ${x + 18} ${y - 10} Q ${x + 10} ${y + 22} ${x - 8} ${y + 14} Q ${x - 20} ${y + 6} ${x - 24} ${y - 6} Z`, '#ffffff', 5);
        if (o.fang) fill(ctx, `M ${x - 2} ${y + 6} L ${x + 8} ${y + 4} L ${x + 4} ${y + 18} Z`, '#ffffff', 3);
      } else line(ctx, `M ${x - 20} ${y - 6} Q ${x - 2} ${y + 10} ${x + 16} ${y - 8}`, 5.5);
    } else if (m === 'frown') {
      line(ctx, `M ${x - 14} ${y + 2} Q ${x} ${y - 4} ${x + 12} ${y + 2}`, 5);
    } else {
      line(ctx, `M ${x - 14} ${y} L ${x + 12} ${y - 2}`, 5);
    }
  }

  const SKIN_SH = (c) => TT.shade(c, -0.26);
  function baseHead(ctx, skin, d) {
    fill(ctx, d || HEAD, skin);
    shadow(ctx, d || HEAD, HEAD_SH, SKIN_SH(skin));
    shadow(ctx, d || HEAD, JAW_SH, SKIN_SH(skin));
    ctx.strokeStyle = INK; ctx.lineWidth = LW; ctx.stroke(P(d || HEAD));
  }

  const F = {};
  TT.FACES = F;

  // ------------------------------------------------------------------ Robin
  const R_BACK = 'M 88 -50 C 96 -70 98 -92 90 -114 C 80 -102 66 -98 54 -100 C 48 -126 30 -144 4 -154 C 6 -130 -2 -118 -12 -112 ' +
    'C -34 -134 -66 -144 -102 -140 C -82 -122 -70 -110 -66 -102 C -98 -106 -130 -96 -158 -72 C -124 -70 -104 -64 -94 -56 ' +
    'C -120 -46 -140 -24 -152 6 C -122 -10 -106 -12 -94 -10 C -106 6 -112 30 -110 54 C -92 34 -80 24 -72 20 L -40 -20 L 40 -70 Z';
  const R_CAP = 'M 94 -50 C 80 -62 52 -64 30 -58 C 6 -52 -18 -42 -38 -24 C -46 -12 -50 10 -46 34 C -66 36 -84 24 -88 0 ' +
    'C -94 -60 -50 -104 0 -106 C 50 -108 88 -88 94 -50 Z';
  F.robin = function (ctx, pose) {
    const skin = '#f4c39e', hair = '#16161c';
    // cabelo de trás: mechas grandes e pontudas jogadas para trás
    fill(ctx, R_BACK, hair);
    baseHead(ctx, skin);
    // touca do cabelo sobre o crânio e a nuca (linha da testa alta, puxada para trás)
    fill(ctx, R_CAP, hair);
    shine(ctx, [R_BACK, R_CAP], 'M 72 -86 Q 40 -104 4 -130 M 20 -92 Q -30 -110 -80 -124 M -40 -74 Q -90 -78 -132 -70 M -66 -40 Q -100 -30 -128 -6', '#4c5a86');
    fill(ctx, EAR, skin, 6); line(ctx, EAR_IN, 4.5, SKIN_SH(skin));
    line(ctx, NOSE, 5.5);
    // máscara preta com pontas e lentes brancas
    fill(ctx, 'M 2 -14 L -18 -42 L 14 -36 C 36 -46 70 -48 100 -36 L 102 -6 C 90 8 72 12 60 4 C 54 12 46 14 38 12 C 22 18 8 10 2 -14 Z', '#141318', 0);
    if (!FL && pose.eyes !== 'shut' && pose.eyes !== 'x') {
      fill(ctx, 'M 14 -18 C 22 -32 44 -34 54 -24 C 52 -12 42 -2 30 -4 C 22 -6 16 -10 14 -18 Z', '#ffffff', 0);
      fill(ctx, 'M 68 -26 C 76 -34 92 -34 98 -28 C 96 -16 88 -8 82 -8 C 74 -10 70 -16 68 -26 Z', '#ffffff', 0);
    } else if (!FL) line(ctx, 'M 16 -14 L 52 -18 M 70 -18 L 96 -20', 4, '#ffffff');
    mouth(ctx, 62, 58, pose);
  };

  // ------------------------------------------------------------------ Estelar
  F.starfire = function (ctx, pose) {
    const skin = '#f2a14a', hair = '#b81f2b';
    // volume do cabelo atrás da cabeça
    fill(ctx, 'M 70 -80 C 30 -112 -60 -112 -96 -60 C -118 -24 -112 40 -96 100 L -50 104 C -60 60 -60 20 -50 -10 Z', hair);
    baseHead(ctx, skin);
    // franja reta e cheia, com mecha descendo na frente da orelha
    fill(ctx, 'M -58 60 C -78 10 -84 -60 -40 -88 C 0 -112 70 -104 98 -60 C 102 -50 100 -40 96 -36 L 80 -40 L 74 -34 L 58 -40 L 46 -32 L 30 -40 L 16 -32 L 0 -40 L -14 -30 C -30 -14 -36 20 -32 66 Z', hair);
    if (!FL) line(ctx, 'M -46 -60 Q -6 -96 56 -88 M -58 -10 Q -64 20 -54 48', 5, '#ff6b5e');
    line(ctx, NOSE, 5);
    // olhos inteiramente verdes, grandes, com cílios
    eye(ctx, 34, 0, pose, { rx: 22, ry: 25, sclera: '#3fd36e', iris: '#a6ffbf', irisK: 0.55, pupil: '#0d7a35', look: 0.3, lashes: true, lash: 1,
      brow: 'M 10 -36 Q 30 -48 54 -40', browCol: '#7a1018', browW: 4.5 });
    eye(ctx, 84, -2, pose, { rx: 13, ry: 23, sclera: '#3fd36e', iris: '#a6ffbf', irisK: 0.5, pupil: '#0d7a35', look: 0.2, lashes: true, lash: -1,
      brow: 'M 74 -40 Q 86 -46 98 -40', browCol: '#7a1018', browW: 4 });
    mouth(ctx, 62, 62, pose, { def: 'smile' });
  };

  // ------------------------------------------------------------------ Mutano
  const B_BACK = 'M 84 -48 C 98 -66 104 -82 100 -102 C 88 -92 76 -90 66 -92 C 66 -114 56 -130 40 -140 C 34 -120 26 -110 16 -106 ' +
    'C 4 -128 -16 -138 -42 -140 C -32 -120 -32 -108 -36 -100 C -60 -110 -88 -108 -112 -96 C -90 -84 -80 -76 -76 -68 ' +
    'C -98 -62 -112 -46 -120 -28 C -98 -32 -86 -32 -78 -30 L -40 -20 L 40 -60 Z';
  const B_CAP = 'M 94 -40 C 86 -52 72 -52 62 -56 C 64 -46 62 -40 56 -34 C 50 -44 40 -50 30 -52 C 28 -44 24 -38 16 -34 ' +
    'C 10 -44 -2 -50 -16 -48 C -32 -44 -44 -32 -52 -16 C -64 -22 -76 -16 -84 -4 C -92 -52 -56 -104 2 -106 C 54 -108 90 -84 94 -40 Z';
  F.beastboy = function (ctx, pose) {
    const skin = '#7cc444', hair = '#2a6a1a';
    // tufos de trás: espetados para cima e para trás
    fill(ctx, B_BACK, hair);
    baseHead(ctx, skin);
    // touca com franja espetada caindo sobre a testa
    fill(ctx, B_CAP, hair);
    shine(ctx, [B_BACK, B_CAP], 'M 60 -80 Q 40 -100 24 -120 M -6 -86 Q -30 -104 -52 -120 M -52 -64 Q -80 -76 -100 -84', '#62b23c');
    // orelha pontuda bem grande saindo do lado da cabeça
    fill(ctx, 'M -52 -8 C -90 -40 -132 -66 -172 -86 C -142 -50 -104 -8 -60 36 Z', skin, 6.5);
    if (!FL) fill(ctx, 'M -64 2 C -94 -26 -122 -48 -148 -64 C -122 -36 -96 -6 -66 22 Z', '#5f9e33', 0);
    line(ctx, NOSE, 5.5);
    eye(ctx, 32, -4, pose, { rx: 20, ry: 23, iris: '#2d8a1f', irisK: 0.56, look: 0.3, brow: 'M 8 -36 L 52 -30', browW: 6 });
    eye(ctx, 82, -6, pose, { rx: 12, ry: 21, iris: '#2d8a1f', irisK: 0.52, look: 0.2, brow: 'M 72 -34 L 96 -38', browW: 5.5 });
    mouth(ctx, 58, 58, pose, { grin: true, fang: true });
  };

  // ------------------------------------------------------------------ Ciborgue
  const CY_HEAD = 'M -80 -10 C -82 -70 -30 -100 16 -98 C 64 -96 92 -62 94 -16 C 96 16 92 40 84 60 C 76 82 60 96 36 98 C 6 100 -30 90 -54 70 C -74 52 -80 24 -80 -10 Z';
  F.cyborg = function (ctx, pose) {
    const skin = '#6e4329', metal = '#d6dce4';
    fill(ctx, CY_HEAD, metal);
    shadow(ctx, CY_HEAD, HEAD_SH, '#a8b0bc');
    if (!FL) { // brilho do crânio
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-6, -74, 34, 10, -0.2, 0, TAU); ctx.fill();
    }
    // rosto humano (lado de perto)
    const FACE = 'M -22 -40 C 10 -46 40 -48 62 -46 L 60 -18 L 70 28 L 84 60 C 76 82 60 96 36 98 C 8 100 -14 92 -30 80 C -26 40 -26 0 -22 -40 Z';
    fill(ctx, FACE, skin, 0);
    shadow(ctx, FACE, 'M -40 -60 L 0 -60 C -10 0 -6 50 10 110 L -40 110 Z', TT.shade(skin, -0.3));
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(P(FACE));
    // placa de metal sobre o olho cibernético
    fill(ctx, 'M 62 -46 L 94 -40 C 96 0 92 30 84 58 L 70 28 L 60 -18 Z', '#eef1f5', 5);
    // peça do ouvido
    fill(ctx, 'M -40 6 m -20 0 a 20 20 0 1 0 40 0 a 20 20 0 1 0 -40 0', '#3a3d47', 5);
    fill(ctx, 'M -40 6 m -9 0 a 9 9 0 1 0 18 0 a 9 9 0 1 0 -18 0', '#3b78d8', 0);
    line(ctx, 'M 86 14 L 96 30 L 86 32', 5);
    eye(ctx, 34, -10, pose, { rx: 16, ry: 15, iris: '#3a2214', irisK: 0.6, look: 0.3, lidW: 7, brow: 'M 14 -36 L 56 -30', browW: 8 });
    if (!FL) { // olho cibernético vermelho
      ctx.fillStyle = '#25252c'; ctx.beginPath(); ctx.arc(80, -12, 13, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(81, -12, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd0d0'; ctx.beginPath(); ctx.arc(78, -15, 3, 0, TAU); ctx.fill();
      TT.drawGlow(ctx, '#ff2a2a', 81, -12, 40, 0.9);
    }
    mouth(ctx, 50, 62, pose);
  };

  // ------------------------------------------------------------------ Ravena
  // capuz: silhueta atrás da cabeça e borda da frente envolvendo o rosto por trás
  const HOOD = 'M 20 -138 C 80 -138 114 -96 112 -30 C 110 40 90 100 40 116 C -20 130 -100 108 -126 50 C -146 -8 -128 -86 -80 -118 C -56 -132 -20 -140 20 -138 Z';
  const HOOD_FRONT = 'M 100 -86 C 70 -136 -40 -140 -92 -94 C -128 -58 -136 10 -112 62 C -92 104 -54 120 -8 120 C -30 96 -44 68 -46 40 ' +
    'C -50 0 -48 -40 -24 -76 C 4 -112 64 -116 104 -96 Z';
  const RV_HAIR = 'M -64 76 C -92 20 -94 -64 -42 -94 C 8 -118 82 -104 102 -54 L 102 -40 L 78 -40 C 70 -52 62 -58 56 -58 C 50 -58 42 -50 36 -40 ' +
    'L -6 -40 C -26 -16 -28 30 -26 84 Z';
  F.raven = function (ctx, pose, opt) {
    const skin = '#c9c3d7', hair = '#46307a', hood = !opt || !opt.noHood;
    if (hood) fill(ctx, HOOD, '#10153f');
    baseHead(ctx, skin);
    // cabelo violeta liso (chanel) com franja reta repartida no meio, deixando o chakra à mostra
    fill(ctx, RV_HAIR, hair);
    shine(ctx, [RV_HAIR], 'M -50 -60 Q -6 -96 56 -88 M -60 -6 Q -66 30 -56 60', '#7a5cc4');
    if (!FL) { ctx.fillStyle = '#e0233f'; ctx.beginPath(); ctx.ellipse(56, -44, 6, 7.5, 0, 0, TAU); ctx.fill(); } // chakra
    line(ctx, NOSE, 5);
    // olhos amendoados grandes, íris violeta e pálpebras pesadas
    eye(ctx, 32, 2, pose, { rx: 24, ry: 21, iris: '#5c3fa6', irisDark: '#3a2672', irisK: 0.56, pupil: '#1a1238', look: 0.26, lid: skin, lidK: 0.34, lidW: 8,
      brow: 'M 8 -22 Q 32 -30 58 -24', browCol: '#2e1d5c', browW: 4.5 });
    eye(ctx, 84, 0, pose, { rx: 13, ry: 19, iris: '#5c3fa6', irisDark: '#3a2672', irisK: 0.52, pupil: '#1a1238', look: 0.18, lid: skin, lidK: 0.34, lidW: 7,
      brow: 'M 74 -24 Q 86 -30 98 -24', browCol: '#2e1d5c', browW: 4 });
    if (!FL && pose.eyes !== 'shut' && pose.eyes !== 'x') line(ctx, 'M 14 18 Q 32 26 52 16 M 76 16 Q 84 20 94 15', 3, '#7b6f92'); // linha de baixo
    mouth(ctx, 60, 64, pose);
    if (hood) {
      fill(ctx, HOOD_FRONT, '#2a3a9e', 7);
      shadow(ctx, HOOD_FRONT, 'M -160 -40 L -70 -40 C -80 20 -60 80 -20 140 L -160 140 Z', '#1d2878');
      shine(ctx, [HOOD_FRONT], 'M 70 -116 Q 0 -132 -70 -102', '#4256c0');
    }
  };

  // Desenha o rosto na escala da cabeça (r = raio em px do rig).
  TT.drawFace = function (ctx, key, r, pose, flash, opt) {
    FL = !!flash;
    ctx.save();
    ctx.scale(r / 100, r / 100);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    F[key](ctx, pose, opt);
    ctx.restore();
    FL = false;
  };
})();
