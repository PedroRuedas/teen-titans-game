// Teste do JOGAR ONLINE com duas abas de verdade (anfitrião e convidado), conectando pelo servidor do
// PeerJS (precisa de internet). Fica separado da suíte principal porque depende de um serviço externo.
// Uso: node tests/serve.js  e  playwright-cli open http://localhost:8765/ && playwright-cli run-code --filename=tests/online-test.js
async page => {
  const results = [], errors = [];
  const ok = (name, pass, info) => results.push({ name, pass: !!pass, info });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // o convidado fica numa janela separada (como no aparelho do amigo); na mesma janela o navegador
  // desacelera a aba de trás e o anfitrião rodaria a poucos quadros por segundo
  const host = page, guestCtx = await page.context().browser().newContext(), guest = await guestCtx.newPage();
  for (const [p, tag] of [[host, 'anfitrião'], [guest, 'convidado']]) {
    p.on('pageerror', (e) => errors.push(tag + ': ' + e.message));
    await p.setViewportSize({ width: 1280, height: 720 });
  }
  await host.goto('http://localhost:8765/?online=' + Date.now());
  await host.waitForFunction(() => window.TT && TT.game && TT.game.online);
  await sleep(300);

  // anfitrião: JOGAR ONLINE (2º item do título) -> CRIAR SALA
  await host.evaluate(() => { const g = TT.game; g.state = 'title'; g.stateT = 50; g.menuIdx = 0; g.input.endStep(); });
  // espera o jogo processar cada tecla (o 1º quadro depois de carregar monta os cenários e demora)
  await host.keyboard.press('ArrowDown');
  await host.waitForFunction(() => TT.game.menuIdx === 1, null, { timeout: 5000 }).catch(() => {});
  await host.keyboard.press('Enter');
  const opened = await host.waitForFunction(() => TT.game.online.panelOpen, null, { timeout: 5000 }).then(() => true).catch(() => false);
  ok('título: JOGAR ONLINE abre a janela', opened && (await host.evaluate(() => TT.game.titleItems()[1] === 'online')));
  await host.click('#tt-online [data-a=create]');
  const code = await host.waitForFunction(() => TT.game.online.code, null, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => null);
  ok('anfitrião cria a sala e recebe um código de 5 letras', /^[A-Z0-9]{5}$/.test(code || ''), code);

  // convidado: abre o link de convite e entra
  await guest.goto('http://localhost:8765/?sala=' + code);
  await guest.waitForFunction(() => window.TT && TT.game && TT.game.online && TT.game.online.panelOpen, null, { timeout: 8000 });
  ok('link de convite abre a janela com o código', (await guest.inputValue('#tt-online input')) === code);
  await guest.click('#tt-online [data-a=join]');
  const linked = await host.waitForFunction(() => TT.game.online.hosting, null, { timeout: 25000 }).then(() => true).catch(() => false);
  const video = await guest.waitForFunction(() => { const v = document.getElementById('tt-video'); return v && v.videoWidth > 0 && v.srcObject; }, null, { timeout: 25000 })
    .then(() => guest.evaluate(() => { const v = document.getElementById('tt-video'); return { w: v.videoWidth, h: v.videoHeight, audio: v.srcObject.getAudioTracks().length, canvasHidden: TT.game.canvas.style.visibility === 'hidden' }; }))
    .catch(() => null);
  ok('os dois se conectam e o anfitrião fica com 2 jogadores (P2 = amigo)', linked && (await host.evaluate(() => TT.game.numPlayers === 2 && !!TT.game.input.remote)), linked);
  ok('convidado recebe a imagem (e o som) do jogo', video && video.w > 0 && video.canvasHidden && video.audio >= 1, video);

  // anfitrião começa a fase 1; o convidado anda e ataca com o teclado dele (P2 no anfitrião)
  await host.click('#tt-online [data-a=close]').catch(() => {});
  await host.evaluate(() => { TT.debug.start(0); TT.game.banner = null; for (const t of TT.game.team) t.invul = 0; });
  await sleep(500);
  const x0 = await host.evaluate(() => TT.game.slotTitan(1).x);
  await guest.keyboard.down('KeyD'); await sleep(700); await guest.keyboard.up('KeyD');
  await sleep(150);
  const x1 = await host.evaluate(() => TT.game.slotTitan(1).x);
  const p1moved = await host.evaluate(() => Math.round(TT.game.player.x));
  ok('convidado anda: o P2 do anfitrião se move', x1 > x0 + 60, { x0: Math.round(x0), x1: Math.round(x1), p1: p1moved });
  await guest.keyboard.press('KeyJ');
  const atk = await host.waitForFunction(() => TT.game.slotTitan(1).state === 'attack', null, { timeout: 2000 }).then(() => true).catch(() => false);
  ok('convidado ataca: o P2 do anfitrião golpeia', atk);
  // o anfitrião continua com as setas no P1 (não viram controles do P2)
  const hx0 = await host.evaluate(() => TT.game.player.x);
  await host.keyboard.down('ArrowRight'); await sleep(500); await host.keyboard.up('ArrowRight');
  const hx1 = await host.evaluate(() => TT.game.player.x);
  ok('anfitrião continua jogando com as setas (P1)', hx1 > hx0 + 40, { hx0: Math.round(hx0), hx1: Math.round(hx1) });
  // pausa pelo convidado
  await sleep(300);
  await guest.keyboard.press('Escape');
  const paused = await host.waitForFunction(() => TT.game.state === 'pause', null, { timeout: 2000 }).then(() => true).catch(() => false);
  await guest.keyboard.press('Escape');
  const resumed = await host.waitForFunction(() => TT.game.state === 'play', null, { timeout: 2000 }).then(() => true).catch(() => false);
  ok('convidado pausa e despausa a partida', paused && resumed, { paused, resumed });

  // convidado sai: o anfitrião volta a jogar sozinho, sem erro
  await guest.click('#tt-badge button');
  const left = await host.waitForFunction(() => !TT.game.online.hosting && TT.game.numPlayers === 1, null, { timeout: 10000 }).then(() => true).catch(() => false);
  await sleep(400);
  const after = await host.evaluate(() => { const g = TT.game; for (let i = 0; i < 120; i++) g.step(); g.render(); return { st: g.state, players: g.players().length, errs: (TT.errors || []).length }; });
  ok('convidado sai e o anfitrião segue sozinho', left && after.st === 'play' && after.players === 1 && after.errs === 0, { left, after });
  ok('convidado volta à tela normal', await guest.evaluate(() => !TT.game.online.role && TT.game.canvas.style.visibility === '' && !document.getElementById('tt-video').classList.contains('on')));

  // sala inexistente: mensagem clara
  await guest.evaluate(() => TT.game.online.openPanel('ZZZZZ'));
  await guest.click('#tt-online [data-a=join]');
  const nf = await guest.waitForFunction(() => /não existe|Não encontrei/.test(document.querySelector('#tt-online .msg').textContent), null, { timeout: 20000 })
    .then(() => guest.evaluate(() => document.querySelector('#tt-online .msg').textContent)).catch(() => null);
  ok('sala inexistente mostra aviso', !!nf, nf);

  await host.evaluate(() => TT.game.online.leave(true));
  await guestCtx.close();
  ok('nenhum erro de JavaScript', errors.length === 0, errors.slice(0, 5));
  return JSON.stringify({ failed: results.filter((r) => !r.pass).length, total: results.length, results }, null, 1);
}
