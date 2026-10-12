'use strict';
// Rig de personagens em vetor (estilo cartoon com contorno grosso), poses procedurais e sprites de brilho.
(function () {
  const TT = window.TT;
  const OUT = '#17121f';
  TT.OUT = OUT;
  TT.FONT = 'Impact, "Arial Black", "Segoe UI Black", sans-serif';

  let FLASH = false; // quando true, todo preenchimento vira branco (feedback de dano)
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

  // ------------------------------------------------------------ Poses
  const BASE = {
    lean: 0.05, bob: 0, tilt: 0, rot: 0,
    legB: [-0.2, -0.3], legF: [0.25, 0.05],
    armB: [0.35, 1.9], armF: [0.55, 2.25],
  };
  const NUM_KEYS = ['lean', 'bob', 'tilt', 'rot'];
  const ARR_KEYS = ['legB', 'legF', 'armB', 'armF'];

  function newPose() {
    return { lean: 0, bob: 0, tilt: 0, rot: 0, legB: [0, 0], legF: [0, 0], armB: [0, 0], armF: [0, 0],
      mouth: null, weapon: null, glow: null, form: null, cape: 0, eyes: null };
  }
  TT.newPose = newPose;

  function setPose(dst, src) {
    for (const k of NUM_KEYS) dst[k] = src[k] != null ? src[k] : BASE[k];
    for (const k of ARR_KEYS) {
      const s = src[k] || BASE[k];
      dst[k][0] = s[0]; dst[k][1] = s[1];
    }
    return dst;
  }
  function blendPose(dst, a, b, t) {
    for (const k of NUM_KEYS) {
      const va = a[k] != null ? a[k] : BASE[k], vb = b[k] != null ? b[k] : BASE[k];
      dst[k] = va + (vb - va) * t;
    }
    for (const k of ARR_KEYS) {
      const sa = a[k] || BASE[k], sb = b[k] || BASE[k];
      dst[k][0] = sa[0] + (sb[0] - sa[0]) * t;
      dst[k][1] = sa[1] + (sb[1] - sa[1]) * t;
    }
    return dst;
  }

  // Poses de ataque: w = preparação, h = golpe.
  const ATK = {
    jab: { w: { lean: -0.05, armF: [0.2, 2.6] }, h: { lean: 0.22, armF: [1.55, 1.57], armB: [0.1, 1.5], legF: [0.5, 0.25], legB: [-0.5, -0.6] } },
    cross: { w: { lean: -0.1, armB: [0.1, 2.4] }, h: { lean: 0.32, armB: [1.6, 1.6], armF: [0.2, 2.5], legF: [0.55, 0.3], legB: [-0.5, -0.7] } },
    uppercut: { w: { bob: 6, armF: [0.1, 0.5], lean: 0.1 }, h: { bob: -6, lean: -0.05, armF: [2.7, 3.0], legF: [0.35, 0.05], legB: [-0.4, -0.6] } },
    kick: { w: { legF: [1.0, 0.0], lean: -0.15 }, h: { legF: [1.6, 1.6], lean: -0.3, armF: [-0.4, 0.3], armB: [0.8, 1.7] } },
    flyKick: { w: { legF: [0.9, -0.3], legB: [0.2, -0.6], lean: -0.1 }, h: { lean: -0.15, legF: [1.65, 1.65], legB: [-0.4, -1.0], armF: [-0.9, -0.5], armB: [-1.1, -0.7] } },
    dive: { w: { legF: [1.0, 0.2] }, h: { lean: 0.3, legF: [0.75, 0.75], legB: [-0.2, -0.9], armF: [2.5, 2.8], armB: [-2.4, -2.7] } },
    swing: { w: { armF: [-2.6, -2.9], armB: [-2.4, -2.6], lean: -0.25, bob: -2 }, h: { armF: [1.0, 1.35], armB: [0.9, 1.25], lean: 0.32, bob: 4, legF: [0.6, 0.3], legB: [-0.5, -0.8] } },
    swipe: { w: { armF: [-1.3, -1.1], lean: -0.15 }, h: { armF: [1.65, 1.7], armB: [0.5, 1.2], lean: 0.25, legF: [0.5, 0.3], legB: [-0.45, -0.6] } },
    cast: { w: { armF: [0.2, 2.4], armB: [0.2, 2.2], lean: -0.12 }, h: { armF: [1.55, 1.6], armB: [1.4, 1.5], lean: 0.15, legF: [0.45, 0.25], legB: [-0.45, -0.55] } },
    castUp: { w: { armF: [0.3, 0.6], armB: [0.2, 0.5], bob: 4 }, h: { armF: [2.9, 3.1], armB: [2.8, 3.0], bob: -3, lean: -0.05 } },
    slam: { w: { armF: [2.9, 3.1], armB: [2.8, 3.0], bob: -4, lean: -0.2 }, h: { armF: [0.9, 0.6], armB: [0.8, 0.5], bob: 8, lean: 0.45, legF: [0.7, 0.2], legB: [-0.6, -0.9] } },
    throw: { w: { armF: [-2.2, -2.6], lean: -0.2 }, h: { armF: [1.45, 1.55], lean: 0.28, legF: [0.5, 0.3], legB: [-0.45, -0.6] } },
    beam: { w: { armF: [0.8, 1.2], lean: -0.05 }, h: { armF: [1.57, 1.57], armB: [1.1, 1.6], lean: -0.12, legF: [0.55, 0.35], legB: [-0.55, -0.7] } },
    claw: { w: { armF: [-1.6, -1.2], armB: [-1.4, -1.0], lean: -0.2 }, h: { armF: [1.9, 2.1], armB: [1.7, 1.9], lean: 0.3, legF: [0.5, 0.3], legB: [-0.5, -0.6] } },
    spin: { w: { armF: [1.5, 1.5], armB: [-1.5, -1.5] }, h: { armF: [1.5, 1.5], armB: [-1.5, -1.5], lean: 0.1 } },
    // Poses exageradas dos chefes (preparação bem visível)
    bigSwing: { w: { armF: [-2.9, -3.2], armB: [-2.6, -3.0], lean: -0.5, bob: 6, tilt: -0.25, legF: [0.5, 0.2], legB: [-0.5, -0.7] }, h: { armF: [1.25, 1.5], armB: [1.0, 1.4], lean: 0.5, bob: 6, legF: [0.7, 0.3], legB: [-0.6, -0.9] } },
    bigSlam: { w: { armF: [3.0, 3.1], armB: [2.9, 3.0], bob: 10, lean: -0.3, legF: [0.6, -0.4], legB: [-0.5, -1.0] }, h: { armF: [0.9, 0.5], armB: [0.8, 0.4], bob: 12, lean: 0.55, legF: [0.8, 0.2], legB: [-0.7, -1.0] } },
    bigCharge: { w: { lean: -0.35, bob: 8, armF: [-0.9, -0.2], armB: [-1.1, -0.4], legF: [0.7, -0.2], legB: [-0.6, -1.1] }, h: { lean: 0.7, bob: 4, armF: [1.2, 1.4], armB: [-1.2, -0.8], legF: [0.9, 0.3], legB: [-0.8, -1.2] } },
    bigThrow: { w: { armF: [-2.7, -3.0], armB: [-2.5, -2.9], lean: -0.4, bob: 4, tilt: -0.2 }, h: { armF: [1.5, 1.6], armB: [1.2, 1.4], lean: 0.4, legF: [0.6, 0.3], legB: [-0.5, -0.7] } },
  };
  TT.ATK_POSES = ATK;

  const IDLE = { lean: 0.05 };
  const tmpA = newPose(), tmpB = newPose();

  // Calcula a pose de um lutador a partir do estado atual.
  TT.computePose = function (f, out) {
    const t = f.animT;
    out.mouth = null; out.weapon = null; out.glow = null; out.form = null; out.eyes = null;
    out.cape = TT.clamp(Math.abs(f.vx) / 6, 0, 1);
    switch (f.anim) {
      case 'walk': {
        const ph = t * 0.21, s = Math.sin(ph), c = Math.cos(ph);
        out.lean = 0.12; out.bob = -Math.abs(c) * 3; out.tilt = 0; out.rot = 0;
        out.legF[0] = s * 0.6; out.legF[1] = s * 0.6 - 0.25 - Math.max(0, -c) * 0.7;
        out.legB[0] = -s * 0.6; out.legB[1] = -s * 0.6 - 0.25 - Math.max(0, c) * 0.7;
        out.armF[0] = -s * 0.55; out.armF[1] = -s * 0.55 + 1.1;
        out.armB[0] = s * 0.55; out.armB[1] = s * 0.55 + 1.1;
        out.cape = 0.6;
        break;
      }
      case 'dash': {
        setPose(out, { lean: 0.5, bob: 2, legF: [0.9, 0.3], legB: [-0.9, -1.5], armF: [-0.8, -0.3], armB: [-1.0, -0.5] });
        out.cape = 1;
        break;
      }
      case 'jump': {
        const rising = f.vz > 0;
        setPose(out, rising
          ? { lean: 0.05, legF: [0.9, -0.2], legB: [0.3, -0.7], armF: [2.4, 2.7], armB: [-0.6, 0.2] }
          : { lean: 0.1, legF: [0.4, 0.0], legB: [-0.3, -0.6], armF: [1.2, 1.6], armB: [-1.3, -1.0] });
        out.cape = 0.8;
        break;
      }
      case 'hurt': {
        const k = Math.min(1, t / 6);
        blendPose(out, IDLE, { lean: -0.4, tilt: -0.35, armF: [-0.7, -0.3], armB: [-1.0, -0.6], legF: [0.4, 0.1], legB: [-0.3, -0.5] }, k);
        out.mouth = 'open'; out.eyes = 'shut';
        break;
      }
      case 'down': {
        const air = f.z > 1;
        setPose(out, { lean: 0, tilt: 0.2, armF: [-2.2, -2.6], armB: [-2.0, -2.3], legF: [0.3, 0.1], legB: [-0.2, -0.3] });
        out.rot = air ? -0.9 - Math.min(0.6, t * 0.03) : -Math.PI / 2;
        out.mouth = 'open'; out.eyes = 'shut';
        break;
      }
      case 'getup': {
        const k = Math.min(1, t / 18);
        setPose(out, { bob: 10 * (1 - k), lean: 0.4 * (1 - k), legF: [0.9, -0.4], legB: [-0.2, -0.9], armF: [0.6, 0.6], armB: [0.3, 0.3] });
        out.rot = -Math.PI / 2 * Math.max(0, 1 - k * 2);
        break;
      }
      case 'ko': {
        setPose(out, { tilt: 0.3, armF: [-2.4, -2.6], armB: [-2.2, -2.4], legF: [0.2, 0.0], legB: [-0.1, -0.2] });
        out.rot = -Math.PI / 2; out.eyes = 'x';
        break;
      }
      case 'victory': {
        const s = Math.sin(t * 0.15);
        // soco para o alto à frente do rosto (sem cobri-lo)
        setPose(out, { lean: -0.08, bob: -Math.abs(s) * 5, armF: [2.0 + s * 0.1, 2.5 + s * 0.1], armB: [-0.4, 0.5], legF: [0.3, 0.1], legB: [-0.3, -0.4] });
        out.mouth = 'smile';
        break;
      }
      case 'attack': {
        const a = f.atk;
        const def = a ? a.def : null;
        const P = def && ATK[def.pose] ? ATK[def.pose] : ATK.jab;
        const s = def ? def.s : 6, act = def ? def.a : 4, r = def ? def.r : 8;
        const ft = a ? a.t : 0;
        setPose(tmpA, IDLE); setPose(tmpB, P.w);
        if (ft < s) {
          blendPose(out, tmpA, tmpB, TT.easeOut(ft / s));
        } else if (ft < s + act) {
          blendPose(out, P.w, P.h, Math.min(1, (ft - s + 1) / 2));
        } else {
          const k = Math.min(1, (ft - s - act) / Math.max(1, r));
          blendPose(out, P.h, IDLE, TT.easeInOut(k));
        }
        if (def) {
          out.weapon = def.weapon || null;
          out.glow = def.glow || null;
          out.form = def.form || null;
          if (def.shout || ft >= s) out.mouth = def.mouth || 'shout';
        }
        out.cape = Math.max(out.cape, 0.5);
        break;
      }
      default: { // idle
        const b = Math.sin(t * 0.08);
        setPose(out, IDLE);
        out.bob = b * 1.4;
        out.armF[1] += b * 0.05;
        out.armB[1] -= b * 0.05;
      }
    }
    if (f.style && f.style.airIdle && f.z > 0 && f.anim !== 'down') out.legB[1] -= 0.3;
    return out;
  };

  // ------------------------------------------------------------ Desenho do rig
  // Membro em 2 segmentos. o (opcional): split = onde começa a luva/bota (0..2, 1 = joelho/cotovelo),
  // sleeve = manga curta {col, len}, stripe = faixa ao longo do membro, band = braçadeiras [{col, at, gem}],
  // sole = sola da bota. dark = membro de trás (cores escurecidas).
  function limb(ctx, ax, ay, a1, a2, L1, L2, w, c1, c2, endR, endC, isLeg, res, o, dark) {
    const kx = ax + Math.sin(a1) * L1, ky = ay + Math.cos(a1) * L1;
    const ex = kx + Math.sin(a2) * L2, ey = ky + Math.cos(a2) * L2;
    const at = (u) => (u <= 1 ? [ax + (kx - ax) * u, ay + (ky - ay) * u] : [kx + (ex - kx) * (u - 1), ky + (ey - ky) * (u - 1)]);
    const sh = (c) => C(dark ? TT.shade(c, -0.28) : c);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey);
    ctx.strokeStyle = OUT; ctx.lineWidth = w + 5; ctx.stroke();
    ctx.strokeStyle = C(c1); ctx.lineWidth = w; ctx.stroke();
    const split = o && o.split != null ? o.split : 1.4;
    if (o && o.stripe && !FLASH) {
      const [px, py] = at(split);
      ctx.beginPath(); ctx.moveTo(ax, ay); if (split > 1) ctx.lineTo(kx, ky); ctx.lineTo(px, py);
      ctx.strokeStyle = sh(o.stripe); ctx.lineWidth = Math.max(2, w * 0.36); ctx.stroke();
    }
    if (c2 && c2 !== c1) {
      const [mx, my] = at(split);
      ctx.beginPath(); ctx.moveTo(mx, my); if (split < 1) ctx.lineTo(kx, ky); ctx.lineTo(ex, ey);
      ctx.strokeStyle = C(c2); ctx.lineWidth = w + 1; ctx.stroke();
      if (!FLASH) { // borda da luva/bota
        const [bx, by] = at(Math.min(2, split + 0.06));
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(bx, by);
        ctx.strokeStyle = OUT; ctx.lineWidth = w + 3; ctx.stroke();
        ctx.strokeStyle = C(c2); ctx.lineWidth = w + 1; ctx.stroke();
      }
    }
    if (o && o.sleeve) {
      const [sx2, sy2] = at(o.sleeve.len);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(sx2, sy2);
      ctx.strokeStyle = OUT; ctx.lineWidth = w + 8; ctx.stroke();
      ctx.strokeStyle = sh(o.sleeve.col); ctx.lineWidth = w + 3; ctx.stroke();
    }
    if (o && o.band) for (const b of o.band) {
      const bl = b.len || 0.1, [b0x, b0y] = at(b.at - bl), [b1x, b1y] = at(b.at + bl);
      ctx.beginPath(); ctx.moveTo(b0x, b0y); ctx.lineTo(b1x, b1y);
      ctx.strokeStyle = OUT; ctx.lineWidth = w + 6; ctx.stroke();
      ctx.strokeStyle = sh(b.col); ctx.lineWidth = w + 1.5; ctx.stroke();
      if (b.gem && !FLASH) {
        const [gx, gy] = at(b.at);
        ctx.beginPath(); ctx.arc(gx, gy, Math.max(2, w * 0.32), 0, Math.PI * 2); ctx.fillStyle = sh(b.gem); ctx.fill();
      }
    }
    ctx.fillStyle = C(endC); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (isLeg) ctx.ellipse(ex + endR * 0.45, ey + 1, endR * 1.35, endR * 0.75, 0, 0, Math.PI * 2);
    else ctx.arc(ex, ey, endR, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    if (isLeg && o && o.sole && !FLASH) { // sola de aço
      ctx.beginPath(); ctx.ellipse(ex + endR * 0.45, ey + 1, endR * 1.25, endR * 0.62, 0, 0.25, Math.PI - 0.25);
      ctx.strokeStyle = sh(o.sole); ctx.lineWidth = 2.5; ctx.stroke();
    }
    if (res) { res.kx = kx; res.ky = ky; res.ex = ex; res.ey = ey; }
  }

  function torsoPath(ctx, st) {
    const hw = st.hipW / 2, sw = st.shW / 2, th = st.torsoH;
    ctx.beginPath();
    ctx.moveTo(-hw, 3);
    ctx.lineTo(hw, 3);
    ctx.quadraticCurveTo(sw + 4, -th * 0.45, sw, -th + 5);
    ctx.quadraticCurveTo(sw - 1, -th - 2, sw - 8, -th - 2);
    ctx.lineTo(-sw + 8, -th - 2);
    ctx.quadraticCurveTo(-sw + 1, -th - 2, -sw, -th + 5);
    ctx.quadraticCurveTo(-sw - 4, -th * 0.45, -hw, 3);
    ctx.closePath();
  }

  const handF = {}, handB = {};
  // Desenha um personagem humanoide com o estilo dado.
  TT.drawRig = function (ctx, st, pose, x, y, facing, opt) {
    const sc = st.scale * (opt && opt.scale ? opt.scale : 1);
    FLASH = !!(opt && opt.flash);
    const t = opt && opt.t ? opt.t : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing * sc, sc);
    if (pose.rot) { ctx.translate(0, -12); ctx.rotate(pose.rot); }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const L1 = st.legL[0], L2 = st.legL[1];
    const Hx = 0, Hy = -(L1 + L2) + 4 + pose.bob;
    const lean = pose.lean;
    const cl = Math.cos(lean), sl = Math.sin(lean);
    const rot = (px, py) => [Hx + px * cl - py * sl, Hy + px * sl + py * cl];
    const S = rot(0, -st.torsoH);
    const sF = rot(4, -st.torsoH + 5), sB = rot(-5, -st.torsoH + 4);
    const hd = rot(st.headOff || 0, -st.torsoH - st.headR * 0.82);
    const P = { Hx, Hy, S, hd, lean, pose, st, t };

    if (st.drawBack) st.drawBack(ctx, P);

    const dk = st.dark;
    // perna e braço de trás (tons escurecidos)
    limb(ctx, Hx - 4, Hy, pose.legB[0], pose.legB[1], L1, L2, st.legW, dk.leg, dk.boot, st.footR, dk.boot, true, null, st.legOpt, true);
    limb(ctx, sB[0], sB[1], pose.armB[0], pose.armB[1], st.armL[0], st.armL[1], st.armW, dk.arm, dk.glove, st.handR, dk.hand, false, handB, st.armOpt, true);

    // tronco
    ctx.save();
    ctx.translate(Hx, Hy); ctx.rotate(lean);
    torsoPath(ctx, st);
    ctx.fillStyle = C(st.torso); ctx.fill();
    if (st.torsoDetail && !FLASH) { ctx.save(); ctx.clip(); st.torsoDetail(ctx, P); ctx.restore(); }
    torsoPath(ctx, st);
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();

    // perna da frente
    limb(ctx, Hx + 4, Hy, pose.legF[0], pose.legF[1], L1, L2, st.legW, st.leg, st.boot, st.footR, st.boot, true, null, st.legOpt);

    if (st.drawMid) st.drawMid(ctx, P);

    // cabeça
    ctx.save();
    ctx.translate(hd[0], hd[1]);
    ctx.rotate(lean * 0.4 + pose.tilt);
    st.drawHead(ctx, st.headR, pose, t);
    ctx.restore();

    // braço da frente + arma
    limb(ctx, sF[0], sF[1], pose.armF[0], pose.armF[1], st.armL[0], st.armL[1], st.armW, st.arm, st.glove, st.handR, st.hand, false, handF, st.armOpt);
    if (pose.weapon === 'staff') drawStaff(ctx, handF, pose.armF[1]);
    else if (pose.weapon === 'baton' || st.baton) drawBaton(ctx, handF, pose.armF[1], pose.weapon === 'baton');
    if (st.drawFront) st.drawFront(ctx, P, handF, handB);
    if (pose.glow && !FLASH) {
      TT.drawGlow(ctx, pose.glow, handF.ex, handF.ey, 26, 0.9);
      TT.drawGlow(ctx, pose.glow, handB.ex, handB.ey, 20, 0.7);
    }
    ctx.restore();
    FLASH = false;
  };

  function drawStaff(ctx, h, a) {
    const dx = Math.sin(a), dy = Math.cos(a);
    const x1 = h.ex - dx * 26, y1 = h.ey - dy * 26, x2 = h.ex + dx * 62, y2 = h.ey + dy * 62;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = OUT; ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = C('#b9c0cc'); ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2 - dx * 8, y2 - dy * 8); ctx.lineTo(x2, y2);
    ctx.strokeStyle = C('#e9edf3'); ctx.lineWidth = 4; ctx.stroke();
  }

  // Bastão elétrico dos soldados da fase 3 (ponta ciano brilhante; mais forte ao atacar).
  function drawBaton(ctx, h, a, hot) {
    const dx = Math.sin(a), dy = Math.cos(a);
    const x1 = h.ex - dx * 8, y1 = h.ey - dy * 8, x2 = h.ex + dx * 40, y2 = h.ey + dy * 40;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = OUT; ctx.lineWidth = 9; ctx.stroke();
    ctx.strokeStyle = C('#5c6476'); ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(h.ex + dx * 6, h.ey + dy * 6);
    ctx.strokeStyle = C('#1c1c22'); ctx.lineWidth = 6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2 - dx * 10, y2 - dy * 10); ctx.lineTo(x2, y2);
    ctx.strokeStyle = C('#bff6ff'); ctx.lineWidth = 6; ctx.stroke();
    if (!FLASH) TT.drawGlow(ctx, '#6fe3ff', x2, y2, hot ? 26 : 14, hot ? 1 : 0.7);
  }

  // ------------------------------------------------------------ Rostos
  function headCircle(ctx, r, skin) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = C(skin); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
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
    st.dark = {
      leg: TT.shade(st.leg, -0.28), boot: TT.shade(st.boot, -0.28), arm: TT.shade(st.arm, -0.28),
      glove: TT.shade(st.glove, -0.28), hand: TT.shade(st.hand, -0.28),
    };
    return st;
  }

  const S = {};
  TT.STYLES = S;

  // Proporções dos Titãs (série de 2003 / jogo de 2006): corpos mais esguios, mãos e pés maiores,
  // cabeças um pouco menores que o padrão dos inimigos.
  const SLIM = { headR: 19.5, torsoH: 38, shW: 27, hipW: 20, legL: [27, 27], armL: [20, 19], legW: 8, armW: 7, handR: 6.6, footR: 8 };

  S.robin = mkStyle(Object.assign({}, SLIM, {
    skin: '#f7c9a1', torso: '#d7262e', arm: '#2f9a48', glove: '#25823b', hand: '#25823b', leg: '#2f9a48', boot: '#1c1c22',
    armOpt: { split: 1.5, sleeve: { col: '#d7262e', len: 0.42 } },
    legOpt: { split: 1.42, sole: '#a9b2c2' },
    drawBack(ctx, P) { // capa preta por fora, amarela por dentro (até os joelhos)
      const [sx, sy] = P.S;
      const flow = P.pose.cape, wv = Math.sin(P.t * 0.12) * 2;
      const tx = sx - 24 - flow * 34, ty = P.Hy + 30 - flow * 26 + wv;
      ctx.beginPath();
      ctx.moveTo(sx + 8, sy - 3);
      ctx.quadraticCurveTo(sx - 30, sy + 10, tx - 6, ty + 4);
      ctx.lineTo(tx + 22, ty + 12);
      ctx.quadraticCurveTo(sx - 4, sy + 34, sx + 6, sy + 4);
      ctx.closePath();
      ctx.fillStyle = C('#f2c428'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + 6, sy - 4);
      ctx.quadraticCurveTo(sx - 36, sy + 4, tx - 12, ty);
      ctx.lineTo(tx + 10, ty + 7);
      ctx.quadraticCurveTo(sx - 14, sy + 24, sx, sy + 6);
      ctx.closePath();
      ctx.fillStyle = C('#141419'); ctx.fill(); ctx.stroke();
      // gola alta da capa atrás do pescoço
      ctx.beginPath(); ctx.moveTo(sx - 8, sy - 2); ctx.lineTo(sx - 12, sy - 14); ctx.lineTo(sx + 2, sy - 6); ctx.closePath();
      ctx.fillStyle = C('#141419'); ctx.fill(); ctx.stroke();
    },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      // fecho da túnica e gola
      ctx.strokeStyle = '#8f1218'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(2, -th); ctx.lineTo(0, -10); ctx.stroke();
      ctx.fillStyle = '#141419'; ctx.fillRect(-16, -th - 4, 28, 5);
      // cinto de utilidades amarelo com bolsinhos
      ctx.fillStyle = '#f2c428'; ctx.fillRect(-18, -9, 36, 8);
      ctx.fillStyle = '#c99a12';
      for (let i = -12; i <= 12; i += 6) ctx.fillRect(i - 2, -8, 4, 6);
      ctx.fillStyle = '#8a6a08'; ctx.fillRect(-18, -2, 36, 1.5);
      // emblema "R" no peito esquerdo (lado à frente)
      ctx.beginPath(); ctx.arc(7, -th + 12, 5.6, 0, Math.PI * 2);
      ctx.fillStyle = '#f2c428'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = OUT; ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('R', 7, -th + 12.5);
    },
    drawHead(ctx, r, pose) {
      headCircle(ctx, r, '#f7c9a1');
      // cabelo preto espetado para trás
      spikyCap(ctx, r, '#16161c', [[0.75, -0.9], [0.4, -1.12], [0.15, -1.0], [-0.2, -1.32], [-0.45, -1.0], [-0.95, -1.28], [-0.88, -0.72], [-1.5, -0.62], [-1.0, -0.2], [-1.42, 0.12], [-0.9, 0.3]]);
      if (!FLASH) {
        // orelha
        ctx.beginPath(); ctx.ellipse(-r * 0.12, r * 0.12, r * 0.15, r * 0.22, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#efb68a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        // máscara preta com pontas e olhos brancos sem pupila
        ctx.beginPath();
        ctx.moveTo(-r * 0.12, -r * 0.02);
        ctx.lineTo(-r * 0.02, -r * 0.34); ctx.quadraticCurveTo(r * 0.4, -r * 0.42, r * 0.98, -r * 0.32);
        ctx.lineTo(r * 1.02, r * 0.02); ctx.quadraticCurveTo(r * 0.55, r * 0.22, r * 0.36, r * 0.08);
        ctx.quadraticCurveTo(r * 0.2, r * 0.22, -r * 0.12, -r * 0.02);
        ctx.closePath();
        ctx.fillStyle = '#141419'; ctx.fill();
        for (const [ex, k] of [[r * 0.18, 1], [r * 0.7, 0.72]]) {
          ctx.beginPath(); ctx.ellipse(ex, -r * 0.1, r * 0.2 * k, r * 0.12, 0.08, 0, Math.PI * 2);
          ctx.fillStyle = pose.eyes === 'shut' ? '#141419' : '#ffffff'; ctx.fill();
        }
      }
      mouth(ctx, r, pose);
    },
  }));

  S.starfire = mkStyle(Object.assign({}, SLIM, {
    skin: '#f6a54f', torso: '#7b2fbc', arm: '#f6a54f', glove: '#f6a54f', hand: '#f6a54f', leg: '#f6a54f', boot: '#7b2fbc', airIdle: true,
    shW: 25, hipW: 20, armW: 6.5,
    armOpt: { band: [{ col: '#c7cbd6', at: 1.62, gem: '#3ee07a' }, { col: '#c7cbd6', at: 0.32 }] },
    legOpt: { split: 0.64 }, // botas roxas até a coxa
    drawBack(ctx, P) { // cabelo ruivo muito longo e liso
      const [hx, hy] = P.hd, r = P.st.headR;
      const flow = 0.3 + P.pose.cape * 0.7;
      const wave = Math.sin(P.t * 0.12) * 3;
      const bot = P.Hy + 34;
      ctx.beginPath();
      ctx.moveTo(hx + r * 0.7, hy - r * 0.95);
      ctx.quadraticCurveTo(hx - r * 1.5, hy - r * 1.3, hx - r * 1.25 - flow * 10, hy + r * 1.2);
      ctx.quadraticCurveTo(hx - r * 1.2 - flow * 26, (hy + bot) / 2 + wave, hx - r * 1.0 - flow * 34, bot + wave);
      ctx.lineTo(hx - r * 0.1 - flow * 26, bot - 4 + wave);
      ctx.quadraticCurveTo(hx - r * 0.1 - flow * 10, hy + r * 2, hx + r * 0.1, hy + r * 0.4);
      ctx.closePath();
      ctx.fillStyle = C('#c71f2b'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      if (!FLASH) {
        ctx.strokeStyle = '#ff5a52'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(hx - r * 0.7, hy - r * 0.4); ctx.quadraticCurveTo(hx - r * 1.2 - flow * 16, hy + r * 1.6, hx - r * 0.8 - flow * 28, bot - 8 + wave); ctx.stroke();
        ctx.strokeStyle = '#8f121b'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(hx - r * 0.3, hy + r * 0.8); ctx.quadraticCurveTo(hx - r * 0.6 - flow * 14, hy + r * 2.6, hx - r * 0.45 - flow * 24, bot - 6 + wave); ctx.stroke();
      }
    },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      ctx.fillStyle = '#f6a54f'; ctx.fillRect(-20, -th * 0.56, 40, th * 0.36); // barriga (top curto)
      ctx.fillStyle = '#5c1f92'; ctx.fillRect(-20, -th * 0.22, 40, 3);
      ctx.fillStyle = '#c7cbd6'; ctx.fillRect(-18, -th - 4, 32, 5); // colar prateado
      ctx.beginPath(); ctx.arc(3, -th + 3, 4.2, 0, Math.PI * 2); // gema verde
      ctx.fillStyle = '#3ee07a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#e8fff0'; ctx.fillRect(1.5, -th + 1, 1.6, 1.6);
    },
    drawMid(ctx, P) { // saia roxa curta
      ctx.save(); ctx.translate(P.Hx, P.Hy); ctx.rotate(P.lean * 0.6);
      ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(12, -6); ctx.lineTo(16, 9); ctx.lineTo(-15, 9); ctx.closePath();
      ctx.fillStyle = C('#7b2fbc'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    },
    drawHead(ctx, r, pose) {
      headCircle(ctx, r, '#f6a54f');
      ctx.beginPath(); // franja reta
      ctx.moveTo(-r * 1.05, r * 0.55);
      ctx.quadraticCurveTo(-r * 1.25, -r * 1.25, r * 0.3, -r * 1.1);
      ctx.quadraticCurveTo(r * 1.2, -r * 0.8, r * 1.02, -r * 0.3);
      ctx.lineTo(r * 0.8, -r * 0.38); ctx.lineTo(r * 0.55, -r * 0.36); ctx.lineTo(r * 0.3, -r * 0.4); ctx.lineTo(r * 0.02, -r * 0.36);
      ctx.quadraticCurveTo(-r * 0.4, -r * 0.3, -r * 0.55, r * 0.6);
      ctx.closePath();
      ctx.fillStyle = C('#c71f2b'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      // olhos totalmente verdes (sem esclera branca)
      eyes(ctx, r, pose, { white: '#36e07a', iris: '#0f9c45', tall: 1.15, wide: 1.1 });
      mouth(ctx, r, pose);
    },
  }));

  S.cyborg = mkStyle({
    scale: 1.12, skin: '#6e4a33', torso: '#d6dbe4', arm: '#c7ccd6', glove: '#8a92a3', hand: '#9aa3b4', leg: '#c7ccd6', boot: '#8a92a3',
    shW: 40, hipW: 29, torsoH: 42, armW: 12, legW: 12, handR: 8.6, footR: 9.6, headR: 19, legL: [27, 26], armL: [21, 20],
    armOpt: { split: 1.55, band: [{ col: '#3c6fd6', at: 1.22, len: 0.07 }] },
    legOpt: { split: 1.5, band: [{ col: '#3c6fd6', at: 0.5, len: 0.08 }], sole: '#5d6575' },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      // placas azuis: peito, abdômen e ombros
      ctx.fillStyle = '#3c6fd6';
      ctx.beginPath(); ctx.moveTo(-14, -th + 4); ctx.lineTo(16, -th + 4); ctx.lineTo(12, -th + 20); ctx.lineTo(-10, -th + 20); ctx.closePath(); ctx.fill();
      ctx.fillRect(-7, -th + 23, 14, th - 32);
      ctx.fillRect(-22, -th + 2, 6, 10); ctx.fillRect(16, -th + 2, 6, 10);
      ctx.strokeStyle = '#8f98aa'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-18, -th * 0.45); ctx.lineTo(-9, -th * 0.45); ctx.moveTo(9, -th * 0.45); ctx.lineTo(18, -th * 0.45); ctx.stroke();
      ctx.fillStyle = '#9aa3b4'; ctx.fillRect(-22, -11, 44, 7); // cintura
      // luz vermelha no peito
      ctx.beginPath(); ctx.arc(1, -th + 12, 4, 0, Math.PI * 2); ctx.fillStyle = '#ff3b3b'; ctx.fill();
      TT.drawGlow(ctx, '#ff2a2a', 1, -th + 12, 10, 0.8);
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-20, -th + 2, 6, th - 14);
    },
    drawHead(ctx, r, pose) {
      headCircle(ctx, r, '#d6dbe4'); // crânio metálico careca
      if (!FLASH) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.6, r * 0.45, r * 0.18, -0.3, 0, Math.PI * 2); ctx.fill();
        // metade humana do rosto (pele escura) do lado de perto
        ctx.beginPath();
        ctx.moveTo(-r * 0.05, -r * 0.5); ctx.lineTo(r * 0.44, -r * 0.52); ctx.lineTo(r * 0.44, r * 0.98);
        ctx.quadraticCurveTo(r * 0.1, r * 1.0, -r * 0.2, r * 0.62); ctx.quadraticCurveTo(-r * 0.2, -r * 0.1, -r * 0.05, -r * 0.5); ctx.closePath();
        ctx.fillStyle = '#6e4a33'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        // placa metálica do lado esquerdo do rosto (à frente) com o olho vermelho
        ctx.beginPath(); ctx.moveTo(r * 0.44, -r * 0.52); ctx.lineTo(r * 0.98, -r * 0.32); ctx.lineTo(r * 0.98, r * 0.35); ctx.quadraticCurveTo(r * 0.8, r * 0.9, r * 0.44, r * 0.98); ctx.closePath();
        ctx.fillStyle = '#bcc3d0'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
        // peça do ouvido (azul)
        ctx.strokeStyle = '#8f98aa'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(-r * 0.48, r * 0.08, r * 0.3, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(-r * 0.48, r * 0.08, r * 0.13, 0, Math.PI * 2); ctx.fillStyle = '#3c6fd6'; ctx.fill();
        // olho humano
        if (pose.eyes === 'shut' || pose.eyes === 'x') { ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(r * 0.04, -r * 0.08); ctx.lineTo(r * 0.32, -r * 0.06); ctx.stroke(); }
        else {
          ctx.beginPath(); ctx.ellipse(r * 0.18, -r * 0.08, r * 0.15, r * 0.2, 0, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
          ctx.beginPath(); ctx.arc(r * 0.24, -r * 0.06, r * 0.08, 0, Math.PI * 2); ctx.fillStyle = OUT; ctx.fill();
        }
        ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(r * 0.0, -r * 0.36); ctx.lineTo(r * 0.36, -r * 0.3); ctx.stroke();
        // olho cibernético vermelho brilhante
        ctx.beginPath(); ctx.arc(r * 0.68, -r * 0.08, r * 0.17, 0, Math.PI * 2); ctx.fillStyle = '#2a2d36'; ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.7, -r * 0.08, r * 0.1, 0, Math.PI * 2); ctx.fillStyle = '#ff2a2a'; ctx.fill();
        TT.drawGlow(ctx, '#ff2a2a', r * 0.7, -r * 0.08, 10, 0.9);
      }
      mouth(ctx, r, pose, r * 0.28, r * 0.52);
    },
    drawFront(ctx, P, hF) { // canhão sônico saindo do braço
      if (P.pose.form !== 'cannon') return;
      const a = P.pose.armF[1];
      const dx = Math.sin(a), dy = Math.cos(a);
      ctx.beginPath(); ctx.moveTo(hF.ex - dx * 14, hF.ey - dy * 14); ctx.lineTo(hF.ex + dx * 14, hF.ey + dy * 14);
      ctx.strokeStyle = OUT; ctx.lineWidth = 22; ctx.stroke();
      ctx.strokeStyle = C('#8a92a3'); ctx.lineWidth = 16; ctx.stroke();
      ctx.strokeStyle = C('#3c6fd6'); ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(hF.ex - dx * 4, hF.ey - dy * 4); ctx.lineTo(hF.ex + dx * 2, hF.ey + dy * 2); ctx.stroke();
      if (!FLASH) {
        ctx.beginPath(); ctx.arc(hF.ex + dx * 15, hF.ey + dy * 15, 6.5, 0, Math.PI * 2); ctx.fillStyle = '#bfe6ff'; ctx.fill();
        TT.drawGlow(ctx, '#4fb4ff', hF.ex + dx * 18, hF.ey + dy * 18, 26, 1);
      }
    },
  });

  S.raven = mkStyle(Object.assign({}, SLIM, {
    skin: '#cfc8dc', torso: '#1d1a33', arm: '#1d1a33', glove: '#1d1a33', hand: '#cfc8dc', leg: '#cfc8dc', boot: '#2c3384',
    shW: 25, hipW: 20, armW: 6.5,
    legOpt: { split: 1.62 },
    drawBack(ctx, P) { // manto azul-escuro longo
      const [sx, sy] = P.S;
      const flow = P.pose.cape;
      const wv = Math.sin(P.t * 0.1) * 3;
      ctx.beginPath();
      ctx.moveTo(sx + 12, sy - 6);
      ctx.quadraticCurveTo(sx + 28, sy + 44, sx + 18 - flow * 8, -4 + wv);
      ctx.lineTo(sx - 36 - flow * 38, -2 - flow * 20 + wv);
      ctx.quadraticCurveTo(sx - 28 - flow * 12, sy + 20, sx - 10, sy - 8);
      ctx.closePath();
      ctx.fillStyle = C('#2c3384'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      if (!FLASH) {
        ctx.strokeStyle = '#3e48b0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx - 6, sy + 6); ctx.quadraticCurveTo(sx - 18 - flow * 10, sy + 30, sx - 22 - flow * 28, -4 + wv); ctx.stroke();
        ctx.strokeStyle = '#1c2160';
        ctx.beginPath(); ctx.moveTo(sx + 8, sy + 8); ctx.quadraticCurveTo(sx + 14, sy + 40, sx + 6, -4 + wv); ctx.stroke();
      }
      // capuz levantado (parte de trás)
      const [hx, hy] = P.hd, r = P.st.headR;
      ctx.beginPath(); ctx.ellipse(hx - r * 0.2, hy - r * 0.08, r * 1.34, r * 1.34, 0, 0, Math.PI * 2);
      ctx.fillStyle = C('#2c3384'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    },
    torsoDetail(ctx, P) {
      // cinto de discos dourados com gemas vermelhas
      for (let i = -12; i <= 12; i += 8) {
        ctx.beginPath(); ctx.arc(i, -6, 3.4, 0, Math.PI * 2); ctx.fillStyle = '#e2b23c'; ctx.fill();
        ctx.beginPath(); ctx.arc(i, -6, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#d61f3a'; ctx.fill();
      }
    },
    drawMid(ctx, P) { // broche dourado com gema vermelha prendendo o manto
      const [sx, sy] = P.S;
      ctx.beginPath(); ctx.arc(sx + 4, sy + 3, 4.6, 0, Math.PI * 2); ctx.fillStyle = C('#e2b23c'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.8; ctx.stroke();
      if (!FLASH) { ctx.beginPath(); ctx.arc(sx + 4, sy + 3, 2.2, 0, Math.PI * 2); ctx.fillStyle = '#d61f3a'; ctx.fill(); }
    },
    drawHead(ctx, r, pose) {
      headCircle(ctx, r, '#cfc8dc');
      ctx.beginPath(); // cabelo violeta-escuro emoldurando o rosto
      ctx.moveTo(-r * 0.9, r * 0.7);
      ctx.quadraticCurveTo(-r * 1.1, -r * 1.1, r * 0.35, -r * 1.02);
      ctx.quadraticCurveTo(r * 1.1, -r * 0.8, r * 0.98, -r * 0.18);
      ctx.lineTo(r * 0.55, -r * 0.5); ctx.lineTo(r * 0.1, -r * 0.46);
      ctx.quadraticCurveTo(-r * 0.4, -r * 0.3, -r * 0.42, r * 0.8);
      ctx.closePath();
      ctx.fillStyle = C('#4a3080'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
      eyes(ctx, r, pose, { iris: '#7b55c9', white: '#f0ecff', lid: '#b9b1cc', tall: 0.85 });
      if (!FLASH) { // chakra vermelho na testa
        ctx.beginPath(); ctx.ellipse(r * 0.42, -r * 0.47, r * 0.08, r * 0.1, 0, 0, Math.PI * 2); ctx.fillStyle = '#d61f3a'; ctx.fill();
      }
      mouth(ctx, r, pose);
      // borda do capuz levantado na frente do rosto
      ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.05, r * 1.3, -Math.PI * 0.72, -Math.PI * 0.1);
      ctx.strokeStyle = OUT; ctx.lineWidth = 9; ctx.stroke();
      ctx.strokeStyle = C('#2c3384'); ctx.lineWidth = 6; ctx.stroke();
      if (!FLASH) { ctx.strokeStyle = '#3e48b0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.05, r * 1.3, -Math.PI * 0.62, -Math.PI * 0.3); ctx.stroke(); }
    },
  }));

  S.beastboy = mkStyle(Object.assign({}, SLIM, {
    skin: '#79c64c', torso: '#211d29', arm: '#211d29', glove: '#a3aab4', hand: '#a3aab4', leg: '#211d29', boot: '#a3aab4',
    headR: 19, shW: 26, hipW: 20,
    armOpt: { split: 1.48, stripe: '#7d45bf' },
    legOpt: { split: 1.45, stripe: '#7d45bf' },
    torsoDetail(ctx, P) {
      const th = P.st.torsoH;
      // laterais roxas do uniforme
      ctx.fillStyle = '#7d45bf'; ctx.fillRect(-20, -th + 4, 7, th);
      ctx.fillRect(13, -th + 4, 7, th);
      ctx.fillStyle = '#b8bec8'; ctx.fillRect(-20, -9, 40, 6); // cinto prata
      ctx.fillStyle = '#e6e9ee'; ctx.fillRect(-3, -9, 6, 6);
      ctx.fillStyle = '#79c64c'; ctx.fillRect(-6, -th - 4, 12, 6); // pescoço
      ctx.fillStyle = '#7d45bf'; ctx.fillRect(-9, -th - 4, 18, 3); // gola
    },
    drawHead(ctx, r, pose) {
      ctx.beginPath(); // orelha pontuda
      ctx.moveTo(-r * 0.25, -r * 0.18); ctx.lineTo(-r * 1.35, -r * 0.85); ctx.lineTo(-r * 0.55, r * 0.38); ctx.closePath();
      ctx.fillStyle = C('#79c64c'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
      if (!FLASH) { ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.1); ctx.lineTo(-r * 1.05, -r * 0.6); ctx.lineTo(-r * 0.6, r * 0.18); ctx.closePath(); ctx.fillStyle = '#5ea83a'; ctx.fill(); }
      headCircle(ctx, r, '#79c64c');
      // cabelo verde-escuro espetado
      spikyCap(ctx, r, '#3a7f21', [[0.9, -0.8], [0.55, -1.25], [0.3, -0.95], [-0.05, -1.4], [-0.4, -1.0], [-0.95, -1.18], [-0.82, -0.6], [-1.32, -0.35], [-0.95, 0.02]]);
      eyes(ctx, r, pose, { iris: '#2e7d1e', brow: true });
      mouth(ctx, r, pose, null, null, true); // dente canino aparente
    },
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
  TT.drawGorilla = function (ctx, x, y, facing, t, s, flash) {
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
    const pose = newPose();
    if (key === 'raven') { // capuz
      g.beginPath(); g.ellipse(-3, -1, 29, 28, 0, 0, Math.PI * 2); g.fillStyle = '#2c3384'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
    }
    if (key === 'starfire') {
      g.beginPath(); g.moveTo(10, -22); g.quadraticCurveTo(-40, -30, -30, 34); g.lineTo(0, 30); g.closePath(); g.fillStyle = '#c71f2b'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
    }
    st.drawHead(g, 22, pose, 0);
    portraitCache.set(k, c);
    return c;
  };
})();
