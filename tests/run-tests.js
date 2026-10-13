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

  // 1a) Dificuldade: menu do título com teclado, persistência e falha do storage
  await ev(() => { TT.game.setDifficulty('normal'); TT.game.menuIdx = 0; });
  await page.keyboard.press('ArrowDown'); await sleep(60);
  await page.keyboard.press('ArrowDown'); await sleep(60);
  await page.keyboard.press('ArrowDown'); await sleep(60);
  await page.keyboard.press('ArrowRight'); await sleep(60);
  const dTitle = await ev(() => ({ d: TT.game.difficulty, idx: TT.game.menuIdx, saved: localStorage.getItem('jovensTitas.dificuldade') }));
  ok('dificuldade: trocar no título (↓ →)', dTitle.d === 'hard' && dTitle.idx === 3 && dTitle.saved === 'hard', dTitle);
  await page.reload(); await page.waitForFunction(() => window.TT && TT.debug); await sleep(300);
  const dReload = await ev(() => TT.game.difficulty);
  ok('dificuldade: escolha persiste ao recarregar', dReload === 'hard', dReload);
  const dFail = await ev(() => {
    const orig = Storage.prototype.setItem, origGet = Storage.prototype.getItem;
    Storage.prototype.setItem = () => { throw new Error('bloqueado'); };
    Storage.prototype.getItem = () => { throw new Error('bloqueado'); };
    let err = null;
    try { TT.game.setDifficulty('easy'); TT.store.get('dificuldade', 'normal'); } catch (e) { err = String(e); }
    const d = TT.game.difficulty;
    Storage.prototype.setItem = orig; Storage.prototype.getItem = origGet;
    return { err, d, fallback: (() => { Storage.prototype.getItem = () => { throw 1; }; const v = TT.store.get('x', 'def'); Storage.prototype.getItem = origGet; return v; })() };
  });
  ok('dificuldade: jogo funciona com storage bloqueado', !dFail.err && dFail.d === 'easy' && dFail.fallback === 'def', dFail);
  await ev(() => { TT.game.menuIdx = 3; });
  await page.keyboard.press('ArrowRight'); await sleep(60); // fácil -> normal
  await page.keyboard.press('ArrowUp'); await sleep(60);
  await page.keyboard.press('ArrowUp'); await sleep(60);
  await page.keyboard.press('ArrowUp'); await sleep(60);
  ok('dificuldade: volta para NORMAL e cursor em JOGAR', await ev(() => TT.game.difficulty === 'normal' && TT.game.menuIdx === 0));
  await page.keyboard.press('Enter');
  await sleep(100);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => TT.game.state === 'play', null, { timeout: 3000 }).catch(() => {});
  ok('ENTER inicia a fase 1', await ev(() => TT.game.state === 'play' && TT.game.stageIdx === 0));

  // 1b) Escolha de fase no título: ↓ até FASE, ← volta para a última (fase 7) e ENTER começa nela
  const pick = await ev(() => {
    const g = TT.game;
    g.state = 'title'; g.stateT = 50; g.menuIdx = 0; g.stageSel = 0;
    g.input.endStep(); // descarta o ENTER real ainda pendente (senão vira "confirmar" no 1º passo)
    const press = (k) => { g.input.pressed.add(k); g.step(); };
    press('down'); press('left');
    const sel = g.stageSel, label = g.menuLabel('stage').value;
    press('up'); press('menu');
    const res = { sel, label, st: g.state, stage: g.stageIdx };
    g.stageSel = 0; TT.debug.start(0);
    return res;
  });
  ok('menu: escolher a fase 7 no título e começar nela', pick.sel === 6 && /SLADE/.test(pick.label) && pick.st === 'play' && pick.stage === 6, pick);

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
  // dificuldade pelo menu de pausa
  await page.keyboard.press('Escape'); await sleep(80);
  await page.keyboard.press('KeyS'); await sleep(60);
  await page.keyboard.press('KeyA'); await sleep(60);
  const dPause = await ev(() => ({ d: TT.game.difficulty, st: TT.game.state, idx: TT.game.pauseIdx }));
  await page.keyboard.press('KeyD'); await sleep(60);
  await page.keyboard.press('Escape'); await sleep(80);
  const dPause2 = await ev(() => ({ d: TT.game.difficulty, st: TT.game.state }));
  ok('dificuldade: trocar no menu de pausa', dPause.d === 'easy' && dPause.st === 'pause' && dPause2.d === 'normal' && dPause2.st === 'play', { dPause, dPause2 });

  // 2b) Multiplicadores de dificuldade aplicados (NORMAL = balanceamento original)
  const diffs = await ev(() => {
    const g = TT.game, out = {};
    TT.paused = true;
    for (const k of TT.DIFF_ORDER) {
      g.setDifficulty(k);
      TT.debug.start(0); TT.debug.step(2);
      const hive = new TT.Enemy(g, 'hive', 0, 600), slade = new TT.Enemy(g, 'slade', 0, 600), drone = new TT.Drone(g, 0, 600);
      const cb = new TT.Cinderblock(g, 0, 600), gz = new TT.GizmoMech(g, 0, 600);
      const t = g.team[2]; t.invul = 0;
      const h0 = t.hp; t.takeHit({ x: t.x - 10, dmgMul: 1 }, { dmg: 10 }); const dmg = +(h0 - t.hp).toFixed(2);
      // regeneração fora de campo em 100 passos
      const off = g.team[3]; off.hp = 50; TT.debug.step(100); const regen = +(off.hp - 50).toFixed(2);
      hive.atk = { def: hive.def.attacks[0] }; hive.endAttack();
      const res = { hive: hive.maxHp, slade: slade.maxHp, drone: drone.maxHp, cinder: cb.maxHp, gizmo: gz.maxHp,
        swipe: cb.ATK.swipe.s, pound: cb.ATK.pound.s, charge: cb.ATK.charge.s, throw: cb.ATK.throw.s, drill: gz.ATK.drill.s, laser: gz.ATK.laser.s,
        dmg, regen, tokens: [g.baseTokens(2), g.baseTokens(3)], pizza: +(0.12 * g.diff.pizza).toFixed(3), hiveCool: hive.cool };
      g.enemies.length = 0;
      out[k] = res;
    }
    g.setDifficulty('normal');
    return out;
  });
  const N = diffs.normal, E = diffs.easy, Hd = diffs.hard;
  ok('dificuldade NORMAL igual ao balanceamento original',
    N.hive === 42 && N.slade === 70 && N.drone === 26 && N.cinder === 900 && N.gizmo === 1000 && N.swipe === 28 && N.pound === 32 &&
    N.charge === 30 && N.throw === 26 && N.drill === 34 && N.laser === 40 && N.dmg === 10 && N.regen === 5 && N.tokens[0] === 2 && N.tokens[1] === 3 &&
    N.pizza === 0.12 && N.hiveCool >= 50 && N.hiveCool <= 100, N);
  ok('dificuldade FÁCIL: menos vida/dano, aviso mais longo, mais pizza e cura',
    E.hive < N.hive && E.cinder < N.cinder && E.dmg < N.dmg && E.swipe > N.swipe && E.laser > N.laser && E.pizza > N.pizza && E.regen > N.regen && E.tokens[1] < N.tokens[1] && E.hiveCool > 50, E);
  ok('dificuldade DIFÍCIL: mais vida/dano, aviso mais curto, mais tokens',
    Hd.hive > N.hive && Hd.gizmo > N.gizmo && Hd.dmg > N.dmg && Hd.swipe < N.swipe && Hd.drill < N.drill && Hd.pizza < N.pizza && Hd.regen < N.regen && Hd.tokens[1] > N.tokens[1] && Hd.hiveCool <= 100 / 1.4, Hd);

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
      tryMove('corrida', [['dash', 3], ['light', 45]]);
      out[p.key] = res;
    }
    g.enemies.length = 0;
    return out;
  });
  for (const k in moves) ok('todos os golpes acertam: ' + k, Object.values(moves[k]).every((d) => d > 0), moves[k]);

  // 3a) Golpes novos da fase 7: todos acertam e cada um dá mais dano que o golpe original
  const plus = await ev(() => {
    TT.paused = true;
    const g = TT.game, out = {}, flags = {};
    for (const st of [5, 6]) { TT.debug.start(st); flags[st] = g.team.every((t) => !!t.def.plus === (st === 6)); }
    for (const st of [0, 6]) {
      TT.debug.start(st); TT.debug.toSection(0); TT.debug.step(5);
      g.stage = Object.assign({}, g.stage, { sections: [] });
      for (let i = 0; i < 5; i++) {
        g.switchCool = 0; g.switchTo(i, true);
        const p = g.player, res = {};
        const tryMove = (name, seq) => {
          g.enemies.length = 0; g.projectiles.length = 0; g.effects.length = 0;
          p.atk = null; p.setState('idle'); p.z = 0; p.vz = 0; p.vx = 0; p.vy = 0; p.invul = 0; p.facing = 1; p.y = 590;
          const e = new TT.Enemy(g, 'slade', p.x + 70, p.y);
          e.entering = false; e.cool = 9999; e.hp = e.maxHp = 9999; e.def = Object.assign({}, e.def, { speed: 0 });
          g.addEnemy(e); g.energy = 100;
          for (const [a, n] of seq) { g.input.pressed.add(a); TT.debug.step(n); }
          res[name] = Math.round(9999 - e.hp);
        };
        tryMove('leve', [['light', 30]]);
        tryMove('combo', [['light', 10], ['light', 10], ['light', 40]]);
        tryMove('forte', [['heavy', 70]]);
        tryMove('especial', [['special', 110]]);
        tryMove('aereo', [['jump', 8], ['light', 50]]);
        tryMove('corrida', [['dash', 3], ['light', 45]]);
        (out[p.key] = out[p.key] || {})[st] = res;
      }
    }
    g.enemies.length = 0;
    return { out, flags };
  });
  ok('golpes novos só a partir da fase 7', plus.flags[5] && plus.flags[6], plus.flags);
  for (const k in plus.out) {
    const a = plus.out[k][0], b = plus.out[k][6];
    ok('golpes novos (fase 7) dão mais dano: ' + k, Object.keys(a).every((m) => b[m] > a[m]), { original: a, novo: b });
  }

  // 3a2) Disco congelante do Robin: o inimigo fica preso no gelo (parado) por bem mais tempo que um golpe comum
  const ice = await ev(() => {
    const g = TT.game;
    TT.debug.start(6); TT.debug.toSection(0); TT.debug.step(5);
    g.stage = Object.assign({}, g.stage, { sections: [] });
    const p = g.player; p.facing = 1; p.y = 590; p.invul = 0;
    g.enemies.length = 0;
    const e = new TT.Enemy(g, 'hive', p.x + 200, p.y); e.entering = false; e.cool = 9999; e.hp = e.maxHp = 9999; e.def = Object.assign({}, e.def, { speed: 0 }); g.addEnemy(e);
    g.input.pressed.add('heavy');
    let frozen = 0, maxFrozen = 0;
    for (let t = 0; t < 140; t++) { g.step(); if (e.frozen > 0) { frozen++; maxFrozen = Math.max(maxFrozen, e.frozen); } }
    g.enemies.length = 0;
    return { frozen, maxFrozen, after: e.frozen };
  });
  ok('Robin (fase 7): disco congelante prende o inimigo no gelo', ice.frozen >= 60 && ice.after === 0, ice);

  // 3b) Nova forma do Mutano: rinoceronte no ataque em corrida (esquiva + ataque)
  const rhino = await ev(() => {
    const g = TT.game;
    TT.debug.start(0); TT.debug.toSection(0); TT.debug.step(5);
    g.switchCool = 0; g.switchTo(1, true); TT.debug.step(100);
    const p = g.player; p.invul = 0; p.facing = 1; p.y = 590;
    g.enemies.length = 0;
    const e = new TT.Enemy(g, 'hive', p.x + 160, p.y);
    e.entering = false; e.cool = 9999; e.hp = e.maxHp = 9999; e.def = Object.assign({}, e.def, { speed: 0 });
    g.addEnemy(e);
    g.input.pressed.add('dash'); TT.debug.step(3);
    g.input.pressed.add('light'); TT.debug.step(4);
    const form = p.atk && p.atk.def.form;
    TT.debug.step(40);
    g.enemies.length = 0;
    return { form, dmg: Math.round(9999 - e.hp), knocked: e.state === 'down' || e.z > 0 };
  });
  ok('Mutano: rinoceronte (ataque em corrida) acerta', rhino.form === 'rhino' && rhino.dmg > 0, rhino);

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

  // 4b2) Inimigo novo: Soldado Elétrico — os dois golpes acertam e têm marcação no chão antes
  const shock = await ev(() => {
    const g = TT.game, out = {};
    for (const i of [0, 1]) {
      TT.debug.start(2); TT.debug.toSection(0); TT.debug.step(5); TT.debug.god(false);
      const p = g.player; p.hp = p.maxHp = 9999; p.invul = 0; p.y = 590;
      g.enemies.length = 0;
      const e = new TT.ShockTrooper(g, p.x + (i ? 70 : 160), p.y);
      e.entering = false; e.facing = -1; g.addEnemy(e);
      e.startAttack(e.def.attacks[i]);
      const zone = !!(e.atk.zones && e.atk.zones.length), inside = e.atk.zones.some((z) => TT.zoneHas(z, p.x, p.y));
      const h0 = p.hp; let hitT = -1;
      for (let t = 1; t < 70; t++) { g.step(); if (hitT < 0 && p.hp < h0) hitT = t; }
      out[i ? 'descarga' : 'estocada'] = { zone, inside, hitT, s: e.def.attacks[i].s };
    }
    // a IA respeita os tokens: com 1 token, só um ataca por vez
    TT.debug.start(2); TT.debug.toSection(0); TT.debug.step(5); TT.debug.god(true);
    g.stage = Object.assign({}, g.stage, { sections: [] }); // sem ondas novas durante a medição
    g.enemies.length = 0; g.tokens = 1;
    const p = g.player;
    for (let k = 0; k < 3; k++) { const e = new TT.ShockTrooper(g, p.x + 200 + k * 60, p.y + (k - 1) * 30); e.entering = false; e.cool = 0; g.addEnemy(e); }
    let maxAtk = 0;
    for (let t = 0; t < 600; t++) { g.step(); maxAtk = Math.max(maxAtk, g.enemies.filter((e) => e.kind === 'shock' && e.state === 'attack').length); }
    TT.debug.god(false); g.enemies.length = 0;
    out.maxSimultaneous = maxAtk;
    return out;
  });
  ok('inimigo novo: estocada elétrica acerta após o aviso', shock.estocada.zone && shock.estocada.inside && shock.estocada.hitT >= shock.estocada.s, shock);
  ok('inimigo novo: descarga no chão acerta após o aviso', shock.descarga.zone && shock.descarga.inside && shock.descarga.hitT >= shock.descarga.s, shock);
  ok('inimigo novo respeita os tokens de ataque', shock.maxSimultaneous === 1, shock);

  // 4b3) Fraqueza do Overload: após o teleporte fica com o chip exposto e leva dano dobrado
  const weak = await ev(() => {
    const g = TT.game;
    TT.debug.start(2); TT.debug.toSection(4); TT.debug.god(true);
    let n = 0; while ((!g.boss || !g.boss.active) && n++ < 400) g.step();
    const b = g.boss; b.cool = 1e9;
    const d0 = { dmg: 10 };
    let h = b.hp; b.takeHit({ x: b.x - 10, dmgMul: 1 }, d0); const normal = h - b.hp;
    b.startAttack(b.ATK.teleport);
    for (let t = 0; t < 120 && b.state !== 'overheat'; t++) g.step();
    const st = b.state;
    h = b.hp; b.takeHit({ x: b.x - 10, dmgMul: 1 }, d0); const exposed = h - b.hp;
    TT.debug.god(false);
    return { st, normal, exposed };
  });
  ok('Overload: chip exposto após o teleporte (dano dobrado)', weak.st === 'overheat' && weak.exposed === weak.normal * 2, weak);

  // 4b4) Fraqueza do Plasmus: o soco esticado gruda o braço no chão — fica parado e leva dano dobrado
  const sticky = await ev(() => {
    const g = TT.game;
    TT.debug.start(3); TT.debug.toSection(4); TT.debug.god(true);
    let n = 0; while ((!g.boss || !g.boss.active) && n++ < 400) g.step();
    const b = g.boss; b.cool = 1e9;
    const d0 = { dmg: 10 };
    let h = b.hp; b.takeHit({ x: b.x - 10, dmgMul: 1 }, d0); const normal = h - b.hp;
    b.startAttack(b.ATK.punch);
    for (let t = 0; t < 120 && b.state !== 'stuck'; t++) g.step();
    const st = b.state, x0 = b.x;
    h = b.hp; b.takeHit({ x: b.x - 10, dmgMul: 1 }, d0); const stuckDmg = h - b.hp;
    for (let t = 0; t < 60; t++) g.step();
    const moved = Math.abs(b.x - x0);
    for (let t = 0; t < 200 && b.state === 'stuck'; t++) g.step();
    TT.debug.god(false);
    return { st, normal, stuckDmg, moved, after: b.state };
  });
  ok('Plasmus: braço grudado após o soco (parado, dano dobrado) e depois se solta', sticky.st === 'stuck' && sticky.stuckDmg === sticky.normal * 2 && sticky.moved < 1 && sticky.after !== 'stuck', sticky);

  // 4b4b) Fraqueza do Irmão Sangue: depois da telecinese fica com a mente esgotada (parado, dano dobrado);
  //       na fase 2 chama alunos hipnotizados; a hipnose deixa o Titã tonto
  const blood = await ev(() => {
    const g = TT.game, out = {};
    TT.debug.start(4); TT.debug.toSection(4); TT.debug.god(true);
    let n = 0; while ((!g.boss || !g.boss.active) && n++ < 400) g.step();
    const b = g.boss; b.cool = 1e9;
    const d0 = { dmg: 10 };
    let h = b.hp; b.takeHit({ x: b.x - 10, dmgMul: 1 }, d0); out.normal = h - b.hp;
    b.startAttack(b.ATK.hurl);
    for (let t = 0; t < 160 && b.state !== 'tired'; t++) g.step();
    out.st = b.state; const x0 = b.x;
    h = b.hp; b.takeHit({ x: b.x - 10, dmgMul: 1 }, d0); out.tiredDmg = h - b.hp;
    for (let t = 0; t < 60; t++) g.step();
    out.moved = Math.abs(b.x - x0);
    for (let t = 0; t < 200 && b.state === 'tired'; t++) g.step();
    out.after = b.state;
    // fase 2: invocação de alunos
    b.cool = 1e9; b.hp = b.maxHp * 0.4; g.enemies.length = 0; g.enemies.push(b); b.setState('idle'); b.atk = null;
    b.startAttack(b.ATK.summon);
    for (let t = 0; t < 80; t++) g.step();
    out.cadets = g.enemies.filter((e) => e.kind === 'cadet' && !e.dead).length;
    // hipnose: Titã dentro do círculo fica tonto (hurt) por bem mais tempo que um golpe comum
    TT.debug.god(false); g.enemies.length = 0; g.enemies.push(b);
    const p = g.player; p.hp = p.maxHp = 99999; p.invul = 0; p.setState('idle'); p.atk = null; p.z = 0;
    b.setState('idle'); b.atk = null; b.cool = 1e9; b.x = g.camX + 900; b.y = 590; p.x = b.x - 400; p.y = 590;
    b.startAttack(b.ATK.mind);
    let hurt = 0;
    for (let t = 0; t < 200; t++) { p.vx = p.vy = 0; g.step(); if (p.state === 'hurt') hurt++; }
    out.hypnoFrames = hurt;
    TT.debug.god(false); g.enemies.length = 0;
    return out;
  });
  ok('Irmão Sangue: mente esgotada após a telecinese (parado, dano dobrado) e depois se recupera', blood.st === 'tired' && blood.tiredDmg === blood.normal * 2 && blood.moved < 1 && blood.after !== 'tired', blood);
  ok('Irmão Sangue: chama alunos hipnotizados na fase 2', blood.cadets === 2, blood);
  ok('Irmão Sangue: hipnose deixa o Titã tonto', blood.hypnoFrames >= 70, blood);

  // 4b4c) Inimigos da fase 5: raio de azar da Jinx e os dois golpes do Mammoth acertam só depois do aviso no chão
  const s5 = await ev(() => {
    const g = TT.game, out = {};
    const cases = [['jinx', 0, 160], ['mammoth', 0, 110], ['mammoth', 1, 120]];
    for (const [kind, i, dist] of cases) {
      TT.debug.start(4); TT.debug.toSection(0); TT.debug.step(5); TT.debug.god(false);
      g.stage = Object.assign({}, g.stage, { sections: [] });
      const p = g.player; p.hp = p.maxHp = 9999; p.invul = 0; p.y = 590;
      g.enemies.length = 0;
      const e = g.spawnEnemy(kind, 0, 1); e.x = p.x + dist; e.y = p.y; e.entering = false; e.facing = -1;
      e.startAttack(e.def.attacks[i]);
      const zone = !!(e.atk.zones && e.atk.zones.length), inside = zone && e.atk.zones.some((z) => TT.zoneHas(z, p.x, p.y));
      const h0 = p.hp; let hitT = -1;
      for (let t = 1; t < 70; t++) { p.vx = p.vy = 0; g.step(); if (hitT < 0 && p.hp < h0) hitT = t; }
      out[kind + ':' + i] = { zone, inside, hitT, s: e.def.attacks[i].s };
    }
    // super armadura do Mammoth: um golpe comum não o derruba
    TT.debug.start(4); TT.debug.toSection(0); TT.debug.step(5);
    g.enemies.length = 0;
    const m = g.spawnEnemy('mammoth', 0, 1); m.entering = false; m.x = g.player.x + 90; m.cool = 9999;
    m.takeHit(g.player, { dmg: 8, knockdown: true, launch: 6, kb: 4 });
    out.armor = m.state;
    g.enemies.length = 0;
    return out;
  });
  // 4b4d) Mumbo (fase 6): varinha cai depois dos coelhos da cartola (parado, dano dobrado);
  //       o feitiço "MUMBO JUMBO!" transforma o Titã em coelho (não ataca) até o feitiço acabar
  const mumbo = await ev(() => {
    const g = TT.game, out = {};
    TT.debug.start(5); TT.debug.toSection(4); TT.debug.god(true);
    let n = 0; while ((!g.boss || !g.boss.active) && n++ < 400) g.step();
    const b = g.boss; b.cool = 1e9;
    const d0 = { dmg: 10 };
    let h = b.hp; b.takeHit({ x: b.x - 10, dmgMul: 1 }, d0); out.normal = h - b.hp;
    b.startAttack(b.ATK.hat);
    for (let t = 0; t < 160 && b.state !== 'fumble'; t++) g.step();
    out.st = b.state; const x0 = b.x;
    h = b.hp; b.takeHit({ x: b.x - 10, dmgMul: 1 }, d0); out.fumbleDmg = h - b.hp;
    for (let t = 0; t < 60; t++) g.step();
    out.moved = Math.abs(b.x - x0);
    for (let t = 0; t < 200 && b.state === 'fumble'; t++) g.step();
    out.after = b.state;
    // feitiço: Titã parado dentro do círculo vira coelho
    TT.debug.god(false); g.enemies.length = 0; g.enemies.push(b);
    const p = g.player; p.hp = p.maxHp = 99999; p.invul = 0; p.setState('idle'); p.atk = null; p.z = 0;
    b.setState('idle'); b.atk = null; b.cool = 1e9; b.x = g.camX + 900; b.y = 590; p.x = b.x - 400; p.y = 590;
    b.startAttack(b.ATK.spell);
    for (let t = 0; t < 90; t++) { p.vx = p.vy = 0; g.step(); }
    out.bunny = p.bunny;
    p.invul = 0; p.setState('idle');
    g.input.pressed.add('light'); g.step(); g.step();
    out.attackAsBunny = p.state === 'attack';
    for (let t = 0; t < 200 && p.bunny > 0; t++) g.step();
    for (let t = 0; t < 30; t++) g.step();
    out.bunnyAfter = p.bunny;
    p.setState('idle'); g.input.pressed.add('light'); g.step(); g.step();
    out.attackAfter = p.state === 'attack';
    g.enemies.length = 0;
    return out;
  });
  ok('Mumbo: varinha cai após os coelhos da cartola (parado, dano dobrado) e depois ele a recupera', mumbo.st === 'fumble' && mumbo.fumbleDmg === mumbo.normal * 2 && mumbo.moved < 1 && mumbo.after !== 'fumble', mumbo);
  ok('Mumbo: "MUMBO JUMBO!" transforma o Titã em coelho (sem atacar) até o feitiço passar', mumbo.bunny > 0 && !mumbo.attackAsBunny && mumbo.bunnyAfter === 0 && mumbo.attackAfter, mumbo);

  // 4b4e) Inimigos da fase 6: estocada do Soldado-Carta e salto do Coelho Mágico acertam só depois do aviso
  const s6 = await ev(() => {
    const g = TT.game, out = {};
    for (const [kind, i, dist] of [['card', 0, 160], ['bunny', 1, 100]]) {
      TT.debug.start(5); TT.debug.toSection(0); TT.debug.step(5); TT.debug.god(false);
      g.stage = Object.assign({}, g.stage, { sections: [] });
      const p = g.player; p.hp = p.maxHp = 9999; p.invul = 0; p.y = 590;
      g.enemies.length = 0;
      const e = g.spawnEnemy(kind, 0, 1); e.x = p.x + dist; e.y = p.y; e.entering = false; e.facing = -1;
      e.startAttack(e.def.attacks[i]);
      const zone = !!(e.atk.zones && e.atk.zones.length), inside = zone && e.atk.zones.some((z) => TT.zoneHas(z, p.x, p.y));
      const h0 = p.hp; let hitT = -1;
      for (let t = 1; t < 70; t++) { p.vx = p.vy = 0; g.step(); if (hitT < 0 && p.hp < h0) hitT = t; }
      out[kind + ':' + i] = { zone, inside, hitT, s: e.def.attacks[i].s };
    }
    g.enemies.length = 0;
    return out;
  });
  for (const k in s6) ok('fase 6: golpe ' + k + ' acerta após o aviso', s6[k].zone && s6[k].inside && s6[k].hitT >= s6[k].s, s6[k]);

  // 4b4f) Inimigos da fase 7: estocada e giro do Comando do Slade e bola de fogo do Demônio acertam só depois do aviso
  const s7 = await ev(() => {
    const g = TT.game, out = {};
    for (const [kind, i, dist] of [['commando', 0, 160], ['commando', 1, 80], ['demon', 0, 150]]) {
      TT.debug.start(6); TT.debug.toSection(0); TT.debug.step(5); TT.debug.god(false);
      g.stage = Object.assign({}, g.stage, { sections: [] });
      const p = g.player; p.hp = p.maxHp = 9999; p.invul = 0; p.y = 590;
      g.enemies.length = 0;
      const e = g.spawnEnemy(kind, 0, 1); e.x = p.x + dist; e.y = p.y; e.entering = false; e.facing = -1;
      e.startAttack(e.def.attacks[i]);
      const zone = !!(e.atk.zones && e.atk.zones.length), inside = zone && e.atk.zones.some((z) => TT.zoneHas(z, p.x, p.y));
      const h0 = p.hp; let hitT = -1;
      for (let t = 1; t < 70; t++) { p.vx = p.vy = 0; g.step(); if (hitT < 0 && p.hp < h0) hitT = t; }
      out[kind + ':' + i] = { zone, inside, hitT, s: e.def.attacks[i].s };
    }
    g.enemies.length = 0;
    return out;
  });
  for (const k in s7) ok('fase 7: golpe ' + k + ' acerta após o aviso', s7[k].zone && s7[k].inside && s7[k].hitT >= s7[k].s, s7[k]);

  // 4b4g) Slade (fase 7): depois do salto com o bastão fica de joelho (guarda aberta: parado, dano dobrado);
  //       na fase 2 chama comandos
  const slade = await ev(() => {
    const g = TT.game, out = {};
    TT.debug.start(6); TT.debug.toSection(4); TT.debug.god(true);
    let n = 0; while ((!g.boss || !g.boss.active) && n++ < 400) g.step();
    const b = g.boss; b.cool = 1e9;
    const d0 = { dmg: 10 };
    let h = b.hp; b.takeHit({ x: b.x - 10, dmgMul: 1 }, d0); out.normal = h - b.hp;
    b.startAttack(b.ATK.leap);
    let maxZ = 0;
    for (let t = 0; t < 160 && b.state !== 'open'; t++) { g.step(); maxZ = Math.max(maxZ, b.z); }
    out.st = b.state; out.maxZ = Math.round(maxZ); out.z = b.z; const x0 = b.x;
    h = b.hp; b.takeHit({ x: b.x - 10, dmgMul: 1 }, d0); out.openDmg = h - b.hp;
    for (let t = 0; t < 60; t++) g.step();
    out.moved = Math.abs(b.x - x0);
    for (let t = 0; t < 200 && b.state === 'open'; t++) g.step();
    out.after = b.state;
    b.cool = 1e9; b.hp = b.maxHp * 0.4; g.enemies.length = 0; g.enemies.push(b); b.setState('idle'); b.atk = null;
    b.startAttack(b.ATK.summon);
    for (let t = 0; t < 80; t++) g.step();
    out.commandos = g.enemies.filter((e) => e.kind === 'commando' && !e.dead).length;
    TT.debug.god(false); g.enemies.length = 0;
    return out;
  });
  ok('Slade: salto com o bastão e guarda aberta depois (parado, dano dobrado), depois se recupera', slade.st === 'open' && slade.maxZ > 200 && slade.z === 0 && slade.openDmg === slade.normal * 2 && slade.moved < 1 && slade.after !== 'open', slade);
  ok('Slade: chama comandos na fase 2', slade.commandos === 2, slade);
  for (const k in s5) if (k !== 'armor') ok('fase 5: golpe ' + k + ' acerta após o aviso', s5[k].zone && s5[k].inside && s5[k].hitT >= s5[k].s, s5[k]);
  ok('fase 5: Mammoth não cai com golpe comum (super armadura)', s5.armor !== 'down' && s5.armor !== 'hurt', s5.armor);

  // 4b5) Vozes: só a Ravena fala ("Azarath Metrion Zinthos!"); os outros Titãs ficam só no balão
  const voices = await ev(() => {
    const g = TT.game, A = TT.audio, calls = [], orig = A.voice;
    A.voice = (k, t) => calls.push(k + ':' + t);
    TT.debug.start(0); TT.debug.toSection(0); TT.debug.step(5);
    for (const i of [3, 2, 0, 4]) {
      g.switchCool = 0; g.switchTo(i, true); TT.debug.step(60);
      g.energy = 100; g.input.pressed.add('special'); TT.debug.step(30);
    }
    A.voice = orig;
    return calls;
  });
  ok('vozes: só a Ravena fala ("Azarath Metrion Zinthos!")', voices.length > 0 && voices.every((c) => c === 'raven:Azarath Metrion Zinthos!'), voices);
  const songs = await ev(() => TT.STAGES.map((s) => s.song));
  ok('trilha: a abertura de Teen Titans toca em todas as fases', songs.length === 7 && songs.every((s) => s === 'theme'), songs);

  // 4c) Avisos dos chefes: marcação no chão + "!" ANTES de cada golpe, e a hitbox bate com a marcação.
  // Para cada ataque, o Titã fica parado num ponto dentro e noutro fora da zona marcada.
  const bossTele = await ev(() => {
    const g = TT.game;
    
    const runAtk = (stage, name, place) => {
      TT.debug.start(stage); TT.debug.toSection(4); TT.debug.god(false);
      let n = 0;
      while ((!g.boss || !g.boss.active) && n++ < 400) g.step();
      const b = g.boss;
      g.enemies.length = 0; g.enemies.push(b); g.projectiles.length = 0; g.effects.length = 0;
      b.x = g.camX + 700; b.y = 580; b.vx = b.vy = 0; b.z = 0; b.facing = -1; b.cool = 1e9; b.setState('idle');
      const p = g.player;
      p.hp = p.maxHp = 99999; p.invul = 0; p.z = 0; p.vz = 0; p.setState('idle'); p.atk = null;
      p.x = b.x - 300; p.y = 580;
      b.startAttack(b.ATK[name]);
      const a = b.atk;
      let zone = a.zones ? a.zones.slice() : null;
      const pos = place(b, zone);
      p.x = pos.x; p.y = pos.y;
      let tells = 0, zoneFrames = 0, hitT = -1, inside = null, t = 0;
      const h0 = p.hp;
      for (t = 1; t < 260; t++) {
        // na pedra, o alvo segue o Titã até travar; reposiciona depois de travar
        if (pos.after && t === pos.afterT) { const q = pos.after(b, b.atk && b.atk.zones && b.atk.zones[0]); p.x = q.x; p.y = q.y; }
        if (b.atk === a && b.tellK() >= 0) tells++;
        const zs = g.dangerZones();
        if (zs.length) { zoneFrames++; zone = zs.slice(); }
        if (hitT < 0) inside = zone ? zone.some((z) => TT.zoneHas(z, p.x, p.y)) : false;
        p.vx = p.vy = 0;
        if (p.state === 'idle') { p.x = pos.lockX != null ? pos.lockX : p.x; }
        g.step();
        if (hitT < 0 && p.hp < h0) hitT = t;
        if (b.state !== 'attack' && !g.projectiles.length && !g.effects.length && t > 40) break;
      }
      b.cool = 1e9;
      return { hit: hitT > 0, hitT, inside, tells, zoneFrames, s: a.def.s };
    };
    const R = {};
    const C = (stage, name, inPos, outPos) => {
      R[name + ':dentro'] = runAtk(stage, name, inPos);
      R[name + ':fora'] = runAtk(stage, name, outPos);
    };
    C(0, 'swipe', (b) => ({ x: b.x - 150, y: b.y + 10 }), (b) => ({ x: b.x - 245, y: b.y }));
    C(0, 'pound', (b) => ({ x: b.x - 300, y: b.y + 40 }), (b) => ({ x: b.x - 560, y: 695 }));
    C(0, 'charge', (b) => ({ x: b.x - 420, y: b.y + 20 }), (b) => ({ x: b.x - 420, y: b.y + 84 }));
    C(0, 'throw', (b) => ({ x: b.x - 400, y: b.y + 30 }),
      (b) => ({ x: b.x - 400, y: b.y + 30, afterT: Math.ceil(b.atk.def.s * 0.6), after: (bb, z) => ({ x: z.x - z.rx - 40, y: z.y }) }));
    C(1, 'drill', (b) => ({ x: b.x - 260, y: b.y }), (b) => ({ x: b.x - 260, y: b.y + 80 }));
    C(1, 'laser', (b) => ({ x: b.x - 600, y: b.y - 10 }), (b) => ({ x: b.x - 600, y: b.y + 60 }));
    // Overload (fase 3)
    C(2, 'bolt', (b) => ({ x: b.x - 420, y: b.y + 10 }), (b) => ({ x: b.x - 420, y: b.y + 60 }));
    C(2, 'puddles', (b) => ({ x: b.x - 380, y: b.y, afterT: 2, after: (bb, z) => ({ x: z.x + 20, y: z.y + 6 }) }), (b) => ({ x: b.x - 380, y: b.y, afterT: 2, after: (bb) => {
      // depois das poças marcadas, vai para um ponto fora de todas
      const zs = bb.atk.zones;
      for (let x = bb.game.camX + 60; x < bb.game.camX + 1220; x += 20) for (let y = 480; y < 690; y += 15) if (!zs.some((z) => TT.zoneHas(z, x, y)) && Math.abs(x - bb.x) > 120) return { x, y, lockX: x };
      return { x: bb.x, y: bb.y };
    } }));
    C(2, 'teleport', (b) => ({ x: b.x - 400, y: b.y + 20 }),
      (b) => ({ x: b.x - 400, y: b.y + 20, afterT: Math.ceil(b.atk.def.s * 0.6), after: (bb, z) => ({ x: z.x + z.rx + 50, y: z.y }) }));
    C(2, 'ring', (b) => ({ x: b.x - 250, y: b.y }), (b) => ({ x: b.x - 80, y: b.y + 20 }));
    // Plasmus (fase 4)
    C(3, 'punch', (b) => ({ x: b.x - 320, y: b.y + 10 }), (b) => ({ x: b.x - 320, y: b.y + 70 }));
    C(3, 'spit', (b) => ({ x: b.x - 380, y: b.y, afterT: 2, after: (bb, z) => ({ x: z.x + 20, y: z.y + 6 }) }), (b) => ({ x: b.x - 380, y: b.y, afterT: 2, after: (bb) => {
      const zs = bb.atk.zones;
      for (let x = bb.game.camX + 60; x < bb.game.camX + 1220; x += 20) for (let y = 480; y < 690; y += 15) if (!zs.some((z) => TT.zoneHas(z, x, y)) && Math.abs(x - bb.x) > 120) return { x, y, lockX: x };
      return { x: bb.x, y: bb.y };
    } }));
    C(3, 'wave', (b) => ({ x: b.x - 300, y: b.y + 40 }), (b) => ({ x: b.x - 610, y: 695 }));
    C(3, 'dive', (b) => ({ x: b.x - 400, y: b.y + 20 }),
      (b) => ({ x: b.x - 400, y: b.y + 20, afterT: Math.ceil(b.atk.def.s * 0.6), after: (bb, z) => ({ x: z.x + z.rx + 50, y: z.y }) }));
    // Irmão Sangue (fase 5)
    C(4, 'palm', (b) => ({ x: b.x - 150, y: b.y + 10 }), (b) => ({ x: b.x - 260, y: b.y }));
    C(4, 'beam', (b) => ({ x: b.x - 420, y: b.y + 10 }), (b) => ({ x: b.x - 420, y: b.y + 60 }));
    C(4, 'mind', (b) => ({ x: b.x - 400, y: b.y + 20 }),
      (b) => ({ x: b.x - 400, y: b.y + 20, afterT: Math.ceil(b.atk.def.s * 0.6), after: (bb, z) => ({ x: z.x + z.rx + 50, y: z.y }) }));
    C(4, 'hurl', (b) => ({ x: b.x - 380, y: b.y, afterT: 2, after: (bb, z) => ({ x: z.x + 20, y: z.y + 6 }) }), (b) => ({ x: b.x - 380, y: b.y, afterT: 2, after: (bb) => {
      const zs = bb.atk.zones;
      for (let x = bb.game.camX + 60; x < bb.game.camX + 1220; x += 20) for (let y = 480; y < 690; y += 15) if (!zs.some((z) => TT.zoneHas(z, x, y)) && Math.abs(x - bb.x) > 120) return { x, y, lockX: x };
      return { x: bb.x, y: bb.y };
    } }));
    // Mumbo (fase 6)
    C(5, 'wand', (b) => ({ x: b.x - 420, y: b.y + 10 }), (b) => ({ x: b.x - 420, y: b.y + 60 }));
    C(5, 'cards', (b) => ({ x: b.x - 400, y: b.y }), (b) => ({ x: b.x - 400, y: b.y + 40 }));
    C(5, 'spell', (b) => ({ x: b.x - 400, y: b.y + 20 }),
      (b) => ({ x: b.x - 400, y: b.y + 20, afterT: Math.ceil(b.atk.def.s * 0.6), after: (bb, z) => ({ x: z.x + z.rx + 50, y: z.y }) }));
    C(5, 'hat', (b) => ({ x: b.x - 380, y: b.y, afterT: 2, after: (bb, z) => ({ x: z.x + 20, y: z.y + 6 }) }), (b) => ({ x: b.x - 380, y: b.y, afterT: 2, after: (bb) => {
      const zs = bb.atk.zones;
      for (let x = bb.game.camX + 60; x < bb.game.camX + 1220; x += 20) for (let y = 480; y < 690; y += 15) if (!zs.some((z) => TT.zoneHas(z, x, y)) && Math.abs(x - bb.x) > 120) return { x, y, lockX: x };
      return { x: bb.x, y: bb.y };
    } }));
    // Slade (fase 7)
    C(6, 'combo', (b) => ({ x: b.x - 150, y: b.y + 10 }), (b) => ({ x: b.x - 270, y: b.y }));
    C(6, 'leap', (b) => ({ x: b.x - 400, y: b.y + 20 }),
      (b) => ({ x: b.x - 400, y: b.y + 20, afterT: Math.ceil(b.atk.def.s * 0.6), after: (bb, z) => ({ x: z.x + z.rx + 50, y: z.y }) }));
    C(6, 'fire', (b) => ({ x: b.x - 200, y: b.y }), (b) => ({ x: b.x - 420, y: b.y }));
    C(6, 'bombs', (b) => ({ x: b.x - 380, y: b.y, afterT: 2, after: (bb, z) => ({ x: z.x + 20, y: z.y + 6 }) }), (b) => ({ x: b.x - 380, y: b.y, afterT: 2, after: (bb) => {
      const zs = bb.atk.zones;
      for (let x = bb.game.camX + 60; x < bb.game.camX + 1220; x += 20) for (let y = 480; y < 690; y += 15) if (!zs.some((z) => TT.zoneHas(z, x, y)) && Math.abs(x - bb.x) > 120) return { x, y, lockX: x };
      return { x: bb.x, y: bb.y };
    } }));
    // mísseis caem em pontos aleatórios: confere que acerto == estar dentro de algum círculo
    for (let i = 0; i < 4; i++) R['missiles#' + i] = runAtk(1, 'missiles', (b) => ({ x: b.x - 350, y: 590 }));
    TT.debug.god(false);
    return R;
  });
  for (const k in bossTele) {
    const r = bossTele[k];
    const isMissile = k.startsWith('missiles');
    const expectHit = isMissile ? r.inside : k.endsWith(':dentro');
    const warned = (r.tells > 0 || isMissile) && r.zoneFrames >= Math.min(20, r.s * 0.7) && (!r.hit || r.hitT > r.s * 0.7);
    ok('aviso do chefe: ' + k + (expectHit ? ' (acerta)' : ' (não acerta)'), warned && r.hit === expectHit && r.inside === expectHit, r);
  }

  // 5) Jogo completo com bot (modo deus): todas as fases até a vitória, 3 vezes (detecta travamentos raros)
  for (let run = 1; run <= 3; run++) {
    const full = await ev(() => {
      const g = TT.game;
      TT.debug.start(0); TT.debug.god(true); TT.debug.bot(true);
      const seen = new Set();
      let steps = 0, lastCam = -1, still = 0, stall = null;
      while (g.state !== 'victory' && steps < 200000) {
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
    ok('jogo completo (7 fases) até a vitória #' + run + ' (bot, modo deus)', full.state === 'victory' && !full.stall && full.seen.includes('play:6') && full.seen.includes('clear:6'), full);
  }

  // 6) Bot sem modo deus vence cada chefe no NORMAL
  for (const st of [0, 1, 2, 3, 4, 5, 6]) {
    const r = await ev((stage) => {
      const g = TT.game;
      TT.game.setDifficulty('normal'); TT.debug.god(false);
      TT.debug.start(stage); TT.debug.toSection(4); TT.debug.bot(true);
      let steps = 0;
      while (g.state === 'play' && steps < 20000) { g.step(); steps++; }
      TT.debug.bot(false);
      return { stage, result: g.state, steps, koTitans: g.team.filter((t) => t.ko).length, bossHp: g.boss ? Math.round(g.boss.hp) : 0 };
    }, st);
    ok('bot vence o chefe da fase ' + (st + 1) + ' sem trapaça (NORMAL)', r.result === 'clear', r);
  }

  // 6a) BOTÕES NA TELA (celular): liga pelo menu, analógico navega no menu e anda, botões golpeiam,
  //     pausa e opacidade (salva no navegador). Usa o mouse, que gera os mesmos eventos de ponteiro do toque.
  await page.goto('http://localhost:8765/?touch=' + Date.now());
  await page.waitForFunction(() => window.TT && TT.debug);
  const frames = (n) => ev((n) => new Promise((r) => { const f0 = TT.game.frame; (function w() { if (TT.game.frame >= f0 + n) r(); else requestAnimationFrame(w); })(); }), n);
  await frames(30);
  const tc = {};
  tc.menu = await ev(() => {
    const g = TT.game; g.state = 'title'; g.stateT = 50; g.menuIdx = 0; g.input.endStep();
    const press = (k) => { g.input.pressed.add(k); g.step(); };
    const hidden = getComputedStyle(document.getElementById('tt-touch')).display === 'none';
    const was = g.touch.level;
    g.menuIdx = g.titleItems().indexOf('touch');
    g.touch.level = 'off'; press('right');
    const on = { lvl: g.touch.level, label: g.menuLabel('touch').value };
    press('right'); press('left'); press('left');
    const off = g.touch.level;
    press('right'); press('right');
    g.menuIdx = 0;
    return { was, hidden, on, off, lvl: g.touch.level, display: getComputedStyle(document.getElementById('tt-touch')).display, css: document.getElementById('tt-touch').style.opacity, saved: TT.store.get('botoes') };
  });
  const box = async (sel) => { const b = await page.locator(sel).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const z = await box('#tt-stick-zone');
  const flick = async (dx, dy) => { await page.mouse.move(z.x, z.y); await page.mouse.down(); await page.mouse.move(z.x + dx, z.y + dy, { steps: 4 }); await frames(3); await page.mouse.up(); await frames(3); };
  await flick(0, 80); await flick(0, 80);
  tc.menuMoved = await ev(() => TT.game.menuIdx);
  await flick(0, -80); await flick(0, -80);
  const tapBtn = async (act) => { const b = await box('[data-act=' + act + ']'); await page.mouse.click(b.x, b.y); await frames(2); };
  await tapBtn('light'); await frames(8);
  tc.started = await ev(() => TT.game.state === 'play' && TT.game.stageIdx === 0);
  await ev(() => { TT.game.banner = null; for (const t of TT.game.team) t.invul = 0; });
  const tx0 = await ev(() => TT.game.player.x);
  await page.mouse.move(z.x, z.y); await page.mouse.down(); await page.mouse.move(z.x + 90, z.y, { steps: 4 });
  await frames(40);
  tc.walked = Math.round((await ev(() => TT.game.player.x)) - tx0);
  await page.mouse.up(); await frames(5);
  tc.moves = {};
  for (const a of ['light', 'heavy', 'special', 'jump']) { await frames(50); await ev(() => { TT.game.energy = 100; }); await tapBtn(a); tc.moves[a] = await ev(() => TT.game.player.state); }
  await frames(60);
  const k0 = await ev(() => TT.game.player.key);
  await tapBtn('next'); await frames(3);
  tc.switched = k0 !== (await ev(() => TT.game.player.key));
  await tapBtn('pause');
  tc.paused = await ev(() => TT.game.state);
  await flick(0, 80); await flick(0, 80);
  tc.pauseItem = await ev(() => TT.game.pauseItems()[TT.game.pauseIdx]);
  await flick(-90, 0);
  tc.opacity = await ev(() => ({ lvl: TT.game.touch.level, css: document.getElementById('tt-touch').style.opacity, saved: TT.store.get('botoes') }));
  await tapBtn('pause');
  tc.resumed = await ev(() => TT.game.state);
  // volta a deixar os botões como estavam (sem nada salvo)
  await ev(() => { localStorage.removeItem('jovensTitas.botoes'); TT.game.touch.level = 'off'; TT.game.touch.apply(); });
  ok('botões na tela: item do menu liga, muda a opacidade, desliga e salva',
    tc.menu.hidden && tc.menu.on.lvl === 0.25 && tc.menu.on.label === '25%' && tc.menu.off === 'off' && tc.menu.lvl === 0.4 && tc.menu.display === 'block' && tc.menu.css === '0.4' && tc.menu.saved === '0.4', tc.menu);
  ok('botões na tela: analógico navega no menu e ATAQUE começa o jogo', tc.menuMoved === 2 && tc.started, tc);
  ok('botões na tela: analógico anda e ATAQUE/FORTE/ESPECIAL/PULO funcionam',
    tc.walked > 100 && tc.moves.light === 'attack' && tc.moves.heavy === 'attack' && tc.moves.special === 'attack' && tc.moves.jump === 'air', tc);
  ok('botões na tela: TROCAR, pausa (II) e opacidade pela pausa', tc.switched && tc.paused === 'pause' && tc.pauseItem === 'touch' && tc.opacity.lvl === 0.25 && tc.opacity.css === '0.25' && tc.opacity.saved === '0.25' && tc.resumed === 'play', tc);

  // 6a2) MENU INICIAL: pela pausa (pede confirmação) e pela tela de game over (Esc)
  const quit = await ev(() => {
    TT.paused = true;
    const g = TT.game, out = {};
    const press = (...ks) => { for (const k of ks) g.input.pressed.add(k); g.step(); };
    TT.debug.start(3); TT.debug.step(30);
    press('pause', 'menu'); // Esc manda 'pause' e 'menu'
    const items = g.pauseItems();
    out.paused = g.state;
    for (let i = 0; i < items.indexOf('quit'); i++) press('down');
    out.item = items[g.pauseIdx];
    press('light'); out.armed = [g.state, g.menuLabel('quit').value];
    press('up'); press('down'); out.disarmed = !g.quitArm;
    press('light'); press('menu');
    out.title = [g.state, g.menuIdx, g.score];
    // game over: Esc volta ao título; ENTER tenta de novo
    TT.debug.start(2); TT.debug.step(5);
    g.state = 'gameover'; g.stateT = 100;
    press('pause', 'menu');
    out.fromGameOver = g.state;
    TT.debug.start(2); TT.debug.step(5);
    g.state = 'gameover'; g.stateT = 100;
    press('start', 'menu');
    out.retry = [g.state, g.stageIdx];
    return out;
  });
  ok('menu inicial pela pausa (com confirmação)', quit.paused === 'pause' && quit.item === 'quit' && quit.armed[0] === 'pause' && quit.armed[1] === 'CONFIRMAR' && quit.disarmed && quit.title[0] === 'title' && quit.title[1] === 0 && quit.title[2] === 0, quit);
  ok('menu inicial pelo game over (Esc); ENTER ainda tenta de novo', quit.fromGameOver === 'title' && quit.retry[0] === 'play' && quit.retry[1] === 2, quit);

  // 6b) CO-OP LOCAL (2 jogadores) — recarrega a página para não herdar estado dos testes anteriores
  await page.goto('http://localhost:8765/?coop=' + Date.now());
  await page.waitForFunction(() => window.TT && TT.debug);
  await sleep(400);
  await ev(() => { TT.paused = false; TT.debug.bot(false); TT.debug.god(false); TT.game.state = 'title'; TT.game.stateT = 50; TT.game.menuIdx = 0; TT.game.setPlayers(1); });
  // cada tecla espera o jogo processar alguns passos (o 1º quadro após recarregar monta os cenários e demora)
  const tap = async (key) => {
    const f0 = await ev(() => TT.game.frame);
    await page.keyboard.press(key);
    await page.waitForFunction((f) => TT.game.frame >= f + 3, f0, { timeout: 5000 }).catch(() => {});
  };
  await page.waitForFunction(() => TT.game.frame > 30, null, { timeout: 8000 }).catch(() => {});
  await tap('ArrowDown');
  await tap('ArrowDown');
  await tap('ArrowRight');
  const coopSel = await ev(() => TT.game.numPlayers);
  await tap('ArrowUp');
  await tap('ArrowUp');
  await tap('Enter'); await sleep(100);
  const coopStart = await ev(() => ({ st: TT.game.state, n: TT.game.players().length, keys: TT.game.players().map((t) => t.key) }));
  ok('co-op: escolher 2 jogadores no título e começar', coopSel === 2 && coopStart.st === 'play' && coopStart.n === 2 && coopStart.keys[0] !== coopStart.keys[1], { coopSel, coopStart });
  await ev(() => { TT.game.banner = null; for (const t of TT.game.players()) t.invul = 0; });
  // controles independentes com teclado real
  const pos = () => ev(() => TT.game.players().map((t) => Math.round(t.x)));
  const a0 = await pos();
  // segura a tecla por 24 passos do jogo (não por tempo: independe da carga da máquina)
  const hold = async (key) => {
    const f0 = await ev(() => TT.game.frame);
    await page.keyboard.down(key);
    await page.waitForFunction((f) => TT.game.frame >= f + 24, f0, { timeout: 5000 }).catch(() => {});
    await page.keyboard.up(key);
  };
  await hold('KeyD');
  const a1 = await pos();
  await hold('ArrowRight');
  const a2 = await pos();
  ok('co-op: P1 (WASD) e P2 (setas) andam de forma independente', a1[0] > a0[0] + 60 && Math.abs(a1[1] - a0[1]) < 5 && a2[1] > a1[1] + 60 && Math.abs(a2[0] - a1[0]) < 5, { a0, a1, a2 });
  const waitFrames = async (n) => { const f0 = await ev(() => TT.game.frame); await page.waitForFunction((a) => TT.game.frame >= a[0] + a[1], [f0, n], { timeout: 8000 }).catch(() => {}); };
  await tap('Numpad1');
  const atk2 = await ev(() => TT.game.players().map((t) => t.state));
  await waitFrames(40);
  await tap('KeyJ');
  const atk1 = await ev(() => TT.game.players().map((t) => t.state));
  ok('co-op: P2 ataca no Numpad1 e P1 no J', atk2[1] === 'attack' && atk2[0] !== 'attack' && atk1[0] === 'attack', { atk1, atk2 });
  await waitFrames(40);
  // troca de Titã pula o que está com o outro jogador
  await tap('Numpad6'); await waitFrames(26);
  const sw1 = await ev(() => TT.game.players().map((t) => t.key));
  await tap('Digit2'); await waitFrames(26);
  const sw2 = await ev(() => TT.game.players().map((t) => t.key));
  await tap('Numpad4'); await waitFrames(26);
  const sw3 = await ev(() => TT.game.players().map((t) => t.key));
  await tap('Digit1'); await waitFrames(26);
  const sw4 = await ev(() => TT.game.players().map((t) => t.key));
  ok('co-op: Titãs sempre distintos (troca pula o do parceiro)',
    sw1[1] === 'cyborg' && sw2[0] === 'beastboy' && sw3[1] === 'robin' && sw4[0] === 'beastboy' && sw4[0] !== sw4[1], { sw1, sw2, sw3, sw4 });

  const coop = await ev(() => {
    TT.paused = true;
    const g = TT.game, out = {};
    g.setPlayers(2);
    // inimigos escolhem o alvo mais próximo e atacam os dois
    TT.debug.start(0); TT.debug.toSection(0); TT.debug.step(3);
    g.stage = Object.assign({}, g.stage, { sections: [] });
    const [p1, p2] = g.players();
    p1.x = g.camX + 200; p1.y = 600; p2.x = g.camX + 1000; p2.y = 600;
    for (const p of [p1, p2]) { p.hp = p.maxHp = 99999; p.invul = 0; }
    g.enemies.length = 0; g.tokens = 4;
    const e1 = new TT.Enemy(g, 'hive', p1.x + 90, 600), e2 = new TT.Enemy(g, 'hive', p2.x - 90, 600);
    for (const e of [e1, e2]) { e.entering = false; e.cool = 0; g.addEnemy(e); }
    out.targets = [g.targetFor(e1) === p1, g.targetFor(e2) === p2];
    for (let i = 0; i < 400; i++) g.step();
    out.dmg = [Math.round(99999 - p1.hp), Math.round(99999 - p2.hp)];
    // onda de choque e explosão atingem os dois
    g.enemies.length = 0; p1.hp = p2.hp = 99999;
    for (const p of [p1, p2]) { p.setState('idle'); p.z = 0; p.invul = 0; }
    p1.x = g.camX + 500; p2.x = g.camX + 780; p1.y = p2.y = 600;
    g.addEffect(new TT.Shockwave(g, g.camX + 640, 600, 400, 10, 'enemy'));
    for (let i = 0; i < 60; i++) g.step();
    out.shock = [p1.hp < 99999, p2.hp < 99999];
    for (let i = 0; i < 80; i++) g.step();
    for (const p of [p1, p2]) { p.setState('idle'); p.z = 0; p.invul = 0; p.hp = 99999; p.y = 600; }
    p1.x = g.camX + 600; p2.x = g.camX + 680;
    g.blast(g.camX + 640, 600, 120, 10, 'enemy', null);
    out.blast = [p1.hp < 99999, p2.hp < 99999];
    // câmera mantém os dois na tela (P1 corre para a direita, P2 fica parado)
    TT.debug.start(0); TT.debug.step(3);
    g.stage = Object.assign({}, g.stage, { sections: [] });
    let onScreen = true, moved = 0;
    const [q1, q2] = g.players();
    const x0 = g.camX;
    for (let i = 0; i < 500; i++) {
      g.input.pl[0].bot = { down: new Set(['right']), pressed: new Set() };
      g.step();
      for (const q of [q1, q2]) if (q.x < g.camX || q.x > g.camX + 1280) onScreen = false;
    }
    g.input.pl[0].bot = null;
    moved = Math.round(g.camX - x0);
    out.camera = { onScreen, moved, gap: Math.round(q1.x - q2.x) };
    // game over só quando todos os Titãs de ambos caírem
    TT.debug.start(0); TT.debug.step(3);
    const [r1, r2] = g.players();
    const kill = (t) => { t.invul = 0; t.setState('idle'); t.takeHit({ x: t.x - 5, dmgMul: 1 }, { dmg: 1e6 }); };
    const run = (n) => { for (let i = 0; i < n; i++) g.step(); };
    kill(r1); run(80);                     // P1 troca para outro Titã livre
    const afterFirst = g.state;
    let guard = 0;
    while (g.team.filter((t) => !t.ko).length > 1 && guard++ < 10) { const t = g.slotTitan(0); if (g.slots[0].out) break; kill(t); run(80); }
    out.over = { afterFirst, p1out: g.slots[0].out, stillPlaying: g.state, alive: g.team.filter((t) => !t.ko).map((t) => t.key) };
    kill(g.slotTitan(1)); run(120);
    out.over.final = g.state;
    g.setPlayers(1);
    return out;
  });
  ok('co-op: inimigos miram o Titã mais próximo e atacam os dois', coop.targets.every(Boolean) && coop.dmg[0] > 0 && coop.dmg[1] > 0, coop);
  ok('co-op: onda de choque e explosão atingem os dois', coop.shock.every(Boolean) && coop.blast.every(Boolean), coop);
  ok('co-op: câmera mantém os dois jogadores na tela', coop.camera.onScreen && coop.camera.moved > 50, coop.camera);
  ok('co-op: game over só quando todos os Titãs caem', coop.over.afterFirst === 'play' && coop.over.stillPlaying === 'play' && coop.over.p1out && coop.over.final === 'gameover', coop.over);

  // co-op completo: 2 bots jogam a fase 1 até o fim (modo deus)
  const coopRun = await ev(() => {
    const g = TT.game;
    g.setPlayers(2);
    TT.debug.start(0); TT.debug.god(true); TT.debug.bot(true, 0); TT.debug.bot(true, 1);
    let steps = 0, offscreen = 0;
    while (g.state === 'play' && steps < 30000) {
      g.step(); steps++;
      if (steps % 30 === 0) { g.render(); for (const t of g.players()) if (t.x < g.camX || t.x > g.camX + 1280) offscreen++; }
    }
    const res = { state: g.state, steps, offscreen, distinct: g.slots[0].ai !== g.slots[1].ai };
    TT.debug.bot(false, 0); TT.debug.bot(false, 1); TT.debug.god(false); g.setPlayers(1);
    return res;
  });
  ok('co-op: dois bots (P1 e P2) completam a fase 1', coopRun.state === 'clear' && coopRun.offscreen === 0 && coopRun.distinct, coopRun);

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
  ok('desempenho (>= 50 fps, render médio < 2ms)', perf.fps >= 50 && perf.avgRenderMs < 2, perf);

  // Animações próprias de cada Titã
  const anims = await ev(() => {
    TT.paused = true; const g = TT.game;
    TT.debug.start(0); TT.debug.toSection(0); TT.debug.step(5);
    const forms = new Set();
    for (let i = 0; i < 40; i++) { // fim do combo do Mutano: animal aleatório
      g.switchCool = 0; g.switchTo(1, true); const p = g.player; p.comboWindow = 10; p.combo = 2; p.setState('idle');
      p.doCombo(); forms.add(p.atk.def.form); p.atk = null; p.setState('idle');
    }
    const pose = (key, setup) => { const t = g.team.find((x) => x.key === key); setup(t); return TT.computePose(t, TT.newPose()); };
    const robinJump = pose('robin', (t) => { t.anim = 'jump'; t.jumpT = 17; t.vz = 0; });
    const robinRoll = pose('robin', (t) => { t.anim = 'dash'; t.animT = 7; });
    const atk = (key, i) => pose(key, (t) => { t.anim = 'attack'; t.atk = { def: t.def.light[i], t: t.def.light[i].s, hits: new Set() }; });
    const rv = atk('raven', 0), sf = atk('starfire', 0), cy = atk('cyborg', 0);
    const ravenIdle = pose('raven', (t) => { t.anim = 'idle'; t.animT = 0; t.atk = null; });
    const robinCombo = g.team.find((x) => x.key === 'robin').def.light.map((d) => d.anim);
    return { forms: [...forms], robinCombo, robinFlip: robinJump.spin, robinRoll: robinRoll.spin, ravenAura: rv.auraF, ravenCircle: rv.circleF, starAura: sf.auraF, cyPiston: cy.piston, ravenHover: ravenIdle.bob };
  });
  ok('Mutano vira animais aleatórios no fim do combo', anims.forms.length >= 3, anims.forms);
  ok('Robin: combo no chão, sem piruetas (pulo e esquiva sem giro)', Math.abs(anims.robinFlip) < 0.01 && Math.abs(anims.robinRoll) < 0.01 && anims.robinCombo.length === 3 && new Set(anims.robinCombo).size === 3, anims);
  ok('Ravena e Estelar atacam com aura nas mãos e círculo mágico', anims.ravenAura > 0.9 && anims.ravenCircle > 0.5 && anims.starAura > 0.9, anims);
  ok('Ciborgue usa o punho-pistão e Ravena flutua', anims.cyPiston > 0.9 && anims.ravenHover < -8, anims);

  // Capa do Robin com física: pendurada parada, esvoaça para trás ao correr
  const capeT = await ev(() => {
    TT.paused = true; const g = TT.game;
    TT.debug.start(0); TT.debug.step(60);
    const p = g.player, tip = () => (p.cape[p.cape.length - 1].x - p.x) * p.facing;
    const idleTip = tip(), idleDrop = p.cape[p.cape.length - 1].y - p.cape[0].y;
    g.input.bot = { down: new Set(['right']), pressed: new Set() }; TT.debug.step(40); g.input.bot = null;
    return { idleTip: Math.round(idleTip), idleDrop: Math.round(idleDrop), runTip: Math.round(tip()), faces: Object.keys(TT.FACES).length };
  });
  ok('capa do Robin com física (pendurada parada, esvoaça correndo)', capeT.idleDrop > 40 && capeT.runTip < capeT.idleTip - 15, capeT);
  ok('rostos vetoriais dos 5 Titãs', capeT.faces === 5, capeT);

  // Regressão: renderiza CADA quadro de todos os golpes de todos os Titãs (o raio do Ciborgue deixava a tela branca),
  // com os golpes originais (fase 1) e os golpes novos (fase 7)
  const allFrames = await ev(() => {
    TT.paused = true; const g = TT.game; const before = (TT.errors || []).length;
    for (const st of [0, 6]) {
      TT.debug.start(st); TT.debug.god(true); TT.debug.toSection(1); TT.debug.step(60);
      for (let i = 0; i < 5; i++) {
        g.switchCool = 0; g.switchTo(i, true); TT.debug.step(20);
        for (const seq of [['light', 'light', 'light'], ['heavy'], ['special'], ['jump', 'light'], ['dash', 'light']]) {
          g.energy = 100;
          for (const b of seq) { g.input.pressed.add(b); for (let f = 0; f < 14; f++) { g.step(); g.render(); } }
          for (let f = 0; f < 90; f++) { g.step(); g.render(); }
        }
      }
    }
    TT.debug.god(false);
    return { errors: (TT.errors || []).length - before, comp: g.ctx.globalCompositeOperation, alpha: g.ctx.globalAlpha };
  });
  ok('todos os golpes renderizam quadro a quadro sem erro (raio do Ciborgue)', allFrames.errors === 0 && allFrames.comp === 'source-over' && allFrames.alpha === 1, allFrames);

  ok('nenhum erro de JavaScript', errors.length === 0 && (await ev(() => (TT.errors || []).length)) === 0, errors.slice(0, 5));
  await ev(() => { TT.paused = false; TT.debug.start(0); TT.game.state = 'title'; });
  const failed = results.filter((r) => !r.pass).length;
  return JSON.stringify({ failed, total: results.length, results }, null, 1);
}
