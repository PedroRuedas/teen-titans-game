'use strict';
// Cutscene do "Titãs, avante!": o mundo congela e, numa cena própria, os cinco Titãs entram um de
// cada vez e fazem o seu combo no inimigo (o chefe, se houver; senão o inimigo mais perto). No fim
// os cinco aparecem juntos, disparam ao mesmo tempo e a explosão atinge todos os inimigos da tela.
// Os golpes mostrados são os de cada Titã (os novos, a partir da fase 7). ATAQUE / PULO / ENTER pulam
// direto para o final.
(function () {
  const TT = window.TT;
  const W = TT.W, H = TT.H, OUT = '#17121f';
  const A = () => TT.audio;

  const INTRO = 44;            // faixas com os retratos sobre o jogo congelado
  const GY = 600;              // chão da cena
  const TX = 880;              // posição do alvo na tela
  const BAR = 62;              // faixas pretas de cinema
  const FINALE = { land: 18, beams: 20, boom: 40, fade: 58, end: 78 };
  const WORDS = ['POW!', 'BAM!', 'WHAM!', 'KAPOW!', 'CRASH!', 'THWACK!'];

  // Golpes de cada Titã na cutscene: [golpe, opções]. cap = corta golpes longos (feixes, T-Rex).
  // shots = quantos projéteis o golpe dispara (golpes sem dano corpo a corpo).
  const SCRIPT = {
    robin: (d) => [[d.light[2]], [d.special, { shots: 3, kind: d.plus ? 'bomb' : 'birdarang', col: d.plus ? '#ff5a3a' : '#ffd23a' }]],
    starfire: (d) => [[d.light[2], { shots: d.plus ? 2 : 1, kind: 'bolt', col: '#5dff8a' }],
      d.plus ? [d.special, { rain: 7, col: '#5dff8a' }] : [d.special, { cap: 18 }]],
    cyborg: (d) => [[d.light[2]], [d.special, { cap: 20 }]],
    beastboy: (d) => [[d.light[1]], [d.special, { cap: 26 }]],
    raven: (d) => [[d.light[2]], [d.special, { soul: true }]],
  };
  const CAPTION = {
    robin: ['BASTÃO + BIRDARANGUES', 'BASTÃO ELÉTRICO + DISCOS EXPLOSIVOS'],
    starfire: ['STARBOLT + RAIOS OCULARES', 'STARBOLTS + CHUVA DE STARBOLTS'],
    cyborg: ['CANHÃO SÔNICO — BOOYAH!', 'CANHÃO SÔNICO MÁXIMO — BOOYAH!'],
    beastboy: ['T-REX', 'A FERA'],
    raven: ['AZARATH METRION ZINTHOS!', 'AZARATH METRION ZINTHOS!'],
  };
  // Posição de cada Titã na pose final (todos juntos).
  const LINEUP = { robin: [440, 10], starfire: [330, -14], cyborg: [560, -6], beastboy: [210, 4], raven: [660, 12] };

  class SuperCutscene {
    constructor(game, by) {
      this.g = game; this.by = by || game.player;
      this.t = 0; this.done = false; this.hits = 0;
      this.fx = new TT.Particles();
      this.shots = [];
      this.flashT = 0; this.white = 0;
      this.shown = new Set();
      this.pickTarget();
      this.tz = 0; this.tvz = 0; this.tdx = 0; this.thurt = 0; this.gone = false;
      // quem chamou o "Titãs, avante!" começa; os outros vêm na ordem da equipe
      const order = TT.TITAN_ORDER.slice();
      const first = order.indexOf(this.by.key);
      if (first > 0) order.unshift(order.splice(first, 1)[0]);
      this.queue = order.map((k) => {
        const a = new TT.Titan(game, k);
        a.setPower(game.power || 0);
        a.x = -200; a.y = GY; a.facing = 1;
        const moves = SCRIPT[k](a.def).map(([def, o]) => Object.assign({ def }, o));
        return { a, key: k, moves, mi: 0, phase: 'wait', pt: 0, alpha: 1 };
      });
      this.live = [];
      this.next = 0;
      this.finale = -1;
    }

    // Quantos quadros faltam (aproximado) — só precisa ser > 0 enquanto a cena roda.
    get left() { return this.done ? 0 : Math.max(1, 400 - this.t); }

    pickTarget() {
      const g = this.g, onScreen = (e) => !e.dead && Math.abs(e.x - g.camX - W / 2) < W / 2 + 80;
      let tg = g.boss && g.boss.active && onScreen(g.boss) ? g.boss : null;
      if (!tg) {
        let best = 1e9;
        for (const e of g.enemies) {
          if (!onScreen(e) || e.isBoss) continue;
          const d = Math.abs(e.x - this.by.x) + Math.abs(e.y - this.by.y) * 2;
          if (d < best) { best = d; tg = e; }
        }
      }
      // sem inimigo na tela: um soldado da H.I.V.E. só para a cena
      this.target = tg || new TT.Enemy(g, 'hive', 0, GY);
      const h = this.target.height || 120;
      this.tScale = Math.min(1, 230 / h);
      this.tH = Math.min(h, 230);
    }

    // ------------------------------------------------------------------ Atualização
    update(inp) {
      this.t++;
      this.fx.update();
      if (this.flashT > 0) this.flashT--;
      if (this.white > 0) this.white--;
      if (this.thurt > 0) this.thurt--;
      this.tdx *= 0.85;
      // alvo: quica no ar com os golpes (malabarismo)
      if (this.finale < 0 || this.finale < FINALE.beams) {
        if (this.tz > 0 || this.tvz) { this.tvz -= 0.75; this.tz += this.tvz; if (this.tz <= 0) { this.tz = 0; this.tvz = 0; } }
      }
      this.updateShots();
      // pular a cena (depois do começo, para o próprio botão do avante não pular)
      if (this.t > INTRO && this.finale < FINALE.boom && inp && (inp.wasPressed('light') || inp.wasPressed('jump') || inp.wasPressed('start'))) {
        this.startFinale(FINALE.boom - 2);
        return;
      }
      if (this.t < INTRO) return;
      if (this.t === INTRO) { this.white = 8; A().play('whoosh'); }
      if (this.finale >= 0) { this.updateFinale(); return; }
      if (!this.live.length || this.live[this.live.length - 1].phase === 'exit') {
        if (this.next < this.queue.length) this.enter(this.queue[this.next++]);
        else if (this.live.every((s) => s.phase === 'gone')) this.startFinale(0);
      }
      for (const s of this.live) this.updateActor(s);
      this.live = this.live.filter((s) => s.phase !== 'gone');
      if (!this.live.length && this.next >= this.queue.length) this.startFinale(0);
    }

    enter(s) {
      s.phase = 'enter'; s.pt = 0;
      const a = s.a;
      a.x = -160; a.z = s.key === 'starfire' ? 120 : 0; a.vx = 12;
      a.state = 'dash'; a.anim = 'dash'; a.animT = 0; a.atk = null;
      this.live.push(s); this.shown.add(s.key);
      A().play(s.key === 'beastboy' ? 'roar' : 'whoosh');
    }

    // Posição em que o Titã para para fazer o golpe.
    wantX(m) {
      const d = m.def;
      if (m.shots || m.rain || m.soul || d.beam || !d.dmg) return TX - 430;
      return TX - Math.max(90, Math.min(190, (d.reach ? d.reach[1] : 100) * 0.8 + 10));
    }

    updateActor(s) {
      const a = s.a;
      s.pt++; a.animT++;
      const m = s.moves[s.mi];
      if (s.phase === 'enter') {
        const want = this.wantX(m);
        a.x += (want - a.x) * 0.42;
        if (a.key !== 'starfire') a.z = 0; else a.z += (30 - a.z) * 0.3;
        if (Math.abs(want - a.x) < 10 || s.pt > 9) this.startMove(s);
        return;
      }
      if (s.phase === 'move') {
        const at = a.atk, d = m.def;
        a.x += (this.wantX(m) - a.x) * 0.3;
        if (a.key === 'starfire') a.z += ((m.rain ? 90 : 30) - a.z) * 0.2;
        // câmera rápida: os golpes andam 1,5x (dois quadros do golpe a cada dois da cena); cada quadro do
        // golpe ainda passa por moveFrame, então nenhum acerto é pulado
        for (let k = s.pt % 2 === 0 ? 2 : 1; k > 0; k--) {
          at.t++;
          this.moveFrame(s, m, at.t);
          // golpes longos são encurtados: o resto do golpe some depressa
          if (m.cap && at.t === d.s + m.cap && at.t < d.s + d.a - 3) at.t = d.s + d.a - 3;
          const end = d.s + d.a + Math.min(d.r, 6) + (m.soul ? 14 : 0);
          if (at.t >= end) {
            if (++s.mi < s.moves.length) this.startMove(s);
            else { s.phase = 'exit'; s.pt = 0; a.atk = null; a.state = 'dash'; a.anim = 'dash'; a.animT = 0; A().play('whoosh'); }
            return;
          }
        }
        return;
      }
      if (s.phase === 'exit') {
        // sai atravessando a tela por cima do alvo
        a.x += 30; a.z += a.key === 'starfire' || a.key === 'raven' ? 8 : 0;
        s.alpha = Math.max(0, 1 - s.pt / 10);
        if (s.pt > 10) s.phase = 'gone';
      }
    }

    startMove(s) {
      const a = s.a, m = s.moves[s.mi];
      s.phase = 'move'; s.pt = 0;
      a.atk = { def: m.def, t: 0, hits: new Set(), landed: false };
      a.state = 'attack'; a.anim = 'attack'; a.animT = 0; a.vx = 0;
      if (m.def.sound0) A().play(m.def.sound0);
      if (m.def.form) this.puff(a.x, GY - 70, '#8dff5a');
      if (m.soul && TT.VOICED.includes('raven')) A().voice('raven', 'Azarath Metrion Zinthos!');
    }

    // Acertos de cada quadro do golpe.
    moveFrame(s, m, t) {
      const d = m.def, a = s.a, col = a.def.fx || a.def.color;
      if (t === d.s && d.sound) A().play(d.sound);
      if (m.rain) {
        if (t >= d.s && t < d.s + m.rain * 4 && (t - d.s) % 4 === 0) {
          this.shots.push({ x: TX + TT.rand(-60, 60), y: -40, kind: 'bolt', col: m.col, r: 18, sp: 22, t: 0, from: 'sky' });
          A().play('starbolt');
        }
        return;
      }
      if (m.soul) {
        if (t === d.s) { this.soul = { x: a.x + 40, y: GY - a.z - 110, t: 0, plus: !!a.def.plus }; A().play('dark'); }
        return;
      }
      if (m.shots) {
        if (t === d.s) {
          const hx = a.rigOut && a.rigOut.fx != null ? a.rigOut.fx : a.x + 50, hy = a.rigOut && a.rigOut.fy != null ? a.rigOut.fy : GY - a.z - 100;
          for (let i = 0; i < m.shots; i++) {
            this.shots.push({ x: hx, y: hy, kind: m.kind, col: m.col, r: m.kind === 'bolt' ? 16 : 14, sp: 15 + i * 2, t: -i * 4, wob: (i - (m.shots - 1) / 2) * 50 });
          }
          A().play(m.kind === 'bolt' ? 'starbolt' : 'birdarang');
        }
        return;
      }
      if (d.beam) {
        // o feixe é reto: o alvo desce até a altura dele e fica preso, sacudindo
        if (t >= d.s - 4) { this.tz *= 0.6; this.tvz = 0; }
        if (t >= d.s && t < d.s + d.a && (t - d.s) % 5 === 0) this.hit(d.beam === 'eyes' ? 3 : 4, col, (t - d.s) % 15 === 0, false);
        return;
      }
      if (d.dmg && t >= d.s && t < d.s + d.a) {
        const re = d.rehit ? (t - d.s) % d.rehit === 0 : t === d.s;
        if (re) this.hit(d.big ? 8 : 5, col, true);
      }
    }

    updateShots() {
      const cx = TX + this.tdx, cy = GY - this.tz - this.tH * 0.5;
      for (const p of this.shots) {
        p.t++;
        if (p.t <= 0) continue;
        const ty = cy + (p.wob || 0) * Math.max(0, 1 - p.t / 14);
        const dx = cx - p.x, dy = ty - p.y, L = Math.hypot(dx, dy);
        if (L < p.sp + 10) {
          p.dead = true;
          const big = p.kind === 'bomb' || p.from === 'sky';
          this.hit(big ? 7 : 5, p.col, true);
          if (big) this.burst(cx, cy, p.col, 0.7);
          continue;
        }
        p.x += dx / L * p.sp; p.y += dy / L * p.sp;
        if (p.t % 2 === 0) this.fx.spawn('glow', p.x, p.y, { color: p.col, size: p.r * 2.2, life: 8 });
      }
      this.shots = this.shots.filter((p) => !p.dead);
      // corvo de alma da Ravena: voa até o alvo e explode em energia negra
      const sv = this.soul;
      if (sv) {
        sv.t++;
        const k = Math.min(1, sv.t / 14);
        sv.cx = TT.lerp(sv.x, cx, TT.easeInOut(k)); sv.cy = TT.lerp(sv.y, cy - 40, TT.easeInOut(k));
        if (sv.t === 14) {
          this.hit(14, '#b98cff', true); this.burst(cx, cy, '#a77bff', 1.1);
          for (let i = 0; i < 12; i++) this.fx.spawn('feather', cx + TT.rand(-80, 80), cy + TT.rand(-90, 60), { color: '#1a0f2e', size: 12, vx: TT.rand(-3, 3), vy: TT.rand(-4, 1), life: 34, vr: 0.2 });
          A().play('boom');
        }
        if (sv.t > 30) this.soul = null;
      }
    }

    // Golpe no alvo: brilho, palavra de quadrinho, alvo sobe no ar.
    hit(power, col, word, lift) {
      this.hits++;
      this.thurt = 8; this.flashT = 4; this.tdx = Math.min(40, this.tdx + power * 2.2);
      if (lift !== false) this.tvz = Math.max(this.tvz, power * 1.1 + (this.tz > 60 ? 0 : 3));
      if (word && this.t - (this.lastWord || -99) < 7) word = false; // sem palavras empilhadas
      if (word) this.lastWord = this.t;
      const x = TX + this.tdx, y = GY - this.tz - this.tH * 0.55;
      const n = power > 6 ? 12 : 7;
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, sp = TT.rand(4, power > 6 ? 14 : 9);
        this.fx.spawn('spark', x, y, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, color: TT.choice([col, '#ffffff', '#fff6b0']), size: 5, life: TT.randi(8, 14) });
      }
      this.fx.spawn('star', x, y, { size: power > 6 ? 40 : 26, color: '#fffbe0', life: 7, rot: Math.random() });
      this.fx.spawn('ring', x, y, { size: 50, color: col, life: 10 });
      this.fx.spawn('glow', x, y, { size: power > 6 ? 90 : 56, color: col, life: 9 });
      if (word) this.fx.spawn('text', x + TT.rand(-60, 60), y - TT.rand(50, 110), { text: TT.choice(WORDS), size: power > 6 ? 46 : 36, color: '#ffe14a', color2: col, vy: -0.6, life: 26, rot: TT.rand(-0.3, 0.3) });
      A().play('hit');
    }

    burst(x, y, col, sc) {
      this.fx.spawn('glow', x, y, { size: 180 * sc, color: col, life: 16 });
      this.fx.spawn('ring', x, y, { size: 110 * sc, color: '#ffffff', life: 14 });
      for (let i = 0; i < 14 * sc; i++) {
        const ang = Math.random() * Math.PI * 2, s = TT.rand(4, 12) * sc;
        this.fx.spawn('spark', x, y, { vx: Math.cos(ang) * s, vy: Math.sin(ang) * s - 2, color: TT.choice([col, '#ffffff', '#ffe14a']), size: 6, life: TT.randi(12, 22), grav: 0.2 });
      }
    }

    puff(x, y, col) {
      for (let i = 0; i < 8; i++) this.fx.spawn('glow', x + TT.rand(-40, 40), y + TT.rand(-50, 40), { color: col, size: TT.rand(30, 60), life: 14 });
      this.fx.spawn('ring', x, y, { size: 90, color: '#d6ffc0', life: 12 });
    }

    // Final: os cinco juntos, disparo combinado, explosão e volta para o jogo.
    startFinale(f) {
      if (this.finale >= 0 && this.finale >= f) return;
      this.finale = f; this.shots = []; this.soul = null;
      this.live = [];
      this.squad = this.queue.map((s, i) => {
        const a = s.a, [x, dy] = LINEUP[s.key];
        a.atk = null; a.state = 'idle'; a.anim = 'victory'; a.animT = i * 9; a.facing = 1;
        a.x = x; a.y = GY + dy; a.z = f > FINALE.land ? (s.key === 'starfire' || s.key === 'raven' ? 40 : 0) : 420 + i * 70;
        a.vz = 0; s.alpha = 1; s.phase = 'final';
        return s;
      });
      if (f === 0) { this.tvz = 15; A().play('super'); }
      else { this.tz = Math.max(this.tz, 160); this.tvz = 0; }
    }

    updateFinale() {
      const f = ++this.finale;
      for (const s of this.squad) {
        const a = s.a, hover = s.key === 'starfire' || s.key === 'raven' ? 40 : 0;
        a.animT++;
        if (a.z > hover) { a.z = Math.max(hover, a.z - 34); if (a.z === hover && !hover) { this.fx.spawn('dust', a.x, GY, { color: 'rgba(220,210,200,0.7)', size: 14, life: 16 }); A().play('land'); } }
      }
      if (f === FINALE.beams) { A().play('sonic'); A().play('starbolt'); }
      if (f >= FINALE.beams && f < FINALE.boom) {
        // alvo preso no ar pelos cinco disparos
        this.tz += (170 - this.tz) * 0.2; this.tvz = 0;
        if ((f - FINALE.beams) % 4 === 0) this.hit(4, TT.choice(this.squad.map((s) => s.a.def.fx || s.a.def.color)), (f - FINALE.beams) % 8 === 0, false);
      }
      if (f === FINALE.boom) {
        this.white = 12; this.gone = true;
        const x = TX + this.tdx, y = GY - this.tz - this.tH * 0.5;
        for (const s of this.squad) this.burst(x + TT.rand(-60, 60), y + TT.rand(-60, 60), s.a.def.fx || s.a.def.color, 1.2);
        this.fx.spawn('text', x, y - 40, { text: 'KA-BOOM!', size: 80, color: '#ffe14a', color2: '#ff3b30', vy: -0.4, life: 40, rot: -0.08 });
        A().play('boom'); A().play('shockwave');
      }
      if (f === FINALE.fade) this.g.resolveSuper(); // dano de verdade em todos os inimigos da tela
      if (f >= FINALE.end) this.done = true;
    }

    // ------------------------------------------------------------------ Desenho
    draw(ctx) {
      const t = this.t;
      if (t < INTRO + 4) this.drawIntro(ctx, Math.min(1, t / INTRO));
      if (t < INTRO - 6) return;
      let al = TT.clamp((t - (INTRO - 6)) / 8, 0, 1);
      if (this.finale >= FINALE.fade) al *= 1 - TT.clamp((this.finale - FINALE.fade) / (FINALE.end - FINALE.fade), 0, 1);
      if (al <= 0) return;
      ctx.save();
      ctx.globalAlpha = al;
      this.drawBg(ctx);
      ctx.restore();
      ctx.save(); ctx.globalAlpha = al;
      const actors = this.finale >= 0 ? this.squad : this.live;
      // sombras
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      if (!this.gone) { const s = Math.max(0.35, 1 - this.tz / 300); ctx.beginPath(); ctx.ellipse(TX + this.tdx, GY, 60 * this.tScale * s, 16 * s, 0, 0, Math.PI * 2); ctx.fill(); }
      for (const s of actors) { const k = Math.max(0.35, 1 - s.a.z / 300); ctx.beginPath(); ctx.ellipse(s.a.x, s.a.y, 34 * k, 10 * k, 0, 0, Math.PI * 2); ctx.fill(); }
      if (!this.gone) this.drawTarget(ctx);
      // disparo combinado do final: um feixe de cada Titã até o alvo
      if (this.finale >= FINALE.beams && this.finale < FINALE.boom + 4) this.drawFinalBeams(ctx);
      for (const s of actors.slice().sort((p, q) => p.a.y - q.a.y)) {
        if (s.alpha <= 0) continue;
        ctx.globalAlpha = al * s.alpha;
        s.a.draw(ctx, 0);
        if (s.phase === 'exit' || s.phase === 'enter') this.drawSpeed(ctx, s.a);
      }
      ctx.globalAlpha = al;
      this.drawShots(ctx);
      if (this.soul) this.drawSoul(ctx);
      this.fx.draw(ctx, 0);
      this.drawBars(ctx);
      if (this.white > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, this.white / 8) + ')'; ctx.fillRect(0, 0, W, H); }
      ctx.restore();
    }

    // Faixas diagonais com os retratos dos cinco Titãs entrando (sobre o jogo congelado).
    drawIntro(ctx, k) {
      ctx.fillStyle = 'rgba(10,0,30,' + Math.min(0.75, k * 3) + ')';
      ctx.fillRect(0, 0, W, H);
      const n = 5, bw = W / n;
      for (let i = 0; i < n; i++) {
        const kk = TT.clamp((k - i * 0.08) * 3, 0, 1);
        const x = i * bw, slide = (1 - TT.easeOut(kk)) * (i % 2 ? -H : H);
        ctx.save();
        ctx.beginPath(); ctx.moveTo(x + 40, slide + 90); ctx.lineTo(x + bw + 40, slide + 90); ctx.lineTo(x + bw - 40, slide + 600); ctx.lineTo(x - 40, slide + 600); ctx.closePath();
        const key = TT.TITAN_ORDER[i];
        ctx.fillStyle = TT.TITANS[key].color; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 6; ctx.stroke();
        ctx.clip();
        ctx.drawImage(TT.portrait(key, 260), x + bw / 2 - 130, slide + 200, 260, 260);
        ctx.restore();
      }
      if (k > 0.35) {
        const s = Math.min(1, (k - 0.35) * 5);
        ctx.save(); ctx.translate(W / 2, 640); ctx.scale(s, s);
        TT.drawText(ctx, 'TITÃS, AVANTE!', 0, 0, 84, '#ffe14a', OUT, 'center', 14);
        ctx.restore();
      }
    }

    // Fundo da cena: cor do Titã da vez, raios girando a partir do alvo e chão em perspectiva.
    drawBg(ctx) {
      const cur = this.finale >= 0 ? null : this.live[this.live.length - 1];
      const col = cur ? cur.a.def.color : '#ffb020';
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b0620'); g.addColorStop(0.55, '#24104a'); g.addColorStop(1, '#0b0620');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const cx = TX, cy = GY - 130;
      const rg = ctx.createRadialGradient(cx, cy, 20, cx, cy, 700);
      rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.globalAlpha *= 0.55; ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); ctx.restore();
      // raios
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.t * 0.01);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      for (let i = 0; i < 16; i++) { ctx.rotate(Math.PI / 8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1400, -70); ctx.lineTo(1400, 70); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      // chão: faixa escura com linhas de velocidade
      ctx.fillStyle = 'rgba(8,4,20,0.75)'; ctx.fillRect(0, GY - 40, W, H - GY + 40);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        const y = GY - 30 + i * 14, off = (this.t * (6 + i * 2)) % 260;
        for (let x = -off; x < W; x += 260) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 90 + i * 8, y); ctx.stroke(); }
      }
      ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, GY - 40); ctx.lineTo(W, GY - 40); ctx.stroke();
    }

    // O inimigo de verdade é desenhado na cena (estado salvo e restaurado; o jogo continua congelado).
    drawTarget(ctx) {
      const e = this.target, keys = ['x', 'y', 'z', 'facing', 'state', 'anim', 'animT', 'flash', 'atk', 'st', 'invul', 'frozen', 'frozenKind', 'dead', 'alpha', 'vx', 'vy', 'vz', 'hitstun'];
      const save = {};
      for (const k of keys) save[k] = e[k];
      const sx = TX + this.tdx, sc = this.tScale;
      try {
        const air = this.tz > 40;
        e.x = sx; e.y = GY; e.z = this.tz / sc; e.facing = -1; e.vx = e.vy = e.vz = 0;
        e.state = air ? 'down' : 'hurt'; e.anim = e.state; e.animT = this.t; e.st = 0;
        e.flash = this.flashT > 0 ? 6 : 0; e.atk = null; e.invul = 0; e.frozen = 0; e.dead = false; e.hitstun = 10;
        if ('alpha' in save) e.alpha = 1;
        ctx.save();
        if (sc !== 1) { ctx.translate(sx, GY); ctx.scale(sc, sc); ctx.translate(-sx, -GY); }
        if (air) { const cy = GY - this.tz - this.tH * 0.5; ctx.translate(sx, cy); ctx.rotate(Math.sin(this.t * 0.3) * 0.25); ctx.translate(-sx, -cy); }
        e.draw(ctx, 0);
        ctx.restore();
      } finally {
        for (const k of keys) e[k] = save[k];
      }
    }

    drawSpeed(ctx, a) {
      ctx.save(); ctx.strokeStyle = a.def.fx || a.def.color; ctx.lineCap = 'round'; ctx.globalAlpha *= 0.7;
      for (let i = 0; i < 4; i++) {
        const y = a.y - a.z - 30 - i * 30, l = 90 + i * 30;
        ctx.lineWidth = 6 - i; ctx.beginPath(); ctx.moveTo(a.x - 40, y); ctx.lineTo(a.x - 40 - l, y); ctx.stroke();
      }
      ctx.restore();
    }

    drawShots(ctx) {
      for (const p of this.shots) {
        if (p.t <= 0) continue;
        TT.drawGlow(ctx, p.col, p.x, p.y, p.r * 2.6, 0.9);
        ctx.save(); ctx.translate(p.x, p.y);
        if (p.kind === 'birdarang' || p.kind === 'bomb') {
          ctx.rotate(p.t * 0.6);
          ctx.beginPath(); ctx.moveTo(-16, -4); ctx.lineTo(0, 4); ctx.lineTo(16, -4); ctx.lineTo(0, 10); ctx.closePath();
          ctx.fillStyle = p.kind === 'bomb' ? '#3a3440' : '#ffd23a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
          if (p.kind === 'bomb') { ctx.beginPath(); ctx.arc(0, 3, 4, 0, Math.PI * 2); ctx.fillStyle = '#ff3b30'; ctx.fill(); }
        } else {
          ctx.beginPath(); ctx.arc(0, 0, p.r * 0.7, 0, Math.PI * 2); ctx.fillStyle = '#eaffef'; ctx.fill();
        }
        ctx.restore();
      }
    }

    drawSoul(ctx) {
      const sv = this.soul;
      if (sv.t > 16 || sv.cx == null) return;
      ctx.save(); ctx.translate(sv.cx, sv.cy); ctx.scale(2.4, 2.4);
      TT.drawSoulRaven(ctx, 0, 0, 1, sv.t);
      ctx.restore();
      // tentáculos de sombra saindo do chão embaixo do alvo (golpes novos)
      if (sv.plus && sv.t > 8) {
        const h = 200 * Math.min(1, (sv.t - 8) / 5);
        ctx.save();
        for (let i = 0; i < 5; i++) {
          const x = TX + (i - 2) * 30;
          ctx.beginPath(); ctx.moveTo(x - 12, GY); ctx.quadraticCurveTo(x - 6, GY - h * 0.5, x + Math.sin(i * 2) * 20, GY - h * (0.6 + 0.4 * ((i * 7) % 3) / 2));
          ctx.quadraticCurveTo(x + 8, GY - h * 0.5, x + 12, GY); ctx.closePath();
          ctx.fillStyle = '#120a22'; ctx.fill(); ctx.strokeStyle = '#8a5cff'; ctx.lineWidth = 4; ctx.stroke();
        }
        ctx.restore();
      }
    }

    drawFinalBeams(ctx) {
      const x1 = TX + this.tdx, y1 = GY - this.tz - this.tH * 0.5, k = this.finale - FINALE.beams;
      const grow = Math.min(1, (k + 1) / 5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const s of this.squad) {
        // sai do punho erguido da pose de vitória (à frente, na altura da cabeça)
        const a = s.a, x0 = a.x + 30, y0 = a.y - a.z - a.height * 0.9;
        const xe = TT.lerp(x0, x1, grow), ye = TT.lerp(y0, y1, grow), col = a.def.fx || a.def.color;
        const w = 16 + Math.sin(this.t * 0.8 + x0) * 4;
        ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = w * 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xe, ye); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.9; ctx.lineWidth = w * 0.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xe, ye); ctx.stroke();
      }
      ctx.restore();
      TT.drawGlow(ctx, '#ffffff', x1, y1, 80 + k * 6, 0.8);
    }

    // Faixas de cinema com o nome do Titã e do golpe, e o contador de golpes.
    drawBars(ctx) {
      const k = TT.easeOut(TT.clamp((this.t - INTRO + 6) / 10, 0, 1)), b = BAR * k;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, b); ctx.fillRect(0, H - b, W, b);
      if (k < 1) return;
      if (this.finale >= 0) {
        if (this.finale > FINALE.boom - 6) {
          const s = TT.easeOut(Math.min(1, (this.finale - FINALE.boom + 6) / 8));
          ctx.save(); ctx.translate(W / 2, H - BAR / 2); ctx.scale(s, s);
          TT.drawText(ctx, 'TITÃS, AVANTE!', 0, 0, 52, '#ffe14a', OUT, 'center', 9);
          ctx.restore();
        } else TT.drawText(ctx, 'TODOS JUNTOS!', W / 2, H - BAR / 2, 40, '#ffffff', OUT, 'center', 7);
      } else {
        const cur = this.live.filter((s) => s.phase !== 'exit').pop() || this.live[this.live.length - 1];
        if (cur) {
          const d = cur.a.def;
          ctx.drawImage(TT.portrait(cur.key, 56), 24, H - BAR + 3, 56, 56);
          TT.drawText(ctx, d.name.toUpperCase(), 92, H - BAR / 2, 34, d.color, OUT, 'left', 6);
          ctx.font = '34px ' + TT.FONT;
          const nw = ctx.measureText(d.name.toUpperCase()).width;
          TT.drawText(ctx, CAPTION[cur.key][d.plus ? 1 : 0], 92 + nw + 22, H - BAR / 2, 26, '#ffffff', OUT, 'left', 5);
        }
      }
      if (this.hits > 0) TT.drawText(ctx, this.hits + (this.hits > 1 ? ' GOLPES!' : ' GOLPE!'), W - 30, BAR / 2, 34, '#ffe14a', OUT, 'right', 6);
      TT.drawText(ctx, 'TITÃS, AVANTE!', 30, BAR / 2, 30, '#ffffff', OUT, 'left', 5);
      if (this.finale < FINALE.boom) {
        const touch = this.g.touch && this.g.touch.visible;
        TT.drawText(ctx, (touch ? 'ATAQUE' : 'ENTER') + ' pula a cena', W / 2, BAR / 2, 20, '#9a95b8', OUT, 'center', 4);
      }
    }
  }
  TT.SuperCutscene = SuperCutscene;
})();
