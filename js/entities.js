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
            ctx.beginPath(); ctx.ellipse(x, y, p.size * (1.4 - k) * (p.sx || 1), p.size * (1.4 - k) * (p.flat || 1), 0, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1;
            break;
          case 'star':
            ctx.globalAlpha = Math.min(1, k * 2);
            TT.drawBurst(ctx, x, y, p.size, 4, p.color, null, p.rot);
            ctx.globalAlpha = 1;
            break;
          case 'cloud': {
            // nuvem cartoon da transformação do Mutano (cresce e encolhe, com contorno)
            const g = 1 - k, r = p.size * (0.45 + 0.75 * TT.easeOut(Math.min(1, g * 2.4))) * Math.min(1, k * 3.5);
            ctx.fillStyle = p.color; ctx.strokeStyle = p.color2 || OUT; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(x - r * 0.32, y - r * 0.32, r * 0.34, 0, Math.PI * 2); ctx.fill();
            break;
          }
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
      if (this.frozen > 0 && (--this.frozen === 0 || this.state !== 'hurt')) this.frozen = 0;
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
      // inimigos: brilho e piscada curtos antes de atacar
      const a = this.atk, sx = this.x - camX, sy = this.y - this.z;
      const tell = this.team === 'enemy' && a && this.state === 'attack' && a.t < a.def.s ? a.t / a.def.s : -1;
      const blink = tell > 0.55 && (a.t >> 1) % 2 === 0;
      TT.drawRig(ctx, this.style, this.pose, sx, sy, this.facing, { flash: this.flash > 3 || blink, t: this.animT });
      if (tell >= 0) TT.drawGlow(ctx, '#ff6a2a', sx + this.facing * 26, sy - 78, 16 + 22 * tell, 0.35 + 0.5 * tell);
      ctx.globalAlpha = 1;
      if (this.frozen > 0) drawIce(ctx, sx, sy, this.height, this.frozen);
    }
  }
  TT.Fighter = Fighter;

  // Bloco de gelo do disco congelante do Robin (k = quadros restantes; racha e some no fim).
  function drawIce(ctx, x, y, h, k) {
    const a = Math.min(1, k / 12), w = 34, top = y - Math.min(h, 140) - 10;
    ctx.save(); ctx.globalAlpha = 0.6 * a;
    ctx.beginPath(); ctx.moveTo(x - w, y + 4); ctx.lineTo(x - w - 6, top + 26); ctx.lineTo(x - w * 0.4, top); ctx.lineTo(x + w * 0.5, top + 8); ctx.lineTo(x + w + 6, top + 34); ctx.lineTo(x + w, y + 4); ctx.closePath();
    ctx.fillStyle = '#bfefff'; ctx.fill();
    ctx.globalAlpha = 0.95 * a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - w * 0.5, top + 20); ctx.lineTo(x - w * 0.2, top + 60); ctx.moveTo(x + w * 0.3, top + 30); ctx.lineTo(x + w * 0.6, top + 52); ctx.stroke();
    if (k < 20) { ctx.beginPath(); ctx.moveTo(x - 10, top + 10); ctx.lineTo(x + 4, top + 50); ctx.lineTo(x - 6, top + 80); ctx.stroke(); } // rachando
    ctx.restore();
  }

  // ================================================================ Titãs
  const GREEN = '#5dff8a', DARK = '#a77bff', SONIC = '#5fc2ff';
  // Rastros (smear) por pose: pivô (x à frente, y acima do pé), raio e ângulos (0 = à frente, + = para baixo).
  const SMEAR = {
    jab: { x: 10, y: 84, r: 70, line: true },
    cross: { x: 10, y: 84, r: 78, line: true },
    cast: { x: 10, y: 84, r: 84, line: true },
    flyKick: { x: 0, y: 52, r: 76, line: true },
    swing: { x: 6, y: 92, r: 104, a0: -2.2, a1: 0.9 },
    swipe: { x: 6, y: 86, r: 96, a0: -1.2, a1: 0.7 },
    claw: { x: 8, y: 84, r: 88, a0: -1.4, a1: 0.9 },
    uppercut: { x: 10, y: 80, r: 74, a0: 1.1, a1: -1.4 },
    castUp: { x: 8, y: 84, r: 90, a0: 1.0, a1: -1.5 },
    kick: { x: 0, y: 52, r: 78, a0: 0.9, a1: -0.4 },
    dive: { x: 0, y: 40, r: 70, a0: -0.4, a1: 1.0 },
    slam: { x: 10, y: 96, r: 96, a0: -1.6, a1: 0.8 },
    twirl: { x: 46, y: 96, r: 52, a0: -3.1, a1: 3.1 },
  };

  // Altura da mão da frente acima do chão, medida no último desenho (fallback se ainda não desenhou).
  function handZ(f, fb) {
    const R = f.rigOut;
    return R && R.fy != null ? TT.clamp(f.y - f.z - R.fy, 25, 140) : fb;
  }

  // vy = desvio lateral (dois tiros em leque); extra = campos que substituem os padrões (golpes novos).
  function spawnBolt(f, g, big, vy, extra) {
    // no chão sai da mão; no ar sai um pouco acima e desce na diagonal até a altura do peito dos inimigos
    const z0 = f.z > 0 ? f.z + Math.min(handZ(f, 62), 45) : handZ(f, 62);
    g.addProjectile(new Projectile(g, Object.assign({
      kind: big ? 'bigbolt' : 'starbolt', team: 'hero', owner: f,
      x: f.x + f.facing * 48, y: f.y, z: z0, vx: f.facing * (big ? 11 : 13), vy: vy || 0,
      r: big ? 24 : 14, dmg: big ? 17 : 8, kb: big ? 8 : 3, knockdown: big, launch: 6, life: 70, color: GREEN,
      vz: f.z > 0 ? -(z0 - 60) / 6 : 0, minZ: 55, trailN: big ? 9 : 6, // no ar: tiro diagonal para baixo
    }, extra)));
    A().play('starbolt');
  }

  // Golpes de cada Titã. anim = trilha de quadros-chave em js/anim.js; s = quadro do impacto, a = ativo, r = recuperação.
  const morphIn = (f, g, dy) => g.morph(f.x, f.y - (dy || 60));
  const TITANS = {
    robin: {
      name: 'Robin', hp: 120, speed: 4.7, jump: 15.5, color: '#d7262e', fx: '#ff5a3a',
      dashAtk: { anim: 'robinDashKick', smear: 'flyKick', s: 3, a: 12, r: 12, dmg: 11, reach: [0, 76], lunge: 11, knockdown: true, launch: 6, kb: 8, big: true, sound0: 'whoosh' },
      light: [
        { anim: 'robinJab', smear: 'jab', weapon: 'staff', s: 4, a: 3, r: 8, dmg: 6, reach: [0, 96], kb: 1.5, sound0: 'whoosh' },
        { anim: 'robinSwing', smear: 'swipe', weapon: 'staff', s: 5, a: 4, r: 9, dmg: 7, reach: [0, 106], kb: 2.5, sound0: 'whoosh' },
        {
          anim: 'robinSlam', smear: 'slam', weapon: 'staff', s: 9, a: 4, r: 14, dmg: 14, reach: [0, 118], kb: 7, knockdown: true, launch: 7, big: true, sound0: 'whoosh',
          onFrame(f, t, g) { if (t === this.s) { g.dust(f.x + f.facing * 80, f.y, 6, '#d9cbbb'); g.shake = Math.max(g.shake, 6); } },
        },
      ],
      heavy: { anim: 'robinKick', smear: 'kick', s: 7, a: 6, r: 11, dmg: 15, reach: [0, 84], knockdown: true, launch: 8, kb: 10, big: true, sound0: 'whoosh' },
      air: { anim: 'robinAir', smear: 'dive', s: 3, a: 14, r: 6, dmg: 9, reach: [-10, 64], kb: 3, lunge: 5, zr: 130 },
      special: {
        cost: 25, anim: 'robinThrow', s: 14, a: 1, r: 14, shout: 'Birdarangues!',
        onFrame(f, t, g) {
          if (t !== this.s) return;
          const hz = handZ(f, 70);
          for (const dy of [-34, 0, 34]) g.addProjectile(new Projectile(g, {
            kind: 'birdarang', team: 'hero', owner: f, x: f.x + f.facing * 40, y: f.y, z: f.z + hz,
            vx: f.facing * 14, vy: dy / 22, r: 14, dmg: 11, kb: 5, knockdown: true, launch: 5, life: 75, pierce: true, trailN: 7,
          }));
          A().play('birdarang');
        },
      },
    },
    starfire: {
      name: 'Estelar', hp: 105, speed: 4.6, jump: 16, floaty: true, color: '#f3a35a', fx: GREEN,
      dashAtk: { anim: 'sfDash', smear: 'jab', s: 3, a: 12, r: 12, dmg: 11, reach: [0, 80], lunge: 11, knockdown: true, launch: 6, kb: 8, big: true, sound0: 'whoosh' },
      light: [
        { anim: 'sfPunch', smear: 'jab', s: 4, a: 3, r: 8, dmg: 6, reach: [0, 72], kb: 1.5, sound0: 'whoosh' },
        { anim: 'sfCross', smear: 'cross', s: 4, a: 3, r: 9, dmg: 7, reach: [0, 76], kb: 2, sound0: 'whoosh' },
        { anim: 'sfBolt', hands: 'open', s: 8, a: 1, r: 13, onFrame(f, t, g) { if (t === this.s) spawnBolt(f, g, false); } },
      ],
      heavy: {
        anim: 'sfCharge', hands: 'open', s: 15, a: 1, r: 16,
        onFrame(f, t, g) {
          if (t === this.s) spawnBolt(f, g, true);
          if (t < this.s && t % 3 === 0) g.particles.spawn('glow', f.x + f.facing * 46 + TT.rand(-20, 20), f.y - f.z - 92 + TT.rand(-20, 20), { color: GREEN, size: 14, life: 10, vx: -f.facing * 1.5 });
        },
      },
      air: { anim: 'sfAir', hands: 'open', s: 5, a: 1, r: 12, onFrame(f, t, g) { if (t === this.s) spawnBolt(f, g, false); } },
      special: {
        anim: 'sfEyes', cost: 30, s: 14, a: 42, r: 14, dmg: 4, rehit: 6, reach: [20, 620], depth: 30, kb: 2, beam: 'eyes',
        shout: 'Raios oculares!', sound: 'laser', mouth: 'shout',
      },
    },
    cyborg: {
      name: 'Ciborgue', hp: 150, speed: 4.0, jump: 14, color: '#5f8fe0', fx: SONIC,
      dashAtk: { anim: 'cyTackle', smear: 'jab', s: 4, a: 12, r: 14, dmg: 13, reach: [0, 82], lunge: 10, knockdown: true, launch: 7, kb: 9, big: true, sound0: 'whoosh' },
      light: [
        {
          anim: 'cyPiston', smear: 'jab', s: 5, a: 3, r: 10, dmg: 8, reach: [0, 92], kb: 2, sound0: 'whoosh',
          onFrame(f, t, g) { if (t === this.s) g.particles.spawn('dust', f.x - f.facing * 6, f.y - f.z - 96, { color: 'rgba(230,240,255,0.8)', size: 7, vy: -1, life: 16 }); }, // vapor do pistão
        },
        {
          anim: 'cyHook', smear: 'swipe', s: 6, a: 4, r: 12, dmg: 9, reach: [0, 82], kb: 3, sound0: 'whoosh',
          onFrame(f, t, g) {
            if (t >= this.s && t < this.s + 3) for (let i = 0; i < 3; i++) g.particles.spawn('spark', f.x + f.facing * 60, f.y - f.z - 100, { vx: f.facing * TT.rand(2, 7), vy: TT.rand(-4, 2), color: '#9fd8ff', size: 3, life: 10 });
          },
        },
        {
          anim: 'cyBlast', form: 'cannon', s: 11, a: 4, r: 16, dmg: 14, reach: [10, 175], depth: 50, knockdown: true, launch: 8, kb: 10, big: true,
          onFrame(f, t, g) {
            if (t === 1) A().play('alarm');
            if (t === this.s) { // rajada sônica em cone à queima-roupa
              const mx = f.x + f.facing * 70 * f.style.scale, my = f.y - f.z - 98;
              for (let i = 0; i < 4; i++) g.particles.spawn('ring', mx + f.facing * i * 34, my, { color: i % 2 ? '#bfe6ff' : SONIC, size: 22 + i * 12, life: 12 + i * 3, sx: 0.4 });
              g.particles.spawn('glow', mx + f.facing * 40, my, { color: SONIC, size: 120, life: 12 });
              g.shake = Math.max(g.shake, 8); A().play('sonic');
            }
          },
        },
      ],
      heavy: {
        anim: 'cySlam', s: 15, a: 3, r: 18, dmg: 16, reach: [-70, 140], depth: 60, knockdown: true, launch: 7, kb: 8, big: true,
        onFrame(f, t, g) { if (t === this.s) { g.shake = 12; g.groundRing(f.x + f.facing * 60, f.y, '#cfd6e6'); A().play('shockwave'); } },
      },
      air: { anim: 'cyAir', smear: 'slam', s: 4, a: 12, r: 8, dmg: 10, reach: [-10, 70], kb: 3, zr: 130 },
      special: {
        anim: 'cyCannon', cost: 35, form: 'cannon', s: 20, a: 32, r: 16, dmg: 5, rehit: 5, reach: [30, 1300], depth: 38, kb: 3, beam: 'sonic',
        shout: 'BOOYAH!', shoutColor: '#5fc2ff', sound: 'sonic',
        onFrame(f, t, g) { if (t < this.s && t % 2 === 0 && f.rigOut) g.particles.spawn('glow', f.rigOut.fx + g.camX + f.facing * 14, f.rigOut.fy, { color: SONIC, size: 30 - t, life: 6 }); },
      },
    },
    raven: {
      name: 'Ravena', hp: 100, speed: 4.4, jump: 14.5, floaty: true, color: '#7b55c9', fx: '#b98cff',
      dashAtk: { anim: 'rvDash', hands: 'open', s: 3, a: 10, r: 12, dmg: 10, reach: [0, 100], lunge: 9, knockdown: true, launch: 6, kb: 7, claw: true, big: true, sound: 'dark' },
      light: [
        { anim: 'rvPalm', hands: 'open', s: 5, a: 4, r: 9, dmg: 6, reach: [0, 100], kb: 2, sound0: 'whoosh' },
        { anim: 'rvSweep', hands: 'open', s: 6, a: 4, r: 10, dmg: 7, reach: [0, 100], kb: 2.5, sound0: 'whoosh' },
        { anim: 'rvPortal', hands: 'open', s: 10, a: 4, r: 16, dmg: 12, reach: [0, 125], kb: 3, knockdown: true, launch: 11, big: true, sound: 'dark', claw: true },
      ],
      heavy: {
        anim: 'rvHeavy', hands: 'open', s: 11, a: 1, r: 18,
        onFrame(f, t, g) {
          if (t !== this.s) return;
          g.addProjectile(new Projectile(g, { kind: 'raven', team: 'hero', owner: f, x: f.x + f.facing * 50, y: f.y, z: f.z + handZ(f, 60), vx: f.facing * 9.5, r: 30, dmg: 14, kb: 7, knockdown: true, launch: 7, life: 85, pierce: true, trailN: 8 }));
          A().play('dark');
        },
      },
      air: { anim: 'rvAir', hands: 'open', s: 4, a: 8, r: 10, dmg: 8, reach: [0, 92], kb: 3, zr: 130, claw: true },
      special: {
        anim: 'rvSpecial', hands: 'open', cost: 40, s: 20, a: 1, r: 26, shout: 'Azarath Metrion Zinthos!', shoutColor: '#c8a8ff',
        onFrame(f, t, g) {
          if (t < this.s && t % 2 === 0) g.particles.spawn('feather', f.x + TT.rand(-60, 60), f.y - f.z - TT.rand(20, 140), { color: '#1a0f2e', size: 10, vy: -1.5, life: 30, vr: 0.1 });
          if (t === this.s) { g.addEffect(new RavenBlast(g, f)); A().play('dark'); g.shake = 14; }
        },
      },
    },
    beastboy: {
      name: 'Mutano', hp: 115, speed: 5.1, jump: 15.5, color: '#79c64c', fx: '#8dff5a',
      // investida de rinoceronte (ataque em corrida: esquiva + ataque)
      dashAtk: {
        form: 'rhino', pose: 'jab', s: 6, a: 18, r: 14, lunge: 12, dmg: 13, reach: [0, 120], depth: 42, knockdown: true, launch: 7, kb: 10, big: true,
        shout: 'Rinoceronte!', shoutColor: '#8fd463', sound0: 'roar',
        onFrame(f, t, g) {
          if (t === 1) morphIn(f, g, 50);
          if (t > this.s && t < this.s + this.a && t % 3 === 0) { g.dust(f.x - f.facing * 50, f.y, 2, '#c9b9a8'); g.shake = Math.max(g.shake, 3); }
          if (t === this.s + this.a + this.r - 1) g.morph(f.x, f.y - 50, true);
        },
      },
      light: [
        { anim: 'bbJab', smear: 'jab', s: 4, a: 3, r: 7, dmg: 6, reach: [0, 64], kb: 1.5, sound0: 'whoosh' },
        { anim: 'bbKick', smear: 'kick', s: 5, a: 4, r: 9, dmg: 7, reach: [0, 86], kb: 2, sound0: 'whoosh' },
        { anim: 'bbClaw', smear: 'claw', s: 7, a: 4, r: 15, dmg: 12, reach: [0, 100], kb: 6, knockdown: true, launch: 6, big: true, sound0: 'whoosh' },
      ],
      // fim do combo: vira um animal aleatório
      finishers: [
        {
          form: 'gorilla', s: 12, a: 4, r: 16, dmg: 14, reach: [0, 135], depth: 45, knockdown: true, launch: 8, kb: 9, big: true, shout: 'Gorila!', shoutColor: '#8fd463',
          onFrame(f, t, g) {
            if (t === 1) { morphIn(f, g); A().play('roar'); }
            if (t === this.s) { g.shake = 12; g.groundRing(f.x + f.facing * 105, f.y, '#8dff5a'); g.debrisBurst(f.x + f.facing * 105, f.y - 10, 6, '#8e8880'); }
            if (t === this.s + this.a + this.r - 1) g.morph(f.x, f.y - 60, true);
          },
        },
        {
          form: 'rhino', s: 5, a: 12, r: 10, lunge: 10, dmg: 13, reach: [0, 120], depth: 42, knockdown: true, launch: 7, kb: 10, big: true, shout: 'Rinoceronte!', shoutColor: '#8fd463', sound0: 'roar',
          onFrame(f, t, g) {
            if (t === 1) morphIn(f, g, 50);
            if (t > this.s && t % 3 === 0) g.dust(f.x - f.facing * 50, f.y, 2, '#c9b9a8');
            if (t === this.s + this.a + this.r - 1) g.morph(f.x, f.y - 50, true);
          },
        },
        {
          form: 'kangaroo', s: 8, a: 4, r: 14, dmg: 13, reach: [0, 120], depth: 40, knockdown: true, launch: 6, kb: 13, big: true, shout: 'Canguru!', shoutColor: '#8fd463',
          onFrame(f, t, g) {
            if (t === 1) { morphIn(f, g, 70); A().play('jump'); }
            if (t === this.s) g.particles.spawn('text', f.x + f.facing * 110, f.y - 130, { text: 'BOING!', size: 38, color: '#ffe14a', color2: '#4f9d2d', vy: -0.6, life: 34, rot: TT.rand(-0.2, 0.2) });
            if (t === this.s + this.a + this.r - 1) g.morph(f.x, f.y - 70, true);
          },
        },
        {
          form: 'ram', s: 9, a: 6, r: 12, lunge: 8, dmg: 13, reach: [0, 108], depth: 40, knockdown: true, launch: 9, kb: 9, big: true, shout: 'Carneiro!', shoutColor: '#8fd463',
          onFrame(f, t, g) {
            if (t === 1) morphIn(f, g, 50);
            if (t === this.s) A().play('hitHeavy');
            if (t === this.s + this.a + this.r - 1) g.morph(f.x, f.y - 50, true);
          },
        },
      ],
      heavy: {
        form: 'gorilla', pose: 'slam', s: 16, a: 5, r: 16, dmg: 20, reach: [0, 140], depth: 45, knockdown: true, launch: 8, kb: 9, big: true,
        onFrame(f, t, g) {
          if (t === 1) { morphIn(f, g); A().play('roar'); }
          if (t === this.s) {
            g.shake = 14; g.groundRing(f.x + f.facing * 110, f.y, '#8dff5a');
            g.debrisBurst(f.x + f.facing * 110, f.y - 10, 8, '#8e8880');
            g.particles.spawn('text', f.x + f.facing * 110, f.y - 150, { text: 'BLAM!', size: 42, color: '#ffe14a', color2: '#4f9d2d', vy: -0.6, life: 36, rot: TT.rand(-0.2, 0.2) });
          }
          if (t === this.s + this.a + this.r - 1) g.morph(f.x, f.y - 60, true);
        },
      },
      air: { pose: 'kick', s: 3, a: 12, r: 8, dmg: 9, reach: [0, 82], kb: 3, zr: 130 },
      special: {
        cost: 35, form: 'trex', pose: 'jab', s: 12, a: 46, r: 12, lunge: 7, dmg: 10, rehit: 10, reach: [0, 180], depth: 55, knockdown: true, launch: 7, kb: 10,
        shout: 'RAAAWR!', shoutColor: '#8fd463', sound0: 'roar',
        onFrame(f, t, g) {
          if (t === 1) morphIn(f, g, 70);
          if (t > this.s && t % 6 === 0) { g.dust(f.x - f.facing * 40, f.y, 3, '#c9b9a8'); g.shake = Math.max(g.shake, 4); }
          if (t === this.s + this.a + this.r - 1) g.morph(f.x, f.y - 70, true);
        },
      },
    },
  };
  TT.TITANS = TITANS;
  TT.TITAN_ORDER = ['robin', 'beastboy', 'cyborg', 'raven', 'starfire'];

  // ---------------------------------------------------------------- Golpes novos (a partir da fase 7)
  // Os Titãs liberam os golpes mais fortes da série: mais dano e ataques novos.
  const ICE = '#9fe8ff', FIRE = '#ff7a1a';
  const boost = (d, k, o) => Object.assign({}, d, { dmg: d.dmg ? Math.round(d.dmg * k) : d.dmg }, o);
  // Projétil de herói que explode ao acertar (ou no fim do alcance): blastR/blastDmg.
  const heroShot = (f, g, o) => g.addProjectile(new Projectile(g, Object.assign({ team: 'hero', owner: f, x: f.x + f.facing * 44, y: f.y, life: 70 }, o)));
  // Starbolt que cai do céu num ponto do chão e explode.
  function fallingBolt(f, g, x, y, delay) {
    const T = 16;
    g.addProjectile(new Projectile(g, {
      kind: 'starbolt', team: 'hero', owner: f, x: x - f.facing * 90, y, z: 420 + delay * 6, vx: f.facing * 90 / T, vz: -(420 + delay * 6) / T,
      r: 16, dmg: 0, blastDmg: 16, explodeOnGround: 78, blastColor: GREEN, life: 60, trailN: 8,
    }));
  }
  const PLUS = {
    robin: {
      dashAtk: boost(TITANS.robin.dashAtk, 1.45),
      light: [
        boost(TITANS.robin.light[0], 1.5),
        boost(TITANS.robin.light[1], 1.45),
        { // bastão elétrico: a pancada solta uma descarga no chão
          anim: 'robinSlam', smear: 'slam', weapon: 'staff', s: 9, a: 4, r: 14, dmg: 21, reach: [0, 130], depth: 40, kb: 8, knockdown: true, launch: 8, big: true, sound0: 'whoosh', sound: 'zap',
          onFrame(f, t, g) {
            if (t !== this.s) return;
            const x = f.x + f.facing * 86;
            g.groundRing(x, f.y, ICE); g.shake = Math.max(g.shake, 9);
            for (let i = 0; i < 4; i++) g.particles.spawn('spark', x + TT.rand(-30, 30), f.y - TT.rand(10, 70), { vx: TT.rand(-6, 6), vy: TT.rand(-7, -1), color: TT.choice([ICE, '#ffffff']), size: 4, life: 14 });
            g.particles.spawn('text', x, f.y - 150, { text: 'ZZAP!', size: 38, color: '#e0f8ff', color2: '#2a7bff', vy: -0.6, life: 32, rot: TT.rand(-0.2, 0.2) });
          },
        },
      ],
      // disco congelante: atravessa a fila e congela os inimigos no lugar
      heavy: {
        anim: 'robinThrow', s: 14, a: 1, r: 16, shout: 'Disco congelante!', shoutColor: ICE,
        onFrame(f, t, g) {
          if (t !== this.s) return;
          heroShot(f, g, { kind: 'icedisk', x: f.x + f.facing * 40, z: f.z + handZ(f, 70), vx: f.facing * 13, r: 18, dmg: 17, kb: 1, stun: 85, freeze: true, pierce: true, life: 80, trailN: 8 });
          A().play('birdarang');
        },
      },
      air: boost(TITANS.robin.air, 1.45),
      // discos explosivos: três discos que explodem no primeiro inimigo que tocam
      special: {
        cost: 25, anim: 'robinThrow', s: 14, a: 1, r: 14, shout: 'Discos explosivos!',
        onFrame(f, t, g) {
          if (t !== this.s) return;
          const hz = handZ(f, 70);
          for (const dy of [-40, 0, 40]) heroShot(f, g, { kind: 'bombdisk', x: f.x + f.facing * 40, z: f.z + hz, vx: f.facing * 13, vy: dy / 22, r: 15, dmg: 12, kb: 5, knockdown: true, launch: 6, blastR: 90, blastDmg: 12, blastEnd: true, life: 60, trailN: 7 });
          A().play('birdarang');
        },
      },
    },
    starfire: {
      dashAtk: boost(TITANS.starfire.dashAtk, 1.45),
      light: [
        boost(TITANS.starfire.light[0], 1.5),
        boost(TITANS.starfire.light[1], 1.45),
        // dois starbolts de uma vez (um de cada mão)
        { anim: 'sfBolt', hands: 'open', s: 8, a: 1, r: 13, onFrame(f, t, g) { if (t === this.s) { spawnBolt(f, g, false, -1.2, { dmg: 10 }); spawnBolt(f, g, false, 1.2, { dmg: 10 }); } } },
      ],
      // starbolt gigante: explode no impacto
      heavy: {
        anim: 'sfCharge', hands: 'open', s: 15, a: 1, r: 16, shout: 'Starbolt gigante!', shoutColor: GREEN,
        onFrame(f, t, g) {
          if (t === this.s) spawnBolt(f, g, true, 0, { r: 32, dmg: 24, blastR: 110, blastDmg: 14, blastColor: GREEN });
          if (t < this.s && t % 2 === 0) g.particles.spawn('glow', f.x + f.facing * 46 + TT.rand(-26, 26), f.y - f.z - 92 + TT.rand(-26, 26), { color: GREEN, size: 18, life: 10, vx: -f.facing * 1.5 });
        },
      },
      air: { anim: 'sfAir', hands: 'open', s: 5, a: 1, r: 12, onFrame(f, t, g) { if (t === this.s) { spawnBolt(f, g, false, -1, { dmg: 10 }); spawnBolt(f, g, false, 1, { dmg: 10 }); } } },
      // chuva de starbolts: sobe e faz chover estrelas em cima de cada inimigo da tela
      special: {
        anim: 'sfRain', hands: 'open', cost: 30, s: 16, a: 30, r: 16, shout: 'Chuva de starbolts!', shoutColor: GREEN, sound0: 'super',
        onFrame(f, t, g) {
          if (t < this.s || t >= this.s + this.a || (t - this.s) % 3 !== 0) return;
          const k = (t - this.s) / 3, foes = g.enemies.filter((e) => !e.dead && Math.abs(e.x - g.camX - TT.W / 2) < TT.W / 2 + 20);
          let x, y;
          if (foes.length && k % 2 === 0) { const e = foes[(k / 2) % foes.length]; x = e.x + TT.rand(-20, 20); y = e.y + TT.rand(-8, 8); }
          else { x = f.x + f.facing * TT.rand(80, 620); y = TT.clamp(f.y + TT.rand(-90, 90), TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM - 4); }
          fallingBolt(f, g, x, y, k % 3);
          A().play('starbolt');
        },
      },
    },
    cyborg: {
      dashAtk: boost(TITANS.cyborg.dashAtk, 1.4),
      light: [
        boost(TITANS.cyborg.light[0], 1.4),
        boost(TITANS.cyborg.light[1], 1.35),
        boost(TITANS.cyborg.light[2], 1.45, { reach: [10, 200], depth: 56 }),
      ],
      // mísseis do ombro: três mísseis que explodem no impacto
      heavy: {
        anim: 'cyMissiles', s: 12, a: 12, r: 14, shout: 'Mísseis!', shoutColor: SONIC,
        onFrame(f, t, g) {
          if (t < this.s || (t - this.s) % 5 !== 0 || t > this.s + 10) return;
          const i = (t - this.s) / 5;
          heroShot(f, g, { kind: 'heroMissile', x: f.x - f.facing * 6, z: f.z + 150, vx: f.facing * 6, vz: 5 - i * 2.5, grav: 0.32, vy: (i - 1) * 0.9,
            r: 16, dmg: 7, kb: 4, blastR: 85, blastDmg: 8, blastEnd: true, homing: true, minZ: 40, life: 70, trailN: 8 });
          A().play('whoosh');
        },
      },
      air: boost(TITANS.cyborg.air, 1.4),
      // canhão sônico no máximo: feixe mais largo e mais forte
      special: boost(TITANS.cyborg.special, 1.6, { wide: 1.6, depth: 52, shout: 'BOOYAH! Potência máxima!' }),
    },
    raven: {
      dashAtk: boost(TITANS.raven.dashAtk, 1.4),
      light: [boost(TITANS.raven.light[0], 1.5), boost(TITANS.raven.light[1], 1.45), boost(TITANS.raven.light[2], 1.4)],
      // telecinese: arranca um pedaço do chão envolto em energia negra e arremessa
      heavy: {
        anim: 'rvHeavy', hands: 'open', s: 11, a: 1, r: 18, shout: 'Telecinese!', shoutColor: '#c8a8ff',
        onFrame(f, t, g) {
          if (t === 2) g.debrisBurst(f.x + f.facing * 40, f.y - 10, 5, '#5a5060');
          if (t !== this.s) return;
          heroShot(f, g, { kind: 'tkRock', x: f.x + f.facing * 50, z: f.z + handZ(f, 70) + 20, vx: f.facing * 10.5, r: 32, dmg: 22, kb: 8, knockdown: true, launch: 8, blastR: 95, blastDmg: 10, blastColor: DARK, life: 80, trailN: 8 });
          A().play('dark');
        },
      },
      air: boost(TITANS.raven.air, 1.4),
      // "Azarath Metrion Zinthos!": tentáculos de sombra saem do chão embaixo de todos os inimigos
      special: {
        anim: 'rvSpecial', hands: 'open', cost: 40, s: 20, a: 1, r: 26, shout: 'Azarath Metrion Zinthos!', shoutColor: '#c8a8ff',
        onFrame(f, t, g) {
          if (t < this.s && t % 2 === 0) g.particles.spawn('feather', f.x + TT.rand(-60, 60), f.y - f.z - TT.rand(20, 140), { color: '#1a0f2e', size: 10, vy: -1.5, life: 30, vr: 0.1 });
          if (t === this.s) { g.addEffect(new ShadowTendrils(g, f)); A().play('dark'); g.shake = 12; }
        },
      },
    },
    beastboy: {
      dashAtk: boost(TITANS.beastboy.dashAtk, 1.4),
      light: [boost(TITANS.beastboy.light[0], 1.5), boost(TITANS.beastboy.light[1], 1.45), boost(TITANS.beastboy.light[2], 1.4)],
      finishers: TITANS.beastboy.finishers.map((d) => boost(d, 1.45)),
      // elefante: fica de pé nas patas de trás e pisa com tudo (onda no chão)
      heavy: {
        form: 'elephant', pose: 'slam', s: 18, a: 5, r: 18, dmg: 28, reach: [-60, 190], depth: 70, knockdown: true, launch: 9, kb: 10, big: true, shout: 'Elefante!', shoutColor: '#8fd463',
        onFrame(f, t, g) {
          if (t === 1) { morphIn(f, g, 70); A().play('roar'); }
          if (t === this.s) {
            const x = f.x + f.facing * 90;
            g.shake = 16; g.groundRing(x, f.y, '#8dff5a'); g.particles.spawn('ring', x, f.y, { size: 210, color: '#d6ffc0', life: 20, flat: 0.35 });
            g.debrisBurst(x, f.y - 10, 10, '#8e8880'); A().play('shockwave');
            g.particles.spawn('text', x, f.y - 170, { text: 'TROMP!', size: 44, color: '#ffe14a', color2: '#4f9d2d', vy: -0.6, life: 36, rot: TT.rand(-0.2, 0.2) });
          }
          if (t === this.s + this.a + this.r - 1) g.morph(f.x, f.y - 70, true);
        },
      },
      air: boost(TITANS.beastboy.air, 1.45),
      // A Fera (episódio "A Fera Interior"): avança dando uma sequência de garradas
      special: {
        cost: 35, form: 'beast', pose: 'claw', s: 12, a: 44, r: 14, lunge: 2.4, dmg: 14, rehit: 8, reach: [0, 160], depth: 58, kb: 3, stun: 22, big: true, // atordoa a cada garrada (todas acertam)
        shout: 'GRRRAAAAH!', shoutColor: '#8fd463', sound0: 'roar',
        onFrame(f, t, g) {
          if (t === 1) morphIn(f, g, 80);
          if (t >= this.s && t < this.s + this.a && (t - this.s) % 8 === 0) {
            A().play('whoosh');
            g.particles.spawn('text', f.x + f.facing * 120, f.y - 160 + TT.rand(-20, 20), { text: TT.choice(['SLASH!', 'RAAR!', 'SHRAK!']), size: 32, color: '#d6ffc0', color2: '#2b6418', vy: -0.6, life: 24, rot: TT.rand(-0.3, 0.3) });
          }
          if (t === this.s + this.a + this.r - 1) g.morph(f.x, f.y - 80, true);
        },
      },
    },
  };
  // Definição completa de cada Titã com os golpes novos (o resto — vida, velocidade, cores — é igual).
  TT.TITANS_PLUS = {};
  for (const k in TITANS) TT.TITANS_PLUS[k] = Object.assign({}, TITANS[k], PLUS[k], { plus: true });

  // ---------------------------------------------------------------- Combos novos (a partir da fase 8)
  // Mantém os golpes novos e acrescenta: combo de 5 golpes (J J J J J) e o COMBO FINAL (J J + K), um
  // golpe próprio de cada Titã com efeitos elaborados. O 3º e o 4º golpe não derrubam, para o combo
  // inteiro entrar; o 5º é o finalizador da fase 7.
  const P = TT.TITANS_PLUS;
  // Junta um efeito extra ao onFrame de um golpe existente.
  const withFx = (d, k, fx) => { const b = boost(d, k), orig = d.onFrame; b.onFrame = function (f, t, g, a) { if (orig) orig.call(this, f, t, g, a); fx.call(this, f, t, g, a); }; return b; };
  // Nome do combo final na tela (e um anel na cor do Titã).
  const comboName = (f, g, text) => { g.comboTag = { text, col: f.def.color, fx: f.def.fx || f.def.color, t: 0 }; g.particles.spawn('ring', f.x, f.y - f.z - 80, { color: f.def.fx || f.def.color, size: 140, life: 18 }); };
  // Faíscas em estrela na mão da frente (golpes de energia).
  const fistBurst = (f, g, col, n) => {
    const R = f.rigOut, x = R && R.fx != null ? R.fx + g.camX : f.x + f.facing * 60, y = R && R.fy != null ? R.fy : f.y - f.z - 100;
    for (let i = 0; i < (n || 8); i++) { const ang = Math.random() * Math.PI * 2, sp = TT.rand(3, 9); g.particles.spawn('star', x, y, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, color: TT.choice([col, '#ffffff']), size: TT.rand(6, 11), life: TT.randi(12, 20), rot: Math.random(), vr: 0.2 }); }
    g.particles.spawn('glow', x, y, { color: col, size: 90, life: 10 });
    g.particles.spawn('ring', x, y, { color: '#ffffff', size: 60, life: 10 });
  };
  const COMBO = {
    robin: {
      light: [P.robin.light[0], P.robin.light[1],
        { pose: 'uppercut', weapon: 'staff', smear: 'slam', s: 5, a: 4, r: 9, dmg: 11, reach: [0, 108], kb: 2, stun: 24, sound0: 'whoosh',
          onFrame(f, t, g) { if (t === this.s) { g.afterimage(f, '#ff5a3a'); fistBurst(f, g, '#ffd23a', 6); } } },
        // chute giratório: Robin gira (acerta dos dois lados) e deixa imagens vermelhas para trás
        { pose: 'kick', smear: 'kick', s: 4, a: 10, r: 10, dmg: 4, rehit: 3, reach: [-40, 112], depth: 40, kb: 1, stun: 22, sound0: 'whoosh',
          onFrame(f, t, g) {
            // o giro é visual: as imagens alternam de lado (o Robin não vira de verdade, para o 5º golpe sair para a frente)
            if (t >= this.s && t < this.s + this.a && t % 2 === 0) g.afterimage(f, '#ff5a3a', (t >> 1) % 2 === 0);
            if (t === this.s + 4) g.particles.spawn('text', f.x, f.y - 170, { text: 'TCHÁ!', size: 34, color: '#ffe14a', color2: '#d7262e', vy: -0.6, life: 24, rot: TT.rand(-0.2, 0.2) });
          } },
        withFx(P.robin.light[2], 1.1, (f, t, g) => { if (t === 2) g.afterimage(f, '#ff5a3a'); }),
      ],
      // GOLPE RELÂMPAGO: atravessa a fila de inimigos num risco vermelho; um instante depois todos os
      // atravessados explodem em faíscas com o "R" do Robin
      ender: { name: 'GOLPE RELÂMPAGO', pose: 'jab', weapon: 'staff', smear: 'jab', s: 7, a: 12, r: 18, dmg: 6, rehit: 4, reach: [-60, 110], depth: 54, kb: 0, stun: 46, lunge: 32, big: true, sound0: 'whoosh',
        onFrame(f, t, g, a) {
          if (t === 1) { comboName(f, g, this.name); a.x0 = f.x; a.marked = new Set(); f.invul = Math.max(f.invul, 34); }
          if (t < this.s) g.particles.spawn('glow', f.x + TT.rand(-20, 20), f.y - 80 + TT.rand(-30, 30), { color: '#ff5a3a', size: 30, life: 8 });
          if (t >= this.s && t < this.s + this.a) { g.afterimage(f, '#ff5a3a'); for (const e of a.hits) a.marked.add(e); }
          if (t === this.s + this.a) { for (const e of a.hits) a.marked.add(e); g.addEffect(new SlashLine(g, a.x0, f.x, f.y, '#ff5a3a')); A().play('birdarang'); }
          if (t === this.s + this.a + 6) g.addEffect(new DelayedBursts(g, f, [...a.marked], { dmg: 24, col: '#ff5a3a', word: 'SHING!', emblem: 'R' }));
        } },
    },
    starfire: {
      light: [P.starfire.light[0], P.starfire.light[1],
        { pose: 'uppercut', hands: 'open', smear: 'slam', s: 5, a: 4, r: 9, dmg: 11, reach: [0, 84], kb: 2, stun: 24, sound0: 'whoosh', glow: GREEN,
          onFrame(f, t, g) { if (t === this.s) fistBurst(f, g, GREEN, 10); } },
        // giro de energia: dois anéis verdes em órbita acertam os dois lados
        { pose: 'spin', hands: 'open', s: 4, a: 10, r: 10, dmg: 4, rehit: 3, reach: [-60, 100], depth: 44, kb: 1, stun: 22, sound0: 'whoosh', glow: GREEN,
          onFrame(f, t, g) {
            if (t >= this.s && t < this.s + this.a) {
              const ang = t * 0.9;
              for (const s of [0, Math.PI]) g.particles.spawn('glow', f.x + Math.cos(ang + s) * 70, f.y - f.z - 90 + Math.sin(ang + s) * 22, { color: GREEN, size: 34, life: 8 });
              if (t % 2 === 0) g.afterimage(f, GREEN);
            }
          } },
        // espiral de starbolts: seis estrelas saem girando em leque
        { anim: 'sfCharge', hands: 'open', s: 12, a: 1, r: 14,
          onFrame(f, t, g) {
            if (t < this.s && t % 2 === 0) g.particles.spawn('glow', f.x + f.facing * 46 + TT.rand(-24, 24), f.y - f.z - 92 + TT.rand(-24, 24), { color: GREEN, size: 18, life: 10, vx: -f.facing * 1.5 });
            if (t === this.s) {
              for (let i = 0; i < 6; i++) spawnBolt(f, g, false, (i - 2.5) * 0.9, { dmg: 6, kb: 5, knockdown: true, launch: 5, vx: f.facing * (11 + (i % 3) * 1.5) });
              fistBurst(f, g, GREEN, 12);
            }
          } },
      ],
      // SUPERNOVA: a raiva tamaraneana — ela brilha, os olhos acendem e uma onda verde explode em volta
      ender: { name: 'SUPERNOVA', pose: 'castUp', hands: 'open', s: 20, a: 1, r: 24, sound0: 'super', glow: GREEN, mouth: 'shout',
        onFrame(f, t, g) {
          if (t === 1) { comboName(f, g, this.name); f.vz = Math.max(f.vz, 4); f.z = Math.max(f.z, 1); }
          if (t < this.s) {
            const ang = Math.random() * Math.PI * 2, R = 160 * (1 - t / this.s) + 30;
            g.particles.spawn('star', f.x + Math.cos(ang) * R, f.y - f.z - 90 + Math.sin(ang) * R * 0.6, { vx: -Math.cos(ang) * 6, vy: -Math.sin(ang) * 4, color: TT.choice([GREEN, '#ffffff']), size: 9, life: 12, rot: Math.random() });
          }
          if (t === this.s) { g.addEffect(new Nova(g, f, { x: f.x, y: f.y, r: 300, dmg: 36, col: GREEN, word: 'SUPERNOVA!' })); g.tintScreen(GREEN, 18); A().play('boom'); }
        } },
    },
    cyborg: {
      light: [P.cyborg.light[0], P.cyborg.light[1],
        { anim: 'cyHook', smear: 'swipe', s: 6, a: 4, r: 10, dmg: 12, reach: [0, 88], kb: 2, stun: 24, sound0: 'whoosh',
          onFrame(f, t, g) { if (t >= this.s && t < this.s + 3) for (let i = 0; i < 4; i++) g.particles.spawn('spark', f.x + f.facing * 60, f.y - f.z - 100, { vx: f.facing * TT.rand(2, 8), vy: TT.rand(-5, 2), color: TT.choice(['#9fd8ff', '#ffffff']), size: 4, life: 12 }); } },
        // punho-foguete: o punho sai voando com chamas e atravessa a fila
        { anim: 'cyPiston', s: 6, a: 1, r: 14, sound0: 'alarm',
          onFrame(f, t, g) {
            if (t !== this.s) return;
            heroShot(f, g, { kind: 'rocketFist', z: f.z + handZ(f, 92), vx: f.facing * 15, r: 22, dmg: 13, kb: 3, stun: 24, pierce: true, life: 30, trailN: 10 });
            g.particles.spawn('glow', f.x + f.facing * 60, f.y - f.z - 96, { color: '#ff9a3a', size: 70, life: 10 });
            A().play('whoosh');
          } },
        withFx(P.cyborg.light[2], 1.1, () => {}),
      ],
      // RAJADA BOOYAH: os dois canhões alternam tiros sônicos e terminam numa explosão sônica azul
      ender: { name: 'RAJADA BOOYAH', anim: 'cyCannon', form: 'cannon', s: 10, a: 30, r: 16, sound0: 'alarm', mouth: 'shout',
        onFrame(f, t, g) {
          if (t === 1) comboName(f, g, this.name);
          if (t >= this.s && t < this.s + this.a - 6 && (t - this.s) % 4 === 0) {
            const k = (t - this.s) / 4;
            heroShot(f, g, { kind: 'sonicShot', z: f.z + handZ(f, 92) + (k % 2 ? 22 : -10), vx: f.facing * 17, vy: (k % 3 - 1) * 0.6, r: 16, dmg: 5, kb: 1.5, stun: 18, life: 40, trailN: 6 });
            A().play('laser');
          }
          if (t === this.s + this.a - 4) {
            g.addEffect(new Nova(g, f, { x: f.x + f.facing * 200, y: f.y, r: 190, dmg: 22, col: SONIC, word: 'BOOYAH!' }));
            g.tintScreen(SONIC, 12); A().play('sonic');
          }
        } },
    },
    raven: {
      light: [P.raven.light[0], P.raven.light[1],
        { anim: 'rvSweep', hands: 'open', s: 6, a: 4, r: 10, dmg: 11, reach: [0, 104], kb: 2, stun: 24, sound0: 'whoosh', claw: true },
        // mãos de sombra: duas mãos de energia negra sobem do chão à frente e agarram
        { anim: 'rvPalm', hands: 'open', s: 7, a: 9, r: 12, dmg: 5, rehit: 4, reach: [40, 200], depth: 46, kb: 0.5, stun: 24, sound: 'dark',
          onFrame(f, t, g) { if (t === this.s) g.addEffect(new ShadowHands(g, f.x + f.facing * 125, f.y, f.facing)); } },
        withFx(P.raven.light[2], 1.1, () => {}),
      ],
      // ESFERAS DE AZARATH: cada inimigo à frente é preso numa esfera de energia negra, erguido e esmagado
      ender: { name: 'ESFERAS DE AZARATH', anim: 'rvSpecial', hands: 'open', s: 14, a: 1, r: 28, sound0: 'dark', mouth: 'shout',
        onFrame(f, t, g) {
          if (t === 1) comboName(f, g, this.name);
          if (t < this.s && t % 2 === 0) g.particles.spawn('feather', f.x + TT.rand(-50, 50), f.y - f.z - TT.rand(30, 140), { color: '#1a0f2e', size: 10, vy: -1.5, life: 26, vr: 0.1 });
          if (t === this.s) { g.addEffect(new DarkOrbs(g, f, { range: 460, dmg: 30 })); g.tintScreen('#5a2a9a', 14); }
        } },
    },
    beastboy: {
      light: [P.beastboy.light[0], P.beastboy.light[1],
        { anim: 'bbClaw', smear: 'claw', s: 6, a: 4, r: 10, dmg: 11, reach: [0, 96], kb: 2, stun: 24, sound0: 'whoosh' },
        // guepardo: avança dando arranhões rápidos
        { form: 'cheetahAtk', pose: 'jab', s: 5, a: 12, r: 10, lunge: 3, dmg: 4, rehit: 4, reach: [0, 112], depth: 44, kb: 1, stun: 22, sound0: 'whoosh',
          onFrame(f, t, g) {
            if (t === 1) morphIn(f, g, 40);
            if (t >= this.s && t < this.s + this.a && (t - this.s) % 4 === 0) {
              g.particles.spawn('text', f.x + f.facing * 110, f.y - 120 + TT.rand(-20, 20), { text: TT.choice(['SWIPE!', 'SHRAK!']), size: 26, color: '#d6ffc0', color2: '#2b6418', vy: -0.6, life: 18, rot: TT.rand(-0.3, 0.3) });
              g.afterimage(f, '#8dff5a');
            }
            if (t === this.s + this.a + this.r - 1) g.morph(f.x, f.y - 40, true);
          } },
        P.beastboy.light[2],
      ],
      finishers: P.beastboy.finishers.map((d) => boost(d, 1.1)),
      // ESTOURO DA MANADA: rinoceronte em investida → gorila esmurrando o chão → T-Rex rugindo (onda de choque)
      ender: { name: 'ESTOURO DA MANADA', pose: 'jab', s: 6, a: 46, r: 12, dmg: 8, rehit: 8, reach: [0, 170], depth: 58, kb: 2, stun: 26, big: true, sound0: 'roar',
        formAt(t) {
          if (t < 22) return { form: 'rhino', t: t + 3, s: 4, end: 24 };
          if (t < 38) return { form: 'gorilla', t: t - 20, s: 10, end: 14 };
          return { form: 'trex', t: t - 36, s: 6, end: 40 };
        },
        onFrame(f, t, g) {
          if (t === 1) { comboName(f, g, this.name); morphIn(f, g, 60); }
          if (t > this.s && t < 22) { f.vx = f.facing * 9; if (t % 3 === 0) { g.dust(f.x - f.facing * 50, f.y, 2, '#c9b9a8'); g.shake = Math.max(g.shake, 3); } }
          if (t === 22 || t === 38) { g.morph(f.x, f.y - 70); A().play('roar'); }
          if (t === 30) { g.shake = 14; g.groundRing(f.x + f.facing * 110, f.y, '#8dff5a'); g.debrisBurst(f.x + f.facing * 110, f.y - 10, 10, '#8e8880'); g.particles.spawn('text', f.x + f.facing * 110, f.y - 170, { text: 'BLAM!', size: 44, color: '#ffe14a', color2: '#4f9d2d', vy: -0.6, life: 30 }); }
          if (t === 44) { g.addEffect(new Nova(g, f, { x: f.x + f.facing * 60, y: f.y, r: 280, dmg: 22, col: '#8dff5a', word: 'ROOOAR!' })); g.tintScreen('#4f9d2d', 12); }
          if (t === this.s + this.a + this.r - 1) g.morph(f.x, f.y - 70, true);
        } },
    },
  };
  TT.TITANS_COMBO = {};
  for (const k in TITANS) TT.TITANS_COMBO[k] = Object.assign({}, P[k], COMBO[k], { combos: true });
  TT.TITAN_POWERS = [TITANS, TT.TITANS_PLUS, TT.TITANS_COMBO];

  const BUFFERED = ['light', 'heavy', 'special', 'jump', 'dash'];
  // Formas animais do Mutano: nome da função de desenho em render.js.
  const FORMS = { gorilla: 'drawGorilla', trex: 'drawTRex', rhino: 'drawRhino', kangaroo: 'drawKangaroo', ram: 'drawRam', elephant: 'drawElephant', beast: 'drawBeast', cheetahAtk: 'drawCheetahAtk' };

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
      const st = this.style; // altura do modelo (para acertos no ar e balões de fala)
      this.height = Math.round((st.legL[0] + st.legL[1] + st.torsoH + st.neck + st.headR * 1.9) * st.scale);
      this.rigOut = {};
      this.jumpT = 0;
      this.combo = 0; this.comboWindow = 0;
      this.buffer = null; this.bufferT = 0;
      this.ko = false;
      this.airAttacked = false;
      this.downTime = 34;
      this.dmgMul = 1;
      if (this.def.floaty) this.grav = TT.GRAVITY * 0.72;
    }

    // Nível de poder: 0 = golpes originais, 1 = golpes novos (fase 7), 2 = golpes novos + combos (fase 8).
    setPower(lv) { this.def = TT.TITAN_POWERS[lv === true ? 1 : lv || 0][this.key]; this.combo = 0; this.comboWindow = 0; }

    reset() {
      this.hp = this.maxHp; this.ko = false; this.dead = false; this.atk = null;
      this.downTime = 34; this.buffer = null; this.bufferT = 0; this.bunny = 0;
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
      // virou coelho (feitiço do Mumbo): só anda e pula até o feitiço acabar
      if (this.bunny > 0) {
        if (--this.bunny === 0 || this.ko) { this.bunny = 0; g.poof(this.x, this.y - 50); A().play('switch'); }
        if (this.buffer && this.buffer !== 'jump') this.buffer = null;
      }

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
            this.vz = this.def.jump; this.z = 1; this.airAttacked = false; this.jumpT = 0;
            this.vx = mx * this.def.speed * 1.1;
            this.setState('air'); this.setAnim('jump'); A().play('jump');
            g.dust(this.x, this.y, 4, '#d9cbbb');
          } else if (b === 'dash') {
            this.setState('dash'); this.setAnim('dash'); this.invul = 12;
            if (mx) this.facing = mx > 0 ? 1 : -1;
            this.vy = my * 3;
            A().play('whoosh');
            if (this.key === 'beastboy') g.morph(this.x, this.y - 40);
            else if (this.key === 'raven') { A().play('dark'); g.poof(this.x, this.y - 70); }
          }
          return;
        }
        case 'air': {
          this.jumpT++;
          if (this.key === 'cyborg' && this.vz > 0 && this.jumpT % 2 === 0) this.jets(g);
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
          // ataque em corrida
          if ((this.buffer === 'light' || this.buffer === 'heavy') && this.def.dashAtk && this.st >= 2) {
            this.buffer = null; this.vy = 0; this.invul = Math.min(this.invul, 4);
            this.startAttack(this.def.dashAtk);
            return;
          }
          this.vx = this.facing * (13 - this.st * 0.5);
          this.dashFx(g);
          if (this.st > 14) {
            this.vy = 0; this.setState('idle'); this.setAnim('idle');
            if (this.key === 'beastboy') g.morph(this.x, this.y - 40, true);
          }
          return;
        }
        case 'attack': {
          this.vy *= 0.6;
          const a = this.atk;
          // encadeia o combo leve
          if (a && a.def.combo != null && this.buffer === 'light' && a.t >= a.def.s + a.def.a - 1 && a.def.combo < this.def.light.length - 1) {
            this.buffer = null; this.doCombo(); return;
          }
          // COMBO FINAL (fase 8): forte depois de pelo menos dois golpes do combo
          if (a && a.def.combo != null && a.def.combo >= 1 && this.def.ender && this.buffer === 'heavy' && a.t >= a.def.s + a.def.a - 1) {
            this.buffer = null; this.combo = 0; this.comboWindow = 0; this.vx = 0; this.vy = 0;
            this.startAttack(this.def.ender); return;
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
      const n = this.def.light.length, i = this.comboWindow > 0 ? Math.min(this.combo, n - 1) : 0;
      let def = this.def.light[i];
      if (i === n - 1 && this.def.finishers) def = TT.choice(this.def.finishers);
      def.combo = i;
      this.vx = 0; this.vy = 0;
      this.startAttack(def);
      this.combo = (i + 1) % n;
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

    // Dano recebido escala com a dificuldade (NORMAL = 1).
    get dmgTaken() { return this.game.diff.dmg; }

    takeHit(src, d, dir) {
      if (this.game.godMode) return false;
      if (this.state === 'dash' && this.st < 11) return false;
      return super.takeHit(src, d, dir);
    }

    physics() {
      super.physics();
      if (this.style.capeSim) this.updateCape();
    }

    // Capa com física de tecido: corrente de pontos (Verlet) presa no ombro, com gravidade e vento.
    updateCape() {
      const st = this.style, sc = st.scale, N = 7, seg = 10.5 * sc;
      const ax = this.x - this.facing * 3 * sc, ay = this.y - this.z - (st.legL[0] + st.legL[1] + st.torsoH - 6) * sc;
      let c = this.cape;
      if (!c || Math.abs(c[0].x - ax) > 80 || Math.abs(c[0].y - ay) > 80) { // (re)cria pendurada atrás do corpo
        c = this.cape = [];
        for (let i = 0; i < N; i++) c.push({ x: ax - this.facing * i * 3, y: ay + i * seg, px: ax - this.facing * i * 3, py: ay + i * seg });
      }
      const t = this.animT, run = Math.min(1, Math.abs(this.vx) / 5);
      for (let i = 1; i < N; i++) {
        const p = c[i], vx = (p.x - p.px) * 0.9, vy = (p.y - p.py) * 0.9;
        p.px = p.x; p.py = p.y;
        const flutter = Math.sin(t * 0.22 + i * 0.9) * (0.25 + run * 0.6) * (i / N);
        p.x += vx - this.facing * (0.08 + run * 0.35) * (i / N) + flutter;
        p.y += vy + 0.55 - Math.abs(flutter) * 0.4;
        const floor = this.y - 2; if (p.y > floor) p.y = floor;
      }
      c[0].x = c[0].px = ax; c[0].y = c[0].py = ay;
      for (let k = 0; k < 4; k++) { // mantém o comprimento de cada segmento
        for (let i = 1; i < N; i++) {
          const a = c[i - 1], b = c[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001, f = (d - seg) / d;
          if (i === 1) { b.x -= dx * f; b.y -= dy * f; }
          else { a.x += dx * f * 0.5; a.y += dy * f * 0.5; b.x -= dx * f * 0.5; b.y -= dy * f * 0.5; }
        }
        c[0].x = ax; c[0].y = ay;
      }
    }

    // Chamas dos propulsores do Ciborgue.
    jets(g) {
      g.particles.spawn('glow', this.x + TT.rand(-8, 8), this.y - this.z - 4, { color: SONIC, size: 22, life: 8, vy: 2 });
      g.particles.spawn('spark', this.x + TT.rand(-6, 6), this.y - this.z - 2, { vx: -this.facing * TT.rand(1, 3), vy: TT.rand(1, 4), color: '#bfe6ff', size: 2, life: 8 });
    }

    // Efeitos de cada esquiva: rolamento, guepardo, propulsores, corvo de alma, cometa verde.
    dashFx(g) {
      const k = this.key, t = this.st;
      if (k === 'cyborg') { if (t % 2 === 0) this.jets(g); }
      else if (k === 'starfire') g.particles.spawn('glow', this.x - this.facing * 30, this.y - 92 + TT.rand(-8, 8), { color: GREEN, size: 34, life: 12, vx: -this.facing * 2 });
      else if (k === 'raven') g.particles.spawn('feather', this.x - this.facing * 20, this.y - 70 + TT.rand(-30, 30), { color: '#1a0f2e', size: 9, life: 20, vr: 0.2, vx: -this.facing });
      else if (t % 3 === 0) g.particles.spawn('dust', this.x - this.facing * 20, this.y - 6, { color: 'rgba(255,255,255,0.8)', size: 7, life: 14 });
    }

    draw(ctx, camX) {
      const a = this.atk, fa = a && a.def.formAt ? a.def.formAt(a.t) : null, f = fa ? fa.form : a && a.def.form;
      const sx = this.x - camX, sy = this.y - this.z;
      if (this.invul > 0 && this.state !== 'getup' && this.state !== 'dash' && (this.invul >> 2) % 2 === 0) ctx.globalAlpha = 0.55;
      const fl = this.flash > 3;
      const FORM = f && FORMS[f];
      if (this.bunny > 0 && !this.ko) {
        const sq = this.state === 'down' ? -0.35 : this.state === 'hurt' ? -0.15 : 0;
        TT.drawRabbit(ctx, sx, sy, this.facing, this.animT, 0.62, { flash: fl, acc: this.def.color, sq, earsBack: this.state !== 'idle' && this.state !== 'air' });
        ctx.globalAlpha = 1;
        return;
      }
      if (FORM && fa && a.t > 1 && a.t < a.def.s + a.def.a + a.def.r - 1) {
        TT[FORM](ctx, sx, sy, this.facing, fa.t, fa.s, fa.end, fl); // forma da vez numa sequência de animais
      } else if (FORM && a.t > 1 && a.t < a.def.s + a.def.a + a.def.r - 1) {
        TT[FORM](ctx, sx, sy, this.facing, a.t, a.def.s, a.def.s + a.def.a, fl);
      } else if (this.state === 'dash' && this.key === 'beastboy') {
        TT.drawCheetah(ctx, sx, sy, this.facing, this.animT, fl);
      } else if (this.state === 'dash' && this.key === 'raven') {
        TT.drawSoulRaven(ctx, sx, sy - 48, this.facing, this.animT);
      } else {
        if (this.state === 'dash' && this.key === 'starfire') this.drawComet(ctx, sx, sy);
        TT.computePose(this, this.pose);
        TT.drawRig(ctx, this.style, this.pose, sx, sy, this.facing, { flash: fl, t: this.animT, out: this.rigOut, cape: this.cape, camX });
      }
      ctx.globalAlpha = 1;
      // efeitos de ataque (feixes, garras de energia, rastros de movimento)
      if (a && a.t >= a.def.s && a.t < a.def.s + a.def.a + 2) {
        if (a.def.beam) this.drawBeam(ctx, sx, sy, a);
        if (a.def.claw) this.drawClaw(ctx, sx, sy, a);
      }
      if (a && a.def.dmg && !a.def.beam && !a.def.form && a.t >= a.def.s && a.t < a.def.s + a.def.a + 5) this.drawSmear(ctx, sx, sy, a);
      // hipnotizado pelo Irmão Sangue: espirais girando sobre a cabeça enquanto está tonto
      if (this.hypno && this.state === 'hurt') {
        for (let i = 0; i < 3; i++) {
          const ang = this.animT * 0.15 + i * 2.1;
          TT.drawGlow(ctx, '#ff7af0', sx + Math.cos(ang) * 26, sy - 150 + Math.sin(ang) * 8, 14, 0.9);
        }
      } else this.hypno = false;
      if (this.frozen > 0) drawIce(ctx, sx, sy, this.height, this.frozen); // raio congelante da Irmandade
    }

    // Rastro verde da Estelar voando na esquiva.
    drawComet(ctx, sx, sy) {
      const fc = this.facing, y = sy - 92;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createLinearGradient(sx, 0, sx - fc * 170, 0);
      gr.addColorStop(0, 'rgba(93,255,138,0.85)'); gr.addColorStop(1, 'rgba(93,255,138,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(sx, y - 16); ctx.lineTo(sx - fc * 170, y - 4); ctx.lineTo(sx - fc * 170, y + 4); ctx.lineTo(sx, y + 16); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Rastro de movimento (smear) em arco na cor do Titã.
    drawSmear(ctx, sx, sy, a) {
      const d = a.def, k = (a.t - d.s) / (d.a + 5), sc = this.style.scale, st = this.style;
      const hk = (st.legL[0] + st.legL[1] + st.torsoH * 0.7) * sc / 90; // altura do peito em relação ao modelo antigo
      const P = SMEAR[d.smear || d.pose] || SMEAR.jab;
      const col = this.def.fx || '#ffffff';
      const grow = Math.min(1, (a.t - d.s + 1) / 3);
      const a0 = P.a0, a1 = P.a0 + (P.a1 - P.a0) * grow;
      const R = P.r * (d.weapon === 'staff' ? 1.25 : 1) * (d.big ? 1.12 : 1) * TT.clamp(hk * 1.25, 0.72, 1);
      ctx.save();
      ctx.translate(sx + this.facing * P.x * sc, sy - P.y * hk); ctx.scale(this.facing * sc, sc);
      ctx.globalAlpha = 0.85 * (1 - k);
      if (P.line) {
        // golpes retos: linhas de velocidade
        ctx.strokeStyle = col; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          ctx.lineWidth = 5 - i; const yy = -8 + i * 8;
          ctx.beginPath(); ctx.moveTo(R * (0.15 + 0.1 * i), yy); ctx.lineTo(R * (0.95 - 0.08 * i) * grow + 6, yy); ctx.stroke();
        }
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(R * 0.3, 0); ctx.lineTo(R * 0.95 * grow, 0); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, R, a0, a1, a1 < a0);
        ctx.arc(R * 0.12, R * 0.04, R * 0.7, a1, a0, a1 >= a0);
        ctx.closePath();
        ctx.fillStyle = col; ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, R, a0 + (a1 - a0) * 0.35, a1, a1 < a0); ctx.stroke();
      }
      ctx.restore();
    }

    drawBeam(ctx, sx, sy, a) {
      const d = a.def, fc = this.facing;
      const eyes = d.beam === 'eyes', R = this.rigOut;
      const ox = eyes ? R.hx + fc * R.hr * 0.75 : R.fx + fc * 18;
      const oy = eyes ? R.hy - R.hr * 0.12 : R.fy;
      const len = d.reach[1];
      const k = a.t - d.s, fade = TT.clamp((d.a - k) / 6, 0, 1), grow = Math.min(1, (k + 1) / 4);
      const L = len * grow;
      if (fade <= 0) return; // feixe já terminou (evita raios negativos no canvas)
      const w = (eyes ? 13 : 46) * (d.wide || 1) * (0.85 + Math.sin(k * 0.9) * 0.15) * fade;
      const col = eyes ? GREEN : SONIC;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // raios oculares: dois feixes (um por olho); sônico: um feixe largo
      const rows = eyes ? [-5, 5] : [0];
      for (const off of rows) {
        const y0 = oy + off;
        const gr = ctx.createLinearGradient(0, y0 - w, 0, y0 + w);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(fc > 0 ? ox : ox - L, y0 - w, L, w * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillRect(fc > 0 ? ox : ox - L, y0 - w * 0.2, L, w * 0.4);
      }
      if (!eyes) {
        // ondas concêntricas viajando pelo feixe sônico
        ctx.lineWidth = 4;
        for (let i = 0; i < 7; i++) {
          const dist = ((k * 22 + i * 120) % L), q = dist / L;
          ctx.strokeStyle = 'rgba(200,240,255,' + (0.9 * (1 - q)) + ')';
          ctx.beginPath(); ctx.ellipse(ox + fc * dist, oy, 9 + q * 10, w * (1.05 + q * 0.5), 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
      TT.drawGlow(ctx, col, ox, oy, w * (eyes ? 3.4 : 2.4), 1);
      TT.drawGlow(ctx, col, ox + fc * L, oy, w * (eyes ? 4 : 2), 0.9 * grow); // clarão na ponta
      ctx.restore();
      if (k % 2 === 0) this.game.particles.spawn('spark', this.x + fc * TT.rand(60, L), oy + TT.rand(-w, w), { vx: fc * TT.rand(4, 10), vy: TT.rand(-2, 2), color: col, size: 3, life: 10 });
    }

    // Garra de energia negra da Ravena: contorno violeta + filete branco e brilho.
    drawClaw(ctx, sx, sy, a) {
      const fc = this.facing, k = (a.t - a.def.s) / a.def.a;
      const r = a.def.reach[1];
      const cx = sx + fc * r * 0.55, cy = this.rigOut.fy != null ? this.rigOut.fy : sy - 70;
      TT.drawGlow(ctx, DARK, cx, cy, r * 0.9, 0.55 * (1 - k * 0.5));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(fc, 1);
      ctx.globalAlpha = 0.92 * (1 - k * 0.45);
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, 30); ctx.quadraticCurveTo(-r * 0.1, -50 - k * 20, r * 0.5, -36);
      ctx.lineTo(r * 0.2, -12); ctx.lineTo(r * 0.56, -6); ctx.lineTo(r * 0.16, 10); ctx.lineTo(r * 0.48, 28);
      ctx.quadraticCurveTo(0, 26, -r * 0.4, 30);
      ctx.closePath();
      ctx.fillStyle = '#120a22'; ctx.fill();
      ctx.strokeStyle = '#8a5cff'; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
      // fiapos de sombra
      ctx.strokeStyle = 'rgba(214,194,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r * 0.3, 18); ctx.quadraticCurveTo(-r * 0.6, 10 + k * 10, -r * 0.8, 24); ctx.stroke();
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
  // Soldado elétrico (fase 3): estocada em investida e descarga no chão, ambas com marcação no chão.
  ENEMIES.shock = {
    name: 'Soldado Elétrico', style: 'hiveShock', hp: 55, speed: 2.7, range: 150, score: 180, aggr: 1.1,
    attacks: [
      { pose: 'jab', weapon: 'baton', s: 22, a: 10, r: 18, lunge: 9, dmg: 10, reach: [0, 84], depth: 26, kb: 5, stun: 26, shock: true, sound: 'zap',
        zone(f) { return [{ k: 'rect', x0: f.x - f.facing * 10, x1: f.x + f.facing * 200, y: f.y, d: 26 }]; } },
      { pose: 'slam', weapon: 'baton', s: 26, a: 3, r: 22, dmg: 9, zoneHit: true, knockdown: true, launch: 5, kb: 6, shock: true, sound: 'zap',
        zone(f) { return [{ k: 'ell', x: f.x + f.facing * 30, y: f.y, rx: 125, ry: 50 }]; } },
    ],
  };

  // Abelha H.I.V.E. (fase 2): bate e recua como o soldado elétrico; a ferroada é um voo rasante em linha.
  ENEMIES.bee = {
    name: 'Abelha H.I.V.E.', style: 'hiveBee', hp: 48, speed: 3.0, range: 150, score: 150, aggr: 1.1,
    attacks: [
      { pose: 'flyKick', s: 20, a: 12, r: 18, lunge: 10, dmg: 10, reach: [0, 80], depth: 26, kb: 6, knockdown: true, launch: 5, sound0: 'whoosh',
        zone(f) { return [{ k: 'rect', x0: f.x - f.facing * 10, x1: f.x + f.facing * 220, y: f.y, d: 26 }]; },
        onFrame(f, t) { if (t > this.s && t < this.s + this.a) f.z = Math.max(f.z, 18); } },
      { pose: 'jab', s: 14, a: 4, r: 16, dmg: 7, reach: [0, 66], kb: 2 },
    ],
  };
  // Soldado da fábrica química (fase 4): jato de gosma em cone (marcado no chão) e soco curto.
  ENEMIES.hazmat = {
    name: 'Soldado Químico', style: 'hazmat', hp: 58, speed: 2.4, range: 150, score: 170, aggr: 1,
    attacks: [
      { pose: 'beam', s: 26, a: 10, r: 20, dmg: 9, zoneHit: true, kb: 4, stun: 30, sound0: 'drill',
        zone(f) { return [{ k: 'rect', x0: f.x + f.facing * 20, x1: f.x + f.facing * 190, y: f.y, d: 30 }]; } },
      { pose: 'jab', s: 14, a: 4, r: 16, dmg: 8, reach: [0, 64], kb: 3 },
    ],
  };
  // Gosminha (fase 4): pedaço do Plasmus que pula em cima dos Titãs. As grandes se dividem em duas pequenas.
  ENEMIES.goo = {
    name: 'Gosma', style: 'hive', hp: 38, speed: 2.1, range: 64, score: 90, aggr: 1.2,
    attacks: [
      { pose: 'jab', s: 22, a: 8, r: 22, lunge: 8, dmg: 8, reach: [0, 70], depth: 30, kb: 4, sound0: 'land' },
      { pose: 'jab', s: 26, a: 4, r: 24, dmg: 10, reach: [-50, 80], depth: 40, kb: 6, knockdown: true, launch: 4, sound0: 'land' },
    ],
  };
  // Aluno da Academia H.I.V.E. (fase 5): hipnotizado pelo Irmão Sangue; soco duplo ou chute.
  ENEMIES.cadet = {
    name: 'Aluno da H.I.V.E.', style: 'cadet', hp: 46, speed: 2.7, range: 60, score: 120, aggr: 1.15, picks: [0, 0, 2],
    attacks: [
      { pose: 'jab', s: 14, a: 4, r: 6, dmg: 6, reach: [0, 62], kb: 1, next: 1 },
      { pose: 'cross', s: 6, a: 3, r: 18, dmg: 8, reach: [0, 68], kb: 3 },
      { pose: 'kick', s: 18, a: 5, r: 18, dmg: 9, reach: [0, 82], kb: 4, knockdown: true, launch: 4 },
    ],
  };
  // Jinx (fase 5): raio de azar rosa em linha (marcado no chão) e estrela (chute girando) de perto.
  ENEMIES.jinx = {
    name: 'Jinx', style: 'jinx', hp: 110, speed: 3.3, range: 150, score: 700, aggr: 1.25,
    attacks: [
      { pose: 'cast', s: 24, a: 10, r: 20, dmg: 10, zoneHit: true, knockdown: true, launch: 5, kb: 6, hex: true, sound0: 'dark', sound: 'zap',
        zone(f) { return [{ k: 'rect', x0: f.x + f.facing * 20, x1: f.x + f.facing * 310, y: f.y, d: 28, arrows: true }]; } },
      { pose: 'flyKick', s: 14, a: 6, r: 16, lunge: 6, dmg: 8, reach: [0, 78], kb: 4, sound0: 'whoosh' },
    ],
  };
  // Mammoth (fase 5): gigante com super armadura; soco de varrer à frente e pisão em volta (ambos marcados).
  ENEMIES.mammoth = {
    name: 'Mammoth', style: 'mammoth', hp: 200, speed: 2.0, range: 96, score: 900, aggr: 1.1,
    attacks: [
      { pose: 'swing', s: 26, a: 6, r: 24, dmg: 14, zoneHit: true, knockdown: true, launch: 7, kb: 9, sound0: 'roar', sound: 'hitHeavy',
        zone(f) { return [{ k: 'half', x: f.x, y: f.y, rx: 150, ry: 50, f: f.facing }]; } },
      { pose: 'slam', s: 30, a: 3, r: 28, dmg: 13, zoneHit: true, knockdown: true, launch: 6, kb: 7, sound: 'shockwave',
        zone(f) { return [{ k: 'ell', x: f.x + f.facing * 20, y: f.y, rx: 175, ry: 64 }]; },
        onFrame(f, t, g) { if (t === this.s) { g.impact(f.x + f.facing * 20, f.y, 'PISÃO!', '#e2702a', 0.8); g.dust(f.x, f.y, 10, '#b9a7c9'); } } },
    ],
  };
  // Soldado-Carta (fase 6): carta de baralho viva; estocada de lança em investida (marcada) e cutucada de perto.
  ENEMIES.card = {
    name: 'Soldado-Carta', style: 'hive', hp: 50, speed: 2.9, range: 150, score: 160, aggr: 1.15,
    attacks: [
      { pose: 'jab', s: 22, a: 9, r: 18, lunge: 9, dmg: 10, reach: [0, 96], depth: 26, kb: 5, sound0: 'whoosh',
        zone(f) { return [{ k: 'rect', x0: f.x - f.facing * 10, x1: f.x + f.facing * 210, y: f.y, d: 26 }]; } },
      { pose: 'jab', s: 14, a: 4, r: 16, dmg: 7, reach: [0, 84], kb: 3 },
    ],
  };
  // Coelho Mágico (fase 6): coelho gigante saído da cartola; bote curto e salto esmagador (marcado no chão).
  ENEMIES.bunny = {
    name: 'Coelho Mágico', style: 'hive', hp: 60, speed: 2.6, range: 70, score: 180, aggr: 1.1,
    attacks: [
      { pose: 'jab', s: 20, a: 8, r: 20, lunge: 7, dmg: 9, reach: [0, 76], depth: 30, kb: 4, sound0: 'jump' },
      { pose: 'jab', s: 30, a: 4, r: 26, dmg: 12, zoneHit: true, knockdown: true, launch: 5, kb: 6, sound0: 'jump', sound: 'land',
        zone(f) { return [{ k: 'ell', x: f.x + f.facing * 60, y: f.y, rx: 110, ry: 44 }]; } },
    ],
  };
  // Comando do Slade (fase 7): robô de elite com bastão; estocada em investida (faixa marcada) e giro do bastão (círculo).
  ENEMIES.commando = {
    name: 'Comando do Slade', style: 'commando', hp: 80, speed: 3.0, range: 150, score: 220, aggr: 1.2,
    attacks: [
      { pose: 'jab', weapon: 'staff', s: 20, a: 9, r: 18, lunge: 10, dmg: 12, reach: [0, 100], depth: 26, kb: 6, sound0: 'whoosh',
        zone(f) { return [{ k: 'rect', x0: f.x - f.facing * 10, x1: f.x + f.facing * 220, y: f.y, d: 26 }]; } },
      { pose: 'spin', weapon: 'staff', s: 22, a: 10, r: 20, dmg: 11, zoneHit: true, knockdown: true, launch: 6, kb: 7, sound0: 'whoosh',
        zone(f) { return [{ k: 'ell', x: f.x, y: f.y, rx: 125, ry: 48 }]; },
        onFrame(f, t) { if (t >= this.s && t < this.s + this.a && t % 3 === 0) f.facing *= -1; } }, // gira o bastão
    ],
  };
  // Demônio de Fogo (fase 7): criatura de pedra e lava de Trigon; bola de fogo no círculo marcado e garrada de perto.
  ENEMIES.demon = {
    name: 'Demônio de Fogo', style: 'demon', hp: 64, speed: 2.6, range: 150, score: 200, aggr: 1.1,
    attacks: [
      { pose: 'throw', s: 28, a: 4, r: 22, dmg: 12, zoneHit: true, knockdown: true, launch: 6, kb: 6, fire: true, sound0: 'roar',
        zone(f) { return [{ k: 'ell', x: f.x + f.facing * 150, y: f.y, rx: 82, ry: 34 }]; },
        onFrame(f, t, g, a) {
          if (t !== this.s || !a.zones) return;
          const z = a.zones[0];
          g.explosion(z.x, z.y, 10, 0.8, FIRE);
          g.particles.spawn('text', z.x, z.y - 140, { text: 'FWOOSH!', size: 34, color: '#ffe14a', color2: '#c4300a', vy: -0.6, life: 30, rot: TT.rand(-0.2, 0.2) });
        } },
      { pose: 'claw', s: 16, a: 5, r: 18, lunge: 6, dmg: 10, reach: [0, 82], kb: 4, sound0: 'whoosh', fire: true },
    ],
  };
  // Soldado Congelador da Irmandade do Mal (fase 8): raio congelante em linha (marcado) que prende o Titã
  // num bloco de gelo — como a Irmandade fez com os heróis no fim da série — e coronhada de perto.
  ENEMIES.freezer = {
    name: 'Soldado Congelador', style: 'freezer', hp: 76, speed: 3.0, range: 170, score: 240, aggr: 1.15,
    attacks: [
      { pose: 'beam', s: 30, a: 8, r: 20, dmg: 8, zoneHit: true, freezeHero: 55, stun: 55, kb: 0, sound0: 'alarm', sound: 'laser',
        zone(f) { return [{ k: 'rect', x0: f.x + f.facing * 30, x1: f.x + f.facing * 360, y: f.y, d: 26, arrows: true }]; } },
      { pose: 'swing', s: 14, a: 5, r: 16, lunge: 5, dmg: 9, reach: [0, 84], kb: 5, sound0: 'whoosh' },
    ],
  };
  // Madame Rouge (fase 8): espiã elástica da Irmandade; chute esticado de longe (faixa marcada) e giro
  // com os braços esticados em volta dela (círculo marcado).
  ENEMIES.rouge = {
    name: 'Madame Rouge', style: 'rouge', hp: 120, speed: 3.6, range: 190, score: 800, aggr: 1.3,
    attacks: [
      { pose: 'kick', s: 22, a: 8, r: 18, dmg: 12, zoneHit: true, knockdown: true, launch: 6, kb: 8, stretch: 'leg', sound0: 'whoosh',
        zone(f) { return [{ k: 'rect', x0: f.x + f.facing * 20, x1: f.x + f.facing * 300, y: f.y, d: 26, arrows: true }]; } },
      { pose: 'spin', s: 22, a: 10, r: 18, dmg: 10, zoneHit: true, knockdown: true, launch: 6, kb: 7, stretch: 'arms', sound0: 'whoosh',
        zone(f) { return [{ k: 'ell', x: f.x, y: f.y, rx: 150, ry: 54 }]; },
        onFrame(f, t) { if (t >= this.s && t < this.s + this.a && t % 3 === 0) f.facing *= -1; } },
    ],
  };
  TT.ENEMIES = ENEMIES;

  class Enemy extends Fighter {
    constructor(game, kind, x, y) {
      super(game, x, y);
      this.kind = kind;
      this.def = ENEMIES[kind];
      this.style = TT.STYLES[this.def.style];
      this.hp = this.maxHp = Math.round(this.def.hp * game.diff.enemyHp);
      this.team = 'enemy';
      this.cool = TT.randi(30, 80) / game.diff.aggr;
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
      this.cool = TT.randi(50, 100) / (this.def.aggr * this.game.diff.aggr);
    }
    think() {
      if (this.commonStates()) return;
      const g = this.game, p = g.targetFor(this);
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
        const pick = this.def.picks ? TT.choice(this.def.picks) : this.kind === 'slade' ? (Math.random() < 0.6 ? 0 : 2) : TT.randi(0, atks.length - 1);
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
      this.hp = this.maxHp = Math.round(26 * game.diff.enemyHp);
      this.radius = 22; this.height = 70;
      this.hover = 26; this.z = this.hover;
      this.grav = 0;
      this.cool = TT.randi(60, 120) / game.diff.aggr;
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
      const g = this.game, p = g.targetFor(this);
      this.z += (this.hover + Math.sin(this.animT * 0.08) * 6 - this.z) * 0.1;
      if (!p || p.ko) { this.vx *= 0.9; this.vy *= 0.9; return; }
      const dx = p.x - this.x;
      this.facing = dx > 0 ? 1 : -1;
      if (this.charge > 0) {
        this.vx *= 0.8; this.vy *= 0.8;
        if (--this.charge === 0) {
          g.addProjectile(new Projectile(g, { kind: 'laser', team: 'enemy', owner: this, x: this.x + this.facing * 26, y: this.y, z: this.z + 34, vx: this.facing * 9, r: 10, dmg: 8, kb: 3, life: 140 }));
          A().play('laser');
          this.cool = TT.randi(110, 170) / g.diff.aggr;
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

  // Soldado elétrico da H.I.V.E. (fase 3): bastão elétrico, ataca e recua (bate e corre).
  // Dois golpes, ambos com aviso no chão: estocada em investida (faixa) e descarga no chão (círculo).
  class ShockTrooper extends Enemy {
    constructor(game, x, y, kind) {
      super(game, kind || 'shock', x, y);
      this.backoff = 0;
    }
    think() {
      if (this.commonStates()) return;
      const g = this.game, p = g.targetFor(this);
      if (this.state === 'attack') { this.updateAttack(); return; }
      if (this.state !== 'idle') this.setState('idle');
      if (!p) { this.vx *= 0.8; this.vy *= 0.8; this.setAnim('idle'); return; }
      if (this.cool > 0) this.cool--;
      if (this.backoff > 0) this.backoff--;
      const dx = p.x - this.x, dy = p.y - this.y, adx = Math.abs(dx), side = dx > 0 ? -1 : 1;
      if (!this.token && this.cool <= 0 && this.backoff <= 0 && g.tokens > 0 && adx < 360) { this.token = true; g.tokens--; }
      let tx, ty;
      if (this.backoff > 0) { tx = p.x + side * 300; ty = p.y + this.yOff; } // recua depois de atacar
      else if (this.token) { tx = p.x + side * 150; ty = p.y; } // distância da estocada
      else { tx = p.x + side * this.wait; ty = p.y + this.yOff; }
      const L = g.camX + 40, R = g.camX + TT.W - 40;
      if (!this.entering) tx = TT.clamp(tx, L, R);
      else if (this.x > L && this.x < R) this.entering = false;
      const mx = tx - this.x, my = ty - this.y, sp = this.def.speed * (this.backoff > 0 ? 1.15 : 1);
      this.vx = Math.abs(mx) > 6 ? TT.sign(mx) * sp : 0;
      this.vy = Math.abs(my) > 4 ? TT.sign(my) * sp * 0.6 : 0;
      this.facing = dx > 0 ? 1 : -1;
      this.setAnim(this.vx || this.vy ? 'walk' : 'idle');
      if (this.token && this.cool <= 0 && Math.abs(dy) < 18) {
        const atks = this.def.attacks;
        if (adx < 95) { this.vx = this.vy = 0; this.startAttack(atks[1]); }
        else if (adx < 200) { this.vx = this.vy = 0; this.startAttack(atks[0]); }
      }
    }
    startAttack(def) {
      super.startAttack(def);
      this.atk.zones = def.zone ? def.zone.call(def, this, this.game, this.atk) : null;
    }
    endAttack() {
      super.endAttack();
      this.backoff = 70;
    }
    drawGround(ctx, camX) { Boss.prototype.drawGround.call(this, ctx, camX); }
    draw(ctx, camX) {
      super.draw(ctx, camX);
      // faíscas no bastão (mais fortes na preparação)
      const a = this.atk, charging = a && this.state === 'attack' && a.t < a.def.s;
      if (charging || (this.animT >> 3) % 5 === 0) {
        const bx = this.x - camX + this.facing * 34, by = this.y - this.z - 92;
        drawArc(ctx, bx, by, bx + TT.rand(-22, 22), by + TT.rand(-26, 10), charging ? '#bff6ff' : '#6fe3ff', charging ? 3 : 2);
        if (charging) TT.drawGlow(ctx, '#6fe3ff', bx, by, 26 + 20 * (a.t / a.def.s), 0.8);
      }
    }
  }
  TT.ShockTrooper = ShockTrooper;

  // Abelha H.I.V.E. (fase 2): mesma tática de bate e recua, com zumbido das asas.
  class BeeSoldier extends ShockTrooper {
    constructor(game, x, y) { super(game, x, y, 'bee'); }
    draw(ctx, camX) {
      Fighter.prototype.draw.call(this, ctx, camX);
      const a = this.atk;
      if (a && this.state === 'attack' && a.def === this.def.attacks[0] && a.t > a.def.s && a.t < a.def.s + a.def.a) {
        const x = this.x - camX, y = this.y - this.z - 70; // rastro do voo rasante
        ctx.strokeStyle = 'rgba(255,225,80,0.6)'; ctx.lineWidth = 4;
        for (const dy of [-14, 0, 14]) { ctx.beginPath(); ctx.moveTo(x - this.facing * 20, y + dy); ctx.lineTo(x - this.facing * 90, y + dy); ctx.stroke(); }
      }
    }
  }
  TT.BeeSoldier = BeeSoldier;

  // Soldado químico (fase 4): jato de gosma rosa saindo da mangueira.
  class HazmatSoldier extends ShockTrooper {
    constructor(game, x, y) { super(game, x, y, 'hazmat'); }
    draw(ctx, camX) {
      Fighter.prototype.draw.call(this, ctx, camX);
      const a = this.atk;
      if (!a || this.state !== 'attack' || a.def !== this.def.attacks[0]) return;
      const x = this.x - camX + this.facing * 30, y = this.y - this.z - 74, d = a.def;
      if (a.t < d.s) { // gotejando enquanto carrega
        if (a.t % 4 === 0) this.game.particles.spawn('debris', this.x + this.facing * 34, this.y - 74, { vx: this.facing, vy: 0, grav: 0.5, color: '#e06ab8', size: 5, life: 22, floor: this.y });
        return;
      }
      if (a.t >= d.s + d.a) return;
      const k = (a.t - d.s) / d.a, len = 170 * Math.min(1, k * 3);
      ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, 1);
      ctx.fillStyle = '#c2569b'; ctx.strokeStyle = '#2a0f2a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.quadraticCurveTo(len * 0.6, -14, len, 64); ctx.lineTo(len - 40, 74); ctx.quadraticCurveTo(len * 0.5, 10, 0, 6); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,190,235,0.7)'; ctx.beginPath(); ctx.ellipse(len * 0.4, -4, 26, 4, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  TT.HazmatSoldier = HazmatSoldier;

  // Gosma (fase 4): bolha que pula; as grandes se dividem em duas pequenas ao morrer.
  class GooBlob extends Enemy {
    constructor(game, x, y, small) {
      super(game, 'goo', x, y);
      this.small = !!small;
      this.size = small ? 0.62 : 1;
      if (small) { this.hp = this.maxHp = Math.round(16 * game.diff.enemyHp); this.def = Object.assign({}, this.def, { score: 40, speed: 2.6 }); }
      this.radius = 30 * this.size; this.height = 70 * this.size; this.shadowW = 34 * this.size;
      this.hue = TT.choice(['#c2569b', '#b44fa0', '#d0609e']);
    }
    die(dir, d) {
      super.die(dir, d);
      const g = this.game;
      for (let i = 0; i < 8; i++) g.particles.spawn('debris', this.x, this.y - 20, { vx: TT.rand(-5, 5), vy: -TT.rand(3, 8), grav: 0.5, color: this.hue, size: TT.rand(5, 9), life: 26, floor: this.y });
      if (!this.small) for (const s of [-1, 1]) {
        const c = new GooBlob(g, this.x + s * 30, TT.clamp(this.y + s * 14, TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM), true);
        c.entering = false; c.vx = s * 3; c.cool = 40; g.addEnemy(c);
      }
    }
    draw(ctx, camX) {
      const dying = this.dead && this.state === 'down';
      if (dying && this.st > 25 && (this.st >> 2) % 2 === 0) return;
      const t = this.animT, a = this.atk, sz = this.size, fl = this.flash > 3;
      const x = this.x - camX, y = this.y - this.z;
      // pulo do ataque: agacha na preparação e salta no golpe
      let sq = Math.sin(t * 0.15) * 0.06, hop = 0;
      if (a && this.state === 'attack') {
        const d = a.def;
        if (a.t < d.s) sq = -0.25 * (a.t / d.s);
        else if (a.t < d.s + d.a) { const u = (a.t - d.s) / d.a; hop = Math.sin(u * Math.PI) * (d === this.def.attacks[1] ? 70 : 36); sq = 0.18; }
      }
      if (this.state === 'down') sq = -0.4;
      const w = 34 * sz * (1 - sq * 0.8), h = 42 * sz * (1 + sq), cy = y - hop;
      ctx.save(); ctx.translate(x, cy); ctx.scale(this.facing, 1);
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.bezierCurveTo(-w * 1.1, -h * 0.9, -w * 0.4, -h * 1.5, w * 0.1, -h * 1.45);
      ctx.bezierCurveTo(w * 0.8, -h * 1.4, w * 1.15, -h * 0.7, w, 0);
      for (let k = 0; k <= 4; k++) ctx.lineTo(w - k * w / 2, 4 + (k % 2) * 5 + Math.sin(t * 0.2 + k) * 2);
      ctx.closePath();
      ctx.fillStyle = fl ? '#ffffff' : this.hue; ctx.fill();
      if (!fl) {
        ctx.save(); ctx.clip();
        ctx.fillStyle = 'rgba(70,10,60,0.35)'; ctx.beginPath(); ctx.ellipse(-w * 0.7, -h * 0.4, w * 0.6, h * 1.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,210,240,0.7)'; ctx.beginPath(); ctx.ellipse(w * 0.2, -h * 1.15, w * 0.3, h * 0.12, -0.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#2a0f2a'; ctx.lineWidth = 3.5; ctx.stroke();
      if (!fl) { // olhos amarelos e bocão
        const ey = -h * 0.85;
        ctx.fillStyle = '#ffe14a';
        ctx.beginPath(); ctx.ellipse(w * 0.15, ey, 6 * sz, 7 * sz, 0, 0, Math.PI * 2); ctx.ellipse(w * 0.6, ey, 5 * sz, 6 * sz, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a0f2a'; ctx.beginPath(); ctx.arc(w * 0.2, ey, 2.5 * sz, 0, Math.PI * 2); ctx.arc(w * 0.63, ey, 2.2 * sz, 0, Math.PI * 2); ctx.fill();
        const open = a && this.state === 'attack' ? 9 : 4;
        ctx.fillStyle = '#3a0a2a'; ctx.beginPath(); ctx.ellipse(w * 0.4, -h * 0.45, 12 * sz, open * sz, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      const tell = a && this.state === 'attack' && a.t < a.def.s ? a.t / a.def.s : -1;
      if (tell >= 0) TT.drawGlow(ctx, '#ff6a2a', x, cy - h, 14 + 20 * tell, 0.35 + 0.5 * tell);
    }
  }
  TT.GooBlob = GooBlob;

  // Jinx (fase 5): bate e recua como o soldado elétrico; o raio de azar corre pelo chão em ondas rosa.
  class JinxEnemy extends ShockTrooper {
    constructor(game, x, y) { super(game, x, y, 'jinx'); this.radius = 22; }
    think() {
      super.think();
      if (!this.said && !this.entering && !this.dead) { this.said = true; this.game.say(this, 'Hora do azar, Titãs!', '#ff8ad6'); }
    }
    draw(ctx, camX) {
      Fighter.prototype.draw.call(this, ctx, camX);
      const a = this.atk;
      if (!a || this.state !== 'attack' || a.def !== this.def.attacks[0]) return;
      const d = a.def, x = this.x - camX, y = this.y - this.z;
      if (a.t < d.s) { // mãos brilhando enquanto conjura
        TT.drawGlow(ctx, '#ff5fb4', x + this.facing * 30, y - 70, 18 + 26 * (a.t / d.s), 0.9);
        return;
      }
      if (a.t >= d.s + d.a) return;
      // ondas de azar: arcos rosa que avançam pela faixa marcada
      const k = (a.t - d.s) / d.a;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const u = TT.clamp(k * 1.3 - i * 0.12, 0, 1);
        if (u <= 0) continue;
        const wx = x + this.facing * (20 + u * 290), h = 34 + i * 6;
        ctx.strokeStyle = 'rgba(255,95,180,' + (0.9 - i * 0.18) + ')'; ctx.lineWidth = 9 - i * 1.5;
        ctx.beginPath(); ctx.ellipse(wx, this.y - 26, 14, h, 0, this.facing > 0 ? -Math.PI / 2 : Math.PI / 2, this.facing > 0 ? Math.PI / 2 : Math.PI * 1.5); ctx.stroke();
      }
      ctx.restore();
    }
  }
  TT.JinxEnemy = JinxEnemy;

  // Mammoth (fase 5): não recua com golpes comuns (super armadura); só cambaleia depois de apanhar bastante.
  class Mammoth extends Enemy {
    constructor(game, x, y) {
      super(game, 'mammoth', x, y);
      this.radius = 42; this.height = 190; this.shadowW = 52;
      this.superArmor = true; this.poise = 0; this.downTime = 60;
    }
    startAttack(def) {
      super.startAttack(def);
      this.atk.zones = def.zone ? def.zone.call(def, this, this.game, this.atk) : null;
    }
    onArmorHit(dmg) {
      this.poise += dmg;
      if (this.poise >= 45 && this.state !== 'attack') {
        this.poise = 0; this.releaseToken();
        this.setState('hurt'); this.setAnim('hurt'); this.hitstun = 22; this.vx = this.lastHitDir * 2;
      }
    }
    think() {
      super.think();
      if (!this.said && !this.entering && !this.dead) { this.said = true; this.game.say(this, 'MAMMOTH ESMAGA!', '#ffb27a'); }
    }
    drawGround(ctx, camX) { Boss.prototype.drawGround.call(this, ctx, camX); }
  }
  TT.Mammoth = Mammoth;

  // Coelho de desenho (inimigo da fase 6 e Titã transformado pelo feitiço do Mumbo).
  // o.sq = achatamento, o.acc = cor do lenço (Titã), o.red = olhos vermelhos (coelho do mal).
  function drawRabbit(ctx, x, y, facing, t, s, o) {
    o = o || {};
    const fl = !!o.flash, C = (c) => (fl ? '#ffffff' : c), sq = o.sq || 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(facing * s * (1 - sq * 0.6), s * (1 + sq));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 3.5;
    const ear = Math.sin(t * 0.12) * 0.08 + (o.earsBack ? -0.5 : 0);
    // orelhas
    for (const [ox, rot, back] of [[-6, -0.25 + ear, true], [10, 0.12 + ear, false]]) {
      ctx.save(); ctx.translate(ox, -92); ctx.rotate(rot);
      ctx.beginPath(); ctx.ellipse(0, -30, 11, 32, 0, 0, Math.PI * 2); ctx.fillStyle = C(back ? '#d9d6e2' : '#f6f4fa'); ctx.fill(); ctx.stroke();
      if (!fl) { ctx.beginPath(); ctx.ellipse(1, -28, 5, 24, 0, 0, Math.PI * 2); ctx.fillStyle = '#ffb3cf'; ctx.fill(); }
      ctx.restore();
    }
    // pé de trás, corpo e rabo
    ctx.beginPath(); ctx.ellipse(-18, -6, 24, 10, 0, 0, Math.PI * 2); ctx.fillStyle = C('#d9d6e2'); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-6, -40, 34, 36, 0, 0, Math.PI * 2); ctx.fillStyle = C('#f6f4fa'); ctx.fill(); ctx.stroke();
    if (!fl) { ctx.fillStyle = 'rgba(120,110,150,0.25)'; ctx.beginPath(); ctx.ellipse(-22, -36, 16, 28, 0.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.arc(-38, -36, 9, 0, Math.PI * 2); ctx.fillStyle = C('#ffffff'); ctx.fill(); ctx.stroke();
    // cabeça
    ctx.beginPath(); ctx.ellipse(16, -82, 25, 21, 0, 0, Math.PI * 2); ctx.fillStyle = C('#f6f4fa'); ctx.fill(); ctx.stroke();
    if (o.acc) { // lenço na cor do Titã
      ctx.beginPath(); ctx.moveTo(-6, -64); ctx.quadraticCurveTo(14, -54, 34, -66); ctx.lineTo(30, -58); ctx.quadraticCurveTo(14, -48, -4, -56); ctx.closePath();
      ctx.fillStyle = C(o.acc); ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    }
    if (!fl) {
      ctx.fillStyle = o.red ? '#e01a3a' : '#2a1838';
      ctx.beginPath(); ctx.ellipse(22, -88, 4.5, 6, 0, 0, Math.PI * 2); ctx.ellipse(34, -87, 3.5, 5, 0, 0, Math.PI * 2); ctx.fill();
      if (o.red) { ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(16, -97); ctx.lineTo(27, -93); ctx.moveTo(31, -94); ctx.lineTo(39, -97); ctx.stroke(); }
      ctx.fillStyle = '#ff8fb5'; ctx.beginPath(); ctx.ellipse(40, -79, 4, 3, 0, 0, Math.PI * 2); ctx.fill(); // focinho
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.fillRect(33, -73, 5, 7); ctx.strokeRect(33, -73, 5, 7); // dentões
      ctx.strokeStyle = 'rgba(40,30,60,0.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(40, -78); ctx.lineTo(54, -82); ctx.moveTo(40, -77); ctx.lineTo(54, -75); ctx.stroke(); // bigodes
    }
    // pé da frente e patinha
    ctx.strokeStyle = OUT; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.ellipse(10, -4, 26, 10, 0, 0, Math.PI * 2); ctx.fillStyle = C('#f6f4fa'); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(20, -44, 8, 12, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  TT.drawRabbit = drawRabbit;

  // Coelho Mágico (fase 6): anda aos pulinhos; o salto esmagador cai na área marcada.
  class MagicBunny extends Enemy {
    constructor(game, x, y) {
      super(game, 'bunny', x, y);
      this.radius = 30; this.height = 130; this.shadowW = 38;
    }
    startAttack(def) {
      super.startAttack(def);
      this.atk.zones = def.zone ? def.zone.call(def, this, this.game, this.atk) : null;
    }
    die(dir, d) {
      super.die(dir, d);
      this.game.poof(this.x, this.y - 50);
      this.game.particles.spawn('text', this.x, this.y - 140, { text: 'PUF!', size: 30, color: '#ffffff', color2: '#8a5cff', vy: -0.6, life: 30 });
    }
    drawGround(ctx, camX) { Boss.prototype.drawGround.call(this, ctx, camX); }
    draw(ctx, camX) {
      if (this.dead && this.state === 'down' && this.st > 25 && (this.st >> 2) % 2 === 0) return;
      const t = this.animT, a = this.atk;
      let hop = this.anim === 'walk' ? Math.abs(Math.sin(t * 0.22)) * 16 : 0, sq = 0;
      if (a && this.state === 'attack') {
        const d = a.def;
        if (a.t < d.s) sq = -0.22 * (a.t / d.s);
        else if (a.t < d.s + d.a) { const u = (a.t - d.s) / d.a; hop = Math.sin(u * Math.PI) * (d === this.def.attacks[1] ? 110 : 40); sq = 0.12; }
      }
      if (this.state === 'down') sq = -0.35;
      const x = this.x - camX, y = this.y - this.z - hop;
      drawRabbit(ctx, x, y, this.facing, t, 1.05, { flash: this.flash > 3, sq, red: true, earsBack: this.state === 'hurt' || this.state === 'down' });
      const tell = a && this.state === 'attack' && a.t < a.def.s ? a.t / a.def.s : -1;
      if (tell >= 0) TT.drawGlow(ctx, '#ff6a2a', x + this.facing * 20, y - 80, 14 + 20 * tell, 0.35 + 0.5 * tell);
    }
  }
  TT.MagicBunny = MagicBunny;

  // Soldado-Carta (fase 6): carta de baralho com pernas e braços finos e uma lança.
  class CardSoldier extends ShockTrooper {
    constructor(game, x, y) {
      super(game, x, y, 'card');
      this.suit = TT.choice(['♠', '♥', '♣', '♦']);
      this.red = this.suit === '♥' || this.suit === '♦';
      this.rank = TT.choice(['J', 'Q', 'K', '10', '7']);
      this.radius = 26; this.height = 120;
    }
    draw(ctx, camX) {
      if (this.dead && this.state === 'down' && this.st > 25 && (this.st >> 2) % 2 === 0) return;
      const t = this.animT, a = this.atk, fl = this.flash > 3, ink = this.red ? '#d0202a' : '#1a1a22';
      const x = this.x - camX, y = this.y - this.z;
      ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, 1);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (this.state === 'down') { ctx.translate(0, -12); ctx.rotate(-Math.PI / 2 * (this.z > 0 ? 0.5 : 1)); ctx.translate(0, 12); }
      const walk = this.anim === 'walk' ? Math.sin(t * 0.25) : 0, bob = Math.abs(walk) * 3;
      // pernas e braços (traços pretos)
      ctx.strokeStyle = OUT; ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.moveTo(-8, -34 - bob); ctx.lineTo(-8 - walk * 12, -2); ctx.lineTo(-2 - walk * 12, 0);
      ctx.moveTo(8, -34 - bob); ctx.lineTo(8 + walk * 12, -2); ctx.lineTo(14 + walk * 12, 0); ctx.stroke();
      // lança: recua na preparação e avança no golpe
      let thrust = 0;
      if (a && this.state === 'attack') { const d = a.def; thrust = a.t < d.s ? -16 * (a.t / d.s) : a.t < d.s + d.a ? 34 : 10; }
      const hx = 30 + thrust, hy = -78 - bob;
      ctx.beginPath(); ctx.moveTo(-24, -84 - bob); ctx.lineTo(-34, -60 - bob); ctx.moveTo(24, -84 - bob); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = '#8a5a36'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx - 50, hy + 4); ctx.lineTo(hx + 40, hy - 2); ctx.stroke();
      ctx.fillStyle = fl ? '#fff' : '#c9d0dc'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(hx + 38, hy - 9); ctx.lineTo(hx + 60, hy - 3); ctx.lineTo(hx + 38, hy + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      // a carta
      ctx.save(); ctx.translate(0, -70 - bob); ctx.rotate(walk * 0.05); ctx.scale(this.facing, 1); // a face da carta nunca fica espelhada
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-27, -40, 54, 78, 7); else ctx.rect(-27, -40, 54, 78);
      ctx.fillStyle = fl ? '#ffffff' : '#f6f2e6'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      if (!fl) {
        ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.strokeRect(-22, -35, 44, 68);
        ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 12px Arial'; ctx.fillText(this.rank, -15, -27); ctx.fillText(this.suit, -15, -16);
        ctx.font = 'bold 30px Arial'; ctx.fillText(this.suit, 0, 18);
        // carinha brava
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(2, -14, 6, 7, 0, 0, Math.PI * 2); ctx.ellipse(16, -14, 5, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(4, -13, 2.5, 0, Math.PI * 2); ctx.arc(17, -13, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-4, -24); ctx.lineTo(8, -20); ctx.moveTo(12, -20); ctx.lineTo(22, -24); ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
      const tell = a && this.state === 'attack' && a.t < a.def.s ? a.t / a.def.s : -1;
      if (tell >= 0) TT.drawGlow(ctx, '#ff6a2a', x + this.facing * 40, y - 80, 14 + 20 * tell, 0.35 + 0.5 * tell);
    }
  }
  TT.CardSoldier = CardSoldier;

  // Soldado Congelador (fase 8): bate e recua; o raio congelante sai da arma em linha reta.
  class FreezeTrooper extends ShockTrooper {
    constructor(game, x, y) { super(game, x, y, 'freezer'); }
    draw(ctx, camX) {
      Fighter.prototype.draw.call(this, ctx, camX);
      const a = this.atk;
      if (!a || this.state !== 'attack' || a.def !== this.def.attacks[0] || this.dead) return;
      const d = a.def, x = this.x - camX + this.facing * 52, y = this.y - this.z - 82;
      if (a.t < d.s) { TT.drawGlow(ctx, '#9fe8ff', x, y, 12 + 26 * (a.t / d.s), 1); return; }
      if (a.t >= d.s + d.a + 4) return;
      const k = Math.min(1, (a.t - d.s + 1) / 3), L = 330 * k, fade = a.t >= d.s + d.a ? 1 - (a.t - d.s - d.a) / 4 : 1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.globalAlpha = fade;
      ctx.strokeStyle = '#5fc8ff'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + this.facing * L, this.y - 40); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + this.facing * L, this.y - 40); ctx.stroke();
      ctx.restore();
      for (let i = 0; i < 3; i++) { const u = Math.random() * k; this.game.particles.spawn('star', this.x + this.facing * (52 + u * 330), TT.lerp(this.y - this.z - 82, this.y - 40, u), { color: '#e6fbff', size: 7, life: 10, rot: Math.random() }); }
    }
  }
  TT.FreezeTrooper = FreezeTrooper;

  // Madame Rouge (fase 8): perna ou braços esticados (corpo elástico) durante o golpe.
  class MadameRouge extends ShockTrooper {
    constructor(game, x, y) { super(game, x, y, 'rouge'); this.radius = 22; }
    think() {
      super.think();
      if (!this.said && !this.entering && !this.dead) { this.said = true; this.game.say(this, 'Olá, Titãs... adeus, Titãs.', '#ff7a8a'); }
    }
    draw(ctx, camX) {
      const a = this.atk, d = a && a.def, x = this.x - camX, y = this.y - this.z;
      const act = a && this.state === 'attack' && d.stretch && a.t >= d.s && a.t < d.s + d.a + 4;
      if (act) {
        // membros elásticos: faixa preta com contorno e bota/luva vermelha na ponta
        const k = Math.min(1, (a.t - d.s + 1) / 3) * (a.t >= d.s + d.a ? 1 - (a.t - d.s - d.a) / 4 : 1);
        const limbs = d.stretch === 'leg' ? [[this.facing, 280 * k, y - 46]] : [[1, 140 * k, y - 96], [-1, 140 * k, y - 96]];
        ctx.save(); ctx.lineCap = 'round';
        for (const [dir, L, ly] of limbs) {
          const x1 = x + dir * L, wob = Math.sin(a.t * 0.9) * 10;
          ctx.strokeStyle = OUT; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(x, ly); ctx.quadraticCurveTo((x + x1) / 2, ly + wob, x1, ly); ctx.stroke();
          ctx.strokeStyle = '#1c1a22'; ctx.lineWidth = 10; ctx.stroke();
          ctx.fillStyle = '#d7263e'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(x1, ly, 14, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      }
      Fighter.prototype.draw.call(this, ctx, camX);
    }
  }
  TT.MadameRouge = MadameRouge;

  // Comando do Slade (fase 7): mesma tática de bate e recua, sempre com o bastão na mão.
  class SladeCommando extends ShockTrooper {
    constructor(game, x, y) { super(game, x, y, 'commando'); }
    draw(ctx, camX) { Fighter.prototype.draw.call(this, ctx, camX); }
  }
  TT.SladeCommando = SladeCommando;

  // Labareda cartoon (cabeça dos demônios, fogo de Trigon). s = altura.
  function drawFlame(ctx, x, y, s, t, seed) {
    const w = Math.sin(t * 0.3 + seed) * s * 0.12;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [col, k] of [['rgba(255,90,20,0.85)', 1], ['rgba(255,190,60,0.9)', 0.62], ['rgba(255,250,200,0.95)', 0.3]]) {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.32 * k, y);
      ctx.quadraticCurveTo(x - s * 0.4 * k, y - s * 0.5 * k, x + w, y - s * k);
      ctx.quadraticCurveTo(x + s * 0.4 * k, y - s * 0.45 * k, x + s * 0.32 * k, y);
      ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    }
    ctx.restore();
  }
  TT.drawFlame = drawFlame;

  // Demônio de Fogo (fase 7): corpo de rocha com rachaduras de lava e a cabeça em chamas.
  class FireDemon extends ShockTrooper {
    constructor(game, x, y) { super(game, x, y, 'demon'); this.seed = Math.random() * 6; }
    die(dir, d) {
      super.die(dir, d);
      for (let i = 0; i < 10; i++) this.game.particles.spawn('spark', this.x + TT.rand(-20, 20), this.y - TT.rand(20, 110), { vx: TT.rand(-4, 4), vy: TT.rand(-6, -1), color: TT.choice(['#ff7a1a', '#ffd23a', '#ffffff']), size: 4, life: 20, grav: 0.15 });
    }
    draw(ctx, camX) {
      Fighter.prototype.draw.call(this, ctx, camX);
      if (this.dead && this.state === 'down' && this.st > 25 && (this.st >> 2) % 2 === 0) return;
      const t = this.animT, x = this.x - camX, y = this.y - this.z;
      // chamas saindo da cabeça e brilho das rachaduras
      const hx = x + this.facing * 4, hy = y - this.height + 6;
      TT.drawGlow(ctx, FIRE, hx, hy - 10, 60, 0.55);
      drawFlame(ctx, hx - this.facing * 6, hy - 6, 46, t, this.seed);
      // bola de fogo: cresce na mão e cai no círculo marcado no fim do aviso
      const a = this.atk;
      if (a && a.def === this.def.attacks[0] && this.state === 'attack' && a.zones) {
        const d = a.def, z = a.zones[0];
        if (a.t < d.s - 10) TT.drawGlow(ctx, FIRE, x + this.facing * 30, y - 130, 14 + 20 * (a.t / d.s), 1);
        else if (a.t < d.s) {
          const u = (a.t - (d.s - 10)) / 10, fx = z.x - camX + (1 - u) * -this.facing * 40, fy = z.y - 320 * (1 - u);
          TT.drawGlow(ctx, FIRE, fx, fy, 46, 1);
          drawFlame(ctx, fx, fy + 18, 50, t, 1);
        }
      }
    }
  }
  TT.FireDemon = FireDemon;

  // Raio em zigue-zague entre dois pontos (para efeitos elétricos).
  function drawArc(ctx, x0, y0, x1, y1, col, w, segs) {
    segs = segs || 6;
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    for (let i = 1; i < segs; i++) {
      const q = i / segs, j = (Math.random() - 0.5) * Math.min(28, l * 0.25);
      ctx.lineTo(x0 + dx * q + nx * j, y0 + dy * q + ny * j);
    }
    ctx.lineTo(x1, y1);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
    ctx.strokeStyle = col; ctx.lineWidth = w * 2.4; ctx.globalAlpha = 0.35; ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w; ctx.stroke();
    ctx.restore();
  }
  TT.drawArc = drawArc;

  // ================================================================ Avisos de ataque (zonas no chão)
  // Zonas no plano do chão: 'rect' (faixa), 'ell' (elipse/círculo) e 'half' (arco à frente).
  // A MESMA zona é usada para desenhar o aviso e para decidir o acerto (pé do alvo dentro da zona).
  TT.zoneHas = function (z, x, y) {
    if (z.k === 'rect') return x >= Math.min(z.x0, z.x1) && x <= Math.max(z.x0, z.x1) && Math.abs(y - z.y) <= z.d;
    if (z.k === 'ring') { const d = Math.hypot(x - z.x, (y - z.y) / z.ry); return d >= z.r0 && d <= z.r1; }
    if (z.k === 'half' && (x - z.x) * z.f < 0) return false;
    const dx = (x - z.x) / z.rx, dy = (y - z.y) / z.ry;
    return dx * dx + dy * dy <= 1;
  };
  function zonePath(ctx, z, camX, k) {
    ctx.beginPath();
    if (z.k === 'rect') {
      const x0 = z.x0 - camX, x1 = z.x0 + (z.x1 - z.x0) * k - camX;
      ctx.rect(Math.min(x0, x1), z.y - z.d, Math.abs(x1 - x0), z.d * 2);
    } else if (z.k === 'ring') {
      // anel: borda externa + furo (preenchido com 'evenodd')
      const r1 = z.r0 + (z.r1 - z.r0) * k;
      ctx.ellipse(z.x - camX, z.y, r1, r1 * z.ry, 0, 0, Math.PI * 2);
      ctx.moveTo(z.x - camX + z.r0, z.y);
      ctx.ellipse(z.x - camX, z.y, z.r0, z.r0 * z.ry, 0, 0, Math.PI * 2, true);
    } else if (z.k === 'half') {
      const a0 = z.f > 0 ? -Math.PI / 2 : Math.PI / 2;
      ctx.moveTo(z.x - camX, z.y);
      ctx.ellipse(z.x - camX, z.y, z.rx * k, z.ry * k, 0, a0, a0 + Math.PI);
      ctx.closePath();
    } else {
      ctx.ellipse(z.x - camX, z.y, z.rx * k, z.ry * k, 0, 0, Math.PI * 2);
    }
  }
  // k = progresso do aviso (0..1): a zona vai se preenchendo até o impacto.
  TT.drawZone = function (ctx, z, camX, k, t, rgb) {
    rgb = rgb || '255,40,40';
    k = TT.clamp(k, 0, 1);
    const late = k > 0.7, blink = late ? (t >> 1) % 2 === 0 : (t >> 3) % 2 === 0;
    ctx.save();
    zonePath(ctx, z, camX, 1);
    ctx.fillStyle = 'rgba(' + rgb + ',0.13)'; ctx.fill();
    zonePath(ctx, z, camX, Math.max(0.03, k));
    ctx.fillStyle = 'rgba(' + rgb + ',' + (0.18 + 0.27 * k) + ')'; ctx.fill();
    if (z.rings) {
      ctx.strokeStyle = 'rgba(' + rgb + ',0.55)'; ctx.lineWidth = 2;
      for (let i = 1; i < z.rings; i++) {
        const f = i / z.rings;
        ctx.beginPath(); ctx.ellipse(z.x - camX, z.y, z.rx * f, z.ry * f, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (z.k === 'rect' && z.arrows) {
      const dir = Math.sign(z.x1 - z.x0) || 1, len = Math.abs(z.x1 - z.x0), h = z.d * 0.55;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.25 + 0.35 * k) + ')'; ctx.lineWidth = 5;
      for (let s = (t * 4) % 90; s < len - 20; s += 90) {
        const x = z.x0 + dir * s - camX;
        ctx.beginPath(); ctx.moveTo(x, z.y - h); ctx.lineTo(x + dir * h, z.y); ctx.lineTo(x, z.y + h); ctx.stroke();
      }
    }
    zonePath(ctx, z, camX, 1);
    ctx.lineWidth = late ? 4 : 3;
    ctx.strokeStyle = blink ? 'rgba(255,255,255,0.95)' : 'rgba(' + rgb + ',0.95)';
    if (!late) ctx.setLineDash([16, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  };

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
    // Aplica a dificuldade: vida e duração do aviso (wind-up) de cada ataque.
    // Os onFrame usam this.s (o "s" já escalado), nunca números fixos.
    applyDifficulty() {
      const df = this.game.diff;
      this.hp = this.maxHp = Math.round(this.maxHp * df.bossHp);
      for (const k in this.ATK) {
        const d = this.ATK[k];
        d.s0 = d.s;
        d.s = Math.max(6, Math.round(d.s * df.windup));
      }
    }
    nextCool(a, b) { return Math.round(TT.randi(a, b) * this.game.diff.bossCool); }
    startAttack(def) {
      super.startAttack(def);
      const a = this.atk;
      a.zones = def.zone ? def.zone.call(def, this, this.game, a) : null;
    }
    // Progresso do aviso (0..1) durante a preparação do golpe; -1 fora dela.
    tellK() {
      const a = this.atk;
      if (!a || this.state !== 'attack' || a.t >= a.def.s) return -1;
      return a.t / a.def.s;
    }
    // Pisca em branco no fim da preparação.
    tellFlash() { const k = this.tellK(); return k > 0.62 && (this.atk.t >> 1) % 3 === 0; }
    // Tremor de "carregando" durante a preparação.
    tellShake() { const k = this.tellK(); return k > 0 ? Math.sin(this.atk.t * 1.7) * k * 3 : 0; }
    // Marcação no chão: área exata que o golpe vai atingir.
    drawGround(ctx, camX) {
      const a = this.atk;
      if (!a || !a.zones || this.state !== 'attack') return;
      const d = a.def;
      if (a.t >= d.s + d.a) return;
      const k = a.t < d.s ? a.t / d.s : 1;
      for (const z of a.zones) TT.drawZone(ctx, z, camX, k, a.t);
    }
    // Brilho na cor do ataque + "!" estilo HQ sobre a cabeça.
    drawTell(ctx, sx, sy, headY) {
      const k = this.tellK();
      if (k < 0) return;
      const a = this.atk, col = a.def.color || '#ff3b30', t = a.t;
      TT.drawGlow(ctx, col, sx, sy - this.height * 0.5, this.height * (0.6 + 0.3 * k) * (0.92 + 0.08 * Math.sin(t * 0.7)), 0.3 + 0.45 * k);
      const pop = Math.min(1, t / 5) * (1 + 0.18 * k), bob = Math.sin(t * 0.35) * 3;
      ctx.save(); ctx.translate(sx, (headY != null ? headY : sy - this.height) - 46 + bob); ctx.scale(pop, pop);
      TT.drawBurst(ctx, 0, 0, 36, 9, k > 0.62 && (t >> 1) % 2 ? '#ffffff' : '#ffe14a', OUT, 0.15);
      TT.drawText(ctx, '!', 0, 3, 46, '#ff2a2a', OUT, 'center', 6);
      ctx.restore();
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
  TT.Boss = Boss;

  // Alvo no chão perto de um Titã, dentro da tela.
  function groundTarget(g, p, spreadX, spreadY) {
    return {
      x: TT.clamp(p.x + TT.rand(-spreadX, spreadX), g.camX + 60, g.camX + TT.W - 60),
      y: TT.clamp(p.y + TT.rand(-spreadY, spreadY), TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM - 4),
    };
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
        // soco giratório: arco à frente (a hitbox é a própria zona)
        swipe: { pose: 'bigSwing', s: 28, a: 6, r: 26, dmg: 16, reach: [0, 175], depth: 55, kb: 11, knockdown: true, launch: 7, sound0: 'roar', color: '#ff8a3a',
          zoneHit: true,
          zone(f) { return [{ k: 'half', x: f.x, y: f.y, rx: 205, ry: 58, f: f.facing }]; },
          onFrame(f, t, g) { if (t === this.s) { A().play('hitHeavy'); g.impact(f.x + f.facing * 130, f.y, 'WHAM!', '#ff8a3a', 0.9); } } },
        // salto + onda de choque: anéis no chão (pule!)
        pound: { pose: 'bigSlam', s: 32, a: 2, r: 34, color: '#ffd23a',
          zone(f) { return [{ k: 'ell', x: f.x, y: f.y, rx: 620, ry: 620 * 0.38, rings: 5, jump: true }]; },
          onFrame(f, t, g) {
            if (t === Math.max(2, this.s - 20)) { f.vz = 11; f.z = 1; }
            if (t === this.s) {
              A().play('shockwave'); g.addEffect(new Shockwave(g, f.x, f.y, 620, 14, 'enemy'));
              g.dust(f.x, f.y, 14, '#b9aa9a'); g.debrisBurst(f.x, f.y - 20, 10, '#8e8880');
              g.impact(f.x, f.y, 'KRA-BUM!', '#ffd23a', 1.4);
            }
          } },
        // investida: faixa na linha da investida até a parede
        charge: { pose: 'bigCharge', s: 30, a: 54, r: 30, dmg: 18, reach: [0, 90], depth: 50, kb: 12, knockdown: true, launch: 7, lunge: 10.5, sound0: 'roar', color: '#ff4a3a',
          zone(f, g) {
            const R = g.camX + TT.W - 70, L = g.camX + 70;
            return [{ k: 'rect', x0: f.x - f.facing * 24, x1: f.facing > 0 ? R + 130 : L - 130, y: f.y, d: 50, arrows: true }];
          },
          onFrame(f, t, g) {
            const run = t > this.s && t < this.s + this.a;
            if (t === this.s) g.impact(f.x, f.y, 'VRUUUM!', '#ff4a3a', 0.5);
            if (run && t % 4 === 0) { g.dust(f.x - f.facing * 50, f.y, 2, '#b9aa9a'); g.shake = Math.max(g.shake, 3); }
            const L = g.camX + 70, R = g.camX + TT.W - 70;
            if (run && ((f.facing > 0 && f.x > R) || (f.facing < 0 && f.x < L))) {
              // bate na parede e fica atordoado
              f.x = TT.clamp(f.x, L, R); f.atk = null; A().play('boom');
              g.debrisBurst(f.x + f.facing * 60, f.y - 120, 12, '#8e8880');
              g.impact(f.x + f.facing * 60, f.y, 'CRASH!', '#ffae3a', 1.3);
              f.setState('stagger'); f.setAnim('hurt'); f.st = -40; f.vx = -f.facing * 4;
            }
          } },
        // arremesso de pedra: alvo no chão onde ela vai cair (segue o Titã até a metade do aviso)
        throw: { pose: 'bigThrow', s: 26, a: 1, r: 26, color: '#c9a27a',
          aim(f, g, a) {
            const p = g.targetFor(f);
            if (p) { a.tx = TT.clamp(p.x, g.camX + 60, g.camX + TT.W - 60); a.ty = TT.clamp(p.y, TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM); }
            else if (a.tx == null) { a.tx = f.x + f.facing * 300; a.ty = f.y; }
            return { k: 'ell', x: a.tx, y: a.ty, rx: 90, ry: 90 * 0.42 };
          },
          zone(f, g, a) { return [this.aim(f, g, a)]; },
          onFrame(f, t, g, a) {
            if (t === 4) g.debrisBurst(f.x, f.y - 10, 6, '#8e8880');
            if (t < this.s * 0.55) a.zones = [this.aim(f, g, a)];
            if (t === this.s) {
              const z = a.zones[0], T = 48, z0 = 190, gr = 0.6, x0 = f.x + f.facing * 40;
              g.addProjectile(new Projectile(g, {
                kind: 'boulder', team: 'enemy', owner: f, x: x0, y: f.y, z: z0,
                vx: (z.x - x0) / T, vy: (z.y - f.y) / T, vz: (0.5 * gr * T * T - z0) / T, grav: gr,
                r: 30, dmg: 14, kb: 6, knockdown: true, launch: 6, life: 120, explodeOnGround: 90,
                zone: z, flight: T, impactWord: 'BOOM!',
              }));
              a.zones = null; // daqui em diante a pedra desenha o alvo
              A().play('whoosh');
            }
          } },
      };
      this.applyDifficulty();
    }
    think() {
      if (this.commonBoss()) return;
      if (this.state === 'down' || this.state === 'hurt') { this.setState('idle'); }
      const g = this.game, p = g.targetFor(this);
      if (this.state === 'attack') { this.updateAttack(); return; }
      if (!this.active || !p) { this.vx = this.vy = 0; this.setAnim('idle'); return; }
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
        this.cool = p2 ? this.nextCool(40, 70) : this.nextCool(70, 110);
      }
    }
    draw(ctx, camX) {
      if (this.state === 'dying' && (this.st >> 2) % 2 === 0) ctx.globalAlpha = 0.7;
      TT.computePose(this, this.pose);
      if (this.state === 'stagger') { this.pose.lean = -0.3; this.pose.tilt = -0.3; }
      const x = this.x - camX + this.tellShake(), y = this.y - this.z;
      // squash-and-stretch: agacha na preparação, estica no golpe
      const k = this.tellK(), a = this.atk;
      let sq = 0;
      if (k >= 0) sq = -0.07 * TT.easeOut(k);
      else if (a && a.t < a.def.s + a.def.a + 6) sq = 0.06;
      ctx.save(); ctx.translate(x, y); ctx.scale(1 - sq, 1 + sq); ctx.translate(-x, -y);
      TT.drawRig(ctx, this.style, this.pose, x, y, this.facing, { flash: this.flash > 3 || this.tellFlash(), t: this.animT });
      ctx.restore();
      ctx.globalAlpha = 1;
      // pedra erguida acima da cabeça durante a preparação do arremesso
      if (k >= 0 && a.def === this.ATK.throw) {
        const ry = y - this.height + 10 - 14 * TT.easeOut(k);
        drawBoulder(ctx, x - this.facing * 26, ry, 1.3, a.t * 0.05);
      }
      this.drawTell(ctx, x, y, y - this.height - 50);
      if (this.state === 'stagger') this.drawDizzy(ctx, x, y - this.height - 10);
    }
    drawDizzy(ctx, x, y) {
      for (let i = 0; i < 3; i++) {
        const a = this.animT * 0.12 + i * 2.1;
        TT.drawBurst(ctx, x + Math.cos(a) * 34, y + Math.sin(a) * 9, 9, 5, '#ffe14a', OUT, a);
      }
    }
  }
  TT.Cinderblock = Cinderblock;

  function drawBoulder(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.fillStyle = '#8e8880'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-28, -8); ctx.lineTo(-12, -26); ctx.lineTo(16, -24); ctx.lineTo(30, -2); ctx.lineTo(18, 22); ctx.lineTo(-14, 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a7a199'; ctx.beginPath(); ctx.moveTo(-20, -8); ctx.lineTo(-10, -20); ctx.lineTo(10, -19); ctx.lineTo(0, -6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6f6a63'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(6, 4); ctx.lineTo(2, 14); ctx.stroke();
    ctx.restore();
  }

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
        // broca: faixa à frente cobrindo todo o avanço
        drill: { pose: 'jab', s: 34, a: 34, r: 30, lunge: 8, dmg: 6, rehit: 8, reach: [40, 210], depth: 48, kb: 4, stun: 14, sound0: 'drill', color: '#ffcf5a',
          zone(f, g) {
            const minX = g.camX + f.radius, maxX = g.camX + TT.W - f.radius;
            const xe = TT.clamp(f.x + f.facing * (26 * 8 + 8 * 6 + 16), minX, maxX);
            return [{ k: 'rect', x0: f.x + f.facing * 16, x1: xe + f.facing * 234, y: f.y, d: 48, arrows: true }];
          },
          onFrame(f, t, g) {
            f.drillSpin += t < this.s ? 0.2 + t * 0.02 : 1.1;
            if (t === this.s) g.impact(f.x + f.facing * 200, f.y, 'VRRRR!', '#ffcf5a', 0.5);
            if (t >= this.s && t < this.s + this.a && t % 4 === 0) { A().play('drill'); g.particles.spawn('spark', f.x + f.facing * 200, f.y - 90, { vx: f.facing * TT.rand(3, 9), vy: TT.rand(-6, 1), color: '#ffcf5a', size: 3, life: 14, grav: 0.4 }); }
            if (t === this.s + 26) { const z = f.atk.zones; f.atk.def = f.ATK.drillEnd; f.atk.zones = z; }
          } },
        drillEnd: { pose: 'jab', s: 34, a: 34, r: 30, lunge: 6, dmg: 9, reach: [40, 210], depth: 48, kb: 9, knockdown: true, launch: 6, color: '#ffcf5a' },
        // chuva de mísseis: cada míssil marca um círculo no chão
        missiles: { pose: 'castUp', s: 24, a: 1, r: 40, color: '#ff4a3a',
          onFrame(f, t, g) {
            if (t === 1) A().play('alarm');
            const n = f.phase2() ? 7 : 4;
            if (t >= this.s && t < this.s + n * 6 && (t - this.s) % 6 === 0) {
              const p = g.targetFor(f, true); if (!p) return;
              const tp = groundTarget(g, p, 160, 60);
              g.addProjectile(new Projectile(g, { kind: 'missile', team: 'enemy', owner: f, x: tp.x, y: tp.y, z: 700, vz: -12, grav: 0, r: 0, dmg: 0, life: 200,
                explodeOnGround: 85, blastDmg: 12, zone: { k: 'ell', x: tp.x, y: tp.y, rx: 85, ry: 85 * 0.42 }, flight: 58, impactWord: 'BOOM!' }));
              A().play('laser');
            }
          } },
        drones: { pose: 'castUp', s: 20, a: 1, r: 30, color: '#9effa8',
          onFrame(f, t, g) {
            if (t === this.s) {
              for (let i = 0; i < 2; i++) {
                const d = new Drone(g, f.x + TT.rand(-40, 40), f.y + (i ? 30 : -30));
                d.z = 160; d.vz = 0;
                g.addEnemy(d);
              }
              g.say(f, TT.choice(f.taunts), '#9effa8');
            }
          } },
        // laser (fase 2): faixa piscando em toda a tela
        laser: { pose: 'beam', s: 40, a: 34, r: 24, dmg: 5, rehit: 6, reach: [60, 1300], depth: 24, kb: 3, zr: 50, sound: 'sonic', color: '#ff3a3a',
          zone(f) { return [{ k: 'rect', x0: f.x + f.facing * 36, x1: f.x + f.facing * 1324, y: f.y, d: 24 }]; },
          onFrame(f, t, g) { if (t === this.s) g.impact(f.x + f.facing * 90, f.y, 'ZZZAP!', '#ff3a3a', 0.6); } },
      };
      this.applyDifficulty();
    }
    think() {
      this.drillSpin += 0.05;
      if (this.commonBoss()) return;
      if (this.state === 'down' || this.state === 'hurt') this.setState('idle');
      const g = this.game, p = g.targetFor(this);
      if (this.state === 'attack') { this.updateAttack(); return; }
      if (!this.active || !p) { this.vx = this.vy = 0; this.setAnim('idle'); return; }
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
        this.cool = p2 ? this.nextCool(45, 75) : this.nextCool(70, 110);
        if (Math.random() < 0.25) g.say(this, TT.choice(this.taunts), '#9effa8');
      }
    }
    draw(ctx, camX) {
      const x = this.x - camX + this.tellShake(), y = this.y - this.z, t = this.animT, fl = this.flash > 3 || this.tellFlash();
      const col = (c) => (fl ? '#ffffff' : c);
      if (this.state === 'dying' && (this.st >> 2) % 2 === 0) ctx.globalAlpha = 0.75;
      const a = this.atk, tk = this.tellK();
      const walking = this.anim === 'walk';
      ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, 1);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // agacha durante a preparação (pose exagerada)
      const crouch = tk >= 0 ? TT.easeOut(tk) * 22 : 0;
      const bodyY = -120 + Math.sin(t * 0.1) * 3 + crouch;
      // pernas
      for (let i = 0; i < 4; i++) {
        const back = i < 2;
        const base = [-60, 40, -30, 70][i];
        const ph = walking ? Math.sin(t * 0.2 + i * 1.6) * 16 : 0;
        const fx = base + ph + (base > 0 ? 1 : -1) * crouch * 0.8, kx = base * 0.75 + (base > 0 ? 25 : -25) + (base > 0 ? 1 : -1) * crouch, ky = bodyY - 20;
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
      // casulo de mísseis na traseira (abre ao preparar a chuva de mísseis)
      const pod = a && a.def === this.ATK.missiles && a.t < a.def.s + 30;
      ctx.fillStyle = col('#3e4652'); ctx.fillRect(-90, bodyY - 60 - (pod ? 14 : 0), 50, 34); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(-90, bodyY - 60 - (pod ? 14 : 0), 50, 34);
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-80 + k * 15, bodyY - 43 - (pod ? 14 : 0), 5, 0, Math.PI * 2); ctx.fillStyle = col('#ff4a3a'); ctx.fill(); }
      if (pod && !fl) TT.drawGlow(ctx, '#ff4a3a', -65, bodyY - 60, 40 + Math.sin(a.t * 0.8) * 8, 0.9);
      // cabine com o Gizmo
      ctx.beginPath(); ctx.arc(10, bodyY - 48, 40, Math.PI, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = 'rgba(140,220,255,0.35)'; ctx.fill();
      this.drawGizmo(ctx, 10, bodyY - 52, fl);
      ctx.beginPath(); ctx.arc(10, bodyY - 48, 40, Math.PI, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = 'rgba(200,240,255,0.18)'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-6, bodyY - 70, 10, 5, -0.5, 0, Math.PI * 2); ctx.fill();
      // braço-broca (recua na preparação e avança no golpe)
      const drilling = a && (a.def === this.ATK.drill || a.def === this.ATK.drillEnd);
      const extend = drilling ? (a.t < a.def.s ? -TT.easeOut(a.t / a.def.s) * 26 : 30) : 0;
      ctx.save(); ctx.translate(70 + extend, bodyY + 4);
      ctx.fillStyle = col('#7c8798'); ctx.fillRect(-20, -16, 40, 32); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(-20, -16, 40, 32);
      ctx.beginPath(); ctx.moveTo(18, -26); ctx.lineTo(120, 0); ctx.lineTo(18, 26); ctx.closePath();
      ctx.fillStyle = col('#c9ced8'); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 6;
      const sp = (this.drillSpin * 20) % 24;
      for (let k = -24; k < 120; k += 24) { ctx.beginPath(); ctx.moveTo(k + sp, -30); ctx.lineTo(k + sp + 16, 30); ctx.stroke(); }
      ctx.restore();
      if (drilling && !fl) TT.drawGlow(ctx, '#ffcf5a', 110, 0, 30 + (a.t < a.def.s ? a.t : 20), 0.8);
      ctx.restore();
      // olho-laser
      const charging = a && a.def === this.ATK.laser;
      ctx.beginPath(); ctx.arc(76, bodyY - 26, 12, 0, Math.PI * 2); ctx.fillStyle = '#200'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(78, bodyY - 26, 7, 0, Math.PI * 2); ctx.fillStyle = '#ff3030'; ctx.fill();
      TT.drawGlow(ctx, '#ff3030', 78, bodyY - 26, charging ? 30 + Math.min(a.t, 60) : 16, 1);
      ctx.restore();
      ctx.globalAlpha = 1;
      // feixe laser (fase 2)
      if (charging) {
        const d = a.def, oy = y + bodyY - 26;
        if (a.t < d.s) {
          ctx.strokeStyle = 'rgba(255,60,60,' + (0.4 + (a.t % 6 < 3 ? 0.5 : 0)) + ')'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
          ctx.beginPath(); ctx.moveTo(x + this.facing * 90, oy); ctx.lineTo(x + this.facing * 1400, oy); ctx.stroke(); ctx.setLineDash([]);
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
      this.drawTell(ctx, x, y, y + bodyY - 100);
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

  // ---- Overload: criatura de eletricidade pura com um chip no peito (fase 3)
  // Fraqueza: depois do teleporte ele superaquece — fica parado com o CHIP EXPOSTO e leva dano dobrado.
  class Overload extends Boss {
    constructor(game, x, y) {
      super(game, x, y);
      this.name = 'OVERLOAD';
      this.hp = this.maxHp = 1100;
      this.radius = 64; this.height = 240; this.shadowW = 95;
      this.poiseMax = 160;
      this.def = { score: 7000 };
      this.exposed = 0; this.alpha = 1; this.atkCount = 0; this.p2Said = false;
      this.taunts = ['ENERGIA... MAIS ENERGIA!', 'Vou fritar vocês!', 'Zzzzt... Titãs!', 'Sintam a voltagem!'];
      const clampX = (g, x, m) => TT.clamp(x, g.camX + m, g.camX + TT.W - m);
      this.ATK = {
        // raio em linha: faixa até a borda da tela (2 faixas na fase 2)
        bolt: { pose: 'beam', s: 40, a: 14, r: 26, dmg: 14, knockdown: true, launch: 6, kb: 8, zoneHit: true, shock: true, zr: 60, color: '#6fe3ff', sound: 'thunder',
          zone(f, g) {
            const end = f.facing > 0 ? g.camX + TT.W + 40 : g.camX - 40;
            const zs = [{ k: 'rect', x0: f.x + f.facing * 40, x1: end, y: f.y, d: 30 }];
            if (f.phase2()) {
              const mid = (TT.FLOOR_TOP + TT.FLOOR_BOTTOM) / 2, y2 = TT.clamp(f.y + (f.y < mid ? 92 : -92), TT.FLOOR_TOP + 36, TT.FLOOR_BOTTOM - 30);
              zs.push({ k: 'rect', x0: f.x + f.facing * 40, x1: end, y: y2, d: 30 });
            }
            return zs;
          },
          onFrame(f, t, g) { if (t === this.s) g.impact(f.x + f.facing * 220, f.y, 'KZZZAK!', '#6fe3ff', 0.9); } },
        // poças elétricas: círculos no chão sob os Titãs (e alguns aleatórios) que explodem em pilares
        puddles: { pose: 'slam', s: 44, a: 8, r: 30, dmg: 12, knockdown: true, launch: 7, kb: 5, zoneHit: true, shock: true, zr: 40, color: '#ffe14a',
          zone(f, g) {
            const zs = [], hs = g.heroes(), n = f.phase2() ? 5 : 3;
            for (const h of hs) zs.push({ k: 'ell', x: clampX(g, h.x, 60), y: h.y, rx: 72, ry: 30 });
            let guard = 0;
            while (zs.length < n && guard++ < 20) {
              const tp = groundTarget(g, TT.choice(hs) || f, 330, 100);
              if (zs.every((z) => Math.abs(z.x - tp.x) > 120 || Math.abs(z.y - tp.y) > 50)) zs.push({ k: 'ell', x: tp.x, y: tp.y, rx: 72, ry: 30 });
            }
            return zs;
          },
          onFrame(f, t, g, a) {
            if (t === this.s) {
              for (const z of a.zones) { g.impact(z.x, z.y, null, '#ffe14a', 0.35); g.particles.spawn('ring', z.x, z.y, { size: 90, color: '#fff3a0', life: 14, flat: 0.42 }); }
              g.particles.spawn('text', f.x, f.y - 290, { text: 'ZZZZT!', size: 50, color: '#ffe14a', color2: '#2a7bff', vy: -0.5, life: 44, rot: -0.1 });
              A().play('thunder');
            }
          } },
        // teleporte: some em faíscas e reaparece com uma descarga no alvo marcado
        teleport: { pose: 'castUp', s: 46, a: 6, r: 22, dmg: 16, knockdown: true, launch: 9, kb: 9, zoneHit: true, shock: true, zr: 50, color: '#c08cff',
          aim(f, g, a) {
            const p = g.targetFor(f);
            if (p) { a.tx = clampX(g, p.x, f.radius + 20); a.ty = TT.clamp(p.y, TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM); }
            else if (a.tx == null) { a.tx = f.x; a.ty = f.y; }
            return { k: 'ell', x: a.tx, y: a.ty, rx: 125, ry: 50 };
          },
          zone(f, g, a) { return [this.aim(f, g, a)]; },
          onFrame(f, t, g, a) {
            if (t < this.s * 0.5) a.zones = [this.aim(f, g, a)];
            if (t < this.s) {
              f.alpha = Math.max(0.15, 1 - t / (this.s * 0.45));
              if (f.alpha < 0.5) f.invul = 2;
              if (t % 3 === 0) g.particles.spawn('spark', f.x + TT.rand(-60, 60), f.y - TT.rand(20, 220), { vx: TT.rand(-3, 3), vy: TT.rand(-6, -1), color: '#bff6ff', size: 3, life: 14 });
              if (t === 2) A().play('zap');
            }
            if (t === this.s) {
              f.x = a.tx; f.y = a.ty; f.alpha = 1; f.invul = 0;
              g.impact(f.x, f.y, 'KA-ZAP!', '#c08cff', 1.3); A().play('thunder');
            }
            if (t === this.s + this.a + this.r - 1) f.overheat();
          } },
        // anel de descarga (fase 2): seguro colado nele ou bem longe
        ring: { pose: 'castUp', s: 38, a: 5, r: 28, dmg: 13, knockdown: true, launch: 8, kb: 8, zoneHit: true, shock: true, zr: 50, color: '#ff5af0',
          zone(f) { return [{ k: 'ring', x: f.x, y: f.y, r0: 150, r1: 340, ry: 0.4 }]; },
          onFrame(f, t, g) {
            if (t === this.s) {
              g.impact(f.x, f.y, 'VRA-KOOM!', '#ff5af0', 1.1);
              for (const r of [180, 250, 320]) g.particles.spawn('ring', f.x, f.y, { size: r, color: '#ffb0f6', life: 16, flat: 0.4 });
              A().play('thunder');
            }
          } },
      };
      this.applyDifficulty();
    }
    // Chip exposto = dano dobrado.
    get dmgTaken() { return this.exposed > 0 ? 2 : 1; }
    overheat() {
      const g = this.game;
      this.atk = null;
      this.setState('overheat'); this.setAnim('hurt');
      this.exposed = 150; this.vx = this.vy = 0;
      g.say(this, 'Nããão... meu chip!', '#bff6ff');
      A().play('zap');
    }
    onArmorHit(dmg, d) {
      if (this.state === 'overheat') return; // não interrompe a fraqueza
      super.onArmorHit(dmg, d);
    }
    think() {
      if (this.commonBoss()) return;
      const g = this.game;
      if (this.state === 'overheat') {
        this.vx *= 0.8; this.vy *= 0.8;
        if (this.st % 4 === 0) g.particles.spawn('spark', this.x + TT.rand(-40, 40), this.y - TT.rand(120, 190), { vx: TT.rand(-4, 4), vy: TT.rand(-6, 0), color: TT.choice(['#bff6ff', '#ffe14a']), size: 3, life: 14, grav: 0.3 });
        if (--this.exposed <= 0) { this.exposed = 0; this.setState('idle'); this.setAnim('idle'); this.cool = 30; }
        return;
      }
      if (this.state === 'down' || this.state === 'hurt') this.setState('idle');
      const p = g.targetFor(this);
      if (this.state === 'attack') { this.updateAttack(); return; }
      this.alpha = 1;
      if (!this.active || !p) { this.vx = this.vy = 0; this.setAnim('idle'); return; }
      const dx = p.x - this.x, dy = p.y - this.y;
      this.facing = dx > 0 ? 1 : -1;
      const p2 = this.phase2();
      if (p2 && !this.p2Said) {
        this.p2Said = true;
        g.say(this, 'SOBRECARGA TOTAL!', '#ff5af0');
        g.impact(this.x, this.y, 'SOBRECARGA!', '#ff5af0', 1);
      }
      this.dmgMul = p2 ? 1.15 : 1;
      if (this.cool > 0) this.cool--;
      this.approach(this.sideTarget(p, 230), p.y, p2 ? 2.4 : 1.7);
      if (this.cool <= 0) {
        this.vx = this.vy = 0;
        let pick;
        // a cada 3 ataques vem o teleporte (e a fraqueza logo depois)
        if (this.atkCount % 3 === 2) pick = 'teleport';
        else {
          const opts = ['puddles', 'bolt'];
          if (Math.abs(dy) < 40) opts.push('bolt');
          if (p2) opts.push('ring', 'ring');
          pick = TT.choice(opts);
        }
        this.atkCount++;
        this.startAttack(this.ATK[pick]);
        this.cool = p2 ? this.nextCool(40, 70) : this.nextCool(70, 105);
        if (Math.random() < 0.3) g.say(this, TT.choice(this.taunts), '#bff6ff');
      }
    }
    // Posições dos punhos conforme o golpe (pose exagerada na preparação).
    fists() {
      const a = this.atk, t = this.animT, idle = [[96, -112 + Math.sin(t * 0.1) * 6], [-94, -114 - Math.sin(t * 0.1) * 6]];
      if (!a || this.state !== 'attack') {
        if (this.state === 'overheat') return [[60, -60], [-60, -62]];
        return idle;
      }
      const d = a.def, k = a.t < d.s ? TT.easeOut(a.t / d.s) : 1, hit = a.t >= d.s;
      const L = (p, q, u) => [TT.lerp(p[0], q[0], u), TT.lerp(p[1], q[1], u)];
      if (d === this.ATK.bolt) return hit ? [[168, -150], [-90, -120]] : [L(idle[0], [-10, -214], k), L(idle[1], [-120, -150], k)];
      if (d === this.ATK.puddles) return hit ? [[118, -16], [-96, -16]] : [L(idle[0], [44, -300], k), L(idle[1], [-44, -300], k)];
      if (d === this.ATK.ring) return hit ? [[178, -210], [-178, -210]] : [L(idle[0], [26, -156], k), L(idle[1], [-26, -150], k)];
      return [L(idle[0], [20, -290], k), L(idle[1], [-20, -290], k)];
    }
    draw(ctx, camX) {
      const t = this.animT, a = this.atk, tk = this.tellK();
      const x = this.x - camX + this.tellShake(), y = this.y - this.z - 14 + Math.sin(t * 0.08) * 5; // flutua
      const fl = this.flash > 3 || this.tellFlash();
      let al = this.alpha;
      if (this.state === 'dying' && (this.st >> 2) % 2 === 0) al *= 0.6;
      const sq = tk >= 0 ? -0.06 * tk : a && this.state === 'attack' && a.t < a.def.s + a.def.a + 6 ? 0.06 : 0;
      ctx.save(); ctx.globalAlpha = al;
      TT.drawGlow(ctx, '#2a8cff', x, y - 120, 175 + Math.sin(t * 0.2) * 12, 0.6);
      ctx.translate(x, y); ctx.scale(this.facing * (1 - sq), 1 + sq);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const jit = (i) => Math.sin(t * 0.9 + i * 1.7) * 3 + Math.sin(t * 2.3 + i) * 1.5;
      const SIL = [[0, 0], [-12, -10], [8, -24], [-8, -38], [26, -62], [40, -100], [62, -140], [88, -170], [98, -192], [70, -208], [36, -202], [30, -232], [6, -248], [-22, -240], [-30, -206], [-70, -212], [-98, -190], [-88, -166], [-60, -140], [-40, -100], [-28, -62], [-10, -40], [-18, -22]];
      const body = (s, cy) => {
        ctx.beginPath();
        SIL.forEach(([px, py], i) => { const X = px * s + jit(i), Y = cy + (py - cy) * s + jit(i + 7); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
        ctx.closePath();
      };
      const [fF, fB] = this.fists();
      const arm = (sx, sy, f, col) => {
        const ex = (sx + f[0]) / 2 + jit(3) * 2, ey = (sy + f[1]) / 2 + 18 + jit(5) * 2;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(f[0], f[1]);
        ctx.strokeStyle = '#0a1a4a'; ctx.lineWidth = 30; ctx.stroke();
        ctx.strokeStyle = fl ? '#ffffff' : col; ctx.lineWidth = 23; ctx.stroke();
        ctx.strokeStyle = '#8ff0ff'; ctx.lineWidth = 9; ctx.stroke();
        ctx.beginPath(); ctx.arc(f[0], f[1], 20, 0, Math.PI * 2);
        ctx.fillStyle = fl ? '#ffffff' : col; ctx.fill(); ctx.strokeStyle = '#0a1a4a'; ctx.lineWidth = 4; ctx.stroke();
        ctx.beginPath(); ctx.arc(f[0], f[1], 11, 0, Math.PI * 2); ctx.fillStyle = '#d8fbff'; ctx.fill();
      };
      arm(-74, -186, fB, '#1a5ad8');
      // corpo em camadas: azul, ciano e núcleo branco
      body(1, -120); ctx.fillStyle = fl ? '#ffffff' : '#1f6fff'; ctx.fill(); ctx.strokeStyle = '#0a1a4a'; ctx.lineWidth = 4.5; ctx.stroke();
      if (!fl) {
        body(0.74, -130); ctx.fillStyle = '#5fd8ff'; ctx.fill();
        body(0.42, -140); ctx.fillStyle = '#e6fdff'; ctx.fill();
      }
      // olhos e boca
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(4, -222); ctx.lineTo(26, -216); ctx.lineTo(22, -208); ctx.lineTo(6, -212); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-14, -220); ctx.lineTo(-2, -216); ctx.lineTo(-4, -209); ctx.lineTo(-14, -212); ctx.closePath(); ctx.fill();
      TT.drawGlow(ctx, '#ffffff', 12, -214, 16, 0.9);
      ctx.strokeStyle = '#0a1a4a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-8, -196); ctx.lineTo(0, -192); ctx.lineTo(6, -197); ctx.lineTo(14, -192); ctx.lineTo(22, -196); ctx.stroke();
      // chip no peito
      const ex = this.exposed > 0, cs = ex ? 1.6 + Math.sin(t * 0.5) * 0.08 : 1;
      ctx.save(); ctx.translate(8, -150); ctx.scale(cs, cs);
      if (ex) TT.drawGlow(ctx, '#ff3a3a', 0, 0, 40, 0.7 + 0.3 * Math.sin(t * 0.6));
      ctx.fillStyle = '#e2b23c'; for (let k = -10; k <= 10; k += 5) { ctx.fillRect(k - 1, -15, 2.5, 5); ctx.fillRect(k - 1, 10, 2.5, 5); }
      ctx.fillStyle = '#1f8f4a'; ctx.fillRect(-15, -11, 30, 22); ctx.strokeStyle = '#0a1a4a'; ctx.lineWidth = 2.5; ctx.strokeRect(-15, -11, 30, 22);
      ctx.strokeStyle = '#9effa8'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-11, -6); ctx.lineTo(-3, -6); ctx.lineTo(-3, 2); ctx.lineTo(8, 2); ctx.moveTo(4, -7); ctx.lineTo(10, -7); ctx.lineTo(10, 6); ctx.stroke();
      ctx.fillStyle = ex && (t >> 2) % 2 ? '#ff3a3a' : '#2a2d36'; ctx.fillRect(-6, -4, 10, 8);
      ctx.restore();
      arm(78, -184, fF, '#2a7bff');
      ctx.restore();
      // arcos elétricos ao redor
      if (al > 0.3 && t % 2 === 0) {
        const ax0 = x + TT.rand(-80, 80), ay0 = y - TT.rand(40, 220);
        drawArc(ctx, ax0, ay0, ax0 + TT.rand(-70, 70), ay0 + TT.rand(-60, 60), '#6fe3ff', 2);
      }
      ctx.globalAlpha = 1;
      // efeitos dos golpes ativos
      if (a && this.state === 'attack' && a.t >= a.def.s && a.t < a.def.s + a.def.a + 2 && a.zones) this.drawStrike(ctx, camX, a);
      if (tk >= 0 && a.def === this.ATK.bolt) { // punho carregando o raio
        const fx = x + this.facing * fF[0] * (1 - sq), fy = y + fF[1] * (1 + sq);
        TT.drawGlow(ctx, '#bff6ff', fx, fy, 30 + 50 * tk, 0.9);
        if (t % 2 === 0) drawArc(ctx, fx, fy, fx + TT.rand(-50, 50), fy + TT.rand(-50, 50), '#6fe3ff', 2);
      }
      this.drawTell(ctx, x, y, y - 262);
      if (this.state === 'overheat') {
        Cinderblock.prototype.drawDizzy.call(this, ctx, x, y - 270);
        if ((t >> 3) % 2 === 0) TT.drawText(ctx, 'CHIP EXPOSTO! DANO DOBRADO!', x, Math.min(TT.H - 20, y + 44), 24, '#9effa8', OUT, 'center', 5);
      }
    }
    // Raio em linha, pilares das poças, descarga do teleporte e anel.
    drawStrike(ctx, camX, a) {
      const d = a.def, fade = 1 - (a.t - d.s) / (d.a + 2);
      ctx.save(); ctx.globalAlpha = Math.max(0, fade);
      if (d === this.ATK.bolt) {
        for (const z of a.zones) {
          const by = z.y - 80;
          for (let i = 0; i < 2; i++) drawArc(ctx, z.x0 - camX, by, z.x1 - camX, by + TT.rand(-10, 10), '#6fe3ff', 5, 18);
          ctx.fillStyle = 'rgba(160,240,255,0.35)'; ctx.fillRect(Math.min(z.x0, z.x1) - camX, z.y - z.d, Math.abs(z.x1 - z.x0), z.d * 2);
        }
      } else if (d === this.ATK.puddles || d === this.ATK.teleport) {
        for (const z of a.zones) {
          const zx = z.x - camX;
          drawArc(ctx, zx, z.y - 420, zx, z.y, d === this.ATK.puddles ? '#ffe14a' : '#c08cff', 6, 10);
          TT.drawGlow(ctx, d === this.ATK.puddles ? '#ffe14a' : '#c08cff', zx, z.y - 20, z.rx * 1.3, 0.9);
        }
      } else if (d === this.ATK.ring) {
        const z = a.zones[0], zx = z.x - camX;
        ctx.globalCompositeOperation = 'lighter';
        for (const r of [z.r0, (z.r0 + z.r1) / 2, z.r1]) {
          ctx.strokeStyle = '#ff9af6'; ctx.lineWidth = 6;
          ctx.beginPath(); ctx.ellipse(zx, z.y, r, r * z.ry, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }
  TT.Overload = Overload;

  // ---- Plasmus: monstro de lodo da fábrica química (fase 4)
  // Fraqueza: depois do soco esticado o braço fica GRUDADO no chão — ele trava no lugar e leva dano dobrado.
  class Plasmus extends Boss {
    constructor(game, x, y) {
      super(game, x, y);
      this.name = 'PLASMUS';
      this.hp = this.maxHp = 1250;
      this.radius = 70; this.height = 270; this.shadowW = 110;
      this.poiseMax = 180;
      this.def = { score: 8000 };
      this.stuck = 0; this.rise = 1; this.melt = 0; this.atkCount = 0; this.p2Said = false; this.armX = 0;
      this.taunts = ['GRRROOOAAARGH!', 'GLUB... GLUB...', 'GRAAAAH!', 'BLAAARGH!'];
      const clampX = (g, x, m) => TT.clamp(x, g.camX + m, g.camX + TT.W - m);
      const splash = (g, x, y, n, col) => {
        for (let i = 0; i < n; i++) g.particles.spawn('debris', x + TT.rand(-30, 30), y - 10, { vx: TT.rand(-6, 6), vy: -TT.rand(4, 11), grav: 0.5, color: col || TT.choice(['#c2569b', '#e47cc4', '#8a3a78']), size: TT.rand(6, 12), life: 30, floor: y + TT.rand(-6, 6) });
      };
      this.splash = splash;
      this.ATK = {
        // soco esticado: o braço de lodo cruza uma faixa à frente e gruda no chão no fim
        punch: { pose: 'beam', s: 36, a: 8, r: 10, dmg: 16, knockdown: true, launch: 7, kb: 10, zoneHit: true, zr: 60, color: '#ff5ab4', sound0: 'roar',
          zone(f) { return [{ k: 'rect', x0: f.x + f.facing * 30, x1: f.x + f.facing * 520, y: f.y, d: 36, arrows: true }]; },
          onFrame(f, t, g) {
            if (t === this.s) {
              f.armX = f.facing * 490;
              g.impact(f.x + f.facing * 480, f.y, 'SPLURT!', '#ff5ab4', 1.1);
              splash(g, f.x + f.facing * 480, f.y, 10);
              g.shake = Math.max(g.shake, 10); A().play('hitHeavy');
            }
            if (t === this.s + this.a + this.r - 1) f.getStuck();
          } },
        // cusparada: bolhas de lodo caem nos círculos marcados (sob os Titãs e ao redor)
        spit: { pose: 'castUp', s: 42, a: 6, r: 28, dmg: 12, knockdown: true, launch: 6, kb: 5, zoneHit: true, zr: 40, color: '#b8ff5a',
          zone(f, g) {
            const zs = [], hs = g.heroes(), n = f.phase2() ? 5 : 3;
            for (const h of hs) zs.push({ k: 'ell', x: clampX(g, h.x, 60), y: h.y, rx: 70, ry: 28 });
            let guard = 0;
            while (zs.length < n && guard++ < 20) {
              const tp = groundTarget(g, TT.choice(hs) || f, 330, 100);
              if (zs.every((z) => Math.abs(z.x - tp.x) > 120 || Math.abs(z.y - tp.y) > 50)) zs.push({ k: 'ell', x: tp.x, y: tp.y, rx: 70, ry: 28 });
            }
            return zs;
          },
          onFrame(f, t, g, a) {
            if (t === 6) A().play('roar');
            if (t === this.s) {
              for (const z of a.zones) { splash(g, z.x, z.y, 6); g.particles.spawn('ring', z.x, z.y, { size: 80, color: '#e47cc4', life: 14, flat: 0.42 }); }
              g.particles.spawn('text', f.x, f.y - 290, { text: 'SPLOSH!', size: 50, color: '#ff8ad6', color2: '#5a1a4a', vy: -0.5, life: 44, rot: -0.1 });
              A().play('boom');
            }
          } },
        // pancada no chão: onda de lodo que se espalha (pule!)
        wave: { pose: 'slam', s: 34, a: 2, r: 34, color: '#ffd23a',
          zone(f) { return [{ k: 'ell', x: f.x, y: f.y, rx: 560, ry: 560 * 0.38, rings: 5, jump: true }]; },
          onFrame(f, t, g) {
            if (t === this.s) {
              A().play('shockwave');
              const w = new Shockwave(g, f.x, f.y, 560, 13, 'enemy'); w.col = '#c2569b'; g.addEffect(w);
              splash(g, f.x, f.y, 14);
              g.impact(f.x, f.y, 'SPLASH!', '#ff5ab4', 1.3);
            }
          } },
        // mergulho (fase 2): derrete numa poça, desliza por baixo do chão e emerge sob o alvo
        dive: { pose: 'castUp', s: 52, a: 6, r: 24, dmg: 17, knockdown: true, launch: 10, kb: 8, zoneHit: true, zr: 50, color: '#c08cff',
          aim(f, g, a) {
            const p = g.targetFor(f);
            if (p) { a.tx = clampX(g, p.x, f.radius + 20); a.ty = TT.clamp(p.y, TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM); }
            else if (a.tx == null) { a.tx = f.x; a.ty = f.y; }
            return { k: 'ell', x: a.tx, y: a.ty, rx: 125, ry: 50 };
          },
          zone(f, g, a) { return [this.aim(f, g, a)]; },
          onFrame(f, t, g, a) {
            if (t < this.s * 0.5) a.zones = [this.aim(f, g, a)];
            if (t < this.s) {
              f.melt = Math.min(1, t / (this.s * 0.3));
              if (f.melt > 0.5) f.invul = 2;
              if (t > this.s * 0.4) { f.x += (a.tx - f.x) * 0.12; f.y += (a.ty - f.y) * 0.12; }
              if (t === 2) A().play('drill');
            }
            if (t === this.s) {
              f.x = a.tx; f.y = a.ty; f.melt = 0; f.invul = 0;
              splash(g, f.x, f.y, 16);
              g.impact(f.x, f.y, 'GLORP!', '#c08cff', 1.3); A().play('roar');
            }
          } },
      };
      this.applyDifficulty();
    }
    // Braço grudado = dano dobrado.
    get dmgTaken() { return this.stuck > 0 ? 2 : 1; }
    getStuck() {
      this.atk = null;
      this.setState('stuck'); this.setAnim('hurt');
      this.stuck = this.phase2() ? 110 : 140; this.vx = this.vy = 0;
      this.game.say(this, 'GRRR... GRUDOU!', '#ff8ad6');
    }
    onArmorHit(dmg, d) {
      if (this.state === 'stuck') return; // não interrompe a fraqueza
      super.onArmorHit(dmg, d);
    }
    think() {
      if (this.commonBoss()) return;
      const g = this.game;
      if (this.state === 'stuck') {
        this.vx = this.vy = 0;
        if (this.st % 6 === 0) g.particles.spawn('debris', this.x + this.facing * TT.rand(60, this.armX * this.facing), this.y - TT.rand(20, 60), { vx: TT.rand(-1, 1), vy: -TT.rand(1, 3), grav: 0.4, color: '#e47cc4', size: 6, life: 18, floor: this.y });
        if (--this.stuck <= 0) {
          this.stuck = 0; this.armX = 0;
          this.setState('idle'); this.setAnim('idle'); this.cool = 30;
          this.splash(g, this.x + this.facing * 200, this.y, 6);
        }
        return;
      }
      if (this.state === 'down' || this.state === 'hurt') this.setState('idle');
      const p = g.targetFor(this);
      if (this.state === 'attack') { this.updateAttack(); return; }
      this.melt = 0; this.armX = 0;
      if (!this.active || !p) { this.vx = this.vy = 0; this.setAnim('idle'); return; }
      const dx = p.x - this.x, dy = p.y - this.y;
      this.facing = dx > 0 ? 1 : -1;
      const p2 = this.phase2();
      if (p2 && !this.p2Said) {
        this.p2Said = true;
        g.say(this, 'GRAAAAAAH!!!', '#ff5ab4');
        g.impact(this.x, this.y, 'FÚRIA!', '#ff5ab4', 1);
      }
      this.dmgMul = p2 ? 1.15 : 1;
      if (this.cool > 0) this.cool--;
      this.approach(this.sideTarget(p, 260), p.y, p2 ? 2.2 : 1.5);
      if (this.cool <= 0) {
        this.vx = this.vy = 0;
        let pick;
        // a cada 3 ataques vem o soco esticado (e o braço grudado logo depois)
        if (this.atkCount % 3 === 2) pick = 'punch';
        else {
          const opts = ['spit', 'wave'];
          if (Math.abs(dy) < 40) opts.push('punch');
          if (p2) opts.push('dive', 'dive');
          pick = TT.choice(opts);
        }
        this.atkCount++;
        this.startAttack(this.ATK[pick]);
        this.cool = p2 ? this.nextCool(40, 70) : this.nextCool(70, 105);
        if (Math.random() < 0.3) g.say(this, TT.choice(this.taunts), '#ff8ad6');
      }
    }
    // Ponta dos braços (x, y) relativa aos pés, conforme o golpe.
    fists() {
      const a = this.atk, t = this.animT, w = Math.sin(t * 0.09) * 6;
      const idle = [[118, -110 + w], [-112, -116 - w]];
      if (this.state === 'stuck') return [[this.armX * this.facing, -14], [-104, -96]];
      if (!a || this.state !== 'attack') return idle;
      const d = a.def, k = a.t < d.s ? TT.easeOut(a.t / d.s) : 1, hit = a.t >= d.s;
      const L = (p, q, u) => [TT.lerp(p[0], q[0], u), TT.lerp(p[1], q[1], u)];
      if (d === this.ATK.punch) {
        if (!hit) return [L(idle[0], [-50, -230], k), L(idle[1], [-130, -150], k)];
        const u = Math.min(1, (a.t - d.s + 1) / 3);
        return [[TT.lerp(120, 490, u), TT.lerp(-180, -14, u)], [-112, -110]];
      }
      if (d === this.ATK.wave) return hit ? [[130, -14], [-120, -14]] : [L(idle[0], [50, -330], k), L(idle[1], [-50, -330], k)];
      return [L(idle[0], [90, -300], k), L(idle[1], [-80, -300], k)];
    }
    draw(ctx, camX) {
      const t = this.animT, a = this.atk, tk = this.tellK();
      const x = this.x - camX + this.tellShake(), y = this.y - this.z;
      const fl = this.flash > 3 || this.tellFlash();
      let melt = this.melt, rise = this.rise;
      if (this.state === 'dying') melt = Math.min(1, this.st / 90);
      const body = '#c2569b', dark = '#8a3a78', light = '#ec8ccc', OUTL = '#2a0f2a';
      // poça de lodo sob ele
      ctx.fillStyle = 'rgba(160,60,140,0.75)';
      ctx.beginPath(); ctx.ellipse(x, y, 120 + 60 * melt, 26 + 8 * melt, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,170,230,0.45)'; ctx.beginPath(); ctx.ellipse(x - 30, y - 6, 40, 5, 0, 0, Math.PI * 2); ctx.fill();
      const vis = rise * (1 - melt);
      if (vis > 0.03) {
        const sq = tk >= 0 ? -0.07 * tk : a && this.state === 'attack' && a.t < a.def.s + a.def.a + 6 ? 0.06 : 0;
        const sy = vis * (1 + sq), sx = (1 - sq) * (1 + 0.4 * (1 - vis));
        ctx.save();
        ctx.translate(x, y); ctx.scale(this.facing * sx, sy);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const wob = (i) => Math.sin(t * 0.12 + i * 1.9) * 2.5 + Math.sin(t * 0.31 + i * 0.7) * 1.2;
        const [fF, fB] = this.fists();
        const ink = (fillCol, lw) => { ctx.fillStyle = fl ? '#ffffff' : fillCol; ctx.fill(); ctx.strokeStyle = OUTL; ctx.lineWidth = lw || 5; ctx.stroke(); };
        const muscle = (d, w) => { if (fl) return; ctx.strokeStyle = dark; ctx.lineWidth = w || 3.5; ctx.stroke(new Path2D(d)); };
        // braço de lodo musculoso: ombro -> cotovelo -> punho (estica além do comprimento normal no soco)
        const arm = (sx0, sy0, f, front) => {
          const col = front ? body : dark, L = 82;
          const dx = f[0] - sx0, dy = f[1] - sy0, d = Math.hypot(dx, dy) || 1;
          const bend = d < L * 2 ? Math.sqrt(L * L - (d / 2) * (d / 2)) : 0;
          let px = -dy / d, py = dx / d;
          if (px * sx0 < 0) { px = -px; py = -py; } // cotovelo para fora do corpo
          const ex = (sx0 + f[0]) / 2 + px * bend + wob(front ? 3 : 5), ey = (sy0 + f[1]) / 2 + py * bend;
          const seg = (ax, ay, bx, by, w0, w1) => { // segmento grosso com contorno
            const w = (w0 + w1);
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
            ctx.strokeStyle = OUTL; ctx.lineWidth = w + 9; ctx.stroke();
            ctx.strokeStyle = fl ? '#ffffff' : col; ctx.lineWidth = w; ctx.stroke();
          };
          seg(ex, ey, f[0], f[1], 24, 19); // antebraço
          seg(sx0, sy0, ex, ey, 34, 25); // braço com bíceps
          if (!fl) { // bíceps e brilho
            const bx = (sx0 + ex) / 2, by = (sy0 + ey) / 2;
            ctx.fillStyle = front ? light : body; ctx.globalAlpha = 0.55;
            ctx.beginPath(); ctx.ellipse(bx + 4, by - 6, 15, 9, Math.atan2(ey - sy0, ex - sx0), 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.beginPath(); ctx.arc(sx0, sy0, 36, 0, Math.PI * 2); ink(col, 4.5); // deltoide
          ctx.beginPath(); ctx.arc(f[0], f[1], 31, 0, Math.PI * 2); ink(col, 4.5); // punho
          if (!fl) {
            ctx.strokeStyle = dark; ctx.lineWidth = 3;
            for (const k of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(f[0] + 10, f[1] + k - 4); ctx.lineTo(f[0] + 22, f[1] + k); ctx.stroke(); } // dedos
            ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(f[0] - 9, f[1] - 12, 10, 6, -0.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = light; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(sx0 + 6, sy0 - 14, 16, 8, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
          }
        };
        // pernas: colunas grossas de lodo que escorrem na poça
        const walk = this.anim === 'walk' ? Math.sin(t * 0.2) * 10 : 0;
        ctx.beginPath(); ctx.moveTo(-78, -112); ctx.bezierCurveTo(-88, -70, -80 - walk, -24, -92 - walk, 6); ctx.lineTo(-18 - walk, 8); ctx.bezierCurveTo(-18, -30, -10, -70, -4, -112); ctx.closePath(); ink(dark);
        ctx.beginPath(); ctx.moveTo(0, -112); ctx.bezierCurveTo(8, -70, 18 + walk, -28, 14 + walk, 8); ctx.lineTo(94 + walk, 6); ctx.bezierCurveTo(84 + walk, -26, 88, -70, 78, -112); ctx.closePath(); ink(body);
        muscle('M 30 -90 Q 44 -60 38 -30 M 52 -96 Q 64 -66 60 -40', 3);
        arm(-74, -214, fB, false);
        // tronco em V: cintura fina, peito largo e trapézio alto em volta da cabeça afundada
        ctx.beginPath();
        ctx.moveTo(-62 + wob(1), -96);
        ctx.bezierCurveTo(-70, -140, -112 + wob(2), -164, -114, -204);
        ctx.bezierCurveTo(-116, -234, -86, -250, -54, -246);
        ctx.bezierCurveTo(-30, -276 + wob(3), 62, -280, 80, -248);
        ctx.bezierCurveTo(110, -248, 122 + wob(4), -226, 118, -198);
        ctx.bezierCurveTo(112, -164, 74, -140, 68 + wob(5), -96);
        ctx.quadraticCurveTo(4, -84, -62 + wob(1), -96);
        ctx.closePath();
        ink(body);
        if (!fl) {
          ctx.save(); ctx.clip();
          ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-112, -170, 54, 110, 0.1, 0, Math.PI * 2); ctx.fill(); // lado na sombra
          ctx.fillStyle = light; ctx.globalAlpha = 0.6;
          ctx.beginPath(); ctx.ellipse(46, -206, 30, 13, -0.3, 0, Math.PI * 2); ctx.fill(); // brilho no peitoral
          ctx.beginPath(); ctx.ellipse(-20, -212, 22, 10, -0.2, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          for (let k = 0; k < 4; k++) { // bolhas internas
            const bx = -40 + k * 30 + Math.sin(t * 0.05 + k) * 8, by = -100 - ((t * 0.7 + k * 41) % 130);
            ctx.strokeStyle = 'rgba(255,200,240,0.55)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(bx, by, 4 + (k % 3) * 2, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.restore();
          // peitoral e abdômen definidos
          muscle('M -40 -222 Q 0 -230 12 -196 Q 0 -180 -34 -186 M 22 -196 Q 40 -232 92 -214 Q 92 -186 56 -180 Q 34 -182 22 -196', 4);
          muscle('M 6 -176 L 10 -104 M -16 -166 Q -4 -160 6 -164 M 12 -164 Q 26 -160 40 -166 M -16 -142 Q -4 -136 7 -140 M 11 -140 Q 26 -136 38 -142 M -14 -118 Q -4 -114 8 -116 M 10 -116 Q 24 -112 36 -118', 3);
        }
        // cabeça pequena afundada entre os ombros
        const roar = (a && this.state === 'attack') || this.state === 'stuck';
        ctx.beginPath(); ctx.ellipse(24, -250, 36, 30, 0, 0, Math.PI * 2); ink(body, 4.5);
        if (!fl) {
          ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(-6, -262); ctx.quadraticCurveTo(26, -276, 58, -262); ctx.lineTo(56, -256); ctx.quadraticCurveTo(26, -268, -4, -255); ctx.closePath(); ctx.fill(); // sobrancelha pesada
          ctx.fillStyle = '#ffe14a';
          ctx.beginPath(); ctx.moveTo(30, -256); ctx.quadraticCurveTo(44, -264, 54, -254); ctx.quadraticCurveTo(42, -248, 30, -256); ctx.fill();
          ctx.beginPath(); ctx.moveTo(0, -254); ctx.quadraticCurveTo(10, -261, 20, -254); ctx.quadraticCurveTo(10, -248, 0, -254); ctx.fill();
          TT.drawGlow(ctx, '#ffe14a', 28, -255, 24, 0.8);
          ctx.fillStyle = OUTL; ctx.beginPath(); ctx.arc(44, -256, 3, 0, Math.PI * 2); ctx.arc(11, -255, 2.5, 0, Math.PI * 2); ctx.fill();
          const mo = roar ? 14 + Math.sin(t * 0.5) * 3 : 5;
          ctx.fillStyle = '#3a0a2a'; ctx.strokeStyle = OUTL; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(30, -232, 24, mo, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ffeaf6';
          for (let k = -2; k <= 2; k++) { const tx = 30 + k * 9; ctx.beginPath(); ctx.moveTo(tx - 4, -232 - mo + 2); ctx.lineTo(tx + 4, -232 - mo + 2); ctx.lineTo(tx, -232 - mo + 10); ctx.closePath(); ctx.fill(); }
          if (roar) { ctx.fillStyle = '#e47cc4'; ctx.fillRect(18, -232, 6, mo + 14); ctx.beginPath(); ctx.arc(21, -218 + mo, 5, 0, Math.PI * 2); ctx.fill(); } // baba
        }
        arm(82, -212, fF, true);
        ctx.restore();
      } else if (!fl) { // derretido: só bolhas na poça
        for (let k = 0; k < 3; k++) { ctx.strokeStyle = 'rgba(255,200,240,0.8)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x - 40 + k * 40, y - 8 - ((t + k * 9) % 18), 6, 0, Math.PI * 2); ctx.stroke(); }
      }
      // pingos caindo do corpo
      if (vis > 0.5 && t % 9 === 0) this.game.particles.spawn('debris', this.x + TT.rand(-90, 90), this.y - TT.rand(60, 180), { vx: 0, vy: 1, grav: 0.5, color: '#c2569b', size: 6, life: 30, floor: this.y });
      // efeitos dos golpes ativos
      if (a && this.state === 'attack' && a.t >= a.def.s && a.t < a.def.s + a.def.a + 2 && a.zones && a.def === this.ATK.spit) {
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - (a.t - a.def.s) / (a.def.a + 2));
        for (const z of a.zones) TT.drawGlow(ctx, '#ff8ad6', z.x - camX, z.y - 20, z.rx * 1.3, 0.9);
        ctx.restore();
      }
      // bolhas de lodo voando para os alvos durante a cusparada
      if (a && this.state === 'attack' && a.def === this.ATK.spit && a.t < a.def.s && a.t > a.def.s * 0.35 && a.zones) {
        const u = (a.t - a.def.s * 0.35) / (a.def.s * 0.65);
        for (const z of a.zones) {
          const bx = TT.lerp(x + this.facing * 20, z.x - camX, u), by = TT.lerp(y - 230, z.y, u) - Math.sin(u * Math.PI) * 220;
          ctx.fillStyle = body; ctx.strokeStyle = OUTL; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(bx, by, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = light; ctx.beginPath(); ctx.arc(bx - 5, by - 5, 5, 0, Math.PI * 2); ctx.fill();
        }
      }
      this.drawTell(ctx, x, y, y - 290 * vis);
      if (this.state === 'stuck') {
        Cinderblock.prototype.drawDizzy.call(this, ctx, x, y - 270);
        if ((t >> 3) % 2 === 0) TT.drawText(ctx, 'BRAÇO GRUDADO! DANO DOBRADO!', x, Math.min(TT.H - 20, y + 44), 24, '#ffb0e6', OUT, 'center', 5);
      }
    }
  }
  TT.Plasmus = Plasmus;

  // Carteira escolar ou armário arremessado por telecinese (Irmão Sangue).
  function drawDesk(ctx, x, y, s, rot, locker) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    if (locker) {
      ctx.fillStyle = '#5b6b8a'; ctx.fillRect(-18, -36, 36, 72); ctx.strokeRect(-18, -36, 36, 72);
      ctx.fillStyle = '#4a5874'; for (let k = 0; k < 4; k++) ctx.fillRect(-11, -28 + k * 6, 22, 3);
      ctx.fillStyle = '#d9dde6'; ctx.fillRect(9, -2, 4, 12);
      ctx.strokeStyle = '#3a4560'; ctx.lineWidth = 2; ctx.strokeRect(-14, -32, 28, 64);
    } else {
      ctx.fillStyle = '#8d96a6'; // pernas de metal
      for (const lx of [-22, 18]) { ctx.fillRect(lx, -2, 5, 30); ctx.strokeRect(lx, -2, 5, 30); }
      ctx.fillStyle = '#b27a45'; ctx.fillRect(-30, -10, 60, 12); ctx.strokeRect(-30, -10, 60, 12); // tampo
      ctx.fillStyle = '#d29a62'; ctx.fillRect(-26, -8, 34, 3);
      ctx.fillStyle = '#5c566c'; ctx.fillRect(-24, 10, 48, 8); ctx.strokeRect(-24, 10, 48, 8); // porta-livros
    }
    ctx.restore();
  }
  TT.drawDesk = drawDesk;

  // ---- Irmão Sangue: diretor da Academia H.I.V.E. (fase 5)
  // Fraqueza: a telecinese esgota a mente dele — depois de arremessar as carteiras fica tonto e leva dano dobrado.
  class BrotherBlood extends Boss {
    constructor(game, x, y) {
      super(game, x, y);
      this.name = 'IRMÃO SANGUE';
      this.style = TT.STYLES.blood;
      this.hp = this.maxHp = 1200;
      this.radius = 46; this.height = 230; this.shadowW = 62;
      this.poiseMax = 150;
      this.def = { score: 9000 };
      this.tired = 0; this.alpha = 1; this.atkCount = 0; this.p2Said = false; this.summonCool = 0;
      this.out = {};
      this.taunts = ['Bem-vindos à minha escola, Titãs.', 'Hoje a aula é sobre DOR.', 'Ajoelhem-se diante do Irmão Sangue!', 'A H.I.V.E. obedece à minha mente!'];
      const clampX = (g, x, m) => TT.clamp(x, g.camX + m, g.camX + TT.W - m);
      this.ATK = {
        // empurrão psíquico: arco à frente
        palm: { pose: 'cast', s: 28, a: 6, r: 24, dmg: 15, knockdown: true, launch: 8, kb: 11, zoneHit: true, color: '#ff3b4a', sound0: 'dark',
          zone(f) { return [{ k: 'half', x: f.x, y: f.y, rx: 210, ry: 62, f: f.facing }]; },
          onFrame(f, t, g) {
            if (t === this.s) {
              g.impact(f.x + f.facing * 120, f.y, 'FWOOM!', '#ff3b4a', 0.9); A().play('hitHeavy');
              for (const r of [90, 160]) g.particles.spawn('ring', f.x + f.facing * 70, f.y, { size: r, color: '#ff6a7a', life: 14, flat: 0.4 });
            }
          } },
        // raio do braço cibernético: faixa até a borda da tela
        beam: { pose: 'beam', s: 38, a: 14, r: 24, dmg: 13, knockdown: true, launch: 6, kb: 8, zoneHit: true, zr: 60, color: '#ff2a3a', sound: 'laser',
          zone(f, g) {
            const end = f.facing > 0 ? g.camX + TT.W + 40 : g.camX - 40;
            return [{ k: 'rect', x0: f.x + f.facing * 50, x1: end, y: f.y, d: 30, arrows: true }];
          },
          onFrame(f, t, g) { if (t === this.s) g.impact(f.x + f.facing * 240, f.y, 'BZZZOW!', '#ff2a3a', 0.8); } },
        // hipnose: círculo que segue o Titã até a metade do aviso; quem fica dentro fica tonto
        mind: { pose: 'castUp', s: 44, a: 6, r: 20, dmg: 6, stun: 80, kb: 1, zoneHit: true, hypno: true, color: '#ff4af0',
          aim(f, g, a) {
            const p = g.targetFor(f);
            if (p) { a.tx = clampX(g, p.x, 60); a.ty = TT.clamp(p.y, TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM); }
            else if (a.tx == null) { a.tx = f.x + f.facing * 300; a.ty = f.y; }
            return { k: 'ell', x: a.tx, y: a.ty, rx: 100, ry: 40 };
          },
          zone(f, g, a) { return [this.aim(f, g, a)]; },
          onFrame(f, t, g, a) {
            if (t < this.s * 0.5) a.zones = [this.aim(f, g, a)];
            if (t === 2) A().play('dark');
            if (t === this.s) {
              const z = a.zones[0];
              for (const r of [70, 120, 170]) g.particles.spawn('ring', z.x, z.y, { size: r, color: '#ff7af0', life: 16, flat: 0.42 });
              A().play('dark');
            }
          } },
        // telecinese: carteiras e armários caem nos círculos marcados (depois ele fica esgotado)
        hurl: { pose: 'castUp', s: 46, a: 1, r: 30, color: '#c08cff',
          zone(f, g) {
            const zs = [], hs = g.heroes(), n = f.phase2() ? 4 : 3, R = 85;
            for (const h of hs) zs.push({ k: 'ell', x: clampX(g, h.x, 60), y: TT.clamp(h.y, TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM), rx: R, ry: R * 0.42 });
            let guard = 0;
            while (zs.length < n && guard++ < 30) {
              const tp = groundTarget(g, TT.choice(hs) || f, 360, 110);
              if (zs.every((z) => Math.abs(z.x - tp.x) > 2 * R || Math.abs(z.y - tp.y) > R)) zs.push({ k: 'ell', x: tp.x, y: tp.y, rx: R, ry: R * 0.42 });
            }
            return zs;
          },
          onFrame(f, t, g, a) {
            if (t === 4) A().play('dark');
            if (t === this.s) {
              a.zones.forEach((z, i) => {
                const T = 34 + i * 7, z0 = 300, gr = 0.6, x0 = f.x + f.facing * 20 + (i - 1) * 50;
                g.addProjectile(new Projectile(g, {
                  kind: i % 2 ? 'locker' : 'desk', team: 'enemy', owner: f, x: x0, y: f.y, z: z0,
                  vx: (z.x - x0) / T, vy: (z.y - f.y) / T, vz: (0.5 * gr * T * T - z0) / T, grav: gr,
                  r: 30, dmg: 0, blastDmg: 12, life: 120, explodeOnGround: z.rx, zone: z, flight: T, impactWord: 'CRASH!',
                }));
              });
              a.zones = null; // daqui em diante cada objeto desenha o seu alvo
              A().play('whoosh');
            }
            if (t === this.s + this.a + this.r - 1) f.tire();
          } },
        // (fase 2) chama alunos hipnotizados
        summon: { pose: 'castUp', s: 30, a: 1, r: 24, color: '#ff3b4a',
          onFrame(f, t, g) {
            if (t !== this.s) return;
            g.say(f, 'Alunos... ATAQUEM!', '#ff8a9a');
            for (const side of [-1, 1]) {
              const e = new Enemy(g, 'cadet', side < 0 ? g.camX + 90 : g.camX + TT.W - 90, TT.clamp(f.y + side * 60, TT.FLOOR_TOP + 20, TT.FLOOR_BOTTOM - 10));
              e.entering = false; e.cool = 50; g.addEnemy(e);
              g.particles.spawn('glow', e.x, e.y - 60, { size: 130, color: '#ff3b4a', life: 16 });
              g.poof(e.x, e.y - 60);
            }
            A().play('dark');
          } },
      };
      this.applyDifficulty();
    }
    // Mente esgotada = dano dobrado.
    get dmgTaken() { return this.tired > 0 ? 2 : 1; }
    tire() {
      this.atk = null;
      this.setState('tired'); this.setAnim('hurt');
      this.tired = this.phase2() ? 110 : 140; this.vx = this.vy = 0;
      this.game.say(this, 'Argh... minha cabeça!', '#ff8a9a');
    }
    onArmorHit(dmg, d) {
      if (this.state === 'tired') return; // não interrompe a fraqueza
      super.onArmorHit(dmg, d);
    }
    think() {
      if (this.commonBoss()) return;
      const g = this.game;
      if (this.state === 'tired') {
        this.vx = this.vy = 0;
        if (--this.tired <= 0) { this.tired = 0; this.setState('idle'); this.setAnim('idle'); this.cool = 30; }
        return;
      }
      if (this.state === 'down' || this.state === 'hurt') this.setState('idle');
      const p = g.targetFor(this);
      if (this.state === 'attack') { this.updateAttack(); return; }
      if (!this.active || !p) { this.vx = this.vy = 0; this.setAnim('idle'); return; }
      const dx = p.x - this.x, dy = p.y - this.y, adx = Math.abs(dx);
      this.facing = dx > 0 ? 1 : -1;
      const p2 = this.phase2();
      if (p2 && !this.p2Said) {
        this.p2Said = true;
        g.say(this, 'Chega de aula. Agora é PESSOAL!', '#ff3b4a');
        g.impact(this.x, this.y, 'FÚRIA!', '#ff3b4a', 1);
      }
      this.dmgMul = p2 ? 1.15 : 1;
      if (this.cool > 0) this.cool--;
      if (this.summonCool > 0) this.summonCool--;
      this.approach(this.sideTarget(p, 200), p.y, p2 ? 2.3 : 1.7);
      if (this.cool <= 0) {
        this.vx = this.vy = 0;
        let pick;
        // a cada 3 ataques vem a telecinese (e a mente esgotada logo depois)
        if (this.atkCount % 3 === 2) pick = 'hurl';
        else if (p2 && this.summonCool <= 0 && g.enemies.length < 3) { pick = 'summon'; this.summonCool = 900; }
        else {
          const opts = ['mind'];
          if (adx < 230 && Math.abs(dy) < 50) opts.push('palm', 'palm');
          if (Math.abs(dy) < 40) opts.push('beam');
          pick = TT.choice(opts);
        }
        if (pick !== 'summon') this.atkCount++;
        this.startAttack(this.ATK[pick]);
        this.cool = p2 ? this.nextCool(40, 70) : this.nextCool(70, 105);
        if (Math.random() < 0.3) g.say(this, TT.choice(this.taunts), '#ff8a9a');
      }
    }
    draw(ctx, camX) {
      const t = this.animT, a = this.atk, k = this.tellK(), d = a && a.def;
      let al = this.alpha;
      if (this.state === 'dying' && (this.st >> 2) % 2 === 0) al *= 0.6;
      TT.computePose(this, this.pose);
      if (this.state === 'tired') { this.pose.lean = -0.25; this.pose.tilt = -0.4; }
      const x = this.x - camX + this.tellShake(), y = this.y - this.z;
      ctx.save(); ctx.globalAlpha = al;
      // aura psíquica vermelha (mais forte durante a preparação)
      TT.drawGlow(ctx, '#ff1a3a', x, y - 120, 130 + Math.sin(t * 0.12) * 10 + (k > 0 ? 60 * k : 0), 0.35 + (k > 0 ? 0.35 * k : 0));
      let sq = 0;
      if (k >= 0) sq = -0.06 * TT.easeOut(k);
      else if (a && a.t < d.s + d.a + 6) sq = 0.05;
      ctx.save(); ctx.translate(x, y); ctx.scale(1 - sq, 1 + sq); ctx.translate(-x, -y);
      TT.drawRig(ctx, this.style, this.pose, x, y, this.facing, { flash: this.flash > 3 || this.tellFlash(), t, out: this.out });
      ctx.restore();
      const o = this.out;
      // telecinese: carteiras e armários flutuando acima dele enquanto prepara
      if (d === this.ATK.hurl && a.t < d.s && a.zones) {
        const u = TT.easeOut(Math.min(1, a.t / (d.s * 0.6)));
        a.zones.forEach((z, i) => {
          const fx = x + (i - (a.zones.length - 1) / 2) * 70, fy = y - 250 - 40 * u + Math.sin(t * 0.2 + i) * 6;
          TT.drawGlow(ctx, '#ff4a6a', fx, fy, 40, 0.6);
          drawDesk(ctx, fx, TT.lerp(y - 20, fy, u), 0.9, Math.sin(t * 0.1 + i) * 0.3, i % 2 === 1);
        });
      }
      // hipnose: fio de energia dos olhos até o alvo marcado
      if (d === this.ATK.mind && a.t < d.s + d.a && a.zones && o.hx != null) {
        const z = a.zones[0], zx = z.x - camX, zy = z.y - 60;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,90,240,' + (0.3 + 0.5 * Math.max(0, k)) + ')'; ctx.lineWidth = 3 + 4 * Math.max(0, k);
        ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 2;
        ctx.beginPath(); ctx.moveTo(o.hx, o.hy); ctx.quadraticCurveTo((o.hx + zx) / 2, Math.min(o.hy, zy) - 80, zx, zy); ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < 3; i++) { // espiral sobre o alvo
          const ang = t * 0.2 + i * 2.1;
          TT.drawGlow(ctx, '#ff7af0', zx + Math.cos(ang) * 30, zy - 40 + Math.sin(ang) * 12, 16, 0.8);
        }
        ctx.restore();
      }
      // raio do braço cibernético
      if (d === this.ATK.beam && a.t >= d.s && a.t < d.s + d.a && o.fx != null) {
        const hx = o.fx, hy = o.fy, end = this.facing > 0 ? TT.W + 60 : -60;
        const w = 22 * (1 - Math.abs((a.t - d.s) / d.a - 0.5));
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,40,60,0.55)'; ctx.lineWidth = w * 2.2; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(end, hy + 6); ctx.stroke();
        ctx.strokeStyle = '#ffd0d6'; ctx.lineWidth = w * 0.6; ctx.stroke();
        ctx.restore();
        TT.drawGlow(ctx, '#ff2a3a', hx, hy, 50, 1);
      } else if (d === this.ATK.beam && k > 0 && o.fx != null) {
        TT.drawGlow(ctx, '#ff2a3a', o.fx, o.fy, 14 + 30 * k, 0.9); // carregando
      }
      // empurrão psíquico: onda vermelha à frente
      if (d === this.ATK.palm && a.t >= d.s && a.t < d.s + d.a + 4) {
        const u = (a.t - d.s) / (d.a + 4);
        ctx.save(); ctx.globalAlpha = al * (1 - u);
        ctx.strokeStyle = '#ff5a6a'; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.ellipse(x + this.facing * 40, y - 110, 60 + 150 * u, 110 + 30 * u, 0, this.facing > 0 ? -1.2 : Math.PI - 1.2, this.facing > 0 ? 1.2 : Math.PI + 1.2); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      this.drawTell(ctx, x, y, y - this.height - 20);
      if (this.state === 'tired') {
        Cinderblock.prototype.drawDizzy.call(this, ctx, x, y - this.height + 10);
        if ((t >> 3) % 2 === 0) TT.drawText(ctx, 'MENTE ESGOTADA! DANO DOBRADO!', x, Math.min(TT.H - 20, y + 44), 24, '#ffb0b8', OUT, 'center', 5);
      }
    }
  }
  TT.BrotherBlood = BrotherBlood;

  // Cartola no chão (de onde saem os coelhos do Mumbo). s = escala.
  function drawTopHat(ctx, x, y, s, fl) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, 46, 13, 0, 0, Math.PI * 2); ctx.fillStyle = fl ? '#fff' : '#14131c'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30, -2); ctx.lineTo(-33, -58); ctx.quadraticCurveTo(0, -66, 33, -58); ctx.lineTo(30, -2); ctx.closePath();
    ctx.fillStyle = fl ? '#fff' : '#1c1b26'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c4162a'; ctx.fillRect(-31, -18, 62, 9);
    ctx.beginPath(); ctx.ellipse(0, -59, 33, 8, 0, 0, Math.PI * 2); ctx.fillStyle = '#05040a'; ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  TT.drawTopHat = drawTopHat;

  // Carta de baralho voando (leque de cartas do Mumbo).
  function drawFlyingCard(ctx, x, y, rot, red) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = '#f6f2e6'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.fillRect(-11, -16, 22, 32); ctx.strokeRect(-11, -16, 22, 32);
    ctx.fillStyle = red ? '#d0202a' : '#1a1a22'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(red ? '♥' : '♠', 0, 1);
    ctx.restore();
  }

  // ---- Mumbo: o mágico do mal (fase 6)
  // Fraqueza: depois de tirar os coelhos da cartola, deixa a varinha cair — fica sem magia e leva dano dobrado.
  class Mumbo extends Boss {
    constructor(game, x, y) {
      super(game, x, y);
      this.name = 'MUMBO';
      this.style = TT.STYLES.mumbo;
      this.hp = this.maxHp = 1300;
      this.radius = 44; this.height = 250; this.shadowW = 60;
      this.poiseMax = 150;
      this.def = { score: 10000 };
      this.fumbleT = 0; this.alpha = 1; this.atkCount = 0; this.p2Said = false; this.wandX = 0;
      this.out = {};
      this.taunts = ['Respeitável público!', 'Nada na manga... TUDO na cartola!', 'Para o meu próximo truque...', 'Abracadabra, Titãs!'];
      const clampX = (g, x, m) => TT.clamp(x, g.camX + m, g.camX + TT.W - m);
      const edge = (f, g) => (f.facing > 0 ? g.camX + TT.W + 40 : g.camX - 40);
      this.ATK = {
        // raio da varinha: faixa de estrelas até a borda da tela
        wand: { pose: 'beam', s: 36, a: 14, r: 24, dmg: 13, knockdown: true, launch: 6, kb: 8, zoneHit: true, zr: 60, color: '#7af0ff', sound: 'starbolt',
          zone(f, g) { return [{ k: 'rect', x0: f.x + f.facing * 50, x1: edge(f, g), y: f.y, d: 30, arrows: true }]; },
          onFrame(f, t, g) { if (t === this.s) g.impact(f.x + f.facing * 240, f.y, 'ZING!', '#7af0ff', 0.8); } },
        // leque de cartas: três faixas atravessando a arena (fique no vão entre elas)
        cards: { pose: 'throw', s: 34, a: 12, r: 22, dmg: 11, knockdown: true, launch: 5, kb: 6, zoneHit: true, zr: 70, color: '#ffe14a', sound0: 'whoosh', sound: 'birdarang',
          zone(f, g) {
            const c = TT.clamp(f.y, TT.FLOOR_TOP + 106, TT.FLOOR_BOTTOM - 106);
            return [-80, 0, 80].map((o) => ({ k: 'rect', x0: f.x + f.facing * 40, x1: edge(f, g), y: c + o, d: 24 }));
          } },
        // coelhos da cartola: brotam do chão nos círculos marcados (depois a varinha cai)
        hat: { pose: 'castUp', s: 44, a: 8, r: 30, dmg: 12, knockdown: true, launch: 9, kb: 5, zoneHit: true, zr: 40, color: '#c08cff',
          zone(f, g) {
            const zs = [], hs = g.heroes(), n = f.phase2() ? 4 : 3;
            for (const h of hs) zs.push({ k: 'ell', x: clampX(g, h.x, 60), y: TT.clamp(h.y, TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM), rx: 75, ry: 30 });
            let guard = 0;
            while (zs.length < n && guard++ < 30) {
              const tp = groundTarget(g, TT.choice(hs) || f, 340, 100);
              if (zs.every((z) => Math.abs(z.x - tp.x) > 160 || Math.abs(z.y - tp.y) > 64)) zs.push({ k: 'ell', x: tp.x, y: tp.y, rx: 75, ry: 30 });
            }
            return zs;
          },
          onFrame(f, t, g, a) {
            if (t === 4) A().play('dark');
            if (t === this.s) {
              for (const z of a.zones) { g.poof(z.x, z.y - 40); g.particles.spawn('text', z.x, z.y - 150, { text: 'POP!', size: 34, color: '#ffffff', color2: '#8a5cff', vy: -0.6, life: 34, rot: TT.rand(-0.2, 0.2) }); }
              g.shake = Math.max(g.shake, 8); A().play('boom');
            }
            if (t === this.s + this.a + this.r - 1) f.fumble();
          } },
        // "MUMBO JUMBO!": o círculo segue o Titã até a metade do aviso; quem fica dentro vira coelho
        spell: { pose: 'cast', s: 46, a: 6, r: 22, dmg: 5, stun: 12, kb: 1, zoneHit: true, bunny: true, color: '#ff7af0',
          aim(f, g, a) {
            const p = g.targetFor(f);
            if (p) { a.tx = clampX(g, p.x, 60); a.ty = TT.clamp(p.y, TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM); }
            else if (a.tx == null) { a.tx = f.x + f.facing * 300; a.ty = f.y; }
            return { k: 'ell', x: a.tx, y: a.ty, rx: 100, ry: 40 };
          },
          zone(f, g, a) { return [this.aim(f, g, a)]; },
          onFrame(f, t, g, a) {
            if (t < this.s * 0.5) a.zones = [this.aim(f, g, a)];
            if (t === 2) { g.say(f, 'Mumbo...', '#ffc0f6'); A().play('dark'); }
            if (t === this.s) {
              const z = a.zones[0];
              g.say(f, 'MUMBO JUMBO!', '#ff7af0');
              for (let i = 0; i < 8; i++) g.particles.spawn('star', z.x + TT.rand(-60, 60), z.y - TT.rand(10, 120), { vx: TT.rand(-3, 3), vy: TT.rand(-4, -1), color: TT.choice(['#ff7af0', '#ffffff', '#7af0ff']), size: 10, life: 22, vr: 0.2 });
              A().play('starbolt');
            }
          } },
      };
      this.applyDifficulty();
    }
    // Sem varinha = dano dobrado.
    get dmgTaken() { return this.fumbleT > 0 ? 2 : 1; }
    fumble() {
      this.atk = null;
      this.setState('fumble'); this.setAnim('hurt');
      this.fumbleT = this.phase2() ? 110 : 140; this.vx = this.vy = 0;
      this.wandX = this.x + this.facing * 80;
      this.game.say(this, 'Minha varinha!', '#bff3ff');
      A().play('land');
    }
    onArmorHit(dmg, d) {
      if (this.state === 'fumble') return; // não interrompe a fraqueza
      super.onArmorHit(dmg, d);
    }
    think() {
      if (this.commonBoss()) return;
      const g = this.game;
      if (this.state === 'fumble') {
        this.vx = this.vy = 0;
        if (--this.fumbleT <= 0) { this.fumbleT = 0; this.setState('idle'); this.setAnim('idle'); this.cool = 30; g.poof(this.wandX, this.y - 20); }
        return;
      }
      if (this.state === 'down' || this.state === 'hurt') this.setState('idle');
      const p = g.targetFor(this);
      if (this.state === 'attack') { this.updateAttack(); return; }
      this.alpha = 1;
      if (!this.active || !p) { this.vx = this.vy = 0; this.setAnim('idle'); return; }
      const dx = p.x - this.x, dy = p.y - this.y;
      this.facing = dx > 0 ? 1 : -1;
      const p2 = this.phase2();
      if (p2 && !this.p2Said) {
        this.p2Said = true;
        g.say(this, 'E agora... o GRANDE FINAL!', '#ff7af0');
        g.impact(this.x, this.y, 'TA-DÁ!', '#ff7af0', 1);
      }
      this.dmgMul = p2 ? 1.15 : 1;
      if (this.cool > 0) this.cool--;
      this.approach(this.sideTarget(p, 240), p.y, p2 ? 2.3 : 1.7);
      if (this.cool <= 0) {
        this.vx = this.vy = 0;
        let pick;
        // a cada 3 ataques vêm os coelhos da cartola (e a varinha cai logo depois)
        if (this.atkCount % 3 === 2) pick = 'hat';
        else {
          const opts = ['cards', 'spell'];
          if (Math.abs(dy) < 40) opts.push('wand', 'wand');
          if (p2) opts.push('spell', 'cards');
          pick = TT.choice(opts);
        }
        this.atkCount++;
        this.startAttack(this.ATK[pick]);
        this.cool = p2 ? this.nextCool(40, 70) : this.nextCool(70, 105);
        if (Math.random() < 0.3) g.say(this, TT.choice(this.taunts), '#bff3ff');
      }
    }
    draw(ctx, camX) {
      const t = this.animT, a = this.atk, k = this.tellK(), d = a && a.def;
      let al = this.alpha;
      if (this.state === 'dying' && (this.st >> 2) % 2 === 0) al *= 0.6;
      TT.computePose(this, this.pose);
      const fumbling = this.state === 'fumble';
      this.pose.noWand = fumbling;
      if (fumbling) { this.pose.lean = 0.35; this.pose.tilt = 0.3; this.pose.armF = [1.2, 1.5]; }
      const x = this.x - camX + this.tellShake(), y = this.y - this.z;
      // cartola no chão e coelhos saindo dela
      if (d === this.ATK.hat && a.zones && a.t < d.s + d.a + d.r) {
        const grow = TT.easeOut(Math.min(1, a.t / (d.s * 0.5)));
        for (const z of a.zones) {
          const zx = z.x - camX;
          drawTopHat(ctx, zx, z.y, 0.9 * grow, false);
          if (a.t >= d.s) {
            const u = Math.min(1, (a.t - d.s) / 5), down = a.t > d.s + d.a ? (a.t - d.s - d.a) / d.r : 0;
            ctx.save(); ctx.beginPath(); ctx.rect(zx - 80, z.y - 300, 160, 250); ctx.clip();
            TT.drawRabbit(ctx, zx, z.y - 46 + 120 * (1 - u) + 140 * down, 1, t, 0.85, { red: true });
            ctx.restore();
          } else if (a.t % 6 === 0) this.game.particles.spawn('star', z.x + TT.rand(-30, 30), z.y - TT.rand(40, 70), { vy: -1, color: '#ffffff', size: 7, life: 14 });
        }
      }
      ctx.save(); ctx.globalAlpha = al;
      // brilhos mágicos em volta
      if ((t >> 2) % 3 === 0 && !fumbling) TT.drawGlow(ctx, TT.choice(['#7af0ff', '#ff7af0', '#ffe14a']), x + TT.rand(-60, 60), y - TT.rand(40, 260), 10, 0.8);
      let sq = 0;
      if (k >= 0) sq = -0.06 * TT.easeOut(k);
      else if (a && a.t < d.s + d.a + 6) sq = 0.05;
      ctx.save(); ctx.translate(x, y); ctx.scale(1 - sq, 1 + sq); ctx.translate(-x, -y);
      TT.drawRig(ctx, this.style, this.pose, x, y, this.facing, { flash: this.flash > 3 || this.tellFlash(), t, out: this.out });
      ctx.restore();
      const o = this.out, tipX = o.fx != null ? o.fx + this.facing * 44 : x, tipY = o.fy != null ? o.fy - 8 : y - 150;
      // raio da varinha: estrelas em linha até a borda
      if (d === this.ATK.wand && o.fx != null) {
        if (a.t < d.s) TT.drawGlow(ctx, '#7af0ff', tipX, tipY, 14 + 34 * Math.max(0, k), 0.9);
        else if (a.t < d.s + d.a) {
          const end = this.facing > 0 ? TT.W + 60 : -60, w = 20 * (1 - Math.abs((a.t - d.s) / d.a - 0.5));
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(122,240,255,0.5)'; ctx.lineWidth = w * 2.2; ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(end, tipY + 8); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = w * 0.5; ctx.stroke();
          ctx.restore();
          for (let i = 0; i < 6; i++) {
            const sx = tipX + this.facing * (((a.t * 30 + i * 140) % 900)), sy = tipY + Math.sin(a.t * 0.5 + i) * 10;
            TT.drawBurst(ctx, sx, sy, 12, 5, i % 2 ? '#ffe14a' : '#ffffff', OUT, a.t * 0.2 + i);
          }
        }
      }
      // leque de cartas na mão e cartas voando nas faixas
      if (d === this.ATK.cards && a.zones && o.fx != null) {
        if (a.t < d.s) for (let i = 0; i < 5; i++) drawFlyingCard(ctx, o.fx + this.facing * 10, o.fy - 10, this.facing * (-0.6 + i * 0.3), i % 2 === 0);
        else if (a.t < d.s + d.a) {
          const u = (a.t - d.s) / d.a;
          a.zones.forEach((z, j) => {
            for (let i = 0; i < 3; i++) {
              const cx = z.x0 - camX + (z.x1 - z.x0) * TT.clamp(u * 1.2 - i * 0.12, 0, 1);
              drawFlyingCard(ctx, cx, z.y - 70, a.t * 0.6 + i + j, (i + j) % 2 === 0);
            }
          });
        }
      }
      // feitiço: fio de magia da varinha até o alvo marcado
      if (d === this.ATK.spell && a.zones && a.t < d.s + d.a) {
        const z = a.zones[0], zx = z.x - camX, zy = z.y - 60;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,122,240,' + (0.3 + 0.5 * Math.max(0, k)) + ')'; ctx.lineWidth = 3 + 4 * Math.max(0, k);
        ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 2;
        ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.quadraticCurveTo((tipX + zx) / 2, Math.min(tipY, zy) - 90, zx, zy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        for (let i = 0; i < 3; i++) { const ang = t * 0.2 + i * 2.1; TT.drawBurst(ctx, zx + Math.cos(ang) * 34, zy - 30 + Math.sin(ang) * 12, 9, 5, '#ffc0f6', OUT, ang); }
      }
      ctx.restore();
      // varinha caída no chão
      if (fumbling) {
        const wx = this.wandX - camX, wy = this.y + 6;
        ctx.save(); ctx.translate(wx, wy); ctx.rotate(0.15);
        ctx.fillStyle = '#1c1b26'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.fillRect(-30, -4, 60, 8); ctx.strokeRect(-30, -4, 60, 8);
        ctx.fillStyle = '#f4f4f8'; ctx.fillRect(18, -4, 12, 8); ctx.strokeRect(18, -4, 12, 8);
        ctx.restore();
        TT.drawGlow(ctx, '#bff3ff', wx + 24, wy, 16 + Math.sin(t * 0.3) * 4, 0.7);
      }
      this.drawTell(ctx, x, y, y - this.height - 10);
      if (fumbling) {
        Cinderblock.prototype.drawDizzy.call(this, ctx, x, y - this.height + 20);
        if ((t >> 3) % 2 === 0) TT.drawText(ctx, 'VARINHA NO CHÃO! DANO DOBRADO!', x, Math.min(TT.H - 20, y + 44), 24, '#bff3ff', OUT, 'center', 5);
      }
    }
  }
  TT.Mumbo = Mumbo;

  // ---- Slade: o mestre do crime de Jump City (fase 7), agora com o fogo de Trigon
  // Fraqueza: depois do salto com o bastão ele aterrissa de joelho — guarda aberta, leva dano dobrado.
  class Slade extends Boss {
    constructor(game, x, y) {
      super(game, x, y);
      this.name = 'SLADE';
      this.style = TT.STYLES.sladeBoss;
      this.hp = this.maxHp = 3000; // mais vida que os outros chefes: os Titãs já usam os golpes novos
      this.radius = 40; this.height = 220; this.shadowW = 54;
      this.poiseMax = 170;
      this.def = { score: 12000 };
      this.openT = 0; this.alpha = 1; this.atkCount = 0; this.p2Said = false; this.summonCool = 0;
      this.out = {};
      this.taunts = ['Previsível.', 'Vocês ainda têm muito a aprender.', 'Robin... sempre um passo atrás.', 'Eu já previ cada movimento seu.'];
      const clampX = (g, x, m) => TT.clamp(x, g.camX + m, g.camX + TT.W - m);
      this.ATK = {
        // sequência de bastão: três pancadas no arco à frente
        combo: { pose: 'swipe', weapon: 'staff', s: 26, a: 15, r: 22, rehit: 5, dmg: 7, kb: 3, stun: 14, zoneHit: true, color: '#ff7a1a', sound0: 'whoosh',
          zone(f) { return [{ k: 'half', x: f.x, y: f.y, rx: 200, ry: 60, f: f.facing }]; },
          onFrame(f, t, g) {
            if (t < this.s || t >= this.s + this.a || (t - this.s) % 5 !== 0) return;
            A().play('whoosh');
            g.particles.spawn('text', f.x + f.facing * 120, f.y - 170 + TT.rand(-20, 20), { text: TT.choice(['WHAK!', 'THWAK!', 'KRAK!']), size: 30, color: '#ffe14a', color2: '#c4300a', vy: -0.6, life: 22, rot: TT.rand(-0.3, 0.3) });
          } },
        // bombas de disco: caem nos círculos marcados (um em cima de cada Titã) e explodem
        bombs: { pose: 'throw', s: 34, a: 1, r: 24, color: '#ffae3a',
          zone(f, g) {
            const zs = [], hs = g.heroes(), n = f.phase2() ? 4 : 3, R = 80;
            for (const h of hs) zs.push({ k: 'ell', x: clampX(g, h.x, 60), y: TT.clamp(h.y, TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM), rx: R, ry: R * 0.42 });
            let guard = 0;
            while (zs.length < n && guard++ < 30) {
              const tp = groundTarget(g, TT.choice(hs) || f, 360, 110);
              if (zs.every((z) => Math.abs(z.x - tp.x) > 2 * R || Math.abs(z.y - tp.y) > R)) zs.push({ k: 'ell', x: tp.x, y: tp.y, rx: R, ry: R * 0.42 });
            }
            return zs;
          },
          onFrame(f, t, g, a) {
            if (t !== this.s) return;
            a.zones.forEach((z, i) => {
              const T = 30 + i * 6, z0 = 200, gr = 0.6, x0 = f.x + f.facing * 30;
              g.addProjectile(new Projectile(g, {
                kind: 'sladeBomb', team: 'enemy', owner: f, x: x0, y: f.y, z: z0,
                vx: (z.x - x0) / T, vy: (z.y - f.y) / T, vz: (0.5 * gr * T * T - z0) / T, grav: gr,
                r: 20, dmg: 0, blastDmg: 13, life: 120, explodeOnGround: z.rx, zone: z, flight: T, impactWord: 'BOOM!',
              }));
            });
            a.zones = null; // daqui em diante cada bomba desenha o seu alvo
            A().play('whoosh');
          } },
        // salto com o bastão: o círculo segue o Titã até a metade do aviso; ele salta e cai em cima (depois fica de joelho)
        leap: { pose: 'bigSlam', weapon: 'staff', s: 50, a: 6, r: 10, dmg: 17, knockdown: true, launch: 9, kb: 7, zoneHit: true, color: '#ff3b30',
          aim(f, g, a) {
            const p = g.targetFor(f);
            if (p) { a.tx = clampX(g, p.x, 70); a.ty = TT.clamp(p.y, TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM); }
            else if (a.tx == null) { a.tx = clampX(g, f.x + f.facing * 300, 70); a.ty = f.y; }
            return { k: 'ell', x: a.tx, y: a.ty, rx: 105, ry: 42 };
          },
          zone(f, g, a) { return [this.aim(f, g, a)]; },
          onFrame(f, t, g, a) {
            const half = Math.round(this.s * 0.5), z = a.zones[0];
            if (t < half) a.zones = [this.aim(f, g, a)];
            if (t === 2) g.say(f, 'Previsível.', '#ffb070');
            if (t === half) { a.x0 = f.x; a.y0 = f.y; A().play('jump'); g.dust(f.x, f.y, 8, '#c9b9a8'); }
            if (t >= half && t <= this.s) {
              const u = (t - half) / (this.s - half);
              f.grav = 0; f.vx = f.vy = f.vz = 0;
              f.x = TT.lerp(a.x0, z.x, u); f.y = TT.lerp(a.y0, z.y, u); f.z = Math.sin(u * Math.PI) * 360;
            }
            if (t === this.s) { f.z = 0; f.grav = TT.GRAVITY; g.impact(z.x, z.y, 'KRAK!', '#ff7a1a', 1.2); A().play('boom'); }
            if (t === this.s + this.a + this.r - 1) f.openGuard();
          } },
        // (fase 2) fogo de Trigon: anel de chamas em volta dele (fique colado nele ou bem longe)
        fire: { pose: 'castUp', s: 40, a: 10, r: 24, dmg: 14, knockdown: true, launch: 8, kb: 6, zoneHit: true, fire: true, color: '#ff4a1a', sound0: 'dark', sound: 'boom',
          zone(f) { return [{ k: 'ring', x: f.x, y: f.y, r0: 95, r1: 290, ry: 0.4 }]; },
          onFrame(f, t, g) {
            if (t === this.s) { g.shake = Math.max(g.shake, 14); g.particles.spawn('text', f.x, f.y - 290, { text: 'FWOOOSH!', size: 44, color: '#ffe14a', color2: '#c4300a', vy: -0.5, life: 40, rot: TT.rand(-0.1, 0.1) }); }
          } },
        // (fase 2) chama dois comandos
        summon: { pose: 'castUp', s: 30, a: 1, r: 24, color: '#ff7a1a',
          onFrame(f, t, g) {
            if (t !== this.s) return;
            g.say(f, 'Comandos... acabem com eles.', '#ffb070');
            for (const side of [-1, 1]) {
              const e = new SladeCommando(g, side < 0 ? g.camX + 90 : g.camX + TT.W - 90, TT.clamp(f.y + side * 60, TT.FLOOR_TOP + 20, TT.FLOOR_BOTTOM - 10));
              e.entering = false; e.cool = 50; g.addEnemy(e);
              g.poof(e.x, e.y - 60);
            }
            A().play('alarm');
          } },
      };
      this.applyDifficulty();
    }
    // Guarda aberta = dano dobrado.
    get dmgTaken() { return this.openT > 0 ? 2 : 1; }
    openGuard() {
      this.atk = null; this.grav = TT.GRAVITY; this.z = 0;
      this.setState('open'); this.setAnim('hurt');
      this.openT = this.phase2() ? 110 : 140; this.vx = this.vy = 0;
      this.game.say(this, 'Hmpf... impressionante.', '#ffb070');
    }
    onArmorHit(dmg, d) {
      if (this.state === 'open') return; // não interrompe a fraqueza
      super.onArmorHit(dmg, d);
    }
    die(dir, d) { this.grav = TT.GRAVITY; super.die(dir, d); }
    think() {
      if (this.commonBoss()) return;
      const g = this.game;
      if (this.state === 'open') {
        this.vx = this.vy = 0;
        if (--this.openT <= 0) { this.openT = 0; this.setState('idle'); this.setAnim('idle'); this.cool = 25; }
        return;
      }
      if (this.state === 'down' || this.state === 'hurt') this.setState('idle');
      const p = g.targetFor(this);
      if (this.state === 'attack') { this.updateAttack(); return; }
      if (!this.active || !p) { this.vx = this.vy = 0; this.setAnim('idle'); return; }
      const dx = p.x - this.x, dy = p.y - this.y, adx = Math.abs(dx);
      this.facing = dx > 0 ? 1 : -1;
      const p2 = this.phase2();
      if (p2 && !this.p2Said) {
        this.p2Said = true;
        g.say(this, 'Trigon me deu um novo poder. Vejam!', '#ff7a1a');
        g.impact(this.x, this.y, 'FOGO!', '#ff4a1a', 1.1);
      }
      this.dmgMul = p2 ? 1.15 : 1;
      if (this.cool > 0) this.cool--;
      if (this.summonCool > 0) this.summonCool--;
      this.approach(this.sideTarget(p, 190), p.y, p2 ? 2.8 : 2.2);
      if (this.cool <= 0) {
        this.vx = this.vy = 0;
        let pick;
        // a cada 3 ataques vem o salto com o bastão (e a guarda aberta logo depois)
        if (this.atkCount % 3 === 2) pick = 'leap';
        else if (p2 && this.summonCool <= 0 && g.enemies.length < 3) { pick = 'summon'; this.summonCool = 900; }
        else {
          const opts = ['bombs'];
          if (adx < 250 && Math.abs(dy) < 50) opts.push('combo', 'combo');
          if (p2) opts.push('fire', 'fire');
          pick = TT.choice(opts);
        }
        if (pick !== 'summon') this.atkCount++;
        this.startAttack(this.ATK[pick]);
        this.cool = p2 ? this.nextCool(36, 64) : this.nextCool(60, 95);
        if (pick !== 'leap' && Math.random() < 0.3) g.say(this, TT.choice(this.taunts), '#ffb070');
      }
    }
    draw(ctx, camX) {
      const t = this.animT, a = this.atk, k = this.tellK(), d = a && a.def;
      let al = this.alpha;
      if (this.state === 'dying' && (this.st >> 2) % 2 === 0) al *= 0.6;
      TT.computePose(this, this.pose);
      this.pose.weapon = 'staff'; // sempre com o bastão
      const open = this.state === 'open';
      if (open) { this.pose.lean = 0.45; this.pose.bob = 26; this.pose.tilt = 0.2; this.pose.legF = [1.45, 0.1]; this.pose.legB = [-0.2, -1.6]; this.pose.armF = [0.6, 0.2]; }
      const x = this.x - camX + this.tellShake(), y = this.y - this.z, p2 = this.phase2();
      ctx.save(); ctx.globalAlpha = al;
      // aura de fogo de Trigon na fase 2 (e brilho do olho durante a apresentação)
      if (p2 && this.state !== 'dying') TT.drawGlow(ctx, '#ff4a1a', x, y - 110, 130 + Math.sin(t * 0.15) * 14, 0.4);
      if (al < 1 && this.out.hx != null) TT.drawGlow(ctx, '#ff7a1a', this.out.hx, this.out.hy, 30, 1 - al * 0.5);
      let sq = 0;
      if (k >= 0) sq = -0.06 * TT.easeOut(k);
      else if (a && a.t < d.s + d.a + 6) sq = 0.05;
      ctx.save(); ctx.translate(x, y); ctx.scale(1 - sq, 1 + sq); ctx.translate(-x, -y);
      TT.drawRig(ctx, this.style, this.pose, x, y, this.facing, { flash: this.flash > 3 || this.tellFlash(), t, out: this.out });
      ctx.restore();
      // chamas nos ombros na fase 2
      if (p2 && this.out.hx != null && this.state !== 'dying') {
        drawFlame(ctx, this.out.hx - this.facing * 30, this.out.hy + 40, 38, t, 0);
        drawFlame(ctx, this.out.hx + this.facing * 18, this.out.hy + 44, 30, t, 2);
      }
      // bastão girando durante a sequência (rastro laranja)
      if (d === this.ATK.combo && a.t >= d.s && a.t < d.s + d.a + 3 && this.out.fx != null) {
        const u = ((a.t - d.s) % 5) / 5;
        ctx.save(); ctx.globalAlpha = al * (1 - u) * 0.8; ctx.strokeStyle = '#ffb070'; ctx.lineWidth = 12;
        ctx.beginPath(); ctx.ellipse(x + this.facing * 60, y - 110, 150, 70, 0, this.facing > 0 ? -1.3 : Math.PI - 1.3, this.facing > 0 ? 1.3 : Math.PI + 1.3); ctx.stroke();
        ctx.restore();
      }
      // bomba de disco piscando na mão durante a preparação
      if (d === this.ATK.bombs && k >= 0 && this.out.fx != null && (a.t >> 2) % 2 === 0) TT.drawGlow(ctx, '#ff7a1a', this.out.fx, this.out.fy, 18 + 14 * k, 1);
      // anel de chamas
      if (d === this.ATK.fire && a.zones && a.t >= d.s && a.t < d.s + d.a + 8) {
        const z = a.zones[0], u = Math.min(1, (a.t - d.s) / 4), fade = a.t > d.s + d.a ? 1 - (a.t - d.s - d.a) / 8 : 1;
        ctx.save(); ctx.globalAlpha = al * fade;
        for (let i = 0; i < 20; i++) {
          const ang = i / 20 * Math.PI * 2, r = (z.r0 + z.r1) / 2 + Math.sin(i * 2.3) * (z.r1 - z.r0) * 0.3;
          drawFlame(ctx, z.x - camX + Math.cos(ang) * r, z.y + Math.sin(ang) * r * z.ry, 90 * u, t, i);
        }
        ctx.restore();
      }
      ctx.restore();
      this.drawTell(ctx, x, y, y - this.height - 10);
      if (open) {
        Cinderblock.prototype.drawDizzy.call(this, ctx, x, y - this.height + 40);
        if ((t >> 3) % 2 === 0) TT.drawText(ctx, 'GUARDA ABERTA! DANO DOBRADO!', x, Math.min(TT.H - 20, y + 44), 24, '#ffd0a0', OUT, 'center', 5);
      }
    }
  }
  TT.Slade = Slade;

  // Cúpula de vidro com o Cérebro (o líder da Irmandade do Mal), presa num suporte de metal.
  // open = tampa aberta e o cérebro faiscando (fraqueza). s = escala.
  function drawBrainJar(ctx, x, y, s, t, open, flash) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = flash ? '#fff' : '#5c6169'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-30, 6, 60, 18, 5); else ctx.rect(-30, 6, 60, 18); ctx.fill(); ctx.stroke(); // base
    ctx.fillStyle = '#3a3d47'; ctx.fillRect(-22, 12, 44, 5);
    if (!flash) { ctx.fillStyle = (t >> 3) % 2 ? '#ff3b30' : '#ffe14a'; ctx.beginPath(); ctx.arc(20, 15, 3, 0, Math.PI * 2); ctx.fill(); }
    // líquido verde e o cérebro rosa boiando
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -14, 26, 28, 0, Math.PI, 0); ctx.lineTo(26, 6); ctx.lineTo(-26, 6); ctx.closePath(); ctx.clip();
    ctx.fillStyle = flash ? '#fff' : 'rgba(120,230,170,0.55)'; ctx.fillRect(-30, -50, 60, 60);
    const bob = Math.sin(t * 0.08) * 2;
    ctx.fillStyle = flash ? '#fff' : '#f2a6c0'; ctx.strokeStyle = '#a8506e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -14 + bob, 17, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (!flash) {
      ctx.strokeStyle = '#c96a8e'; ctx.lineWidth = 1.6;
      for (const [a, b, c, d2] of [[-12, -18, -4, -10], [-6, -24, 2, -16], [4, -22, 12, -14], [-10, -8, 2, -6], [6, -10, 12, -6]]) { ctx.beginPath(); ctx.moveTo(a, b + bob); ctx.quadraticCurveTo((a + c) / 2 + 3, (b + d2) / 2 - 4 + bob, c, d2 + bob); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 3; i++) { const by = ((t * 0.6 + i * 14) % 36); ctx.beginPath(); ctx.arc(-12 + i * 12, 2 - by, 2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    // vidro
    ctx.beginPath(); ctx.ellipse(0, -14, 26, 28, 0, Math.PI, 0); ctx.lineTo(26, 6); ctx.lineTo(-26, 6); ctx.closePath();
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
    if (!flash) { ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-6, -18, 18, 3.6, 4.4); ctx.stroke(); }
    if (open) { // tampa aberta para o lado e faíscas
      ctx.save(); ctx.translate(20, -40); ctx.rotate(0.9);
      ctx.fillStyle = flash ? '#fff' : '#8a909a'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      if (!flash) for (let i = 0; i < 3; i++) { const ang = t * 0.4 + i * 2.1; TT.drawArc(ctx, 0, -20, Math.cos(ang) * 30, -20 + Math.sin(ang) * 26, '#ffe14a', 2, 4); }
    } else {
      ctx.fillStyle = flash ? '#fff' : '#8a909a'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, -42, 10, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); // tampa
    }
    ctx.restore();
  }
  TT.drawBrainJar = drawBrainJar;

  // ---- Monsieur Mallah e o Cérebro (fase 8): o gorila de boina da Irmandade do Mal carrega o Cérebro
  // no ombro. Fraqueza: depois do laser, a cúpula superaquece e ABRE — o cérebro fica exposto (dano dobrado).
  class Mallah extends Boss {
    constructor(game, x, y) {
      super(game, x, y);
      this.name = 'MALLAH E O CÉREBRO';
      this.style = TT.STYLES.mallah;
      this.hp = this.maxHp = 2800; // os Titãs já têm golpes novos e combos
      this.radius = 50; this.height = 250; this.shadowW = 80;
      this.poiseMax = 200;
      this.def = { score: 14000 };
      this.openT = 0; this.atkCount = 0; this.p2Said = false; this.summonCool = 0; this.out = {};
      this.taunts = ['Mestre, eles são persistentes.', 'Pelo Cérebro!', 'GRRRAH!', 'A Irmandade não perde.'];
      const clampX = (g, x, m) => TT.clamp(x, g.camX + m, g.camX + TT.W - m);
      this.ATK = {
        // tapa de gorila em arco à frente
        smash: { pose: 'bigSwing', s: 26, a: 6, r: 24, dmg: 16, knockdown: true, launch: 7, kb: 10, zoneHit: true, color: '#ff8a3a', sound0: 'roar',
          zone(f) { return [{ k: 'half', x: f.x, y: f.y, rx: 210, ry: 60, f: f.facing }]; },
          onFrame(f, t, g) { if (t === this.s) { A().play('hitHeavy'); g.impact(f.x + f.facing * 130, f.y, 'WHAM!', '#ff8a3a', 1); } } },
        // investida de gorila pela faixa até a borda da tela (bate e fica tonto)
        charge: { pose: 'bigCharge', s: 30, a: 54, r: 26, dmg: 18, reach: [0, 90], depth: 50, kb: 12, knockdown: true, launch: 7, lunge: 11, sound0: 'roar', color: '#ff4a3a',
          zone(f, g) {
            const R = g.camX + TT.W - 70, L = g.camX + 70;
            return [{ k: 'rect', x0: f.x - f.facing * 24, x1: f.facing > 0 ? R + 130 : L - 130, y: f.y, d: 50, arrows: true }];
          },
          onFrame(f, t, g) {
            const run = t > this.s && t < this.s + this.a;
            if (t === this.s) g.impact(f.x, f.y, 'UH-UH-UH!', '#ff4a3a', 0.5);
            if (run && t % 4 === 0) { g.dust(f.x - f.facing * 50, f.y, 2, '#e8f2ff'); g.shake = Math.max(g.shake, 3); }
            const L = g.camX + 70, R = g.camX + TT.W - 70;
            if (run && ((f.facing > 0 && f.x > R) || (f.facing < 0 && f.x < L))) {
              f.x = TT.clamp(f.x, L, R); f.atk = null; A().play('boom');
              g.debrisBurst(f.x + f.facing * 60, f.y - 120, 10, '#bfefff');
              g.impact(f.x + f.facing * 60, f.y, 'CRASH!', '#9fe8ff', 1.2);
              f.setState('stagger'); f.setAnim('hurt'); f.st = -30; f.vx = -f.facing * 4;
            }
          } },
        // laser do Cérebro em linha reta; depois a cúpula superaquece e abre (fraqueza)
        beam: { pose: 'beam', s: 40, a: 14, r: 10, dmg: 15, knockdown: true, launch: 6, kb: 8, zoneHit: true, zr: 80, color: '#ff4ad0', sound0: 'alarm', sound: 'laser',
          zone(f) { return [{ k: 'rect', x0: f.x + f.facing * 20, x1: f.x + f.facing * 760, y: f.y, d: 30, arrows: true }]; },
          onFrame(f, t, g) {
            if (t === 2) g.say(f, 'Monsieur Mallah: o laser!', '#ff9ad6');
            if (t === this.s) { g.shake = Math.max(g.shake, 8); g.impact(f.x + f.facing * 400, f.y, 'ZZZAP!', '#ff4ad0', 0.8); }
            if (t === this.s + this.a + this.r - 1) f.openJar();
          } },
        // (fase 2) raio congelante do Cérebro: círculos em cima de cada Titã; quem ficar dentro congela
        freeze: { pose: 'castUp', s: 38, a: 6, r: 22, dmg: 10, freezeHero: 70, stun: 70, kb: 0, zoneHit: true, zr: 60, color: '#5fc8ff', sound0: 'alarm', sound: 'zap',
          zone(f, g) {
            const zs = [], R = 90;
            for (const h of g.heroes()) zs.push({ k: 'ell', x: clampX(g, h.x, 60), y: TT.clamp(h.y, TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM), rx: R, ry: R * 0.42 });
            let guard = 0;
            while (zs.length < 3 && guard++ < 30) {
              const tp = groundTarget(g, TT.choice(g.heroes()) || f, 380, 110);
              if (zs.every((z) => Math.abs(z.x - tp.x) > 2 * R || Math.abs(z.y - tp.y) > R)) zs.push({ k: 'ell', x: tp.x, y: tp.y, rx: R, ry: R * 0.42 });
            }
            return zs;
          },
          onFrame(f, t, g, a) {
            if (t === 2) g.say(f, 'Congelem os Titãs!', '#9fe8ff');
            if (t === this.s) for (const z of a.zones) {
              for (let i = 0; i < 10; i++) g.particles.spawn('star', z.x + TT.rand(-z.rx, z.rx) * 0.8, z.y - TT.rand(0, 120), { vx: TT.rand(-2, 2), vy: TT.rand(-4, 0), color: TT.choice(['#e6fbff', '#9fe8ff', '#ffffff']), size: 9, life: 22, rot: Math.random(), vr: 0.2 });
              g.particles.spawn('ring', z.x, z.y - 10, { color: '#bfefff', size: 160, life: 16, flat: 0.42 });
            }
          } },
        // (fase 2) chama dois soldados congeladores
        summon: { pose: 'castUp', s: 30, a: 1, r: 24, color: '#9fe8ff',
          onFrame(f, t, g) {
            if (t !== this.s) return;
            g.say(f, 'Soldados! Para o Cérebro!', '#9fe8ff');
            for (const side of [-1, 1]) {
              const e = new FreezeTrooper(g, side < 0 ? g.camX + 90 : g.camX + TT.W - 90, TT.clamp(f.y + side * 60, TT.FLOOR_TOP + 20, TT.FLOOR_BOTTOM - 10));
              e.entering = false; e.cool = 60; g.addEnemy(e);
              g.poof(e.x, e.y - 60);
            }
            A().play('alarm');
          } },
      };
      this.applyDifficulty();
    }
    get dmgTaken() { return this.openT > 0 ? 2 : 1; }
    openJar() {
      this.atk = null;
      this.setState('open'); this.setAnim('hurt');
      this.openT = this.phase2() ? 110 : 140; this.vx = this.vy = 0;
      this.game.say(this, 'Mallah! A cúpula superaqueceu!', '#ff9ad6');
      A().play('zap');
    }
    onArmorHit(dmg, d) {
      if (this.state === 'open') return;
      super.onArmorHit(dmg, d);
    }
    think() {
      if (this.commonBoss()) return;
      const g = this.game;
      if (this.state === 'open') {
        this.vx = this.vy = 0;
        if (this.st % 6 === 0 && this.out.hx != null) g.particles.spawn('spark', this.out.hx + g.camX - this.facing * 40, this.out.hy + 10, { vx: TT.rand(-4, 4), vy: TT.rand(-6, -2), color: '#ffe14a', size: 4, life: 14, grav: 0.2 });
        if (--this.openT <= 0) { this.openT = 0; this.setState('idle'); this.setAnim('idle'); this.cool = 25; }
        return;
      }
      if (this.state === 'down' || this.state === 'hurt') this.setState('idle');
      const p = g.targetFor(this);
      if (this.state === 'attack') { this.updateAttack(); return; }
      if (!this.active || !p) { this.vx = this.vy = 0; this.setAnim('idle'); return; }
      const dx = p.x - this.x, dy = p.y - this.y, adx = Math.abs(dx);
      this.facing = dx > 0 ? 1 : -1;
      const p2 = this.phase2();
      if (p2 && !this.p2Said) { this.p2Said = true; g.say(this, 'Chega! Raio congelante, Mallah!', '#9fe8ff'); g.impact(this.x, this.y, 'FRIO!', '#9fe8ff', 1.1); }
      this.dmgMul = p2 ? 1.15 : 1;
      if (this.cool > 0) this.cool--;
      if (this.summonCool > 0) this.summonCool--;
      this.approach(this.sideTarget(p, 170), p.y, p2 ? 2.6 : 2.1);
      if (this.cool <= 0) {
        this.vx = this.vy = 0;
        let pick;
        // a cada 3 ataques vem o laser do Cérebro (e a cúpula abre logo depois)
        if (this.atkCount % 3 === 2) pick = 'beam';
        else if (p2 && this.summonCool <= 0 && g.enemies.length < 3) { pick = 'summon'; this.summonCool = 900; }
        else {
          const opts = [];
          if (adx < 240 && Math.abs(dy) < 50) opts.push('smash', 'smash');
          if (Math.abs(dy) < 50 && adx > 300) opts.push('charge');
          if (p2) opts.push('freeze', 'freeze');
          if (!opts.length) opts.push('charge', 'smash');
          pick = TT.choice(opts);
        }
        if (pick !== 'summon') this.atkCount++;
        this.startAttack(this.ATK[pick]);
        this.cool = p2 ? this.nextCool(38, 66) : this.nextCool(60, 95);
        if (pick !== 'beam' && Math.random() < 0.3) g.say(this, TT.choice(this.taunts), '#ffb070');
      }
    }
    draw(ctx, camX) {
      const t = this.animT, a = this.atk, k = this.tellK(), d = a && a.def;
      let al = 1;
      if (this.state === 'dying' && (this.st >> 2) % 2 === 0) al = 0.6;
      TT.computePose(this, this.pose);
      const open = this.state === 'open';
      if (this.state === 'stagger') { this.pose.lean = -0.3; this.pose.tilt = -0.3; }
      if (open) { this.pose.lean = -0.15; this.pose.armF = [2.6, 2.9]; this.pose.armB = [2.4, 2.8]; } // mãos na cabeça, nervoso
      const x = this.x - camX + this.tellShake(), y = this.y - this.z;
      ctx.save(); ctx.globalAlpha = al;
      let sq = 0;
      if (k >= 0) sq = -0.06 * TT.easeOut(k);
      else if (a && a.t < d.s + d.a + 6) sq = 0.05;
      ctx.save(); ctx.translate(x, y); ctx.scale(1 - sq, 1 + sq); ctx.translate(-x, -y);
      TT.drawRig(ctx, this.style, this.pose, x, y, this.facing, { flash: this.flash > 3 || this.tellFlash(), t, out: this.out });
      ctx.restore();
      // a cúpula do Cérebro no ombro de trás
      const jx = this.out.hx != null ? this.out.hx - this.facing * 44 : x - this.facing * 40, jy = this.out.hy != null ? this.out.hy + 14 : y - this.height + 40;
      const charging = d === this.ATK.beam && k >= 0;
      if (charging || open) TT.drawGlow(ctx, open ? '#ffe14a' : '#ff4ad0', jx, jy - 20, 50 + (charging ? 40 * k : 10), 0.8);
      drawBrainJar(ctx, jx, jy, 1.1, t, open, this.flash > 3);
      // laser do Cérebro
      if (d === this.ATK.beam && a.t >= d.s && a.t < d.s + d.a + 3) {
        const u = Math.min(1, (a.t - d.s + 1) / 3), fade = a.t >= d.s + d.a ? 1 - (a.t - d.s - d.a) / 3 : 1, x1 = jx + this.facing * 760 * u, y1 = this.y - 50;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.globalAlpha = al * fade;
        ctx.strokeStyle = '#ff4ad0'; ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(jx, jy - 18); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = '#ffd0f2'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(jx, jy - 18); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      this.drawTell(ctx, x, y, y - this.height - 30);
      if (this.state === 'stagger') Cinderblock.prototype.drawDizzy.call(this, ctx, x, y - this.height - 10);
      if (open && (t >> 3) % 2 === 0) TT.drawText(ctx, 'CÉREBRO EXPOSTO! DANO DOBRADO!', x, Math.min(TT.H - 20, y + 44), 24, '#ffd0f2', OUT, 'center', 5);
    }
  }
  TT.Mallah = Mallah;

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
      Object.assign(this, { vx: 0, vy: 0, vz: 0, grav: 0, pierce: false, life: 60, r: 12, t: 0, kb: 3, launch: 5, knockdown: false });
      Object.assign(this, o);
      this.hits = new Set();
      this.remove = false;
      this.spin = 0;
      this.facing = this.vx < 0 ? -1 : 1;
    }
    update() {
      const g = this.game;
      this.t++;
      // histórico curto de posições para os rastros
      if (this.trailN) {
        const tr = this.trail || (this.trail = []);
        tr.push(this.x, this.y - this.z);
        if (tr.length > this.trailN * 2) tr.splice(0, 2);
      }
      if (this.homing && this.t > 5) this.steer(g);
      this.x += this.vx; this.y += this.vy;
      this.vz -= this.grav; this.z += this.vz;
      if (this.minZ != null && this.z < this.minZ) { this.z = this.minZ; this.vz = 0; }
      this.spin += 0.5;
      if (--this.life <= 0) { this.remove = true; if (this.blastEnd) this.explode(); return; }
      if (this.explodeOnGround && this.z <= 0) {
        this.z = 0; this.remove = true;
        g.blast(this.x, this.y, this.explodeOnGround, this.blastDmg || this.dmg, this.team, this.owner, this.blastColor);
        if (this.impactWord) g.impact(this.x, this.y, this.impactWord, '#ff7a2a', 0.5);
        return;
      }
      if (this.kind === 'starbolt' || this.kind === 'bigbolt') {
        if (this.t % 2 === 0) g.particles.spawn('glow', this.x - this.vx, this.y - this.z, { color: '#5dff8a', size: this.r * 1.2, life: 10 });
        if (this.t % 4 === 0) g.particles.spawn('star', this.x - this.vx * 2, this.y - this.z + TT.rand(-8, 8), { color: '#d9ffe4', size: 6, life: 12, rot: Math.random() });
      } else if (this.kind === 'raven') {
        if (this.t % 3 === 0) g.particles.spawn('feather', this.x - this.vx * 3, this.y - this.z + TT.rand(-20, 20), { color: '#1a0f2e', size: 9, life: 22, vr: 0.2, vy: TT.rand(-1, 1) });
        if (this.t % 4 === 0) g.particles.spawn('glow', this.x - this.vx * 2, this.y - this.z, { color: DARK, size: 30, life: 12 });
      } else if (this.kind === 'missile') {
        if (this.t % 2 === 0) g.particles.spawn('dust', this.x, this.y - this.z - 30, { color: 'rgba(200,200,200,0.7)', size: 8, life: 18 });
      } else if (this.kind === 'heroMissile') {
        if (this.t % 2 === 0) g.particles.spawn('dust', this.x - this.vx * 2, this.y - this.z, { color: 'rgba(220,230,255,0.75)', size: 9, life: 16 });
      } else if (this.kind === 'icedisk') {
        if (this.t % 3 === 0) g.particles.spawn('star', this.x - this.vx, this.y - this.z + TT.rand(-6, 6), { color: '#e6fbff', size: 6, life: 14, rot: Math.random() });
      } else if (this.kind === 'tkRock') {
        if (this.t % 3 === 0) g.particles.spawn('glow', this.x - this.vx * 2, this.y - this.z, { color: DARK, size: 34, life: 12 });
      } else if (this.kind === 'sladeBomb') {
        if (this.t % 3 === 0) g.particles.spawn('dust', this.x, this.y - this.z, { color: 'rgba(90,90,100,0.7)', size: 7, life: 14 });
      }
      if (!this.dmg) return;
      const sx = this.x - g.camX;
      if (sx < -200 || sx > TT.W + 200) { this.remove = true; return; }
      const targets = this.team === 'hero' ? g.enemies.concat(g.props) : g.heroes();
      for (const t of targets) {
        if (!t || t.dead || this.hits.has(t) || (t.ko)) continue;
        if (Math.abs(t.x - this.x) > this.r + t.radius) continue;
        if (Math.abs(t.y - this.y) > 24 + this.r * 0.4) continue;
        if (this.z < t.z - 10 || this.z > t.z + t.height + 10) continue;
        this.hits.add(t);
        const ok = t.takeHit(this, this, this.facing);
        if (ok) {
          g.onHit(this.owner || this, t, this);
          if (this.blastR) { this.remove = true; this.explode(); break; }
          if (!this.pierce) { this.remove = true; break; }
        }
      }
    }
    // Míssil teleguiado: depois de subir, persegue o inimigo mais próximo à frente (na altura do peito).
    steer(g) {
      let tg = this.tgt;
      if (!tg || tg.dead || tg.remove) {
        tg = this.tgt = null; let bd = 1e9;
        for (const e of g.enemies) {
          if (e.dead || (e.x - this.x) * this.facing < -30 || Math.abs(e.x - g.camX - TT.W / 2) > TT.W / 2) continue;
          const d = Math.abs(e.x - this.x) + Math.abs(e.y - this.y) * 2;
          if (d < bd) { bd = d; tg = e; }
        }
        this.tgt = tg;
      }
      if (!tg) return;
      this.grav = 0;
      const dx = tg.x - this.x, dy = tg.y - this.y, dz = tg.z + (tg.height || 100) * 0.5 - this.z, L = Math.hypot(dx, dy, dz) || 1, sp = 11;
      this.vx += (dx / L * sp - this.vx) * 0.22; this.vy += (dy / L * sp - this.vy) * 0.22; this.vz += (dz / L * sp - this.vz) * 0.22;
    }
    // Explosão dos projéteis novos dos Titãs (discos, mísseis, pedra da telecinese).
    explode() {
      if (!this.blastR || this.exploded) return;
      this.exploded = true;
      this.game.blast(this.x, this.y, this.blastR, this.blastDmg || this.dmg, this.team, this.owner, this.blastColor);
    }
    get dmgMul() { return 1; }
    // Rastro: linha que afina e some a partir do histórico de posições.
    drawTrail(ctx, camX, col, w) {
      const tr = this.trail;
      if (!tr || tr.length < 4) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.strokeStyle = col;
      const n = tr.length / 2;
      for (let i = 1; i < n; i++) {
        const q = i / n;
        ctx.globalAlpha = q * 0.7; ctx.lineWidth = Math.max(1, w * q);
        ctx.beginPath(); ctx.moveTo(tr[i * 2 - 2] - camX, tr[i * 2 - 1]); ctx.lineTo(i === n - 1 ? this.x - camX : tr[i * 2] - camX, i === n - 1 ? this.y - this.z : tr[i * 2 + 1]); ctx.stroke();
      }
      ctx.restore();
    }
    draw(ctx, camX) {
      const x = this.x - camX, y = this.y - this.z;
      switch (this.kind) {
        case 'birdarang': {
          this.drawTrail(ctx, camX, '#ffe9a0', 5);
          ctx.save(); ctx.translate(x, y); ctx.rotate(this.spin);
          ctx.fillStyle = '#2a2a33'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-16, -4); ctx.lineTo(0, -1); ctx.lineTo(16, -4); ctx.lineTo(4, 6); ctx.lineTo(0, 3); ctx.lineTo(-4, 6); ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#f2c428'; ctx.fillRect(-2, -1, 4, 3);
          ctx.restore();
          break;
        }
        case 'starbolt': case 'bigbolt': {
          // brilho pulsante + rastro + núcleo branco com anel
          const pulse = 1 + Math.sin(this.t * 0.7) * 0.18;
          this.drawTrail(ctx, camX, '#5dff8a', this.r * 0.9);
          TT.drawGlow(ctx, '#5dff8a', x, y, this.r * 2.6 * pulse, 1);
          TT.drawGlow(ctx, '#c8ffd8', x, y, this.r * 1.2 * pulse, 0.9);
          ctx.strokeStyle = 'rgba(220,255,230,0.9)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, this.r * 0.75 * pulse, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, this.r * 0.42, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'raven':
          this.drawTrail(ctx, camX, '#8a5cff', 16);
          drawRavenCrow(ctx, x, y, this.facing, 1.35, this.t, 1);
          break;
        case 'icedisk': { // disco congelante: azul-gelo com brilho
          this.drawTrail(ctx, camX, '#bfefff', 7);
          TT.drawGlow(ctx, ICE, x, y, 34, 0.8);
          ctx.save(); ctx.translate(x, y); ctx.rotate(this.spin); ctx.scale(1, 0.55);
          ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fillStyle = '#e8fbff'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fillStyle = '#5fc8ff'; ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.lineTo(-Math.cos(a) * 12, -Math.sin(a) * 12); ctx.stroke(); }
          ctx.restore();
          break;
        }
        case 'bombdisk': { // disco explosivo: vermelho com luz piscando
          this.drawTrail(ctx, camX, '#ffb08a', 6);
          ctx.save(); ctx.translate(x, y); ctx.rotate(this.spin); ctx.scale(1, 0.6);
          ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fillStyle = '#3a3440'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fillStyle = '#d7262e'; ctx.fill();
          ctx.restore();
          if ((this.t >> 2) % 2 === 0) TT.drawGlow(ctx, '#ff4a2a', x, y, 22, 1);
          break;
        }
        case 'heroMissile': { // mini-míssil do ombro do Ciborgue (aponta na direção do voo)
          this.drawTrail(ctx, camX, '#bfe6ff', 6);
          const ang = Math.atan2(-(this.vz), this.vx);
          ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
          ctx.fillStyle = '#d9dde6'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(8, -6); ctx.lineTo(-14, -6); ctx.lineTo(-14, 6); ctx.lineTo(8, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#3b78d8'; ctx.fillRect(-8, -6, 5, 12);
          ctx.restore();
          TT.drawGlow(ctx, SONIC, x - Math.cos(ang) * 20, y - Math.sin(ang) * 20, 16, 1);
          break;
        }
        case 'tkRock': // pedaço do chão envolto na energia negra da Ravena
          this.drawTrail(ctx, camX, '#8a5cff', 20);
          TT.drawGlow(ctx, DARK, x, y, 64, 0.7);
          drawBoulder(ctx, x, y, 1.15, this.spin * 0.2);
          ctx.save(); ctx.strokeStyle = '#d6c2ff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
          ctx.beginPath(); ctx.ellipse(x, y, 40, 30, this.spin * 0.1, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
          break;
        case 'rocketFist': { // punho-foguete do Ciborgue: punho de metal com chama atrás
          TT.drawGlow(ctx, '#ff9a3a', x - this.facing * 30, y, 44, 0.9);
          drawFlame(ctx, x - this.facing * 34, y + 10, 30, this.t, 1);
          ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, 1);
          ctx.fillStyle = '#d9dde6'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.rect(-22, -9, 16, 18); ctx.fill(); ctx.stroke(); // pulso
          ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-8, -15, 26, 30, 8); else ctx.rect(-8, -15, 26, 30); ctx.fill(); ctx.stroke(); // punho
          ctx.strokeStyle = '#8a909a'; ctx.lineWidth = 2; for (const yy of [-6, 2, 9]) { ctx.beginPath(); ctx.moveTo(8, yy); ctx.lineTo(17, yy); ctx.stroke(); }
          ctx.fillStyle = '#3b78d8'; ctx.fillRect(-20, -4, 10, 8);
          ctx.restore();
          break;
        }
        case 'sonicShot': // tiro curto do canhão sônico (anel + núcleo branco)
          this.drawTrail(ctx, camX, SONIC, 12);
          TT.drawGlow(ctx, SONIC, x, y, 40, 1);
          ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(x, y, 8, 18, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
          break;
        case 'sladeBomb': { // bomba de disco do Slade (luz laranja piscando)
          ctx.save(); ctx.translate(x, y); ctx.rotate(this.spin * 0.6); ctx.scale(1, 0.6);
          ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fillStyle = '#2a2d33'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
          ctx.fillStyle = '#80868f'; ctx.fillRect(-16, -3, 32, 6);
          ctx.restore();
          if ((this.t >> 2) % 2 === 0) TT.drawGlow(ctx, FIRE, x, y, 26, 1);
          break;
        }
        case 'laser':
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = '#ff3030'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x - this.vx * 3, y); ctx.lineTo(x, y); ctx.stroke();
          ctx.strokeStyle = '#ffd0d0'; ctx.lineWidth = 3; ctx.stroke();
          ctx.restore();
          break;
        case 'boulder':
          drawBoulder(ctx, x, y, 1, this.spin * 0.3);
          break;
        case 'desk': case 'locker':
          TT.drawGlow(ctx, '#ff4a6a', x, y, 44, 0.55);
          drawDesk(ctx, x, y, 1, this.spin * 0.25, this.kind === 'locker');
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
      // alvo marcado no chão (míssil/pedra): a zona é exatamente a área da explosão
      if (!this.zone) return;
      const z = this.zone, k = Math.min(1, this.t / (this.flight || 40));
      TT.drawZone(ctx, z, camX, k, this.t);
      // mira no centro
      const x = z.x - camX, r = 14 + 8 * (1 - k);
      ctx.strokeStyle = (this.t >> 2) % 2 ? '#ffffff' : '#ff2a2a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - r, z.y); ctx.lineTo(x + r, z.y); ctx.moveTo(x, z.y - r * 0.42); ctx.lineTo(x, z.y + r * 0.42); ctx.stroke();
      // sombra do objeto caindo
      ctx.fillStyle = 'rgba(15,5,25,0.35)';
      ctx.beginPath(); ctx.ellipse(this.x - camX, this.y, 26 * (0.5 + 0.5 * k), 9 * (0.5 + 0.5 * k), 0, 0, Math.PI * 2); ctx.fill();
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
      if (this.r > this.maxR + 13) this.remove = true;
      const g = this.game;
      const targets = this.team === 'hero' ? g.enemies : g.heroes();
      for (const t of targets) {
        if (!t || t.dead || t.ko || this.hits.has(t) || t.z > 8) continue;
        const dx = t.x - this.x, dy = (t.y - this.y) / 0.38;
        const d = Math.sqrt(dx * dx + dy * dy);
        // a frente da onda acabou de passar pelo alvo (e ele está dentro da área marcada)
        if (d <= this.maxR && d <= this.r + 13 && d > this.r - 37) {
          this.hits.add(t);
          if (t.takeHit({ x: this.x, dmgMul: 1 }, { dmg: this.dmg, kb: 7, knockdown: true, launch: 7 })) g.onHit(null, t, { dmg: this.dmg, big: true });
        }
      }
      if (this.t % 2 === 0) {
        const a = Math.random() * Math.PI * 2;
        g.particles.spawn('debris', this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r * 0.38, { vy: -TT.rand(3, 7), vx: TT.rand(-1, 1), grav: 0.5, color: this.col || '#9a8f86', size: TT.rand(5, 9), life: 24, floor: this.y + Math.sin(a) * this.r * 0.38 });
      }
    }
    drawGround(ctx, camX) {
      const r = Math.min(this.r, this.maxR), k = 1 - r / this.maxR, x = this.x - camX;
      // borda vermelha da área total enquanto a onda viaja
      ctx.strokeStyle = 'rgba(255,60,60,' + (0.35 + 0.3 * ((this.t >> 2) % 2)) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, this.y, this.maxR, this.maxR * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,230,180,' + (0.3 + 0.6 * k) + ')'; ctx.lineWidth = 12 * k + 5;
      ctx.beginPath(); ctx.ellipse(x, this.y, r, r * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,80,40,' + (0.3 + 0.4 * k) + ')'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(x, this.y, Math.max(1, r - 12), Math.max(1, r - 12) * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
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
      // corvo de energia (a "alma" da Ravena) abrindo as asas sobre o grupo
      const k = this.t / 34, x = this.x - camX, y = this.y - 160 - k * 50;
      ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
      drawRavenCrow(ctx, x, y, 1, 2.2 + k * 1.6, this.t, 0, true);
      ctx.restore();
    }
    get y2() { return this.y; }
  }
  TT.RavenBlast = RavenBlast;

  // Tentáculos de sombra da Ravena (golpe novo): uma poça negra aparece embaixo de cada inimigo da tela
  // e, logo depois, tentáculos de energia negra saem do chão e arremessam todos para cima.
  class ShadowTendrils {
    constructor(game, owner) {
      Object.assign(this, { game, owner, t: 0, remove: false, hits: new Set(), ERUPT: 10, END: 48 });
      const g = game, spots = [];
      for (const e of g.enemies) if (!e.dead && Math.abs(e.x - g.camX - TT.W / 2) < TT.W / 2 + 30) spots.push({ x: e.x, y: e.y, e });
      for (let k = 0; spots.length < 4 && k < 4; k++) {
        spots.push({ x: owner.x + owner.facing * (150 + k * 150), y: TT.clamp(owner.y + (k % 2 ? 50 : -50), TT.FLOOR_TOP + 10, TT.FLOOR_BOTTOM - 4) });
      }
      this.spots = spots.slice(0, 10);
      for (const s of this.spots) s.seed = Math.random() * 10;
      this.y = Math.max(...this.spots.map((s) => s.y)) + 1;
    }
    update() {
      const g = this.game;
      this.t++;
      // até a erupção cada poça acompanha o seu inimigo
      if (this.t < this.ERUPT) for (const s of this.spots) if (s.e && !s.e.dead) { s.x = s.e.x; s.y = s.e.y; }
      if (this.t === this.ERUPT) {
        g.shake = Math.max(g.shake, 14); A().play('dark'); A().play('boom');
        for (const e of g.enemies) {
          if (e.dead || e.z > 90 || this.hits.has(e)) continue;
          if (!this.spots.some((s) => Math.pow((e.x - s.x) / 95, 2) + Math.pow((e.y - s.y) / 40, 2) <= 1)) continue;
          this.hits.add(e);
          const d = { dmg: 42, kb: 3, knockdown: true, launch: 13, big: true };
          if (e.takeHit(this.owner, d, TT.sign(e.x - this.owner.x) || 1)) g.onHit(this.owner, e, d);
        }
        for (const s of this.spots) for (let i = 0; i < 5; i++) g.particles.spawn('feather', s.x + TT.rand(-40, 40), s.y - TT.rand(20, 160), { color: '#1a0f2e', size: 10, vy: -2, life: 30, vr: 0.2 });
      }
      if (this.t > this.END) this.remove = true;
    }
    // poça negra com borda violeta (cresce até a erupção)
    drawGround(ctx, camX) {
      const k = Math.min(1, this.t / this.ERUPT), fade = this.t > this.END - 12 ? (this.END - this.t) / 12 : 1;
      ctx.save(); ctx.globalAlpha = Math.max(0, fade);
      for (const s of this.spots) {
        ctx.beginPath(); ctx.ellipse(s.x - camX, s.y, 90 * k, 36 * k, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16,6,34,0.8)'; ctx.fill();
        ctx.strokeStyle = '#a77bff'; ctx.lineWidth = 4; ctx.stroke();
      }
      ctx.restore();
    }
    // tentáculos: espinhos curvos de sombra que sobem rápido e afundam devagar
    draw(ctx, camX) {
      const t = this.t - this.ERUPT;
      if (t < 0) return;
      const up = TT.easeOut(Math.min(1, t / 5)), down = TT.clamp((t - 18) / 18, 0, 1), h = 170 * up * (1 - down);
      if (h < 2) return;
      ctx.save(); ctx.lineJoin = 'round';
      for (const s of this.spots) {
        const x = s.x - camX;
        for (let i = 0; i < 5; i++) {
          const ox = (i - 2) * 26, hh = h * (0.6 + 0.4 * Math.abs(Math.sin(s.seed + i * 1.7))), bend = Math.sin(s.seed + i + t * 0.15) * 22;
          ctx.beginPath();
          ctx.moveTo(x + ox - 12, s.y);
          ctx.quadraticCurveTo(x + ox - 8 + bend, s.y - hh * 0.5, x + ox + bend * 1.4, s.y - hh);
          ctx.quadraticCurveTo(x + ox + 8 + bend, s.y - hh * 0.5, x + ox + 12, s.y);
          ctx.closePath();
          ctx.fillStyle = '#120a22'; ctx.fill();
          ctx.strokeStyle = '#8a5cff'; ctx.lineWidth = 5; ctx.stroke();
          ctx.strokeStyle = '#f2eaff'; ctx.lineWidth = 1.6; ctx.stroke();
        }
        TT.drawGlow(ctx, DARK, x, s.y - h * 0.4, 70 + h * 0.3, 0.45);
      }
      ctx.restore();
    }
  }
  TT.ShadowTendrils = ShadowTendrils;

  // ================================================================ Efeitos dos combos (fase 8)
  // Imagem residual: cópia da pose do Titã que some aos poucos, na cor dele (rastro de velocidade).
  class Afterimage {
    constructor(game, f, col, flip) {
      this.game = game; this.remove = false; this.t = 0; this.life = 12; this.col = col;
      this.style = f.style; this.facing = flip ? -f.facing : f.facing; this.x = f.x; this.y = f.y - 0.5; this.z = f.z;
      this.pose = TT.newPose(); TT.setPose(this.pose, f.pose);
      for (const k of ['weapon', 'hands', 'handF', 'handB', 'glow', 'mouth']) this.pose[k] = f.pose[k];
      this.pose.glow = null;
    }
    update() { if (++this.t >= this.life) this.remove = true; }
    draw(ctx, camX) {
      const k = 1 - this.t / this.life, x = this.x - camX, y = this.y - this.z;
      ctx.save();
      ctx.globalAlpha = 0.42 * k;
      TT.drawRig(ctx, this.style, this.pose, x, y, this.facing, { flash: true, t: 0 });
      ctx.globalAlpha = 0.55 * k;
      TT.drawGlow(ctx, this.col, x, y - 80, 70, 1);
      ctx.restore();
    }
  }
  TT.Afterimage = Afterimage;

  // Risco de luz deixado pelo Golpe Relâmpago do Robin.
  class SlashLine {
    constructor(game, x0, x1, y, col) { Object.assign(this, { game, x0, x1, y: y + 1, col, t: 0, remove: false }); }
    update() { if (++this.t > 22) this.remove = true; }
    draw(ctx, camX) {
      const k = this.t / 22, a = 1 - k, y = this.y - 85, x0 = this.x0 - camX, x1 = this.x1 - camX;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = this.col; ctx.globalAlpha = 0.7 * a; ctx.lineWidth = 34 * (1 - k * 0.6);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y - 6); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = a; ctx.lineWidth = 8 * (1 - k * 0.5);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y - 6); ctx.stroke();
      ctx.restore();
    }
  }
  TT.SlashLine = SlashLine;

  // Explosões em sequência nos inimigos marcados (o atraso dá o "efeito samurai").
  class DelayedBursts {
    constructor(game, owner, list, o) { Object.assign(this, { game, owner, list, o, t: 0, remove: false, y: 0 }); }
    update() {
      const g = this.game, o = this.o;
      this.t++;
      this.list.forEach((e, i) => {
        if (this.t !== 4 + i * 4 || e.dead) return;
        const d = { dmg: o.dmg, kb: 6, knockdown: true, launch: 9, big: true };
        const hy = e.y - e.z - (e.height || 100) * 0.55;
        if (e.takeHit(this.owner, d, this.owner.facing)) g.onHit(this.owner, e, d);
        g.explosion(e.x, e.y, (e.height || 100) * 0.55, 0.9, o.col);
        g.particles.spawn('text', e.x, hy - 70, { text: o.word, size: 40, color: '#ffe14a', color2: o.col, vy: -0.6, life: 28, rot: TT.rand(-0.2, 0.2) });
        if (o.emblem) g.particles.spawn('text', e.x, hy, { text: o.emblem, size: 70, color: o.col, vy: -0.3, life: 22 });
        A().play('hitHeavy');
      });
      if (this.t > 8 + this.list.length * 4) this.remove = true;
    }
  }
  TT.DelayedBursts = DelayedBursts;

  // Onda de energia que se expande e acerta uma vez cada inimigo que alcança (Supernova, Booyah, rugido).
  class Nova {
    constructor(game, owner, o) {
      Object.assign(this, { game, owner, o, t: 0, remove: false, hits: new Set(), x: o.x, y: o.y + 1, T: 16 });
      game.shake = Math.max(game.shake, 16);
      game.particles.spawn('text', o.x, o.y - 230, { text: o.word, size: 56, color: '#ffe14a', color2: o.col, vy: -0.5, life: 38, rot: TT.rand(-0.1, 0.1) });
      for (let i = 0; i < 24; i++) {
        const ang = i / 24 * Math.PI * 2, sp = TT.rand(8, 14);
        game.particles.spawn('star', o.x, o.y - 90, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.6, color: TT.choice([o.col, '#ffffff']), size: TT.rand(8, 13), life: TT.randi(16, 26), rot: Math.random(), vr: 0.2 });
      }
    }
    get r() { return this.o.r * TT.easeOut(Math.min(1, this.t / this.T)); }
    update() {
      const g = this.game, R = this.r;
      this.t++;
      for (const e of g.enemies) {
        if (e.dead || this.hits.has(e)) continue;
        if (Math.hypot(e.x - this.x, (e.y - this.y) / 0.42) > R + 20) continue;
        this.hits.add(e);
        const d = { dmg: this.o.dmg, kb: 8, knockdown: true, launch: 11, big: true };
        if (e.takeHit(this.owner, d, TT.sign(e.x - this.x) || this.owner.facing)) g.onHit(this.owner, e, d);
      }
      if (this.t > this.T + 14) this.remove = true;
    }
    drawGround(ctx, camX) {
      const R = this.r, k = this.t / (this.T + 14), x = this.x - camX;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = this.o.col;
      ctx.beginPath(); ctx.ellipse(x, this.y, R, R * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(x, this.y, R, R * 0.42, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    draw(ctx, camX) {
      const R = this.r, k = this.t / (this.T + 14), x = this.x - camX, y = this.y - 90;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.85 * (1 - k); ctx.strokeStyle = this.o.col; ctx.lineWidth = 26 * (1 - k) + 4;
      ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.ellipse(x, y, R * 0.92, R * 0.58, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      TT.drawGlow(ctx, this.o.col, x, y, 120 + R * 0.4, 0.7 * (1 - k));
    }
  }
  TT.Nova = Nova;

  // Mãos de sombra da Ravena saindo do chão (o dano vem do golpe; isto é o visual).
  class ShadowHands {
    constructor(game, x, y, facing) { Object.assign(this, { game, x, y: y + 1, facing, t: 0, remove: false }); }
    update() { if (++this.t > 26) this.remove = true; }
    drawGround(ctx, camX) {
      const k = Math.min(1, this.t / 4) * (1 - TT.clamp((this.t - 18) / 8, 0, 1));
      ctx.save(); ctx.fillStyle = 'rgba(16,6,34,0.8)'; ctx.strokeStyle = '#a77bff'; ctx.lineWidth = 3; ctx.globalAlpha = k;
      ctx.beginPath(); ctx.ellipse(this.x - camX, this.y, 90, 30, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    draw(ctx, camX) {
      const up = TT.easeOut(Math.min(1, this.t / 6)), down = TT.clamp((this.t - 16) / 10, 0, 1), h = 150 * up * (1 - down);
      if (h < 3) return;
      ctx.save(); ctx.lineJoin = 'round';
      for (const [ox, sc] of [[-34, 0.85], [30, 1]]) {
        const x = this.x - camX + ox, top = this.y - h * sc, grab = Math.sin(this.t * 0.5) * 0.2;
        ctx.beginPath(); ctx.moveTo(x - 14, this.y); ctx.quadraticCurveTo(x - 18, this.y - h * 0.5 * sc, x - 10, top + 20);
        // dedos abertos em garra
        for (let i = 0; i < 4; i++) { const ang = -Math.PI / 2 + (i - 1.5) * (0.42 + grab); ctx.lineTo(x + Math.cos(ang) * 34, top + Math.sin(ang) * 34); ctx.lineTo(x + Math.cos(ang + 0.2) * 12, top + Math.sin(ang + 0.2) * 12 + 6); }
        ctx.lineTo(x + 10, top + 20); ctx.quadraticCurveTo(x + 18, this.y - h * 0.5 * sc, x + 14, this.y); ctx.closePath();
        ctx.fillStyle = '#120a22'; ctx.fill(); ctx.strokeStyle = '#8a5cff'; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = '#f2eaff'; ctx.lineWidth = 1.6; ctx.stroke();
      }
      ctx.restore();
      TT.drawGlow(ctx, DARK, this.x - camX, this.y - h * 0.6, 80, 0.4);
    }
  }
  TT.ShadowHands = ShadowHands;

  // Esferas de Azarath: prende os inimigos à frente em esferas de energia negra, ergue e esmaga.
  class DarkOrbs {
    constructor(game, owner, o) {
      Object.assign(this, { game, owner, o, t: 0, remove: false, y: owner.y + 1, CRUSH: 34 });
      const g = game;
      this.caught = g.enemies.filter((e) => !e.dead && (e.x - owner.x) * owner.facing > -40 && Math.abs(e.x - owner.x) < o.range && Math.abs(e.y - owner.y) < 140).slice(0, 8);
      for (const e of this.caught) {
        const d = { dmg: 6, kb: 0, stun: this.CRUSH + 10 };
        if (e.takeHit(owner, d, owner.facing)) g.onHit(owner, e, d);
      }
      A().play('dark');
    }
    update() {
      const g = this.game;
      this.t++;
      for (const e of this.caught) {
        if (e.dead || this.t >= this.CRUSH) continue;
        if (!e.isBoss) { e.z = Math.min(110, e.z + 5); e.vz = 0; e.vx = 0; } // erguido pela telecinese
        if (this.t % 3 === 0) g.particles.spawn('glow', e.x + TT.rand(-30, 30), e.y - e.z - TT.rand(20, 120), { color: DARK, size: 30, life: 10 });
      }
      if (this.t === this.CRUSH) {
        g.shake = Math.max(g.shake, 16); A().play('boom');
        for (const e of this.caught) {
          if (e.dead) continue;
          const d = { dmg: this.o.dmg, kb: 4, knockdown: true, launch: 4, big: true }, cy = e.y - e.z - (e.height || 100) * 0.5;
          if (!e.isBoss) e.vz = -6;
          if (e.takeHit(this.owner, d, this.owner.facing)) g.onHit(this.owner, e, d);
          for (let i = 0; i < 12; i++) { const ang = Math.random() * Math.PI * 2, sp = TT.rand(5, 12); g.particles.spawn('debris', e.x, cy, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 3, grav: 0.4, color: TT.choice(['#8a5cff', '#1a0f2e', '#d6c2ff']), size: TT.rand(6, 11), life: 26, floor: e.y }); }
          g.particles.spawn('ring', e.x, cy, { color: '#d6c2ff', size: 120, life: 14 });
          g.particles.spawn('text', e.x, cy - 80, { text: 'KRRSH!', size: 38, color: '#e8dcff', color2: '#5a2a9a', vy: -0.6, life: 26, rot: TT.rand(-0.2, 0.2) });
        }
      }
      if (this.t > this.CRUSH + 6) this.remove = true;
    }
    draw(ctx, camX) {
      if (this.t >= this.CRUSH) return;
      const k = Math.min(1, this.t / 6), squeeze = this.t > this.CRUSH - 8 ? 1 - (this.t - (this.CRUSH - 8)) / 16 : 1;
      for (const e of this.caught) {
        if (e.dead) continue;
        const h = Math.min(e.height || 100, 240), x = e.x - camX, y = e.y - e.z - h * 0.5, R = (h * 0.62 + 20) * k * squeeze;
        ctx.save();
        ctx.globalAlpha = 0.35; ctx.fillStyle = '#2a1050';
        ctx.beginPath(); ctx.ellipse(x, y, R, R * 1.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.95; ctx.strokeStyle = '#8a5cff'; ctx.lineWidth = 6; ctx.stroke();
        ctx.strokeStyle = '#f2eaff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, R * 0.9, R * 0.95, this.t * 0.1, 0.3, 2.2); ctx.stroke();
        ctx.restore();
        TT.drawGlow(ctx, DARK, x, y, R * 1.6, 0.5);
      }
    }
  }
  TT.DarkOrbs = DarkOrbs;

  // Corvo de energia negra: corpo, asas com penas, contorno violeta + branco e olhos brilhantes.
  // front = true desenha de frente (asas abertas); senão, de perfil voando.
  function drawRavenCrow(ctx, x, y, facing, s, t, alpha, front) {
    TT.drawGlow(ctx, DARK, x, y, 46 * s, 0.6);
    ctx.save(); ctx.translate(x, y); ctx.scale(facing * s, s);
    ctx.lineJoin = 'round';
    const flap = Math.sin(t * 0.45);
    ctx.beginPath();
    if (front) {
      const w = 6 * flap;
      ctx.moveTo(0, -18);
      // asa esquerda com 4 penas
      ctx.lineTo(-14, -20); ctx.lineTo(-40, -34 - w); ctx.lineTo(-62, -30 - w); ctx.lineTo(-52, -20 - w * 0.5); ctx.lineTo(-70, -14 - w * 0.5);
      ctx.lineTo(-56, -6); ctx.lineTo(-68, 4); ctx.lineTo(-48, 2); ctx.lineTo(-54, 14); ctx.lineTo(-30, 4); ctx.lineTo(-12, 8);
      ctx.lineTo(-8, 22); ctx.lineTo(-3, 16); ctx.lineTo(0, 28); ctx.lineTo(3, 16); ctx.lineTo(8, 22); ctx.lineTo(12, 8);
      ctx.lineTo(30, 4); ctx.lineTo(54, 14); ctx.lineTo(48, 2); ctx.lineTo(68, 4); ctx.lineTo(56, -6);
      ctx.lineTo(70, -14 - w * 0.5); ctx.lineTo(52, -20 - w * 0.5); ctx.lineTo(62, -30 - w); ctx.lineTo(40, -34 - w); ctx.lineTo(14, -20);
      ctx.closePath();
    } else {
      const f = flap * 12;
      ctx.moveTo(30, 0); ctx.lineTo(18, -4); ctx.lineTo(8, -10);
      ctx.lineTo(-6, -32 - f); ctx.lineTo(-10, -22 - f * 0.7); ctx.lineTo(-20, -34 - f); ctx.lineTo(-18, -18 - f * 0.4); ctx.lineTo(-30, -26 - f * 0.6); ctx.lineTo(-16, -6);
      ctx.lineTo(-38, -8); ctx.lineTo(-30, -2); ctx.lineTo(-40, 4); ctx.lineTo(-14, 4);
      ctx.lineTo(-18, 22 + f * 0.6); ctx.lineTo(-6, 10); ctx.lineTo(4, 8); ctx.lineTo(16, 5);
      ctx.closePath();
    }
    ctx.fillStyle = '#100822'; ctx.fill();
    ctx.strokeStyle = '#8a5cff'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#f2eaff'; ctx.lineWidth = 2; ctx.stroke();
    // olhos brilhantes
    const eyes = front ? [[-6, -12], [6, -12]] : [[16, -2]];
    for (const [ex, ey] of eyes) {
      TT.drawGlow(ctx, '#ffffff', ex, ey, 8, 0.9);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(ex, ey, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

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
      for (const p of g.heroes()) {
        if (this.remove || !(this.t > 15 && Math.abs(p.x - this.x) < 44 && Math.abs(p.y - this.y) < 26 && p.z < 30)) continue;
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
