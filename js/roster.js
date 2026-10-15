'use strict';
// Personagens jogáveis do menu PERSONAGENS: a lista do modo "Master of Games" do jogo de PS2 (2006).
// Os cinco Titãs já começam liberados; cada outro personagem é desbloqueado quando o jogador zera a fase
// dele. Quem ainda não tem fase fica registrado aqui (stage: null + plan) para entrar nas próximas fases.
(function () {
  const TT = window.TT, OUT = TT.OUT, A = () => TT.audio;
  const S = TT.STYLES;

  // ================================================================ Lista completa (ordem do jogo de PS2)
  // stage = id da fase que desbloqueia (0 = desde o início); null = fase ainda não feita.
  // base = Titã de origem das versões alternativas (mesmos poderes, já com os combos dos golpes novos).
  TT.ROSTER = [
    { key: 'robin', name: 'Robin', stage: 0 },
    { key: 'cyborg', name: 'Ciborgue', stage: 0 },
    { key: 'raven', name: 'Ravena', stage: 0 },
    { key: 'starfire', name: 'Estelar', stage: 0 },
    { key: 'beastboy', name: 'Mutano', stage: 0 },
    { key: 'hivesoldier', name: 'Soldado H.I.V.E.', stage: 1 },
    { key: 'bunnyguard', name: 'Coelho-Guarda', stage: 6 },
    { key: 'minion', name: 'Robô do Slade', stage: 1 },
    { key: 'blocker', name: 'Bloqueador', stage: null, plan: 'Robô de escudo do Mestre dos Jogos. Entra com a fase da Arena dos Jogos (o Mestre dos Jogos).' },
    { key: 'tempest', name: 'Tempest (Aqualad)', stage: null, plan: 'Titã do mar: controla a água. Entra com uma fase no oceano ou dos Titãs Leste.' },
    { key: 'plasmuskid', name: 'Plasmus Mirim', stage: 4 },
    { key: 'mammoth', name: 'Mammoth', stage: 5 },
    { key: 'jinx', name: 'Jinx', stage: 5 },
    { key: 'gizmo', name: 'Gizmo', stage: 2 },
    { key: 'mumbo', name: 'Mumbo', stage: 6 },
    { key: 'plasmus', name: 'Plasmus', stage: 4 },
    { key: 'cinderblock', name: 'Cinderblock', stage: 1 },
    { key: 'slade', name: 'Slade', stage: 7 },
    { key: 'apprentice', name: 'Aprendiz', stage: 7, base: 'robin', alt: true },
    { key: 'cyclone', name: 'Ciclone', stage: null, alt: true, plan: 'Versão alternativa de um dos Titãs (no jogo de PS2 tem os mesmos poderes, com os combos dos golpes novos).' },
    { key: 'redraven', name: 'Ravena Vermelha', stage: null, base: 'raven', alt: true, plan: 'Ravena tomada pelo lado de Trigon (poderes da Ravena). Entra com a fase de Trigon.' },
    { key: 'whiteraven', name: 'Ravena Branca', stage: null, base: 'raven', alt: true, plan: 'Ravena de manto branco, do fim de "O Fim" (poderes da Ravena). Entra com a fase de Trigon.' },
    { key: 'blackfire', name: 'Blackfire', stage: null, base: 'starfire', alt: true, plan: 'Irmã da Estelar (poderes da Estelar, starbolts roxos). Entra com uma fase da Blackfire.' },
    { key: 'mmm', name: 'Mutano Funcionário', stage: null, base: 'beastboy', alt: true, plan: 'Mutano de uniforme de funcionário (poderes do Mutano). Entra com uma fase futura.' },
    { key: 'clownbb', name: 'Mutano Palhaço', stage: 6, base: 'beastboy', alt: true },
    { key: 'redx', name: 'Red X', stage: null, base: 'robin', alt: true, plan: 'O ladrão de traje com o X vermelho (poderes do Robin, X explosivos). Entra com uma fase do Red X.' },
    { key: 'fang', name: 'Fang', stage: null, plan: 'Vilão-aranha (cabeça de aranha, teias). Entra com uma fase futura.' },
    { key: 'hotspot', name: 'Hot Spot', stage: null, plan: 'Titã de fogo (corpo em chamas). Entra com uma fase dos Titãs aliados.' },
    { key: 'wildebeest', name: 'Wildebeest', stage: null, plan: 'O gnu fortão da H.I.V.E. Entra com uma fase futura da H.I.V.E.' },
    { key: 'terra', name: 'Terra', stage: null, plan: 'Controla a terra e as rochas. Entra com a fase da Terra.' },
    { key: 'speedy', name: 'Ricochete (Speedy)', stage: null, plan: 'O arqueiro dos Titãs Leste (flechas especiais). Entra com uma fase dos Titãs Leste.' },
    { key: 'bumblebee', name: 'Abelha (Bumblebee)', stage: null, plan: 'Líder dos Titãs Leste (encolhe e dá choques). Entra com uma fase dos Titãs Leste.' },
    { key: 'drlight', name: 'Dr. Luz', stage: null, plan: 'Vilão da luz (rajadas e clarões). Entra com a fase do Dr. Luz.' },
    { key: 'madmod', name: 'Mad Mod', stage: null, plan: 'Vilão britânico da hipnose. Entra com a fase da Mansão do Mad Mod.' },
    { key: 'freak', name: 'Control Freak', stage: 9 },
    { key: 'trigon', name: 'Trigon', stage: null, plan: 'O demônio pai da Ravena (gigante). Entra com a fase de Trigon.' },
  ];
  TT.ROSTER_BY = {};
  for (const r of TT.ROSTER) TT.ROSTER_BY[r.key] = r;

  // ================================================================ Desbloqueio (salvo no navegador)
  // Fases zeradas ficam salvas em "fasesZeradas" (ids separados por vírgula).
  TT.Unlocks = {
    cleared() {
      const v = TT.store.get('fasesZeradas', '');
      return new Set(String(v).split(',').map((s) => parseInt(s, 10)).filter((n) => n > 0));
    },
    // Personagem tem fase pronta no jogo (e modelo + golpes)?
    available(key) {
      const r = TT.ROSTER_BY[key];
      return !!(r && r.stage != null && TT.TITANS[key] && (r.stage === 0 || TT.STAGES.some((s) => s.id === r.stage)));
    },
    isUnlocked(key, cl) {
      const r = TT.ROSTER_BY[key];
      if (!this.available(key)) return false;
      return r.stage === 0 || (cl || this.cleared()).has(r.stage);
    },
    // Marca a fase como zerada e devolve os personagens recém-desbloqueados.
    markCleared(id) {
      const cl = this.cleared();
      if (cl.has(id)) return [];
      const before = TT.ROSTER.filter((r) => this.isUnlocked(r.key, cl));
      cl.add(id);
      TT.store.set('fasesZeradas', Array.from(cl).sort((a, b) => a - b).join(','));
      return TT.ROSTER.filter((r) => this.isUnlocked(r.key, cl) && !before.includes(r));
    },
    unlockAll() { TT.store.set('fasesZeradas', TT.STAGES.map((s) => s.id).join(',')); },
    reset() { TT.store.set('fasesZeradas', ''); },
    count() { const cl = this.cleared(); return TT.ROSTER.filter((r) => this.isUnlocked(r.key, cl)).length; },
  };

  // ================================================================ Modelos
  const C = (c) => TT.rigC(c);
  const shade = TT.shade;
  // Mesmo formato de js/render.js (mkStyle), para estilos novos e versões recoloridas.
  function mk(o, from) {
    const st = Object.assign({
      scale: 1, headR: 22, torsoH: 36, shW: 30, hipW: 24, legL: [24, 24], armL: [18, 17],
      legW: 9, armW: 8, handR: 5.5, footR: 6.5,
      skin: '#f6c9a0', torso: '#888', arm: '#888', glove: null, hand: '#f6c9a0', leg: '#555', boot: '#222',
    }, from || {}, o);
    st.glove = st.glove || st.arm;
    if (st.waistW == null) st.waistW = st.hipW * 0.9;
    if (st.neck == null) st.neck = 3;
    st.dark = { leg: shade(st.leg, -0.28), boot: shade(st.boot, -0.28), arm: shade(st.arm, -0.28), glove: shade(st.glove, -0.28), hand: shade(st.hand, -0.28) };
    return st;
  }
  const fillStroke = (ctx, col, lw) => { ctx.fillStyle = C(col); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = lw || 2.4; ctx.stroke(); };

  // Versões jogáveis dos chefes: mesmo visual, em tamanho de herói.
  S.cinderP = mk({ scale: 1.32 }, S.cinderblock);
  S.mammothP = mk({ scale: 1.18 }, S.mammoth);
  S.mumboP = mk({ scale: 1.14 }, S.mumbo);
  S.sladeP = mk({ scale: 1.1 }, S.sladeBoss);
  S.freakP = mk({ scale: 1.1 }, S.freak);

  // ---- Gizmo: baixinho careca de óculos verdes, macacão verde e mochila com patas de aranha mecânicas
  const GZ = { suit: '#3c8f3a', dark: '#2c2c34', metal: '#7c8798', lens: '#7dff6a' };
  S.gizmo = mk({
    scale: 0.88, headR: 19, torsoH: 26, shW: 24, waistW: 18, hipW: 19, legL: [21, 20], armL: [16, 15], legW: 8, armW: 6.6, handR: 5.6, footR: 7.6, neck: 2,
    skin: '#f2c7a5', torso: GZ.suit, arm: GZ.suit, glove: GZ.dark, hand: GZ.dark, leg: GZ.suit, boot: GZ.dark,
    legOpt: { split: 1.5 }, armOpt: { split: 1.5 },
    drawBack(ctx, P) {
      const [sx, sy] = P.S, t = P.t || 0, atk = P.pose.weapon === 'legs';
      // patas de aranha saindo da mochila (abrem nos golpes)
      for (let i = 0; i < 4; i++) {
        const up = i < 2, sp = atk ? 1.6 : 1, w = Math.sin(t * 0.15 + i) * 0.12;
        const a1 = (up ? -2.2 : -2.75) + (i % 2 ? 0.35 : 0) + w, L = (atk ? 34 : 24);
        const kx = sx - 14 + Math.cos(a1) * L, ky = sy + 12 + Math.sin(a1) * L;
        const a2 = a1 + (up ? 1.5 : 1.1) * (i % 2 ? 1 : 0.8), fx = kx + Math.cos(a2) * L * sp * 0.9, fy = ky + Math.sin(a2) * L * sp * 0.9;
        ctx.strokeStyle = OUT; ctx.lineWidth = 6.5; ctx.beginPath(); ctx.moveTo(sx - 12, sy + 12); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();
        ctx.strokeStyle = C(i % 2 ? '#5d6676' : GZ.metal); ctx.lineWidth = 3.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(kx, ky, 3.2, 0, Math.PI * 2); fillStroke(ctx, '#f0c62e', 1.5);
      }
      // mochila
      ctx.beginPath(); ctx.rect(sx - 26, sy + 2, 18, 26); fillStroke(ctx, '#5d6676', 2.2);
      ctx.beginPath(); ctx.arc(sx - 17, sy + 10, 3.5, 0, Math.PI * 2); fillStroke(ctx, '#ff4a3a', 1.2);
    },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.fillStyle = GZ.dark; ctx.fillRect(-16, -8, 32, 6); // cinto
      ctx.fillStyle = '#f0c62e'; ctx.fillRect(-4, -8, 8, 6);
      ctx.fillStyle = '#5d6676'; ctx.fillRect(-14, -th, 28, 6); // alças da mochila
    },
    drawHead(ctx, r, pose) {
      TT.headCircle(ctx, r, '#f2c7a5');
      ctx.beginPath(); ctx.arc(-r * 0.78, r * 0.08, r * 0.28, 0, Math.PI * 2); fillStroke(ctx, '#f2c7a5', 2); // orelha
      if (TT.rigFlash()) return;
      ctx.fillStyle = GZ.dark; ctx.fillRect(-r * 1.0, -r * 0.42, r * 2.0, r * 0.36); // tira dos óculos
      for (const ex of [r * 0.22, r * 0.78]) {
        ctx.beginPath(); ctx.arc(ex, -r * 0.24, r * 0.3, 0, Math.PI * 2); fillStroke(ctx, GZ.lens, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(ex - r * 0.08, -r * 0.34, r * 0.08, 0, Math.PI * 2); ctx.fill();
      }
      TT.drawMouth(ctx, r, pose, r * 0.5, r * 0.5, true);
    },
  });

  // ---- Plasmus e Plasmus Mirim: gosma rosa com bolhas, olhos amarelos pequenos
  const PL = { body: '#e8559a', dark: '#b8306e', light: '#ff9fcb', eye: '#ffe14a' };
  function gooHead(ctx, r, pose, big) {
    ctx.beginPath(); // cabeça disforme de lodo
    ctx.moveTo(-r * 0.9, r * 0.5);
    ctx.bezierCurveTo(-r * 1.2, -r * 0.6, -r * 0.3, -r * 1.25, r * 0.4, -r * 1.0);
    ctx.bezierCurveTo(r * 1.15, -r * 0.8, r * 1.25, r * 0.3, r * 0.85, r * 0.75);
    ctx.quadraticCurveTo(0, r * 1.05, -r * 0.9, r * 0.5);
    ctx.closePath(); fillStroke(ctx, PL.body, 3);
    if (TT.rigFlash()) return;
    ctx.fillStyle = PL.light; ctx.beginPath(); ctx.ellipse(r * 0.1, -r * 0.65, r * 0.3, r * 0.12, -0.3, 0, Math.PI * 2); ctx.fill();
    const ew = big ? 0.24 : 0.15;
    for (const ex of [r * 0.25, r * 0.72]) {
      ctx.beginPath(); ctx.ellipse(ex, -r * 0.12, r * ew, r * ew * 1.15, 0, 0, Math.PI * 2); fillStroke(ctx, PL.eye, 1.8);
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(ex + r * 0.04, -r * 0.1, r * ew * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    // boca larga com dentes
    ctx.beginPath(); ctx.moveTo(r * 0.05, r * 0.35); ctx.quadraticCurveTo(r * 0.5, r * (pose.mouth ? 0.85 : 0.6), r * 0.95, r * 0.3);
    ctx.quadraticCurveTo(r * 0.5, r * 0.45, r * 0.05, r * 0.35); ctx.closePath(); fillStroke(ctx, '#5a1030', 1.8);
    ctx.fillStyle = '#fff6dc'; for (let i = 0; i < 4; i++) ctx.fillRect(r * (0.2 + i * 0.18), r * 0.36, r * 0.08, r * 0.1);
  }
  function gooBody(ctx, P) {
    const th = P.st.torsoH;
    ctx.fillStyle = PL.dark; // bolhas e manchas
    for (const [x, y, rr] of [[-10, -th * 0.7, 5], [8, -th * 0.4, 4], [-4, -th * 0.2, 6], [12, -th * 0.8, 3]]) { ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,220,240,0.5)'; ctx.beginPath(); ctx.arc(6, -th * 0.65, 3, 0, Math.PI * 2); ctx.fill();
  }
  function gooDrips(ctx, P, n) {
    const [sx, sy] = P.S, t = P.t || 0;
    for (let i = 0; i < n; i++) { // pingos de lodo
      const x = sx - 18 + i * 12, len = 10 + ((t * 0.7 + i * 23) % 26);
      ctx.beginPath(); ctx.moveTo(x - 4, sy + 6); ctx.quadraticCurveTo(x - 4, sy + len, x, sy + len + 4); ctx.quadraticCurveTo(x + 4, sy + len, x + 4, sy + 6); ctx.closePath();
      fillStroke(ctx, PL.body, 1.8);
    }
  }
  S.plasmus = mk({
    scale: 1.28, headR: 19, torsoH: 42, shW: 46, waistW: 34, hipW: 30, chest: 6, legL: [22, 20], armL: [24, 23], legW: 14, armW: 13, handR: 10, footR: 10, neck: 1, headOff: 6,
    skin: PL.body, torso: PL.body, arm: PL.body, glove: PL.body, hand: PL.body, leg: PL.body, boot: PL.dark,
    drawBack(ctx, P) { gooDrips(ctx, P, 4); },
    torsoDetail: gooBody,
    drawHead(ctx, r, pose) { gooHead(ctx, r, pose, false); },
  });
  S.plasmuskid = mk({
    scale: 0.9, headR: 20, torsoH: 26, shW: 26, waistW: 22, hipW: 22, chest: 4, legL: [18, 17], armL: [16, 15], legW: 10, armW: 8.5, handR: 7, footR: 8, neck: 1,
    skin: '#ff7ab8', torso: '#ff7ab8', arm: '#ff7ab8', glove: '#ff7ab8', hand: '#ff7ab8', leg: '#ff7ab8', boot: '#c84d8a',
    drawBack(ctx, P) { gooDrips(ctx, P, 2); },
    torsoDetail: gooBody,
    drawHead(ctx, r, pose) { gooHead(ctx, r, pose, true); },
  });

  // ---- Coelho-Guarda: coelho de terno do Mumbo (colete roxo, gravata-borboleta, pés enormes)
  S.bunnyguard = mk({
    scale: 1.0, headR: 17, torsoH: 32, shW: 28, waistW: 20, hipW: 22, legL: [26, 25], armL: [19, 18], legW: 9, armW: 7.4, handR: 6.4, footR: 11, neck: 3,
    skin: '#f6f4fa', torso: '#f6f4fa', arm: '#f6f4fa', glove: '#ffffff', hand: '#ffffff', leg: '#2a2440', boot: '#f6f4fa',
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.fillStyle = '#7a2bb5'; ctx.beginPath(); ctx.moveTo(-18, -th); ctx.lineTo(-3, -th); ctx.lineTo(2, -4); ctx.lineTo(-18, -4); ctx.closePath(); ctx.fill(); // colete
      ctx.beginPath(); ctx.moveTo(18, -th); ctx.lineTo(7, -th); ctx.lineTo(4, -4); ctx.lineTo(18, -4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd23a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-1, -th * 0.65 + i * 8, 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#e0283a'; ctx.beginPath(); ctx.moveTo(2, -th + 2); ctx.lineTo(-6, -th - 2); ctx.lineTo(-6, -th + 6); ctx.closePath(); ctx.moveTo(2, -th + 2); ctx.lineTo(10, -th - 2); ctx.lineTo(10, -th + 6); ctx.closePath(); ctx.fill(); // gravata-borboleta
    },
    drawHead(ctx, r, pose, t) {
      const w = Math.sin((t || 0) * 0.12) * 0.08;
      for (const [ox, rot, col] of [[-r * 0.35, -0.3 + w, '#d9d6e2'], [r * 0.2, 0.1 + w, '#f6f4fa']]) { // orelhas compridas
        ctx.save(); ctx.translate(ox, -r * 0.8); ctx.rotate(rot);
        ctx.beginPath(); ctx.ellipse(0, -r * 1.1, r * 0.36, r * 1.15, 0, 0, Math.PI * 2); fillStroke(ctx, col, 2.6);
        if (!TT.rigFlash()) { ctx.beginPath(); ctx.ellipse(r * 0.04, -r * 1.05, r * 0.16, r * 0.85, 0, 0, Math.PI * 2); ctx.fillStyle = '#ffb3cf'; ctx.fill(); }
        ctx.restore();
      }
      ctx.beginPath(); ctx.ellipse(r * 0.12, 0, r * 1.05, r * 0.92, 0, 0, Math.PI * 2); fillStroke(ctx, '#f6f4fa', 2.8);
      if (TT.rigFlash()) return;
      ctx.fillStyle = '#e01a3a'; // olhos vermelhos de coelho enfeitiçado
      ctx.beginPath(); ctx.ellipse(r * 0.35, -r * 0.2, r * 0.13, r * 0.2, 0, 0, Math.PI * 2); ctx.ellipse(r * 0.8, -r * 0.18, r * 0.1, r * 0.17, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(r * 0.18, -r * 0.5); ctx.lineTo(r * 0.5, -r * 0.4); ctx.moveTo(r * 0.68, -r * 0.42); ctx.lineTo(r * 0.95, -r * 0.5); ctx.stroke();
      ctx.fillStyle = '#ff8fb5'; ctx.beginPath(); ctx.ellipse(r * 1.08, r * 0.18, r * 0.14, r * 0.1, 0, 0, Math.PI * 2); ctx.fill(); // focinho
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4; ctx.fillRect(r * 0.82, r * 0.38, r * 0.2, r * 0.28); ctx.strokeRect(r * 0.82, r * 0.38, r * 0.2, r * 0.28); // dentões
      if (pose.mouth === 'shout') { ctx.beginPath(); ctx.ellipse(r * 0.6, r * 0.5, r * 0.15, r * 0.12, 0, 0, Math.PI * 2); ctx.fillStyle = '#5a1020'; ctx.fill(); ctx.stroke(); }
    },
  });

  // ---- Aprendiz: o Robin com o traje de aprendiz do Slade (preto, placas laranja e cinza, "S" no peito, sem capa)
  S.apprentice = mk({
    torso: '#1c1b22', arm: '#1c1b22', glove: '#8a909a', hand: '#8a909a', leg: '#1c1b22', boot: '#8a909a',
    armOpt: { split: 1.45, band: [{ col: '#ff7a1a', at: 0.1, len: 0.18 }] },
    legOpt: { split: 1.35, sole: '#ff7a1a', band: [{ col: '#ff7a1a', at: 0.9, len: 0.14 }] },
    capeSim: false, drawBack: null,
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.fillStyle = '#ff7a1a'; ctx.fillRect(-15, -th, 9, th - 8); // metade laranja
      ctx.fillStyle = '#8a909a'; ctx.fillRect(-15, -9, 30, 7); // cinto
      ctx.beginPath(); ctx.arc(6, -th + 12, 6, 0, Math.PI * 2); ctx.fillStyle = '#8a909a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#ff7a1a'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('S', 6, -th + 12.5);
    },
  }, S.robin);

  // ---- Mutano Palhaço: macacão de bolinhas, gola de babados e nariz vermelho (o circo do Mumbo)
  S.clownbb = mk({
    torso: '#ffd23a', arm: '#e8343a', glove: '#ffffff', hand: '#ffffff', leg: '#3a6ee8', boot: '#e8343a',
    armOpt: { split: 1.4 }, legOpt: { split: 1.4, sole: '#9a1a20' },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      const dots = [[-9, -th * 0.75, '#e8343a'], [6, -th * 0.55, '#3a6ee8'], [-4, -th * 0.3, '#3ec46a'], [10, -th * 0.15, '#e8343a']];
      for (const [x, y, c] of dots) { ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); }
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * 5, -th, 4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.stroke(); } // gola de babados
    },
    drawHead(ctx, r, pose) {
      TT.drawFace(ctx, 'beastboy', r, pose, TT.rigFlash());
      ctx.beginPath(); ctx.arc(r * 0.98, r * 0.12, r * 0.24, 0, Math.PI * 2); fillStroke(ctx, '#ff2a3a', 2); // nariz de palhaço
      ctx.save(); ctx.translate(-r * 0.1, -r * 0.95); ctx.rotate(-0.25); // chapeuzinho
      ctx.beginPath(); ctx.moveTo(-r * 0.4, 0); ctx.lineTo(0, -r * 0.95); ctx.lineTo(r * 0.4, 0); ctx.closePath(); fillStroke(ctx, '#3a6ee8', 2);
      ctx.beginPath(); ctx.arc(0, -r * 0.98, r * 0.15, 0, Math.PI * 2); fillStroke(ctx, '#ffd23a', 1.5);
      ctx.restore();
    },
  }, S.beastboy);

  // Retrato de personagem extra: usa o estilo do def (ex.: Cinderblock jogável = cinderP).
  const portrait0 = TT.portrait;
  TT.portrait = function (key, size) {
    const d = TT.TITANS[key];
    return portrait0(d && d.style ? d.style : key, size);
  };
  // Silhueta escura (personagem bloqueado), cacheada.
  const silCache = new Map();
  TT.silhouette = function (key, size) {
    const k = key + size;
    let c = silCache.get(k);
    if (c) return c;
    c = TT.makeCanvas(size, size);
    const g = c.getContext('2d');
    g.drawImage(TT.portrait(key, size), 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#0d0a1a'; g.fillRect(0, 0, size, size);
    silCache.set(k, c);
    return c;
  };

  // ================================================================ Utilidades dos golpes
  const Proj = TT.Projectile;
  const pw = (f) => f.def.pw || 1; // dano extra dos golpes novos (fase 7) e combos (fase 8)
  const handZ = (f, fb) => { const R = f.rigOut; return R && R.fy != null ? TT.clamp(f.y - f.z - R.fy, 25, 170) : fb; };
  const shot = (f, g, o) => g.addProjectile(new Proj(g, Object.assign({ team: 'hero', owner: f, x: f.x + f.facing * 46, y: f.y, z: f.z + handZ(f, 70) }, o)));
  const onScreen = (g, front, f) => g.enemies.filter((e) => !e.dead && Math.abs(e.x - g.camX - TT.W / 2) < TT.W / 2 + 30 && (!front || (e.x - f.x) * f.facing > -40));
  const hitOne = (g, f, e, d) => { if (e.takeHit(f, d, TT.sign(e.x - f.x) || f.facing)) g.onHit(f, e, d); };
  const word = (g, x, y, text, c1, c2, size) => g.particles.spawn('text', x, y, { text, size: size || 40, color: c1 || '#ffe14a', color2: c2 || '#ff4a3a', vy: -0.6, life: 38, rot: TT.rand(-0.2, 0.2) });
  const comboName = (f, g, text) => { g.comboTag = { text, col: f.def.color, fx: f.def.fx || f.def.color, t: 0 }; g.particles.spawn('ring', f.x, f.y - f.z - 80, { color: f.def.fx || f.def.color, size: 140, life: 18 }); };
  const burst = (g, x, y, col, n) => {
    for (let i = 0; i < (n || 8); i++) { const a = Math.random() * Math.PI * 2, sp = TT.rand(3, 9); g.particles.spawn('star', x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color: TT.choice([col, '#ffffff']), size: TT.rand(6, 11), life: TT.randi(12, 20), rot: Math.random(), vr: 0.2 }); }
    g.particles.spawn('glow', x, y, { color: col, size: 90, life: 10 });
  };
  const handBurst = (f, g, col, n) => { const R = f.rigOut; burst(g, R && R.fx != null ? R.fx + g.camX : f.x + f.facing * 60, R && R.fy != null ? R.fy : f.y - f.z - 90, col, n); };
  // Golpe corpo a corpo genérico (pose = pose de js/anim.js).
  const M = (pose, o) => Object.assign({ pose, s: 5, a: 4, r: 9, dmg: 7, reach: [0, 82], kb: 2, sound0: 'whoosh' }, o);

  // ---------------------------------------------------------------- Projéteis novos (desenho e rastro)
  const PDRAW = {}, PTRAIL = {};
  const projDraw = Proj.prototype.draw, projUpdate = Proj.prototype.update;
  Proj.prototype.draw = function (ctx, camX) { const d = PDRAW[this.kind]; if (d) d(this, ctx, this.x - camX, this.y - this.z); else projDraw.call(this, ctx, camX); };
  Proj.prototype.update = function () { projUpdate.call(this); const t = PTRAIL[this.kind]; if (t && !this.remove) t(this, this.game); };
  // Efeito ao acertar (d.onHitFx) — usado pelos golpes daqui: "AZAR!", lodo, pausa, coelho...
  const gOnHit = TT.Game.prototype.onHit;
  TT.Game.prototype.onHit = function (att, t, d) { gOnHit.call(this, att, t, d); if (d && d.onHitFx && t && !t.isProp) d.onHitFx(this, att, t, d); };

  PDRAW.hiveLaser = (p, ctx, x, y) => {
    p.drawTrail(ctx, p.game.camX, '#ffd23a', 6);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffb000'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x - p.vx * 2.4, y); ctx.lineTo(x, y); ctx.stroke();
    ctx.strokeStyle = '#fff6c0'; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
    TT.drawGlow(ctx, '#ffd23a', x, y, 22, 0.9);
  };
  const hexagon = (ctx, x, y, r) => { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); };
  PDRAW.grenade = (p, ctx, x, y) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(p.spin * 0.6);
    hexagon(ctx, 0, 0, 11); ctx.fillStyle = '#4a5160'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(-3, -14, 6, 5);
    ctx.restore();
    TT.drawGlow(ctx, (p.t >> 2) % 2 ? '#ff3a2a' : '#ffd23a', x, y - 10, 14, 1);
  };
  PDRAW.card = (p, ctx, x, y) => {
    p.drawTrail(ctx, p.game.camX, '#d9b3ff', 4);
    ctx.save(); ctx.translate(x, y); ctx.rotate(p.spin * 0.8);
    ctx.fillStyle = '#f6f2e6'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.fillRect(-11, -16, 22, 32); ctx.strokeRect(-11, -16, 22, 32);
    ctx.fillStyle = p.red ? '#d0202a' : '#1a1a22'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.red ? '♥' : '♠', 0, 1);
    ctx.restore();
  };
  PDRAW.gooBall = (p, ctx, x, y) => {
    p.drawTrail(ctx, p.game.camX, '#ff8fc8', p.r * 0.6);
    const sq = Math.sin(p.t * 0.5) * 0.12;
    ctx.beginPath(); ctx.ellipse(x, y, p.r * (1 + sq), p.r * (1 - sq), 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e8559a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,240,0.75)'; ctx.beginPath(); ctx.arc(x - p.r * 0.3, y - p.r * 0.35, p.r * 0.25, 0, Math.PI * 2); ctx.fill();
  };
  PTRAIL.gooBall = (p, g) => { if (p.t % 3 === 0) g.particles.spawn('dust', p.x, p.y - p.z, { color: 'rgba(232,85,154,0.7)', size: p.r * 0.6, life: 14, vy: 1 }); };
  PDRAW.hexwave = (p, ctx, x, y) => { // onda de azar da Jinx: arcos rosa correndo pelo chão
    const gy = p.y;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, gy); ctx.scale(p.facing, 1);
    for (let i = 0; i < 3; i++) {
      const k = i * 16, h = 46 + Math.sin(p.t * 0.6 + i) * 10 - i * 8;
      ctx.strokeStyle = i ? 'rgba(255,143,208,0.7)' : '#ff5fb4'; ctx.lineWidth = 9 - i * 2;
      ctx.beginPath(); ctx.moveTo(-k - 4, 4); ctx.quadraticCurveTo(-k + 18, -h, -k - 6, -h * 1.6); ctx.stroke();
    }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-4, 4); ctx.quadraticCurveTo(18, -46, -6, -74); ctx.stroke();
    ctx.restore();
    TT.drawGlow(ctx, '#ff5fb4', x, gy - 30, 46, 0.8);
  };
  PTRAIL.hexwave = (p, g) => {
    if (p.t % 2 === 0) g.particles.spawn('star', p.x - p.vx * 2, p.y - TT.rand(0, 60), { color: TT.choice(['#ff5fb4', '#ffb0dc', '#ffffff']), size: 7, life: 14, vy: -1, rot: Math.random(), vr: 0.2 });
    if (p.t % 4 === 0) g.particles.spawn('debris', p.x, p.y, { vy: -TT.rand(3, 6), vx: TT.rand(-1, 1), grav: 0.5, color: '#9a8f86', size: 6, life: 18, floor: p.y });
  };
  PDRAW.carrot = (p, ctx, x, y) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(p.spin * 0.5); const s = p.big ? 2 : 1; ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-16, -6); ctx.quadraticCurveTo(10, -6, 20, 0); ctx.quadraticCurveTo(10, 6, -16, 6); ctx.closePath();
    ctx.fillStyle = '#ff8a2a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#4fbf3a'; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-26, -8); ctx.lineTo(-22, 0); ctx.lineTo(-26, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  };
  PDRAW.minionFist = (p, ctx, x, y) => { // punho-foguete do robô do Slade
    p.drawTrail(ctx, p.game.camX, '#ff9a3a', 8);
    ctx.save(); ctx.translate(x, y); ctx.scale(p.facing, 1);
    TT.drawGlow(ctx, '#ff7a1a', -18, 0, 20, 1);
    ctx.beginPath(); ctx.rect(-14, -9, 24, 18); ctx.fillStyle = '#80868f'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#5c6169'; ctx.fillRect(6, -9, 6, 18);
    ctx.restore();
  };
  PTRAIL.minionFist = (p, g) => { if (p.t % 2 === 0) g.particles.spawn('dust', p.x - p.vx * 2, p.y - p.z, { color: 'rgba(200,200,210,0.7)', size: 8, life: 14 }); };
  PDRAW.zapBolt = (p, ctx, x, y) => { // raio do controle remoto do Control Freak
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#7bffea'; ctx.lineWidth = 6; ctx.beginPath();
    for (let i = 0; i < 6; i++) ctx.lineTo(x - p.facing * i * 9, y + (i % 2 ? -8 : 8) * Math.sin(p.t + i));
    ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    TT.drawGlow(ctx, '#7bffea', x, y, 26, 1);
  };

  // ---------------------------------------------------------------- Efeitos de área
  // Erupções em sequência no chão (pedras, gosma, fogo, azar, cartolas). Cada ponto marca o chão e,
  // no atraso dele, sobe e acerta quem estiver em cima.
  class Eruptions {
    constructor(game, owner, pts, o) {
      Object.assign(this, { game, owner, pts, o, t: -1, remove: false, y: owner.y + 2 }); // t = -1: o 1º passo é o quadro 0
      for (const p of pts) p.hits = new Set();
    }
    update() {
      const g = this.game, o = this.o;
      this.t++;
      for (const p of this.pts) {
        const k = this.t - p.d;
        if (k === 0) {
          for (const e of g.enemies) {
            if (e.dead || p.hits.has(e) || e.z > 90) continue;
            const dx = (e.x - p.x) / (o.rx || 70), dy = (e.y - p.y) / ((o.rx || 70) * 0.42);
            if (dx * dx + dy * dy > 1) continue;
            p.hits.add(e);
            const d = Object.assign({ dmg: o.dmg, kb: 5, knockdown: true, launch: o.launch || 11, big: true }, o.hit);
            hitOne(g, this.owner, e, d);
          }
          if (o.word && Math.random() < 0.6) word(g, p.x, p.y - 160, o.word, '#ffe14a', o.col, 34);
          if (o.kind === 'rock') { g.debrisBurst(p.x, p.y - 20, 5, '#8e8880'); g.dust(p.x, p.y, 4); }
          else if (o.kind === 'goo') for (let i = 0; i < 6; i++) g.particles.spawn('dust', p.x + TT.rand(-20, 20), p.y - TT.rand(40, 120), { vx: TT.rand(-3, 3), vy: TT.rand(-6, -2), color: 'rgba(232,85,154,0.85)', size: TT.rand(8, 14), life: 22, grav: 0.3 });
          else if (o.kind === 'hat') { g.poof(p.x, p.y - 40); burst(g, p.x, p.y - 60, '#c87bff', 10); }
          else burst(g, p.x, p.y - 60, o.col, 6);
          g.shake = Math.max(g.shake, 6);
          A().play(o.sound || 'hitHeavy');
        }
      }
      const last = this.pts.reduce((m, p) => Math.max(m, p.d), 0);
      if (this.t > last + 26) this.remove = true;
    }
    drawGround(ctx, camX) {
      const o = this.o;
      for (const p of this.pts) {
        const k = this.t - p.d;
        if (k > 6) continue;
        const a = k < 0 ? Math.min(1, (this.t + 1) / 6) : 1 - k / 6;
        ctx.save(); ctx.globalAlpha = 0.65 * a; ctx.fillStyle = o.col; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
        const R = (o.rx || 70) * (k < 0 ? 0.6 + 0.4 * Math.min(1, this.t / Math.max(1, p.d)) : 1);
        ctx.beginPath(); ctx.ellipse(p.x - camX, p.y, R, R * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = a; ctx.stroke();
        ctx.restore();
      }
    }
    draw(ctx, camX) {
      const o = this.o;
      for (const p of this.pts) {
        const k = this.t - p.d;
        if (k < 0 || k > 24) continue;
        const up = k < 5 ? TT.easeOut(k / 5) : 1 - TT.clamp((k - 14) / 10, 0, 1), x = p.x - camX, y = p.y;
        if (up <= 0) continue;
        const H = (o.h || 130) * up;
        if (o.kind === 'rock') {
          for (const [dx, w, hk] of [[-22, 16, 0.7], [0, 22, 1], [20, 15, 0.8]]) {
            ctx.beginPath(); ctx.moveTo(x + dx - w, y); ctx.lineTo(x + dx + 3, y - H * hk); ctx.lineTo(x + dx + w, y); ctx.closePath();
            ctx.fillStyle = '#8e8880'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.moveTo(x + dx - w * 0.4, y); ctx.lineTo(x + dx + 3, y - H * hk); ctx.lineTo(x + dx, y); ctx.closePath(); ctx.fill();
          }
        } else if (o.kind === 'goo') {
          ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.quadraticCurveTo(x - 20, y - H * 0.6, x - 26, y - H); ctx.quadraticCurveTo(x, y - H - 30, x + 26, y - H);
          ctx.quadraticCurveTo(x + 20, y - H * 0.6, x + 30, y); ctx.closePath();
          ctx.fillStyle = '#e8559a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
          ctx.fillStyle = 'rgba(255,200,230,0.6)'; ctx.beginPath(); ctx.ellipse(x - 8, y - H * 0.7, 6, H * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        } else if (o.kind === 'fire') {
          TT.drawFlame(ctx, x, y, H * 1.1, this.t + p.x, p.x * 0.1);
        } else if (o.kind === 'hat') {
          const fall = k < 6 ? 1 - TT.easeOut(k / 6) : 0;
          TT.drawTopHat(ctx, x, y - fall * 300, 1.5, false);
          if (k > 6 && k < 16) TT.drawText(ctx, 'TA-DÁ!', x, y - 130 - (k - 6) * 2, 34, '#ffe14a', OUT, 'center', 6);
        } else { // coluna de energia (azar da Jinx)
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const gr = ctx.createLinearGradient(0, y - H * 1.6, 0, y);
          gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, o.col);
          ctx.fillStyle = gr; ctx.fillRect(x - 26 * up, y - H * 1.6, 52 * up, H * 1.6);
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x - 6 * up, y - H * 1.6, 12 * up, H * 1.6);
          ctx.restore();
        }
      }
    }
  }
  TT.Eruptions = Eruptions;
  const erupt = (g, f, pts, o) => g.addEffect(new Eruptions(g, f, pts, o));
  // Pontos em linha à frente do lutador.
  const lineAhead = (f, n, step, d0, delay) => Array.from({ length: n }, (_, i) => ({ x: f.x + f.facing * (d0 + i * step), y: f.y + (i % 2 ? 10 : -10), d: i * delay }));
  // Um ponto embaixo de cada inimigo da tela (ou à frente, se não houver ninguém).
  const underEnemies = (g, f, front, delay) => {
    const es = onScreen(g, front, f).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x)).slice(0, 8);
    if (!es.length) return lineAhead(f, 3, 140, 140, delay);
    return es.map((e, i) => ({ x: e.x, y: e.y, d: 4 + i * delay }));
  };

  // Corredores que atravessam a tela e acertam quem estiver no caminho (robôs do Slade, coelhos mágicos).
  class Stampede {
    constructor(game, owner, o) {
      Object.assign(this, { game, owner, o, t: 0, remove: false, y: owner.y, hits: new Set() });
      const dir = owner.facing;
      this.run = Array.from({ length: o.n }, (_, i) => ({
        x: owner.x - dir * (120 + i * 70), y: TT.clamp(owner.y + ((i % 3) - 1) * 34, TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM), vx: dir * (o.speed + i * 0.6), ph: i * 1.7,
      }));
      this.dir = dir;
    }
    update() {
      const g = this.game;
      this.t++;
      for (const r of this.run) {
        r.x += r.vx;
        if (this.t % 4 === 0) g.dust(r.x - this.dir * 20, r.y, 1);
        for (const e of g.enemies) {
          if (e.dead || this.hits.has(e) || e.z > 80) continue;
          if (Math.abs(e.x - r.x) < 50 && Math.abs(e.y - r.y) < 40) {
            this.hits.add(e);
            hitOne(g, this.owner, e, Object.assign({ dmg: this.o.dmg, kb: 9, knockdown: true, launch: 9, big: true }, this.o.hit));
            if (this.o.word) word(g, e.x, e.y - 150, this.o.word, '#ffe14a', this.owner.def.color, 34);
          }
        }
      }
      if (this.t > this.o.life) this.remove = true;
    }
    draw(ctx, camX) {
      const fade = TT.clamp((this.o.life - this.t) / 10, 0, 1);
      ctx.save(); ctx.globalAlpha = fade;
      for (const r of this.run) {
        const x = r.x - camX, hop = Math.abs(Math.sin(this.t * 0.35 + r.ph));
        if (this.o.kind === 'bunny') TT.drawRabbit(ctx, x, r.y - hop * 26, this.dir, this.t * 3 + r.ph * 10, 0.62, {});
        else {
          const fake = this.fake || (this.fake = { anim: 'walk', animT: 0, vx: 8, z: 0, atk: null, pose: TT.newPose() });
          fake.animT = this.t * 1.6 + r.ph * 10;
          TT.computePose(fake, fake.pose);
          fake.pose.lean = 0.45;
          TT.drawGlow(ctx, '#ff7a1a', x, r.y - 70, 60, 0.4);
          TT.drawRig(ctx, S.slade, fake.pose, x, r.y, this.dir, { t: fake.animT });
        }
      }
      ctx.restore();
    }
  }
  TT.Stampede = Stampede;

  // Onda de lodo do Plasmus: parede de gosma que avança pelo chão.
  class GooWave {
    constructor(game, owner, o) { Object.assign(this, { game, owner, o, t: 0, remove: false, x: owner.x + owner.facing * 60, y: owner.y, dir: owner.facing, hits: new Set() }); }
    update() {
      const g = this.game;
      this.t++; this.x += this.dir * 10;
      for (const e of g.enemies) {
        if (e.dead || this.hits.has(e) || e.z > 100) continue;
        if (Math.abs(e.x - this.x) < 50 && Math.abs(e.y - this.y) < 70) { this.hits.add(e); hitOne(g, this.owner, e, { dmg: this.o.dmg, kb: 12, knockdown: true, launch: 10, big: true }); }
      }
      if (this.t % 2 === 0) g.particles.spawn('dust', this.x + TT.rand(-30, 30), this.y - TT.rand(60, 150), { vx: this.dir * TT.rand(1, 4), vy: TT.rand(-4, -1), color: 'rgba(232,85,154,0.85)', size: TT.rand(8, 14), life: 20, grav: 0.3 });
      if (this.t > 60) this.remove = true;
    }
    drawGround(ctx, camX) {
      ctx.save(); ctx.globalAlpha = 0.55 * TT.clamp((60 - this.t) / 10, 0, 1); ctx.fillStyle = '#b8306e';
      const x0 = this.owner.x - camX, x1 = this.x - camX;
      ctx.fillRect(Math.min(x0, x1), this.y - 16, Math.abs(x1 - x0), 32); ctx.restore();
    }
    draw(ctx, camX) {
      const x = this.x - camX, y = this.y, a = TT.clamp((60 - this.t) / 10, 0, 1), H = 150 + Math.sin(this.t * 0.4) * 10;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(this.dir, 1);
      ctx.beginPath(); ctx.moveTo(-90, 6); ctx.quadraticCurveTo(-60, -H * 0.5, -10, -H); ctx.quadraticCurveTo(40, -H - 10, 50, -H * 0.7);
      ctx.quadraticCurveTo(20, -H * 0.75, 30, -H * 0.4); ctx.quadraticCurveTo(46, -H * 0.15, 40, 6); ctx.closePath();
      ctx.fillStyle = '#e8559a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = 'rgba(255,200,230,0.55)'; ctx.beginPath(); ctx.ellipse(-20, -H * 0.6, 10, H * 0.22, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe14a'; for (const [ex, ey] of [[0, -H * 0.72], [18, -H * 0.7]]) { ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.restore();
    }
  }

  // Raio de energia saindo da mão (laser do Gizmo, ZAP do Control Freak, rajada do Soldado H.I.V.E.).
  function handBeam(col, w, zig) {
    return function (ctx, f, sx, sy, a) {
      const d = a.def, k = a.t - d.s;
      if (k < 0 || k >= d.a) return;
      const R = f.rigOut, ox = (R.fx != null ? R.fx : sx + f.facing * 50) + f.facing * 10, oy = R.fy != null ? R.fy : sy - 80;
      const L = d.reach[1] * Math.min(1, (k + 1) / 3), fade = TT.clamp((d.a - k) / 5, 0, 1), ww = w * fade * (0.85 + Math.sin(k * 0.9) * 0.15);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      if (zig) {
        for (const [c, lw] of [[col, ww], ['#ffffff', ww * 0.3]]) {
          ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(ox, oy);
          for (let i = 1; i <= 10; i++) ctx.lineTo(ox + f.facing * L * i / 10, oy + (i < 10 ? Math.sin(k * 2.1 + i * 2.3) * 16 : 0));
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = col; ctx.lineWidth = ww; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + f.facing * L, oy); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = ww * 0.35; ctx.stroke();
      }
      ctx.restore();
      TT.drawGlow(ctx, col, ox, oy, ww * 2.4 + 10, 1);
      TT.drawGlow(ctx, col, ox + f.facing * L, oy, ww * 2.2 + 10, 0.9);
    };
  }

  // Feitiço "MUMBO JUMBO!": o inimigo vira coelho por um tempo (pula sem atacar e leva mais dano).
  function bunnyThink() {
    const e = this, g = e.game;
    if (--e.hexBunny <= 0 || e.dead) { unbunny(e); return; }
    if (e.commonStates()) return;
    e.setState('idle');
    if (e.z <= 0 && e.st % 26 === 0) { e.vz = 7; e.z = 1; e.vx = TT.rand(-2.5, 2.5); e.vy = TT.rand(-1.2, 1.2); e.facing = e.vx > 0 ? 1 : -1; }
    if (e.z <= 0) { e.vx *= 0.8; e.vy *= 0.8; }
    e.x = TT.clamp(e.x, g.camX + 40, g.camX + TT.W - 40);
  }
  function bunnyDraw(ctx, camX) {
    const fl = this.flash > 3, sq = this.state === 'down' ? -0.35 : this.state === 'hurt' ? -0.15 : 0;
    TT.drawRabbit(ctx, this.x - camX, this.y - this.z, this.facing, this.animT, 0.6, { flash: fl, red: true, sq });
  }
  function unbunny(e) {
    e.hexBunny = 0; delete e.think; delete e.draw; delete e.dmgTaken;
    if (!e.dead) { e.game.poof(e.x, e.y - 50); e.setState('idle'); e.setAnim('idle'); }
  }
  function bunnify(g, e, frames) {
    if (e.isBoss || e.dead) return false;
    e.releaseToken && e.releaseToken();
    e.atk = null; e.hexBunny = frames; e.think = bunnyThink; e.draw = bunnyDraw; e.dmgTaken = 1.5;
    if (e.state === 'attack') { e.setState('idle'); e.setAnim('idle'); }
    g.poof(e.x, e.y - 50);
    g.particles.spawn('text', e.x, e.y - 160, { text: 'VIROU COELHO!', size: 28, color: '#ffffff', color2: '#c04ab0', vy: -0.5, life: 46, rot: TT.rand(-0.1, 0.1) });
    return true;
  }
  // Botão de PAUSA do Control Freak usado nos inimigos: ficam congelados como numa fita pausada.
  function pauseEnemy(g, e, frames) {
    if (e.isBoss || e.dead || e.state !== 'hurt') return;
    e.frozen = frames; e.frozenKind = 'pause'; e.hitstun = Math.max(e.hitstun || 0, frames); e.vx = 0;
    g.particles.spawn('text', e.x, e.y - e.z - 170, { text: 'PAUSADO!', size: 28, color: '#ffe14a', color2: '#1c1a22', vy: -0.5, life: 40, rot: TT.rand(-0.1, 0.1) });
  }

  // ================================================================ Golpes de cada personagem
  // base: golpes originais (combo de 3). mid: 3º e 4º golpes do combo de 5 (fase 8). ender: COMBO FINAL.
  // Os golpes novos (fase 7) dão mais dano (boost) — inclusive projéteis e efeitos, via pw().
  const DEFS = {};

  // ---- Soldado H.I.V.E.: blaster, coronhada e granada
  DEFS.hivesoldier = {
    name: 'Soldado H.I.V.E.', style: 'hive', hp: 105, speed: 4.6, jump: 15, color: '#f0c62e', fx: '#ffd23a',
    blurb: 'Soldado da academia do crime: blaster de laser, coronhadas e granada.',
    dashAtk: M('flyKick', { s: 3, a: 12, r: 12, dmg: 11, reach: [0, 80], lunge: 11, knockdown: true, launch: 6, kb: 8, big: true }),
    light: [
      M('jab', { dmg: 6, reach: [0, 70] }),
      M('cross', { dmg: 7, reach: [0, 74] }),
      M('swing', { s: 8, r: 14, dmg: 13, reach: [0, 96], kb: 7, knockdown: true, launch: 7, big: true,
        onFrame(f, t, g) { if (t === this.s) handBurst(f, g, '#ffd23a', 6); } }),
    ],
    heavy: M('beam', { s: 10, a: 12, r: 14, dmg: 0, name: 'Rajada de blaster',
      onFrame(f, t, g) {
        if (t >= this.s && t < this.s + 12 && (t - this.s) % 4 === 0) {
          shot(f, g, { kind: 'hiveLaser', vx: f.facing * 17, vy: TT.rand(-0.4, 0.4), r: 12, dmg: 6 * pw(f), kb: 3, life: 60, trailN: 6 });
          A().play('laser'); handBurst(f, g, '#ffd23a', 3);
        }
      } }),
    air: M('dive', { s: 3, a: 14, r: 6, dmg: 9, reach: [-10, 64], kb: 3, lunge: 5, zr: 130 }),
    special: { cost: 30, pose: 'throw', s: 14, a: 1, r: 16, shout: 'Granada H.I.V.E.!', shoutColor: '#ffd23a',
      onFrame(f, t, g) {
        if (t !== this.s) return;
        const T = 30;
        shot(f, g, { kind: 'grenade', vx: f.facing * 6, vz: 0.5 * 0.7 * T, grav: 0.7, r: 14, dmg: 0, blastDmg: 26 * pw(f), explodeOnGround: 170, impactWord: 'KABOOM!', life: 120 });
        A().play('whoosh');
      } },
    mid: [
      M('uppercut', { s: 5, dmg: 8, reach: [0, 76], kb: 2 }),
      M('kick', { s: 6, dmg: 9, reach: [0, 88], kb: 3 }),
    ],
    ender: { pose: 'beam', s: 8, a: 30, r: 18, name: 'ESQUADRÃO H.I.V.E.',
      onFrame(f, t, g) {
        if (t === 1) { comboName(f, g, 'ESQUADRÃO H.I.V.E.'); g.tintScreen('#ffd23a', 10); }
        if (t >= this.s && t < this.s + 24 && (t - this.s) % 3 === 0) {
          const i = (t - this.s) / 3;
          shot(f, g, { kind: 'hiveLaser', vx: f.facing * 18, vy: (i % 3 - 1) * 1.1, r: 13, dmg: 7 * pw(f), kb: 4, life: 60, trailN: 6, pierce: true });
          A().play('laser');
        }
        if (t === this.s + 26) {
          const x = f.x + f.facing * 260;
          g.blast(x, f.y, 200, 24 * pw(f), 'hero', f, '#ffd23a');
          for (let i = 0; i < 6; i++) g.particles.spawn('ring', x + TT.rand(-80, 80), f.y - TT.rand(20, 120), { color: '#ffd23a', size: 50, life: 16 });
          word(g, x, f.y - 200, 'H.I.V.E.!', '#ffd23a', '#2b2f38', 54);
        }
      } },
  };

  // ---- Robô do Slade: socos de metal, punho-foguete, autodestruição
  DEFS.minion = {
    name: 'Robô do Slade', style: 'slade', hp: 110, speed: 4.6, jump: 15, color: '#ff7a1a', fx: '#ff9a3a',
    blurb: 'Robô de combate do Slade: punhos de metal, punho-foguete e autodestruição.',
    dashAtk: M('jab', { s: 3, a: 12, r: 12, dmg: 12, reach: [0, 82], lunge: 12, knockdown: true, launch: 6, kb: 9, big: true }),
    light: [
      M('jab', { dmg: 7, reach: [0, 74] }),
      M('cross', { dmg: 7, reach: [0, 78] }),
      M('slam', { s: 9, r: 14, dmg: 13, reach: [0, 100], kb: 7, knockdown: true, launch: 7, big: true,
        onFrame(f, t, g) { if (t === this.s) { g.groundRing(f.x + f.facing * 70, f.y, '#ff9a3a'); g.shake = Math.max(g.shake, 6); } } }),
    ],
    heavy: M('jab', { s: 12, a: 1, r: 16, dmg: 0,
      onFrame(f, t, g) {
        if (t < this.s && t % 2 === 0) handBurst(f, g, '#ff7a1a', 1);
        if (t === this.s) { shot(f, g, { kind: 'minionFist', vx: f.facing * 15, r: 18, dmg: 16 * pw(f), kb: 10, knockdown: true, launch: 7, big: true, life: 50, trailN: 8, pierce: true }); A().play('whoosh'); }
      } }),
    air: M('dive', { s: 3, a: 14, r: 6, dmg: 10, reach: [-10, 66], kb: 3, lunge: 5, zr: 130 }),
    special: { cost: 35, pose: 'castUp', s: 34, a: 1, r: 22, shout: 'AUTODESTRUIÇÃO!', shoutColor: '#ff5a3a',
      onFrame(f, t, g) {
        if (t < this.s) { f.flash = (t >> 2) % 2 ? 5 : 0; if (t % 6 === 0) A().play('alarm'); }
        if (t === this.s) { g.blast(f.x, f.y, 240, 30 * pw(f), 'hero', f, '#ff7a1a'); g.whiteFlash = 8; word(g, f.x, f.y - 230, 'KABOOM!', '#ffe14a', '#ff4a1a', 64); g.debrisBurst(f.x, f.y - 60, 10, '#5c6169'); f.invul = 20; }
      } },
    mid: [
      M('uppercut', { s: 5, dmg: 8, reach: [0, 76] }),
      M('swipe', { s: 6, dmg: 9, reach: [0, 92], kb: 3 }),
    ],
    ender: { pose: 'castUp', s: 10, a: 1, r: 40, name: 'LEGIÃO DE ROBÔS',
      onFrame(f, t, g) {
        if (t === 1) { comboName(f, g, 'LEGIÃO DE ROBÔS'); A().play('alarm'); }
        if (t === this.s) { g.addEffect(new Stampede(g, f, { n: 6, speed: 15, dmg: 14 * pw(f), life: 80, kind: 'robot', word: 'CLANG!' })); g.tintScreen('#ff7a1a', 12); A().play('super'); }
      } },
  };

  // ---- Cinderblock: o brutamontes de pedra
  DEFS.cinderblock = {
    name: 'Cinderblock', style: 'cinderP', hp: 190, speed: 3.5, jump: 12.5, color: '#9b958d', fx: '#ffb35a',
    blurb: 'Gigante de pedra: socos enormes, pisão sísmico, pedras arremessadas e terremoto.',
    dashAtk: M('jab', { s: 4, a: 14, r: 14, dmg: 15, reach: [0, 110], depth: 46, lunge: 12, knockdown: true, launch: 7, kb: 12, big: true,
      onFrame(f, t, g) { if (t % 3 === 0 && t > this.s) g.dust(f.x - f.facing * 40, f.y, 2); } }),
    light: [
      M('jab', { s: 6, dmg: 9, reach: [0, 110], depth: 40, kb: 3 }),
      M('cross', { s: 6, dmg: 10, reach: [0, 114], depth: 40, kb: 3 }),
      M('bigSwing', { s: 11, a: 5, r: 18, dmg: 17, reach: [0, 150], depth: 50, kb: 11, knockdown: true, launch: 8, big: true,
        onFrame(f, t, g) { if (t === this.s) g.shake = Math.max(g.shake, 9); } }),
    ],
    heavy: M('bigSlam', { s: 16, a: 3, r: 20, dmg: 18, reach: [0, 150], depth: 55, kb: 8, knockdown: true, launch: 8, big: true, name: 'Pisão sísmico',
      onFrame(f, t, g) {
        if (t === this.s) {
          const s = new TT.Shockwave(g, f.x + f.facing * 80, f.y, 300, 14 * pw(f), 'hero'); g.addEffect(s);
          g.impact(f.x + f.facing * 90, f.y, 'BOOM!', '#ffb35a', 0.9); g.debrisBurst(f.x + f.facing * 90, f.y - 10, 8, '#8e8880'); A().play('shockwave');
        }
      } }),
    air: M('dive', { s: 3, a: 16, r: 10, dmg: 13, reach: [-30, 80], depth: 46, kb: 5, knockdown: true, launch: 6, zr: 140, big: true }),
    special: { cost: 35, pose: 'bigThrow', s: 22, a: 1, r: 20, shout: 'GRRAAAH!', shoutColor: '#ffb35a',
      onFrame(f, t, g) {
        if (t === 4) g.debrisBurst(f.x + f.facing * 20, f.y - 10, 6, '#8e8880');
        if (t !== this.s) return;
        shot(f, g, { kind: 'boulder', x: f.x + f.facing * 50, z: f.z + 95, vx: f.facing * 12, vz: 1, grav: 0.12, r: 42, dmg: 24 * pw(f), kb: 12, knockdown: true, launch: 9, big: true, pierce: true, life: 80, minZ: 40, blastR: 140, blastDmg: 16 * pw(f), blastEnd: true, blastColor: '#ffb35a' });
        A().play('whoosh');
      } },
    mid: [
      M('uppercut', { s: 7, dmg: 11, reach: [0, 110], depth: 40, kb: 2 }),
      M('swipe', { s: 7, dmg: 11, reach: [0, 130], depth: 44, kb: 3 }),
    ],
    ender: { pose: 'bigSlam', s: 14, a: 1, r: 36, name: 'TERREMOTO',
      onFrame(f, t, g) {
        if (t === 1) { comboName(f, g, 'TERREMOTO'); A().play('roar'); }
        if (t === this.s) {
          g.impact(f.x + f.facing * 70, f.y, 'KRAKOOM!', '#ffb35a', 1.3); g.tintScreen('#ff9a3a', 10);
          erupt(g, f, lineAhead(f, 7, 95, 100, 4), { kind: 'rock', col: 'rgba(180,140,100,0.8)', dmg: 16 * pw(f), rx: 80, h: 150, sound: 'break' });
        }
      } },
  };

  // ---- Gizmo: o gênio da H.I.V.E. com a mochila de patas mecânicas
  DEFS.gizmo = {
    name: 'Gizmo', style: 'gizmo', hp: 95, speed: 4.9, jump: 16, color: '#3c8f3a', fx: '#7dff6a',
    blurb: 'Gênio da H.I.V.E.: patas de aranha mecânicas, laser e chuva de mísseis.',
    dashFx(f, g, t) { g.particles.spawn('glow', f.x - f.facing * 20, f.y - f.z - 40, { color: '#7dff6a', size: 26, life: 8, vy: 1 }); },
    dashAtk: M('flyKick', { weapon: 'legs', s: 3, a: 12, r: 12, dmg: 11, reach: [0, 90], lunge: 11, knockdown: true, launch: 6, kb: 8, big: true }),
    light: [
      M('jab', { weapon: 'legs', dmg: 6, reach: [0, 92], onFrame(f, t, g) { if (t === this.s) handBurst(f, g, '#7dff6a', 3); } }),
      M('cross', { weapon: 'legs', dmg: 7, reach: [0, 96] }),
      M('slam', { weapon: 'legs', s: 9, r: 14, dmg: 13, reach: [0, 120], kb: 7, knockdown: true, launch: 8, big: true,
        onFrame(f, t, g) { if (t === this.s) { g.debrisBurst(f.x + f.facing * 90, f.y - 6, 4, '#7c8798'); g.shake = Math.max(g.shake, 5); } } }),
    ],
    heavy: M('beam', { s: 12, a: 22, r: 14, dmg: 4, rehit: 5, reach: [20, 560], depth: 30, kb: 2, sound: 'laser', name: 'Laser',
      drawFx: handBeam('#ff3030', 16, false) }),
    air: M('kick', { weapon: 'legs', s: 3, a: 12, r: 8, dmg: 9, reach: [0, 84], kb: 3, zr: 130 }),
    special: { cost: 35, pose: 'castUp', weapon: 'legs', s: 14, a: 12, r: 16, shout: 'Chuva de mísseis, seus manés!', shoutColor: '#7dff6a',
      onFrame(f, t, g) {
        if (t >= this.s && t < this.s + 12 && (t - this.s) % 2 === 0) {
          const i = (t - this.s) / 2;
          shot(f, g, { kind: 'heroMissile', x: f.x - f.facing * 10, z: f.z + 120, vx: f.facing * (4 + i), vz: 6 - (i % 3), grav: 0.3, vy: ((i % 3) - 1) * 1.2,
            r: 16, dmg: 7 * pw(f), kb: 4, blastR: 80, blastDmg: 8 * pw(f), blastEnd: true, homing: true, minZ: 40, life: 80, trailN: 8 });
          A().play('whoosh');
        }
      } },
    mid: [
      M('uppercut', { weapon: 'legs', s: 5, a: 6, dmg: 4, rehit: 2, reach: [0, 96], kb: 1 }),
      M('jab', { weapon: 'legs', s: 5, a: 8, dmg: 4, rehit: 3, reach: [0, 104], kb: 1, onFrame(f, t, g) { if (t >= this.s && t % 2 === 0) handBurst(f, g, '#7dff6a', 2); } }),
    ],
    ender: { pose: 'castUp', weapon: 'legs', s: 12, a: 24, r: 20, dmg: 5, rehit: 3, reach: [0, 140], depth: 44, kb: 2, name: 'MEGA-ARANHA',
      onFrame(f, t, g) {
        if (t === 1) { comboName(f, g, 'MEGA-ARANHA'); A().play('drill'); }
        if (t >= this.s && t < this.s + this.a && t % 3 === 0) { handBurst(f, g, '#7dff6a', 3); g.afterimage(f, '#7dff6a'); }
        if (t === this.s + this.a) {
          for (let i = 0; i < 5; i++) shot(f, g, { kind: 'heroMissile', x: f.x, z: f.z + 140, vx: f.facing * (3 + i), vz: 7, grav: 0.3, vy: (i - 2) * 0.9, r: 16, dmg: 8 * pw(f), kb: 4, blastR: 90, blastDmg: 10 * pw(f), blastEnd: true, homing: true, minZ: 40, life: 80, trailN: 8 });
          g.tintScreen('#3c8f3a', 10); A().play('super');
        }
      } },
  };

  // ---- Plasmus: o monstro de lodo
  DEFS.plasmus = {
    name: 'Plasmus', style: 'plasmus', hp: 175, speed: 3.7, jump: 13, color: '#e8559a', fx: '#ff8fc8',
    blurb: 'Monstro de lodo: braços que esticam, onda de lodo e gêiseres de gosma.',
    drawDash(ctx, f, sx, sy, fl) { // vira uma poça e desliza
      ctx.beginPath(); ctx.ellipse(sx, sy - 8, 70, 18, 0, 0, Math.PI * 2); ctx.fillStyle = fl ? '#fff' : '#e8559a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(sx + f.facing * 30, sy - 16, 5, 0, Math.PI * 2); ctx.arc(sx + f.facing * 44, sy - 16, 5, 0, Math.PI * 2); ctx.fill();
    },
    dashFx(f, g, t) { if (t % 2 === 0) g.particles.spawn('dust', f.x - f.facing * 50, f.y - 6, { color: 'rgba(232,85,154,0.7)', size: 10, life: 18 }); },
    dashAtk: M('uppercut', { s: 5, a: 10, r: 14, dmg: 13, reach: [0, 110], depth: 44, lunge: 9, knockdown: true, launch: 12, kb: 6, big: true,
      onFrame(f, t, g) { if (t === this.s) erupt(g, f, [{ x: f.x + f.facing * 60, y: f.y, d: 0 }], { kind: 'goo', col: 'rgba(232,85,154,0.7)', dmg: 0, rx: 60, h: 110 }); } }),
    light: [
      M('jab', { s: 6, dmg: 8, reach: [0, 130], depth: 38, kb: 2, drawFx: stretchArm }),
      M('cross', { s: 6, dmg: 9, reach: [0, 136], depth: 38, kb: 3, drawFx: stretchArm }),
      M('slam', { s: 10, a: 5, r: 16, dmg: 15, reach: [0, 140], depth: 50, kb: 8, knockdown: true, launch: 8, big: true,
        onFrame(f, t, g) { if (t === this.s) { g.groundRing(f.x + f.facing * 90, f.y, '#ff8fc8'); g.shake = Math.max(g.shake, 8); A().play('hitHeavy'); } } }),
    ],
    heavy: M('jab', { s: 16, a: 6, r: 18, dmg: 18, reach: [0, 330], depth: 40, kb: 12, knockdown: true, launch: 7, big: true, name: 'Soco esticado', drawFx: stretchArm,
      onFrame(f, t, g) { if (t === this.s) { A().play('whoosh'); g.particles.spawn('text', f.x + f.facing * 300, f.y - 150, { text: 'SPLAT!', size: 38, color: '#ffb0dc', color2: '#a0285a', vy: -0.6, life: 30 }); } } }),
    air: M('dive', { s: 3, a: 16, r: 8, dmg: 12, reach: [-20, 80], depth: 46, kb: 4, zr: 140, big: true }),
    special: { cost: 35, pose: 'bigSlam', s: 16, a: 1, r: 24, shout: 'GLUB GLUB!', shoutColor: '#ff8fc8',
      onFrame(f, t, g) { if (t === this.s) { g.addEffect(new GooWave(g, f, { dmg: 22 * pw(f) })); g.shake = 10; A().play('shockwave'); } } },
    mid: [
      M('swipe', { s: 6, dmg: 9, reach: [0, 130], depth: 44, kb: 2 }),
      M('uppercut', { s: 6, dmg: 10, reach: [0, 120], depth: 40, kb: 2 }),
    ],
    ender: { pose: 'bigSlam', s: 14, a: 1, r: 40, name: 'MAR DE LODO',
      onFrame(f, t, g) {
        if (t === 1) { comboName(f, g, 'MAR DE LODO'); A().play('roar'); }
        if (t === this.s) {
          g.tintScreen('#e8559a', 12); g.shake = 14;
          erupt(g, f, underEnemies(g, f, false, 5), { kind: 'goo', col: 'rgba(232,85,154,0.75)', dmg: 22 * pw(f), rx: 80, h: 170, word: 'SPLOOSH!', launch: 13 });
        }
      } },
  };
  // Braço de lodo esticado até onde o golpe alcança.
  function stretchArm(ctx, f, sx, sy, a) {
    const d = a.def, k = a.t - d.s;
    if (k < -2 || k > d.a + 2) return;
    const R = f.rigOut, ox = R.fx != null ? R.fx : sx + f.facing * 40, oy = R.fy != null ? R.fy : sy - 90;
    const L = Math.max(0, d.reach[1] - 70) * (k < 0 ? 0.3 : Math.min(1, (k + 1) / 2)) * (k > d.a ? 0.5 : 1), x1 = ox + f.facing * L;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = OUT; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(x1, oy); ctx.stroke();
    ctx.strokeStyle = f.style.arm; ctx.lineWidth = 16; ctx.stroke();
    ctx.beginPath(); ctx.arc(x1, oy, 15, 0, Math.PI * 2); ctx.fillStyle = f.style.arm; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }

  // ---- Plasmus Mirim: bolinha de gosma saltitante
  DEFS.plasmuskid = {
    name: 'Plasmus Mirim', style: 'plasmuskid', hp: 100, speed: 5.0, jump: 17.5, color: '#ff7ab8', fx: '#ffb0dc',
    blurb: 'Pequeno e saltitante: cuspe de gosma, bolas quicando e a bolha gigante.',
    drawDash(ctx, f, sx, sy, fl) { // rola como uma bola de gosma
      const r = 28; ctx.save(); ctx.translate(sx, sy - r); ctx.rotate(f.st * 0.5 * f.facing);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = fl ? '#fff' : '#ff7ab8'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(10, -6, 5, 0, Math.PI * 2); ctx.arc(-2, -8, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    },
    dashAtk: M('spin', { s: 3, a: 14, r: 12, dmg: 11, reach: [-30, 80], depth: 40, lunge: 11, knockdown: true, launch: 7, kb: 8, big: true }),
    light: [
      M('jab', { dmg: 6, reach: [0, 70] }),
      M('kick', { dmg: 7, reach: [0, 80] }),
      M('spin', { s: 8, a: 8, r: 12, dmg: 6, rehit: 4, reach: [-50, 96], depth: 40, kb: 6, knockdown: true, launch: 7, big: true }),
    ],
    heavy: M('throw', { s: 10, a: 1, r: 14, dmg: 0, name: 'Cuspe de gosma',
      onFrame(f, t, g) {
        if (t !== this.s) return;
        for (const [vx, vy] of [[8, -1.2], [10, 0], [8, 1.2]]) shot(f, g, { kind: 'gooBall', vx: f.facing * vx, vy, vz: 8, grav: 0.55, r: 14, dmg: 8 * pw(f), kb: 4, knockdown: true, launch: 5, life: 80, explodeOnGround: 70, blastDmg: 8 * pw(f), trailN: 5 });
        A().play('jump');
      } }),
    air: M('dive', { s: 3, a: 14, r: 6, dmg: 9, reach: [-10, 70], kb: 3, zr: 130,
      onFrame(f, t, g, a) { if (a.landed && !a.bounced) { a.bounced = true; f.vz = 9; g.particles.spawn('text', f.x, f.y - 120, { text: 'BOING!', size: 30, color: '#ffe14a', color2: '#c84d8a', vy: -0.6, life: 24 }); } } }),
    special: { cost: 30, pose: 'castUp', s: 14, a: 1, r: 18, shout: 'Chuva de gosma!', shoutColor: '#ffb0dc',
      onFrame(f, t, g) {
        if (t !== this.s) return;
        const pts = underEnemies(g, f, false, 0);
        pts.forEach((p, i) => {
          const T = 26 + i * 5, z0 = 560;
          shot(f, g, { kind: 'gooBall', x: p.x, y: p.y, z: z0, vx: 0, vy: 0, vz: (0.5 * 0.6 * T * T - z0) / T, grav: 0.6, r: 22, dmg: 0, blastDmg: 16 * pw(f), explodeOnGround: 90, life: 140, trailN: 6, impactWord: 'SPLAT!' });
        });
        A().play('jump');
      } },
    mid: [
      M('uppercut', { s: 5, dmg: 7, reach: [0, 74] }),
      M('claw', { s: 6, dmg: 8, reach: [0, 86], kb: 2 }),
    ],
    ender: { pose: 'castUp', s: 22, a: 1, r: 26, name: 'BOLHA GIGANTE',
      onFrame(f, t, g) {
        if (t === 1) { comboName(f, g, 'BOLHA GIGANTE'); A().play('jump'); }
        if (t < this.s && t % 3 === 0) g.particles.spawn('ring', f.x, f.y - 60, { color: '#ffb0dc', size: 40 + t * 4, life: 8 });
        if (t === this.s) {
          g.addEffect(new TT.Nova(g, f, { x: f.x, y: f.y, r: 260, dmg: 18 * pw(f), col: '#ff7ab8', word: 'BLOOP!' }));
          for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; shot(f, g, { kind: 'gooBall', x: f.x, z: 80, vx: Math.cos(a) * 9, vy: Math.sin(a) * 4, vz: 6, grav: 0.5, r: 14, dmg: 8 * pw(f), kb: 5, knockdown: true, life: 60, explodeOnGround: 60, blastDmg: 8 * pw(f), trailN: 4 }); }
          g.tintScreen('#ff7ab8', 10);
        }
      } },
  };

  // ---- Jinx: a bruxa do azar da H.I.V.E.
  const hexFx = (g, att, t) => { // "AZAR!" e estrelinhas rosa no inimigo
    const hy = t.y - t.z - (t.height || 90) * 0.6;
    for (let i = 0; i < 5; i++) g.particles.spawn('star', t.x + TT.rand(-24, 24), hy + TT.rand(-30, 20), { vx: TT.rand(-4, 4), vy: TT.rand(-5, -1), color: TT.choice(['#ff5fb4', '#ffb0dc', '#ffffff']), size: 8, life: 18, vr: 0.2 });
    if (Math.random() < 0.5) g.particles.spawn('text', t.x, hy - 50, { text: 'AZAR!', size: 30, color: '#ffb0dc', color2: '#a0287a', vy: -0.6, life: 30, rot: TT.rand(-0.2, 0.2) });
  };
  DEFS.jinx = {
    name: 'Jinx', style: 'jinx', hp: 100, speed: 5.1, jump: 16.5, color: '#ff5fb4', fx: '#ff8fd0',
    blurb: 'Bruxa do azar: chutes acrobáticos, onda de azar pelo chão e desmoronamentos.',
    dashFx(f, g, t) { if (t % 2 === 0) g.particles.spawn('star', f.x - f.facing * 20, f.y - 60 + TT.rand(-30, 30), { color: '#ff8fd0', size: 7, life: 14, rot: Math.random() }); },
    dashAtk: M('flyKick', { s: 3, a: 12, r: 12, dmg: 11, reach: [0, 84], lunge: 11, knockdown: true, launch: 6, kb: 8, big: true, onHitFx: hexFx }),
    light: [
      M('cast', { hands: 'open', glow: '#ff5fb4', dmg: 6, reach: [0, 84], onHitFx: hexFx, onFrame(f, t, g) { if (t === this.s) handBurst(f, g, '#ff5fb4', 4); } }),
      M('kick', { dmg: 7, reach: [0, 88], onHitFx: hexFx }),
      M('flyKick', { s: 8, r: 14, dmg: 12, reach: [0, 96], kb: 7, knockdown: true, launch: 8, big: true, lunge: 6, onHitFx: hexFx }),
    ],
    heavy: M('cast', { hands: 'open', glow: '#ff5fb4', s: 10, a: 1, r: 16, dmg: 0, name: 'Onda de azar',
      onFrame(f, t, g) {
        if (t !== this.s) return;
        shot(f, g, { kind: 'hexwave', z: 10, vx: f.facing * 11, r: 30, dmg: 13 * pw(f), kb: 6, knockdown: true, launch: 9, big: true, pierce: true, life: 60, onHitFx: hexFx });
        A().play('zap');
      } }),
    air: M('kick', { s: 3, a: 12, r: 8, dmg: 9, reach: [0, 84], kb: 3, zr: 130, onHitFx: hexFx }),
    special: { cost: 30, pose: 'castUp', hands: 'open', glow: '#ff5fb4', s: 16, a: 1, r: 20, shout: 'Que azar o seu!', shoutColor: '#ff8fd0',
      onFrame(f, t, g) {
        if (t < this.s && t % 2 === 0) handBurst(f, g, '#ff5fb4', 2);
        if (t === this.s) erupt(g, f, underEnemies(g, f, false, 4), { kind: 'hex', col: 'rgba(255,95,180,0.85)', dmg: 20 * pw(f), rx: 70, h: 120, word: 'AZAR!', sound: 'zap', hit: { onHitFx: hexFx } });
      } },
    mid: [
      M('uppercut', { s: 5, dmg: 8, reach: [0, 78], onHitFx: hexFx }),
      M('swipe', { hands: 'open', glow: '#ff5fb4', s: 6, dmg: 9, reach: [0, 96], onHitFx: hexFx }),
    ],
    ender: { pose: 'castUp', hands: 'open', glow: '#ff5fb4', s: 14, a: 1, r: 30, name: 'MALDIÇÃO DO AZAR',
      onFrame(f, t, g) {
        if (t === 1) { comboName(f, g, 'MALDIÇÃO DO AZAR'); A().play('zap'); }
        if (t === this.s) {
          for (const vy of [-2.2, 0, 2.2]) shot(f, g, { kind: 'hexwave', z: 10, vx: f.facing * 12, vy, r: 32, dmg: 14 * pw(f), kb: 7, knockdown: true, launch: 11, big: true, pierce: true, life: 60, onHitFx: hexFx });
          g.addEffect(new TT.Nova(g, f, { x: f.x, y: f.y, r: 200, dmg: 12 * pw(f), col: '#ff5fb4', word: 'AZAR TOTAL!' }));
          g.tintScreen('#ff5fb4', 12);
        }
      } },
  };

  // ---- Mammoth: o irmão fortão da Jinx
  DEFS.mammoth = {
    name: 'Mammoth', style: 'mammothP', hp: 185, speed: 3.9, jump: 13.5, color: '#e07a2a', fx: '#ffb35a',
    blurb: 'Força bruta: socos de varrer, pisão, investida e o supersalto.',
    dashAtk: M('jab', { s: 4, a: 14, r: 14, dmg: 15, reach: [0, 110], depth: 44, lunge: 13, knockdown: true, launch: 7, kb: 13, big: true, shout: 'SAI DA FRENTE!', shoutColor: '#ffb35a' }),
    light: [
      M('jab', { s: 5, dmg: 9, reach: [0, 100], depth: 38, kb: 3 }),
      M('cross', { s: 6, dmg: 10, reach: [0, 104], depth: 38, kb: 3 }),
      M('bigSwing', { s: 10, a: 5, r: 16, dmg: 16, reach: [0, 140], depth: 50, kb: 11, knockdown: true, launch: 8, big: true }),
    ],
    heavy: M('bigSlam', { s: 15, a: 3, r: 18, dmg: 17, reach: [0, 140], depth: 55, kb: 8, knockdown: true, launch: 8, big: true, name: 'Pisão',
      onFrame(f, t, g) { if (t === this.s) { g.addEffect(new TT.Shockwave(g, f.x + f.facing * 70, f.y, 260, 13 * pw(f), 'hero')); g.impact(f.x + f.facing * 80, f.y, 'BLAM!', '#ffb35a', 0.8); A().play('shockwave'); } } }),
    air: M('dive', { s: 3, a: 16, r: 10, dmg: 13, reach: [-20, 80], depth: 46, kb: 5, knockdown: true, launch: 6, zr: 140, big: true }),
    special: { cost: 35, pose: 'bigSlam', s: 8, a: 50, r: 14, shout: 'SUPERSALTO!', shoutColor: '#ffb35a',
      onFrame(f, t, g, a) {
        if (t === this.s) { f.vz = 19; f.z = 1; f.vx = f.facing * 4; A().play('jump'); g.dust(f.x, f.y, 8); }
        if (t > this.s + 3 && f.z <= 0 && !a.quake) {
          a.quake = true; f.vx = 0;
          g.addEffect(new TT.Nova(g, f, { x: f.x, y: f.y, r: 300, dmg: 26 * pw(f), col: '#ff9a3a', word: 'KRA-BOOM!' }));
          g.debrisBurst(f.x, f.y - 10, 12, '#8e8880'); g.impact(f.x, f.y, null, '#ffb35a', 1.2); A().play('shockwave');
          a.t = this.s + this.a; // aterrissou: vai direto para a recuperação
        }
      } },
    mid: [
      M('uppercut', { s: 6, dmg: 10, reach: [0, 100], depth: 40 }),
      M('swipe', { s: 7, dmg: 11, reach: [0, 124], depth: 44, kb: 3 }),
    ],
    ender: { pose: 'bigSlam', s: 12, a: 30, r: 20, name: 'FÚRIA DO MAMMOTH',
      onFrame(f, t, g) {
        if (t === 1) { comboName(f, g, 'FÚRIA DO MAMMOTH'); A().play('roar'); }
        if (t >= this.s && t < this.s + 30 && (t - this.s) % 10 === 0) {
          const i = (t - this.s) / 10, x = f.x + f.facing * (90 + i * 130);
          g.addEffect(new TT.Shockwave(g, x, f.y, 180, 14 * pw(f), 'hero'));
          g.impact(x, f.y, ['BAM!', 'BLAM!', 'KRAKOOM!'][i], '#ffb35a', 0.8 + i * 0.3);
          g.debrisBurst(x, f.y - 10, 6, '#8e8880'); g.afterimage(f, '#ffb35a'); A().play('shockwave');
        }
        if (t === this.s + 22) g.tintScreen('#ff9a3a', 10);
      } },
  };

  // ---- Mumbo: o mágico do mal
  const wandDraw = (ctx, f, sx, sy) => { // varinha na mão da frente
    const R = f.rigOut; if (!R || R.fx == null) return;
    const a = f.atk, up = a && a.t < a.def.s + a.def.a + 4 ? -0.9 : -0.3, L = 34 * f.style.scale;
    ctx.save(); ctx.translate(R.fx, R.fy); ctx.rotate(f.facing > 0 ? up : Math.PI - up);
    ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke();
    ctx.strokeStyle = '#1c1b26'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L * 0.78, 0); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(L * 0.78, 0); ctx.lineTo(L, 0); ctx.stroke();
    ctx.restore();
    if (a && a.t >= a.def.s - 2 && a.t < a.def.s + 6) TT.drawGlow(ctx, '#c87bff', R.fx + f.facing * L * 0.8, R.fy - L * 0.5, 30, 0.9);
  };
  DEFS.mumbo = {
    name: 'Mumbo', style: 'mumboP', hp: 120, speed: 4.3, jump: 14.5, color: '#86aee6', fx: '#c87bff',
    blurb: 'O mágico do mal: varinha, leque de cartas e o feitiço MUMBO JUMBO!',
    drawOver: wandDraw,
    dashFx(f, g, t) { if (t === 1) g.poof(f.x, f.y - 60); if (t % 3 === 0) g.particles.spawn('star', f.x, f.y - 60 + TT.rand(-40, 40), { color: '#c87bff', size: 8, life: 14, rot: Math.random() }); },
    dashAtk: M('jab', { s: 3, a: 12, r: 12, dmg: 11, reach: [0, 84], lunge: 11, knockdown: true, launch: 6, kb: 8, big: true }),
    light: [
      M('jab', { dmg: 6, reach: [0, 88], onFrame(f, t, g) { if (t === this.s) handBurst(f, g, '#c87bff', 3); } }),
      M('swipe', { dmg: 7, reach: [0, 92] }),
      M('castUp', { s: 9, r: 14, dmg: 12, reach: [0, 100], kb: 5, knockdown: true, launch: 11, big: true,
        onFrame(f, t, g) { if (t === this.s) { handBurst(f, g, '#c87bff', 8); A().play('zap'); } } }),
    ],
    heavy: M('throw', { s: 10, a: 1, r: 14, dmg: 0, name: 'Leque de cartas',
      onFrame(f, t, g) {
        if (t !== this.s) return;
        for (let i = -2; i <= 2; i++) shot(f, g, { kind: 'card', red: i % 2 === 0, vx: f.facing * 14, vy: i * 1.3, r: 14, dmg: 7 * pw(f), kb: 4, life: 60, trailN: 5, pierce: true });
        A().play('birdarang');
      } }),
    air: M('cast', { s: 4, a: 8, r: 10, dmg: 8, reach: [0, 90], kb: 3, zr: 130, onFrame(f, t, g) { if (t === this.s) handBurst(f, g, '#c87bff', 4); } }),
    special: { cost: 40, pose: 'castUp', s: 20, a: 1, r: 22, shout: 'MUMBO JUMBO!', shoutColor: '#c87bff',
      onFrame(f, t, g) {
        if (t < this.s && t % 2 === 0) handBurst(f, g, '#c87bff', 2);
        if (t !== this.s) return;
        g.tintScreen('#c87bff', 14); A().play('super');
        for (const e of onScreen(g, false, f)) {
          if (e.isBoss) hitOne(g, f, e, { dmg: 30 * pw(f), kb: 4, big: true });
          else { hitOne(g, f, e, { dmg: 10 * pw(f), kb: 2, stun: 10 }); bunnify(g, e, 240); }
        }
      } },
    mid: [
      M('spin', { s: 6, a: 6, dmg: 4, rehit: 3, reach: [-40, 90], depth: 40, kb: 1 }),
      M('cast', { s: 6, dmg: 9, reach: [0, 96], onFrame(f, t, g) { if (t === this.s) handBurst(f, g, '#c87bff', 5); } }),
    ],
    ender: { pose: 'castUp', s: 14, a: 1, r: 40, name: 'O GRANDE FINAL',
      onFrame(f, t, g) {
        if (t === 1) { comboName(f, g, 'O GRANDE FINAL'); A().play('zap'); }
        if (t === this.s) {
          g.tintScreen('#c87bff', 12);
          erupt(g, f, underEnemies(g, f, true, 5), { kind: 'hat', col: 'rgba(200,123,255,0.7)', dmg: 24 * pw(f), rx: 80, h: 130, launch: 12, sound: 'boom' });
          for (let i = 0; i < 8; i++) shot(f, g, { kind: 'card', red: i % 2 === 0, vx: f.facing * TT.rand(9, 15), vy: TT.rand(-3, 3), vz: TT.rand(-1, 3), r: 14, dmg: 5 * pw(f), kb: 3, life: 60, trailN: 5, pierce: true });
        }
      } },
  };

  // ---- Coelho-Guarda: coelho gigante do Mumbo
  DEFS.bunnyguard = {
    name: 'Coelho-Guarda', style: 'bunnyguard', hp: 110, speed: 5.3, jump: 18, color: '#c04ab0', fx: '#ffb3cf',
    blurb: 'Coelho do Mumbo: patadas, pulos altíssimos, cenouras e o estouro de coelhos.',
    dashAtk: M('flyKick', { s: 3, a: 12, r: 12, dmg: 12, reach: [0, 90], lunge: 12, knockdown: true, launch: 8, kb: 9, big: true }),
    light: [
      M('jab', { dmg: 6, reach: [0, 72] }),
      M('kick', { dmg: 8, reach: [0, 92] }),
      M('flyKick', { s: 8, r: 14, dmg: 13, reach: [0, 100], kb: 12, knockdown: true, launch: 7, big: true, lunge: 5,
        onFrame(f, t, g) { if (t === this.s) g.particles.spawn('text', f.x + f.facing * 90, f.y - 130, { text: 'BOING!', size: 34, color: '#ffe14a', color2: '#c04ab0', vy: -0.6, life: 28, rot: TT.rand(-0.2, 0.2) }); } }),
    ],
    heavy: M('throw', { s: 10, a: 1, r: 14, dmg: 0, name: 'Cenoura',
      onFrame(f, t, g) { if (t === this.s) { shot(f, g, { kind: 'carrot', vx: f.facing * 15, r: 18, dmg: 15 * pw(f), kb: 9, knockdown: true, launch: 7, big: true, life: 60, trailN: 4 }); A().play('whoosh'); } } }),
    air: M('dive', { s: 3, a: 14, r: 6, dmg: 10, reach: [-10, 70], kb: 4, zr: 140,
      onFrame(f, t, g, a) { if (a.landed && !a.bounced) { a.bounced = true; f.vz = 11; } } }),
    special: { cost: 30, pose: 'castUp', s: 12, a: 1, r: 20, shout: 'Estouro de coelhos!', shoutColor: '#ffb3cf',
      onFrame(f, t, g) { if (t === this.s) { g.addEffect(new Stampede(g, f, { n: 7, speed: 13, dmg: 14 * pw(f), life: 100, kind: 'bunny', word: 'BOING!' })); A().play('jump'); } } },
    mid: [
      M('uppercut', { s: 5, dmg: 8, reach: [0, 76] }),
      M('kick', { s: 5, dmg: 9, reach: [0, 94], kb: 2 }),
    ],
    ender: { pose: 'throw', s: 12, a: 1, r: 34, name: 'CENOURA EXPLOSIVA',
      onFrame(f, t, g) {
        if (t === 1) { comboName(f, g, 'CENOURA EXPLOSIVA'); A().play('jump'); }
        if (t === this.s) {
          shot(f, g, { kind: 'carrot', big: true, vx: f.facing * 13, r: 34, dmg: 18 * pw(f), kb: 10, knockdown: true, launch: 10, big: true, pierce: true, life: 45, blastR: 220, blastDmg: 20 * pw(f), blastEnd: true, blastColor: '#ff8a2a' });
          g.tintScreen('#ff8a2a', 10);
        }
      } },
  };

  // ---- Slade: o mestre do crime, com o fogo de Trigon
  const fireFx = (g, att, t) => {
    const hy = t.y - t.z - (t.height || 90) * 0.55;
    for (let i = 0; i < 5; i++) g.particles.spawn('spark', t.x + TT.rand(-20, 20), hy + TT.rand(-30, 30), { vx: TT.rand(-3, 3), vy: TT.rand(-6, -2), color: TT.choice(['#ff7a1a', '#ffd23a', '#ffffff']), size: 4, life: 16, grav: 0.1 });
  };
  DEFS.slade = {
    name: 'Slade', style: 'sladeP', hp: 145, speed: 4.9, jump: 15.5, color: '#ff7a1a', fx: '#ff9a3a',
    blurb: 'O mestre do crime: bastão, bombas de disco e o fogo de Trigon.',
    dashAtk: M('jab', { weapon: 'staff', s: 3, a: 12, r: 12, dmg: 12, reach: [0, 110], lunge: 12, knockdown: true, launch: 6, kb: 9, big: true }),
    light: [
      M('jab', { weapon: 'staff', dmg: 7, reach: [0, 104] }),
      M('swipe', { weapon: 'staff', dmg: 8, reach: [0, 112] }),
      M('slam', { weapon: 'staff', s: 9, r: 14, dmg: 14, reach: [0, 124], kb: 7, knockdown: true, launch: 7, big: true,
        onFrame(f, t, g) { if (t === this.s) { g.dust(f.x + f.facing * 90, f.y, 6); g.shake = Math.max(g.shake, 6); } } }),
    ],
    heavy: M('throw', { s: 10, a: 1, r: 14, dmg: 0, name: 'Bomba de disco',
      onFrame(f, t, g) { if (t === this.s) { shot(f, g, { kind: 'sladeBomb', vx: f.facing * 13, r: 16, dmg: 10 * pw(f), kb: 5, knockdown: true, life: 50, blastR: 130, blastDmg: 16 * pw(f), blastEnd: true, blastColor: '#ff7a1a' }); A().play('birdarang'); } } }),
    air: M('dive', { weapon: 'staff', s: 3, a: 14, r: 6, dmg: 10, reach: [-10, 80], kb: 3, lunge: 5, zr: 130 }),
    special: { cost: 40, pose: 'castUp', s: 18, a: 1, r: 24, shout: 'O fogo de Trigon!', shoutColor: '#ff7a1a',
      onFrame(f, t, g) {
        if (t < this.s && t % 2 === 0) g.particles.spawn('glow', f.x + TT.rand(-40, 40), f.y - TT.rand(20, 140), { color: '#ff7a1a', size: 30, life: 12, vy: -2 });
        if (t !== this.s) return;
        const pts = [];
        for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 4 + ring * 4; i++) { const a = i / (4 + ring * 4) * Math.PI * 2 + ring * 0.3, R = 60 + ring * 100; pts.push({ x: f.x + Math.cos(a) * R, y: f.y + Math.sin(a) * R * 0.42, d: ring * 7 }); }
        erupt(g, f, pts, { kind: 'fire', col: 'rgba(255,122,26,0.75)', dmg: 16 * pw(f), rx: 70, h: 120, sound: 'boom', hit: { onHitFx: fireFx } });
        g.tintScreen('#ff4a1a', 14);
      } },
    mid: [
      M('spin', { weapon: 'staff', s: 6, a: 8, dmg: 4, rehit: 4, reach: [-60, 110], depth: 40, kb: 1 }),
      M('uppercut', { weapon: 'staff', s: 5, dmg: 9, reach: [0, 100] }),
    ],
    ender: { pose: 'jab', weapon: 'staff', s: 6, a: 24, r: 22, name: 'XEQUE-MATE',
      onFrame(f, t, g, a) {
        if (t === 1) { comboName(f, g, 'XEQUE-MATE'); a.marked = onScreen(g, true, f).filter((e) => Math.abs(e.x - f.x) < 560).sort((p, q) => Math.abs(p.x - f.x) - Math.abs(q.x - f.x)).slice(0, 6); }
        const list = a.marked || [];
        if (t >= this.s && t < this.s + this.a && (t - this.s) % 4 === 0) {
          const e = list[(t - this.s) / 4];
          if (e && !e.dead) { g.afterimage(f, '#ff7a1a'); f.x = e.x - f.facing * 70; f.y = e.y; g.particles.spawn('ring', e.x, e.y - 80, { color: '#ff7a1a', size: 80, life: 12 }); A().play('whoosh'); }
        }
        if (t === this.s + this.a) {
          g.addEffect(new TT.DelayedBursts(g, f, list.filter((e) => !e.dead), { dmg: 26 * pw(f), col: '#ff7a1a', word: 'XEQUE!', emblem: 'S' }));
          g.tintScreen('#ff4a1a', 12);
        }
      } },
  };

  // ---- Control Freak: o nerd do controle remoto
  const remoteDraw = (ctx, f) => { // controle remoto na mão da frente
    const R = f.rigOut; if (!R || R.fx == null) return;
    ctx.save(); ctx.translate(R.fx, R.fy); ctx.scale(f.facing, 1); ctx.rotate(-0.4);
    ctx.beginPath(); ctx.rect(-4, -20, 12, 26); ctx.fillStyle = '#1c1a22'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ff3a3a'; ctx.beginPath(); ctx.arc(2, -14, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7bffea'; ctx.fillRect(-1, -6, 6, 3);
    ctx.restore();
  };
  DEFS.freak = {
    name: 'Control Freak', style: 'freakP', hp: 120, speed: 4.0, jump: 13.5, color: '#3aa89a', fx: '#7bffea',
    blurb: 'Nerd da TV: pancada com o controle, ZAP, botão de PAUSA e chuva de TVs.',
    drawOver: remoteDraw,
    dashAtk: M('jab', { s: 4, a: 12, r: 14, dmg: 12, reach: [0, 90], depth: 44, lunge: 10, knockdown: true, launch: 6, kb: 9, big: true }),
    light: [
      M('jab', { dmg: 7, reach: [0, 82], onFrame(f, t, g) { if (t === this.s) handBurst(f, g, '#7bffea', 3); } }),
      M('cross', { dmg: 7, reach: [0, 86] }),
      M('slam', { s: 9, r: 14, dmg: 13, reach: [0, 104], depth: 46, kb: 7, knockdown: true, launch: 7, big: true,
        onFrame(f, t, g) { if (t === this.s) g.groundRing(f.x + f.facing * 70, f.y, '#7bffea'); } }),
    ],
    heavy: M('beam', { s: 12, a: 16, r: 14, dmg: 5, rehit: 5, reach: [20, 460], depth: 32, kb: 3, stun: 40, sound: 'zap', name: 'ZAP!',
      drawFx: handBeam('#7bffea', 18, true),
      onFrame(f, t, g) { if (t === this.s) g.particles.spawn('text', f.x + f.facing * 200, f.y - 150, { text: 'ZAP!', size: 40, color: '#e6fffb', color2: '#2a7bff', vy: -0.6, life: 28 }); } }),
    air: M('dive', { s: 3, a: 16, r: 8, dmg: 11, reach: [-20, 76], depth: 44, kb: 4, zr: 140,
      onFrame(f, t, g, a) { if (f.vz < 0 && f.z < 24 && !a.flop) { a.flop = true; g.groundRing(f.x, f.y, '#7bffea'); A().play('land'); } } }),
    special: { cost: 35, pose: 'beam', s: 16, a: 1, r: 22, shout: 'Botão de PAUSA!', shoutColor: '#7bffea',
      onFrame(f, t, g) {
        if (t < this.s && t % 3 === 0) handBurst(f, g, '#7bffea', 2);
        if (t !== this.s) return;
        g.whiteFlash = 6; A().play('zap');
        for (const e of onScreen(g, false, f)) {
          const d = { dmg: 12 * pw(f), kb: 0, stun: 150, big: true };
          if (e.isBoss) hitOne(g, f, e, { dmg: 26 * pw(f), kb: 3, big: true });
          else { hitOne(g, f, e, d); pauseEnemy(g, e, 150); }
        }
      } },
    mid: [
      M('uppercut', { s: 5, dmg: 8, reach: [0, 80] }),
      M('swipe', { s: 6, dmg: 9, reach: [0, 94], kb: 2 }),
    ],
    ender: { pose: 'castUp', s: 12, a: 1, r: 40, name: 'MARATONA DE TV',
      onFrame(f, t, g) {
        if (t === 1) { comboName(f, g, 'MARATONA DE TV'); A().play('zap'); }
        if (t !== this.s) return;
        g.tintScreen('#3aa89a', 12);
        const pts = underEnemies(g, f, false, 0).concat(lineAhead(f, 3, 160, 120, 0)).slice(0, 9);
        pts.forEach((p, i) => {
          const T = 24 + i * 4, z0 = 620;
          shot(f, g, { kind: 'tvDrop', x: p.x, y: p.y, z: z0, vx: 0, vy: 0, vz: (0.5 * 0.6 * T * T - z0) / T, grav: 0.6, r: 24, dmg: 0, blastDmg: 18 * pw(f), life: 140, explodeOnGround: 95, impactWord: 'CRASH!' });
        });
      } },
  };

  // ================================================================ Montagem dos três níveis de poder
  const boost = (d, k) => Object.assign({}, d, { dmg: d.dmg ? Math.round(d.dmg * k) : d.dmg });
  function build(key, o) {
    const common = { name: o.name, style: o.style, hp: o.hp, speed: o.speed, jump: o.jump, color: o.color, fx: o.fx, floaty: o.floaty, blurb: o.blurb, extra: true,
      dashFx: o.dashFx, drawDash: o.drawDash, drawOver: o.drawOver };
    const lv0 = Object.assign({}, common, { pw: 1, light: o.light, heavy: o.heavy, air: o.air, special: o.special, dashAtk: o.dashAtk });
    const b = (d) => boost(d, 1.4);
    const lv1 = Object.assign({}, common, { pw: 1.4, plus: true, light: o.light.map(b), heavy: b(o.heavy), air: b(o.air), special: o.special, dashAtk: b(o.dashAtk) });
    // combo de 5: o 3º e o 4º não derrubam; o 5º é o finalizador
    const mid = o.mid.map((d) => Object.assign(boost(d, 1.5), { knockdown: false }));
    const lv2 = Object.assign({}, lv1, { pw: 1.5, combos: true, light: [boost(o.light[0], 1.5), boost(o.light[1], 1.5), mid[0], mid[1], boost(o.light[2], 1.5)], ender: o.ender });
    TT.TITANS[key] = lv0; TT.TITANS_PLUS[key] = lv1; TT.TITANS_COMBO[key] = lv2;
  }
  for (const k in DEFS) build(k, DEFS[k]);

  // Versões alternativas: poderes do Titã de origem, já com os golpes novos e os combos ("combos mudados" no PS2).
  function alt(key, base, o) {
    const d = Object.assign({}, TT.TITANS_COMBO[base], { base, style: key, extra: true }, o);
    TT.TITANS[key] = TT.TITANS_PLUS[key] = TT.TITANS_COMBO[key] = d;
  }
  alt('apprentice', 'robin', { name: 'Aprendiz', color: '#ff7a1a', fx: '#ff9a3a', blurb: 'O Robin como aprendiz do Slade: golpes do Robin, já com os combos da fase 8.' });
  alt('clownbb', 'beastboy', { name: 'Mutano Palhaço', color: '#ffd23a', fx: '#ff5a5a', blurb: 'O Mutano de palhaço no circo do Mumbo: animais do Mutano, já com os combos da fase 8.' });

  // Resumo dos golpes para o menu (nome do forte/especial/combo final de cada um).
  TT.MOVE_INFO = {
    robin: ['Bastão (combo)', 'Chute lateral', 'Birdarangues', 'Golpe Relâmpago'],
    cyborg: ['Punho-pistão (combo)', 'Martelo duplo', 'Canhão sônico', 'Rajada Booyah'],
    raven: ['Mãos de energia negra', 'Corvo de energia', 'Azarath Metrion Zinthos!', 'Esferas de Azarath'],
    starfire: ['Punhos de energia', 'Starbolt carregado', 'Raios oculares', 'Supernova'],
    beastboy: ['Socos e animais', 'Gorila', 'T-Rex', 'Estouro da Manada'],
    hivesoldier: ['Socos e coronhada', 'Rajada de blaster', 'Granada H.I.V.E.', 'Esquadrão H.I.V.E.'],
    minion: ['Punhos de metal', 'Punho-foguete', 'Autodestruição', 'Legião de Robôs'],
    cinderblock: ['Socos de pedra', 'Pisão sísmico', 'Arremesso de pedra', 'Terremoto'],
    gizmo: ['Patas de aranha', 'Laser', 'Chuva de mísseis', 'Mega-Aranha'],
    plasmus: ['Braços esticados', 'Soco esticado', 'Onda de lodo', 'Mar de Lodo'],
    plasmuskid: ['Giro de gosma', 'Cuspe de gosma', 'Chuva de gosma', 'Bolha Gigante'],
    jinx: ['Chutes do azar', 'Onda de azar', 'Desmoronamento', 'Maldição do Azar'],
    mammoth: ['Socos de varrer', 'Pisão', 'Supersalto', 'Fúria do Mammoth'],
    mumbo: ['Varinha mágica', 'Leque de cartas', 'MUMBO JUMBO! (vira coelho)', 'O Grande Final'],
    bunnyguard: ['Patadas', 'Cenoura', 'Estouro de coelhos', 'Cenoura Explosiva'],
    slade: ['Bastão', 'Bomba de disco', 'Fogo de Trigon', 'Xeque-Mate'],
    freak: ['Controle remoto', 'ZAP!', 'Botão de PAUSA', 'Maratona de TV'],
    apprentice: ['Bastão (combo de 5)', 'Disco congelante', 'Discos explosivos', 'Golpe Relâmpago'],
    clownbb: ['Animais (combo de 5)', 'Elefante', 'A Fera', 'Estouro da Manada'],
  };

  // ================================================================ Equipe escolhida (salva no navegador)
  TT.DEFAULT_TEAM = TT.TITAN_ORDER.slice();
  // Lê a equipe salva; troca por Titãs padrão quem não estiver liberado (ou repetido).
  TT.loadTeam = function () {
    const raw = String(TT.store.get('equipe', '')).split(',').filter(Boolean);
    const cl = TT.Unlocks.cleared(), out = [];
    for (let i = 0; i < 5; i++) {
      const k = raw[i];
      out.push(k && TT.Unlocks.isUnlocked(k, cl) && !out.includes(k) ? k : null);
    }
    for (let i = 0; i < 5; i++) if (!out[i]) out[i] = TT.DEFAULT_TEAM.find((k) => !out.includes(k));
    return out;
  };
  TT.saveTeam = function (keys) { TT.store.set('equipe', keys.join(',')); };
})();
