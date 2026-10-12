'use strict';
// Inicialização, laço com passo fixo (60 Hz), bot de testes e API de depuração.
(function () {
  const TT = window.TT;

  // Bot simples que joga sozinho — usado nos testes automatizados (e como "demo").
  class Bot {
    constructor(game) { this.game = game; this.down = new Set(); this.pressed = new Set(); this.t = 0; }
    press(a) { this.pressed.add(a); }
    update() {
      const g = this.game; this.t++;
      this.down.clear();
      if (g.state !== 'play') { if (this.t % 40 === 0) this.press('start'), this.press('menu'); return; }
      const p = g.player;
      if (!p || p.ko) return;
      // troca de Titã quando está fraco
      if (p.hp < p.maxHp * 0.3 && this.t % 20 === 0) {
        let best = -1, bh = p.hp;
        g.team.forEach((t, i) => { if (!t.ko && t.hp > bh + 20) { bh = t.hp; best = i; } });
        if (best >= 0) this.press('t' + best);
      }
      if (g.energy >= 100 && g.enemies.length >= 2) this.press('super');
      // desvia de ondas de choque
      for (const e of g.effects) if (e instanceof TT.Shockwave) {
        const dx = p.x - e.x, dy = (p.y - e.y) / 0.38, d = Math.hypot(dx, dy);
        if (d - e.r > 0 && d - e.r < 60 && p.z === 0) this.press('jump');
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
          if (crate.x - p.x > 70) this.down.add('right');
          else if (crate.x < p.x) this.down.add('left');
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
      try { game.render(); } catch (e) { reportError(e); }
    }
    let errShown = false;
    function reportError(e) {
      TT.errors = TT.errors || [];
      TT.errors.push(String(e && e.stack || e));
      if (!errShown) { errShown = true; console.error(e); }
    }
    requestAnimationFrame(frame);

    window.addEventListener('keydown', () => TT.audio.init());
    // Começa/retoma o áudio no primeiro clique também
    canvas.addEventListener('pointerdown', () => { TT.audio.init(); game.input.anyKey = true; game.input.pressed.add('menu'); });

    // ---------------------------------------------------------------- API de depuração/testes
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
      bot(on) { game.bot = on ? new Bot(game) : null; game.input.bot = game.bot; },
      god(on) { game.godMode = !!on; },
      start(i) { TT.audio.muted = true; game.score = 0; game.startStage(i || 0); },
      toSection(i) {
        game.enemies.length = 0;
        game.drill = null; game.boss = null;
        game.secIdx = i; game.secActive = false;
        const sec = game.section;
        const cx = sec.type === 'chase' ? sec.start : sec.camX;
        game.camX = game.camMin = cx - 2;
        game.player.x = cx + 700;
      },
      killAll() { for (const e of game.enemies) if (!e.dead) e.takeHit({ x: e.x - 1, dmgMul: 1 }, { dmg: 9999, kb: 5, knockdown: true, launch: 6 }); },
      info() {
        const p = game.player;
        return {
          state: game.state, stage: game.stageIdx, sec: game.secIdx, secActive: game.secActive, wave: game.waveIdx,
          camX: Math.round(game.camX), enemies: game.enemies.length, boss: game.boss ? Math.round(game.boss.hp) : null,
          player: p ? { key: p.key, hp: Math.round(p.hp), x: Math.round(p.x), y: Math.round(p.y), state: p.state } : null,
          ko: game.team.filter((t) => t.ko).length, score: game.score, energy: Math.round(game.energy),
          particles: game.particles.list.length, errors: (TT.errors || []).length,
          avgRenderMs: +(game.stats.renderMs / Math.max(1, game.stats.frames)).toFixed(2), maxRenderMs: +game.stats.maxRenderMs.toFixed(2),
        };
      },
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
