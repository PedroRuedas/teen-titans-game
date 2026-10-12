'use strict';
// Rig de personagens em vetor no traço da série de 2003 (sombra chapada, contorno preto), formas animais e brilhos.
(function () {
  const TT = window.TT;
  const OUT = '#17121f';
  TT.OUT = OUT;
  TT.FONT = 'Impact, "Arial Black", "Segoe UI Black", sans-serif';

  let FLASH = false; // quando true, todo preenchimento vira branco (feedback de dano)
  let TOON = false;  // visual de desenho: sombra chapada em 2 tons, contorno grosso
  let BIGSHOES = false; // tênis grandes e redondos (em vez de bota pontuda)
  const C = (c) => (FLASH ? '#ffffff' : c);

  // ------------------------------------------------------------ Brilhos cacheados
  const glowCache = new Map();
  TT.glowSprite = function (color, size) {
    size = size || 64;
    const key = color + size;
    let c = glowCache.get(key);
    if (c) return c;
    c = TT.makeCanvas(size, size);
    const g = c.getContext('2d');
    const r = size / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    glowCache.set(key, c);
    return c;
  };
  TT.drawGlow = function (ctx, color, x, y, radius, alpha) {
    const s = TT.glowSprite(color, 64);
    const prevA = ctx.globalAlpha, prevC = ctx.globalCompositeOperation;
    ctx.globalAlpha = prevA * (alpha == null ? 1 : alpha);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(s, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = prevA;
    ctx.globalCompositeOperation = prevC;
  };

  // ------------------------------------------------------------ Desenho do rig (visual "PS2": volume sombreado e contorno fino)
  // Luz vinda da frente/cima, no espaço local do personagem (que sempre olha para +x).
  const LX = 0.55, LY = -0.83;
  const LINE = 'rgba(16,10,24,0.9)';
  TT.LINE = LINE;

  // Gradiente sombra -> base -> luz entre dois pontos (o ponto 1 é o lado iluminado).
  function shadedFill(ctx, col, x0, y0, x1, y1) {
    if (FLASH) { ctx.fillStyle = '#ffffff'; return; }
    if (TOON) { // sombra chapada: metade escura, metade na cor base
      const g = ctx.createLinearGradient(x0, y0, x1, y1), sh = TT.shade(col, -0.3);
      g.addColorStop(0, sh); g.addColorStop(0.42, sh); g.addColorStop(0.42, col); g.addColorStop(1, col);
      ctx.fillStyle = g; return;
    }
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, TT.shade(col, -0.48));
    g.addColorStop(0.4, col);
    g.addColorStop(0.78, TT.shade(col, 0.24));
    g.addColorStop(1, TT.shade(col, -0.05));
    ctx.fillStyle = g;
  }
  TT.shadedFill = shadedFill;

  // Segmento cônico (cápsula) sombreado como um cilindro.
  function seg(ctx, x1, y1, x2, y2, r1, r2, col, lw) {
    let dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 0.001;
    dx /= len; dy /= len;
    const nx = -dy, ny = dx, an = Math.atan2(ny, nx);
    ctx.beginPath();
    ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
    ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
    ctx.arc(x2, y2, r2, an, an - Math.PI, true);
    ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
    ctx.arc(x1, y1, r1, an + Math.PI, an, true);
    ctx.closePath();
    const s = nx * LX + ny * LY >= 0 ? 1 : -1, mx = (x1 + x2) / 2, my = (y1 + y2) / 2, r = Math.max(r1, r2);
    shadedFill(ctx, col, mx - nx * r * s, my - ny * r * s, mx + nx * r * s, my + ny * r * s);
    ctx.fill();
    if (lw !== 0) { ctx.strokeStyle = LINE; ctx.lineWidth = (lw || 1.8) * (TOON ? 1.55 : 1); ctx.stroke(); }
  }
  TT.seg = seg;

  // Punho fechado ou mão aberta, alinhado ao antebraço (ang = ângulo do antebraço).
  function hand(ctx, x, y, ang, R, col, mode) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-ang); // +y local = direção do antebraço
    if (mode === 'open') {
      for (let i = 0; i < 4; i++) { // dedos abertos em leque
        const a = -0.45 + i * 0.3, fx = Math.sin(a) * R * 1.55, fy = R * 0.6 + Math.cos(a) * R * 1.55;
        seg(ctx, Math.sin(a) * R * 0.55, R * 0.6 + Math.cos(a) * R * 0.55, fx, fy, R * 0.3, R * 0.24, col, 1.3);
      }
      ctx.beginPath(); ctx.ellipse(0, R * 0.55, R * 0.82, R * 0.78, 0, 0, Math.PI * 2);
      shadedFill(ctx, col, -R, R, R, 0); ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = 1.5; ctx.stroke();
      seg(ctx, R * 0.7, R * 0.3, R * 1.3, R * 0.9, R * 0.3, R * 0.24, col, 1.3); // polegar
    } else {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-R * 0.92, -R * 0.15, R * 1.84, R * 1.75, R * 0.7); else ctx.ellipse(0, R * 0.7, R * 0.92, R * 0.9, 0, 0, Math.PI * 2);
      shadedFill(ctx, col, -R, R * 1.4, R, 0); ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = TOON ? 2.4 : 1.5; ctx.stroke();
      if (!FLASH) { // nós dos dedos e polegar
        ctx.strokeStyle = TT.shade(col, -0.35); ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(-R * 0.6, R * 1.15); ctx.lineTo(R * 0.6, R * 1.15); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(R * 0.62, R * 0.55, R * 0.32, R * 0.55, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = TT.shade(col, 0.1); ctx.fill(); ctx.strokeStyle = LINE; ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Bota/pé: ponta para a frente, gira um pouco junto com a canela.
  function foot(ctx, x, y, ang, R, col, sole) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(TT.clamp(-ang * 0.8, -1.4, 0.9));
    if (TOON && BIGSHOES) {
      ctx.beginPath();
      ctx.moveTo(-R * 0.75, -R * 0.55);
      ctx.quadraticCurveTo(-R * 0.85, R * 0.55, -R * 0.4, R * 0.6);
      ctx.lineTo(R * 1.45, R * 0.6);
      ctx.quadraticCurveTo(R * 1.95, R * 0.55, R * 1.75, -R * 0.1);
      ctx.quadraticCurveTo(R * 1.4, -R * 0.75, R * 0.45, -R * 0.75);
      ctx.closePath();
      ctx.fillStyle = FLASH ? '#ffffff' : col; ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = 2.6; ctx.stroke();
      if (!FLASH) { ctx.fillStyle = sole || TT.shade(col, -0.5); ctx.fillRect(-R * 0.6, R * 0.32, R * 2.2, R * 0.26); }
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(-R * 0.62, -R * 0.95);
    ctx.lineTo(-R * 0.8, R * 0.45);
    ctx.lineTo(R * 1.65, R * 0.45);
    ctx.quadraticCurveTo(R * 2.05, R * 0.4, R * 1.85, -R * 0.15);
    ctx.quadraticCurveTo(R * 1.3, -R * 0.55, R * 0.55, -R * 0.95);
    ctx.closePath();
    shadedFill(ctx, col, 0, R * 0.5, R * 0.6, -R);
    ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = TOON ? 2.2 : 1.6; ctx.stroke();
    if (!FLASH) {
      ctx.fillStyle = sole || TT.shade(col, -0.5);
      ctx.fillRect(-R * 0.8, R * 0.22, R * 2.5, R * 0.26);
    }
    ctx.restore();
  }

  // Membro em 2 segmentos. o: split (0..2, onde começa luva/bota), sleeve {col,len}, stripe, band [{col,at,gem}], sole.
  function limb(ctx, ax, ay, a1, a2, L1, L2, w, c1, c2, endR, endC, isLeg, res, o, dark, mode) {
    const kx = ax + Math.sin(a1) * L1, ky = ay + Math.cos(a1) * L1;
    const ex = kx + Math.sin(a2) * L2, ey = ky + Math.cos(a2) * L2;
    const at = (u) => (u <= 1 ? [ax + (kx - ax) * u, ay + (ky - ay) * u] : [kx + (ex - kx) * (u - 1), ky + (ey - ky) * (u - 1)]);
    const sh = (c) => (dark ? TT.shade(c, -0.3) : c);
    // raios: músculo largo perto do tronco, afinando até o pulso/tornozelo
    const r0 = TOON ? w * (isLeg ? 0.6 : 0.56) : w * (isLeg ? 0.7 : 0.62), rk = TOON ? w * 0.46 : w * (isLeg ? 0.5 : 0.46), re = TOON ? w * 0.42 : w * (isLeg ? 0.38 : 0.4);
    const rad = (u) => (u <= 1 ? r0 + (rk - r0) * u : rk + (re - rk) * (u - 1));
    const col1 = sh(c1), col2 = sh(c2 || c1);
    const split = o && o.split != null ? o.split : 2;
    // segmentos (a parte depois de "split" é luva/bota)
    const part = (u0, u1, col, k) => {
      const [x0, y0] = at(u0), [x1, y1] = at(u1);
      seg(ctx, x0, y0, x1, y1, rad(u0) * k, rad(u1) * k, col);
    };
    if (split <= 0) { part(0, 1, col2, 1.06); part(1, 2, col2, 1.06); }
    else if (split < 1) { part(0, split, col1, 1); part(split, 1, col2, 1.06); part(1, 2, col2, 1.06); }
    else { part(0, 1, col1, 1); if (split < 2) { part(1, split, col1, 1); part(split, 2, col2, 1.07); } else part(1, 2, col1, 1); }
    if (split > 0 && split < 2 && c2 && c2 !== c1) { // punho/borda da luva ou bota
      const [px, py] = at(split), [qx, qy] = at(Math.min(2, split + 0.08));
      seg(ctx, px, py, qx, qy, rad(split) * 1.22, rad(split) * 1.18, TT.shade(col2, 0.08), 1.4);
    }
    if (o && o.stripe && !FLASH) {
      const sc2 = sh(o.stripe), lim = Math.min(split, 2);
      const [px, py] = at(Math.min(1, lim));
      seg(ctx, ax, ay, px, py, r0 * 0.36, rk * 0.36, sc2, 0);
      if (lim > 1) { const [qx, qy] = at(lim); seg(ctx, kx, ky, qx, qy, rk * 0.36, rad(lim) * 0.36, sc2, 0); }
    }
    if (o && o.sleeve) { // manga curta bufante
      const [sx2, sy2] = at(o.sleeve.len);
      seg(ctx, ax, ay, sx2, sy2, r0 * 1.32, rad(o.sleeve.len) * 1.3, sh(o.sleeve.col));
    }
    if (o && o.band) for (const b of o.band) {
      const bl = b.len || 0.09, [b0x, b0y] = at(b.at - bl), [b1x, b1y] = at(b.at + bl);
      { // faixa reta (sem pontas arredondadas, para não "vazar" além do comprimento)
        let ux = b1x - b0x, uy = b1y - b0y; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
        const rr = rad(b.at) * 1.08, nx = -uy * rr, ny = ux * rr;
        ctx.beginPath(); ctx.moveTo(b0x + nx, b0y + ny); ctx.lineTo(b1x + nx, b1y + ny); ctx.lineTo(b1x - nx, b1y - ny); ctx.lineTo(b0x - nx, b0y - ny); ctx.closePath();
        ctx.fillStyle = FLASH ? '#ffffff' : sh(b.col); ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = TOON ? 1.8 : 1.4; ctx.stroke();
      }
      if (b.gem && !FLASH) {
        const [gx, gy] = at(b.at);
        ctx.beginPath(); ctx.arc(gx, gy, Math.max(1.8, w * 0.22), 0, Math.PI * 2); ctx.fillStyle = sh(b.gem); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(gx - 0.8, gy - 1.4, 1.2, 1.2);
      }
    }
    if (isLeg) foot(ctx, ex, ey, a2, endR, sh(endC), o && o.sole ? sh(o.sole) : null);
    else hand(ctx, ex, ey, a2, endR, sh(endC), mode);
    if (res) { res.kx = kx; res.ky = ky; res.ex = ex; res.ey = ey; res.a = a2; }
  }

  function torsoPath(ctx, st) {
    const hw = st.hipW / 2, sw = st.shW / 2, ww = st.waistW / 2, th = st.torsoH, cb = st.chest || 0;
    ctx.beginPath();
    ctx.moveTo(-hw, 5);
    ctx.lineTo(hw, 5);
    ctx.quadraticCurveTo(hw + 1.5, -th * 0.16, ww, -th * 0.4);
    ctx.quadraticCurveTo(sw + 2 + cb, -th * 0.62, sw, -th * 0.88);
    ctx.quadraticCurveTo(sw - 1, -th - 2, sw - 8, -th - 2);
    ctx.lineTo(-sw + 8, -th - 2);
    ctx.quadraticCurveTo(-sw + 1, -th - 2, -sw, -th * 0.88);
    ctx.quadraticCurveTo(-sw - 2, -th * 0.62, -ww, -th * 0.4);
    ctx.quadraticCurveTo(-hw - 1.5, -th * 0.16, -hw, 5);
    ctx.closePath();
  }

  // Aura nas mãos (Ravena = energia negra, Estelar = energia verde) e círculo mágico à frente da palma.
  const AURA = {
    dark: { core: '#0c0716', rim: '#8a5cff', hi: '#efe4ff', glow: '#a77bff' },
    green: { core: '#d9ffe4', rim: '#22d66a', hi: '#ffffff', glow: '#5dff8a' },
  };
  TT.AURA = AURA;
  function handAura(ctx, h, kind, k, circ, t) {
    const A = AURA[kind]; if (!A || FLASH) return;
    const dx = Math.sin(h.a), dy = Math.cos(h.a);
    const hx = h.ex + dx * 5, hy = h.ey + dy * 5;
    TT.drawGlow(ctx, A.glow, hx, hy, 16 + 14 * k, 0.75 * k);
    // labaredas em volta da mão
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.3);
    for (let i = 0; i < 5; i++) {
      const a = t * 0.25 + i * 1.26, rr = 5 + 3 * Math.sin(t * 0.4 + i);
      ctx.beginPath(); ctx.ellipse(hx + Math.cos(a) * 4, hy + Math.sin(a) * 4 - 2, rr, rr * 1.5, a, 0, Math.PI * 2);
      ctx.fillStyle = kind === 'dark' ? 'rgba(12,7,22,0.55)' : 'rgba(120,255,160,0.35)'; ctx.fill();
    }
    ctx.restore();
    if (circ > 0.02) { // círculo mágico perpendicular ao antebraço
      const R = 6 + 30 * circ, cx = h.ex + dx * (12 + R * 0.25), cy = h.ey + dy * (12 + R * 0.25);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.atan2(dy, dx));
      ctx.globalAlpha = Math.min(1, circ * 1.6);
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.38, R, 0, 0, Math.PI * 2);
      ctx.fillStyle = kind === 'dark' ? 'rgba(10,5,20,0.88)' : 'rgba(80,255,140,0.28)'; ctx.fill();
      ctx.strokeStyle = A.rim; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = A.hi; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, R * 0.26, R * 0.68, 0, 0, Math.PI * 2);
      ctx.strokeStyle = A.rim; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = A.hi; ctx.lineWidth = 1.4; ctx.beginPath(); // runas girando
      for (let i = 0; i < 10; i++) {
        const a = t * 0.08 + i * 0.628, c = Math.cos(a), s = Math.sin(a);
        ctx.moveTo(c * R * 0.3, s * R * 0.8); ctx.lineTo(c * R * 0.35, s * R * 0.92);
      }
      ctx.stroke();
      ctx.restore();
      TT.drawGlow(ctx, A.glow, cx, cy, R * 1.3, 0.55 * circ);
    }
  }

  function drawStaff(ctx, h, a, ext) {
    const dx = Math.sin(a), dy = Math.cos(a);
    const b = 34 - 16 * ext, f = 34 + 18 * ext; // ext 0 = centrado (giro), 1 = estendido à frente
    const x1 = h.ex - dx * b, y1 = h.ey - dy * b, x2 = h.ex + dx * f, y2 = h.ey + dy * f;
    seg(ctx, x1, y1, x2, y2, 2.6, 2.6, FLASH ? '#ffffff' : '#c3cad6', 1.5);
    if (!FLASH) {
      seg(ctx, x2 - dx * 9, y2 - dy * 9, x2, y2, 3.1, 3.1, '#7d8594', 1.2);
      seg(ctx, x1, y1, x1 + dx * 9, y1 + dy * 9, 3.1, 3.1, '#7d8594', 1.2);
    }
  }

  // Bastão elétrico dos soldados da fase 3 (ponta ciano brilhante; mais forte ao atacar).
  function drawBaton(ctx, h, a, hot) {
    const dx = Math.sin(a), dy = Math.cos(a);
    const x1 = h.ex - dx * 8, y1 = h.ey - dy * 8, x2 = h.ex + dx * 40, y2 = h.ey + dy * 40;
    seg(ctx, x1, y1, x2, y2, 2.8, 2.6, FLASH ? '#ffffff' : '#5c6476', 1.5);
    seg(ctx, x2 - dx * 10, y2 - dy * 10, x2, y2, 3.2, 3.2, FLASH ? '#ffffff' : '#bff6ff', 1.2);
    if (!FLASH) TT.drawGlow(ctx, '#6fe3ff', x2, y2, hot ? 26 : 14, hot ? 1 : 0.7);
  }

  const handF = {}, handB = {};
  // Desenha um personagem humanoide com o estilo dado. opt: { flash, t, scale, out }
  // out (opcional) recebe posições em coordenadas do mundo: cabeça (hx, hy) e mão da frente (fx, fy).
  TT.drawRig = function (ctx, st, pose, x, y, facing, opt) {
    const sc = st.scale * (opt && opt.scale ? opt.scale : 1);
    FLASH = !!(opt && opt.flash);
    TOON = st.toon !== false; BIGSHOES = !!st.bigShoes;
    const t = opt && opt.t ? opt.t : 0;
    ctx.save();
    ctx.translate(x, y);
    const m0 = opt && opt.out ? ctx.getTransform() : null;
    ctx.scale(facing * sc, sc);
    if (pose.rot) { ctx.translate(0, -12); ctx.rotate(pose.rot); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const L1 = st.legL[0], L2 = st.legL[1];
    const Hx = 0, Hy = -(L1 + L2) + 4 + pose.bob;
    if (pose.spin) { // giro do corpo inteiro (mortais, rolamentos) em torno do centro de massa
      const py = Hy - st.torsoH * 0.35;
      ctx.translate(0, py); ctx.rotate(pose.spin); ctx.translate(0, -py);
    }
    if (pose.squash) { ctx.translate(0, Hy); ctx.scale(1 + pose.squash * 0.5, 1 - pose.squash); ctx.translate(0, -Hy); }
    const lean = pose.lean;
    const cl = Math.cos(lean), sl = Math.sin(lean);
    const rot = (px, py) => [Hx + px * cl - py * sl, Hy + px * sl + py * cl];
    const S = rot(0, -st.torsoH);
    const sF = rot(st.shW * 0.12, -st.torsoH + 6), sB = rot(-st.shW * 0.18, -st.torsoH + 5);
    const neck = st.neck || 4;
    const nk = rot(st.headOff || 0, -st.torsoH - 1);
    const hd = rot(st.headOff || 0, -st.torsoH - neck - st.headR * 0.85);
    const P = { Hx, Hy, S, hd, lean, pose, st, t, rot };
    // capa simulada (coordenadas do mundo -> locais do personagem); desligada em giros e quedas
    if (opt && opt.cape && !pose.rot && !pose.spin && !pose.squash) {
      P.cape = opt.cape.map((p) => [(p.x - opt.camX - x) * facing / sc, (p.y - y) / sc]);
    }

    if (st.drawBack) st.drawBack(ctx, P);

    const dk = st.dark;
    const pastel = (base, aura) => (aura > 0.25 ? (st.aura === 'dark' ? '#17102a' : '#b8ffcf') : base);
    // perna e braço de trás (tons escurecidos)
    limb(ctx, Hx - 3, Hy, pose.legB[0], pose.legB[1], L1, L2, st.legW, st.leg, st.boot, st.footR, st.boot, true, null, st.legOpt, true);
    const backArm = () => limb(ctx, sB[0], sB[1], pose.armB[0], pose.armB[1], st.armL[0], st.armL[1], st.armW, st.arm, pastel(st.glove, pose.auraB), st.handR,
      pastel(st.hand, pose.auraB), false, handB, st.armOpt, true, pose.handB);
    if (!st.backArmOver) backArm();

    // tronco com volume
    ctx.save();
    ctx.translate(Hx, Hy); ctx.rotate(lean);
    torsoPath(ctx, st);
    shadedFill(ctx, st.torso, -st.shW * 0.5, 0, st.shW * 0.45, -st.torsoH);
    ctx.fill();
    if (!FLASH && TOON) {
      ctx.save(); ctx.clip();
      if (st.torsoDetail) st.torsoDetail(ctx, P);
      ctx.fillStyle = 'rgba(25,10,45,0.24)'; // lado de trás na sombra
      ctx.beginPath(); ctx.moveTo(-st.shW, -st.torsoH - 4); ctx.lineTo(-st.shW * 0.12, -st.torsoH - 4); ctx.quadraticCurveTo(-st.shW * 0.3, -st.torsoH * 0.5, -st.hipW * 0.18, 8); ctx.lineTo(-st.shW, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (!FLASH) {
      ctx.save(); ctx.clip();
      if (st.torsoDetail) st.torsoDetail(ctx, P);
      // oclusão embaixo do peito e luz de contorno na frente
      const ao = ctx.createLinearGradient(0, -st.torsoH, 0, 6);
      ao.addColorStop(0, 'rgba(255,255,255,0.10)'); ao.addColorStop(0.5, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = ao; ctx.fillRect(-st.shW, -st.torsoH - 4, st.shW * 2, st.torsoH + 12);
      ctx.restore();
    }
    torsoPath(ctx, st);
    ctx.strokeStyle = LINE; ctx.lineWidth = TOON ? 2.4 : 2; ctx.stroke();
    ctx.restore();

    // perna da frente
    limb(ctx, Hx + 3, Hy, pose.legF[0], pose.legF[1], L1, L2, st.legW, st.leg, st.boot, st.footR, st.boot, true, null, st.legOpt);

    if (st.drawMid) st.drawMid(ctx, P);
    if (st.backArmOver) backArm();

    // pescoço e cabeça
    const nr = TOON ? st.headR * 0.24 : st.headR * 0.3;
    seg(ctx, nk[0], nk[1] + 2, hd[0] - 1, hd[1] + st.headR * 0.55, nr, nr * 0.93, st.neckCol || st.skin);
    ctx.save();
    ctx.translate(hd[0], hd[1]);
    ctx.rotate(lean * 0.4 + pose.tilt);
    st.drawHead(ctx, st.headR, pose, t);
    ctx.restore();

    // braço da frente + arma
    limb(ctx, sF[0], sF[1], pose.armF[0], pose.armF[1], st.armL[0], st.armL[1] + (pose.piston || 0) * 14, st.armW, st.arm, pastel(st.glove, pose.auraF), st.handR,
      pastel(st.hand, pose.auraF), false, handF, st.armOpt, false, pose.handF);
    if (pose.weapon === 'staff') drawStaff(ctx, handF, pose.armF[1] + pose.staff, pose.staffLen);
    else if (pose.weapon === 'baton' || st.baton) drawBaton(ctx, handF, pose.armF[1], pose.weapon === 'baton');
    if (st.drawFront) st.drawFront(ctx, P, handF, handB);
    if (st.aura) {
      if (pose.auraB > 0) handAura(ctx, handB, st.aura, pose.auraB, pose.circleB, t);
      if (pose.auraF > 0) handAura(ctx, handF, st.aura, pose.auraF, pose.circleF, t);
    }
    if (pose.glow && !FLASH) {
      TT.drawGlow(ctx, pose.glow, handF.ex, handF.ey, 26, 0.9);
      TT.drawGlow(ctx, pose.glow, handB.ex, handB.ey, 20, 0.7);
    }
    if (opt && opt.out) { // posições na tela relativas a (x, y) — para feixes saírem do lugar certo
      const m = ctx.getTransform(), k = TT.renderScale || 1;
      opt.out.hx = x + (m.a * hd[0] + m.c * hd[1] + m.e - m0.e) / k; opt.out.hy = y + (m.b * hd[0] + m.d * hd[1] + m.f - m0.f) / k;
      opt.out.fx = x + (m.a * handF.ex + m.c * handF.ey + m.e - m0.e) / k; opt.out.fy = y + (m.b * handF.ex + m.d * handF.ey + m.f - m0.f) / k;
      opt.out.hr = st.headR * sc;
    }
    ctx.restore();
    FLASH = false; TOON = false;
  };

  // ------------------------------------------------------------ Rostos
  function headCircle(ctx, r, skin) { // cabeça redonda sombreada (inimigos)
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    if (FLASH) ctx.fillStyle = '#ffffff';
    else if (TOON) ctx.fillStyle = skin;
    else {
      const g = ctx.createRadialGradient(r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
      g.addColorStop(0, TT.shade(skin, 0.28)); g.addColorStop(0.55, skin); g.addColorStop(1, TT.shade(skin, -0.35));
      ctx.fillStyle = g;
    }
    ctx.fill(); ctx.strokeStyle = LINE; ctx.lineWidth = TOON ? 3 : 2; ctx.stroke();
  }
  function eyes(ctx, r, pose, o) {
    if (FLASH) return;
    const shut = pose.eyes === 'shut', xx = pose.eyes === 'x';
    const pos = [[r * 0.12, -r * 0.08, 1], [r * 0.62, -r * 0.08, 0.8]];
    for (const [ex, ey, k] of pos) {
      const w = r * 0.24 * k * (o.wide || 1), h = r * 0.3 * (o.tall || 1);
      if (xx) {
        ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(ex - w, ey - w); ctx.lineTo(ex + w, ey + w); ctx.moveTo(ex + w, ey - w); ctx.lineTo(ex - w, ey + w); ctx.stroke();
        continue;
      }
      if (shut) {
        ctx.strokeStyle = OUT; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(ex - w, ey - 2); ctx.lineTo(ex + w * 0.2, ey + 2); ctx.lineTo(ex + w, ey - 2); ctx.stroke();
        continue;
      }
      ctx.beginPath(); ctx.ellipse(ex, ey, w, h, 0, 0, Math.PI * 2);
      ctx.fillStyle = o.white || '#ffffff'; ctx.fill();
      ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.stroke();
      if (o.iris) {
        ctx.beginPath(); ctx.ellipse(ex + w * 0.35, ey + h * 0.1, w * 0.55, h * 0.62, 0, 0, Math.PI * 2);
        ctx.fillStyle = o.iris; ctx.fill();
        ctx.beginPath(); ctx.arc(ex + w * 0.45, ey + h * 0.1, w * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = OUT; ctx.fill();
        ctx.beginPath(); ctx.arc(ex + w * 0.15, ey - h * 0.3, w * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff'; ctx.fill();
      }
      if (o.lid) {
        ctx.beginPath(); ctx.ellipse(ex, ey - h * 0.45, w * 1.15, h * 0.6, 0, Math.PI, Math.PI * 2);
        ctx.fillStyle = o.lid; ctx.fill();
      }
      if (o.brow) {
        ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(ex - w * 1.1, ey - h * 1.25 - (o.angry ? -2 : 0)); ctx.lineTo(ex + w * 1.1, ey - h * 1.25 + (o.angry ? 3 : 0)); ctx.stroke();
      }
    }
  }
  function mouth(ctx, r, pose, x, y, fang) {
    if (FLASH) return;
    x = x == null ? r * 0.45 : x; y = y == null ? r * 0.48 : y;
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.2;
    if (pose.mouth === 'shout' || pose.mouth === 'open') {
      ctx.beginPath(); ctx.ellipse(x, y + 1, r * 0.17, r * 0.15, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#5a1020'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.09, r * 0.09, r * 0.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#e0607a'; ctx.fill();
    } else if (pose.mouth === 'smile') {
      ctx.beginPath(); ctx.arc(x - 1, y - 3, r * 0.2, 0.2, Math.PI - 0.4); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(x - r * 0.14, y); ctx.quadraticCurveTo(x, y + 3, x + r * 0.14, y - 1); ctx.stroke();
    }
    if (fang) {
      ctx.beginPath(); ctx.moveTo(x - 1, y + 1); ctx.lineTo(x + 3, y + 1); ctx.lineTo(x + 1, y + 6); ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
    }
  }
  TT.drawEyes = eyes;
  TT.drawMouth = mouth;

  function spikyCap(ctx, r, color, spikes) {
    ctx.beginPath();
    ctx.moveTo(r * 0.95, -r * 0.35);
    for (const [px, py] of spikes) ctx.lineTo(px * r, py * r);
    ctx.lineTo(-r * 0.75, r * 0.45);
    ctx.quadraticCurveTo(-r * 0.2, -r * 0.1, r * 0.2, -r * 0.42);
    ctx.closePath();
    ctx.fillStyle = C(color); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  }

  // ------------------------------------------------------------ Estilos
  function mkStyle(o) {
    const st = Object.assign({
      scale: 1, headR: 22, torsoH: 36, shW: 30, hipW: 24, legL: [24, 24], armL: [18, 17],
      legW: 9, armW: 8, handR: 5.5, footR: 6.5,
      skin: '#f6c9a0', torso: '#888', arm: '#888', glove: null, hand: '#f6c9a0', leg: '#555', boot: '#222',
    }, o);
    st.glove = st.glove || st.arm;
    if (st.waistW == null) st.waistW = st.hipW * 0.9;
    if (st.neck == null) st.neck = 3;
    st.dark = {
      leg: TT.shade(st.leg, -0.28), boot: TT.shade(st.boot, -0.28), arm: TT.shade(st.arm, -0.28),
      glove: TT.shade(st.glove, -0.28), hand: TT.shade(st.hand, -0.28),
    };
    return st;
  }

  const S = {};
  TT.STYLES = S;

  // ------------------------------------------------------------ Titãs (visual da série animada de 2003 / jogo de PS2)
  // Traço anime: corpos esguios, rosto de queixo fino, contorno preto e sombra chapada em 2 tons.
  const INK = '#120d18', TAU2 = Math.PI * 2;
  function ink(ctx, col, lw) {
    ctx.fillStyle = FLASH ? '#ffffff' : col; ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = lw || 2.4; ctx.stroke();
  }
  function poly(ctx, r, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0] * r, pts[0][1] * r);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * r, pts[i][1] * r);
    ctx.closePath();
  }
  function cloth(ctx, path, col, x0, y0, x1, y1) { path(); shadedFill(ctx, col, x0, y0, x1, y1); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke(); }
  const ANIME = { neck: 4 };

  // ---- Robin: túnica vermelha de manga curta, braços e calça verdes, botas pretas, capa preta/amarela
  S.robin = mkStyle(Object.assign({}, ANIME, {
    headR: 16, torsoH: 34, shW: 30, waistW: 20, hipW: 22, chest: 2, legL: [29, 28], armL: [21, 20], legW: 10, armW: 8, handR: 5.6, footR: 7.4,
    skin: '#f4c39e', torso: '#d1202a', arm: '#2f9a3e', glove: '#24812f', hand: '#24812f', leg: '#2f9a3e', boot: '#17171d',
    armOpt: { split: 1.45, sleeve: { col: '#d1202a', len: 0.5 } },
    legOpt: { split: 1.35, sole: '#9aa3b2' },
    capeSim: true,
    drawBack(ctx, P) {
      const [sx, sy] = P.S;
      if (P.cape) { // capa com física: fita que alarga até a ponta; preta por fora, forro amarelo aparecendo
        const pts = P.cape.slice(); pts[0] = [sx + 2, sy - 2];
        const n = pts.length, L = [], R = [];
        for (let i = 0; i < n; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
          let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          const w = 7 + 13 * (i / (n - 1));
          L.push([pts[i][0] - ty * w, pts[i][1] + tx * w]); R.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
        }
        const ribbon = (A, B, k) => {
          ctx.beginPath(); ctx.moveTo(A[0][0], A[0][1]);
          for (let i = 1; i < n; i++) ctx.lineTo(A[i][0], A[i][1]);
          for (let i = n - 1; i >= 0; i--) ctx.lineTo(B[i][0] + (pts[i][0] - B[i][0]) * k, B[i][1] + (pts[i][1] - B[i][1]) * k);
          ctx.closePath();
        };
        ribbon(L, R, 0); ink(ctx, '#efb81e', 2.2);
        ribbon(L, R, 0.35); ink(ctx, '#1c1b22', 2.2);
        if (!FLASH) { ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pts[1][0], pts[1][1]); for (let i = 2; i < n - 1; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
        return;
      }
      const fl = P.pose.cape, wv = Math.sin(P.t * 0.12) * 2.5;
      const tx = sx - 24 - fl * 40, ty = P.Hy + 38 - fl * 32 + wv;
      cloth(ctx, () => { ctx.beginPath(); ctx.moveTo(sx + 8, sy - 3); ctx.quadraticCurveTo(sx - 28, sy + 12, tx - 6, ty + 5); ctx.lineTo(tx + 24, ty + 13); ctx.quadraticCurveTo(sx - 2, sy + 36, sx + 7, sy + 5); ctx.closePath(); },
        '#efb81e', tx, ty, sx, sy);
      cloth(ctx, () => { ctx.beginPath(); ctx.moveTo(sx + 6, sy - 4); ctx.quadraticCurveTo(sx - 36, sy + 4, tx - 12, ty); ctx.lineTo(tx + 10, ty + 8); ctx.quadraticCurveTo(sx - 14, sy + 26, sx, sy + 6); ctx.closePath(); },
        '#1c1b22', tx, ty, sx + 6, sy - 6);
    },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.strokeStyle = '#7d0d14'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(3, -th); ctx.lineTo(1, -10); ctx.stroke(); // fecho
      ctx.fillStyle = '#17171d'; ctx.fillRect(-14, -th - 3, 26, 5); // gola alta da capa
      ctx.fillStyle = '#f2c21c'; ctx.fillRect(-15, -9, 30, 8); // cinto de utilidades
      ctx.fillStyle = '#b88c0e'; for (let i = -10; i <= 10; i += 5) ctx.fillRect(i - 1.8, -8, 3.6, 6);
      ctx.beginPath(); ctx.arc(7, -th + 11, 4.8, 0, TAU2); ctx.fillStyle = '#f2c21c'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke(); // emblema R
      ctx.fillStyle = INK; ctx.font = 'bold 7px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('R', 7, -th + 11.5);
    },
    drawHead(ctx, r, pose) { TT.drawFace(ctx, 'robin', r, pose, FLASH); },
  }));

  // ---- Estelar: alta, pele laranja, cabelo vermelho longo, olhos totalmente verdes, roupa roxa e botas até a coxa
  S.starfire = mkStyle(Object.assign({}, ANIME, {
    headR: 15.5, torsoH: 33, shW: 26, waistW: 15, hipW: 21, chest: 3, legL: [36, 35], armL: [21, 20], legW: 9, armW: 6.6, handR: 5.2, footR: 7, airIdle: true, aura: 'green',
    skin: '#f2a14a', torso: '#7a2bb5', arm: '#f2a14a', glove: '#f2a14a', hand: '#f2a14a', leg: '#f2a14a', boot: '#7a2bb5',
    armOpt: { band: [{ col: '#c9cfd8', at: 1.62, len: 0.16, gem: '#3ee07a' }] },
    legOpt: { split: 0.55, sole: '#4c1678' },
    portraitBack(g) { g.beginPath(); g.moveTo(12, -22); g.quadraticCurveTo(-42, -30, -34, 36); g.lineTo(2, 34); g.closePath(); g.fillStyle = '#b81f2b'; g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke(); },
    drawBack(ctx, P) { // cabelo vermelho, liso e muito longo
      const [hx, hy] = P.hd, r = P.st.headR, fl = 0.3 + P.pose.cape * 0.7, wv = Math.sin(P.t * 0.12) * 3, bot = P.Hy + 30;
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(hx + r * 0.7, hy - r * 0.95);
        ctx.quadraticCurveTo(hx - r * 1.55, hy - r * 1.35, hx - r * 1.3 - fl * 12, hy + r * 1.2);
        ctx.quadraticCurveTo(hx - r * 1.3 - fl * 30, (hy + bot) / 2 + wv, hx - r * 1.1 - fl * 42, bot + wv);
        ctx.lineTo(hx - r * 0.2 - fl * 30, bot - 4 + wv);
        ctx.quadraticCurveTo(hx - r * 0.1 - fl * 12, hy + r * 2, hx + r * 0.1, hy + r * 0.4);
        ctx.closePath();
      };
      cloth(ctx, path, '#b81f2b', hx - r - fl * 40, bot, hx + r * 0.5, hy - r);
      if (!FLASH) { ctx.strokeStyle = 'rgba(255,110,100,0.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(hx - r * 0.7, hy - r * 0.3); ctx.quadraticCurveTo(hx - r * 1.2 - fl * 18, hy + r * 1.6, hx - r * 0.85 - fl * 34, bot - 8 + wv); ctx.stroke(); }
    },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.fillStyle = '#f2a14a'; ctx.fillRect(-18, -th * 0.55, 36, th * 0.45); // barriga à mostra (top curto)
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-18, -th * 0.55); ctx.quadraticCurveTo(0, -th * 0.48, 18, -th * 0.55); ctx.stroke();
      ctx.fillStyle = '#c9cfd8'; ctx.beginPath(); ctx.ellipse(1, -th + 1, 11, 5, 0, 0, TAU2); ctx.fill(); ctx.stroke(); // colar prateado
      ctx.beginPath(); ctx.arc(3, -th + 3, 3, 0, TAU2); ctx.fillStyle = '#3ee07a'; ctx.fill(); ctx.lineWidth = 1; ctx.stroke();
    },
    drawMid(ctx, P) { // minissaia roxa
      ctx.save(); ctx.translate(P.Hx, P.Hy); ctx.rotate(P.lean * 0.6);
      ctx.beginPath(); ctx.moveTo(-11, -5); ctx.lineTo(12, -5); ctx.lineTo(16, 9); ctx.lineTo(-15, 9); ctx.closePath();
      ink(ctx, '#7a2bb5', 2);
      ctx.restore();
    },
    drawHead(ctx, r, pose) { TT.drawFace(ctx, 'starfire', r, pose, FLASH); },
  }));

  // ---- Mutano: pele verde, orelhas pontudas, uniforme preto e roxo, luvas e botas cinza
  S.beastboy = mkStyle(Object.assign({}, ANIME, {
    scale: 0.92, headR: 15.5, torsoH: 28, shW: 25, waistW: 18, hipW: 20, legL: [24, 23], armL: [18, 17], legW: 9.4, armW: 7.4, handR: 6.4, footR: 8.4,
    skin: '#7cc444', torso: '#5a3496', arm: '#1d1a24', glove: '#a2a8b2', hand: '#a2a8b2', leg: '#1d1a24', boot: '#a2a8b2',
    armOpt: { split: 1.4, stripe: '#5a3496' },
    legOpt: { split: 1.4, stripe: '#5a3496', sole: '#5e646e' },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.fillStyle = '#1d1a24'; ctx.fillRect(-16, -th, 8, th); ctx.fillRect(8, -th, 8, th); // laterais pretas
      ctx.fillStyle = '#b6bcc5'; ctx.fillRect(-15, -8, 30, 6); // cinto prata
      ctx.fillStyle = '#7cc444'; ctx.fillRect(-4, -th - 3, 8, 4);
    },
    drawHead(ctx, r, pose) { TT.drawFace(ctx, 'beastboy', r, pose, FLASH); },
  }));

  // ---- Ciborgue: grande, metal claro com placas azuis, juntas escuras, meio rosto humano e olho vermelho
  S.cyborg = mkStyle(Object.assign({}, ANIME, {
    scale: 1.08, headR: 16, neck: 3, torsoH: 46, shW: 52, waistW: 30, hipW: 32, chest: 5, legL: [33, 31], armL: [25, 24], legW: 15, armW: 14, handR: 9, footR: 10,
    skin: '#6e4329', neckCol: '#40434d', torso: '#d3d9e2', arm: '#d3d9e2', glove: '#d3d9e2', hand: '#c3cad4', leg: '#d3d9e2', boot: '#b9c0ca',
    armOpt: { split: 1.78, band: [{ col: '#3a3d47', at: 1.0, len: 0.08 }, { col: '#3b78d8', at: 0.55, len: 0.1 }, { col: '#3b78d8', at: 1.45, len: 0.12 }] },
    legOpt: { split: 1.76, band: [{ col: '#3a3d47', at: 1.0, len: 0.08 }, { col: '#3b78d8', at: 0.5, len: 0.1 }, { col: '#3b78d8', at: 1.4, len: 0.1 }], sole: '#3a3d47' },
    drawBack(ctx, P) { // ombro de trás
      const [x, y] = P.rot(-P.st.shW * 0.32, -P.st.torsoH + 6);
      ctx.beginPath(); ctx.ellipse(x, y, 11, 10, 0, 0, TAU2); ink(ctx, '#aab1bc');
    },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.fillStyle = '#3b78d8'; // placa peitoral azul
      ctx.beginPath(); ctx.moveTo(-15, -th + 4); ctx.lineTo(19, -th + 4); ctx.lineTo(15, -th + 24); ctx.lineTo(1, -th + 30); ctx.lineTo(-12, -th + 24); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.fillStyle = '#3a3d47'; ctx.fillRect(-11, -th + 32, 23, th - 39); // abdômen escuro segmentado
      ctx.fillStyle = '#7a808c'; ctx.fillRect(-9, -th + 35, 19, 2); ctx.fillRect(-9, -th + 39, 19, 2);
      ctx.beginPath(); ctx.arc(2, -th + 14, 3.8, 0, TAU2); ctx.fillStyle = '#ff3b3b'; ctx.fill(); // luz vermelha no peito
      TT.drawGlow(ctx, '#ff2a2a', 2, -th + 14, 10, 0.8);
      ctx.fillStyle = '#3a3d47'; ctx.fillRect(-16, -7, 32, 7); // cintura
    },
    drawMid(ctx, P) { // ombro da frente (por baixo do braço) com placa azul
      const [x, y] = P.rot(P.st.shW * 0.24, -P.st.torsoH + 6);
      ctx.beginPath(); ctx.ellipse(x, y, 12, 10.5, 0, 0, TAU2); ink(ctx, '#d3d9e2');
      if (!FLASH) { ctx.beginPath(); ctx.ellipse(x + 1, y + 1, 6.5, 5, 0, 0, TAU2); ctx.fillStyle = '#3b78d8'; ctx.fill(); }
    },
    drawFront(ctx, P, hF) { // canhão sônico saindo do braço
      if (P.pose.form !== 'cannon') return;
      const a = P.pose.armF[1], dx = Math.sin(a), dy = Math.cos(a);
      seg(ctx, hF.ex - dx * 14, hF.ey - dy * 14, hF.ex + dx * 13, hF.ey + dy * 13, 10, 9, FLASH ? '#ffffff' : '#9aa2ae', 1.8);
      seg(ctx, hF.ex - dx * 5, hF.ey - dy * 5, hF.ex + dx * 2, hF.ey + dy * 2, 10.5, 10.5, FLASH ? '#ffffff' : '#3b78d8', 1.4);
      if (!FLASH) {
        ctx.beginPath(); ctx.arc(hF.ex + dx * 14, hF.ey + dy * 14, 6.5, 0, TAU2); ctx.fillStyle = '#bfe6ff'; ctx.fill();
        TT.drawGlow(ctx, '#4fb4ff', hF.ex + dx * 17, hF.ey + dy * 17, 26, 1);
      }
    },
    drawHead(ctx, r, pose) { TT.drawFace(ctx, 'cyborg', r, pose, FLASH); },
  }));

  // ---- Ravena: pele cinza, manto azul com capuz, collant preto, pernas à mostra, cinto de discos dourados
  S.raven = mkStyle(Object.assign({}, ANIME, {
    scale: 0.96, headR: 15, torsoH: 32, shW: 25, waistW: 16, hipW: 21, chest: 2, legL: [30, 29], armL: [19, 18], legW: 9, armW: 6.6, handR: 5.2, footR: 6.8, aura: 'dark',
    skin: '#c9c3d7', torso: '#17162b', arm: '#17162b', glove: '#17162b', hand: '#c9c3d7', leg: '#c9c3d7', boot: '#232c7c',
    legOpt: { split: 1.6, sole: '#141a50' },
    drawBack(ctx, P) { // manto azul longo + capuz levantado
      const [sx, sy] = P.S, fl = P.pose.cape, wv = Math.sin(P.t * 0.1) * 3;
      cloth(ctx, () => {
        ctx.beginPath(); ctx.moveTo(sx + 12, sy - 6);
        ctx.quadraticCurveTo(sx + 28, sy + 44, sx + 18 - fl * 8, -2 + wv);
        ctx.quadraticCurveTo(sx - 12 - fl * 20, 6 - fl * 10 + wv, sx - 40 - fl * 42, -2 - fl * 22 + wv);
        ctx.quadraticCurveTo(sx - 30 - fl * 12, sy + 20, sx - 10, sy - 8); ctx.closePath();
      }, '#2a3a9e', sx - 40, 0, sx + 20, sy);
      if (!FLASH) {
        ctx.strokeStyle = '#17206a'; ctx.lineWidth = 1.6; // dobras
        ctx.beginPath(); ctx.moveTo(sx - 6, sy + 8); ctx.quadraticCurveTo(sx - 18 - fl * 10, sy + 32, sx - 24 - fl * 30, -2 + wv);
        ctx.moveTo(sx + 8, sy + 10); ctx.quadraticCurveTo(sx + 12, sy + 40, sx + 4, -2 + wv); ctx.stroke();
      }
    },
    torsoDetail(ctx) {
      for (let i = -10; i <= 10; i += 6.6) { // cinto de discos dourados com gemas vermelhas
        ctx.beginPath(); ctx.arc(i, -5, 3, 0, TAU2); ctx.fillStyle = '#e2b23c'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.stroke();
        ctx.beginPath(); ctx.arc(i, -5, 1.3, 0, TAU2); ctx.fillStyle = '#d61f3a'; ctx.fill();
      }
    },
    drawMid(ctx, P) { // manto sobre os ombros e broche
      const [sx, sy] = P.S;
      ctx.beginPath(); ctx.moveTo(sx - 13, sy + 2); ctx.quadraticCurveTo(sx, sy - 8, sx + 13, sy + 2); ctx.quadraticCurveTo(sx + 12, sy + 9, sx + 6, sy + 8); ctx.quadraticCurveTo(sx, sy + 3, sx - 6, sy + 8); ctx.quadraticCurveTo(sx - 12, sy + 9, sx - 13, sy + 2); ctx.closePath();
      ink(ctx, '#2a3a9e', 1.8);
      ctx.beginPath(); ctx.arc(sx + 3, sy + 3, 3.4, 0, TAU2); ink(ctx, '#e2b23c', 1.1);
      if (!FLASH) { ctx.beginPath(); ctx.arc(sx + 3, sy + 3, 1.6, 0, TAU2); ctx.fillStyle = '#d61f3a'; ctx.fill(); }
    },
    drawHead(ctx, r, pose) { TT.drawFace(ctx, 'raven', r, pose, FLASH); },
  }));

  // ---- Inimigos
  S.hive = mkStyle({
    skin: '#e8b98f', torso: '#7d8897', arm: '#7d8897', glove: '#2b2f38', hand: '#2b2f38', leg: '#6b7584', boot: '#2b2f38',
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.fillStyle = '#f0c62e'; ctx.fillRect(-20, -9, 40, 6);
      ctx.beginPath(); ctx.moveTo(0, -th + 6); ctx.lineTo(8, -th + 11); ctx.lineTo(8, -th + 20); ctx.lineTo(0, -th + 25); ctx.lineTo(-8, -th + 20); ctx.lineTo(-8, -th + 11); ctx.closePath();
      ctx.fillStyle = '#f0c62e'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = OUT; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', 0, -th + 16);
    },
    drawHead(ctx, r, pose) {
      headCircle(ctx, r, '#e8b98f');
      ctx.beginPath(); // capacete
      ctx.arc(0, -r * 0.05, r * 1.06, Math.PI * 0.82, Math.PI * 2.05);
      ctx.closePath();
      ctx.fillStyle = C('#5d6676'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      if (!FLASH) {
        ctx.beginPath(); // visor
        ctx.moveTo(-r * 0.1, -r * 0.35); ctx.lineTo(r * 1.04, -r * 0.3); ctx.lineTo(r * 0.98, r * 0.12); ctx.lineTo(-r * 0.05, r * 0.1); ctx.closePath();
        ctx.fillStyle = '#ffd23a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(r * 0.1, -r * 0.25, r * 0.5, r * 0.08);
      }
      mouth(ctx, r, pose, r * 0.5, r * 0.55);
    },
  });

  // Soldado elétrico da H.I.V.E. (fase 3): uniforme escuro, visor ciano e bastão elétrico.
  S.hiveShock = mkStyle({
    skin: '#e8b98f', torso: '#3a3f50', arm: '#3a3f50', glove: '#f2c12e', hand: '#f2c12e', leg: '#2e3342', boot: '#1c1c22', baton: true,
    legOpt: { sole: '#6fe3ff' },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.fillStyle = '#f2c12e'; ctx.fillRect(-20, -9, 40, 6);
      ctx.fillStyle = '#6fe3ff'; ctx.fillRect(-20, -th + 4, 40, 3);
      ctx.beginPath(); ctx.moveTo(-2, -th + 8); ctx.lineTo(6, -th + 8); ctx.lineTo(1, -th + 16); ctx.lineTo(7, -th + 16); ctx.lineTo(-4, -th + 28); ctx.lineTo(0, -th + 19); ctx.lineTo(-5, -th + 19); ctx.closePath();
      ctx.fillStyle = '#f2c12e'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.stroke();
    },
    drawHead(ctx, r, pose) {
      headCircle(ctx, r, '#e8b98f');
      ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 1.06, Math.PI * 0.82, Math.PI * 2.05); ctx.closePath();
      ctx.fillStyle = C('#2a2e3a'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      if (!FLASH) {
        ctx.fillStyle = '#f2c12e'; ctx.fillRect(-r * 0.7, -r * 0.95, r * 0.4, r * 0.3); // antena de cobre
        ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.35); ctx.lineTo(r * 1.04, -r * 0.3); ctx.lineTo(r * 0.98, r * 0.12); ctx.lineTo(-r * 0.05, r * 0.1); ctx.closePath();
        ctx.fillStyle = '#6fe3ff'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(r * 0.1, -r * 0.25, r * 0.5, r * 0.08);
      }
      mouth(ctx, r, pose, r * 0.5, r * 0.55);
    },
  });

  // Abelha H.I.V.E. (fase 2): uniforme listrado amarelo e preto, capacete de abelha com antenas e asas.
  S.hiveBee = mkStyle({
    skin: '#e8b98f', torso: '#f2c12e', arm: '#1e1e24', glove: '#f2c12e', hand: '#f2c12e', leg: '#1e1e24', boot: '#f2c12e',
    drawBack(ctx, P) { // asas translúcidas batendo
      const [x, y] = P.rot(-P.st.shW * 0.3, -P.st.torsoH + 8), f = Math.sin((P.t || 0) * 1.6) * 0.35;
      ctx.save(); ctx.translate(x, y);
      for (const [a, l] of [[-2.2 + f, 34], [-2.7 + f * 0.8, 26]]) {
        ctx.save(); ctx.rotate(a);
        ctx.beginPath(); ctx.ellipse(l * 0.5, 0, l * 0.55, l * 0.22, 0, 0, TAU2);
        ctx.fillStyle = FLASH ? '#ffffff' : 'rgba(210,240,255,0.55)'; ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.fillStyle = '#1e1e24';
      for (let y = -th + 12; y < -2; y += 11) ctx.fillRect(-24, y, 48, 5); // listras
      ctx.beginPath(); ctx.moveTo(0, -th + 2); ctx.lineTo(7, -th + 6); ctx.lineTo(7, -th + 13); ctx.lineTo(0, -th + 17); ctx.lineTo(-7, -th + 13); ctx.lineTo(-7, -th + 6); ctx.closePath();
      ctx.fillStyle = '#1e1e24'; ctx.fill();
      ctx.fillStyle = '#f2c12e'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', 0, -th + 10);
    },
    drawHead(ctx, r, pose) {
      headCircle(ctx, r, '#e8b98f');
      ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 1.08, Math.PI * 0.8, Math.PI * 2.08); ctx.closePath();
      ctx.fillStyle = C('#f2c12e'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      if (!FLASH) {
        ctx.fillStyle = '#1e1e24'; ctx.fillRect(-r * 0.9, -r * 0.7, r * 1.6, r * 0.22);
        // antenas
        ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(r * 0.1, -r * 1.0); ctx.quadraticCurveTo(r * 0.3, -r * 1.7, r * 0.75, -r * 1.75);
        ctx.moveTo(-r * 0.3, -r * 1.0); ctx.quadraticCurveTo(-r * 0.3, -r * 1.75, r * 0.05, -r * 1.9); ctx.stroke();
        ctx.fillStyle = '#1e1e24'; ctx.beginPath(); ctx.arc(r * 0.75, -r * 1.75, 3.5, 0, TAU2); ctx.arc(r * 0.05, -r * 1.9, 3.5, 0, TAU2); ctx.fill();
        // olhos compostos grandes (visor)
        ctx.beginPath(); ctx.ellipse(r * 0.55, -r * 0.08, r * 0.48, r * 0.36, -0.1, 0, TAU2);
        ctx.fillStyle = '#c0301e'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(r * 0.45, -r * 0.2, r * 0.16, r * 0.08, -0.3, 0, TAU2); ctx.fill();
      }
      mouth(ctx, r, pose, r * 0.5, r * 0.6);
    },
  });

  // Soldado da fábrica química (fase 4): roupa anti-contaminação amarela, máscara de gás e tanque nas costas.
  S.hazmat = mkStyle({
    skin: '#e8b98f', torso: '#e6c43a', arm: '#e6c43a', glove: '#2f3a2e', hand: '#2f3a2e', leg: '#d9b632', boot: '#2f3a2e',
    shW: 32, hipW: 25,
    drawBack(ctx, P) { // tanque de gosma nas costas
      const [x, y] = P.rot(-P.st.shW * 0.55, -P.st.torsoH * 0.55);
      ctx.save(); ctx.translate(x, y); ctx.rotate(P.lean || 0);
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-10, -18, 20, 36, 8) : ctx.rect(-10, -18, 20, 36);
      ctx.fillStyle = C('#6c7a86'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
      if (!FLASH) { ctx.fillStyle = '#e06ab8'; ctx.fillRect(-5, -6, 10, 18); ctx.strokeRect(-5, -6, 10, 18); }
      ctx.restore();
    },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.fillStyle = '#2f3a2e'; ctx.fillRect(-22, -9, 44, 6);
      ctx.fillStyle = '#c99f22'; ctx.fillRect(-2, -th + 4, 4, th - 14); // zíper
      // símbolo de risco biológico
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(9, -th + 16, 6, 0, TAU2); ctx.stroke();
      ctx.beginPath(); ctx.arc(9, -th + 16, 2, 0, TAU2); ctx.fillStyle = OUT; ctx.fill();
    },
    drawHead(ctx, r, pose) {
      // capuz amarelo fechado
      ctx.beginPath(); ctx.arc(0, -r * 0.02, r * 1.12, 0, TAU2);
      ctx.fillStyle = C('#e6c43a'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      if (!FLASH) {
        ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.arc(-r * 0.3, 0, r * 0.95, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
        // visor de acrílico
        ctx.beginPath(); ctx.ellipse(r * 0.48, -r * 0.2, r * 0.55, r * 0.42, 0, 0, TAU2);
        ctx.fillStyle = '#9fd8d0'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#1b2422'; ctx.beginPath(); ctx.arc(r * 0.38, -r * 0.2, r * 0.13, 0, TAU2); ctx.arc(r * 0.78, -r * 0.2, r * 0.11, 0, TAU2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(r * 0.2, -r * 0.45, r * 0.35, r * 0.08);
        // filtro da máscara de gás
        ctx.beginPath(); ctx.arc(r * 0.72, r * 0.45, r * 0.28, 0, TAU2);
        ctx.fillStyle = '#2f3a2e'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#6c7a86'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(r * 0.55, r * 0.45); ctx.lineTo(r * 0.9, r * 0.45); ctx.moveTo(r * 0.72, r * 0.28); ctx.lineTo(r * 0.72, r * 0.62); ctx.stroke();
      }
    },
  });

  S.slade = mkStyle({
    skin: '#1f2126', torso: '#1f2126', arm: '#2a2d33', glove: '#80868f', hand: '#80868f', leg: '#2a2d33', boot: '#80868f',
    shW: 32, hipW: 24, armW: 9, legW: 10,
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.fillStyle = '#80868f';
      ctx.fillRect(-18, -th + 2, 36, 10);
      ctx.fillStyle = '#5c6169'; ctx.fillRect(-18, -10, 36, 6);
      ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-6, -th + 16); ctx.lineTo(6, -th + 16); ctx.stroke();
    },
    drawHead(ctx, r, pose) {
      headCircle(ctx, r, '#d0711f');
      if (!FLASH) {
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r - 1.5, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#18191d'; ctx.fillRect(-r, -r, r * 1.05, r * 2);
        ctx.fillStyle = '#18191d';
        for (let i = 0; i < 3; i++) ctx.fillRect(r * 0.3 + i * 5, r * 0.45, 2.5, r * 0.4);
        ctx.restore();
        ctx.beginPath(); ctx.ellipse(r * 0.5, -r * 0.1, r * 0.2, r * 0.13, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#100'; ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.53, -r * 0.1, r * 0.07, 0, Math.PI * 2); ctx.fillStyle = '#ff4a2a'; ctx.fill();
        TT.drawGlow(ctx, '#ff4a2a', r * 0.53, -r * 0.1, 8, 0.9);
      }
    },
  });

  S.cinderblock = mkStyle({
    scale: 2.0, skin: '#9b958d', torso: '#8e8880', arm: '#968f86', glove: '#7d776f', hand: '#8a847c', leg: '#857f77', boot: '#6f6a63',
    shW: 62, hipW: 44, torsoH: 46, headR: 17, legL: [20, 20], armL: [22, 22], armW: 17, legW: 17, handR: 12, footR: 10, headOff: 8,
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.strokeStyle = '#6f6a63'; ctx.lineWidth = 2;
      for (let y = -6; y > -th; y -= 12) {
        ctx.beginPath(); ctx.moveTo(-34, y); ctx.lineTo(34, y); ctx.stroke();
        const off = (y / 12) % 2 === 0 ? 0 : 10;
        for (let x = -30 + off; x < 34; x += 20) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 12); ctx.stroke(); }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-30, -th, 20, th);
    },
    drawHead(ctx, r, pose) {
      ctx.beginPath(); ctx.rect(-r, -r * 0.9, r * 2, r * 1.8);
      ctx.fillStyle = C('#9b958d'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      if (!FLASH) {
        ctx.fillStyle = '#ffcf33';
        ctx.fillRect(r * 0.1, -r * 0.25, r * 0.35, r * 0.22);
        ctx.fillRect(r * 0.55, -r * 0.25, r * 0.3, r * 0.22);
        TT.drawGlow(ctx, '#ffb020', r * 0.45, -r * 0.15, 16, 0.8);
        ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(r * 0.05, -r * 0.45); ctx.lineTo(r * 0.95, -r * 0.3); ctx.stroke();
      }
    },
  });

  // ------------------------------------------------------------ Formas animais do Mutano
  // Paleta verde em 4 tons (sombra, base, luz, peito/rosto) — volume com sombreamento em camadas.
  const BB = { D: '#2b6418', M: '#4f9d2d', L: '#86d257', F: '#b4e48c', X: '#1d4710' };

  // Traço grosso de membro: contorno + cor + filete de luz.
  function fatStroke(ctx, pts, w, col, hi) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 7; ctx.stroke();
    ctx.strokeStyle = C(col); ctx.lineWidth = w; ctx.stroke();
    if (hi && !FLASH) {
      ctx.save(); ctx.translate(-w * 0.14, -w * 0.18);
      ctx.strokeStyle = hi; ctx.lineWidth = w * 0.28; ctx.stroke();
      ctx.restore();
    }
  }
  // Pelos/escamas sugeridos: pequenos traços em "v" ao longo de uma curva.
  function furMarks(ctx, pts, col, size) {
    if (FLASH) return;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i], y = pts[i + 1];
      ctx.moveTo(x - size, y - size * 0.4); ctx.lineTo(x, y + size * 0.5); ctx.lineTo(x + size * 0.6, y - size * 0.6);
    }
    ctx.stroke();
  }
  // Olho expressivo e bravo (branco, íris, brilho e sobrancelha).
  function beastEye(ctx, x, y, r, iris, browCol, slit) {
    if (FLASH) return;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = iris ? '#fff8d0' : '#ffffff'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = iris || OUT;
    ctx.beginPath(); ctx.ellipse(x + r * 0.25, y + r * 0.05, r * 0.5, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    if (slit) { ctx.fillStyle = OUT; ctx.fillRect(x + r * 0.15, y - r * 0.5, r * 0.22, r); }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + r * 0.05, y - r * 0.3, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = browCol || OUT; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - r * 1.2, y - r * 1.25); ctx.lineTo(x + r * 1.1, y - r * 0.55); ctx.stroke();
  }
  // Preenche um caminho com volume: base, sombra embaixo/atrás, luz em cima, contorno.
  // se/le = elipses [x, y, rx, ry, rot] da sombra e da luz.
  function volume(ctx, path, base, shadow, light, se, le) {
    path(); ctx.fillStyle = C(base); ctx.fill();
    if (!FLASH) {
      ctx.save(); path(); ctx.clip();
      ctx.fillStyle = shadow; ctx.beginPath(); ctx.ellipse(se[0], se[1], se[2], se[3], se[4] || 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(le[0], le[1], le[2], le[3], le[4] || 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    path(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
  }

  // Gorila: t = quadro do golpe, s = quadro do impacto. Braços sobem, descem esmagando o chão e voltam.
  TT.drawGorilla = function (ctx, x, y, facing, t, s, end, flash) {
    FLASH = !!flash;
    const { D, M, L, F, X } = BB;
    const up = TT.clamp(t / (s - 4), 0, 1), down = TT.clamp((t - (s - 4)) / 4, 0, 1);
    const rec = TT.clamp((t - s - 5) / 14, 0, 1), pop = TT.clamp(t / 5, 0, 1);
    // squash-and-stretch
    let sx = 1, sy = 1;
    if (t < s - 4) { sx = 1 - 0.08 * TT.easeOut(up); sy = 1 + 0.1 * TT.easeOut(up); }
    else if (t < s + 5) { const k = TT.clamp((t - s) / 5, 0, 1); sx = t < s ? 1.0 : 1.2 - 0.06 * k; sy = t < s ? 1.04 : 0.82 + 0.05 * k; }
    else { sx = TT.lerp(1.14, 1, rec); sy = TT.lerp(0.87, 1, rec); }
    const ps = 0.55 + 0.45 * TT.easeOut(pop) + Math.sin(pop * Math.PI) * 0.12;
    ctx.save(); ctx.translate(x, y); ctx.scale(facing * 1.12 * sx * ps, 1.12 * sy * ps);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // mãos: repouso -> acima da cabeça -> chão à frente -> repouso
    let hx, hy;
    if (down <= 0) { const e = TT.easeOut(up); hx = TT.lerp(64, 4, e); hy = TT.lerp(-36, -210, e); }
    else { hx = TT.lerp(4, 112, down); hy = TT.lerp(-210, -10, down * down); }
    if (t > s + 5) { hx = TT.lerp(112, 64, rec); hy = TT.lerp(-10, -36, rec); }
    const bend = 26 * (1 - down * 0.7 + rec * 0.7);
    const armPts = (shx, shy, off) => {
      const ex = hx + off, dx = ex - shx, dy = hy - shy, l = Math.hypot(dx, dy) || 1;
      const mx = (shx + ex) / 2 + (-dy / l) * bend, my = (shy + hy) / 2 + (dx / l) * bend;
      return [shx, shy, mx, my, ex, hy];
    };
    const fist = (fx, fy, col) => {
      ctx.beginPath(); ctx.ellipse(fx, fy, 17, 15, 0, 0, Math.PI * 2);
      ctx.fillStyle = C(col); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
      if (!FLASH) { ctx.strokeStyle = X; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx + 4, fy - 9); ctx.lineTo(fx + 4, fy + 8); ctx.moveTo(fx + 10, fy - 6); ctx.lineTo(fx + 10, fy + 6); ctx.stroke(); }
    };
    // braço e perna de trás (tom escuro)
    fatStroke(ctx, armPts(-6, -124, -14), 24, D, null);
    fist(hx - 14, hy, D);
    fatStroke(ctx, [-24, -46, -36, -22, -26, -4], 22, D, null);
    ctx.beginPath(); ctx.ellipse(-20, -3, 20, 9, 0, 0, Math.PI * 2); ctx.fillStyle = C(X); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    // tronco curvado (corcunda) com volume
    const torso = () => {
      ctx.beginPath();
      ctx.moveTo(-36, -40);
      ctx.bezierCurveTo(-62, -72, -56, -128, -22, -144);
      ctx.bezierCurveTo(10, -158, 46, -146, 50, -114);
      ctx.bezierCurveTo(54, -84, 40, -50, 24, -36);
      ctx.quadraticCurveTo(-6, -24, -36, -40);
      ctx.closePath();
    };
    volume(ctx, torso, M, D, L, [-34, -52, 40, 52, 0.3], [6, -140, 34, 14, -0.15]);
    if (!FLASH) {
      ctx.beginPath(); ctx.ellipse(28, -86, 20, 28, -0.15, 0, Math.PI * 2); ctx.fillStyle = F; ctx.fill();
      ctx.strokeStyle = D; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, -92); ctx.quadraticCurveTo(28, -86, 40, -92); ctx.moveTo(16, -76); ctx.quadraticCurveTo(28, -72, 38, -78); ctx.stroke();
      furMarks(ctx, [-50, -84, -50, -104, -42, -122, -28, -136, -10, -146], X, 6);
    }
    // perna da frente
    fatStroke(ctx, [10, -44, 24, -22, 22, -4], 24, M, L);
    ctx.beginPath(); ctx.ellipse(28, -3, 22, 9, 0, 0, Math.PI * 2); ctx.fillStyle = C(D); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    // cabeça: crista, sobrancelha, focinho e boca
    const roar = t >= s - 3 && t < s + 10;
    ctx.save(); ctx.translate(44, -130); ctx.rotate(roar ? -0.12 : 0.05);
    const head = () => { ctx.beginPath(); ctx.moveTo(-18, 8); ctx.bezierCurveTo(-24, -14, -8, -30, 6, -28); ctx.bezierCurveTo(22, -26, 28, -12, 28, 4); ctx.bezierCurveTo(26, 18, -14, 22, -18, 8); ctx.closePath(); };
    volume(ctx, head, M, D, L, [-14, 6, 14, 18], [2, -24, 14, 6]);
    ctx.beginPath(); ctx.ellipse(16, 6, 16, 14, 0, 0, Math.PI * 2); ctx.fillStyle = C(F); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    if (!FLASH) {
      ctx.fillStyle = X; ctx.beginPath(); ctx.ellipse(10, -11, 18, 5, 0.12, 0, Math.PI * 2); ctx.fill(); // sobrancelha
      beastEye(ctx, 13, -5, 4.2, null, X);
      ctx.fillStyle = X; ctx.beginPath(); ctx.arc(24, 2, 2, 0, Math.PI * 2); ctx.arc(19, 3, 2, 0, Math.PI * 2); ctx.fill();
      if (roar) {
        ctx.beginPath(); ctx.ellipse(18, 13, 10, 7, 0, 0, Math.PI * 2); ctx.fillStyle = '#5a1020'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; for (const fx of [11, 24]) { ctx.beginPath(); ctx.moveTo(fx - 3, 7); ctx.lineTo(fx + 3, 7); ctx.lineTo(fx, 13); ctx.fill(); }
      } else { ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(8, 13); ctx.quadraticCurveTo(18, 10, 28, 13); ctx.stroke(); }
    }
    ctx.restore();
    // braço da frente
    fatStroke(ctx, armPts(20, -120, 0), 26, M, L);
    if (!FLASH) furMarks(ctx, [14, -128, 26, -128], X, 5);
    fist(hx, hy, M);
    ctx.restore(); FLASH = false;
  };

  // T-Rex: preparação com rugido (t < s), corrida mordendo e freada no fim (t > end).
  TT.drawTRex = function (ctx, x, y, facing, t, s, end, flash) {
    FLASH = !!flash;
    const { D, M, L, F, X } = BB;
    const pre = TT.clamp(t / s, 0, 1), run = t >= s && t < end, stop = TT.clamp((t - end) / 10, 0, 1);
    const ph = t * 0.45, step = run ? Math.sin(ph) : 0;
    const bob = run ? -Math.abs(Math.cos(ph)) * 7 : 0;
    const tilt = t < s ? -0.28 * TT.easeOut(pre) : run ? 0.06 : -0.12 * (1 - stop);
    const jaw = t < s ? 0.15 + 0.55 * pre : run ? 0.2 + Math.abs(Math.sin(t * 0.32)) * 0.45 : 0.15;
    const pop = TT.clamp(t / 5, 0, 1), ps = 0.55 + 0.45 * TT.easeOut(pop) + Math.sin(pop * Math.PI) * 0.12;
    const sq = run ? 1 + Math.cos(ph * 2) * 0.03 : 1;
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(facing * 1.2 * ps / sq, 1.2 * ps * sq);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.translate(0, -62); ctx.rotate(tilt); ctx.translate(0, 62);
    // cauda
    const wag = Math.sin(t * 0.25) * 8;
    const tail = () => { ctx.beginPath(); ctx.moveTo(-26, -104); ctx.bezierCurveTo(-80, -112, -130, -96 + wag, -168, -78 + wag * 1.6); ctx.bezierCurveTo(-120, -66 + wag, -76, -60, -28, -58); ctx.closePath(); };
    volume(ctx, tail, M, D, L, [-90, -64, 80, 12], [-80, -104, 70, 8, 0.12]);
    if (!FLASH) { ctx.fillStyle = D; for (let i = 0; i < 6; i++) { const tx = -40 - i * 21, ty = -106 + i * 4 + wag * i / 6; ctx.beginPath(); ctx.moveTo(tx - 7, ty + 2); ctx.lineTo(tx, ty - 8 + i); ctx.lineTo(tx + 7, ty + 2); ctx.fill(); } }
    // perna de trás
    const leg = (hx, phs, col, hi) => {
      const kx = hx - 18 + phs * 16, fx = hx + 6 + phs * 22, lift = Math.max(0, -phs) * 14;
      ctx.beginPath(); ctx.ellipse(hx, -66, 22, 30, 0.3, 0, Math.PI * 2); ctx.fillStyle = C(col); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
      fatStroke(ctx, [hx + 4, -50, kx, -26 - lift, fx, -4 - lift], 15, col, hi);
      ctx.beginPath(); ctx.ellipse(fx + 8, -3 - lift, 16, 6, 0, 0, Math.PI * 2); ctx.fillStyle = C(col); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      if (!FLASH) { ctx.fillStyle = '#f4f0d8'; for (const cx of [18, 25]) { ctx.beginPath(); ctx.moveTo(fx + cx - 3, -6 - lift); ctx.lineTo(fx + cx + 4, -3 - lift); ctx.lineTo(fx + cx - 3, 0 - lift); ctx.fill(); } }
    };
    leg(-14, -step, D, null);
    // corpo
    const body = () => { ctx.beginPath(); ctx.moveTo(-40, -102); ctx.bezierCurveTo(-6, -124, 36, -122, 56, -100); ctx.bezierCurveTo(64, -82, 50, -58, 26, -54); ctx.bezierCurveTo(0, -48, -30, -52, -42, -62); ctx.bezierCurveTo(-52, -76, -50, -94, -40, -102); ctx.closePath(); };
    volume(ctx, body, M, D, L, [-10, -50, 60, 18], [6, -116, 44, 10, -0.1]);
    if (!FLASH) {
      ctx.save(); body(); ctx.clip();
      ctx.fillStyle = F; ctx.beginPath(); ctx.ellipse(28, -64, 32, 14, -0.35, 0, Math.PI * 2); ctx.fill(); // barriga clara
      ctx.strokeStyle = D; ctx.lineWidth = 1.6;
      for (let i = 0; i < 9; i++) { const sx2 = -30 + (i % 5) * 16 + (i > 4 ? 8 : 0), sy2 = -104 + (i > 4 ? 14 : 0); ctx.beginPath(); ctx.arc(sx2, sy2, 5, 0.2, Math.PI - 0.2); ctx.stroke(); } // escamas
      ctx.restore();
    }
    leg(8, step, M, L);
    // bracinhos agitados
    const fl = Math.sin(t * 0.6) * 0.4;
    fatStroke(ctx, [44, -86, 56 + fl * 6, -74, 66, -78 + fl * 8], 7, M, null);
    // cabeça grande com mandíbula
    ctx.save(); ctx.translate(54, -112); ctx.rotate(t < s ? -0.3 * pre : run ? Math.sin(t * 0.32) * 0.06 : 0);
    // boca (interior)
    if (!FLASH) {
      ctx.save(); ctx.rotate(jaw * 0.5);
      ctx.beginPath(); ctx.moveTo(2, 6); ctx.lineTo(66, -4); ctx.lineTo(62, 22); ctx.closePath(); ctx.fillStyle = '#5a1020'; ctx.fill();
      ctx.restore();
    }
    // mandíbula inferior
    ctx.save(); ctx.translate(2, 8); ctx.rotate(jaw);
    ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(56, -4); ctx.quadraticCurveTo(60, 4, 52, 8); ctx.lineTo(0, 12); ctx.closePath();
    ctx.fillStyle = C(D); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    if (!FLASH) { ctx.fillStyle = '#ffffff'; for (let i = 8; i < 52; i += 8) { ctx.beginPath(); ctx.moveTo(i, -3); ctx.lineTo(i + 5, -3); ctx.lineTo(i + 2.5, -10); ctx.fill(); } }
    ctx.restore();
    const skull = () => { ctx.beginPath(); ctx.moveTo(-14, 12); ctx.bezierCurveTo(-20, -18, 4, -32, 30, -28); ctx.bezierCurveTo(52, -26, 70, -18, 74, -6); ctx.quadraticCurveTo(76, 4, 68, 6); ctx.lineTo(2, 10); ctx.closePath(); };
    volume(ctx, skull, M, D, L, [0, 8, 26, 10], [30, -26, 34, 6, 0.05]);
    if (!FLASH) {
      ctx.fillStyle = '#ffffff'; for (let i = 10; i < 66; i += 8) { ctx.beginPath(); ctx.moveTo(i, 7); ctx.lineTo(i + 5, 7); ctx.lineTo(i + 2.5, 14); ctx.fill(); }
      ctx.fillStyle = X; ctx.beginPath(); ctx.ellipse(66, -14, 3, 2, 0, 0, Math.PI * 2); ctx.fill(); // narina
      beastEye(ctx, 22, -14, 6, '#ffd23a', X, true);
      ctx.strokeStyle = D; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(34, -6); ctx.quadraticCurveTo(46, -2, 58, -6); ctx.stroke();
    }
    ctx.restore();
    ctx.restore(); FLASH = false;
  };

  // Rinoceronte (ataque em corrida): cabeça baixa, chifre à frente, galope.
  TT.drawRhino = function (ctx, x, y, facing, t, s, end, flash) {
    FLASH = !!flash;
    const { D, M, L, F, X } = BB;
    const pre = TT.clamp(t / s, 0, 1), run = t >= s && t < end, stop = TT.clamp((t - end) / 8, 0, 1);
    const ph = t * 0.55, gal = run ? Math.sin(ph) : 0;
    const bob = run ? -Math.abs(Math.sin(ph)) * 6 : 0;
    const tilt = t < s ? -0.18 * TT.easeOut(pre) : run ? 0.08 : -0.1 * (1 - stop);
    const pop = TT.clamp(t / 4, 0, 1), ps = 0.55 + 0.45 * TT.easeOut(pop) + Math.sin(pop * Math.PI) * 0.12;
    const st = run ? 1.08 : t < s ? 0.94 : 1; // estica correndo, encolhe preparando
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(facing * 1.1 * ps * st, 1.1 * ps / st);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.translate(0, -40); ctx.rotate(tilt); ctx.translate(0, 40);
    const leg = (lx, p, col, hi) => fatStroke(ctx, [lx, -42, lx + p * 12, -20 - Math.max(0, p) * 8, lx + p * 18, -4 - Math.max(0, p) * 6], 15, col, hi);
    leg(-40, -gal, D, null); leg(26, gal, D, null);
    // cauda curtinha
    ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-62, -66); ctx.quadraticCurveTo(-74, -60, -72, -48 + Math.sin(t * 0.8) * 4); ctx.stroke();
    // corpo em barril com dobras de couraça
    const body = () => { ctx.beginPath(); ctx.moveTo(-62, -58); ctx.bezierCurveTo(-64, -92, -20, -104, 14, -98); ctx.bezierCurveTo(44, -94, 58, -78, 56, -58); ctx.bezierCurveTo(54, -36, 20, -30, -10, -32); ctx.bezierCurveTo(-40, -32, -62, -40, -62, -58); ctx.closePath(); };
    volume(ctx, body, M, D, L, [-6, -34, 64, 16], [-6, -96, 44, 9]);
    if (!FLASH) {
      ctx.strokeStyle = D; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-28, -98); ctx.quadraticCurveTo(-38, -66, -26, -36); ctx.moveTo(22, -97); ctx.quadraticCurveTo(14, -66, 24, -36); ctx.stroke();
      furMarks(ctx, [-50, -84, -6, -100, 36, -92], X, 4);
    }
    leg(-30, gal, M, L); leg(36, -gal, M, L);
    // cabeça baixa com chifre
    ctx.save(); ctx.translate(48, -66); ctx.rotate(run ? 0.12 + Math.sin(ph) * 0.05 : t < s ? -0.2 * pre : 0);
    const head = () => { ctx.beginPath(); ctx.moveTo(-10, -26); ctx.bezierCurveTo(10, -32, 34, -22, 46, -6); ctx.quadraticCurveTo(50, 8, 40, 14); ctx.bezierCurveTo(22, 20, 0, 18, -12, 8); ctx.closePath(); };
    volume(ctx, head, M, D, L, [10, 14, 30, 8], [14, -24, 22, 6]);
    // chifres
    ctx.beginPath(); ctx.moveTo(34, -12); ctx.quadraticCurveTo(62, -24, 70, -48); ctx.quadraticCurveTo(58, -18, 46, -2); ctx.closePath();
    ctx.fillStyle = C('#eef6dc'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, -22); ctx.quadraticCurveTo(28, -34, 30, -42); ctx.quadraticCurveTo(30, -28, 28, -18); ctx.closePath();
    ctx.fillStyle = C('#d6e6bd'); ctx.fill(); ctx.stroke();
    // orelha e olho
    ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-14, -42); ctx.lineTo(2, -28); ctx.closePath(); ctx.fillStyle = C(D); ctx.fill(); ctx.stroke();
    beastEye(ctx, 14, -12, 4, null, X);
    if (!FLASH) { ctx.fillStyle = X; ctx.beginPath(); ctx.arc(42, 6, 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.restore(); FLASH = false;
  };


  // Interpola pontos [x, y].
  const lp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const popScale = (t) => { const p = TT.clamp(t / 4, 0, 1); return 0.55 + 0.45 * TT.easeOut(p) + Math.sin(p * Math.PI) * 0.12; };

  // Canguru: apoia na cauda e chuta com as duas patas (fim do combo do Mutano).
  TT.drawKangaroo = function (ctx, x, y, facing, t, s, end, flash) {
    FLASH = !!flash;
    const { D, M, L, F, X } = BB;
    const pre = TT.clamp(t / s, 0, 1), hit = t >= s && t < end, rec = TT.clamp((t - end) / 10, 0, 1);
    const lean = t < s ? -0.42 * TT.easeOut(pre) : hit ? -0.5 : -0.5 * (1 - rec);
    const REST = [[10, -28], [26, -4]], CH = [[28, -62], [14, -38]], EX = [[46, -42], [104, -16]];
    let knee, ankle;
    if (t < s) { const k = TT.easeOut(pre); knee = lp(REST[0], CH[0], k); ankle = lp(REST[1], CH[1], k); }
    else if (t < end) { const k = TT.clamp((t - s + 1) / 2, 0, 1); knee = lp(CH[0], EX[0], k); ankle = lp(CH[1], EX[1], k); }
    else { knee = lp(EX[0], REST[0], TT.easeInOut(rec)); ankle = lp(EX[1], REST[1], TT.easeInOut(rec)); }
    const ps = popScale(t);
    ctx.save(); ctx.translate(x, y); ctx.scale(facing * 1.08 * ps, 1.08 * ps);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    fatStroke(ctx, [-12, -46, -46, -24, -84, -3], 15, D, null); // cauda grossa de apoio
    ctx.translate(-6, -50); ctx.rotate(lean); ctx.translate(6, 50);
    const leg = (dx, col, hi) => {
      const hip = [-4 + dx, -46], kn = [knee[0] + dx, knee[1]], an = [ankle[0] + dx, ankle[1]];
      ctx.beginPath(); ctx.ellipse(hip[0], hip[1], 19, 25, 0.3, 0, Math.PI * 2); ctx.fillStyle = C(col); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke();
      fatStroke(ctx, [hip[0] + 6, hip[1] + 8, kn[0], kn[1], an[0], an[1]], 11, col, hi);
      const dl = Math.hypot(an[0] - kn[0], an[1] - kn[1]) || 1, ux = (an[0] - kn[0]) / dl, uy = (an[1] - kn[1]) / dl;
      const toe = t < s && pre < 0.3 ? [an[0] + 26, an[1]] : [an[0] + ux * 24, an[1] + uy * 24];
      fatStroke(ctx, [an[0], an[1], toe[0], toe[1]], 9, col, hi);
    };
    leg(-8, D, null);
    const body = () => { ctx.beginPath(); ctx.moveTo(-26, -44); ctx.bezierCurveTo(-36, -92, -14, -130, 6, -134); ctx.bezierCurveTo(26, -132, 32, -104, 27, -80); ctx.bezierCurveTo(23, -54, 12, -36, -6, -34); ctx.bezierCurveTo(-18, -34, -25, -38, -26, -44); ctx.closePath(); };
    volume(ctx, body, M, D, L, [-22, -56, 22, 40], [8, -122, 14, 10]);
    if (!FLASH) { ctx.beginPath(); ctx.ellipse(13, -80, 11, 26, -0.15, 0, Math.PI * 2); ctx.fillStyle = F; ctx.fill(); }
    leg(4, M, L);
    fatStroke(ctx, [18, -106, 32, -98, 38, -106], 6, M, null); // bracinhos
    fatStroke(ctx, [14, -100, 26, -90, 33, -96], 6, M, null);
    // cabeça com orelhas compridas e focinho
    ctx.save(); ctx.translate(8, -142); ctx.rotate(hit ? 0.25 : 0);
    for (const [ex, col] of [[-10, D], [-2, M]]) {
      ctx.beginPath(); ctx.ellipse(ex, -20, 6, 15, -0.35, 0, Math.PI * 2); ctx.fillStyle = C(col); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    }
    const head = () => { ctx.beginPath(); ctx.moveTo(-12, 4); ctx.bezierCurveTo(-14, -14, 2, -16, 14, -10); ctx.quadraticCurveTo(32, -4, 30, 6); ctx.quadraticCurveTo(14, 14, -12, 4); ctx.closePath(); };
    volume(ctx, head, M, D, L, [-6, 8, 14, 6], [4, -12, 12, 4]);
    beastEye(ctx, 6, -5, 3.6, null, X);
    if (!FLASH) { ctx.fillStyle = X; ctx.beginPath(); ctx.arc(28, 2, 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.restore(); FLASH = false;
  };

  // Carneiro: recua e dá uma cabeçada com os chifres enrolados.
  TT.drawRam = function (ctx, x, y, facing, t, s, end, flash) {
    FLASH = !!flash;
    const { D, M, L, F, X } = BB;
    const pre = TT.clamp(t / s, 0, 1), run = t >= s && t < end, rec = TT.clamp((t - end) / 8, 0, 1);
    const ph = t * 0.6, gal = run ? Math.sin(ph) : 0;
    const tilt = t < s ? -0.28 * TT.easeOut(pre) : run ? 0.16 : 0.16 * (1 - rec);
    const ps = popScale(t);
    ctx.save(); ctx.translate(x, y + (run ? -Math.abs(Math.sin(ph)) * 5 : 0)); ctx.scale(facing * 1.1 * ps, 1.1 * ps);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.translate(0, -30); ctx.rotate(tilt); ctx.translate(0, 30);
    const leg = (lx, p, col) => fatStroke(ctx, [lx, -38, lx + p * 10, -18, lx + p * 14, -3], 6, col, null);
    leg(-28, -gal, D); leg(18, gal, D);
    // lã: nuvem de bolinhas com volume
    const puffs = [[-34, -56], [-22, -72], [-2, -77], [18, -70], [26, -52], [8, -40], [-16, -40]];
    for (const [px, py] of puffs) { ctx.beginPath(); ctx.arc(px, py, 17, 0, Math.PI * 2); ctx.fillStyle = C(M); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3.5; ctx.stroke(); }
    if (!FLASH) {
      ctx.fillStyle = L; for (const [px, py] of puffs) { ctx.beginPath(); ctx.arc(px + 2, py - 4, 11, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = F; ctx.beginPath(); ctx.arc(-4, -62, 18, 0, Math.PI * 2); ctx.fill();
      furMarks(ctx, [-30, -60, -10, -66, 10, -60], D, 4);
    }
    leg(-20, gal, M); leg(26, -gal, M);
    // cabeça baixa com chifres enrolados
    ctx.save(); ctx.translate(42, -58); ctx.rotate(run ? 0.35 : t < s ? -0.25 * pre : 0.1);
    const head = () => { ctx.beginPath(); ctx.moveTo(-8, -14); ctx.bezierCurveTo(8, -20, 26, -10, 30, 4); ctx.quadraticCurveTo(28, 14, 16, 14); ctx.bezierCurveTo(4, 14, -10, 8, -12, -2); ctx.closePath(); };
    volume(ctx, head, D, X, M, [8, 12, 18, 6], [8, -14, 14, 5]);
    beastEye(ctx, 10, -4, 3.4, '#ffd23a', X, true);
    ctx.lineWidth = 9; ctx.strokeStyle = OUT; // chifre: espiral
    ctx.beginPath(); ctx.arc(0, -8, 12, -2.6, 2.2); ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = C('#e9f2d6'); ctx.stroke();
    if (!FLASH) { ctx.lineWidth = 1.5; ctx.strokeStyle = '#9aa58a'; ctx.beginPath(); ctx.arc(0, -8, 12, -2, 1.6); ctx.stroke(); }
    ctx.restore();
    ctx.restore(); FLASH = false;
  };

  // Guepardo: esquiva do Mutano (galope esticando e encolhendo a coluna).
  TT.drawCheetah = function (ctx, x, y, facing, t, flash) {
    FLASH = !!flash;
    const { D, M, L, F, X } = BB;
    const ph = t * 0.75, s = Math.sin(ph), stretch = 1 + s * 0.12;
    const ps = popScale(t);
    ctx.save(); ctx.translate(x, y - Math.abs(Math.cos(ph)) * 6); ctx.scale(facing * 1.05 * ps * stretch, 1.05 * ps / Math.sqrt(stretch));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    fatStroke(ctx, [-44, -50, -84, -62 + s * 6, -104, -48 + s * 10], 5, M, null); // cauda
    const legs = (lx, a, col) => fatStroke(ctx, [lx, -42, lx + Math.sin(a) * 14, -24, lx + Math.sin(a) * 26, -4 + Math.max(0, -Math.cos(a)) * -6], 6, col, null);
    legs(-30, ph + 0.6, D); legs(26, ph + 2.2, D);
    const body = () => { ctx.beginPath(); ctx.moveTo(-48, -50); ctx.bezierCurveTo(-30, -66, 20, -64, 44, -54); ctx.bezierCurveTo(50, -44, 36, -34, 18, -34); ctx.bezierCurveTo(-6, -32, -36, -32, -48, -40); ctx.closePath(); };
    volume(ctx, body, M, D, L, [-4, -32, 50, 8], [0, -62, 40, 6]);
    if (!FLASH) { ctx.fillStyle = X; for (const [px, py] of [[-34, -48], [-20, -54], [-6, -46], [8, -56], [22, -48], [-26, -40], [2, -40]]) { ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2); ctx.fill(); } }
    legs(-24, ph + 3.4, M); legs(32, ph + 5.0, M);
    ctx.save(); ctx.translate(50, -58);
    const head = () => { ctx.beginPath(); ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2); };
    volume(ctx, head, M, D, L, [0, 6, 12, 5], [0, -6, 9, 4]);
    ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-10, -18); ctx.lineTo(-1, -10); ctx.closePath(); ctx.fillStyle = C(D); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
    beastEye(ctx, 4, -2, 3, '#ffd23a', X);
    if (!FLASH) { ctx.strokeStyle = X; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(5, 1); ctx.lineTo(8, 8); ctx.stroke(); ctx.fillStyle = X; ctx.beginPath(); ctx.arc(12, 2, 1.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.restore(); FLASH = false;
  };

  // Ravena atravessa como o corvo de sua alma (esquiva).
  TT.drawSoulRaven = function (ctx, x, y, facing, t) {
    const f = Math.sin(t * 0.7) * 16, k = TT.clamp(t / 5, 0, 1);
    TT.drawGlow(ctx, '#a77bff', x, y, 70, 0.55);
    ctx.save(); ctx.translate(x, y); ctx.scale(facing * (0.6 + 0.4 * k), 0.6 + 0.4 * k);
    ctx.fillStyle = '#0c0716'; ctx.strokeStyle = '#8a5cff'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(46, -2); ctx.lineTo(24, -12);
    ctx.quadraticCurveTo(-4, -50 - f, -40, -60 - f); ctx.lineTo(-18, -24 - f * 0.4); ctx.lineTo(-58, -14);
    ctx.lineTo(-26, 2); ctx.lineTo(-62, 16 + f * 0.3); ctx.lineTo(-20, 12);
    ctx.quadraticCurveTo(-8, 40 + f, -32, 54 + f); ctx.quadraticCurveTo(10, 40 + f * 0.5, 22, 10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#efe4ff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(28, -5, 4, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  // Estrela/explosão em quadrinhos
  TT.drawBurst = function (ctx, x, y, r, points, fill, stroke, rot) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = rot + (i / (points * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.5;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
  };

  // Texto com contorno grosso (estilo HQ)
  TT.drawText = function (ctx, text, x, y, size, fill, stroke, align, lw) {
    ctx.font = size + 'px ' + TT.FONT;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || Math.max(3, size * 0.16); ctx.strokeText(text, x, y); }
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
  };

  // Retrato de um titã (cabeça), usado no HUD; cacheado em canvas.
  const portraitCache = new Map();
  TT.portrait = function (key, size) {
    const k = key + size;
    let c = portraitCache.get(k);
    if (c) return c;
    c = TT.makeCanvas(size, size);
    const g = c.getContext('2d');
    const st = S[key];
    g.translate(size * 0.52, size * 0.56);
    const s = size / 74; // margem para cabelo/capuz não serem cortados
    g.scale(s, s);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const pose = TT.newPose();
    TOON = st.toon !== false;
    if (st.portraitBack) st.portraitBack(g);
    st.drawHead(g, 21, pose, 0);
    TOON = false;
    portraitCache.set(k, c);
    return c;
  };
})();
