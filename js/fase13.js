'use strict';
// Fase 13 — A TERCEIRA DIMENSÃO: os capangas geométricos (Cubóide e Tetraedro), o chefe VÉRTICE e o
// cenário 2D do começo da fase. No meio da fase o mundo "ganha profundidade" e passa a ser desenhado
// em 3D (js/world3d.js); a lógica do jogo continua a mesma (x, profundidade y e altura z).
(function () {
  const TT = window.TT, W = TT.W, H = TT.H, OUT = TT.OUT, FT = TT.FLOOR_TOP;
  const A = () => TT.audio;
  const S = TT.STYLES, ENEMIES = TT.ENEMIES;
  const NEON = '#5ff2ff', NEON2 = '#ff5fd2', VIOLET = '#8a5cff', GOLD = '#ffd84a';
  TT.F13 = { NEON, NEON2, VIOLET, GOLD };

  // ---------------------------------------------------------------- Desenho 2D de sólidos
  // Cubo em perspectiva cavaleira (x, y = centro da face da frente; s = aresta).
  function isoCube(ctx, x, y, s, col, flash, edge) {
    const h = s / 2, d = s * 0.42, dy = d * 0.62;
    ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.4, s * 0.07);
    ctx.beginPath(); ctx.moveTo(x - h, y - h); ctx.lineTo(x - h + d, y - h - dy); ctx.lineTo(x + h + d, y - h - dy); ctx.lineTo(x + h, y - h); ctx.closePath();
    ctx.fillStyle = flash ? '#fff' : TT.shade(col, 0.28); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + h, y - h); ctx.lineTo(x + h + d, y - h - dy); ctx.lineTo(x + h + d, y + h - dy); ctx.lineTo(x + h, y + h); ctx.closePath();
    ctx.fillStyle = flash ? '#fff' : TT.shade(col, -0.32); ctx.fill(); ctx.stroke();
    ctx.fillStyle = flash ? '#fff' : col; ctx.fillRect(x - h, y - h, s, s); ctx.strokeRect(x - h, y - h, s, s);
    if (edge && !flash) { ctx.strokeStyle = edge; ctx.lineWidth = 1.6; ctx.strokeRect(x - h + 3, y - h + 3, s - 6, s - 6); }
  }
  TT.isoCube = isoCube;

  // Sólido de verdade projetado na tela (tetraedro, octaedro...): faces ordenadas por profundidade.
  const TETRA = { v: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]], f: [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]] };
  const OCTA = { v: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], f: [[0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5]] };
  TT.SOLIDS = { TETRA, OCTA };
  function drawSolid(ctx, solid, x, y, r, yaw, pitch, cols, flash, glowEdge) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const P = solid.v.map(([a, b, c]) => {
      const x1 = a * cy - c * sy, z1 = a * sy + c * cy;
      const y2 = b * cp - z1 * sp, z2 = b * sp + z1 * cp;
      return [x + x1 * r, y - y2 * r, z2];
    });
    const faces = solid.f.map((f, i) => ({ f, i, z: (P[f[0]][2] + P[f[1]][2] + P[f[2]][2]) / 3 })).sort((m, n) => m.z - n.z);
    ctx.lineJoin = 'round';
    for (const F of faces) {
      const [a, b, c] = F.f.map((k) => P[k]);
      const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
      const base = cols[F.i % cols.length];
      ctx.fillStyle = flash ? '#fff' : TT.shade(base, TT.clamp(F.z * 0.35 + (nz > 0 ? 0.05 : -0.1), -0.4, 0.4));
      ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
      if (glowEdge && !flash && F.z > 0) { ctx.strokeStyle = glowEdge; ctx.lineWidth = 1.2; ctx.stroke(); }
    }
    return P;
  }
  TT.drawSolid = drawSolid;

  // Corpo de blocos do Cubóide, guiado pelos mesmos ângulos de pose dos outros personagens.
  function drawVoxelBody(ctx, f, sx, sy, fl) {
    const st = f.style, p = TT.computePose(f, f.pose), sc = st.scale;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(f.facing * sc, sc);
    if (p.rot) { ctx.translate(0, -12); ctx.rotate(p.rot); }
    const L1 = st.legL[0], L2 = st.legL[1], hy = -(L1 + L2) + 4 + p.bob;
    if (p.spin) { const py = hy - st.torsoH * 0.35; ctx.translate(0, py); ctx.rotate(p.spin); ctx.translate(0, -py); }
    const limb = (ax, ay, ang, l1, l2, s, col, dark, endCol) => {
      const kx = ax + Math.sin(ang[0]) * l1, ky = ay + Math.cos(ang[0]) * l1;
      const ex = kx + Math.sin(ang[1]) * l2, ey = ky + Math.cos(ang[1]) * l2;
      const c = dark ? TT.shade(col, -0.25) : col;
      isoCube(ctx, (ax + kx) / 2, (ay + ky) / 2, s, c, fl, null);
      isoCube(ctx, (kx + ex) / 2, (ky + ey) / 2, s * 0.9, c, fl, null);
      isoCube(ctx, ex, ey, s * 0.72, dark ? TT.shade(endCol, -0.25) : endCol, fl, NEON);
    };
    const cl = Math.cos(p.lean), sl = Math.sin(p.lean);
    const rot = (px, py) => [px * cl - py * sl, hy + px * sl + py * cl];
    limb(-4, hy, p.legB, L1, L2, st.legW, st.leg, true, st.boot);
    const [bx, by] = rot(-st.shW * 0.2, -st.torsoH + 6);
    limb(bx, by, p.armB, st.armL[0], st.armL[1], st.armW, st.arm, true, st.glove);
    const [t1x, t1y] = rot(0, -st.torsoH * 0.26), [t2x, t2y] = rot(0, -st.torsoH * 0.74);
    isoCube(ctx, t1x, t1y, st.waistW, TT.shade(st.torso, -0.1), fl, null);
    isoCube(ctx, t2x, t2y, st.shW, st.torso, fl, NEON);
    if (!fl) TT.drawGlow(ctx, NEON, t2x + 2, t2y, 18, 0.85);
    limb(4, hy, p.legF, L1, L2, st.legW, st.leg, false, st.boot);
    const [hx, hy2] = rot(3, -st.torsoH - 17);
    isoCube(ctx, hx, hy2, 27, st.skin, fl, NEON);
    if (!fl) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(hx + 2, hy2 - 5, 10, 7);
      ctx.fillStyle = NEON2; ctx.fillRect(hx + 6, hy2 - 4, 5, 5);
    }
    const [fx, fy] = rot(st.shW * 0.16, -st.torsoH + 6);
    limb(fx, fy, p.armF, st.armL[0], st.armL[1], st.armW, st.arm, false, st.glove);
    ctx.restore();
  }

  // ---------------------------------------------------------------- Estilos (2D)
  S.cuboid = TT.mkStyle({
    scale: 1.15, headR: 15, torsoH: 40, shW: 34, waistW: 27, hipW: 26, legL: [24, 22], armL: [22, 20], legW: 14, armW: 13, handR: 8, footR: 9,
    skin: '#6b7dff', torso: '#3b3f9e', arm: '#5a6cff', glove: '#8a5cff', hand: '#8a5cff', leg: '#2c2f7a', boot: '#1b1d55',
  });
  // (a chave com acento é a que aparece no nome de quem fala nas cenas de história)
  // Vértice: figura alta de arestas e facetas; uma cabeça-gema com um único olho e um halo de anéis.
  S.vertice = TT.mkStyle({
    scale: 1.85, headR: 17, torsoH: 44, shW: 38, waistW: 20, hipW: 24, legL: [27, 26], armL: [25, 24], legW: 9, armW: 8.5, handR: 7.5, footR: 8, neck: 5,
    skin: '#dff9ff', torso: '#2b1b5a', arm: '#4b2f9a', glove: '#5ff2ff', hand: '#e9fbff', leg: '#1f1446', boot: '#120b2c',
    armOpt: { split: 1.5 }, legOpt: { split: 1.45 },
    drawBack(ctx, P) {
      if (TT.rigFlash()) return;
      const [sx, sy] = P.S, t = P.t || 0;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        ctx.strokeStyle = i ? 'rgba(255,95,210,0.7)' : 'rgba(95,242,255,0.8)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(sx - 4, sy - 34, 34 + i * 9, 12 + i * 4, t * 0.03 * (i ? -1 : 1), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.strokeStyle = NEON; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-14, -th + 4); ctx.lineTo(0, -th * 0.45); ctx.lineTo(14, -th + 4); ctx.moveTo(0, -th * 0.45); ctx.lineTo(0, 0); ctx.stroke();
      TT.drawGlow(ctx, NEON, 0, -th * 0.45, 12, 0.9);
    },
    drawHead(ctx, r, pose) {
      const fl = TT.rigFlash();
      TT.drawSolid(ctx, OCTA, 0, -2, r * 1.15, 0.6, 0.35, ['#dff9ff', '#a8e8ff', '#c9b8ff', '#ffffff'], fl, NEON);
      if (!fl) {
        TT.drawGlow(ctx, NEON2, r * 0.25, -2, r * 0.9, 0.9);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(r * 0.28, -2, r * 0.32, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = NEON2; ctx.beginPath(); ctx.arc(r * 0.34, -2, r * 0.13, 0, Math.PI * 2); ctx.fill();
      }
    },
  });

  S['vértice'] = S.vertice;

  // ---------------------------------------------------------------- Efeitos
  // Cubo que brota do chão (onda de blocos do Cubóide, queda do Vértice).
  class CubePop {
    constructor(game, x, y, delay, size) {
      Object.assign(this, { game, x, y, t: -(delay || 0), dur: 34, remove: false, s: size || 30, col: TT.choice([NEON, VIOLET, '#6b7dff', NEON2]), spin: TT.rand(-0.3, 0.3) });
    }
    update() {
      this.t++;
      if (this.t === 1) { this.game.dust(this.x, this.y, 3, '#9aa6ff'); }
      if (this.t > this.dur) this.remove = true;
    }
    lift() { const k = this.t / this.dur; return Math.sin(Math.min(1, k * 1.7) * Math.PI) * 46; }
    size() { const k = this.t / this.dur; return this.s * (k < 0.15 ? k / 0.15 : 1) * (k > 0.8 ? (1 - k) / 0.2 : 1); }
    // world3d desenha o cubo como sólido 3D; o 2D só no modo plano
    cube3d() { return this.t < 0 ? null : { x: this.x, y: this.y, h: this.lift(), s: this.size(), col: this.col, rot: this.t * this.spin }; }
    draw(ctx, camX) {
      if (this.t < 0 || TT.SKIP_RIG) return;
      const s = this.size(); if (s < 1) return;
      const up = this.lift();
      TT.drawGlow(ctx, this.col, this.x - camX, this.y - up * 0.5, s * 1.2, 0.35);
      isoCube(ctx, this.x - camX, this.y - s / 2 - up, s, this.col, false, '#ffffff');
    }
  }
  TT.CubePop = CubePop;

  // ---------------------------------------------------------------- Capangas
  // Cubóide: golem de blocos. Soca o chão e uma fila de cubos brota à frente; de perto, um direto.
  ENEMIES.cuboid = {
    name: 'Cubóide', style: 'cuboid', hp: 96, speed: 2.2, range: 160, score: 260, aggr: 1.05,
    attacks: [
      { pose: 'slam', s: 26, a: 8, r: 22, dmg: 12, zoneHit: true, knockdown: true, launch: 6, kb: 6, sound0: 'roar', color: NEON,
        zone(f) { return [{ k: 'rect', x0: f.x + f.facing * 20, x1: f.x + f.facing * 290, y: f.y, d: 28, arrows: true }]; },
        onFrame(f, t, g) {
          if (t !== this.s) return;
          A().play('boom'); g.shake = Math.max(g.shake, 6);
          g.impact(f.x + f.facing * 60, f.y, 'BLOC!', NEON, 0.8);
          for (let i = 0; i < 7; i++) g.addEffect(new CubePop(g, f.x + f.facing * (50 + i * 38), f.y + TT.rand(-6, 6), i * 2));
        } },
      { pose: 'cross', s: 14, a: 5, r: 18, lunge: 5, dmg: 10, reach: [0, 92], kb: 5, sound0: 'whoosh' },
    ],
  };
  class Cuboid extends TT.ShockTrooper {
    constructor(game, x, y) {
      super(game, x, y, 'cuboid');
      this.radius = 30; this.height = 140; this.shadowW = 38;
      this.model3d = 'cuboid';
    }
    die(dir, d) {
      super.die(dir, d);
      A().play('boom');
      const g = this.game;
      for (let i = 0; i < 16; i++) {
        g.particles.spawn('debris', this.x + TT.rand(-26, 26), this.y - TT.rand(20, 120), {
          vx: TT.rand(-7, 7), vy: TT.rand(-9, -2), grav: 0.5, color: TT.choice([NEON, VIOLET, '#6b7dff', '#3b3f9e']),
          size: TT.rand(7, 12), vr: 0.3, life: 34, floor: this.y,
        });
      }
      g.particles.spawn('text', this.x, this.y - 160, { text: 'CLONK!', size: 32, color: '#cfe0ff', color2: '#3b3f9e', vy: -0.6, life: 30, rot: TT.rand(-0.2, 0.2) });
    }
    draw(ctx, camX) {
      if (this.dead && this.state === 'down' && this.st > 25 && (this.st >> 2) % 2 === 0) return;
      const a = this.atk, d = a && a.def;
      const tell = a && this.state === 'attack' && a.t < d.s ? a.t / d.s : -1, blink = tell > 0.55 && (a.t >> 1) % 2 === 0;
      const sx = this.x - camX, sy = this.y - this.z;
      if (!TT.SKIP_RIG) {
        if (this.invul > 0 && (this.invul >> 2) % 2 === 0) ctx.globalAlpha = 0.6;
        drawVoxelBody(ctx, this, sx, sy, this.flash > 3 || blink);
        ctx.globalAlpha = 1;
      }
      if (tell >= 0) TT.drawGlow(ctx, NEON, sx + this.facing * 30, sy - 70, 24 + 30 * tell, 0.4 + 0.5 * tell);
    }
  }
  TT.Cuboid = Cuboid;

  // Tetraedro: pirâmide voadora que gira. Laser que queima uma faixa do chão e mergulho com anel de choque.
  ENEMIES.tetra = {
    name: 'Tetraedro', style: 'cuboid', hp: 58, speed: 3.1, range: 200, score: 240, aggr: 1.1,
    attacks: [
      { pose: 'beam', s: 30, a: 12, r: 20, dmg: 10, zoneHit: true, kb: 4, stun: 22, sound0: 'alarm', sound: 'laser', color: NEON2,
        zone(f) { return [{ k: 'rect', x0: f.x + f.facing * 40, x1: f.x + f.facing * 430, y: f.y, d: 22, arrows: true }]; } },
      { pose: 'jab', s: 28, a: 6, r: 28, dmg: 11, zoneHit: true, knockdown: true, launch: 5, kb: 5, sound0: 'alarm', sound: 'boom', color: NEON,
        zone(f) { return [{ k: 'ell', x: f.x, y: f.y, rx: 110, ry: 46 }]; },
        onFrame(f, t, g) {
          if (t !== this.s) return;
          g.shake = Math.max(g.shake, 7);
          g.particles.spawn('ring', f.x, f.y, { size: 150, color: NEON, life: 18, flat: 0.38 });
          g.particles.spawn('text', f.x, f.y - 120, { text: 'TCHUNC!', size: 30, color: '#e8fdff', color2: '#1d6f8a', vy: -0.6, life: 30, rot: TT.rand(-0.2, 0.2) });
          g.dust(f.x, f.y, 8, '#9aa6ff');
        } },
    ],
  };
  class Tetra extends TT.ShockTrooper {
    constructor(game, x, y) {
      super(game, x, y, 'tetra');
      this.radius = 24; this.height = 150; this.shadowW = 22;
      this.model3d = 'tetra';
      this.spinR = TT.rand(0, 6);
    }
    // altura de voo (a lógica de acerto continua no chão, como a Lanterna da fase 12)
    hoverZ() {
      const a = this.atk, t = this.animT;
      if (this.state === 'down') return Math.max(8, 80 - this.st * 5);
      let h = 82 + Math.sin(t * 0.08 + this.spinR) * 8;
      if (a && this.state === 'attack' && a.def === this.def.attacks[1]) {
        const d = a.def;
        if (a.t < d.s) h += Math.min(1, a.t / (d.s * 0.7)) * 40 - (a.t > d.s * 0.7 ? ((a.t - d.s * 0.7) / (d.s * 0.3)) * 125 : 0);
        else if (a.t < d.s + d.a + 8) h = 8;
        else h = 8 + Math.min(74, (a.t - d.s - d.a - 8) * 4);
      }
      return Math.max(6, h);
    }
    spinAngle() {
      const a = this.atk, fast = a && this.state === 'attack' && a.t < a.def.s + a.def.a;
      return this.spinR + this.animT * (fast ? 0.22 : 0.05);
    }
    die(dir, d) {
      super.die(dir, d);
      A().play('glass');
      const g = this.game;
      for (let i = 0; i < 12; i++) {
        g.particles.spawn('debris', this.x + TT.rand(-20, 20), this.y - 110, {
          vx: TT.rand(-6, 6), vy: TT.rand(-8, -2), grav: 0.45, color: TT.choice([NEON, NEON2, '#ffffff', VIOLET]),
          size: TT.rand(5, 9), vr: 0.35, life: 30, floor: this.y,
        });
      }
      g.particles.spawn('text', this.x, this.y - 170, { text: 'PLINC!', size: 30, color: '#ffe0f6', color2: '#8a1f6a', vy: -0.6, life: 30, rot: TT.rand(-0.2, 0.2) });
    }
    // ponto de onde sai o laser (o olho), na tela 2D
    eye(camX) { return [this.x - camX + this.facing * 16, this.y - this.z - this.hoverZ() - 12]; }
    draw(ctx, camX) {
      if (this.dead && this.state === 'down' && this.st > 25 && (this.st >> 2) % 2 === 0) return;
      const a = this.atk, d = a && a.def, fl = this.flash > 3;
      const tell = a && this.state === 'attack' && a.t < d.s ? a.t / d.s : -1, blink = tell > 0.55 && (a.t >> 1) % 2 === 0;
      const [ex, ey] = this.eye(camX);
      if (!TT.SKIP_RIG) {
        const x = this.x - camX, y = this.y - this.z - this.hoverZ() - 12;
        if (this.invul > 0 && (this.invul >> 2) % 2 === 0) ctx.globalAlpha = 0.6;
        TT.drawGlow(ctx, (this.animT >> 4) % 2 ? NEON : NEON2, x, y, 50, 0.45);
        const tilt = this.state === 'down' ? Math.min(1.4, this.st * 0.1) : this.state === 'hurt' ? -0.4 : 0.5;
        drawSolid(ctx, TETRA, x, y, 26, this.spinAngle(), tilt, ['#ff5fd2', '#8a5cff', '#5ff2ff', '#d9c8ff'], fl || blink, '#ffffff');
        if (!fl) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      if (tell >= 0) TT.drawGlow(ctx, d === this.def.attacks[0] ? NEON2 : NEON, ex, ey, 22 + 30 * tell, 0.4 + 0.5 * tell);
      if (!a || this.state !== 'attack' || this.dead) return;
      if (d === this.def.attacks[0] && a.t >= d.s && a.t < d.s + d.a + 5) {
        // laser em "L": desce do olho até o chão e queima a faixa marcada
        const k = Math.min(1, (a.t - d.s + 1) / 3), fade = a.t >= d.s + d.a ? 1 - (a.t - d.s - d.a) / 5 : 1;
        const gx0 = this.x - camX + this.facing * 40, gx1 = this.x - camX + this.facing * (40 + 390 * k), gy = this.y;
        ctx.save(); ctx.globalAlpha = fade; ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        for (const [w, c] of [[22, NEON2], [8, '#ffffff']]) {
          ctx.strokeStyle = c; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(gx0, gy - 6); ctx.lineTo(gx1, gy - 6); ctx.stroke();
        }
        TT.drawGlow(ctx, NEON2, gx1, gy - 8, 40, 0.9);
        ctx.restore();
      }
    }
  }
  TT.Tetra = Tetra;

  // ---------------------------------------------------------------- Chefe: VÉRTICE
  // Entidade de uma dimensão "a mais": dobra o mundo. Grade de lasers (paredes de luz que sobem do chão),
  // chuva de poliedros, um giro de arestas para quem chega perto e, na fase 2, a DOBRA DIMENSIONAL:
  // achata o mundo de volta para 2D (a câmera volta a ser plana), puxa todos para a mesma linha e passa
  // uma lâmina de luz rente ao chão (PULE!). Depois da dobra ele fica "desdobrado": parado e com dano dobrado.
  class Vertice extends TT.Boss {
    constructor(game, x, y) {
      super(game, x, y);
      this.name = 'VÉRTICE';
      this.style = S.vertice;
      this.model3d = 'vertice';
      this.hp = this.maxHp = 3200;
      this.radius = 46; this.height = 250; this.shadowW = 60;
      this.poiseMax = 200;
      this.def = { score: 24000 };
      this.openT = 0; this.alpha = 1; this.atkCount = 0; this.p2Said = false; this.out = {};
      this.walls = []; // paredes de laser ativas (desenhadas em 3D por world3d)
      this.rocks = []; // poliedros caindo
      this.flat = 0; // 0..1: quanto o mundo está "achatado" (a câmera 3D segue isso)
      this.taunts = ['Vocês vivem num desenho. Eu vivo no ESPAÇO.', 'Largura, altura... e PROFUNDIDADE!', 'Que gracinha: heróis de papel.', 'Cada aresta minha é uma lâmina.'];
      const clampX = (g, px, m) => TT.clamp(px, g.camX + m, g.camX + W - m);
      const clampY = (py) => TT.clamp(py, FT + 30, TT.FLOOR_BOTTOM - 20);
      const MIDY = (FT + TT.FLOOR_BOTTOM) / 2;
      this.ATK = {
        // 1. GRADE VETORIAL: duas linhas ao longo do chão e três colunas atravessando a profundidade
        grid: {
          pose: 'castUp', glow: NEON, s: 40, a: 18, r: 22, dmg: 14, knockdown: true, launch: 6, kb: 7, zoneHit: true, color: NEON, sound0: 'alarm', sound: 'laser',
          zone(f, g) {
            const p = g.targetFor(f) || f, zs = [];
            const ys = [clampY(p.y - 55), clampY(p.y + 55)];
            for (const y of ys) zs.push({ k: 'rect', x0: g.camX + 40, x1: g.camX + W - 40, y, d: 16, arrows: true, wall: 1 });
            const cols = [clampX(g, p.x - 260, 80), clampX(g, p.x, 80), clampX(g, p.x + 260, 80)];
            for (const x of cols) zs.push({ k: 'rect', x0: x - 18, x1: x + 18, y: MIDY, d: (TT.FLOOR_BOTTOM - FT) / 2, wall: 2 });
            return zs;
          },
          onFrame(f, t, g, a) {
            if (t === 2) g.say(f, 'GRADE VETORIAL! Escolham bem o quadrado de vocês.', '#c9fbff');
            if (t === this.s) { g.shake = Math.max(g.shake, 8); A().play('laser'); g.tintScreen(NEON, 10); }
            f.walls = a.zones && t >= this.s - 10 && t < this.s + this.a ? a.zones.map((z) => ({ z, k: t < this.s ? (t - this.s + 10) / 10 : 1, on: t >= this.s })) : [];
          },
        },
        // 2. CHUVA DE POLIEDROS: blocos e pirâmides caem do céu nos círculos marcados
        rain: {
          pose: 'castUp', s: 44, a: 8, r: 24, dmg: 15, knockdown: true, launch: 8, kb: 7, zoneHit: true, color: NEON2, sound0: 'alarm', sound: 'boom',
          zone(f, g) {
            const zs = [];
            for (const h of g.heroes()) zs.push({ k: 'ell', x: clampX(g, h.x, 60), y: clampY(h.y), rx: 78, ry: 34 });
            let guard = 0;
            while (zs.length < 6 && guard++ < 40) {
              const tx = clampX(g, f.x + TT.rand(-420, 420), 60), ty = clampY(f.y + TT.rand(-100, 100));
              if (zs.every((z) => Math.abs(z.x - tx) > 95 || Math.abs(z.y - ty) > 42)) zs.push({ k: 'ell', x: tx, y: ty, rx: 78, ry: 34 });
            }
            return zs;
          },
          onFrame(f, t, g, a) {
            if (t === 2) g.say(f, 'Chuva de poliedros! Sintam o peso do volume!', '#ffd0f2');
            if (!a.zones) return;
            if (t === 3) f.rocks = a.zones.map((z, i) => ({ x: z.x, y: z.y, h: 900 + i * 60, s: TT.rand(36, 50), kind: i % 2, rot: TT.rand(0, 6) }));
            for (const r of f.rocks) { r.h = Math.max(0, r.h - (t < this.s ? (r.h - 20) / Math.max(1, this.s - t) : 60)); r.rot += 0.12; }
            if (t === this.s) {
              A().play('boom'); g.shake = Math.max(g.shake, 10);
              for (const z of a.zones) { g.impact(z.x, z.y, 'TUNC!', NEON2, 0.9); for (let i = 0; i < 3; i++) g.addEffect(new CubePop(g, z.x + TT.rand(-40, 40), z.y + TT.rand(-10, 10), i * 2, 22)); }
            }
            if (t > this.s + 4) f.rocks = [];
          },
        },
        // 3. GIRO DE ARESTAS: quem chega perto leva um corte em volta dele
        spin: {
          pose: 'spin', s: 22, a: 12, r: 22, dmg: 13, knockdown: true, launch: 7, kb: 9, zoneHit: true, color: '#ffffff', sound0: 'whoosh',
          zone(f) { return [{ k: 'ell', x: f.x, y: f.y, rx: 175, ry: 68 }]; },
          onFrame(f, t, g) { if (t === this.s) { A().play('whoosh'); g.particles.spawn('ring', f.x, f.y, { size: 220, color: '#ffffff', life: 16, flat: 0.38 }); } },
        },
        // 4. DOBRA DIMENSIONAL (fase 2): achata o mundo, puxa todos para a linha do meio e corta rente ao chão
        fold: {
          pose: 'castUp', glow: NEON2, s: 70, a: 46, r: 30, dmg: 16, knockdown: true, launch: 9, kb: 8, zoneHit: true, zr: 46, color: NEON2, sound0: 'alarm', sound: 'super',
          zone(f, g) { return [{ k: 'rect', x0: g.camX + 30, x1: g.camX + W - 30, y: MIDY, d: 30, arrows: true, jump: true }]; },
          onFrame(f, t, g) {
            if (t === 2) { g.say(f, 'DOBRA DIMENSIONAL! De volta para o papel, heróis!', '#ffc8f0'); g.whiteFlash = 6; }
            // achata: a câmera volta a ser plana e todo mundo escorrega para a linha do meio
            f.flat = t < this.s ? Math.min(1, t / 30) : t < this.s + this.a ? 1 : Math.max(0, 1 - (t - this.s - this.a) / 26);
            if (t < this.s) for (const h of g.heroes()) h.y += (MIDY - h.y) * 0.05;
            if (t === this.s - 18) { g.popText(f.x, f.y - 300, 'PULE!', '#ffe14a', true); A().play('alarm'); }
            if (t === this.s) { A().play('laser'); g.shake = 14; g.tintScreen(NEON2, 18); }
            // lâmina de luz rente ao chão varrendo a arena (parede baixa: dá para pular)
            if (t >= this.s && t < this.s + this.a) {
              const sx = g.camX + 30 + ((t - this.s) / this.a) * (W - 60);
              f.walls = [{ z: { k: 'rect', wall: 1, x0: g.camX + 30, x1: sx, y: MIDY, d: 30 }, k: 0.32, on: true }];
            } else if (t === this.s + this.a) f.walls = [];
            if (t >= this.s && t < this.s + this.a && (t - this.s) % 6 === 0) {
              const x = g.camX + ((t - this.s) / this.a) * W;
              g.particles.spawn('spark', x, MIDY - 10, { vx: TT.rand(-3, 3), vy: TT.rand(-5, -1), color: TT.choice([NEON2, '#ffffff']), size: 4, life: 14, grav: 0.2 });
            }
            if (t === this.s + this.a + this.r - 1) f.unfold();
          },
        },
      };
      this.applyDifficulty();
    }
    get dmgTaken() { return this.openT > 0 ? 2 : 1; }
    onArmorHit(dmg, d) { if (this.state !== 'open') super.onArmorHit(dmg, d); }
    endAttack() { super.endAttack(); this.walls = []; this.rocks = []; this.flat = 0; }
    unfold() {
      this.atk = null; this.walls = []; this.flat = 0;
      this.setState('open'); this.setAnim('hurt');
      this.openT = this.phase2() ? 140 : 170; this.vx = this.vy = 0;
      this.game.say(this, 'O espaço... desdobrou rápido demais! Minhas arestas...!', '#e0f8ff');
      A().play('glass'); A().play('ko');
      this.game.whiteFlash = 8; this.game.shake = 12;
      this.game.impact(this.x, this.y, 'DESDOBRADO!', NEON, 1.1);
    }
    think() {
      if (this.state === 'dying') { this.walls = []; this.rocks = []; this.flat = 0; }
      if (this.commonBoss()) return;
      const g = this.game;
      if (this.state === 'open') {
        this.vx = this.vy = 0;
        if (--this.openT <= 0) {
          this.openT = 0; this.setState('idle'); this.setAnim('idle'); this.cool = 25;
          g.say(this, 'Recalculando os ângulos... pronto. Onde estávamos?', '#e0f8ff');
        }
        return;
      }
      if (this.state === 'down' || this.state === 'hurt') this.setState('idle');
      const p = g.targetFor(this);
      if (this.state === 'attack') { this.updateAttack(); return; }
      this.walls = []; this.rocks = []; this.flat = 0;
      if (!this.active || !p) { this.vx = this.vy = 0; this.setAnim('idle'); return; }
      const dx = p.x - this.x, dy = p.y - this.y, adx = Math.abs(dx);
      this.facing = dx > 0 ? 1 : -1;
      const p2 = this.phase2();
      if (p2 && !this.p2Said) {
        this.p2Said = true;
        g.say(this, 'Chega de brincar em três dimensões. Vamos ver como lutam em DUAS!', '#ffe9a0');
        g.impact(this.x, this.y, 'HIPERESPAÇO!', NEON2, 1.2);
      }
      this.dmgMul = p2 ? 1.15 : 1;
      if (this.cool > 0) this.cool--;
      this.approach(this.sideTarget(p, 210), p.y, p2 ? 2.8 : 2.2);
      if (this.cool <= 0) {
        this.vx = this.vy = 0;
        let pick;
        if (adx < 150 && Math.abs(dy) < 50 && Math.random() < 0.7) pick = 'spin';
        else if ((p2 && this.atkCount % 4 === 2) || (!p2 && this.atkCount === 5)) pick = 'fold';
        else pick = TT.choice(p2 ? ['grid', 'rain', 'grid', 'rain'] : ['grid', 'rain', 'grid']);
        this.atkCount++;
        this.startAttack(this.ATK[pick]);
        this.cool = p2 ? this.nextCool(34, 56) : this.nextCool(50, 84);
        if (pick !== 'fold' && Math.random() < 0.28) g.say(this, TT.choice(this.taunts), '#c9fbff');
      }
    }
    // Lasers e poliedros no modo 2D (no 3D, world3d desenha como sólidos de verdade)
    drawWalls2D(ctx, camX) {
      if (!this.walls.length) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const w of this.walls) {
        const z = w.z, a = w.on ? 0.9 : 0.25 + 0.3 * w.k;
        ctx.globalAlpha = a; ctx.fillStyle = w.on ? NEON : 'rgba(95,242,255,0.5)';
        if (z.wall === 1) ctx.fillRect(z.x0 - camX, z.y - 110 * w.k, z.x1 - z.x0, 110 * w.k);
        else ctx.fillRect(z.x0 - camX, z.y - z.d - 110 * w.k, z.x1 - z.x0, z.d * 2 + 110 * w.k);
      }
      ctx.restore();
    }
    drawRocks2D(ctx, camX) {
      for (const r of this.rocks) {
        const x = r.x - camX, y = r.y - r.h - r.s / 2;
        if (r.kind) drawSolid(ctx, TETRA, x, y, r.s * 0.6, r.rot, 0.5, [NEON2, VIOLET, NEON, '#ffffff'], false, '#ffffff');
        else isoCube(ctx, x, y, r.s, VIOLET, false, NEON);
      }
    }
    draw(ctx, camX) {
      const sx = this.x - camX, sy = this.y - this.z;
      if (!TT.SKIP_RIG) {
        this.drawWalls2D(ctx, camX);
        ctx.globalAlpha = this.alpha;
        TT.computePose(this, this.pose);
        if (this.state === 'open') { this.pose.lean = -0.3; this.pose.tilt = 0.4; this.pose.armF[0] = -0.4; }
        TT.drawRig(ctx, this.style, this.pose, sx + this.tellShake(), sy, this.facing, { flash: this.flash > 3 || this.tellFlash(), t: this.animT, out: this.out });
        ctx.globalAlpha = 1;
        this.drawRocks2D(ctx, camX);
      }
      if (this.state === 'open' && (this.animT >> 3) % 2 === 0) TT.drawText(ctx, 'DESDOBRADO!', sx, sy - this.height - 30, 26, NEON, OUT, 'center', 5);
      this.drawTell(ctx, sx, sy);
    }
  }
  TT.Vertice = Vertice;

  // ---------------------------------------------------------------- Cenário 2D (antes de virar 3D)
  // Avenida de Jump City ao entardecer: céu roxo e laranja, prédios com janelas acesas, lojas na calçada
  // e "falhas" geométricas no ar (cubos de arame) que ficam mais fortes perto do ponto em que o mundo vira 3D.
  TT.BG_EXTRA = TT.BG_EXTRA || {};
  TT.BG_EXTRA[13] = function () {
    const B = TT.BG, cells = B.cells, glowPool = B.glowPool;
    const glitch = (x) => TT.clamp((x - 600) / 1800, 0, 1); // intensidade das falhas pela posição
    function wireCube(g, x, y, s, a, col) {
      const d = s * 0.42, dy = d * 0.62;
      g.save(); g.globalAlpha = 0.85; g.strokeStyle = col; g.lineWidth = 2;
      g.translate(x, y); g.rotate(a);
      g.strokeRect(-s / 2, -s / 2, s, s); g.strokeRect(-s / 2 + d, -s / 2 - dy, s, s);
      for (const [px, py] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.beginPath(); g.moveTo(px * s / 2, py * s / 2); g.lineTo(px * s / 2 + d, py * s / 2 - dy); g.stroke(); }
      g.restore();
    }
    function far(g, x0, x1) {
      const sky = g.createLinearGradient(0, 0, 0, 470);
      sky.addColorStop(0, '#1a0f3c'); sky.addColorStop(0.45, '#5a2a78'); sky.addColorStop(0.78, '#e0607a'); sky.addColorStop(1, '#ffb070');
      g.fillStyle = sky; g.fillRect(x0, 0, x1 - x0, H);
      cells(x0, x1, 90, 1301, (cx, r) => { g.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.5) + ')'; g.fillRect(cx + r() * 90, r() * 170, 2, 2); });
      // sol se pondo atrás da cidade
      cells(x0, x1, 2400, 1303, (cx) => {
        glowPool(g, cx + 900, 330, 260, 200, '#ffd08a', 0.55);
        g.fillStyle = '#ffd890'; g.beginPath(); g.arc(cx + 900, 330, 70, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,120,140,0.5)'; for (let i = 0; i < 4; i++) g.fillRect(cx + 820, 318 + i * 14, 160, 4);
      });
      // silhueta da Torre Titã na baía, ao longe
      cells(x0, x1, 3000, 1305, (cx) => {
        const tx = cx + 1700;
        g.fillStyle = '#3a2350'; g.fillRect(tx - 14, 250, 28, 160); g.fillRect(tx - 70, 230, 140, 30); g.fillRect(tx - 70, 230, 26, 90);
        g.fillStyle = '#ffe9a0'; for (let i = 0; i < 6; i++) g.fillRect(tx - 60 + i * 22, 240, 8, 6);
      });
      // horizonte de prédios distantes
      cells(x0, x1, 70, 1307, (cx, r) => {
        const h = 90 + r() * 150, w = 50 + r() * 30;
        g.fillStyle = '#41245e'; g.fillRect(cx, 430 - h, w, h + 40);
        g.fillStyle = 'rgba(255,220,150,0.5)';
        for (let y = 440 - h; y < 420; y += 14) for (let x = cx + 6; x < cx + w - 6; x += 12) if (r() < 0.3) g.fillRect(x, y, 5, 6);
      });
    }
    function mid(g, x0, x1) {
      cells(x0, x1, 210, 1311, (cx, r) => {
        const h = 170 + r() * 190, w = 150 + r() * 40, top = 460 - h;
        const col = pick(r, ['#2c1d4a', '#352256', '#3d2a5e', '#2a2448']);
        g.fillStyle = col; g.strokeStyle = OUT; g.lineWidth = 3;
        g.fillRect(cx, top, w, h + 20); g.strokeRect(cx, top, w, h + 20);
        // luz do pôr do sol batendo de lado
        g.fillStyle = 'rgba(255,140,120,0.18)'; g.fillRect(cx + w - 26, top, 26, h + 20);
        for (let y = top + 16; y < 440; y += 30) for (let x = cx + 14; x < cx + w - 20; x += 28) {
          g.fillStyle = r() < 0.45 ? '#ffd98a' : '#1d1430'; g.fillRect(x, y, 14, 18);
        }
        if (r() < 0.4) { g.fillStyle = '#20162e'; g.fillRect(cx + w * 0.3, top - 40, 6, 40); g.fillStyle = '#ff4060'; g.fillRect(cx + w * 0.3 - 2, top - 44, 10, 6); }
      });
      // falhas: cubos de arame flutuando, cada vez mais perto do ponto de virada
      cells(x0, x1, 260, 1313, (cx, r) => {
        if (r() > 0.25 + glitch(cx) * 0.75) return;
        wireCube(g, cx + r() * 200, 80 + r() * 220, 22 + r() * 40, r() * 1.2, r() < 0.5 ? NEON : NEON2);
      });
    }
    function near(g, x0, x1) {
      // lojas da avenida
      cells(x0, x1, 420, 1321, (cx, r) => {
        const w = 380, top = 130 + r() * 50, base = FT - 8;
        const col = pick(r, ['#5a3a6e', '#6e3a4a', '#3a4a6e', '#4a5a3a']);
        g.fillStyle = col; g.strokeStyle = OUT; g.lineWidth = 4;
        g.fillRect(cx + 20, top, w, base - top); g.strokeRect(cx + 20, top, w, base - top);
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(cx + 20, top, w, 14);
        // janelas dos andares
        for (let y = top + 30; y < base - 190; y += 52) for (let x = cx + 50; x < cx + w - 10; x += 70) {
          g.fillStyle = r() < 0.5 ? '#ffe2a0' : '#2a1e3a'; g.fillRect(x, y, 34, 34); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(x, y, 34, 34);
        }
        // vitrine, toldo listrado e letreiro
        const sy = base - 150, names = ['PIZZARIA', 'FLIPERAMA', 'CAFÉ', 'GIBIS', 'TACOS', 'SORVETES'];
        g.fillStyle = '#1d2a44'; g.fillRect(cx + 50, sy + 40, w - 60, 110); g.strokeRect(cx + 50, sy + 40, w - 60, 110);
        g.fillStyle = 'rgba(120,220,255,0.25)'; g.fillRect(cx + 60, sy + 50, w - 80, 90);
        const aw = pick(r, ['#e0404a', '#2f9a3e', '#e0a020', '#3a6ad8']);
        for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#f5efe0' : aw; g.fillRect(cx + 40 + i * ((w - 30) / 10), sy + 10, (w - 30) / 10 + 1, 28); }
        g.strokeRect(cx + 40, sy + 10, w - 30, 28);
        TT.drawText(g, pick(r, names), cx + 20 + w / 2, sy - 10, 26, '#ffe14a', OUT, 'center', 5);
      });
      // postes de luz
      cells(x0, x1, 640, 1323, (cx) => {
        const px = cx + 300;
        g.fillStyle = '#2a2236'; g.fillRect(px - 5, 240, 10, FT - 236); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(px - 5, 240, 10, FT - 236);
        g.fillRect(px - 5, 236, 46, 8); g.fillStyle = '#ffe9a0'; g.fillRect(px + 28, 244, 18, 8);
        glowPool(g, px + 37, 252, 70, 60, '#ffe9a0', 0.5);
      });
      // calçada e avenida
      g.fillStyle = '#7a6f86'; g.fillRect(x0, FT - 8, x1 - x0, 56);
      g.strokeStyle = 'rgba(30,20,40,0.35)'; g.lineWidth = 2;
      for (let x = Math.floor(x0 / 48) * 48; x < x1; x += 48) { g.beginPath(); g.moveTo(x, FT - 8); g.lineTo(x - 10, FT + 48); g.stroke(); }
      g.fillStyle = '#4b4258'; g.fillRect(x0, FT + 44, x1 - x0, 8);
      const asp = g.createLinearGradient(0, FT + 52, 0, H);
      asp.addColorStop(0, '#3b3446'); asp.addColorStop(1, '#2a2434');
      g.fillStyle = asp; g.fillRect(x0, FT + 52, x1 - x0, H - FT - 52);
      g.fillStyle = '#ffd84a';
      for (let x = Math.floor(x0 / 120) * 120; x < x1; x += 120) g.fillRect(x, FT + 150, 64, 7);
      // rachaduras geométricas brilhando no asfalto perto da virada
      cells(x0, x1, 300, 1325, (cx, r) => {
        if (r() > glitch(cx)) return;
        const x = cx + r() * 220, y = FT + 70 + r() * 150;
        g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = r() < 0.5 ? NEON : NEON2; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 4; i++) g.lineTo(x + (i + 1) * 26 * (r() < 0.5 ? 1 : -0.6), y + (r() - 0.5) * 30); g.stroke();
        g.restore();
      });
    }
    const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
    return { layers: [new B.Layer(0.1, far, 50), new B.Layer(0.38, mid, 51), new B.Layer(1, near, 52)], id: 13 };
  };

  // Partículas do ar na parte 2D: quadradinhos de "falha" que piscam (mais fortes perto da virada).
  TT.ambient13 = function (ctx, camX, f) {
    const k = TT.clamp((camX - 400) / 1800, 0.15, 1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      if ((i * 7 + (f >> 3)) % 26 > 26 * k) continue;
      const x = (i * 211 + f * 0.6) % W, y = (i * 83 + Math.sin(f * 0.02 + i) * 50 + 600) % 470;
      ctx.strokeStyle = i % 2 ? 'rgba(95,242,255,0.6)' : 'rgba(255,95,210,0.6)'; ctx.lineWidth = 1.5;
      const s = 6 + (i % 4) * 4;
      ctx.strokeRect(x, y, s, s);
    }
    ctx.restore();
  };
})();
