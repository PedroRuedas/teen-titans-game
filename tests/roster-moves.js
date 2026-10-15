// Golpes dos personagens extras (menu PERSONAGENS): cada golpe de cada personagem, nos três níveis de
// poder (fase 1, fase 7 e fase 8), roda sem erro de JavaScript e acerta um inimigo parado à frente.
// Uso: playwright-cli run-code --filename=tests/roster-moves.js (com o jogo aberto em http://localhost:8765/)
async (page) => {
  return await page.evaluate(() => {
    const g = TT.game, out = { fails: [], ok: 0, errors0: (TT.errors || []).length };
    TT.audio.muted = true; g.godMode = true;
    const keys = TT.ROSTER.filter((r) => TT.TITANS[r.key] && !['robin', 'cyborg', 'raven', 'starfire', 'beastboy'].includes(r.key)).map((r) => r.key);
    const setup = (key, stageIdx) => {
      g.setTeam([key].concat(TT.DEFAULT_TEAM.filter((k) => k !== key).slice(0, 4)));
      g.startStage(stageIdx); g.banner = null; g.powerBanner = 0;
      const p = g.player; p.invul = 0;
      const e = new TT.Enemy(g, 'hive', p.x + 90, p.y); e.entering = false; e.cool = 99999; e.hp = e.maxHp = 99999; e.def = Object.assign({}, e.def, { speed: 0 }); g.addEnemy(e);
      return { p, e };
    };
    const run = (n) => { for (let i = 0; i < n; i++) g.step(); g.render(); };
    for (const key of keys) {
      for (const [lv, si] of [[0, 0], [1, 6], [2, 7]]) {
        const moves = ['light', 'heavy', 'special', 'air', 'dashAtk'].concat(lv === 2 ? ['ender'] : []);
        for (const mv of moves) {
          const { p, e } = setup(key, si);
          const hp0 = e.hp, err0 = (TT.errors || []).length;
          g.energy = 100;
          let defs = mv === 'light' ? p.def.light : [p.def[mv]];
          for (const d of defs) {
            e.x = p.x + 90; e.y = p.y; e.vx = 0; e.state = 'idle'; e.z = 0; e.dead = false;
            if (mv === 'air') { p.z = 60; p.vz = 4; p.setState('air'); }
            p.startAttack(d);
            if (mv === 'special') g.energy = Math.max(0, g.energy - d.cost);
            run(d.s + d.a + d.r + 50);
            p.atk = null; p.z = 0; p.vz = 0; p.setState('idle');
          }
          run(80);
          const errs = (TT.errors || []).length - err0;
          const dmg = Math.round(hp0 - e.hp);
          if (errs || dmg <= 0) out.fails.push({ key, lv, mv, errs, dmg, err: errs ? String(TT.errors[TT.errors.length - 1]) : null });
          else out.ok++;
        }
      }
    }
    g.setTeam(TT.DEFAULT_TEAM.slice()); g.godMode = false;
    return out;
  });
}
