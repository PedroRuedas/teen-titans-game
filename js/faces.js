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
  F.robin = function (ctx, pose) {
    const skin = '#f4c39e';
    // cabelo de trás: espetado e jogado para trás
    fill(ctx, 'M 66 -64 L 96 -84 L 70 -92 L 80 -126 L 46 -108 L 34 -146 L 8 -112 L -20 -144 L -32 -104 L -76 -124 L -68 -80 L -124 -86 L -88 -50 L -128 -26 L -86 -18 L -106 16 L -66 4 L -54 30 L -40 -10 L -10 -50 L 40 -62 Z', '#16161c');
    baseHead(ctx, skin);
    fill(ctx, 'M -86 2 C -92 -50 -62 -92 -18 -98 L -30 -40 L -46 -10 L -44 34 C -62 36 -82 24 -86 2 Z', '#16161c'); // nuca
    fill(ctx, EAR, skin, 6); line(ctx, EAR_IN, 4.5, SKIN_SH(skin));
    // franja: mechas pontudas sobre a testa
    fill(ctx, 'M -50 -12 C -62 -70 -24 -108 26 -106 C 66 -104 92 -84 104 -58 L 86 -60 L 98 -38 L 70 -56 L 64 -34 L 44 -60 L 30 -40 L 18 -66 L -6 -46 L -12 -70 L -30 -40 Z', '#16161c');
    if (!FL) line(ctx, 'M -4 -76 Q 30 -88 62 -78 M -60 -60 Q -46 -86 -14 -98', 5, '#5f6f9c'); // brilho azulado
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
  F.beastboy = function (ctx, pose) {
    const skin = '#7cc444';
    // orelha pontuda bem grande (lado de perto)
    fill(ctx, 'M -40 -14 L -156 -76 L -50 40 Z', skin, 6.5);
    if (!FL) fill(ctx, 'M -54 -2 L -122 -54 L -58 24 Z', '#5f9e33', 0);
    baseHead(ctx, skin);
    // cabelo verde-escuro espetado
    fill(ctx, 'M -60 -10 L -76 -46 L -110 -54 L -74 -76 L -82 -110 L -42 -92 L -26 -134 L 0 -98 L 30 -128 L 40 -92 L 76 -104 L 72 -70 L 104 -60 L 88 -42 C 60 -56 30 -60 0 -54 C -24 -48 -44 -32 -60 -10 Z', '#2a6a1a');
    if (!FL) line(ctx, 'M -40 -80 Q -10 -98 24 -90', 5, '#76c14a');
    line(ctx, NOSE, 5.5);
    eye(ctx, 32, -6, pose, { rx: 20, ry: 23, iris: '#2d8a1f', irisK: 0.56, look: 0.3, brow: 'M 8 -40 L 52 -34', browW: 6 });
    eye(ctx, 82, -8, pose, { rx: 12, ry: 21, iris: '#2d8a1f', irisK: 0.52, look: 0.2, brow: 'M 72 -36 L 96 -40', browW: 5.5 });
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
  const HOOD = 'M 10 -150 C 80 -148 130 -96 128 -10 C 126 60 96 112 40 124 C -20 136 -100 110 -130 50 C -150 -10 -130 -90 -80 -126 C -56 -142 -24 -152 10 -150 Z';
  F.raven = function (ctx, pose, opt) {
    const skin = '#c9c3d7', hair = '#4b3182';
    if (!opt || !opt.noHood) {
      fill(ctx, HOOD, '#2a3a9e');
      shadow(ctx, HOOD, 'M -160 -160 L -40 -160 C -60 -40 -50 60 -20 160 L -160 160 Z', '#1d2878');
      if (!FL) { ctx.fillStyle = '#10153f'; ctx.fill(P('M 14 -126 C 70 -124 108 -84 108 -16 C 108 50 82 96 36 106 C -14 116 -80 96 -104 46 C -122 -2 -108 -70 -66 -102 C -44 -118 -14 -128 14 -126 Z')); }
    }
    baseHead(ctx, skin);
    // cabelo violeta curto (chanel), franja reta na altura das sobrancelhas
    fill(ctx, 'M -70 70 C -96 20 -96 -60 -46 -90 C 0 -116 70 -104 98 -60 C 104 -48 102 -30 98 -22 L 84 -30 L 78 -20 L 60 -32 L 48 -24 L 34 -34 L 16 -28 L 2 -34 C -26 -20 -34 20 -30 80 Z', hair);
    if (!FL) line(ctx, 'M -52 -64 Q -10 -96 50 -86', 5, '#8e6bd6');
    // chakra
    if (!FL) { ctx.fillStyle = '#e0233f'; ctx.beginPath(); ctx.ellipse(58, -46, 5.5, 7, 0, 0, TAU); ctx.fill(); }
    line(ctx, NOSE, 5);
    eye(ctx, 34, -2, pose, { rx: 19, ry: 17, iris: '#6a45b8', irisK: 0.58, pupil: '#2b1f55', look: 0.28, lid: skin, lidK: 0.42, lidW: 7.5,
      brow: 'M 12 -26 Q 32 -34 54 -26', browCol: '#3a2470', browW: 4.5 });
    eye(ctx, 82, -4, pose, { rx: 11, ry: 16, iris: '#6a45b8', irisK: 0.54, pupil: '#2b1f55', look: 0.2, lid: skin, lidK: 0.42, lidW: 7,
      brow: 'M 72 -28 Q 84 -34 96 -28', browCol: '#3a2470', browW: 4 });
    mouth(ctx, 60, 62, pose);
    if (!opt || !opt.noHood) { // borda do capuz na frente da testa
      ctx.strokeStyle = INK; ctx.lineWidth = 22; ctx.stroke(P('M -96 -60 C -60 -128 60 -138 112 -60'));
      ctx.strokeStyle = FL ? '#ffffff' : '#34469e'; ctx.lineWidth = 13; ctx.stroke(P('M -96 -60 C -60 -128 60 -138 112 -60'));
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
