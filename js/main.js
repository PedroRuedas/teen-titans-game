'use strict';
// Inicialização, laço com passo fixo (60 Hz), bot de testes e API de depuração.
(function () {
  const TT = window.TT;

  // Bot simples que joga sozinho — usado nos testes automatizados (e como "demo"). slot 0 = P1, 1 = P2.
  class Bot {
    constructor(game, slot) { this.game = game; this.slot = slot || 0; this.down = new Set(); this.pressed = new Set(); this.t = 0; }
    press(a) { this.pressed.add(a); }
    // Ponto seguro mais rápido de alcançar fora de uma zona de perigo.
    escape(z, p) {
      const g = this.game, T = TT.FLOOR_TOP + 10, B = TT.FLOOR_BOTTOM - 4, L = g.camX + 40, R = g.camX + TT.W - 40;
      const c = [];
      if (z.k === 'rect') {
        c.push({ x: p.x, y: z.y - z.d - 26 }, { x: p.x, y: z.y + z.d + 26 });
      } else if (z.k === 'ring') {
        // anel: entra no furo do meio ou sai pela borda de fora
        const dx = p.x - z.x, dy = (p.y - z.y) / z.ry, d = Math.hypot(dx, dy) || 1;
        for (const r of [z.r0 - 40, z.r1 + 40]) c.push({ x: z.x + dx / d * r, y: z.y + dy / d * r * z.ry });
        c.push({ x: z.x + (dx >= 0 ? 1 : -1) * (z.r0 - 40), y: z.y }, { x: z.x + (dx >= 0 ? 1 : -1) * (z.r1 + 40), y: z.y });
      } else {
        const ky = Math.sqrt(Math.max(0, 1 - Math.pow((p.x - z.x) / z.rx, 2))) * z.ry;
        const kx = Math.sqrt(Math.max(0, 1 - Math.pow((p.y - z.y) / z.ry, 2))) * z.rx;
        c.push({ x: p.x, y: z.y - ky - 22 }, { x: p.x, y: z.y + ky + 22 }, { x: z.x - kx - 34, y: p.y }, { x: z.x + kx + 34, y: p.y });
        if (z.k === 'half') c.push({ x: z.x - z.f * 30, y: p.y });
      }
      let best = null, bt = 1e9;
      for (const q of c) {
        if (q.y < T || q.y > B || q.x < L || q.x > R) continue;
        const t = Math.abs(q.x - p.x) / 4.5 + Math.abs(q.y - p.y) / 2.8;
        if (t < bt) { bt = t; best = q; }
      }
      return best;
    }
    update() {
      const g = this.game; this.t++;
      this.down.clear();
      if (g.state !== 'play') { if (this.slot === 0 && this.t % 40 === 0) this.press('start'), this.press('menu'); return; }
      const sl = g.slots[this.slot];
      if (sl.out || (this.slot > 0 && !g.coop)) return;
      const p = g.team[sl.ai];
      if (!p || p.ko) return;
      // troca de Titã quando está fraco
      if (p.hp < p.maxHp * 0.3 && this.t % 20 === 0) {
        let best = -1, bh = p.hp;
        g.team.forEach((t, i) => { if (!t.ko && !g.takenBy(i, sl) && t.hp > bh + 20) { bh = t.hp; best = i; } });
        if (best >= 0) this.press('t' + best);
      }
      if (g.energy >= 100 && g.enemies.length >= 2) this.press('super');
      // desvia de ondas de choque
      for (const e of g.effects) if (e instanceof TT.Shockwave) {
        const dx = p.x - e.x, dy = (p.y - e.y) / 0.38, d = Math.hypot(dx, dy);
        if (d - e.r > 0 && d - e.r < 60 && p.z === 0) this.press('jump');
      }
      // foge das marcações de perigo no chão (avisos dos chefes); a onda de choque é pulada
      if (p.state === 'idle' || p.state === 'air') {
        for (const z of g.dangerZones()) {
          if (z.jump || !TT.zoneHas(z, p.x, p.y)) continue;
          const esc = this.escape(z, p);
          if (!esc) continue;
          this.down.clear();
          if (Math.abs(esc.x - p.x) > 6) this.down.add(esc.x > p.x ? 'right' : 'left');
          if (Math.abs(esc.y - p.y) > 4) this.down.add(esc.y > p.y ? 'down' : 'up');
          return;
        }
      }
      // alvo mais próximo
      let target = null, best = 1e9;
      for (const e of g.enemies) {
        if (e.dead) continue;
        const sx = e.x - g.camX;
        if (sx < -40 || sx > TT.W + 40) continue;
        const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 2;
        if (d < best) { best = d; target = e; }
      }
      if (!target) {
        // segue em frente / corre da perfuratriz; quebra caixas no caminho
        const crate = g.props.find((c) => Math.abs(c.x - p.x) < 200 && c.x > p.x - 20);
        if (crate) {
          const aligned = Math.abs(crate.y - p.y) <= 10;
          if (!aligned) this.down.add(crate.y > p.y ? 'down' : 'up');
          const cdx = crate.x - p.x;
          if (cdx > 70) this.down.add('right');
          else if (cdx < -20) this.down.add('left');
          else if (cdx > 20 && p.facing < 0) this.down.add('right'); // vira para a caixa antes de bater
          // colado na caixa o golpe acerta de qualquer lado (não fica virando para lá e para cá)
          else if (aligned && this.t % 8 === 0) this.press('light');
          return;
        }
        this.down.add('right');
        if (Math.abs(p.y - 590) > 20) this.down.add(p.y < 590 ? 'down' : 'up');
        return;
      }
      const dx = target.x - p.x, dy = target.y - p.y;
      const want = target.isBoss ? target.radius + 40 : 56;
      const side = dx > 0 ? -1 : 1;
      let tx = target.x + side * want;
      if (g.drill) tx = Math.max(tx, g.drill.x + 260);
      if (Math.abs(tx - p.x) > 14) this.down.add(tx > p.x ? 'right' : 'left');
      if (Math.abs(dy) > 8) this.down.add(dy > 0 ? 'down' : 'up');
      if (Math.abs(dx) < want + 60 && Math.abs(dy) < 18) {
        const facingOk = (dx > 0 && p.facing > 0) || (dx < 0 && p.facing < 0);
        if (!facingOk) { this.down.clear(); this.down.add(dx > 0 ? 'right' : 'left'); return; }
        const sp = p.def.special;
        if (g.energy >= sp.cost + 20 && this.t % 30 === 0) this.press('special');
        else if (this.t % 45 === 0) this.press('heavy');
        else if (this.t % 6 === 0) this.press('light');
      }
    }
  }
  TT.Bot = Bot;

  function boot() {
    const canvas = document.getElementById('game');
    const game = new TT.Game(canvas);
    TT.game = game;
    game.touch = game.input.touch = new TT.TouchControls(game);
    game.resize();
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => game.resize(), 120); });

    const STEP = 1000 / 60;
    let last = performance.now(), acc = 0;
    TT.paused = false;
    function frame(now) {
      requestAnimationFrame(frame);
      if (TT.paused) { last = now; return; }
      acc += Math.min(250, now - last);
      last = now;
      let n = 0;
      while (acc >= STEP && n < 5) {
        try { game.step(); } catch (e) { reportError(e); }
        acc -= STEP; n++;
      }
      if (n === 5) acc = 0;
      try { game.render(); } catch (e) { reportError(e); resetCanvas(); }
      game.touch.update();
    }
    // Após um erro de desenho a pilha save/restore fica desbalanceada: zera o contexto do canvas.
    function resetCanvas() {
      const ctx = game.ctx;
      if (ctx.reset) ctx.reset(); else game.canvas.width = game.canvas.width;
    }
    let errShown = false;
    function reportError(e) {
      TT.errors = TT.errors || [];
      TT.errors.push(String(e && e.stack || e));
      if (!errShown) { errShown = true; console.error(e); }
    }
    requestAnimationFrame(frame);
    // retratos grandes da cutscene do avante: desenhados antes, para a cena não engasgar ao começar
    setTimeout(() => { for (const k of TT.TITAN_ORDER) TT.portrait(k, 260); }, 800);

    window.addEventListener('keydown', () => TT.audio.init());
    // Começa/retoma o áudio no primeiro clique também
    canvas.addEventListener('pointerdown', () => { TT.audio.init(); game.input.anyKey = true; game.input.pressed.add('menu'); });

    // ---------------------------------------------------------------- API de depuração/testes
    // Modo demonstração (index.html?demo): o jogo se joga sozinho; qualquer tecla devolve o controle.
    if (/[?&]demo/.test(location.search)) {
      game.bot = new Bot(game); game.input.bot = game.bot; game.godMode = true;
      const stop = () => { game.bot = null; game.input.bot = null; game.godMode = false; window.removeEventListener('keydown', stop); };
      window.addEventListener('keydown', stop);
    }

    TT.debug = {
      game,
      step(n, renderEvery) {
        for (let i = 0; i < n; i++) {
          game.step();
          if (renderEvery && i % renderEvery === 0) game.render();
        }
        game.render();
        return TT.debug.info();
      },
      bot(on, slot) {
        slot = slot || 0;
        game.bots = game.bots || [null, null];
        game.bots[slot] = on ? new Bot(game, slot) : null;
        game.input.pl[slot].bot = game.bots[slot];
        game.bot = game.bots[0];
      },
      // Modo de jogo: 1 ou 2 jogadores.
      players(n) { game.setPlayers(n); },
      god(on) { game.godMode = !!on; },
      start(i) { TT.audio.muted = true; game.score = 0; game.startStage(i || 0); },
      toSection(i) {
        game.enemies.length = 0;
        game.drill = null; game.boss = null;
        game.secIdx = i; game.secActive = false;
        const sec = game.section;
        const cx = sec.type === 'chase' ? sec.start : sec.camX;
        game.camX = game.camMin = cx - 2;
        game.players().forEach((t, i) => { t.x = cx + 700 - i * 60; });
      },
      killAll() { for (const e of game.enemies) if (!e.dead) e.takeHit({ x: e.x - 1, dmgMul: 1 }, { dmg: 9999, kb: 5, knockdown: true, launch: 6 }); },
      info() {
        const p = game.player;
        const pl = game.players().map((t) => ({ key: t.key, hp: Math.round(t.hp), x: Math.round(t.x), y: Math.round(t.y), ko: t.ko }));
        return {
          state: game.state, stage: game.stageIdx, sec: game.secIdx, secActive: game.secActive, wave: game.waveIdx,
          camX: Math.round(game.camX), enemies: game.enemies.length, boss: game.boss ? Math.round(game.boss.hp) : null,
          player: p ? { key: p.key, hp: Math.round(p.hp), x: Math.round(p.x), y: Math.round(p.y), state: p.state } : null,
          ko: game.team.filter((t) => t.ko).length, numPlayers: game.numPlayers, players: pl, score: game.score, energy: Math.round(game.energy),
          particles: game.particles.list.length, errors: (TT.errors || []).length,
          avgRenderMs: +(game.stats.renderMs / Math.max(1, game.stats.frames)).toFixed(2), maxRenderMs: +game.stats.maxRenderMs.toFixed(2),
        };
      },
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
