'use strict';
// Laço principal, lógica de fase, câmera, HUD e telas.
(function () {
  const TT = window.TT;
  const W = TT.W, H = TT.H, OUT = TT.OUT;
  const A = () => TT.audio;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.input = new TT.Input();
      this.particles = new TT.Particles();
      this.scale = 1;
      this.state = 'title';
      this.frame = 0;
      this.stateT = 0;
      // equipe de 5 escolhida no menu PERSONAGENS (salva no navegador; padrão = os cinco Titãs)
      this.team = TT.loadTeam().map((k) => new TT.Titan(this, k));
      // Jogadores: cada "slot" controla um Titã da equipe (o P2 só existe no modo 2 jogadores).
      this.numPlayers = 1;
      this.slots = [this.newSlot(0, 0), this.newSlot(1, 1)];
      this.score = 0;
      this.godMode = false;
      this.titleBg = TT.makeBackground(1);
      this.titleTitans = this.team.map((t) => new TT.Titan(this, t.key));
      this.newUnlocks = [];
      this.showControls = false;
      const sd = TT.store.get('dificuldade', 'normal');
      this.difficulty = TT.DIFFICULTY[sd] ? sd : 'normal';
      this.menuIdx = 0; this.pauseIdx = 0;
      this.resetWorld();
      this.stageIdx = 0;
      this.drawables = [];
      this.stats = { frames: 0, renderMs: 0, maxRenderMs: 0 };
    }

    // "Titãs, avante!" em andamento = cutscene ativa (js/cutscene.js). superT > 0 enquanto ela roda.
    get superT() { return this.cut && !this.cut.done ? this.cut.left : 0; }
    set superT(v) { if (!v) this.cut = null; }

    newSlot(id, ai) { return { id, ai, switchCool: 0, koTimer: 0, out: false }; }
    // Compatibilidade com o modo 1 jogador: "player" / "activeIdx" / "switchCool" são do P1.
    get player() { return this.team[this.slots[0].ai]; }
    get activeIdx() { return this.slots[0].ai; }
    set activeIdx(i) { this.slots[0].ai = i; }
    get switchCool() { return this.slots[0].switchCool; }
    set switchCool(v) { this.slots[0].switchCool = v; }
    get coop() { return this.numPlayers > 1; }
    // Jogando online como anfitrião: o P2 é o amigo, então o número de jogadores fica travado em 2.
    get onlineLock() { return !!(this.online && this.online.hosting); }
    // Slots em jogo (1 ou 2).
    activeSlots() { return this.numPlayers > 1 ? this.slots : [this.slots[0]]; }
    slotTitan(s) { return this.team[this.slots[s].ai]; }
    // Titãs controlados agora (inclui o caído que ainda vai ser trocado; exclui slot sem Titã).
    players() { const out = []; for (const sl of this.activeSlots()) if (!sl.out) out.push(this.team[sl.ai]); return out; }
    slotOf(t) { const i = this.team.indexOf(t); for (const sl of this.activeSlots()) if (sl.ai === i && !sl.out) return sl; return null; }
    setPlayers(n) {
      this.numPlayers = n === 2 ? 2 : 1;
      this.input.twoPlayers = this.numPlayers === 2;
    }
    get diff() { return TT.DIFFICULTY[this.difficulty]; }
    get teamKeys() { return this.team.map((t) => t.key); }
    // Troca a equipe (5 personagens) e salva a escolha.
    setTeam(keys) {
      this.team = keys.map((k) => new TT.Titan(this, k));
      this.titleTitans = keys.map((k) => new TT.Titan(this, k));
      TT.saveTeam(keys);
    }

    // Troca a dificuldade (dir = +1/-1) e salva a escolha.
    setDifficulty(key) {
      if (!TT.DIFFICULTY[key]) return;
      this.difficulty = key;
      TT.store.set('dificuldade', key);
    }
    cycleDifficulty(dir) {
      const o = TT.DIFF_ORDER, i = o.indexOf(this.difficulty);
      this.setDifficulty(o[(i + dir + o.length) % o.length]);
      A().play('select');
    }
    // Tokens de ataque simultâneo (mínimo 1).
    baseTokens(n) { return Math.max(1, n + this.diff.tokens); }

    resetWorld() {
      this.enemies = [];
      this.props = [];
      this.pickups = [];
      this.projectiles = [];
      this.effects = [];
      this.bubbles = [];
      this.particles.clear();
      this.camX = 0; this.camMin = 0;
      this.shake = 0; this.hitstop = 0; this.slowmo = 0;
      this.energy = 30; this.flashEnergy = 0;
      this.combo = 0; this.comboT = 0;
      this.tokens = this.baseTokens(2);
      this.banner = null; this.powerBanner = 0; this.comboTag = null; this.tint = null;
      this.boss = null; this.bossShown = 0;
      this.drill = null;
      this.superT = 0;
      for (const sl of this.slots) { sl.switchCool = 0; sl.koTimer = 0; sl.out = false; }
      this.goArrow = 0;
      this.clearTimer = 0;
      this.whiteFlash = 0;
    }

    // ------------------------------------------------------------------ Fases
    startStage(i) {
      this.stageIdx = i;
      this.stage = TT.STAGES[i];
      this.resetWorld();
      this.bg = TT.makeBackground(this.stage.id);
      this.applyScale();
      this.stageStartScore = this.score;
      // nível de poder dos Titãs: golpes novos a partir da fase 7 ("powerUp"), combos a partir da fase 8 ("combos")
      const upTo = TT.STAGES.slice(0, i + 1);
      this.power = upTo.some((s) => s.combos) ? 2 : upTo.some((s) => s.powerUp) ? 1 : 0;
      this.powered = this.power > 0;
      for (const t of this.team) { t.setPower(this.power); t.reset(); }
      this.slots[0].ai = 0;
      const p = this.player;
      p.x = 220; p.y = 590; p.facing = 1;
      this.slots[1].ai = 1;
      if (this.coop) { const p2 = this.slotTitan(1); p2.x = 150; p2.y = 650; p2.facing = 1; }
      for (const c of this.stage.crates) this.props.push(new TT.Crate(this, c[0], c[1], c[2]));
      this.secIdx = 0; this.secActive = false; this.waveIdx = 0; this.waveDelay = 0;
      this.state = 'play'; this.stateT = 0;
      this.banner = { text: this.stage.name, sub: this.stage.subtitle, t: 0, dur: 200 };
      // depois do título da fase: "GOLPES NOVOS!" / "COMBOS NOVOS!" — só na fase que estreia o poder
      const before = TT.STAGES.slice(0, i);
      if ((this.stage.combos && !before.some((s) => s.combos)) || (this.stage.powerUp && !before.some((s) => s.powerUp))) this.powerBanner = 1;
      for (const l of this.bg.layers) l.warm(0);
      A().playSong(this.stage.song);
    }

    get section() { return this.stage.sections[this.secIdx]; }

    spawnEnemy(kind, i, n) {
      const fromLeft = n > 2 && i % 3 === 2;
      const x = fromLeft ? this.camX - 70 - i * 30 : this.camX + W + 70 + i * 45;
      const y = TT.FLOOR_TOP + 30 + ((i * 67) % (TT.FLOOR_BOTTOM - TT.FLOOR_TOP - 50));
      const C = { drone: TT.Drone, shock: TT.ShockTrooper, bee: TT.BeeSoldier, hazmat: TT.HazmatSoldier, goo: TT.GooBlob, jinx: TT.JinxEnemy, mammoth: TT.Mammoth, card: TT.CardSoldier, bunny: TT.MagicBunny, commando: TT.SladeCommando, demon: TT.FireDemon, freezer: TT.FreezeTrooper, rouge: TT.MadameRouge, tvbot: TT.TVBot, popcorn: TT.PopcornMonster, guard: TT.RoyalGuard, eye: TT.HypnoEye }[kind];
      const e = C ? new C(this, x, y) : new TT.Enemy(this, kind, x, y);
      if (kind === 'drone') e.z = 120;
      this.addEnemy(e);
      return e;
    }

    updateSections() {
      const sec = this.section;
      if (!sec) return;
      if (!this.secActive) {
        const trigger = sec.type === 'chase' ? sec.start : sec.camX;
        if (this.camX >= trigger - 0.5) {
          this.camX = trigger;
          this.secActive = true; this.waveIdx = 0; this.waveDelay = 20; this.goArrow = 0;
          if (sec.type === 'chase') this.startChase(sec);
          if (sec.type === 'boss') this.startBoss(sec);
        }
        return;
      }
      if (sec.type === 'arena') {
        if (this.waveDelay > 0) {
          if (--this.waveDelay === 0) {
            const wave = sec.waves[this.waveIdx];
            wave.forEach((k, i) => this.spawnEnemy(k, i, wave.length));
            this.tokens = this.baseTokens(this.waveIdx === 0 ? 2 : 3);
          }
          return;
        }
        if (this.enemies.length === 0) {
          this.waveIdx++;
          if (this.waveIdx < sec.waves.length) this.waveDelay = 50;
          else this.finishSection();
        }
      } else if (sec.type === 'chase') {
        this.updateChase(sec);
      }
    }

    finishSection() {
      this.secIdx++;
      this.secActive = false;
      this.goArrow = 1;
      // Titãs nocauteados voltam com um pouco de vida
      let revived = 0;
      for (const t of this.team) if (t.ko) { t.reset(); t.hp = Math.round(t.maxHp * 0.3); revived++; }
      // jogador que ficou sem Titã volta ao lado do parceiro
      for (const sl of this.activeSlots()) {
        const t = this.team[sl.ai];
        if (!sl.out) continue;
        const mate = this.players().find((m) => m !== t);
        const free = this.team.findIndex((u, i) => !u.ko && !this.activeSlots().some((o) => o !== sl && !o.out && o.ai === i));
        if (free >= 0) {
          sl.out = false; sl.ai = free; sl.koTimer = 0;
          const n = this.team[free], ref = mate || n;
          n.x = TT.clamp(ref.x - 60, this.camX + 40, this.camX + W - 40); n.y = ref.y; n.z = 0; n.invul = 90;
          this.poof(n.x, n.y - 60);
        }
      }
      const pp = this.players()[0] || this.player;
      if (revived) this.popText(pp.x, pp.y - 170, 'TITÃS RECUPERADOS!', '#9effa8');
    }

    startChase(sec) {
      this.drill = new TT.DrillMachine(this);
      this.chaseT = 0;
      this.banner = { text: 'CORRAM!', sub: 'A perfuratriz da H.I.V.E. está vindo!', t: 0, dur: 140 };
      A().play('alarm');
      this.tokens = this.baseTokens(3);
    }
    updateChase(sec) {
      this.chaseT++;
      const d = this.drill;
      if (d && !d.stopped) {
        if (this.chaseT % sec.every === 0 && this.enemies.length < 5) {
          const k = TT.choice(sec.pool);
          this.spawnEnemy(k, TT.randi(0, 1), 1);
        }
        if (this.camX >= sec.end) {
          d.stopped = true;
          this.shake = 26; this.whiteFlash = 10;
          for (let i = 0; i < 8; i++) this.explosion(d.x + TT.rand(-200, 180), TT.rand(TT.FLOOR_TOP, TT.FLOOR_BOTTOM), TT.rand(40, 300), 1.2);
          this.banner = { text: 'A PERFURATRIZ PAROU!', sub: 'Atravessem o túnel!', t: 0, dur: 120 };
        }
      } else if (d && d.stopped && d.crash > 50) {
        this.drill = null;
        // Inimigos remanescentes ainda precisam ser derrotados antes de seguir.
      }
      if (!this.drill && this.enemies.length === 0) this.finishSection();
    }

    startBoss(sec) {
      let b;
      if (sec.boss === 'cinderblock') {
        b = new TT.Cinderblock(this, this.camX + 900, 590);
        b.z = 520; b.vz = -2; b.facing = -1;
        this.introKind = 'fall';
      } else if (sec.boss === 'overload') {
        // surge de um raio no meio da arena
        b = new TT.Overload(this, this.camX + 880, 590);
        b.facing = -1; b.alpha = 0;
        this.introKind = 'zap';
      } else if (sec.boss === 'plasmus') {
        // sobe de uma poça de lodo no meio da arena
        b = new TT.Plasmus(this, this.camX + 880, 590);
        b.facing = -1; b.rise = 0;
        this.introKind = 'rise';
      } else if (sec.boss === 'blood') {
        // surge num redemoinho de energia psíquica vermelha
        b = new TT.BrotherBlood(this, this.camX + 880, 590);
        b.facing = -1; b.alpha = 0;
        this.introKind = 'psy';
      } else if (sec.boss === 'freak') {
        // aparece "sintonizando" no meio do chuvisco, como um canal de TV
        b = new TT.ControlFreak(this, this.camX + 880, 590);
        b.facing = -1; b.alpha = 0;
        this.introKind = 'tv';
      } else if (sec.boss === 'madmod') {
        // surge girando no meio de uma espiral hipnótica, como um disco na vitrola
        b = new TT.MadMod(this, this.camX + 880, 590);
        b.facing = -1; b.alpha = 0;
        this.introKind = 'spiral';
      } else if (sec.boss === 'mallah') {
        b = new TT.Mallah(this, this.camX + 880, 590);
        b.facing = -1;
      } else if (sec.boss === 'slade') {
        // sai das sombras: primeiro só o olho brilhando, depois o corpo inteiro
        b = new TT.Slade(this, this.camX + 880, 590);
        b.facing = -1; b.alpha = 0;
        this.introKind = 'shadow';
      } else if (sec.boss === 'mumbo') {
        // aparece com um "TA-DÁ!" numa nuvem de fumaça
        b = new TT.Mumbo(this, this.camX + 880, 590);
        b.facing = -1; b.alpha = 0;
        this.introKind = 'magic';
      } else {
        b = new TT.GizmoMech(this, this.camX + W + 200, 590);
        b.facing = -1;
        this.introKind = 'walk';
      }
      this.boss = b;
      this.addEnemy(b);
      this.bossIntro = 170;
      this.bossShown = 0;
      this.banner = { text: b.name, sub: sec.intro, t: 0, dur: 160, boss: true };
      A().playSong(this.stage.bossSong || 'boss');
      A().play('roar');
    }
    updateBossIntro() {
      const b = this.boss;
      if (!b || this.bossIntro <= 0) return;
      this.bossIntro--;
      if (this.introKind === 'walk' && b.x > this.camX + 930) { b.vx = -3; b.setAnim('walk'); }
      else if (this.introKind === 'walk') { b.vx = 0; b.setAnim('idle'); }
      if (this.introKind === 'fall' && b.z <= 0 && !b.landed) {
        b.landed = true;
        this.shake = 24; A().play('boom');
        this.debrisBurst(b.x, b.y - 40, 18, '#8e8880');
        this.dust(b.x, b.y, 14, '#c9b9a8');
        this.groundRing(b.x, b.y, '#ffe9a8');
      }
      if (this.introKind === 'zap') {
        const k = 170 - this.bossIntro;
        if (k < 60 && k % 12 === 0) { this.particles.spawn('glow', b.x, b.y - 120, { size: 120, color: '#6fe3ff', life: 10 }); A().play('zap'); }
        if (k === 60) { b.alpha = 1; this.impact(b.x, b.y, 'KRAKA-BOOM!', '#6fe3ff', 1.5); A().play('thunder'); }
        if (k > 60 && k === 90) this.say(b, 'ENERGIA... MAIS ENERGIA!', '#bff6ff');
      }
      if (this.introKind === 'rise') {
        const k = 170 - this.bossIntro;
        b.rise = TT.clamp((k - 20) / 70, 0, 1);
        if (k > 10 && k < 90 && k % 8 === 0) { b.splash(this, b.x, b.y, 4); A().play('land'); }
        if (k === 92) { this.impact(b.x, b.y, 'GROOOAAAR!', '#ff5ab4', 1.4); this.shake = 16; A().play('roar'); }
      }
      if (this.introKind === 'psy') {
        const k = 170 - this.bossIntro;
        b.alpha = TT.clamp((k - 20) / 50, 0, 1);
        if (k < 70 && k % 10 === 0) { this.particles.spawn('ring', b.x, b.y, { size: 60 + k * 2, color: '#ff3b4a', life: 18, flat: 0.4 }); A().play('dark'); }
        if (k === 70) { this.impact(b.x, b.y, 'H.I.V.E.!', '#ff3b4a', 1.2); }
        if (k === 95) this.say(b, 'Bem-vindos à H.I.V.E., Titãs.', '#ff8a9a');
      }
      if (this.introKind === 'magic') {
        const k = 170 - this.bossIntro;
        if (k < 60 && k % 6 === 0) { this.particles.spawn('star', b.x + TT.rand(-90, 90), b.y - TT.rand(20, 260), { vy: -1, color: TT.choice(['#7af0ff', '#ff7af0', '#ffe14a', '#ffffff']), size: 12, life: 22, vr: 0.2 }); A().play('birdarang'); }
        if (k === 60) { b.alpha = 1; this.poof(b.x, b.y - 120); this.poof(b.x, b.y - 40); this.impact(b.x, b.y, 'TA-DÁ!', '#ff7af0', 1.3); }
        if (k === 95) this.say(b, 'Que comece o espetáculo!', '#bff3ff');
      }
      if (this.introKind === 'shadow') {
        const k = 170 - this.bossIntro;
        b.alpha = TT.clamp((k - 50) / 40, 0, 1);
        if (k === 20) A().play('dark');
        if (k === 55) this.say(b, 'Olá, Titãs.', '#ffb070');
        if (k === 90) { this.impact(b.x, b.y, 'SLADE!', '#ff7a1a', 1.2); A().play('boom'); }
        if (k === 120) this.say(b, 'Golpes novos? Vamos ver se aprenderam alguma coisa.', '#ffb070');
      }
      if (this.introKind === 'spiral') {
        const k = 170 - this.bossIntro;
        b.alpha = TT.clamp((k - 15) / 55, 0, 1);
        b.facing = (k < 70 && (k >> 3) % 2) ? 1 : -1; // gira enquanto aparece
        if (k < 70 && k % 14 === 0) { this.particles.spawn('ring', b.x, b.y - 100, { size: 80 + k * 2, color: '#ff5ad0', life: 18 }); A().play('zap'); }
        if (k === 70) { b.facing = -1; this.impact(b.x, b.y, 'GROOVY!', '#ff5ad0', 1.3); this.tintScreen('#ff5ad0', 10); }
        if (k === 95) this.say(b, 'Bem-vindos à minha escola, meus patinhos!', '#ffc8f0');
      }
      if (this.introKind === 'tv') {
        const k = 170 - this.bossIntro;
        b.alpha = k < 60 ? ((k >> 2) % 3 === 0 ? 0.5 : 0.08) : 1; // sinal falhando até sintonizar
        if (k < 60 && k % 10 === 0) A().play('zap');
        if (k === 60) { this.impact(b.x, b.y, 'CLICK!', '#7bffea', 1.3); this.whiteFlash = 6; }
        if (k === 90) this.say(b, 'Interrompemos a programação para... a DERROTA dos Titãs!', '#bffff4');
      }
      if (this.bossIntro === 0) { b.active = true; b.cool = 40; b.alpha = 1; if (b.rise != null) b.rise = 1; }
    }

    onBossKilled(b) {
      this.slowmo = 90;
      this.whiteFlash = 12;
      this.shake = 20;
      this.score += b.def.score;
      this.popText(b.x, b.y - 260, 'DERROTADO!', '#ffe14a', true);
      // inimigos restantes fogem / explodem
      for (const e of this.enemies) if (e !== b && !e.dead) e.takeHit({ x: e.x - 1, dmgMul: 1 }, { dmg: 999, kb: 6, knockdown: true, launch: 8 });
      A().stopSong();
    }
    onBossRemoved() {
      this.boss = null;
      this.clearTimer = 80;
      for (const t of this.team) if (!t.ko) t.setAnim('victory');
      this.superBy = null;
    }

    // ------------------------------------------------------------------ Eventos de combate
    addEnemy(e) { this.enemies.push(e); }
    addProjectile(p) { this.projectiles.push(p); }
    addEffect(e) { this.effects.push(e); }
    addPickup(p) { this.pickups.push(p); }
    allFighters() { return this.enemies.concat(this.heroes()); }
    // Titãs em campo (não nocauteados) — alvos dos inimigos.
    heroes() { const out = []; for (const p of this.players()) if (!p.ko) out.push(p); return out; }
    // Titã mais próximo de um inimigo (ou um aleatório, se random).
    targetFor(f, random) {
      const hs = this.heroes();
      if (hs.length < 2) return hs[0] || null;
      if (random) return TT.choice(hs);
      let best = null, bd = 1e9;
      for (const h of hs) { const d = Math.abs(h.x - f.x) + Math.abs(h.y - f.y) * 2; if (d < bd) { bd = d; best = h; } }
      return best;
    }
    // Zonas de perigo ativas (avisos dos chefes, mísseis, pedras) — usadas pelo bot.
    dangerZones() {
      const out = [];
      for (const e of this.enemies) {
        const a = e.atk;
        if (a && a.zones && e.state === 'attack' && a.t < a.def.s + a.def.a) for (const z of a.zones) out.push(z);
      }
      for (const p of this.projectiles) if (p.zone && p.team === 'enemy') out.push(p.zone);
      for (const ef of this.effects) if (ef.zones) for (const z of ef.zones) out.push(z);
      return out;
    }

    meleeCheck(att, d, hits, a) {
      const hero = att.team === 'hero';
      const targets = hero ? this.enemies.concat(this.props) : this.heroes();
      const depth = d.depth || 30, zr = d.zr || 80;
      for (const t of targets) {
        if (!t || t.dead || t.ko || hits.has(t)) continue;
        if (d.zoneHit && a && a.zones) {
          // a hitbox é a própria marcação no chão
          if (!a.zones.some((z) => TT.zoneHas(z, t.x, t.y))) continue;
        } else {
          const dx = (t.x - att.x) * att.facing;
          if (dx < d.reach[0] - t.radius || dx > d.reach[1] + t.radius) continue;
          if (Math.abs(t.y - att.y) > depth) continue;
        }
        if (Math.abs(t.z - att.z) > zr) continue;
        hits.add(t);
        if (t.takeHit(att, d, att.facing)) {
          if (a) a.landed = true;
          this.onHit(att, t, d);
        }
      }
    }

    onHit(att, t, d) {
      const big = !!(d.big || d.knockdown || d.dmg >= 14);
      const heroAtk = att && att.team === 'hero';
      this.hitstop = Math.max(this.hitstop, big ? 5 : 3);
      this.shake = Math.max(this.shake, big ? 7 : 3);
      const hy = t.y - t.z - (t.height || 80) * 0.55;
      // faíscas na cor do Titã que acertou
      this.hitSpark(t.x, hy, big, heroAtk && att.def ? att.def.fx : null);
      A().play(big ? 'hitHeavy' : 'hit');
      if (t.isProp) return;
      if (d.shock && t.team === 'hero') {
        // choque elétrico: faíscas ciano e "ZZT!"
        for (let i = 0; i < 8; i++) this.particles.spawn('spark', t.x + TT.rand(-20, 20), hy + TT.rand(-30, 30), { vx: TT.rand(-6, 6), vy: TT.rand(-6, 6), color: TT.choice(['#6fe3ff', '#ffffff', '#ffe14a']), size: 3, life: 12 });
        this.particles.spawn('text', t.x, hy - 50, { text: 'ZZT!', size: 34, color: '#bff6ff', color2: '#2a7bff', vy: -0.6, life: 30, rot: TT.rand(-0.2, 0.2) });
      }
      if (d.hex && t.team === 'hero') {
        // raio de azar da Jinx: estrelinhas rosa e "AZAR!"
        for (let i = 0; i < 6; i++) this.particles.spawn('star', t.x + TT.rand(-24, 24), hy + TT.rand(-30, 20), { vx: TT.rand(-4, 4), vy: TT.rand(-5, -1), color: TT.choice(['#ff5fb4', '#ffb0dc', '#ffffff']), size: 8, life: 18, vr: 0.2 });
        this.particles.spawn('text', t.x, hy - 50, { text: 'AZAR!', size: 34, color: '#ffb0dc', color2: '#a0287a', vy: -0.6, life: 32, rot: TT.rand(-0.2, 0.2) });
      }
      if (d.pauseHero && t.team === 'hero' && t.state === 'hurt' && !t.ko) {
        // botão de pausa do Control Freak: o Titã fica parado como numa fita pausada
        t.frozen = d.pauseHero; t.frozenKind = 'pause'; t.hitstun = Math.max(t.hitstun, d.pauseHero); t.vx = 0;
        this.particles.spawn('text', t.x, hy - 60, { text: 'PAUSADO!', size: 30, color: '#ffe14a', color2: '#1c1a22', vy: -0.5, life: 40, rot: TT.rand(-0.1, 0.1) });
      }
      if (d.tvStatic && t.team === 'hero') {
        // raio de chuvisco do TV-Robô: riscos brancos e "CHUVISCO!"
        for (let i = 0; i < 8; i++) this.particles.spawn('spark', t.x + TT.rand(-24, 24), hy + TT.rand(-30, 30), { vx: TT.rand(-5, 5), vy: TT.rand(-4, 4), color: TT.choice(['#ffffff', '#c9d3e2', '#7bffea']), size: 3, life: 12 });
        this.particles.spawn('text', t.x, hy - 50, { text: 'CHUVISCO!', size: 30, color: '#e6fffb', color2: '#3a4a6a', vy: -0.6, life: 30, rot: TT.rand(-0.2, 0.2) });
      }
      if (d.invertHero && t.team === 'hero' && !t.ko) {
        // hipnose do Mad Mod: controles invertidos até passar (apertar ATAQUE acorda mais rápido)
        t.inverted = Math.max(t.inverted || 0, d.invertHero);
        this.particles.spawn('ring', t.x, hy, { size: 80, color: '#ff5ad0', life: 18 });
        this.particles.spawn('text', t.x, hy - 60, { text: 'HIPNOTIZADO!', size: 30, color: '#ffc8f0', color2: '#7a2bb5', vy: -0.5, life: 50, rot: TT.rand(-0.1, 0.1) });
      }
      if (d.ageHero && t.team === 'hero' && !t.ko) {
        // raio da juventude: o Titã vira velhinho (lento) e o Mad Mod rejuvenesce (recupera vida)
        t.aged = Math.max(t.aged || 0, d.ageHero);
        this.poof(t.x, t.y - 60);
        this.particles.spawn('text', t.x, hy - 60, { text: 'VIROU VELHINHO!', size: 30, color: '#fff0a8', color2: '#8a5a1a', vy: -0.5, life: 50, rot: TT.rand(-0.1, 0.1) });
        if (att && att.isBoss && !att.dead) { att.hp = Math.min(att.maxHp, att.hp + 90); this.popText(att.x, att.y - 260, 'REJUVENESCEU!', '#ffe14a'); }
      }
      if (d.dazzle && t.team === 'hero') {
        // flash do Olho Hipnótico: estrelinhas brancas e "OFUSCADO!"
        for (let i = 0; i < 6; i++) this.particles.spawn('star', t.x + TT.rand(-24, 24), hy + TT.rand(-30, 20), { vx: TT.rand(-4, 4), vy: TT.rand(-5, -1), color: '#ffffff', size: 8, life: 18, vr: 0.2 });
        this.particles.spawn('text', t.x, hy - 50, { text: 'OFUSCADO!', size: 30, color: '#ffffff', color2: '#3a4a6a', vy: -0.6, life: 30, rot: TT.rand(-0.2, 0.2) });
      }
      if (d.freezeHero && t.team === 'hero' && t.state === 'hurt' && !t.ko) {
        // raio congelante da Irmandade: o Titã fica preso num bloco de gelo
        t.frozen = d.freezeHero; t.frozenKind = null; t.hitstun = Math.max(t.hitstun, d.freezeHero); t.vx = 0;
        for (let i = 0; i < 8; i++) this.particles.spawn('star', t.x + TT.rand(-26, 26), hy + TT.rand(-40, 30), { vx: TT.rand(-3, 3), vy: TT.rand(-4, 0), color: TT.choice(['#e6fbff', '#9fe8ff', '#ffffff']), size: 8, life: 18, vr: 0.2 });
        this.particles.spawn('text', t.x, hy - 60, { text: 'CONGELADO!', size: 30, color: '#e6fbff', color2: '#2a7bff', vy: -0.5, life: 40, rot: TT.rand(-0.1, 0.1) });
      }
      if (d.fire && t.team === 'hero') {
        // fogo de Trigon (demônios e Slade): faíscas laranja e "QUEIMOU!"
        for (let i = 0; i < 8; i++) this.particles.spawn('spark', t.x + TT.rand(-20, 20), hy + TT.rand(-30, 30), { vx: TT.rand(-4, 4), vy: TT.rand(-7, -2), color: TT.choice(['#ff7a1a', '#ffd23a', '#ffffff']), size: 4, life: 16, grav: 0.1 });
        this.particles.spawn('text', t.x, hy - 50, { text: 'QUEIMOU!', size: 32, color: '#ffe14a', color2: '#c4300a', vy: -0.6, life: 32, rot: TT.rand(-0.2, 0.2) });
      }
      if (d.freeze && t.team === 'enemy' && !t.isBoss && !t.dead && t.state === 'hurt') {
        // disco congelante do Robin: o inimigo fica preso num bloco de gelo
        t.frozen = d.stun || 80; t.frozenKind = null;
        for (let i = 0; i < 8; i++) this.particles.spawn('star', t.x + TT.rand(-26, 26), hy + TT.rand(-40, 30), { vx: TT.rand(-3, 3), vy: TT.rand(-4, 0), color: TT.choice(['#e6fbff', '#9fe8ff', '#ffffff']), size: 8, life: 18, vr: 0.2 });
        this.particles.spawn('text', t.x, hy - 60, { text: 'CONGELADO!', size: 30, color: '#e6fbff', color2: '#2a7bff', vy: -0.5, life: 44, rot: TT.rand(-0.1, 0.1) });
      }
      if (d.bunny && t.team === 'hero' && !t.ko) {
        // feitiço do Mumbo: o Titã vira coelho por um tempo (só anda e pula)
        t.bunny = 150;
        this.poof(t.x, t.y - 50);
        this.particles.spawn('text', t.x, hy - 70, { text: 'VIROU COELHO!', size: 30, color: '#ffffff', color2: '#c04ab0', vy: -0.5, life: 50, rot: TT.rand(-0.1, 0.1) });
      }
      if (d.hypno && t.team === 'hero') {
        // hipnose do Irmão Sangue: Titã fica tonto por um tempo
        t.hypno = true;
        this.particles.spawn('ring', t.x, hy, { size: 70, color: '#ff7af0', life: 18 });
        this.particles.spawn('text', t.x, hy - 60, { text: 'HIPNOTIZADO!', size: 30, color: '#ffc0f6', color2: '#a01a6a', vy: -0.5, life: 50, rot: TT.rand(-0.1, 0.1) });
      }
      if (heroAtk) {
        this.energy = Math.min(100, this.energy + d.dmg * 0.4);
        this.combo++; this.comboT = 110;
        this.score += Math.round(d.dmg * 10 * (1 + Math.min(this.combo, 30) * 0.05));
        if (big && Math.random() < 0.55) {
          const words = att.key === 'cyborg' ? ['BOOYAH!', 'BAM!', 'POW!'] : ['POW!', 'BAM!', 'WHAM!', 'CRASH!', 'KAPOW!'];
          this.particles.spawn('text', t.x + TT.rand(-20, 20), hy - 40, { text: TT.choice(words), size: 40, color: '#ffe14a', color2: '#ff4a3a', vy: -0.6, life: 42, rot: TT.rand(-0.25, 0.25) });
        }
      } else if (t.team === 'hero') {
        this.combo = 0;
      }
    }

    onEnemyKilled(e) {
      this.score += (e.def && e.def.score) || 100;
      const r = Math.random(), pz = 0.12 * this.diff.pizza;
      if (r < pz) this.addPickup(new TT.Pickup(this, e.x, e.y, 'pizza'));
      else if (r < pz + 0.08) this.addPickup(new TT.Pickup(this, e.x, e.y, 'energy'));
    }

    onTitanKO(t) {
      this.popText(t.x, t.y - 170, t.name.toUpperCase() + ' CAIU!', '#ff6a6a', true);
      const sl = this.slotOf(t);
      if (sl) sl.koTimer = 60;
    }

    // Titã i está sendo usado por outro jogador?
    takenBy(i, sl) { return this.activeSlots().some((o) => o !== sl && !o.out && o.ai === i); }

    switchTo(i, forced, s) {
      const sl = this.slots[s || 0];
      if (i === sl.ai || i < 0 || i > 4) return false;
      const n = this.team[i];
      if (n.ko || this.takenBy(i, sl)) return false;
      const p = this.team[sl.ai];
      // troca em combo: com 3 ou mais golpes seguidos, dá para trocar no meio de um ataque
      const tag = !forced && this.combo >= 3 && p.state === 'attack' && !p.ko;
      if (!forced) {
        if (sl.switchCool > 0 || sl.out) return false;
        if (!(p.state === 'idle' || p.state === 'air' || tag)) return false;
      }
      n.x = p.x; n.y = p.y; n.z = forced ? 0 : p.z; n.facing = p.facing;
      n.vx = 0; n.vy = 0; n.vz = forced ? 0 : p.vz;
      n.atk = null;
      n.setState(n.z > 0 ? 'air' : 'idle'); n.setAnim(n.z > 0 ? 'jump' : 'idle');
      n.invul = forced ? 90 : 16;
      sl.ai = i; sl.out = false;
      sl.switchCool = 18;
      this.poof(n.x, n.y - 60);
      A().play('switch');
      if (tag) {
        // quem sai fica; quem entra vira para o inimigo mais perto e já entra com a investida
        p.atk = null; p.setState('idle'); p.setAnim('idle');
        let near = null, bd = 1e9;
        for (const e of this.enemies) { if (e.dead) continue; const d = Math.abs(e.x - n.x) + Math.abs(e.y - n.y) * 2; if (d < bd) { bd = d; near = e; } }
        if (near) { n.facing = near.x > n.x ? 1 : -1; n.y += TT.clamp(near.y - n.y, -30, 30); }
        if (n.z <= 0) { n.vy = 0; n.startAttack(n.def.dashAtk); }
        this.tagSwitches = (this.tagSwitches || 0) + 1;
        this.comboT = 110;
        this.afterimage(p, p.def.fx || p.def.color);
        this.particles.spawn('text', n.x, n.y - 200, { text: 'TROCA EM COMBO!', size: 32, color: '#ffe14a', color2: n.def.color, vy: -0.6, life: 46 });
      }
      return true;
    }
    // Próximo/anterior: pula os caídos e o Titã em uso pelo outro jogador.
    cycleTitan(dir, s) {
      const sl = this.slots[s || 0];
      for (let k = 1; k < 5; k++) {
        const i = (sl.ai + dir * k + 5) % 5;
        if (!this.team[i].ko && !this.takenBy(i, sl)) return this.switchTo(i, false, s);
      }
      return false;
    }

    triggerSuper(s) {
      if (this.energy < 100 || this.superT > 0) return;
      this.energy = 0;
      this.superBy = this.slotTitan(s || 0);
      this.cut = new TT.SuperCutscene(this, this.superBy);
      A().play('super');
      this.say(this.superBy, 'Titãs, AVANTE!', '#ffe14a');
    }
    resolveSuper() {
      this.whiteFlash = 14; this.shake = 26;
      A().play('boom');
      for (const e of this.enemies) {
        if (e.dead) continue;
        const sx = e.x - this.camX;
        if (sx < -200 || sx > W + 200) continue;
        const d = { dmg: e.isBoss ? 120 : 60, kb: 10, knockdown: true, launch: 12, big: true };
        const by = this.superBy || this.player;
        if (e.takeHit(by, d, TT.sign(e.x - by.x))) this.onHit(by, e, d);
        this.explosion(e.x, e.y, 60, 0.7);
      }
    }

    // ------------------------------------------------------------------ Efeitos visuais
    // Imagem residual do Titã (combos da fase 8). Em forma de animal fica só um brilho.
    afterimage(f, col, flip) {
      if (f.atk && (f.atk.def.form || f.atk.def.formAt)) { this.particles.spawn('glow', f.x, f.y - f.z - 70, { color: col, size: 90, life: 10 }); return; }
      this.addEffect(new TT.Afterimage(this, f, col, flip));
    }
    // Tela inteira tingida por um instante (Supernova, rugido...).
    tintScreen(col, dur) { this.tint = { col, t: dur, dur }; }
    hitSpark(x, y, big, color) {
      const n = big ? 12 : 7;
      const cols = color ? [color, '#ffffff', color, '#fff6b0'] : ['#fff6b0', '#ffd23a', '#ffffff'];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = TT.rand(4, big ? 14 : 9);
        this.particles.spawn('spark', x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, color: TT.choice(cols), size: big ? 5 : 4, life: TT.randi(8, 14) });
      }
      this.particles.spawn('star', x, y, { size: big ? 36 : 22, color: '#fffbe0', life: 7, rot: Math.random() });
      if (color && big) this.particles.spawn('ring', x, y, { size: 46, color, life: 10 });
      this.particles.spawn('glow', x, y, { size: big ? 76 : 46, color: color || '#ffd36a', life: 9 });
    }
    dust(x, y, n, color) {
      for (let i = 0; i < n; i++) this.particles.spawn('dust', x + TT.rand(-20, 20), y - TT.rand(0, 8), { vx: TT.rand(-3, 3), vy: TT.rand(-1.5, 0), color: color || '#d9cbbb', size: TT.rand(6, 12), life: TT.randi(18, 30) });
    }
    poof(x, y) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        this.particles.spawn('dust', x + Math.cos(a) * 18, y + Math.sin(a) * 26, { vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, color: 'rgba(240,240,255,0.9)', size: 14, life: 20 });
      }
    }
    // Transformação do Mutano: nuvem verde cartoon com brilho e estrelinhas (out = voltando ao normal).
    morph(x, y, out) {
      const greens = ['#8fe86a', '#6fd64e', '#b7f59a', '#9dff7a'];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + TT.rand(-0.2, 0.2), r = TT.rand(26, 40);
        this.particles.spawn('cloud', x + Math.cos(a) * r, y + Math.sin(a) * r * 1.3, { vx: Math.cos(a) * TT.rand(3, 5), vy: Math.sin(a) * TT.rand(2.5, 4.5) - 0.6, color: TT.choice(greens), color2: '#2b6418', size: TT.rand(11, 17), life: TT.randi(12, 17) });
      }
      this.particles.spawn('glow', x, y, { size: out ? 110 : 160, color: '#5dff8a', life: 14 });
      this.particles.spawn('ring', x, y, { size: 90, color: '#c8ffb0', life: 12 });
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, sp = TT.rand(3, 7);
        this.particles.spawn('star', x + Math.cos(a) * 20, y + Math.sin(a) * 20, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: TT.rand(7, 11), color: '#eaffd0', life: TT.randi(14, 22), vr: 0.2 });
      }
      A().play('switch');
    }
    groundRing(x, y, color) {
      this.particles.spawn('ring', x, y, { size: 120, color, life: 18, flat: 0.35 });
      this.dust(x, y, 10, '#c9b9a8');
    }
    debrisBurst(x, y, n, color) {
      for (let i = 0; i < n; i++) this.particles.spawn('debris', x + TT.rand(-20, 20), y + TT.rand(-20, 20), { vx: TT.rand(-7, 7), vy: TT.rand(-11, -3), grav: 0.55, color, size: TT.rand(6, 13), vr: TT.rand(-0.3, 0.3), life: TT.randi(30, 50), floor: y + 60 });
    }
    // col = cor da explosão (padrão laranja; starbolt verde, telecinese violeta...).
    explosion(x, y, z, sc, col) {
      sc = sc || 1;
      const sy = y - z;
      this.particles.spawn('glow', x, sy, { size: 150 * sc, color: col || '#ff9a3a', life: 16 });
      this.particles.spawn('ring', x, sy, { size: 90 * sc, color: '#ffe9a8', life: 14 });
      for (let i = 0; i < 14 * sc; i++) {
        const a = Math.random() * Math.PI * 2, s = TT.rand(3, 10) * sc;
        this.particles.spawn('spark', x, sy, { vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, color: TT.choice(col ? [col, '#ffffff', '#fff6b0'] : ['#ffcf5a', '#ff7a2a', '#fff']), size: 5, life: TT.randi(12, 22), grav: 0.2 });
      }
      for (let i = 0; i < 6 * sc; i++) this.particles.spawn('dust', x + TT.rand(-30, 30), sy + TT.rand(-30, 30), { vx: TT.rand(-2, 2), vy: TT.rand(-3, -0.5), color: 'rgba(80,60,70,0.8)', size: TT.rand(14, 24) * sc, life: TT.randi(26, 40) });
      this.shake = Math.max(this.shake, 9 * sc);
      A().play('boom');
    }
    blast(x, y, radius, dmg, team, owner, col) {
      this.explosion(x, y, 10, radius / 90, col);
      const targets = team === 'hero' ? this.enemies : this.heroes();
      for (const t of targets) {
        if (!t || t.dead || t.ko) continue;
        const dx = (t.x - x) / radius, dy = (t.y - y) / (radius * 0.42);
        if (dx * dx + dy * dy > 1 || t.z > 70) continue;
        const d = { dmg, kb: 7, knockdown: true, launch: 7, big: true };
        if (t.takeHit(owner || { x, dmgMul: 1 }, d, TT.sign(t.x - x))) this.onHit(owner, t, d);
      }
    }
    // Impacto forte de golpe de chefe: clarão, tremor, partículas e onomatopeia.
    impact(x, y, word, color, power) {
      power = power || 1;
      color = color || '#ff7a2a';
      this.whiteFlash = Math.max(this.whiteFlash, Math.round(2 + 3 * power));
      this.shake = Math.max(this.shake, 8 + 10 * power);
      this.particles.spawn('ring', x, y, { size: 150 * power, color: '#fff3c0', life: 16, flat: 0.38 });
      this.particles.spawn('glow', x, y - 50, { size: 170 * power, color, life: 12 });
      const n = Math.round(12 * power);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = TT.rand(5, 13) * power;
        this.particles.spawn('spark', x, y - 40, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 3, color: TT.choice(['#fff6b0', color, '#ffffff']), size: 5, life: TT.randi(10, 18), grav: 0.25 });
      }
      this.dust(x, y, Math.round(8 * power), '#c9b9a8');
      if (word) this.particles.spawn('text', x + TT.rand(-20, 20), y - 130, { text: word, size: Math.round(40 + 14 * Math.min(power, 1.4)), color: '#ffe14a', color2: color, vy: -0.5, life: 48, rot: TT.rand(-0.2, 0.2) });
    }
    popText(x, y, text, color, big) {
      this.particles.spawn('text', x, y, { text, size: big ? 38 : 26, color, vy: -0.8, life: 70 });
    }
    say(f, text, color) {
      if (f && TT.VOICED.includes(f.key)) A().voice(f.key, text); // por enquanto só a Ravena fala
      this.bubbles = this.bubbles.filter((b) => b.f !== f);
      this.bubbles.push({ f, text, color: color || '#ffffff', t: 0, dur: 85 });
    }

    // ------------------------------------------------------------------ Atualização
    step() {
      const inp = this.input;
      if (this.bots) { for (const b of this.bots) if (b) b.update(); } else if (this.bot) this.bot.update();
      inp.sample();
      this.frame++; this.stateT++;
      if (inp.wasPressed('mute')) A().toggleMute();
      if (inp.anyKey) { A().init(); inp.anyKey = false; }
      switch (this.state) {
        case 'title': this.updateTitle(inp); break;
        case 'roster': this.updateRoster(inp); break;
        case 'play': this.updatePlay(inp); break;
        case 'pause': this.updatePause(inp); break;
        case 'gameover':
          this.particles.update();
          if (this.stateT > 60 && inp.wasPressed('pause')) this.goTitle(); // Esc / II: menu inicial (antes do 'menu', que o Esc também manda)
          else if (this.stateT > 60 && inp.wasPressed('menu')) { this.score = this.stageStartScore; this.startStage(this.stageIdx); }
          break;
        case 'clear':
          this.updateCelebration();
          if (this.stateT > 70 && inp.wasPressed('menu')) {
            if (this.stageIdx + 1 < TT.STAGES.length) this.startStage(this.stageIdx + 1);
            else { this.state = 'victory'; this.stateT = 0; this.particles.clear(); A().playSong('victory'); }
          }
          break;
        case 'victory':
          this.updateCelebration();
          if (this.stateT > 120 && inp.wasPressed('menu')) this.goTitle();
          break;
        default: break;
      }
      inp.endStep();
      if (this.online) this.online.hostTick();
    }

    // Itens do menu do título.
    titleItems() {
      const it = this.touch ? ['play', 'online', 'stage', 'players', 'diff', 'chars', 'touch', 'controls'] : ['play', 'online', 'stage', 'players', 'diff', 'chars', 'controls'];
      if (!this.online) it.splice(1, 1);
      if (this.installPrompt) it.push('install'); // navegador ofereceu instalar o app
      return it;
    }
    // Itens do menu de pausa.
    pauseItems() { return this.touch ? ['resume', 'diff', 'touch', 'quit'] : ['resume', 'diff', 'quit']; }

    // Abre a janela de instalação do navegador (o item só aparece quando o navegador oferece).
    installApp() {
      const p = this.installPrompt;
      if (!p) return;
      A().play('select');
      p.prompt();
      p.userChoice.then((r) => { if (r && r.outcome === 'accepted') { this.installPrompt = null; this.menuIdx = 0; } }).catch(() => {});
    }

    // Volta para a tela de título (a fase em andamento é abandonada).
    goTitle() {
      this.state = 'title'; this.stateT = 0; this.score = 0; this.menuIdx = 0; this.showControls = false; this.quitArm = false;
      this.particles.clear();
      A().playSong('theme');
    }
    // Fase inicial escolhida no título (para testar qualquer fase direto).
    cycleStage(d) { const n = TT.STAGES.length; this.stageSel = ((this.stageSel || 0) + d + n) % n; A().play('select'); }

    updateTitle(inp) {
      for (const t of this.titleTitans) t.animT++;
      if (this.online && this.online.panelOpen) return; // janela do JOGAR ONLINE aberta
      if (!this.titleSong) { A().playSong('theme'); this.titleSong = true; }
      const ok = inp.wasPressed('menu') || inp.wasPressed('jump') || inp.wasPressed('light');
      if (this.showControls) {
        if (inp.wasPressed('heavy') || inp.wasPressed('special') || ok || inp.wasPressed('pause')) this.showControls = false;
        return;
      }
      if (inp.wasPressed('heavy') || inp.wasPressed('special')) { this.showControls = true; return; }
      const items = this.titleItems(), n = items.length;
      if (inp.wasPressed('up')) { this.menuIdx = (this.menuIdx + n - 1) % n; A().play('select'); }
      if (inp.wasPressed('down')) { this.menuIdx = (this.menuIdx + 1) % n; A().play('select'); }
      const it = items[this.menuIdx] || 'play';
      const lr = (inp.wasPressed('right') ? 1 : 0) - (inp.wasPressed('left') ? 1 : 0);
      if (lr && it === 'diff') this.cycleDifficulty(lr);
      if (lr && it === 'stage') this.cycleStage(lr);
      if (lr && it === 'players' && !this.onlineLock) { this.setPlayers(this.numPlayers === 1 ? 2 : 1); A().play('select'); }
      if (lr && it === 'touch') { this.touch.cycle(lr); A().play('select'); }
      if (this.stateT > 20 && ok) {
        A().init();
        if (it === 'diff') { this.cycleDifficulty(1); return; }
        if (it === 'stage') { this.cycleStage(1); return; }
        if (it === 'players') { if (!this.onlineLock) { this.setPlayers(this.numPlayers === 1 ? 2 : 1); A().play('select'); } return; }
        if (it === 'online') { A().play('select'); this.online.openPanel(); return; }
        if (it === 'touch') { this.touch.cycle(1); A().play('select'); return; }
        if (it === 'controls') { this.showControls = true; A().play('select'); return; }
        if (it === 'chars') { this.openRoster(); return; }
        if (it === 'install') { this.installApp(); return; }
        A().play('select');
        this.score = 0;
        this.startStage(this.stageSel || 0);
      }
    }

    updateCelebration() {
      for (const t of this.team) { t.animT++; }
      this.particles.update();
    }

    // Menu de pausa: continuar / dificuldade / botões na tela.
    updatePause(inp) {
      if (inp.wasPressed('pause')) { this.state = 'play'; this.quitArm = false; return; }
      const items = this.pauseItems(), n = items.length, it = items[this.pauseIdx] || 'resume';
      if (inp.wasPressed('up')) { this.pauseIdx = (this.pauseIdx + n - 1) % n; this.quitArm = false; A().play('select'); }
      if (inp.wasPressed('down')) { this.pauseIdx = (this.pauseIdx + 1) % n; this.quitArm = false; A().play('select'); }
      const lr = (inp.wasPressed('right') ? 1 : 0) - (inp.wasPressed('left') ? 1 : 0);
      if (lr && it === 'diff') this.cycleDifficulty(lr);
      if (lr && it === 'touch') { this.touch.cycle(lr); A().play('select'); }
      if (inp.wasPressed('menu') || inp.wasPressed('light')) {
        if (it === 'resume') this.state = 'play';
        else if (it === 'diff') this.cycleDifficulty(1);
        else if (it === 'quit') {
          // pede confirmação: o progresso da fase é perdido
          if (this.quitArm) this.goTitle(); else { this.quitArm = true; A().play('select'); }
        } else { this.touch.cycle(1); A().play('select'); }
      }
    }

    updatePlay(inp) {
      if (inp.wasPressed('pause')) { this.state = 'pause'; this.pauseIdx = 0; return; }
      if (this.banner) { this.banner.t++; if (this.banner.t > this.banner.dur) this.banner = null; }
      else if (this.powerBanner) {
        // fase 7: anuncia os golpes novos logo depois do título da fase
        this.powerBanner = 0;
        this.banner = this.stage.combos
          ? { text: 'COMBOS NOVOS!', sub: 'Ataque 5 vezes para o combo completo — ou ATAQUE, ATAQUE, FORTE para o COMBO FINAL!', t: 0, dur: 200, power: true }
          : { text: 'GOLPES NOVOS!', sub: 'Os Titãs liberaram os poderes máximos: mais dano!', t: 0, dur: 170, power: true };
        for (const p of this.players()) { this.particles.spawn('ring', p.x, p.y - 60, { color: p.def.color, size: 120, life: 22 }); this.popText(p.x, p.y - 170, 'PODER MÁXIMO!', '#ffe14a', true); }
        A().play('super');
      }
      if (this.whiteFlash > 0) this.whiteFlash--;
      if (this.flashEnergy > 0) this.flashEnergy--;
      if (this.tint && --this.tint.t <= 0) this.tint = null;
      if (this.comboTag && ++this.comboTag.t > 90) this.comboTag = null;
      this.shake *= 0.86; if (this.shake < 0.3) this.shake = 0;

      const slots = this.activeSlots();
      for (const sl of slots) {
        const pi = inp.pl[sl.id];
        if (!sl.out) this.team[sl.ai].readInput(pi);
        // Troca de Titã e "Titãs, avante!" são lidos antes dos congelamentos (hit-stop) para não perder o botão
        if (this.superT === 0) {
          for (let i = 0; i < 5; i++) if (pi.wasPressed('t' + i)) this.switchTo(i, false, sl.id);
          if (pi.wasPressed('next')) this.cycleTitan(1, sl.id);
          if (pi.wasPressed('prev')) this.cycleTitan(-1, sl.id);
          if (pi.wasPressed('super') && !sl.out) this.triggerSuper(sl.id);
        }
      }
      // Cutscene do "Titãs, avante!": mundo congelado (o dano sai no fim da cena)
      if (this.cut) {
        this.cut.update(inp);
        if (this.cut.done) this.cut = null;
        this.particles.update();
        return;
      }
      if (this.hitstop > 0) { this.hitstop--; this.particles.update(); return; }
      if (this.slowmo > 0) { this.slowmo--; if (this.slowmo % 2 === 1) { this.particles.update(); return; } }

      const ps = this.players();
      // Titãs fora de campo recuperam vida devagar
      const rg = 0.05 * this.diff.regen;
      for (const t of this.team) if (!ps.includes(t) && !t.ko && t.hp < t.maxHp) t.hp = Math.min(t.maxHp, t.hp + rg);

      const b = this.boss;
      for (const sl of slots) {
        if (sl.switchCool > 0) sl.switchCool--;
        if (sl.out) continue;
        const p = this.team[sl.ai];
        p.think(inp.pl[sl.id]);
        p.physics();
        // corpos grandes (chefes) empurram o jogador para não ficarem sobrepostos (não quando o chefe está no ar, como no salto do Slade)
        if (b && !b.dead && p.z < 40 && b.z < 40 && !p.ko && Math.abs(p.y - b.y) < 34) {
          const dx = p.x - b.x, min = (b.radius + p.radius) * 0.75;
          if (Math.abs(dx) < min) p.x = b.x + (dx >= 0 ? min : -min);
        }
        // limites da câmera: ninguém sai da tela
        p.x = TT.clamp(p.x, this.camX + 30, this.camX + W - 30);
      }

      this.updateBossIntro();
      for (const e of this.enemies) { e.think(); e.physics(); }
      for (const pr of this.projectiles) pr.update();
      for (const ef of this.effects) ef.update();
      for (const pk of this.pickups) pk.update();
      for (const c of this.props) c.update();
      if (this.drill) this.drill.update();
      this.particles.update();
      for (const b of this.bubbles) b.t++;

      // limpeza (filtro in-place, sem alocar)
      compact(this.enemies); compact(this.projectiles); compact(this.effects); compact(this.pickups); compact(this.props);
      if (this.bubbles.length) this.bubbles = this.bubbles.filter((b) => b.t < b.dur && !b.f.remove);
      if (this.comboT > 0 && --this.comboT === 0) this.combo = 0;

      this.watchdog();
      this.updateCamera();
      this.updateSections();
      if (this.goArrow > 0) this.goArrow++;
      if (this.boss) this.bossShown = Math.min(1, this.bossShown + 0.02);

      // Nocaute: troca automática; fim de jogo só quando TODOS os Titãs caírem
      for (const sl of slots) {
        const p = this.team[sl.ai];
        if (sl.out || !p.ko || sl.koTimer <= 0 || --sl.koTimer > 0) continue;
        const next = this.team.findIndex((t, i) => !t.ko && !this.takenBy(i, sl));
        if (next >= 0) this.switchTo(next, true, sl.id);
        else if (this.team.some((t) => !t.ko)) { sl.out = true; this.popText(p.x, p.y - 200, 'P' + (sl.id + 1) + ' VOLTA NA PRÓXIMA ÁREA', '#ffe14a'); }
      }
      if (this.team.every((t) => t.ko) && slots.every((sl) => sl.out || sl.koTimer <= 0)) {
        this.state = 'gameover'; this.stateT = 0; A().stopSong(); A().play('ko');
      }
      if (this.clearTimer > 0 && --this.clearTimer === 0) {
        this.state = 'clear'; this.stateT = 0;
        A().playSong('victory');
        // zerou a fase: libera os personagens dela (menu PERSONAGENS)
        this.newUnlocks = TT.Unlocks.markCleared(this.stage.id);
      }
    }

    // Rede de segurança: nada pode travar o progresso da fase.
    watchdog() {
      if (this.frame % 30 !== 0) return;
      for (const e of this.enemies) {
        if (e.dead) {
          e.deadT = (e.deadT || 0) + 30;
          if (e.deadT > 300) e.remove = true; // morto que nunca "caiu"
          continue;
        }
        if (e.isBoss && !e.active) continue;
        // inimigo perdido longe da tela volta para a borda mais próxima
        const L = this.camX - 350, R = this.camX + W + 350;
        if (e.x < L || e.x > R) { e.x = e.x < L ? this.camX - 40 : this.camX + W + 40; e.entering = true; }
        // inimigo preso fora da tela por muito tempo é empurrado para dentro
        const on = e.x > this.camX && e.x < this.camX + W;
        e.offT = on ? 0 : (e.offT || 0) + 30;
        if (e.offT > 600) { e.x = e.x < this.camX ? this.camX + 60 : this.camX + W - 60; e.offT = 0; }
      }
    }

    updateCamera() {
      const sec = this.section;
      let maxCam = this.stage.length - W;
      let locked = false;
      if (sec) {
        if (sec.type === 'chase') {
          if (this.secActive) {
            maxCam = sec.end;
            // durante a perseguição a câmera anda no ritmo da perfuratriz
            if (this.drill && !this.drill.stopped) { this.camX = Math.min(sec.end, this.camX + sec.speed); this.camMin = this.camX; locked = true; }
          } else maxCam = sec.start;
        } else {
          maxCam = sec.camX;
          locked = this.secActive;
        }
      }
      if (!locked) {
        // 1 jogador: segue o Titã; 2 jogadores: segue o meio dos dois sem deixar o de trás sair da tela
        const ps = this.players().filter((t) => !t.ko);
        const list = ps.length ? ps : [this.player];
        let mn = 1e9, mx = -1e9;
        for (const t of list) { mn = Math.min(mn, t.x); mx = Math.max(mx, t.x); }
        let target = list.length > 1 ? (mn + mx) / 2 - W * 0.5 : list[0].x - W * 0.42;
        if (list.length > 1) target = Math.min(target, mn - 60);
        if (target > this.camX) this.camX += (target - this.camX) * 0.12;
        this.camX = TT.clamp(this.camX, this.camMin, maxCam);
        this.camMin = this.camX; // não volta para trás
      }
    }

    // ------------------------------------------------------------------ Render
    applyScale() {
      if (this.bg) for (const l of this.bg.layers) l.setScale(this.scale);
      if (this.bg && this.bg.fg) this.bg.fg.setScale(this.scale);
      for (const l of this.titleBg.layers) l.setScale(this.scale);
    }

    resize() {
      const ww = window.innerWidth, wh = window.innerHeight;
      const cssW = Math.min(ww, wh * 16 / 9), cssH = cssW * 9 / 16;
      const dpr = window.devicePixelRatio || 1;
      // transmitindo para o amigo (online): resolução interna limitada, para sobrar processador para o vídeo
      const s = TT.clamp(Math.round((cssW * dpr / W) * 4) / 4, 0.5, this.renderCap || 2);
      this.canvas.style.width = cssW + 'px';
      this.canvas.style.height = cssH + 'px';
      if (s !== this.scale || this.canvas.width !== Math.round(W * s)) {
        this.scale = s;
        this.canvas.width = Math.round(W * s);
        this.canvas.height = Math.round(H * s);
        this.applyScale();
      }
    }

    render() {
      const t0 = performance.now();
      const ctx = this.ctx;
      // estado limpo a cada quadro: um desenho que falhe no meio não "vaza" mistura/transparência
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      TT.renderScale = this.scale;
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      ctx.imageSmoothingEnabled = true;
      switch (this.state) {
        case 'title': this.drawTitle(ctx); break;
        case 'roster': this.drawRoster(ctx); break;
        case 'play': case 'pause': case 'gameover':
          this.drawWorld(ctx);
          this.drawHUD(ctx);
          if (this.comboTag) this.drawComboTag(ctx);
          if (this.cut) this.cut.draw(ctx);
          if (this.state === 'pause') this.drawPause(ctx);
          if (this.state === 'gameover') this.drawGameOver(ctx);
          break;
        case 'clear': this.drawWorld(ctx); this.drawClear(ctx); break;
        case 'victory': this.drawVictory(ctx); break;
        default: break;
      }
      const ms = performance.now() - t0;
      this.stats.frames++;
      this.stats.renderMs += ms;
      if (this.stats.frames > 30) this.stats.maxRenderMs = Math.max(this.stats.maxRenderMs, ms);
    }

    drawWorld(ctx) {
      const shx = this.shake ? TT.rand(-this.shake, this.shake) : 0, shy = this.shake ? TT.rand(-this.shake, this.shake) * 0.6 : 0;
      ctx.save();
      ctx.translate(shx, shy);
      const camX = this.camX;
      for (const l of this.bg.layers) l.draw(ctx, camX);
      this.drawAmbient(ctx, camX);

      // sombras e marcações no chão (avisos de ataque dos chefes)
      for (const e of this.effects) if (e.drawGround) e.drawGround(ctx, camX);
      for (const e of this.enemies) if (e.drawGround) e.drawGround(ctx, camX);
      for (const p of this.projectiles) if (p.drawGround) p.drawGround(ctx, camX);
      const D = this.drawables; D.length = 0;
      if (this.state !== 'clear') for (const p of this.players()) D.push(p); // na tela de vitória a equipe é desenhada à parte
      for (const e of this.enemies) D.push(e);
      for (const c of this.props) D.push(c);
      for (const k of this.pickups) D.push(k);
      for (const s of D) s.drawShadow(ctx, camX);
      for (const pr of this.projectiles) D.push(pr);
      for (const ef of this.effects) if (ef.draw) D.push(ef);
      if (this.drill) D.push(this.drill);
      D.sort((a, b) => a.y - b.y);
      for (const d of D) d.draw(ctx, camX);

      this.particles.draw(ctx, camX);
      this.drawBubbles(ctx, camX);
      if (this.bg.fg) this.bg.fg.draw(ctx, camX);
      ctx.restore();

      ctx.drawImage(TT.vignette(), 0, 0, W, H);
      if (this.tint) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * this.tint.t / this.tint.dur; ctx.fillStyle = this.tint.col; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      if (this.whiteFlash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (this.whiteFlash / 14) + ')'; ctx.fillRect(0, 0, W, H); }
    }

    drawAmbient(ctx, camX) {
      const f = this.frame;
      if (this.stage.id === 10) {
        // luzes de discoteca varrendo o chão e, na sala de aula, a tela pulsando em rosa e azul
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const x = W / 2 + Math.sin(f * 0.013 + i * 2.1) * 520, col = ['#ff5ad0', '#5fc8ff', '#ffe14a'][i];
          TT.drawGlow(ctx, col, x, TT.FLOOR_TOP + 120 + i * 40, 150, 0.13);
        }
        if (camX > 5600) { ctx.globalAlpha = 0.05 + 0.04 * Math.sin(f * 0.06); ctx.fillStyle = (f >> 5) % 2 ? '#ff5ad0' : '#5fc8ff'; ctx.fillRect(0, 0, W, H); }
        ctx.restore();
      } else if (this.stage.id === 1) {
        // brilhos no mar (só visíveis na parte externa)
        if (camX < 2700) {
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 16; i++) {
            const x = ((i * 157 + f * 0.3) % (W + 100)) - 50, y = 360 + ((i * 53) % 90);
            const a = 0.25 + 0.25 * Math.sin(f * 0.05 + i);
            ctx.fillStyle = 'rgba(255,230,200,' + a + ')';
            ctx.fillRect(x, y, 10 + (i % 3) * 6, 2);
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      } else if (this.stage.id === 3) {
        // faíscas elétricas nos painéis e bobinas + piscar de luz ciano
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          if (((f + i * 37) % 90) > 8) continue;
          const wx = Math.floor((camX + 100) / 560) * 560 + i * 280 + 120, sx = wx - camX, sy = 360 + (i % 3) * 30;
          if (sx < -50 || sx > W + 50) continue;
          TT.drawArc(ctx, sx, sy, sx + TT.rand(-60, 60), sy + TT.rand(-40, 40), '#6fe3ff', 2);
          TT.drawGlow(ctx, '#6fe3ff', sx, sy, 40, 0.6);
        }
        if (camX > 5600) for (let i = 0; i < 4; i++) { // arcos entre as bobinas do núcleo
          if (((f + i * 23) % 50) > 6) continue;
          const cx = Math.floor((camX + i * 400) / 400) * 400 + 200 - camX;
          TT.drawArc(ctx, cx, 220, cx + TT.rand(-120, 120), 220 + TT.rand(-80, 40), '#bff6ff', 2.5, 8);
        }
        ctx.globalCompositeOperation = 'source-over';
        const fl = (f % 240) < 4 ? 0.06 : 0;
        if (fl) { ctx.fillStyle = 'rgba(120,230,255,' + fl + ')'; ctx.fillRect(0, 0, W, H); }
      } else if (this.stage.id === 6) {
        // purpurina mágica caindo (dentro da cartola fica colorida e mais densa)
        ctx.globalCompositeOperation = 'lighter';
        const inHat = camX > 5500, n = inHat ? 26 : 10, cols = ['255,240,160', '160,240,255', '255,160,240'];
        for (let i = 0; i < n; i++) {
          const x = ((i * 197 - camX * 0.4 + Math.sin(f * 0.02 + i) * 20) % W + W) % W, y = (f * (0.5 + (i % 4) * 0.2) + i * 83) % 700;
          ctx.fillStyle = 'rgba(' + (inHat ? cols[i % 3] : cols[0]) + ',' + (0.35 + 0.3 * Math.sin(f * 0.1 + i)) + ')';
          ctx.fillRect(x, y, 3, 3);
        }
        ctx.globalCompositeOperation = 'source-over';
      } else if (this.stage.id === 9) {
        // sinal de TV fraco: faixa de interferência descendo e pontinhos de chuvisco (mais forte no porão)
        const lair = camX > 5600, by = (f * 2.2) % (H + 120) - 60;
        ctx.fillStyle = 'rgba(200,220,255,' + (lair ? 0.07 : 0.04) + ')'; ctx.fillRect(0, by, W, 26);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < (lair ? 30 : 12); i++) ctx.fillRect(((i * 211 + f * 37) % W), ((i * 97 + f * 53) % H), 3, 2);
      } else if (this.stage.id === 8) {
        // neve caindo na base da Irmandade (mais fraca dentro da base)
        const n = camX > 2600 ? 12 : 40;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < n; i++) {
          const sp = 0.8 + (i % 5) * 0.35, x = ((i * 157 - camX * (0.3 + (i % 3) * 0.2) + Math.sin(f * 0.02 + i) * 30) % W + W) % W, y = (f * sp + i * 89) % (H + 20) - 10;
          const r = 1.5 + (i % 3);
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      } else if (this.stage.id === 7) {
        // brasas do fogo de Trigon subindo; no covil, faíscas das engrenagens caindo
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 20; i++) {
          const x = ((i * 241 - camX * 0.5 + Math.sin(f * 0.03 + i) * 16) % W + W) % W, y = 700 - ((f * (0.8 + (i % 4) * 0.3) + i * 67) % 660);
          ctx.fillStyle = 'rgba(255,' + (110 + (i % 3) * 40) + ',40,' + (0.3 + 0.25 * Math.sin(f * 0.07 + i)) + ')';
          ctx.fillRect(x, y, 3, 3);
        }
        if (camX > 2400) for (let i = 0; i < 4; i++) {
          if (((f + i * 47) % 160) > 26) continue;
          const k = ((f + i * 47) % 160) / 26, x = ((i * 389 - camX * 0.2) % W + W) % W;
          ctx.fillStyle = 'rgba(255,200,120,' + (1 - k) + ')';
          for (let j = 0; j < 4; j++) ctx.fillRect(x + j * 7 - 10, 120 + k * 260 + j * 9, 2, 6);
        }
        ctx.globalCompositeOperation = 'source-over';
      } else if (this.stage.id === 5) {
        // partículas de energia psíquica vermelha subindo (mais densas no salão do Irmão Sangue)
        ctx.globalCompositeOperation = 'lighter';
        const n = camX > 5500 ? 22 : 12;
        for (let i = 0; i < n; i++) {
          const x = ((i * 233 - camX * 0.5) % W + W) % W, y = 700 - ((f * (0.6 + (i % 3) * 0.25) + i * 71) % 640);
          ctx.fillStyle = 'rgba(255,70,90,' + (0.25 + 0.2 * Math.sin(f * 0.05 + i)) + ')';
          ctx.fillRect(x + Math.sin(f * 0.03 + i) * 12, y, 3, 3);
        }
        ctx.globalCompositeOperation = 'source-over';
      } else {
        // poeira flutuando nos túneis
        ctx.fillStyle = 'rgba(255,220,170,0.35)';
        for (let i = 0; i < 26; i++) {
          const x = ((i * 211 - f * (0.3 + (i % 4) * 0.15) - camX * 0.6) % W + W) % W;
          const y = (i * 97 + Math.sin(f * 0.02 + i) * 20) % 520 + 80;
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    drawBubbles(ctx, camX) {
      for (const b of this.bubbles) {
        const f = b.f;
        ctx.font = '22px ' + TT.FONT;
        const w = Math.max(80, ctx.measureText(b.text).width + 26);
        // mantém o balão inteiro dentro da tela (a ponta continua apontando para quem fala)
        const fx = f.x - camX, x = TT.clamp(fx, w / 2 + 10, W - w / 2 - 10);
        const y = Math.max(200, f.y - f.z - (f.height || 120) - 34);
        const pop = Math.min(1, b.t / 6);
        ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
        const tail = TT.clamp(fx - x, -w / 2 + 14, w / 2 - 14);
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-w / 2, -22, w, 40, 14); else ctx.rect(-w / 2, -22, w, 40);
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tail - 8, 17); ctx.lineTo(tail, 30); ctx.lineTo(tail + 8, 17); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillRect(tail - 7, 14, 14, 5);
        TT.drawText(ctx, b.text, 0, -1, 22, b.color === '#ffffff' ? '#222' : b.color, b.color === '#ffffff' ? null : OUT, 'center', 4);
        ctx.restore();
      }
    }

    // Nome do COMBO FINAL: faixa inclinada na cor do Titã que entra pela esquerda e sai pela direita.
    drawComboTag(ctx) {
      const c = this.comboTag, t = c.t;
      const inK = TT.easeOut(Math.min(1, t / 10)), outK = t > 70 ? TT.easeInOut((t - 70) / 20) : 0;
      const x = W / 2 + (1 - inK) * -W + outK * W, y = 168;
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.05);
      ctx.fillStyle = c.col; ctx.strokeStyle = OUT; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-330, -34); ctx.lineTo(350, -34); ctx.lineTo(330, 34); ctx.lineTo(-350, 34); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-330, -30, 680, 14);
      TT.drawText(ctx, 'COMBO FINAL', -300, -48, 22, '#ffe14a', OUT, 'left', 5);
      TT.drawText(ctx, c.text + '!', 0, 2, 48, '#ffffff', OUT, 'center', 9);
      ctx.restore();
      if (t < 8) TT.drawGlow(ctx, c.fx, W / 2, y, 400 * (1 - t / 8), 0.6);
    }

    // ------------------------------------------------------------------ HUD
    drawBar(ctx, x, y, w, h, v, col, back) {
      ctx.fillStyle = back || 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = col; ctx.fillRect(x, y, w * TT.clamp(v, 0, 1), h);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x, y, w * TT.clamp(v, 0, 1), h * 0.35);
      ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
    }

    // Painel de um jogador (P2 espelhado no lado direito).
    drawPlayerPanel(ctx, sl, right) {
      const p = this.team[sl.ai], X = (x) => (right ? W - x : x), al = right ? 'right' : 'left';
      ctx.fillStyle = 'rgba(12,8,30,0.6)';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(right ? W - 466 : 14, 12, 452, 104, 18); else ctx.rect(right ? W - 466 : 14, 12, 452, 104); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(X(66), 64, 44, 0, Math.PI * 2);
      ctx.fillStyle = sl.out ? '#2a2440' : p.def.color; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.clip();
      if (!sl.out) ctx.drawImage(TT.portrait(p.key, 96), X(66) - 48, 18, 96, 96);
      ctx.restore();
      if (this.coop) TT.drawText(ctx, 'P' + (sl.id + 1), X(30), 104, 20, sl.id ? '#6fe3ff' : '#ffe14a', OUT, 'center', 4);
      if (sl.out) {
        TT.drawText(ctx, 'AGUARDANDO...', X(122), 52, 26, '#bfc4e8', OUT, al, 5);
        TT.drawText(ctx, 'volta na próxima área', X(122), 84, 18, '#bfc4e8', OUT, al, 4);
        return;
      }
      TT.drawText(ctx, p.name.toUpperCase(), X(122), 30, 26, '#ffffff', OUT, al, 5);
      const hpk = p.hp / p.maxHp;
      const bx = right ? W - 122 - 320 : 122;
      this.drawBar(ctx, bx, 48, 320, 20, hpk, hpk > 0.5 ? '#4cd964' : hpk > 0.25 ? '#ffcc00' : '#ff3b30');
      // energia compartilhada (4 segmentos)
      const full = this.energy >= 100;
      const ec = full ? (this.frame >> 3) % 2 ? '#ffe14a' : '#ffffff' : this.flashEnergy > 0 && (this.flashEnergy >> 2) % 2 ? '#ff3b30' : '#5fc2ff';
      this.drawBar(ctx, bx, 76, 320, 14, this.energy / 100, ec);
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(bx + 80 * i, 76); ctx.lineTo(bx + 80 * i, 90); ctx.stroke(); }
      const key = sl.id ? '[Num5]' : '[U]';
      TT.drawText(ctx, full ? 'TITÃS, AVANTE! ' + key : 'ENERGIA', X(124), 104, 16, full ? '#ffe14a' : '#bfe6ff', OUT, al, 4);
    }

    drawHUD(ctx) {
      const slots = this.activeSlots();
      this.drawPlayerPanel(ctx, slots[0], false);
      if (slots[1]) this.drawPlayerPanel(ctx, slots[1], true);

      // equipe (anel branco = P1, ciano = P2)
      for (let i = 0; i < 5; i++) {
        const t = this.team[i], x = 490 + i * 62, y = 18;
        const owner = slots.find((sl) => !sl.out && sl.ai === i), act = !!owner;
        ctx.save();
        ctx.globalAlpha = t.ko ? 0.45 : 1;
        ctx.beginPath(); ctx.arc(x + 26, y + 26, act ? 28 : 24, 0, Math.PI * 2);
        ctx.fillStyle = act ? t.def.color : '#2a2440'; ctx.fill();
        ctx.lineWidth = act ? 4 : 3; ctx.strokeStyle = act ? (owner.id ? '#6fe3ff' : '#ffffff') : OUT; ctx.stroke();
        ctx.clip();
        ctx.drawImage(TT.portrait(t.key, 56), x - 2, y - 2, 56, 56);
        ctx.restore();
        this.drawBar(ctx, x + 2, y + 58, 48, 7, t.hp / t.maxHp, t.ko ? '#555' : '#4cd964');
        TT.drawText(ctx, String(i + 1), x + 48, y + 6, 16, '#ffe14a', OUT, 'center', 4);
        if (this.coop && act) TT.drawText(ctx, 'P' + (owner.id + 1), x + 6, y + 6, 15, owner.id ? '#6fe3ff' : '#ffffff', OUT, 'center', 4);
        if (t.ko) TT.drawText(ctx, 'X', x + 26, y + 28, 40, '#ff3b30', OUT, 'center', 6);
      }

      // pontuação e combo
      if (this.coop) {
        // pontuação compartilhada no meio, abaixo da equipe
        TT.drawText(ctx, 'PONTOS ' + String(this.score).padStart(7, '0'), 645, 104, 22, '#ffffff', OUT, 'center', 5);
      } else {
        TT.drawText(ctx, 'PONTOS', W - 24, 26, 18, '#bfe6ff', OUT, 'right', 4);
        TT.drawText(ctx, String(this.score).padStart(7, '0'), W - 24, 54, 34, '#ffffff', OUT, 'right', 6);
      }
      if (this.combo >= 3) {
        const s = 1 + Math.max(0, (this.comboT - 100) / 20);
        ctx.save(); ctx.translate(this.coop ? W - 30 : W - 30, this.coop ? 146 : 100); ctx.scale(s, s);
        TT.drawText(ctx, this.combo + ' GOLPES!', 0, 0, 30, '#ffe14a', OUT, 'right', 6);
        ctx.restore();
      }

      // barra do chefe
      const b = this.boss;
      if (b && !b.dead) {
        // no alto da tela, para não esconder as marcações de perigo no chão
        const w = 640 * this.bossShown, x = W / 2 - 320;
        TT.drawText(ctx, b.name, x, 136, 24, '#ff6a6a', OUT, 'left', 5);
        this.drawBar(ctx, x, 150, w, 18, b.hp / b.maxHp, b.hp < b.maxHp * 0.5 ? '#ff3b30' : '#ff8a3a');
      }

      // seta "SIGA"
      if (this.goArrow > 0 && this.goArrow < 400 && (this.goArrow >> 4) % 2 === 0 && this.section) {
        ctx.save(); ctx.translate(W - 120, H / 2);
        TT.drawText(ctx, 'SIGA', 0, -40, 44, '#ffe14a', OUT, 'center', 8);
        ctx.beginPath(); ctx.moveTo(-40, -12); ctx.lineTo(10, -12); ctx.lineTo(10, -32); ctx.lineTo(50, 0); ctx.lineTo(10, 32); ctx.lineTo(10, 12); ctx.lineTo(-40, 12); ctx.closePath();
        ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
        ctx.restore();
      }

      // faixa de título da fase / chefe
      const bn = this.banner;
      if (bn) {
        const inK = Math.min(1, bn.t / 18), outK = Math.min(1, (bn.dur - bn.t) / 18);
        const a = Math.min(inK, outK);
        ctx.save();
        ctx.globalAlpha = a;
        const y = bn.boss ? 250 : 210;
        ctx.fillStyle = bn.boss ? 'rgba(120,0,20,0.75)' : bn.power ? 'rgba(150,70,0,0.78)' : 'rgba(20,10,60,0.72)';
        ctx.beginPath(); ctx.moveTo(0, y - 60); ctx.lineTo(W, y - 76); ctx.lineTo(W, y + 56); ctx.lineTo(0, y + 70); ctx.closePath(); ctx.fill();
        ctx.fillStyle = bn.boss ? '#ff3b30' : '#ffe14a';
        ctx.fillRect(0, y - 66, W * inK, 5); ctx.fillRect(W * (1 - inK), y + 60, W, 5);
        const slide = (1 - TT.easeOut(inK)) * 300;
        TT.drawText(ctx, bn.text, W / 2 + slide, y - 10, bn.boss ? 76 : 58, '#ffffff', OUT, 'center', 10);
        if (bn.sub) TT.drawText(ctx, bn.sub, W / 2 - slide, y + 38, 26, bn.boss ? '#ffc0c0' : '#ffe14a', OUT, 'center', 5);
        ctx.restore();
      }
    }

    // ------------------------------------------------------------------ Telas
    drawLogo(ctx, x, y, s) {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.04);
      ctx.font = '120px ' + TT.FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = 26; ctx.strokeStyle = OUT; ctx.strokeText('JOVENS TITÃS', 0, 0);
      ctx.lineWidth = 12; ctx.strokeStyle = '#ffffff'; ctx.strokeText('JOVENS TITÃS', 0, 0);
      const g = ctx.createLinearGradient(0, -50, 0, 50);
      g.addColorStop(0, '#ffe14a'); g.addColorStop(0.5, '#ff9a2a'); g.addColorStop(1, '#ff3b30');
      ctx.fillStyle = g; ctx.fillText('JOVENS TITÃS', 0, 0);
      ctx.restore();
    }

    drawTitle(ctx) {
      const f = this.frame;
      const camX = (f * 0.7) % 2200;
      for (const l of this.titleBg.layers) l.draw(ctx, camX);
      const ov = ctx.createLinearGradient(0, 0, 0, H);
      ov.addColorStop(0, 'rgba(20,8,50,0.35)'); ov.addColorStop(1, 'rgba(10,0,30,0.75)');
      ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H);
      // raios de fundo
      ctx.save(); ctx.translate(W / 2, 170); ctx.rotate(f * 0.002);
      ctx.fillStyle = 'rgba(255,220,120,0.08)';
      for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(900, -80); ctx.lineTo(900, 80); ctx.fill(); }
      ctx.restore();
      const items = this.titleItems(), compact = items.length > 6, ty = compact ? -46 : 0;
      this.drawLogo(ctx, W / 2, 150 + ty * 0.6 + Math.sin(f * 0.04) * 6, compact ? 0.9 : 1);
      TT.drawText(ctx, 'A BATALHA DE JUMP CITY', W / 2, 250 + ty * 0.8, 36, '#ffffff', OUT, 'center', 7);
      // os cinco Titãs
      const xs = [250, 445, 640, 835, 1030];
      for (let i = 0; i < 5; i++) {
        const t = this.titleTitans[i];
        t.anim = (Math.floor(f / 90) % 5 === i) ? 'victory' : 'idle';
        t.vx = 0;
        const by = 515 + ty;
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(xs[i], by, 44, 11, 0, 0, Math.PI * 2); ctx.fill();
        TT.computePose(t, t.pose);
        TT.drawRig(ctx, t.style, t.pose, xs[i], by, i < 2 ? 1 : i > 2 ? -1 : 1, { t: t.animT, scale: 1.25 });
        TT.drawText(ctx, t.name.toUpperCase(), xs[i], by + 31, 22, t.def.color, OUT, 'center', 5);
      }
      if (this.showControls) { this.drawControls(ctx, W / 2, 400); return; }
      const many = items.length > 8;
      this.drawMenu(ctx, items.map((it) => this.menuLabel(it)), this.menuIdx, W / 2, many ? 514 : compact ? 526 : 572, many ? 21.5 : compact ? (items.length > 7 ? 23 : 26) : items.length > 5 ? 24 : 27);
      const tip = this.touch && this.touch.visible ? 'analógico escolhe e muda  •  ATAQUE confirma' : '↑↓ escolher  •  ←→ mudar  •  ENTER confirmar  •  M = som';
      TT.drawText(ctx, tip, W / 2, 708, 16, '#bfc4e8', OUT, 'center', 4);
    }

    // Texto e cor de cada item de menu.
    menuLabel(it) {
      const df = this.diff;
      switch (it) {
        case 'play': return { text: 'JOGAR' };
        case 'resume': return { text: 'CONTINUAR' };
        case 'players': return { text: 'JOGADORES:', value: this.onlineLock ? '2 (ONLINE)' : this.numPlayers === 2 ? '2 (CO-OP)' : '1', color: this.numPlayers === 2 ? '#6fe3ff' : '#ffffff' };
        case 'diff': return { text: 'DIFICULDADE:', value: df.name, color: df.color };
        case 'stage': { const i = this.stageSel || 0; return { text: 'FASE:', value: (i + 1) + ' — ' + TT.STAGES[i].name.split('— ')[1], color: '#ffe14a' }; }
        case 'controls': return { text: 'CONTROLES' };
        case 'chars': return { text: 'PERSONAGENS (' + TT.Unlocks.count() + '/' + TT.ROSTER.length + ')' };
        case 'touch': return this.touch.label();
        case 'online': return this.online.label();
        case 'install': return { text: 'INSTALAR APP', color: '#6fe3ff' };
        case 'quit': return this.quitArm ? { text: 'SAIR DA FASE?', value: 'CONFIRMAR', color: '#ff5a4a' } : { text: 'MENU INICIAL' };
        default: return { text: String(it) };
      }
    }

    // Menu vertical; o item selecionado pulsa e mostra setas ‹ › nos valores ajustáveis.
    drawMenu(ctx, items, sel, cx, y0, gap) {
      const f = this.frame;
      items.forEach((it, i) => {
        const y = y0 + i * gap, on = i === sel;
        const size = on ? 28 : 24;
        ctx.font = size + 'px ' + TT.FONT;
        const lw = ctx.measureText(it.text).width;
        const vw = it.value ? ctx.measureText(it.value).width + 44 : 0;
        const total = lw + (it.value ? 14 + vw : 0);
        let x = cx - total / 2;
        if (on) {
          ctx.fillStyle = 'rgba(255,225,74,' + (0.16 + 0.08 * Math.sin(f * 0.15)) + ')';
          ctx.fillRect(cx - total / 2 - 30, y - size * 0.62, total + 60, size * 1.24);
          const ax = cx - total / 2 - 22 + Math.sin(f * 0.2) * 3;
          ctx.beginPath(); ctx.moveTo(ax, y - 9); ctx.lineTo(ax + 12, y); ctx.lineTo(ax, y + 9); ctx.closePath();
          ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
        }
        TT.drawText(ctx, it.text, x, y, size, on ? '#ffe14a' : '#ffffff', OUT, 'left', 5);
        if (it.value) {
          x += lw + 14;
          const col = it.color || '#9effa8';
          for (const [ax, d] of [[x + 6, -1], [x + vw - 6, 1]]) {
            ctx.beginPath(); ctx.moveTo(ax - d * 5, y - 8); ctx.lineTo(ax + d * 5, y); ctx.lineTo(ax - d * 5, y + 8); ctx.closePath();
            ctx.fillStyle = on ? col : '#9a95b8'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
          }
          TT.drawText(ctx, it.value, x + vw / 2, y, size, col, OUT, 'center', 5);
        }
      });
    }

    drawControls(ctx, cx, cy) {
      ctx.fillStyle = 'rgba(10,6,30,0.9)';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(cx - 360, cy - 150, 720, 350, 20); else ctx.rect(cx - 360, cy - 150, 720, 350); ctx.fill();
      ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 4; ctx.stroke();
      TT.drawText(ctx, 'CONTROLES', cx, cy - 118, 34, '#ffe14a', OUT);
      const touch = this.touch && this.touch.visible;
      const rows = touch ? [
        ['Mover', 'analógico (lado esquerdo)'],
        this.power >= 2 ? ['Combo (5) / COMBO FINAL', 'ATAQUE ×5  •  ATAQUE ×2 + FORTE'] : ['Ataque (combo)', 'ATAQUE'],
        ['Ataque forte', 'FORTE'],
        ['Especial (gasta energia)', 'ESPECIAL'],
        ['Pular / Esquiva (+ataque = investida)', 'PULO / ESQUIVA'],
        ['Trocar Titã', 'TROCAR'],
        ['Titãs, avante! (energia cheia)', 'AVANTE!'],
        ['Pausa / Tela cheia', 'II / cantos'],
      ] : [
        ['Mover', this.coop ? 'WASD' : 'WASD / Setas'],
        this.power >= 2 ? ['Combo (5) / COMBO FINAL', 'J ×5  •  J, J, K'] : ['Ataque (combo)', 'J  ou  Z'],
        ['Ataque forte', 'K  ou  X'],
        ['Especial (gasta energia)', 'L  ou  C'],
        ['Pular / Esquiva (+ataque = investida)', 'Espaço / Shift'],
        ['Trocar Titã', '1-5  ou  Q / E'],
        ['Titãs, avante! (energia cheia)', 'U  ou  V'],
        ['Pausa / Som', 'Esc / M'],
      ];
      rows.forEach((r, i) => {
        TT.drawText(ctx, r[0], cx - 330, cy - 76 + i * 30, 21, '#ffffff', OUT, 'left', 4);
        TT.drawText(ctx, r[1], cx + 330, cy - 76 + i * 30, 21, '#9effa8', OUT, 'right', 4);
      });
      if (touch) {
        TT.drawText(ctx, 'Opacidade dos botões: item BOTÕES NA TELA (título ou pausa), com ← →', cx, cy + 160, 17, '#bfc4e8', OUT, 'center', 4);
        TT.drawText(ctx, 'Teclado e controle (gamepad) continuam funcionando', cx, cy + 184, 16, '#6fe3ff', OUT, 'center', 4);
        return;
      }
      TT.drawText(ctx, 'Controle (gamepad) também funciona!' + (this.coop ? '  •  2º controle = P2' : ''), cx, cy + 160, 17, '#bfc4e8', OUT, 'center', 4);
      if (this.coop) TT.drawText(ctx, 'P2: setas • Num1/2/3 golpes • Num0 pula • Num, esquiva • Num4/6 troca • Num5 avante', cx, cy + 184, 16, '#6fe3ff', OUT, 'center', 4);
      else TT.drawText(ctx, 'Co-op: escolha 2 JOGADORES no título (P2 usa setas + teclado numérico)', cx, cy + 184, 16, '#6fe3ff', OUT, 'center', 4);
    }

    drawPause(ctx) {
      ctx.fillStyle = 'rgba(5,0,20,0.6)'; ctx.fillRect(0, 0, W, H);
      TT.drawText(ctx, 'PAUSA', W / 2, 92, 72, '#ffe14a', OUT, 'center', 12);
      const items = this.pauseItems();
      this.drawMenu(ctx, items.map((it) => this.menuLabel(it)), this.pauseIdx, W / 2, items.length > 3 ? 148 : 158, items.length > 3 ? 27 : 32);
      this.drawControls(ctx, W / 2, 400);
      const tip = this.touch && this.touch.visible ? 'II para continuar  •  analógico escolhe  •  ←→ muda dificuldade e opacidade dos botões'
        : 'ESC para continuar  •  ↑↓ escolher  •  ←→ mudar dificuldade e botões na tela';
      TT.drawText(ctx, tip, W / 2, 640, 22, '#ffffff', OUT, 'center', 5);
    }

    // ------------------------------------------------------------------ Menu PERSONAGENS
    // Grade com os 36 personagens do jogo de PS2. Liberado = escolhe a vaga na equipe (1-5);
    // bloqueado = diz qual fase zerar; "EM BREVE" = a fase dele ainda não existe.
    openRoster() {
      A().play('select');
      this.state = 'roster'; this.stateT = 0;
      this.rosterIdx = Math.max(0, TT.ROSTER.findIndex((r) => r.key === this.team[0].key));
      this.rosterSlot = -1; this.rosterMsg = null;
    }
    rosterStatus(r) {
      if (TT.Unlocks.isUnlocked(r.key)) return 'open';
      return TT.Unlocks.available(r.key) ? 'locked' : 'soon';
    }
    updateRoster(inp) {
      if (this.rosterMsg && ++this.rosterMsg.t > 120) this.rosterMsg = null;
      const n = TT.ROSTER.length, COLS = 12, r = TT.ROSTER[this.rosterIdx];
      const ok = inp.wasPressed('menu') || inp.wasPressed('jump') || inp.wasPressed('light');
      const back = inp.wasPressed('heavy') || inp.wasPressed('special') || inp.wasPressed('pause');
      const lr = (inp.wasPressed('right') ? 1 : 0) - (inp.wasPressed('left') ? 1 : 0);
      const ud = (inp.wasPressed('down') ? 1 : 0) - (inp.wasPressed('up') ? 1 : 0);
      if (this.rosterSlot >= 0) { // escolhendo a vaga na equipe
        if (lr) { this.rosterSlot = (this.rosterSlot + lr + 5) % 5; A().play('select'); }
        for (let i = 0; i < 5; i++) if (inp.wasPressed('t' + i)) { this.placeInTeam(r.key, i); return; }
        if (ok) this.placeInTeam(r.key, this.rosterSlot);
        else if (back) { this.rosterSlot = -1; A().play('select'); }
        return;
      }
      if (back && this.stateT > 8) { this.state = 'title'; this.stateT = 21; this.menuIdx = Math.max(0, this.titleItems().indexOf('chars')); A().play('select'); return; }
      if (lr || ud) {
        const row = Math.floor(this.rosterIdx / COLS), col = this.rosterIdx % COLS, rows = Math.ceil(n / COLS);
        this.rosterIdx = Math.min(n - 1, ((row + ud + rows) % rows) * COLS + (col + lr + COLS) % COLS);
        A().play('select');
      }
      if (ok && this.stateT > 8) {
        const st = this.rosterStatus(r);
        if (st === 'open') { const j = this.teamKeys.indexOf(r.key); this.rosterSlot = j >= 0 ? j : 0; A().play('select'); }
        else {
          A().play('ko');
          this.rosterMsg = { t: 0, text: st === 'locked' ? 'Zere a ' + this.stageLabel(r.stage) + ' para liberar!' : 'A fase deste personagem ainda vai chegar!' };
        }
      }
    }
    stageLabel(id) { const s = TT.STAGES.find((x) => x.id === id); return s ? s.name.replace(' — ', ': ').replace('FASE', 'Fase') : 'fase ' + id; }
    // Põe o personagem na vaga i (se já estiver na equipe, troca de lugar com quem estava lá).
    placeInTeam(key, i) {
      const keys = this.teamKeys, j = keys.indexOf(key);
      if (j >= 0) keys[j] = keys[i];
      keys[i] = key;
      this.setTeam(keys);
      this.rosterSlot = -1;
      this.rosterMsg = { t: 0, text: TT.ROSTER_BY[key].name.toUpperCase() + ' ENTROU NA EQUIPE (VAGA ' + (i + 1) + ')!', good: true };
      A().play('switch');
    }

    drawRoster(ctx) {
      const f = this.frame, R = TT.ROSTER, touch = this.touch && this.touch.visible;
      for (const l of this.titleBg.layers) l.draw(ctx, 600);
      ctx.fillStyle = 'rgba(8,4,26,0.82)'; ctx.fillRect(0, 0, W, H);
      TT.drawText(ctx, 'PERSONAGENS', 40, 40, 46, '#ffe14a', OUT, 'left', 9);
      TT.drawText(ctx, 'LIBERADOS ' + TT.Unlocks.count() + '/' + R.length, W - 40, 40, 26, '#ffb0dc', OUT, 'right', 5);
      TT.drawText(ctx, 'Zere a fase de cada personagem para liberar', W / 2 + 30, 42, 18, '#bfc4e8', OUT, 'center', 4);
      // grade 12 x 3
      const CW = 96, CH = 104, GAP = 6, x0 = (W - (12 * CW + 11 * GAP)) / 2, y0 = 76, keys = this.teamKeys;
      R.forEach((r, i) => {
        const x = x0 + (i % 12) * (CW + GAP), y = y0 + Math.floor(i / 12) * (CH + GAP), on = i === this.rosterIdx, st = this.rosterStatus(r);
        const d = TT.TITANS[r.key];
        ctx.save();
        if (on) { ctx.translate(x + CW / 2, y + CH / 2); ctx.scale(1.08, 1.08); ctx.translate(-x - CW / 2, -y - CH / 2); }
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, CW, CH, 12); else ctx.rect(x, y, CW, CH);
        ctx.fillStyle = st === 'open' ? TT.shade(d.color, -0.55) : st === 'locked' ? '#1d1838' : '#120e22'; ctx.fill();
        ctx.lineWidth = on ? 4 : 2.5; ctx.strokeStyle = on ? ((f >> 3) % 2 ? '#ffe14a' : '#ffffff') : st === 'open' ? d.color : '#3a3360';
        if (st === 'soon' && !on) ctx.setLineDash([6, 5]);
        ctx.stroke(); ctx.setLineDash([]);
        const cx = x + CW / 2, cy = y + 40;
        if (st === 'soon') {
          TT.drawText(ctx, '?', cx, cy, 46, '#3a3360', OUT, 'center', 5);
          TT.drawText(ctx, 'EM BREVE', cx, y + 74, 12, '#8a84b8', OUT, 'center', 3);
        } else {
          ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 31, 0, Math.PI * 2); ctx.fillStyle = st === 'open' ? d.color : '#2a2448'; ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke(); ctx.clip();
          ctx.drawImage(st === 'open' ? TT.portrait(r.key, 66) : TT.silhouette(r.key, 66), cx - 33, cy - 33, 66, 66);
          ctx.restore();
          if (st === 'locked') { this.drawLock(ctx, cx, cy + 4); TT.drawText(ctx, 'FASE ' + r.stage, cx, y + 76, 13, '#ffcf5a', OUT, 'center', 3); }
        }
        const nm = st === 'soon' && !on ? '???' : r.name.toUpperCase();
        ctx.font = '14px ' + TT.FONT;
        const sz = Math.min(14, 14 * (CW - 8) / Math.max(1, ctx.measureText(nm).width));
        TT.drawText(ctx, nm, cx, y + CH - 12, sz, st === 'open' ? '#ffffff' : '#9a95b8', OUT, 'center', 3);
        const slot = keys.indexOf(r.key);
        if (slot >= 0) {
          ctx.beginPath(); ctx.arc(x + 14, y + 14, 12, 0, Math.PI * 2); ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke();
          TT.drawText(ctx, String(slot + 1), x + 14, y + 15, 16, OUT, null, 'center');
        }
        ctx.restore();
      });
      this.drawRosterInfo(ctx, R[this.rosterIdx]);
      this.drawTeamBar(ctx);
      if (this.rosterMsg) {
        const m = this.rosterMsg, a = Math.min(1, (120 - m.t) / 15);
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = m.good ? 'rgba(20,90,45,0.92)' : 'rgba(110,10,30,0.92)'; ctx.fillRect(W / 2 - 400, 396, 800, 34);
        TT.drawText(ctx, m.text, W / 2, 413, 22, '#ffffff', OUT, 'center', 5);
        ctx.restore();
      }
      const tip = this.rosterSlot >= 0
        ? (touch ? 'analógico ◄ ► escolhe a vaga  •  ATAQUE confirma  •  FORTE cancela' : '← → escolhe a vaga (ou 1-5)  •  ENTER confirma  •  K / Esc cancela')
        : (touch ? 'analógico escolhe  •  ATAQUE põe na equipe  •  FORTE volta' : 'setas escolhem  •  ENTER põe na equipe  •  K / Esc volta ao título');
      TT.drawText(ctx, tip, W / 2, 708, 17, '#bfc4e8', OUT, 'center', 4);
    }
    drawLock(ctx, x, y) {
      ctx.save(); ctx.translate(x, y);
      ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, -8, 10, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = '#ffcf5a'; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.fillStyle = '#ffcf5a'; ctx.fillRect(-14, -8, 28, 22); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(-14, -8, 28, 22);
      ctx.fillStyle = OUT; ctx.fillRect(-2, -1, 4, 8);
      ctx.restore();
    }
    // Painel do personagem selecionado: modelo animado, como liberar e golpes.
    drawRosterInfo(ctx, r) {
      const st = this.rosterStatus(r), d = TT.TITANS[r.key], x = 36, y = 446;
      ctx.fillStyle = 'rgba(20,12,50,0.85)';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - 12, y - 12, 712, 250, 16); else ctx.rect(x - 12, y - 12, 712, 250); ctx.fill();
      ctx.strokeStyle = st === 'open' ? d.color : '#3a3360'; ctx.lineWidth = 3; ctx.stroke();
      if (st === 'open') { // modelo animado
        let pv = this.rosterPreview;
        if (!pv || pv.key !== r.key) pv = this.rosterPreview = new TT.Titan(this, r.key);
        pv.animT++;
        pv.anim = (this.frame % 240) > 170 ? 'victory' : 'idle'; pv.vx = 0;
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x + 104, y + 222, 66, 13, 0, 0, Math.PI * 2); ctx.fill();
        TT.computePose(pv, pv.pose);
        TT.drawRig(ctx, pv.style, pv.pose, x + 104, y + 222, 1, { t: pv.animT, scale: Math.min(1.25, 200 / Math.max(80, pv.height)) });
      } else if (st === 'locked') {
        ctx.save(); ctx.beginPath(); ctx.arc(x + 104, y + 112, 84, 0, Math.PI * 2); ctx.fillStyle = '#1d1838'; ctx.fill(); ctx.clip();
        ctx.drawImage(TT.silhouette(r.key, 168), x + 20, y + 28, 168, 168); ctx.restore();
        this.drawLock(ctx, x + 104, y + 124);
      } else TT.drawText(ctx, '?', x + 104, y + 112, 150, '#2a2448', OUT, 'center', 10);
      const tx = x + 222;
      TT.drawText(ctx, r.name.toUpperCase(), tx, y + 14, 36, st === 'open' ? d.color : '#bfc4e8', OUT, 'left', 7);
      let line;
      if (st === 'open') line = { text: r.stage === 0 ? 'LIBERADO DESDE O INÍCIO' : 'LIBERADO — ' + this.stageLabel(r.stage).toUpperCase(), col: '#9effa8' };
      else if (st === 'locked') line = { text: 'BLOQUEADO — zere a ' + this.stageLabel(r.stage), col: '#ffcf5a' };
      else line = { text: 'EM BREVE — a fase deste personagem ainda vai chegar', col: '#ff9ac0' };
      ctx.font = '19px ' + TT.FONT;
      TT.drawText(ctx, line.text, tx, y + 48, Math.min(19, 19 * 450 / Math.max(1, ctx.measureText(line.text).width)), line.col, OUT, 'left', 4);
      if (st === 'soon') { this.wrapText(ctx, r.plan || '', tx, y + 86, 450, 19, '#d8d4f0'); return; }
      if (d.blurb) this.wrapText(ctx, d.blurb, tx, y + 78, 450, 17, '#d8d4f0');
      const info = TT.MOVE_INFO[r.key];
      if (info) {
        const rows = [['COMBO  J J J', info[0]], ['FORTE  K', info[1]], ['ESPECIAL  L', info[2]], ['COMBO FINAL  J J K', info[3]]];
        rows.forEach((rw, i) => {
          const yy = y + 126 + i * 25;
          TT.drawText(ctx, rw[0], tx, yy, 16, '#ffe14a', OUT, 'left', 4);
          TT.drawText(ctx, rw[1], tx + 190, yy, 17, '#ffffff', OUT, 'left', 4);
        });
        TT.drawText(ctx, 'COMBO FINAL a partir da fase 8', tx, y + 228, 14, '#9a95b8', OUT, 'left', 3);
      }
    }
    wrapText(ctx, text, x, y, w, size, col) {
      ctx.font = size + 'px ' + TT.FONT;
      let line = '', yy = y;
      for (const wd of text.split(' ')) {
        const t = line ? line + ' ' + wd : wd;
        if (ctx.measureText(t).width > w && line) { TT.drawText(ctx, line, x, yy, size, col, OUT, 'left', 4); line = wd; yy += size * 1.3; }
        else line = t;
      }
      if (line) TT.drawText(ctx, line, x, yy, size, col, OUT, 'left', 4);
    }
    // Equipe atual (5 vagas); no modo de escolher vaga, a vaga em foco pisca.
    drawTeamBar(ctx) {
      const x0 = 766, y = 446, picking = this.rosterSlot >= 0;
      ctx.fillStyle = 'rgba(20,12,50,0.85)';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0 - 12, y - 12, 492, 250, 16); else ctx.rect(x0 - 12, y - 12, 492, 250); ctx.fill();
      ctx.strokeStyle = picking ? '#ffe14a' : '#3a3360'; ctx.lineWidth = 3; ctx.stroke();
      TT.drawText(ctx, picking ? 'ESCOLHA A VAGA' : 'SUA EQUIPE', x0 + 234, y + 16, 30, picking ? '#ffe14a' : '#ffffff', OUT, 'center', 6);
      TT.drawText(ctx, 'no jogo, troque com 1-5 ou Q / E', x0 + 234, y + 46, 15, '#bfc4e8', OUT, 'center', 4);
      this.team.forEach((t, i) => {
        const cx = x0 + 42 + i * 96, cy = y + 116, on = picking && i === this.rosterSlot;
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, on ? 42 : 37, 0, Math.PI * 2); ctx.fillStyle = t.def.color; ctx.fill();
        ctx.lineWidth = on ? 5 : 3; ctx.strokeStyle = on ? ((this.frame >> 3) % 2 ? '#ffe14a' : '#ffffff') : OUT; ctx.stroke(); ctx.clip();
        ctx.drawImage(TT.portrait(t.key, 84), cx - 42, cy - 42, 84, 84);
        ctx.restore();
        TT.drawText(ctx, String(i + 1), cx - 30, cy - 32, 20, '#ffe14a', OUT, 'center', 4);
        ctx.font = '15px ' + TT.FONT;
        const nm = t.name.toUpperCase(), sz = Math.min(15, 15 * 90 / Math.max(1, ctx.measureText(nm).width));
        TT.drawText(ctx, nm, cx, cy + 56, sz, '#ffffff', OUT, 'center', 3);
      });
      const r = TT.ROSTER[this.rosterIdx];
      if (picking) TT.drawText(ctx, r.name.toUpperCase() + ' vai para a vaga ' + (this.rosterSlot + 1), x0 + 234, y + 206, 20, '#9effa8', OUT, 'center', 4);
      else TT.drawText(ctx, 'Escolha um personagem liberado e confirme', x0 + 234, y + 206, 17, '#bfc4e8', OUT, 'center', 4);
    }
    // Faixa "PERSONAGEM LIBERADO!" na tela de fase concluída.
    drawUnlocks(ctx, y) {
      const list = this.newUnlocks, k = TT.clamp((this.stateT - 30) / 20, 0, 1);
      if (k <= 0) return;
      ctx.save(); ctx.globalAlpha = k;
      const w = 140 + list.length * 170;
      ctx.fillStyle = 'rgba(90,20,90,0.9)'; ctx.fillRect(W / 2 - w / 2, y - 44, w, 104);
      ctx.strokeStyle = '#ffb0dc'; ctx.lineWidth = 3; ctx.strokeRect(W / 2 - w / 2, y - 44, w, 104);
      TT.drawText(ctx, list.length > 1 ? 'NOVOS PERSONAGENS LIBERADOS!' : 'NOVO PERSONAGEM LIBERADO!', W / 2, y - 24, 24, '#ffe14a', OUT, 'center', 5);
      list.forEach((r, i) => {
        const cx = W / 2 + (i - (list.length - 1) / 2) * 170, cy = y + 14;
        ctx.save(); ctx.beginPath(); ctx.arc(cx - 46, cy, 25, 0, Math.PI * 2); ctx.fillStyle = TT.TITANS[r.key].color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke(); ctx.clip();
        ctx.drawImage(TT.portrait(r.key, 54), cx - 73, cy - 27, 54, 54); ctx.restore();
        ctx.font = '18px ' + TT.FONT;
        const nm = r.name.toUpperCase(), sz = Math.min(18, 18 * 104 / Math.max(1, ctx.measureText(nm).width));
        TT.drawText(ctx, nm, cx + 30, cy, sz, '#ffffff', OUT, 'center', 4);
      });
      TT.drawText(ctx, 'Monte sua equipe no menu PERSONAGENS', W / 2, y + 48, 15, '#ffd8f0', OUT, 'center', 3);
      ctx.restore();
    }

    drawGameOver(ctx) {
      const k = Math.min(1, this.stateT / 40);
      ctx.fillStyle = 'rgba(30,0,10,' + 0.7 * k + ')'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, 280); ctx.scale(0.5 + k * 0.5, 0.5 + k * 0.5);
      TT.drawText(ctx, 'OS TITÃS CAÍRAM...', 0, 0, 84, '#ff3b30', OUT, 'center', 12);
      ctx.restore();
      const touch = this.touch && this.touch.visible;
      if (this.stateT > 60 && (this.frame >> 5) % 2 === 0) TT.drawText(ctx, touch ? 'ATAQUE para tentar de novo' : 'ENTER para tentar de novo', W / 2, 420, 34, '#ffffff', OUT, 'center', 6);
      if (this.stateT > 60) TT.drawText(ctx, touch ? 'II para voltar ao menu inicial' : 'ESC para voltar ao menu inicial', W / 2, 470, 24, '#bfc4e8', OUT, 'center', 5);
    }

    drawClear(ctx) {
      const k = Math.min(1, this.stateT / 30);
      ctx.fillStyle = 'rgba(10,5,40,' + 0.6 * k + ')'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, 200); ctx.scale(k, k); ctx.rotate(-0.03);
      TT.drawText(ctx, 'FASE CONCLUÍDA!', 0, 0, 96, '#ffe14a', OUT, 'center', 14);
      ctx.restore();
      TT.drawText(ctx, 'PONTOS: ' + this.score, W / 2, 310, 40, '#ffffff', OUT, 'center', 7);
      const xs = [340, 490, 640, 790, 940];
      for (let i = 0; i < 5; i++) {
        const t = this.team[i];
        t.anim = 'victory';
        TT.computePose(t, t.pose);
        TT.drawRig(ctx, t.style, t.pose, xs[i], 560, 1, { t: t.animT + i * 7 });
      }
      if (this.newUnlocks.length) this.drawUnlocks(ctx, 390); // por cima da equipe
      if (this.stateT > 70 && (this.frame >> 5) % 2 === 0) {
        const last = this.stageIdx + 1 >= TT.STAGES.length;
        TT.drawText(ctx, last ? 'ENTER para o final' : 'ENTER para a próxima fase', W / 2, 650, 32, '#9effa8', OUT, 'center', 6);
      }
    }

    drawVictory(ctx) {
      const f = this.frame;
      for (const l of this.titleBg.layers) l.draw(ctx, 900);
      ctx.fillStyle = 'rgba(10,0,30,0.55)'; ctx.fillRect(0, 0, W, H);
      if (f % 6 === 0) this.particles.spawn('star', TT.rand(0, W) + 0, -10, { vy: TT.rand(2, 4), vx: TT.rand(-1, 1), size: TT.rand(8, 16), color: TT.choice(['#ffe14a', '#5dff8a', '#ff6a6a', '#6fe3ff', '#c8a8ff']), life: 200, vr: 0.05 });
      this.particles.draw(ctx, 0);
      this.drawLogo(ctx, W / 2, 120, 0.8);
      TT.drawText(ctx, 'JUMP CITY ESTÁ A SALVO!', W / 2, 230, 56, '#ffffff', OUT, 'center', 9);
      TT.drawText(ctx, 'PONTUAÇÃO FINAL: ' + this.score, W / 2, 300, 36, '#ffe14a', OUT, 'center', 6);
      const xs = [340, 490, 640, 790, 940];
      for (let i = 0; i < 5; i++) {
        const t = this.team[i];
        t.anim = 'victory';
        TT.computePose(t, t.pose);
        TT.drawRig(ctx, t.style, t.pose, xs[i], 560, 1, { t: t.animT + i * 9, scale: 1.1 });
      }
      TT.drawText(ctx, TT.STAGES.length + ' fases concluídas!  •  ' + TT.Unlocks.count() + '/' + TT.ROSTER.length + ' personagens liberados', W / 2, 630, 24, '#bfc4e8', OUT, 'center', 5);
      if (this.stateT > 120 && (f >> 5) % 2 === 0) TT.drawText(ctx, 'ENTER para voltar ao título', W / 2, 680, 26, '#9effa8', OUT, 'center', 5);
    }
  }

  // Remove itens marcados com "remove" sem criar arrays novos.
  function compact(arr) {
    let j = 0;
    for (let i = 0; i < arr.length; i++) if (!arr[i].remove) arr[j++] = arr[i];
    arr.length = j;
  }

  TT.Game = Game;
})();
