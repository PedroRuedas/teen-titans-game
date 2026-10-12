// Suíte de testes automatizados (Playwright). Uso:
//   1) sirva a pasta do jogo em http://localhost:8765  (ex.: node tests/serve.js)
//   2) playwright-cli open http://localhost:8765/ && playwright-cli run-code --filename=tests/run-tests.js
async page => {
  const results = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push('console: ' + m.text()); });
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('http://localhost:8765/?t=' + Date.now());
  await page.waitForFunction(() => window.TT && TT.debug);
  await sleep(400);

  // 1) Tela de título e início com teclado real
  ok('título carregado', await ev(() => TT.game.state === 'title'));
  await page.keyboard.press('Enter');
  await sleep(100);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => TT.game.state === 'play', null, { timeout: 3000 }).catch(() => {});
  ok('ENTER inicia a fase 1', await ev(() => TT.game.state === 'play' && TT.game.stageIdx === 0));

  // 2) Movimento, ataque e troca de Titã com teclado real
  const x0 = await ev(() => TT.game.player.x);
  await page.keyboard.down('ArrowRight'); await sleep(600); await page.keyboard.up('ArrowRight');
  const x1 = await ev(() => TT.game.player.x);
  ok('andar para a direita', x1 > x0 + 100, { x0, x1 });
  await page.keyboard.press('KeyJ'); await sleep(40);
  ok('ataque leve (J)', await ev(() => TT.game.player.state === 'attack'));
  await sleep(500);
  await page.keyboard.press('Digit3'); await sleep(400);
  ok('trocar para Ciborgue (3)', await ev(() => TT.game.player.key === 'cyborg'));
  await page.keyboard.press('KeyE'); await sleep(80);
  ok('trocar para próximo (E)', await ev(() => TT.game.player.key === 'raven'));
  await page.keyboard.press('Space'); await sleep(120);
  ok('pular (Espaço)', await ev(() => TT.game.player.z > 0));
  await sleep(900);
  await page.keyboard.press('Escape'); await sleep(80);
  ok('pausa (Esc)', await ev(() => TT.game.state === 'pause'));
  await page.keyboard.press('Escape'); await sleep(80);
  ok('despausa (Esc)', await ev(() => TT.game.state === 'play'));

  // 3) Todos os golpes de todos os Titãs (passo a passo, sem tempo real)
  const moves = await ev(() => {
    TT.paused = true;
    const g = TT.game, out = {};
    TT.debug.start(0);
    TT.debug.toSection(0);
    TT.debug.step(5);
    for (let i = 0; i < 5; i++) {
      g.switchCool = 0; g.switchTo(i, true);
      const p = g.player;
      const res = {};
      // cada golpe é testado contra um boneco novo, parado à frente do Titã
      const tryMove = (name, seq) => {
        g.enemies.length = 0; g.projectiles.length = 0; g.effects.length = 0;
        p.atk = null; p.setState('idle'); p.z = 0; p.vz = 0; p.vx = 0; p.vy = 0; p.invul = 0; p.facing = 1; p.y = 590;
        const e = new TT.Enemy(g, 'slade', p.x + 70, p.y);
        e.entering = false; e.cool = 9999; e.hp = e.maxHp = 9999; e.def = Object.assign({}, e.def, { speed: 0 });
        g.addEnemy(e);
        g.energy = 100;
        for (const [a, n] of seq) { g.input.pressed.add(a); TT.debug.step(n); }
        res[name] = Math.round(9999 - e.hp);
      };
      tryMove('leve', [['light', 30]]);
      tryMove('combo', [['light', 10], ['light', 10], ['light', 40]]);
      tryMove('forte', [['heavy', 70]]);
      tryMove('especial', [['special', 110]]);
      tryMove('aereo', [['jump', 8], ['light', 50]]);
      out[p.key] = res;
    }
    g.enemies.length = 0;
    return out;
  });
  for (const k in moves) ok('todos os golpes acertam: ' + k, Object.values(moves[k]).every((d) => d > 0), moves[k]);

  // 4) Especial "Titãs, avante!"
  const sup = await ev(() => {
    const g = TT.game;
    for (let i = 0; i < 3; i++) TT.debug.game.spawnEnemy('hive', i, 3);
    TT.debug.step(150);
    g.energy = 100; g.input.pressed.add('super');
    TT.debug.step(140);
    return { energy: g.energy, alive: g.enemies.filter((e) => !e.dead).length };
  });
  ok('Titãs, avante! derrota inimigos', sup.alive === 0 && sup.energy < 100, sup);

  // 4b) Regressões: Titã revivido volta a levantar; botão apertado durante o "hit-stop" não se perde
  const reg = await ev(() => {
    const g = TT.game;
    TT.debug.start(0); TT.debug.step(10);
    const t = g.team[1];
    t.takeHit({ x: t.x - 10, dmgMul: 1 }, { dmg: 9999 });         // Mutano nocauteado (fora de campo)
    g.finishSection();                                             // fim de seção revive
    g.switchCool = 0; g.switchTo(1, true); TT.debug.step(100);     // espera a invencibilidade da troca acabar
    const p = g.player; p.invul = 0;
    p.takeHit({ x: p.x - 10, dmgMul: 1 }, { dmg: 1, knockdown: true, launch: 6, kb: 2 });
    TT.debug.step(120);
    const getsUp = p.state !== 'down';
    g.hitstop = 5; g.input.pressed.add('light'); TT.debug.step(7);
    const buffered = p.state === 'attack';
    return { revived: !t.ko, getsUp, buffered };
  });
  ok('Titã revivido consegue levantar', reg.revived && reg.getsUp, reg);
  ok('ataque apertado durante hit-stop é executado', reg.buffered, reg);
  const reg2 = await ev(() => {
    const g = TT.game;
    TT.debug.start(0); TT.debug.step(10);
    g.hitstop = 5; g.energy = 100; g.input.pressed.add('super'); TT.debug.step(1);
    const superOk = g.superT > 0;
    TT.debug.step(150);
    g.hitstop = 5; g.switchCool = 0; g.input.pressed.add('t2'); TT.debug.step(1);
    return { superOk, switched: g.player.key === 'cyborg' };
  });
  ok('super e troca apertados durante hit-stop funcionam', reg2.superOk && reg2.switched, reg2);

  // 5) Jogo completo com bot (modo deus): fase 1 -> fase 2 -> final, 3 vezes (detecta travamentos raros)
  for (let run = 1; run <= 3; run++) {
    const full = await ev(() => {
      const g = TT.game;
      TT.debug.start(0); TT.debug.god(true); TT.debug.bot(true);
      const seen = new Set();
      let steps = 0, lastCam = -1, still = 0, stall = null;
      while (g.state !== 'victory' && steps < 45000) {
        g.step(); steps++;
        if (steps % 20 === 0) g.render();
        seen.add(g.state + ':' + g.stageIdx);
        if (steps % 600 === 0) {
          still = Math.abs(g.camX - lastCam) < 1 && g.state === 'play' && !g.boss ? still + 1 : 0;
          lastCam = g.camX;
          if (still === 6 && !stall) {
            const p = g.player;
            stall = { stage: g.stageIdx, sec: g.secIdx, secActive: g.secActive, wave: g.waveIdx, waveDelay: g.waveDelay, camX: Math.round(g.camX),
              p: [p.key, Math.round(p.x), Math.round(p.y), Math.round(p.z), p.state],
              enemies: g.enemies.map((e) => [e.kind || 'boss', Math.round(e.x), Math.round(e.y), Math.round(e.z), e.state, e.dead, Math.round(e.hp), e.entering]),
              props: g.props.map((c) => [Math.round(c.x), c.y]), drill: !!g.drill };
          }
        }
      }
      TT.debug.bot(false); TT.debug.god(false);
      return { state: g.state, steps, seen: [...seen], score: g.score, stall };
    });
    ok('jogo completo até a vitória #' + run + ' (bot, modo deus)', full.state === 'victory' && !full.stall, full);
  }

  // 6) Balanceamento: bot sem modo deus contra cada chefe (informativo)
  for (const st of [0, 1]) {
    const r = await ev((stage) => {
      const g = TT.game;
      TT.debug.start(stage); TT.debug.toSection(4); TT.debug.bot(true);
      let steps = 0;
      while (g.state === 'play' && steps < 20000) { g.step(); steps++; }
      TT.debug.bot(false);
      return { stage, result: g.state, steps, koTitans: g.team.filter((t) => t.ko).length, bossHp: g.boss ? Math.round(g.boss.hp) : 0 };
    }, st);
    ok('chefe da fase ' + (st + 1) + ' (bot sem trapaça)', true, r);
  }

  // 7) Desempenho em tempo real (com renderização de verdade)
  const perf = await ev(async () => {
    const g = TT.game;
    TT.debug.start(1); TT.debug.toSection(2); TT.debug.bot(true); TT.debug.god(true);
    g.stats.renderMs = 0; g.stats.frames = 0; g.stats.maxRenderMs = 0;
    TT.paused = false;
    const t0 = performance.now(); let frames = 0;
    await new Promise((res) => { function f() { frames++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(); } requestAnimationFrame(f); });
    TT.paused = true; TT.debug.bot(false); TT.debug.god(false);
    return { fps: Math.round(frames / 4), avgRenderMs: +(g.stats.renderMs / g.stats.frames).toFixed(2), maxRenderMs: +g.stats.maxRenderMs.toFixed(2), particles: g.particles.list.length };
  });
  ok('desempenho (>= 50 fps, render < 8ms)', perf.fps >= 50 && perf.avgRenderMs < 8, perf);

  ok('nenhum erro de JavaScript', errors.length === 0 && (await ev(() => (TT.errors || []).length)) === 0, errors.slice(0, 5));
  await ev(() => { TT.paused = false; TT.debug.start(0); TT.game.state = 'title'; });
  const failed = results.filter((r) => !r.pass).length;
  return JSON.stringify({ failed, total: results.length, results }, null, 1);
}
