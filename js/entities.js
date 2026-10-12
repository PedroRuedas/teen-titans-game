'use strict';
// Entidades de jogo: lutadores (Titãs, inimigos, chefes), projéteis, efeitos, caixas, itens e partículas.
(function () {
  const TT = window.TT;
  const OUT = TT.OUT;
  const A = () => TT.audio;

  // ================================================================ Partículas (com pool)
  class Particles {
    constructor() { this.list = []; this.pool = []; }
    spawn(type, x, y, o) {
      const p = this.pool.pop() || {};
      p.type = type; p.x = x; p.y = y;
      p.vx = 0; p.vy = 0; p.life = 30; p.max = 30; p.size = 6; p.color = '#fff';
      p.grav = 0; p.rot = 0; p.vr = 0; p.text = ''; p.floor = 9999; p.add = false; p.color2 = null;
      if (o) for (const k in o) p[k] = o[k];
      p.max = p.life;
      if (this.list.length < 700) this.list.push(p); else this.pool.push(p);
      return p;
    }
    update() {
      const L = this.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.life--;
        p.vy += p.grav; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        if (p.y > p.floor) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.5; }
        if (p.type === 'dust') { p.vx *= 0.92; p.vy *= 0.92; }
        if (p.life <= 0) { L[i] = L[L.length - 1]; L.pop(); this.pool.push(p); }
      }
    }
    clear() { while (this.list.length) this.pool.push(this.list.pop()); }
    draw(ctx, camX) {
      for (const p of this.list) {
        const k = p.life / p.max, x = p.x - camX, y = p.y;
        switch (p.type) {
          case 'spark': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = p.color; ctx.lineWidth = p.size * k + 1;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.vx * 2.2, y - p.vy * 2.2); ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'glow':
            TT.drawGlow(ctx, p.color, x, y, p.size * (0.6 + 0.4 * k), k);
            break;
          case 'dust':
            ctx.globalAlpha = k * 0.7;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(x, y, p.size * (1.6 - k * 0.6), 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            break;
          case 'debris':
            ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
            ctx.globalAlpha = Math.min(1, k * 3);
            ctx.fillStyle = p.color; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
            ctx.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
            ctx.restore(); ctx.globalAlpha = 1;
            break;
          case 'ring':
            ctx.globalAlpha = k;
            ctx.strokeStyle = p.color; ctx.lineWidth = 4 * k + 1;
            ctx.beginPath(); ctx.ellipse(x, y, p.size * (1.4 - k), p.size * (1.4 - k) * (p.flat || 1), 0, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
            break;
          case 'star':
            ctx.globalAlpha = Math.min(1, k * 2);
            TT.drawBurst(ctx, x, y, p.size, 4, p.color, null, p.rot);
            ctx.globalAlpha = 1;
            break;
          case 'feather':
            ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.globalAlpha = k;
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.35, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore(); ctx.globalAlpha = 1;
            break;
          case 'text': {
            const t = 1 - k;
            const sc = t < 0.15 ? 0.4 + t / 0.15 * 0.8 : 1.2 - Math.min(0.2, (t - 0.15));
            ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.scale(sc, sc);
            ctx.globalAlpha = Math.min(1, k * 4);
            if (p.color2) TT.drawBurst(ctx, 0, 0, p.size * 1.35, 10, p.color2, OUT, 0.2);
            TT.drawText(ctx, p.text, 0, 0, p.size, p.color, OUT, 'center', p.size * 0.22);
            ctx.restore(); ctx.globalAlpha = 1;
            break;
          }
          default: break;
        }
      }
    }
  }
  TT.Particles = Particles;

  // ================================================================ Lutador base
  class Fighter {
    constructor(game, x, y) {
      this.game = game;
      this.x = x; this.y = y; this.z = 0;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.facing = 1;
      this.hp = this.maxHp = 100;
      this.state = 'idle'; this.st = 0;
      this.anim = 'idle'; this.animT = 0;
      this.atk = null;
      this.flash = 0; this.invul = 0;
      this.radius = 24; this.height = 120;
      this.dead = false; this.remove = false;
      this.team = 'none';
      this.pose = TT.newPose();
      this.grav = TT.GRAVITY;
      this.hitstun = 0;
      this.superArmor = false;
      this.downTime = 40;
      this.shadowW = 30;
    }
    setState(s) { this.state = s; this.st = 0; }
    setAnim(a) { if (this.anim !== a) { this.anim = a; this.animT = 0; } }

    startAttack(def) {
      this.atk = { def, t: 0, hits: new Set(), landed: false };
      this.setState('attack');
      this.setAnim('attack');
      if (def.sound0) A().play(def.sound0);
      if (def.shout) this.game.say(this, def.shout, def.shoutColor);
    }

    updateAttack() {
      const a = this.atk; if (!a) return;
      const d = a.def;
      a.t++;
      if (a.t === d.s && d.sound) A().play(d.sound);
      const activeNow = a.t >= d.s && a.t < d.s + d.a;
      if (d.lunge && activeNow) this.vx = this.facing * d.lunge;
      else if (this.z <= 0) this.vx *= 0.7;
      if (d.onFrame) d.onFrame(this, a.t, this.game, a);
      if (this.atk !== a) return; // ataque cancelado no onFrame
      if (d.dmg && activeNow) {
        if (d.rehit && (a.t - d.s) % d.rehit === 0) a.hits.clear();
        this.game.meleeCheck(this, d, a.hits, a);
      }
      if (a.t >= d.s + d.a + d.r) this.endAttack();
    }
    endAttack() {
      this.atk = null;
      this.setState(this.z > 0 ? 'air' : 'idle');
      this.setAnim(this.z > 0 ? 'jump' : 'idle');
    }

    // Retorna true se o golpe acertou.
    takeHit(src, d, dirOverride) {
      if (this.dead || this.invul > 0) return false;
      if (this.state === 'down' && this.z <= 0) return false;
      const dir = dirOverride || TT.sign(this.x - src.x);
      const dmg = d.dmg * (src.dmgMul || 1) * (this.dmgTaken || 1);
      this.hp -= dmg;
      this.flash = 6;
      this.lastHitDir = dir;
      if (this.hp <= 0) {
        this.hp = 0;
        this.die(dir, d);
        return true;
      }
      if (this.superArmor) { this.onArmorHit && this.onArmorHit(dmg, d); return true; }
      this.atk = null;
      this.facing = -dir;
      if (d.knockdown || this.z > 0) this.knockdown(dir, d.launch || 6, d.kb || 4);
      else {
        this.setState('hurt'); this.setAnim('hurt');
        this.hitstun = d.stun || 16;
        this.vx = dir * (d.kb || 2);
      }
      this.onHurt && this.onHurt();
      return true;
    }
    knockdown(dir, launch, kb) {
      this.atk = null;
      this.setState('down'); this.setAnim('down');
      this.vz = launch; this.z = Math.max(this.z, 1);
      this.vx = dir * kb;
      this.onHurt && this.onHurt();
    }
    die(dir, d) {
      this.dead = true;
      this.knockdown(dir, Math.max(7, d.launch || 7), Math.max(5, d.kb || 5));
    }

    // Estados comuns (dano, queda, levantar). Retorna true se tratou o estado.
    commonStates() {
      switch (this.state) {
        case 'hurt':
          this.vx *= 0.85;
          if (--this.hitstun <= 0) { this.setState('idle'); this.setAnim('idle'); }
          return true;
        case 'down':
          if (this.z > 0) { this.st = 0; return true; }
          this.vx *= 0.8;
          if (this.st === 1) { this.game.dust(this.x, this.y, 6, '#c9b9a8'); A().play('land'); this.game.shake = Math.max(this.game.shake, 3); }
          if (this.dead) {
            if (this.st > 45) { this.remove = true; this.onRemoved && this.onRemoved(); }
          } else if (this.st > this.downTime) {
            this.setState('getup'); this.setAnim('getup'); this.invul = 30;
          }
          return true;
        case 'getup':
          if (this.st > 20) { this.setState('idle'); this.setAnim('idle'); }
          return true;
        default:
          return false;
      }
    }

    physics() {
      this.st++; this.animT++;
      if (this.flash > 0) this.flash--;
      if (this.invul > 0) this.invul--;
      this.x += this.vx;
      this.y += this.vy;
      if (this.z > 0 || this.vz !== 0) {
        this.vz -= this.grav;
        this.z += this.vz;
        if (this.z <= 0) {
          this.z = 0; this.vz = 0;
          this.onLand && this.onLand();
        }
      }
      this.y = TT.clamp(this.y, TT.FLOOR_TOP + 6, TT.FLOOR_BOTTOM);
    }

    drawShadow(ctx, camX) {
      const s = Math.max(0.35, 1 - this.z / 300);
      ctx.fillStyle = 'rgba(15,5,25,0.38)';
      ctx.beginPath(); ctx.ellipse(this.x - camX, this.y, this.shadowW * s, this.shadowW * 0.3 * s, 0, 0, Math.PI * 2); ctx.fill();
    }

    draw(ctx, camX) {
      if (this.dead && this.state === 'down' && this.st > 25 && (this.st >> 2) % 2 === 0) return; // pisca antes de sumir
      if (this.invul > 0 && this.state !== 'getup' && (this.invul >> 2) % 2 === 0 && this.team === 'hero') ctx.globalAlpha = 0.55;
      TT.computePose(this, this.pose);
      TT.drawRig(ctx, this.style, this.pose, this.x - camX, this.y - this.z, this.facing, { flash: this.flash > 3, t: this.animT });
      ctx.globalAlpha = 1;
    }
  }
  TT.Fighter = Fighter;

  // ================================================================ Titãs
  const GREEN = '#5dff8a', DARK = '#a77bff', SONIC = '#5fc2ff';

  function spawnBolt(f, g, big) {
    g.addProjectile(new Projectile(g, {
      kind: big ? 'bigbolt' : 'starbolt', team: 'hero', owner: f,
      x: f.x + f.facing * 48, y: f.y, z: f.z > 0 ? f.z + 40 : 72, vx: f.facing * (big ? 11 : 13),
      r: big ? 24 : 14, dmg: big ? 17 : 8, kb: big ? 8 : 3, knockdown: big, launch: 6, life: 70, color: GREEN,
      vz: f.z > 0 ? -f.z / 8 : 0, minZ: 55, // no ar: tiro diagonal para baixo
    }));
    A().play('starbolt');
  }

  const TITANS = {
    robin: {
      name: 'Robin', hp: 120, speed: 4.7, jump: 15.5, color: '#d7262e',
      light: [
        { pose: 'jab', s: 4, a: 3, r: 8, dmg: 6, reach: [0, 64], kb: 1.5, sound0: 'whoosh' },
        { pose: 'swipe', s: 5, a: 4, r: 9, dmg: 7, reach: [0, 100], kb: 2, weapon: 'staff', sound0: 'whoosh' },
        { pose: 'swing', s: 8, a: 4, r: 15, dmg: 13, reach: [0, 110], kb: 7, knockdown: true, launch: 7, weapon: 'staff', big: true, sound0: 'whoosh' },
      ],
      heavy: { pose: 'flyKick', s: 7, a: 13, r: 14, dmg: 15, reach: [0, 72], lunge: 10, knockdown: true, launch: 6, kb: 8, big: true, sound0: 'whoosh' },
      air: { pose: 'dive', s: 3, a: 14, r: 6, dmg: 9, reach: [-10, 64], kb: 3, lunge: 5, zr: 130 },
      special: {
        cost: 25, pose: 'throw', s: 8, a: 1, r: 14, shout: 'Birdarangues!',
        onFrame(f, t, g) {
          if (t !== 8) return;
          for (const dy of [-34, 0, 34]) g.addProjectile(new Projectile(g, {
            kind: 'birdarang', team: 'hero', owner: f, x: f.x + f.facing * 40, y: f.y, z: f.z + 70,
            vx: f.facing * 14, vy: dy / 22, r: 14, dmg: 11, kb: 5, knockdown: true, launch: 5, life: 75, pierce: true,
          }));
          A().play('birdarang');
        },
      },
    },
    starfire: {
      name: 'Estelar', hp: 105, speed: 4.6, jump: 16, floaty: true, color: '#f3a35a',
      light: [
        { pose: 'jab', s: 4, a: 3, r: 8, dmg: 6, reach: [0, 64], kb: 1.5, glow: GREEN, sound0: 'whoosh' },
        { pose: 'cross', s: 4, a: 3, r: 9, dmg: 7, reach: [0, 70], kb: 2, glow: GREEN, sound0: 'whoosh' },
        { pose: 'cast', s: 7, a: 1, r: 13, glow: GREEN, onFrame(f, t, g) { if (t === 7) spawnBolt(f, g, false); } },
      ],
      heavy: { pose: 'cast', s: 15, a: 1, r: 16, glow: GREEN, onFrame(f, t, g) { if (t === 15) spawnBolt(f, g, true); if (t < 15 && t % 3 === 0) g.particles.spawn('glow', f.x + f.facing * 40 + TT.rand(-20, 20), f.y - f.z - 72 + TT.rand(-20, 20), { color: GREEN, size: 14, life: 10 }); } },
      air: { pose: 'cast', s: 5, a: 1, r: 12, glow: GREEN, onFrame(f, t, g) { if (t === 5) spawnBolt(f, g, false); } },
      special: {
        cost: 30, pose: 'beam', s: 14, a: 42, r: 14, dmg: 4, rehit: 6, reach: [20, 620], depth: 30, kb: 2, beam: 'eyes', glow: GREEN,
        shout: 'Raios oculares!', sound: 'laser', mouth: 'shout',
      },
    },
    cyborg: {
      name: 'Ciborgue', hp: 150, speed: 4.0, jump: 14, color: '#5f8fe0',
      light: [
        { pose: 'jab', s: 5, a: 3, r: 9, dmg: 8, reach: [0, 70], kb: 2, sound0: 'whoosh' },
        { pose: 'cross', s: 5, a: 3, r: 10, dmg: 9, reach: [0, 74], kb: 2.5, sound0: 'whoosh' },
        { pose: 'uppercut', s: 8, a: 4, r: 16, dmg: 14, reach: [0, 76], kb: 4, knockdown: true, launch: 10, big: true, sound0: 'whoosh' },
      ],
      heavy: {
        pose: 'slam', s: 15, a: 3, r: 18, dmg: 16, reach: [-70, 140], depth: 60, knockdown: true, launch: 7, kb: 8, big: true,
        onFrame(f, t, g) { if (t === 15) { g.shake = 12; g.groundRing(f.x + f.facing * 60, f.y, '#cfd6e6'); A().play('shockwave'); } },
      },
      air: { pose: 'slam', s: 4, a: 12, r: 8, dmg: 10, reach: [-10, 70], kb: 3, zr: 130 },
      special: {
        cost: 35, pose: 'beam', form: 'cannon', s: 20, a: 32, r: 16, dmg: 5, rehit: 5, reach: [30, 1300], depth: 38, kb: 3, beam: 'sonic',
        shout: 'BOOYAH!', shoutColor: '#5fc2ff', sound: 'sonic',
        onFrame(f, t, g) { if (t < 20 && t % 2 === 0) g.particles.spawn('glow', f.x + f.facing * 70, f.y - f.z - 80, { color: SONIC, size: 30 - t, life: 6 }); },
      },
    },
    raven: {
      name: 'Ravena', hp: 100, speed: 4.4, jump: 14.5, floaty: true, color: '#7b55c9',
      light: [
        { pose: 'swipe', s: 4, a: 4, r: 8, dmg: 6, reach: [0, 92], kb: 1.5, glow: DARK, sound0: 'whoosh', claw: true },
        { pose: 'cast', s: 5, a: 4, r: 9, dmg: 7, reach: [0, 98], kb: 2, glow: DARK, sound0: 'whoosh', claw: true },
        { pose: 'castUp', s: 9, a: 4, r: 16, dmg: 12, reach: [0, 112], kb: 3, knockdown: true, launch: 11, glow: DARK, big: true, sound: 'dark', claw: true },
      ],
      heavy: {
        pose: 'cast', s: 11, a: 1, r: 18, glow: DARK,
        onFrame(f, t, g) {
          if (t !== 11) return;
          g.addProjectile(new Projectile(g, { kind: 'raven', team: 'hero', owner: f, x: f.x + f.facing * 50, y: f.y, z: f.z + 70, vx: f.facing * 9.5, r: 30, dmg: 14, kb: 7, knockdown: true, launch: 7, life: 85, pierce: true }));
          A().play('dark');
        },
      },
      air: { pose: 'cast', s: 4, a: 8, r: 10, dmg: 8, reach: [0, 88], kb: 3, glow: DARK, zr: 130, claw: true },
      special: {
        cost: 40, pose: 'castUp', s: 20, a: 1, r: 26, glow: DARK, shout: 'Azarath Metrion Zinthos!', shoutColor: '#c8a8ff',
        onFrame(f, t, g) {
          if (t < 20 && t % 2 === 0) g.particles.spawn('feather', f.x + TT.rand(-60, 60), f.y - f.z - TT.rand(20, 140), { color: '#1a0f2e', size: 10, vy: -1.5, life: 30, vr: 0.1 });
          if (t === 20) { g.addEffect(new RavenBlast(g, f)); A().play('dark'); g.shake = 14; }
        },
      },
    },
    beastboy: {
      name: 'Mutano', hp: 115, speed: 5.1, jump: 15.5, color: '#79c64c',
      light: [
        { pose: 'jab', s: 4, a: 3, r: 7, dmg: 6, reach: [0, 62], kb: 1.5, sound0: 'whoosh' },
        { pose: 'kick', s: 5, a: 4, r: 9, dmg: 7, reach: [0, 82], kb: 2, sound0: 'whoosh' },
        { pose: 'claw', s: 7, a: 4, r: 15, dmg: 12, reach: [0, 100], kb: 6, knockdown: true, launch: 6, big: true, sound0: 'whoosh' },
      ],
      heavy: {
        form: 'gorilla', pose: 'slam', s: 16, a: 5, r: 16, dmg: 20, reach: [0, 140], depth: 45, knockdown: true, launch: 8, kb: 9, big: true,
        onFrame(f, t, g) {
          if (t === 1) { g.poof(f.x, f.y - 60); A().play('roar'); }
          if (t === 16) { g.shake = 12; g.groundRing(f.x + f.facing * 80, f.y, '#79c64c'); }
          if (t === 36) g.poof(f.x, f.y - 60);
        },
      },
      air: { pose: 'kick', s: 3, a: 12, r: 8, dmg: 9, reach: [0, 82], kb: 3, zr: 130 },
      special: {
        cost: 35, form: 'trex', pose: 'jab', s: 12, a: 46, r: 12, lunge: 7, dmg: 10, rehit: 10, reach: [0, 180], depth: 55, knockdown: true, launch: 7, kb: 10,
        shout: 'RAAAWR!', shoutColor: '#8fd463', sound0: 'roar',
        onFrame(f, t, g) {
          if (t === 1) g.poof(f.x, f.y - 60);
          if (t > 12 && t % 6 === 0) { g.dust(f.x - f.facing * 40, f.y, 2, '#c9b9a8'); g.shake = Math.max(g.shake, 4); }
          if (t === 69) g.poof(f.x, f.y - 60);
        },
      },
    },
  };
  TT.TITANS = TITANS;
  TT.TITAN_ORDER = ['robin', 'beastboy', 'cyborg', 'raven', 'starfire'];

  const BUFFERED = ['light', 'heavy', 'special', 'jump', 'dash'];

  class Titan extends Fighter {
    constructor(game, key) {
      super(game, 300, 580);
      this.key = key;
      this.def = TITANS[key];
      this.style = TT.STYLES[key];
      this.name = this.def.name;
      this.hp = this.maxHp = this.def.hp;
      this.team = 'hero';
      this.radius = 24;
      this.height = key === 'cyborg' ? 140 : 125;
      this.combo = 0; this.comboWindow = 0;
      this.buffer = null; this.bufferT = 0;
      this.ko = false;
      this.airAttacked = false;
      this.downTime = 34;
      this.dmgMul = 1;
      if (this.def.floaty) this.grav = TT.GRAVITY * 0.72;
    }

    reset() {
      this.hp = this.maxHp; this.ko = false; this.dead = false; this.atk = null;
      this.downTime = 34; this.buffer = null; this.bufferT = 0;
      this.z = 0; this.vx = this.vy = this.vz = 0; this.flash = 0; this.invul = 0;
      this.setState('idle'); this.setAnim('idle');
    }

    // Lê os botões para o buffer — chamado em todo passo, inclusive durante o "hit-stop".
    readInput(inp) {
      for (const a of BUFFERED) if (inp.wasPressed(a)) { this.buffer = a; this.bufferT = 9; }
    }

    think(inp) {
      const g = this.game;
      if (this.bufferT > 0) this.bufferT--; else this.buffer = null;
      if (this.comboWindow > 0) this.comboWindow--; else this.combo = 0;

      let mx = (inp.isDown('right') ? 1 : 0) - (inp.isDown('left') ? 1 : 0);
      let my = (inp.isDown('down') ? 1 : 0) - (inp.isDown('up') ? 1 : 0);
      if (mx && my) { mx *= 0.8; my *= 0.8; }

      if (this.commonStates()) return;
      switch (this.state) {
        case 'ko':
          this.vx *= 0.8; return;
        case 'idle': {
          this.vx = mx * this.def.speed;
          this.vy = my * this.def.speed * 0.62;
          if (mx) this.facing = mx > 0 ? 1 : -1;
          this.setAnim(mx || my ? 'walk' : 'idle');
          const b = this.buffer;
          if (!b) return;
          this.buffer = null;
          if (b === 'light') { this.doCombo(); }
          else if (b === 'heavy') { this.vy = 0; this.startAttack(this.def.heavy); }
          else if (b === 'special') this.trySpecial();
          else if (b === 'jump') {
            this.vz = this.def.jump; this.z = 1; this.airAttacked = false;
            this.vx = mx * this.def.speed * 1.1;
            this.setState('air'); this.setAnim('jump'); A().play('jump');
            g.dust(this.x, this.y, 4, '#d9cbbb');
          } else if (b === 'dash') {
            this.setState('dash'); this.setAnim('dash'); this.invul = 12;
            if (mx) this.facing = mx > 0 ? 1 : -1;
            this.vy = my * 3;
            A().play('whoosh');
          }
          return;
        }
        case 'air': {
          this.vx += (mx * this.def.speed - this.vx) * 0.08;
          this.vy = my * this.def.speed * 0.4;
          if (mx) this.facing = mx > 0 ? 1 : -1;
          this.setAnim('jump');
          if ((this.buffer === 'light' || this.buffer === 'heavy') && !this.airAttacked) {
            this.buffer = null; this.airAttacked = true;
            this.startAttack(this.def.air);
            if (this.def.floaty) this.vz = Math.max(this.vz, 2);
          } else if (this.buffer === 'special') { this.buffer = null; this.trySpecial(); }
          return;
        }
        case 'dash': {
          this.vx = this.facing * (13 - this.st * 0.5);
          if (this.st % 3 === 0) g.particles.spawn('dust', this.x - this.facing * 20, this.y - 6, { color: 'rgba(255,255,255,0.8)', size: 7, life: 14 });
          if (this.st > 14) { this.vy = 0; this.setState('idle'); this.setAnim('idle'); }
          return;
        }
        case 'attack': {
          this.vy *= 0.6;
          const a = this.atk;
          // encadeia o combo leve
          if (a && a.def.combo != null && this.buffer === 'light' && a.t >= a.def.s + a.def.a - 1 && a.def.combo < 2) {
            this.buffer = null; this.doCombo(); return;
          }
          // cancela em especial após acertar
          if (a && a.landed && this.buffer === 'special' && a.t >= a.def.s + a.def.a) { this.buffer = null; if (this.trySpecial()) return; }
          if (mx && a && a.t < 2) this.facing = mx > 0 ? 1 : -1;
          this.updateAttack();
          return;
        }
        default:
          this.setState('idle');
      }
    }

    doCombo() {
      const i = this.comboWindow > 0 ? Math.min(this.combo, 2) : 0;
      const def = this.def.light[i];
      def.combo = i;
      this.vx = 0; this.vy = 0;
      this.startAttack(def);
      this.combo = (i + 1) % 3;
      this.comboWindow = def.s + def.a + def.r + 14;
    }

    trySpecial() {
      const sp = this.def.special, g = this.game;
      if (g.energy < sp.cost) { g.flashEnergy = 20; return false; }
      g.energy -= sp.cost;
      this.vx = 0; this.vy = 0;
      this.startAttack(sp);
      if (this.z > 0) this.vz = Math.max(this.vz, 3);
      g.particles.spawn('ring', this.x, this.y - this.z - 60, { color: this.def.color, size: 70, life: 16 });
      return true;
    }

    onLand() {
      if (this.state === 'air' || (this.state === 'attack' && this.atk && this.atk.def === this.def.air)) {
        this.atk = null;
        this.setState('idle'); this.setAnim('idle');
        this.game.dust(this.x, this.y, 3, '#d9cbbb');
        A().play('land');
      }
    }

    die(dir, d) {
      // Titã nocauteado (não é removido)
      this.ko = true;
      this.knockdown(dir, 8, 6);
      this.state = 'down'; this.downTime = 9999;
      A().play('ko');
      this.game.onTitanKO(this);
    }

    onHurt() {
      this.game.combo = 0;
    }

    takeHit(src, d, dir) {
      if (this.game.godMode) return false;
      if (this.state === 'dash' && this.st < 11) return false;
      return super.takeHit(src, d, dir);
    }

    draw(ctx, camX) {
      const a = this.atk, f = a && a.def.form;
      const sx = this.x - camX, sy = this.y - this.z;
      if (this.invul > 0 && this.state !== 'getup' && this.state !== 'dash' && (this.invul >> 2) % 2 === 0) ctx.globalAlpha = 0.55;
      if (f === 'gorilla' && a.t > 1 && a.t < 36) {
        const k = TT.clamp((a.t - 2) / (a.def.s - 2 + 4), 0, 1);
        TT.drawGorilla(ctx, sx, sy, this.facing, k, this.flash > 3);
      } else if (f === 'trex' && a.t > 1 && a.t < 69) {
        TT.drawTRex(ctx, sx, sy, this.facing, a.t, this.flash > 3);
      } else {
        TT.computePose(this, this.pose);
        if (this.key === 'starfire' || this.key === 'raven') {
          if (this.state === 'air' || (this.state === 'attack' && this.z > 0)) this.pose.legB[1] -= 0.4;
        }
        TT.drawRig(ctx, this.style, this.pose, sx, sy, this.facing, { flash: this.flash > 3, t: this.animT });
      }
      ctx.globalAlpha = 1;
      // efeitos de ataque (feixes, garras de energia)
      if (a && a.t >= a.def.s && a.t < a.def.s + a.def.a + 2) {
        if (a.def.beam) this.drawBeam(ctx, sx, sy, a);
        if (a.def.claw) this.drawClaw(ctx, sx, sy, a);
      }
    }

    drawBeam(ctx, sx, sy, a) {
      const d = a.def, fc = this.facing;
      const sc = this.style.scale;
      const ox = sx + fc * (d.beam === 'eyes' ? 20 : 66) * sc;
      const oy = sy - (d.beam === 'eyes' ? 112 : 84) * sc;
      const len = d.reach[1];
      const k = a.t - d.s, fade = Math.min(1, (d.a - k) / 6);
      const w = (d.beam === 'sonic' ? 46 : 16) * (0.85 + Math.sin(k * 0.9) * 0.15) * fade;
      const col = d.beam === 'sonic' ? SONIC : GREEN;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createLinearGradient(0, oy - w, 0, oy + w);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(fc > 0 ? ox : ox - len, oy - w, len, w * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(fc > 0 ? ox : ox - len, oy - w * 0.18, len, w * 0.36);
      TT.drawGlow(ctx, col, ox, oy, w * 2.2, 1);
      ctx.restore();
      if (k % 3 === 0) this.game.particles.spawn('spark', this.x + fc * TT.rand(60, len), oy + TT.rand(-w, w), { vx: fc * TT.rand(4, 10), vy: TT.rand(-2, 2), color: col, size: 3, life: 10 });
    }

    drawClaw(ctx, sx, sy, a) {
      const fc = this.facing, k = (a.t - a.def.s) / a.def.a;
      const r = a.def.reach[1];
      ctx.save();
      ctx.translate(sx + fc * r * 0.55, sy - 70);
      ctx.scale(fc, 1);
      ctx.globalAlpha = 0.85 * (1 - k * 0.5);
      ctx.fillStyle = '#120a22'; ctx.strokeStyle = '#d6c2ff'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, 30); ctx.quadraticCurveTo(-r * 0.1, -50 - k * 20, r * 0.5, -36);
      ctx.lineTo(r * 0.2, -12); ctx.lineTo(r * 0.52, -6); ctx.lineTo(r * 0.16, 10); ctx.lineTo(r * 0.45, 26);
      ctx.quadraticCurveTo(0, 26, -r * 0.4, 30);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
  TT.Titan = Titan;

  // ================================================================ Inimigos comuns
  const ENEMIES = {
    hive: {
      name: 'Soldado H.I.V.E.', style: 'hive', hp: 42, speed: 2.4, range: 58, score: 100, aggr: 1,
      attacks: [
        { pose: 'jab', s: 16, a: 4, r: 16, dmg: 7, reach: [0, 62], kb: 2 },
        { pose: 'kick', s: 19, a: 5, r: 18, dmg: 9, reach: [0, 82], kb: 4, knockdown: true, launch: 4 },
      ],
    },
    slade: {
      name: 'Robô do Slade', style: 'slade', hp: 70, speed: 3.0, range: 62, score: 160, aggr: 1.4,
      attacks: [
        { pose: 'jab', s: 12, a: 3, r: 5, dmg: 6, reach: [0, 64], kb: 1, next: 1 },
        { pose: 'cross', s: 5, a: 3, r: 20, dmg: 8, reach: [0, 70], kb: 3 },
        { pose: 'flyKick', s: 18, a: 10, r: 18, dmg: 12, reach: [0, 72], kb: 7, lunge: 8, knockdown: true, launch: 5 },
      ],
    },
  };
  TT.ENEMIES = ENEMIES;

  class Enemy extends Fighter {
    constructor(game, kind, x, y) {
      super(game, x, y);
      this.kind = kind;
      this.def = ENEMIES[kind];
      this.style = TT.STYLES[this.def.style];
      this.hp = this.maxHp = this.def.hp;
      this.team = 'enemy';
      this.cool = TT.randi(30, 80);
      this.token = false;
      this.wait = TT.rand(170, 260);
      this.yOff = TT.rand(-50, 50);
      this.entering = true;
    }
    releaseToken() { if (this.token) { this.token = false; this.game.tokens++; } }
    onHurt() { this.releaseToken(); }
    die(dir, d) { this.releaseToken(); super.die(dir, d); this.game.onEnemyKilled(this); }
    endAttack() {
      const next = this.atk && this.atk.def.next;
      super.endAttack();
      if (next != null) { this.startAttack(this.def.attacks[next]); return; }
      this.releaseToken();
      this.cool = TT.randi(50, 100) / this.def.aggr;
    }
    think() {
      if (this.commonStates()) return;
      const g = this.game, p = g.player;
      if (this.state === 'attack') { this.updateAttack(); return; }
      if (this.state !== 'idle') { this.setState('idle'); }
      if (!p || p.ko) { this.vx *= 0.8; this.vy *= 0.8; this.setAnim('idle'); return; }
      if (this.cool > 0) this.cool--;
      const dx = p.x - this.x, dy = p.y - this.y, adx = Math.abs(dx);
      const side = dx > 0 ? -1 : 1;
      if (!this.token && this.cool <= 0 && g.tokens > 0 && adx < 320) { this.token = true; g.tokens--; }
      let tx, ty;
      if (this.token) { tx = p.x + side * this.def.range; ty = p.y; }
      else { tx = p.x + side * this.wait; ty = p.y + this.yOff; }
      // mantém-se dentro da tela
      const L = g.camX + 40, R = g.camX + TT.W - 40;
      if (!this.entering) tx = TT.clamp(tx, L, R);
      else if (this.x > L && this.x < R) this.entering = false;
      const mx = tx - this.x, my = ty - this.y;
      const sp = this.def.speed;
      this.vx = Math.abs(mx) > 6 ? TT.sign(mx) * sp : 0;
      this.vy = Math.abs(my) > 4 ? TT.sign(my) * sp * 0.6 : 0;
      this.facing = dx > 0 ? 1 : -1;
      this.setAnim(this.vx || this.vy ? 'walk' : 'idle');
      if (this.token && adx < this.def.range + 22 && Math.abs(dy) < 16 && this.cool <= 0) {
        this.vx = this.vy = 0;
        const atks = this.def.attacks;
        const pick = this.kind === 'slade' ? (Math.random() < 0.6 ? 0 : 2) : TT.randi(0, atks.length - 1);
        this.startAttack(atks[pick]);
      }
    }
  }
  TT.Enemy = Enemy;

  // Drone aranha do Gizmo: voa baixo e atira lasers.
  class Drone extends Fighter {
    constructor(game, x, y) {
      super(game, x, y);
      this.kind = 'drone';
      this.team = 'enemy';
      this.hp = this.maxHp = 26;
      this.radius = 22; this.height = 70;
      this.hover = 26; this.z = this.hover;
      this.grav = 0;
      this.cool = TT.randi(60, 120);
      this.side = Math.random() < 0.5 ? -1 : 1;
      this.shadowW = 20;
      this.charge = 0;
      this.def = { name: 'Drone do Gizmo', score: 120 };
    }
    knockdown(dir, launch, kb) {
      super.knockdown(dir, launch, kb);
      this.grav = TT.GRAVITY;
    }
    die(dir, d) {
      super.die(dir, d);
      this.game.onEnemyKilled(this);
    }
    onRemoved() { this.game.explosion(this.x, this.y, this.z + 20, 0.6); }
    think() {
      if (this.state === 'down' || this.state === 'getup') {
        if (this.state === 'getup' || (this.z <= 0 && this.st > 24 && !this.dead)) {
          // volta a voar
          this.grav = 0; this.vz = 1.5; this.z = Math.max(this.z, 1);
          if (this.z >= this.hover - 2) { this.vz = 0; this.setState('idle'); }
          else this.state = 'getup';
          return;
        }
        this.commonStates();
        return;
      }
      if (this.commonStates()) return;
      const g = this.game, p = g.player;
      this.z += (this.hover + Math.sin(this.animT * 0.08) * 6 - this.z) * 0.1;
      if (!p || p.ko) { this.vx *= 0.9; this.vy *= 0.9; return; }
      const dx = p.x - this.x;
      this.facing = dx > 0 ? 1 : -1;
      if (this.charge > 0) {
        this.vx *= 0.8; this.vy *= 0.8;
        if (--this.charge === 0) {
          g.addProjectile(new Projectile(g, { kind: 'laser', team: 'enemy', owner: this, x: this.x + this.facing * 26, y: this.y, z: this.z + 34, vx: this.facing * 9, r: 10, dmg: 8, kb: 3, life: 140 }));
          A().play('laser');
          this.cool = TT.randi(110, 170);
        }
        return;
      }
      if (Math.abs(dx) < 180) this.side = dx > 0 ? -1 : 1;
      const tx = TT.clamp(p.x + this.side * 330, g.camX + 50, g.camX + TT.W - 50), ty = p.y;
      this.vx = TT.clamp((tx - this.x) * 0.04, -3.2, 3.2);
      this.vy = TT.clamp((ty - this.y) * 0.05, -2.2, 2.2);
      if (this.cool > 0) this.cool--;
      else if (Math.abs(p.y - this.y) < 24 && Math.abs(dx) < 650) { this.charge = 26; A().play('alarm'); }
    }
    draw(ctx, camX) {
      if (this.dead && this.state === 'down' && this.st > 25 && (this.st >> 2) % 2 === 0) return;
      const x = this.x - camX, y = this.y - this.z - 38, fl = this.flash > 3, t = this.animT;
      ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, 1);
      ctx.lineCap = 'round';
      // pernas de aranha
      ctx.strokeStyle = OUT; ctx.lineWidth = 5;
      for (let i = 0; i < 4; i++) {
        const lx = -18 + i * 12, w = Math.sin(t * 0.3 + i) * 4;
        ctx.beginPath(); ctx.moveTo(lx * 0.6, 6); ctx.lineTo(lx * 1.3, 18 + w); ctx.lineTo(lx * 1.5, 30 + w); ctx.stroke();
      }
      ctx.strokeStyle = fl ? '#fff' : '#8d96a6'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 4; i++) {
        const lx = -18 + i * 12, w = Math.sin(t * 0.3 + i) * 4;
        ctx.beginPath(); ctx.moveTo(lx * 0.6, 6); ctx.lineTo(lx * 1.3, 18 + w); ctx.lineTo(lx * 1.5, 30 + w); ctx.stroke();
      }
      // hélice
      ctx.fillStyle = 'rgba(220,230,255,0.45)';
      ctx.beginPath(); ctx.ellipse(0, -26, 30 * Math.abs(Math.sin(t * 0.9)) + 6, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = OUT; ctx.fillRect(-2, -26, 4, 10);
      // corpo
      ctx.beginPath(); ctx.ellipse(0, 0, 26, 18, 0, 0, Math.PI * 2);
      ctx.fillStyle = fl ? '#fff' : '#5c6576'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -5, 20, 8, 0, Math.PI, Math.PI * 2); ctx.fillStyle = fl ? '#fff' : '#8d96a6'; ctx.fill();
      // olho
      ctx.beginPath(); ctx.arc(13, 2, 7, 0, Math.PI * 2); ctx.fillStyle = '#220'; ctx.fill();
      ctx.beginPath(); ctx.arc(14, 2, 4, 0, Math.PI * 2); ctx.fillStyle = '#ff3030'; ctx.fill();
      TT.drawGlow(ctx, '#ff3030', 14, 2, this.charge > 0 ? 24 + (26 - this.charge) : 12, 0.9);
      ctx.restore();
    }
  }
  TT.Drone = Drone;

  // ================================================================ Chefes
  class Boss extends Fighter {
    constructor(game, x, y) {
      super(game, x, y);
      this.team = 'enemy';
      this.superArmor = true;
      this.poise = 0;
      this.cool = 90;
      this.isBoss = true;
      this.active = false; // fica parado durante a apresentação
    }
    onArmorHit(dmg, d) {
      this.poise += dmg * (d.big ? 1.6 : 1);
      if (this.poise > this.poiseMax && this.state !== 'attack') {
        this.poise = 0;
        this.atk = null;
        this.setState('stagger'); this.setAnim('hurt');
        this.vx = this.lastHitDir * 3;
      }
    }
    die(dir, d) {
      this.dead = true;
      this.atk = null;
      this.setState('dying'); this.setAnim('hurt');
      this.game.onBossKilled(this);
    }
    phase2() { return this.hp < this.maxHp * 0.5; }
    // Posição ideal a "dist" do jogador, escolhendo o lado com espaço na tela.
    sideTarget(p, dist) {
      const g = this.game, L = g.camX + this.radius + 20, R = g.camX + TT.W - this.radius - 20;
      const side = this.x > p.x ? 1 : -1;
      let tx = p.x + side * dist;
      if (tx > R || tx < L) tx = p.x - side * dist;
      return TT.clamp(tx, L, R);
    }
    physics() {
      super.physics();
      const g = this.game;
      if (this.active) this.x = TT.clamp(this.x, g.camX + this.radius, g.camX + TT.W - this.radius);
    }
    approach(tx, ty, sp) {
      const mx = tx - this.x, my = ty - this.y;
      this.vx = Math.abs(mx) > 8 ? TT.sign(mx) * sp : 0;
      this.vy = Math.abs(my) > 6 ? TT.sign(my) * sp * 0.6 : 0;
      this.setAnim(this.vx || this.vy ? 'walk' : 'idle');
    }
    commonBoss() {
      if (this.state === 'dying') {
        this.vx = this.vy = 0;
        if (this.st % 6 === 0) this.game.explosion(this.x + TT.rand(-80, 80), this.y + TT.rand(-10, 10), TT.rand(30, this.height), 0.8);
        if (this.st > 110) { this.remove = true; this.game.onBossRemoved(this); }
        return true;
      }
      if (this.state === 'stagger') {
        this.vx *= 0.85;
        if (this.st > 34) { this.setState('idle'); this.setAnim('idle'); this.cool = 20; }
        return true;
      }
      return false;
    }
  }

  // ---- Cinderblock
  class Cinderblock extends Boss {
    constructor(game, x, y) {
      super(game, x, y);
      this.name = 'CINDERBLOCK';
      this.style = TT.STYLES.cinderblock;
      this.hp = this.maxHp = 900;
      this.radius = 60; this.height = 260; this.shadowW = 90;
      this.poiseMax = 110;
      this.grav = 1.1;
      this.def = { score: 5000 };
      this.ATK = {
        swipe: { pose: 'swing', s: 28, a: 6, r: 26, dmg: 16, reach: [0, 175], depth: 55, kb: 11, knockdown: true, launch: 7, sound0: 'roar',
          onFrame(f, t, g) { if (t === 28) { g.shake = 8; A().play('hitHeavy'); } } },
        pound: { pose: 'slam', s: 32, a: 2, r: 34,
          onFrame(f, t, g) {
            if (t === 8) { f.vz = 11; f.z = 1; }
            if (t === 32) { g.shake = 18; A().play('shockwave'); g.addEffect(new Shockwave(g, f.x, f.y, 620, 14, 'enemy')); g.dust(f.x, f.y, 14, '#b9aa9a'); }
          } },
        charge: { pose: 'cross', s: 30, a: 54, r: 30, dmg: 18, reach: [0, 90], depth: 50, kb: 12, knockdown: true, launch: 7, lunge: 10.5, sound0: 'roar',
          onFrame(f, t, g) {
            if (t > 30 && t < 84 && t % 4 === 0) { g.dust(f.x - f.facing * 50, f.y, 2, '#b9aa9a'); g.shake = Math.max(g.shake, 3); }
            const L = g.camX + 70, R = g.camX + TT.W - 70;
            if (t > 30 && t < 84 && ((f.facing > 0 && f.x > R) || (f.facing < 0 && f.x < L))) {
              // bate na parede e fica atordoado
              f.x = TT.clamp(f.x, L, R); f.atk = null; g.shake = 20; A().play('boom');
              g.debrisBurst(f.x + f.facing * 60, f.y - 120, 12, '#8e8880');
              f.setState('stagger'); f.setAnim('hurt'); f.st = -40; f.vx = -f.facing * 4;
            }
          } },
        throw: { pose: 'throw', s: 26, a: 1, r: 26,
          onFrame(f, t, g) {
            if (t === 4) g.debrisBurst(f.x, f.y - 10, 6, '#8e8880');
            if (t === 26) {
              const p = g.player; if (!p) return;
              const T = 48, z0 = 190, gr = 0.6;
              g.addProjectile(new Projectile(g, {
                kind: 'boulder', team: 'enemy', owner: f, x: f.x + f.facing * 40, y: f.y, z: z0,
                vx: (p.x - f.x) / T, vy: (p.y - f.y) / T, vz: (0.5 * gr * T * T - z0) / T, grav: gr,
                r: 30, dmg: 14, kb: 6, knockdown: true, launch: 6, life: 120, explodeOnGround: 90,
              }));
              A().play('whoosh');
            }
          } },
      };
    }
    think() {
      if (this.commonBoss()) return;
      if (this.state === 'down' || this.state === 'hurt') { this.setState('idle'); }
      const g = this.game, p = g.player;
      if (this.state === 'attack') { this.updateAttack(); return; }
      if (!this.active || !p || p.ko) { this.vx = this.vy = 0; this.setAnim('idle'); return; }
      const dx = p.x - this.x, dy = p.y - this.y, adx = Math.abs(dx);
      this.facing = dx > 0 ? 1 : -1;
      const p2 = this.phase2();
      this.dmgMul = p2 ? 1.15 : 1;
      if (this.cool > 0) this.cool--;
      this.approach(this.sideTarget(p, 140), p.y, p2 ? 2.2 : 1.6);
      if (this.cool <= 0) {
        this.vx = this.vy = 0;
        let pick;
        if (adx < 190 && Math.abs(dy) < 45) pick = Math.random() < 0.65 ? 'swipe' : 'pound';
        else if (Math.abs(dy) < 50 && adx > 300) pick = Math.random() < 0.6 ? 'charge' : 'throw';
        else pick = TT.choice(['throw', 'pound', 'throw']);
        this.startAttack(this.ATK[pick]);
        this.cool = p2 ? TT.randi(40, 70) : TT.randi(70, 110);
      }
    }
    draw(ctx, camX) {
      if (this.state === 'dying' && (this.st >> 2) % 2 === 0) ctx.globalAlpha = 0.7;
      TT.computePose(this, this.pose);
      if (this.state === 'stagger') { this.pose.lean = -0.3; this.pose.tilt = -0.3; }
      TT.drawRig(ctx, this.style, this.pose, this.x - camX, this.y - this.z, this.facing, { flash: this.flash > 3, t: this.animT });
      ctx.globalAlpha = 1;
      if (this.state === 'stagger') this.drawDizzy(ctx, this.x - camX, this.y - this.z - this.height - 10);
    }
    drawDizzy(ctx, x, y) {
      for (let i = 0; i < 3; i++) {
        const a = this.animT * 0.12 + i * 2.1;
        TT.drawBurst(ctx, x + Math.cos(a) * 34, y + Math.sin(a) * 9, 9, 5, '#ffe14a', OUT, a);
      }
    }
  }
  TT.Cinderblock = Cinderblock;

  // ---- Gizmo no robô-aranha perfurador
  class GizmoMech extends Boss {
    constructor(game, x, y) {
      super(game, x, y);
      this.name = 'GIZMO';
      this.hp = this.maxHp = 1000;
      this.radius = 70; this.height = 210; this.shadowW = 110;
      this.poiseMax = 140;
      this.drillSpin = 0;
      this.def = { score: 6000 };
      this.taunts = ['Seus pateta-titãs!', 'Tecnologia de ponta, otários!', 'Vou perfurar vocês!', 'Ninguém vence o Gizmo!'];
      this.ATK = {
        drill: { pose: 'jab', s: 34, a: 34, r: 30, lunge: 8, dmg: 6, rehit: 8, reach: [40, 210], depth: 48, kb: 4, stun: 14, sound0: 'drill',
          onFrame(f, t, g) {
            f.drillSpin += t < 34 ? 0.2 + t * 0.02 : 1.1;
            if (t >= 34 && t < 68 && t % 4 === 0) { A().play('drill'); g.particles.spawn('spark', f.x + f.facing * 200, f.y - 90, { vx: f.facing * TT.rand(3, 9), vy: TT.rand(-6, 1), color: '#ffcf5a', size: 3, life: 14, grav: 0.4 }); }
            if (t === 60) f.atk.def = f.ATK.drillEnd;
          } },
        drillEnd: { pose: 'jab', s: 34, a: 34, r: 30, lunge: 6, dmg: 9, reach: [40, 210], depth: 48, kb: 9, knockdown: true, launch: 6 },
        missiles: { pose: 'castUp', s: 24, a: 1, r: 40,
          onFrame(f, t, g) {
            if (t === 1) A().play('alarm');
            const n = f.phase2() ? 7 : 4;
            if (t >= 24 && t < 24 + n * 6 && (t - 24) % 6 === 0) {
              const p = g.player; if (!p) return;
              const tx = TT.clamp(p.x + TT.rand(-160, 160), g.camX + 60, g.camX + TT.W - 60);
              const ty = TT.clamp(p.y + TT.rand(-60, 60), TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM - 4);
              g.addProjectile(new Projectile(g, { kind: 'missile', team: 'enemy', owner: f, x: tx, y: ty, z: 700, vz: -12, grav: 0, r: 0, dmg: 0, life: 200, explodeOnGround: 85, blastDmg: 12 }));
              A().play('laser');
            }
          } },
        drones: { pose: 'castUp', s: 20, a: 1, r: 30,
          onFrame(f, t, g) {
            if (t === 20) {
              for (let i = 0; i < 2; i++) {
                const d = new Drone(g, f.x + TT.rand(-40, 40), f.y + (i ? 30 : -30));
                d.z = 160; d.vz = 0;
                g.addEnemy(d);
              }
              g.say(f, TT.choice(f.taunts), '#9effa8');
            }
          } },
        laser: { pose: 'beam', s: 40, a: 34, r: 24, dmg: 5, rehit: 6, reach: [60, 1300], depth: 24, kb: 3, zr: 50, sound: 'sonic' },
      };
    }
    think() {
      this.drillSpin += 0.05;
      if (this.commonBoss()) return;
      if (this.state === 'down' || this.state === 'hurt') this.setState('idle');
      const g = this.game, p = g.player;
      if (this.state === 'attack') { this.updateAttack(); return; }
      if (!this.active || !p || p.ko) { this.vx = this.vy = 0; this.setAnim('idle'); return; }
      const dx = p.x - this.x, adx = Math.abs(dx);
      this.facing = dx > 0 ? 1 : -1;
      const p2 = this.phase2();
      if (this.cool > 0) this.cool--;
      // segura a posição a meia distância (não foge do jogador); só reposiciona se muito longe/perto
      if (adx > 380 || adx < 120) this.approach(this.sideTarget(p, 240), p.y, p2 ? 2.4 : 1.8);
      else this.approach(this.x, p.y, p2 ? 2.4 : 1.8);
      if (this.cool <= 0) {
        this.vx = this.vy = 0;
        const drones = g.enemies.filter((e) => e.kind === 'drone' && !e.dead).length;
        const opts = ['missiles'];
        if (adx < 330 && Math.abs(p.y - this.y) < 60) opts.push('drill', 'drill');
        if (drones < 2) opts.push('drones');
        if (p2) opts.push('laser');
        if (p2 && Math.abs(p.y - this.y) < 40) opts.push('laser');
        const pick = TT.choice(opts);
        this.startAttack(this.ATK[pick]);
        this.cool = p2 ? TT.randi(45, 75) : TT.randi(70, 110);
        if (Math.random() < 0.25) g.say(this, TT.choice(this.taunts), '#9effa8');
      }
    }
    draw(ctx, camX) {
      const x = this.x - camX, y = this.y - this.z, t = this.animT, fl = this.flash > 3;
      const col = (c) => (fl ? '#ffffff' : c);
      if (this.state === 'dying' && (this.st >> 2) % 2 === 0) ctx.globalAlpha = 0.75;
      const a = this.atk;
      const walking = this.anim === 'walk';
      ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, 1);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const bodyY = -120 + Math.sin(t * 0.1) * 3;
      // pernas
      for (let i = 0; i < 4; i++) {
        const back = i < 2;
        const base = [-60, 40, -30, 70][i];
        const ph = walking ? Math.sin(t * 0.2 + i * 1.6) * 16 : 0;
        const fx = base + ph, kx = base * 0.75 + (base > 0 ? 25 : -25), ky = bodyY - 20;
        ctx.strokeStyle = OUT; ctx.lineWidth = 14;
        ctx.beginPath(); ctx.moveTo(base * 0.4, bodyY + 10); ctx.lineTo(kx, ky - 30); ctx.lineTo(fx, back ? -6 : 0); ctx.stroke();
        ctx.strokeStyle = col(back ? '#4f5866' : '#7c8798'); ctx.lineWidth = 8; ctx.stroke();
        ctx.fillStyle = col('#f0c62e'); ctx.beginPath(); ctx.arc(kx, ky - 30, 7, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
      }
      // corpo
      ctx.beginPath(); ctx.ellipse(0, bodyY, 92, 52, 0, 0, Math.PI * 2);
      ctx.fillStyle = col('#6c7686'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, bodyY + 12, 80, 30, 0, 0, Math.PI); ctx.fillStyle = col('#535c6b'); ctx.fill();
      ctx.fillStyle = col('#f0c62e'); ctx.fillRect(-70, bodyY - 4, 140, 8);
      // míssil na traseira
      ctx.fillStyle = col('#3e4652'); ctx.fillRect(-90, bodyY - 60, 50, 34); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(-90, bodyY - 60, 50, 34);
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-80 + k * 15, bodyY - 43, 5, 0, Math.PI * 2); ctx.fillStyle = col('#ff4a3a'); ctx.fill(); }
      // cabine com o Gizmo
      ctx.beginPath(); ctx.arc(10, bodyY - 48, 40, Math.PI, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = 'rgba(140,220,255,0.35)'; ctx.fill();
      this.drawGizmo(ctx, 10, bodyY - 52, fl);
      ctx.beginPath(); ctx.arc(10, bodyY - 48, 40, Math.PI, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = 'rgba(200,240,255,0.18)'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-6, bodyY - 70, 10, 5, -0.5, 0, Math.PI * 2); ctx.fill();
      // braço-broca
      const extend = a && a.def.lunge ? Math.min(1, a.t / 20) * 30 : 0;
      ctx.save(); ctx.translate(70 + extend, bodyY + 4);
      ctx.fillStyle = col('#7c8798'); ctx.fillRect(-20, -16, 40, 32); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(-20, -16, 40, 32);
      ctx.beginPath(); ctx.moveTo(18, -26); ctx.lineTo(120, 0); ctx.lineTo(18, 26); ctx.closePath();
      ctx.fillStyle = col('#c9ced8'); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 6;
      const sp = (this.drillSpin * 20) % 24;
      for (let k = -24; k < 120; k += 24) { ctx.beginPath(); ctx.moveTo(k + sp, -30); ctx.lineTo(k + sp + 16, 30); ctx.stroke(); }
      ctx.restore();
      ctx.restore();
      // olho-laser
      const charging = a && a.def === this.ATK.laser;
      ctx.beginPath(); ctx.arc(76, bodyY - 26, 12, 0, Math.PI * 2); ctx.fillStyle = '#200'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(78, bodyY - 26, 7, 0, Math.PI * 2); ctx.fillStyle = '#ff3030'; ctx.fill();
      TT.drawGlow(ctx, '#ff3030', 78, bodyY - 26, charging ? 30 + a.t : 16, 1);
      ctx.restore();
      ctx.globalAlpha = 1;
      // feixe laser (fase 2)
      if (charging) {
        const d = a.def, oy = y + bodyY - 26;
        if (a.t < d.s) {
          ctx.strokeStyle = 'rgba(255,60,60,' + (0.3 + (a.t % 6 < 3 ? 0.4 : 0)) + ')'; ctx.lineWidth = 2; ctx.setLineDash([12, 10]);
          ctx.beginPath(); ctx.moveTo(x + this.facing * 90, oy); ctx.lineTo(x + this.facing * 1400, oy); ctx.stroke(); ctx.setLineDash([]);
          // marca no chão da faixa de profundidade atingida
          ctx.fillStyle = 'rgba(255,40,40,0.18)';
          ctx.fillRect(this.facing > 0 ? x + 60 : x - 1360, this.y - 24, 1300, 48);
        } else if (a.t < d.s + d.a) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const w = 20 + Math.sin(a.t) * 4;
          const gr = ctx.createLinearGradient(0, oy - w, 0, oy + w);
          gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, '#ff3a3a'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.fillRect(this.facing > 0 ? x + 80 : x - 1380, oy - w, 1300, w * 2);
          ctx.fillStyle = '#fff'; ctx.fillRect(this.facing > 0 ? x + 80 : x - 1380, oy - 3, 1300, 6);
          ctx.restore();
        }
      }
      if (this.state === 'stagger') Cinderblock.prototype.drawDizzy.call(this, ctx, x, y - this.height + 20);
    }
    drawGizmo(ctx, x, y, fl) {
      const col = (c) => (fl ? '#ffffff' : c);
      ctx.save(); ctx.translate(x, y);
      // careca, óculos verdes, mochila
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fillStyle = col('#f2c7a5'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(-14, 2, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col('#2c2c34'); ctx.fillRect(-16, -6, 34, 7);
      for (const ex of [2, 13]) {
        ctx.beginPath(); ctx.arc(ex, -3, 6, 0, Math.PI * 2); ctx.fillStyle = col('#7dff6a'); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(4, 9); ctx.quadraticCurveTo(9, 6, 13, 10); ctx.stroke();
      ctx.fillStyle = col('#3c8f3a'); ctx.fillRect(-14, 16, 28, 14);
      ctx.restore();
    }
  }
  TT.GizmoMech = GizmoMech;

  // ---- Perfuratriz gigante da perseguição
  class DrillMachine {
    constructor(game) {
      this.game = game;
      this.x = 0; this.t = 0;
      this.stopped = false; this.crash = 0;
      this.isProp = true;
      this.y = TT.FLOOR_BOTTOM + 30; // desenhada por cima de tudo na profundidade
    }
    update() {
      const g = this.game;
      this.t++;
      if (!this.stopped) this.x = g.camX + 40 + Math.sin(this.t * 0.05) * 10;
      if (this.t % 10 === 0) A().play('drill');
      if (this.stopped) { this.crash++; return; }
      const front = this.x + 150;
      if (this.t % 2 === 0) g.particles.spawn('debris', front + TT.rand(-10, 40), TT.rand(TT.FLOOR_TOP - 150, TT.FLOOR_BOTTOM), { vx: TT.rand(1, 6), vy: TT.rand(-8, -2), grav: 0.5, color: TT.choice(['#6b4a36', '#5a3d33', '#8a6a52']), size: TT.rand(5, 11), life: 40, vr: 0.2, floor: TT.FLOOR_BOTTOM });
      // dano ao que encosta na broca
      for (const t of g.allFighters()) {
        if (t.dead || (t.team === 'hero' && t.ko)) continue;
        if (t.x < front + t.radius) {
          if (t.team === 'hero') {
            if (t.state !== 'down' && t.invul <= 0) {
              const hit = t.takeHit({ x: t.x - 50, dmgMul: 1 }, { dmg: 14, kb: 12, knockdown: true, launch: 8 }, 1);
              if (hit) { g.shake = 10; A().play('hitHeavy'); g.hitSpark(t.x, t.y - 60, true); }
            }
            t.x = Math.max(t.x, front + t.radius);
          } else if (!t.isBoss) {
            t.takeHit({ x: t.x - 50, dmgMul: 1 }, { dmg: 999, kb: 12, knockdown: true, launch: 10 }, 1);
            g.hitSpark(t.x, t.y - 60, true);
          }
        }
      }
    }
    draw(ctx, camX) {
      const x = this.x - camX, t = this.t;
      const shake = this.stopped ? 0 : Math.sin(t * 0.9) * 2;
      ctx.save(); ctx.translate(x + shake, 0);
      ctx.lineJoin = 'round';
      // corpo (cobre toda a altura do túnel)
      ctx.fillStyle = '#4b4f5c'; ctx.strokeStyle = OUT; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-400, 120); ctx.lineTo(60, 160); ctx.lineTo(70, 700); ctx.lineTo(-400, 720); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f0c62e'; ctx.fillRect(-400, 300, 470, 26);
      ctx.fillStyle = OUT; for (let k = -400; k < 70; k += 36) { ctx.beginPath(); ctx.moveTo(k, 300); ctx.lineTo(k + 18, 300); ctx.lineTo(k + 8, 326); ctx.lineTo(k - 10, 326); ctx.fill(); }
      ctx.fillStyle = '#f0c62e'; ctx.beginPath(); ctx.arc(-120, 230, 38, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
      TT.drawText(ctx, 'H', -120, 232, 46, OUT);
      // luzes de alerta
      if (!this.stopped && (t >> 4) % 2 === 0) TT.drawGlow(ctx, '#ff3030', 30, 150, 50, 1);
      // broca cônica
      ctx.save(); ctx.translate(60, 430);
      ctx.beginPath(); ctx.moveTo(0, -270); ctx.lineTo(150, 0); ctx.lineTo(0, 270); ctx.closePath();
      const gr = ctx.createLinearGradient(0, -270, 0, 270);
      gr.addColorStop(0, '#9aa1ad'); gr.addColorStop(0.45, '#e6e9ef'); gr.addColorStop(1, '#6d737e');
      ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = '#5a606b'; ctx.lineWidth = 10;
      const off = this.stopped ? 0 : (t * 6) % 60;
      for (let k = -300; k < 300; k += 60) { ctx.beginPath(); ctx.moveTo(0, k + off); ctx.lineTo(150, k + off + 40); ctx.stroke(); }
      ctx.restore();
      ctx.restore();
      ctx.restore();
    }
  }
  TT.DrillMachine = DrillMachine;

  // ================================================================ Projéteis
  class Projectile {
    constructor(game, o) {
      this.game = game;
      Object.assign(this, { vy: 0, vz: 0, grav: 0, pierce: false, life: 60, r: 12, t: 0, kb: 3, launch: 5, knockdown: false });
      Object.assign(this, o);
      this.hits = new Set();
      this.remove = false;
      this.spin = 0;
      this.facing = this.vx < 0 ? -1 : 1;
    }
    update() {
      const g = this.game;
      this.t++;
      this.x += this.vx; this.y += this.vy;
      this.vz -= this.grav; this.z += this.vz;
      if (this.minZ != null && this.z < this.minZ) { this.z = this.minZ; this.vz = 0; }
      this.spin += 0.5;
      if (--this.life <= 0) this.remove = true;
      if (this.explodeOnGround && this.z <= 0) {
        this.z = 0; this.remove = true;
        g.blast(this.x, this.y, this.explodeOnGround, this.blastDmg || this.dmg, this.team, this.owner);
        return;
      }
      if (this.kind === 'starbolt' || this.kind === 'bigbolt') {
        if (this.t % 2 === 0) g.particles.spawn('glow', this.x - this.vx, this.y - this.z, { color: '#5dff8a', size: this.r * 1.2, life: 10 });
      } else if (this.kind === 'raven') {
        if (this.t % 3 === 0) g.particles.spawn('feather', this.x - this.vx * 3, this.y - this.z + TT.rand(-20, 20), { color: '#1a0f2e', size: 9, life: 22, vr: 0.2, vy: TT.rand(-1, 1) });
      } else if (this.kind === 'missile') {
        if (this.t % 2 === 0) g.particles.spawn('dust', this.x, this.y - this.z - 30, { color: 'rgba(200,200,200,0.7)', size: 8, life: 18 });
      }
      if (!this.dmg) return;
      const sx = this.x - g.camX;
      if (sx < -200 || sx > TT.W + 200) { this.remove = true; return; }
      const targets = this.team === 'hero' ? g.enemies.concat(g.props) : [g.player];
      for (const t of targets) {
        if (!t || t.dead || this.hits.has(t) || (t.ko)) continue;
        if (Math.abs(t.x - this.x) > this.r + t.radius) continue;
        if (Math.abs(t.y - this.y) > 24 + this.r * 0.4) continue;
        if (this.z < t.z - 10 || this.z > t.z + t.height + 10) continue;
        this.hits.add(t);
        const ok = t.takeHit(this, this, this.facing);
        if (ok) {
          g.onHit(this.owner || this, t, this);
          if (!this.pierce) { this.remove = true; break; }
        }
      }
    }
    get dmgMul() { return 1; }
    draw(ctx, camX) {
      const x = this.x - camX, y = this.y - this.z;
      switch (this.kind) {
        case 'birdarang': {
          ctx.save(); ctx.translate(x, y); ctx.rotate(this.spin);
          ctx.fillStyle = '#2a2a33'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-16, -4); ctx.lineTo(0, -1); ctx.lineTo(16, -4); ctx.lineTo(4, 6); ctx.lineTo(0, 3); ctx.lineTo(-4, 6); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#f2c428'; ctx.fillRect(-2, -1, 4, 3);
          ctx.restore();
          break;
        }
        case 'starbolt': case 'bigbolt':
          TT.drawGlow(ctx, '#5dff8a', x, y, this.r * 2.4, 1);
          ctx.fillStyle = '#eaffef'; ctx.beginPath(); ctx.arc(x, y, this.r * 0.45, 0, Math.PI * 2); ctx.fill();
          break;
        case 'raven': {
          ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, 1);
          const f = Math.sin(this.t * 0.4) * 10;
          ctx.fillStyle = '#120a22'; ctx.strokeStyle = '#d6c2ff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(28, 0); ctx.lineTo(8, -8); ctx.lineTo(-12, -30 - f); ctx.lineTo(-8, -6); ctx.lineTo(-32, -4); ctx.lineTo(-10, 4); ctx.lineTo(-14, 26 + f); ctx.lineTo(8, 6); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(14, -2, 3, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          break;
        }
        case 'laser':
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = '#ff3030'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - this.vx * 3, y); ctx.lineTo(x, y); ctx.stroke();
          ctx.strokeStyle = '#ffd0d0'; ctx.lineWidth = 3; ctx.stroke();
          ctx.restore();
          break;
        case 'boulder':
          ctx.save(); ctx.translate(x, y); ctx.rotate(this.spin * 0.3);
          ctx.fillStyle = '#8e8880'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(-28, -8); ctx.lineTo(-12, -26); ctx.lineTo(16, -24); ctx.lineTo(30, -2); ctx.lineTo(18, 22); ctx.lineTo(-14, 24); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = '#6f6a63'; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(6, 4); ctx.stroke();
          ctx.restore();
          break;
        case 'missile': {
          ctx.save(); ctx.translate(x, y);
          ctx.fillStyle = '#d9dde6'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(8, 8); ctx.lineTo(8, -22); ctx.lineTo(-8, -22); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ff4a3a'; ctx.fillRect(-8, -16, 16, 6);
          TT.drawGlow(ctx, '#ffae3a', 0, -28, 16, 1);
          ctx.restore();
          break;
        }
        default: break;
      }
    }
    drawGround(ctx, camX) {
      // alvos marcados no chão (míssil/pedra)
      if (!this.explodeOnGround) return;
      const x = this.x - camX, k = Math.min(1, this.t / 30);
      if (this.kind === 'missile') {
        ctx.strokeStyle = 'rgba(255,50,50,' + (0.4 + 0.4 * ((this.t >> 2) % 2)) + ')'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x, this.y, this.explodeOnGround * k, this.explodeOnGround * 0.38 * k, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,50,50,0.15)'; ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(15,5,25,0.3)';
        ctx.beginPath(); ctx.ellipse(x, this.y, 30, 10, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  TT.Projectile = Projectile;

  // ================================================================ Efeitos com área de dano
  class Shockwave {
    constructor(game, x, y, maxR, dmg, team) {
      Object.assign(this, { game, x, y, maxR, dmg, team, r: 20, t: 0, remove: false, hits: new Set() });
    }
    update() {
      this.t++; this.r += 11;
      if (this.r > this.maxR) this.remove = true;
      const g = this.game;
      const targets = this.team === 'hero' ? g.enemies : [g.player];
      for (const t of targets) {
        if (!t || t.dead || t.ko || this.hits.has(t) || t.z > 8) continue;
        const dx = t.x - this.x, dy = (t.y - this.y) / 0.38;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(d - this.r) < 26) {
          this.hits.add(t);
          if (t.takeHit({ x: this.x, dmgMul: 1 }, { dmg: this.dmg, kb: 7, knockdown: true, launch: 7 })) g.onHit(null, t, { dmg: this.dmg, big: true });
        }
      }
      if (this.t % 2 === 0) {
        const a = Math.random() * Math.PI * 2;
        g.particles.spawn('debris', this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r * 0.38, { vy: -TT.rand(3, 7), vx: TT.rand(-1, 1), grav: 0.5, color: '#9a8f86', size: TT.rand(5, 9), life: 24, floor: this.y + Math.sin(a) * this.r * 0.38 });
      }
    }
    drawGround(ctx, camX) {
      const k = 1 - this.r / this.maxR, x = this.x - camX;
      ctx.strokeStyle = 'rgba(255,230,180,' + (0.8 * k) + ')'; ctx.lineWidth = 10 * k + 3;
      ctx.beginPath(); ctx.ellipse(x, this.y, this.r, this.r * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,80,40,' + (0.6 * k) + ')'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, this.y, this.r - 10, (this.r - 10) * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  TT.Shockwave = Shockwave;

  class RavenBlast {
    constructor(game, owner) {
      Object.assign(this, { game, owner, x: owner.x, y: owner.y, r: 10, t: 0, remove: false, hits: new Set(), maxR: 560 });
    }
    update() {
      this.t++; this.r += 26;
      if (this.t > 34) this.remove = true;
      const g = this.game;
      for (const e of g.enemies) {
        if (e.dead || this.hits.has(e)) continue;
        const dx = e.x - this.x, dy = (e.y - this.y) / 0.5;
        if (Math.sqrt(dx * dx + dy * dy) < Math.min(this.r, this.maxR)) {
          this.hits.add(e);
          const d = { dmg: 28, kb: 9, knockdown: true, launch: 10, big: true };
          if (e.takeHit(this.owner, d, TT.sign(dx))) g.onHit(this.owner, e, d);
        }
      }
    }
    drawGround(ctx, camX) {
      const r = Math.min(this.r, this.maxR), k = 1 - this.t / 34, x = this.x - camX;
      ctx.save();
      ctx.globalAlpha = 0.55 * k;
      ctx.fillStyle = '#12082a';
      ctx.beginPath(); ctx.ellipse(x, this.y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = k;
      ctx.strokeStyle = '#d6c2ff'; ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    }
    draw(ctx, camX) {
      // corvo de energia sobre o grupo
      const k = this.t / 34, x = this.x - camX, y = this.y - 150 - k * 60;
      ctx.save(); ctx.translate(x, y); ctx.scale(1 + k * 1.5, 1 + k * 1.5);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#120a22'; ctx.strokeStyle = '#e9dcff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-30, -40); ctx.lineTo(-80, -30); ctx.lineTo(-40, -6); ctx.lineTo(-60, 20); ctx.lineTo(-10, 10); ctx.lineTo(0, 30);
      ctx.lineTo(10, 10); ctx.lineTo(60, 20); ctx.lineTo(40, -6); ctx.lineTo(80, -30); ctx.lineTo(30, -40); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-6, -6, 3, 0, Math.PI * 2); ctx.arc(6, -6, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    get y2() { return this.y; }
  }
  TT.RavenBlast = RavenBlast;

  // ================================================================ Caixas e itens
  class Crate {
    constructor(game, x, y, drop) {
      Object.assign(this, { game, x, y, z: 0, drop, hp: 3, radius: 32, height: 70, flash: 0, remove: false, dead: false, team: 'prop', isProp: true, wob: 0 });
    }
    takeHit(src, d) {
      if (this.dead) return false;
      this.hp--; this.flash = 6; this.wob = 8;
      const g = this.game;
      g.debrisBurst(this.x, this.y - 35, 4, '#a5713e');
      if (this.hp <= 0) {
        this.dead = true; this.remove = true;
        g.debrisBurst(this.x, this.y - 35, 14, '#a5713e');
        A().play('break');
        if (this.drop) g.addPickup(new Pickup(g, this.x, this.y, this.drop));
      }
      return true;
    }
    update() { if (this.flash > 0) this.flash--; if (this.wob > 0) this.wob--; }
    drawShadow(ctx, camX) {
      ctx.fillStyle = 'rgba(15,5,25,0.38)';
      ctx.beginPath(); ctx.ellipse(this.x - camX, this.y, 40, 11, 0, 0, Math.PI * 2); ctx.fill();
    }
    draw(ctx, camX) {
      const x = this.x - camX + Math.sin(this.wob * 1.5) * 3, y = this.y;
      const fl = this.flash > 3;
      ctx.lineJoin = 'round';
      ctx.fillStyle = fl ? '#fff' : '#b77b42'; ctx.strokeStyle = OUT; ctx.lineWidth = 4;
      ctx.fillRect(x - 34, y - 66, 68, 64); ctx.strokeRect(x - 34, y - 66, 68, 64);
      if (!fl) {
        ctx.fillStyle = '#d99a5a'; ctx.fillRect(x - 30, y - 62, 60, 8);
        ctx.strokeStyle = '#7d4f26'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x - 30, y - 6); ctx.lineTo(x + 30, y - 62); ctx.stroke();
        ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(x - 30, y - 62, 60, 56);
        if (this.hp < 3) { ctx.strokeStyle = '#3a2412'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 10, y - 60); ctx.lineTo(x + 2, y - 40); ctx.lineTo(x + 12, y - 30); ctx.stroke(); }
      }
    }
  }
  TT.Crate = Crate;

  class Pickup {
    constructor(game, x, y, kind) {
      Object.assign(this, { game, x, y, z: 30, vz: 6, kind, t: 0, remove: false, life: 900 });
    }
    update() {
      const g = this.game;
      this.t++;
      if (this.z > 0 || this.vz > 0) { this.vz -= 0.6; this.z += this.vz; if (this.z < 0) { this.z = 0; this.vz = 0; } }
      if (--this.life <= 0) this.remove = true;
      const p = g.player;
      if (p && !p.ko && this.t > 15 && Math.abs(p.x - this.x) < 44 && Math.abs(p.y - this.y) < 26 && p.z < 30) {
        this.remove = true;
        A().play('pickup');
        if (this.kind === 'pizza') { p.hp = Math.min(p.maxHp, p.hp + 40); g.popText(p.x, p.y - 150, '+VIDA', '#ffe14a'); }
        else if (this.kind === 'energy') { g.energy = Math.min(100, g.energy + 35); g.popText(p.x, p.y - 150, '+ENERGIA', '#6fe3ff'); }
        g.score += 50;
      }
    }
    drawShadow(ctx, camX) {
      ctx.fillStyle = 'rgba(15,5,25,0.3)';
      ctx.beginPath(); ctx.ellipse(this.x - camX, this.y, 20, 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    draw(ctx, camX) {
      if (this.life < 120 && (this.life >> 3) % 2 === 0) return;
      const x = this.x - camX, y = this.y - this.z - 22 + Math.sin(this.t * 0.1) * 4;
      if (this.kind === 'pizza') {
        TT.drawGlow(ctx, '#ffd36a', x, y, 34, 0.6);
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(this.t * 0.05) * 0.2);
        ctx.beginPath(); ctx.moveTo(-18, -12); ctx.quadraticCurveTo(0, -20, 18, -12); ctx.lineTo(0, 20); ctx.closePath();
        ctx.fillStyle = '#ffcf5a'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#c9772a'; ctx.beginPath(); ctx.moveTo(-18, -12); ctx.quadraticCurveTo(0, -20, 18, -12); ctx.lineTo(16, -8); ctx.quadraticCurveTo(0, -15, -16, -8); ctx.fill();
        ctx.fillStyle = '#d6322e'; for (const [px, py] of [[-6, -4], [5, -2], [0, 8]]) { ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      } else {
        TT.drawGlow(ctx, '#6fe3ff', x, y, 36, 0.9);
        TT.drawBurst(ctx, x, y, 14, 5, '#bff4ff', OUT, this.t * 0.05);
      }
    }
  }
  TT.Pickup = Pickup;
})();
