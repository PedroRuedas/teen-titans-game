'use strict';
// História das fases: cenas em estilo HQ (diálogo com retratos, o jogo para), o rádio dos Titãs
// (falas durante a luta, sem parar o jogo) e o final da fase 11, em que os amigos dão força à Ravena.
(function () {
  const TT = window.TT, W = TT.W, H = TT.H, OUT = TT.OUT;
  const A = () => TT.audio;
  // Testes automatizados desligam as cenas (window.TT_NOSTORY) para irem direto à ação.
  TT.storyOn = () => !window.TT_NOSTORY;

  const speaker = (key) => {
    if (!key) return { name: '', color: '#ffe14a' };
    const d = TT.TITANS[key];
    return { name: (d ? d.name : key).toUpperCase(), color: d ? d.color : '#ffffff' };
  };
  function wrap(ctx, text, maxW, size) {
    ctx.font = size + 'px ' + TT.FONT;
    const out = []; let line = '';
    for (const w of text.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  // ---------------------------------------------------------------- Cena de diálogo (o jogo para)
  // lines: [{ key, text }] (key = personagem que fala; sem key = narrador). ATAQUE / ENTER avança
  // (ou mostra a fala inteira), Esc pula a cena; cada fala também passa sozinha depois de um tempo.
  class Story {
    constructor(game, lines, onDone) {
      Object.assign(this, { game, lines, onDone, i: 0, t: 0, age: 0, done: false });
      A().play('select');
    }
    get line() { return this.lines[this.i]; }
    get shown() { return Math.min(this.line.text.length, Math.floor(this.t * 1.3)); }
    update(inp) {
      this.t++; this.age++;
      if (this.age > 12 && (inp.wasPressed('pause') || inp.wasPressed('start'))) { this.finish(); return; }
      const adv = this.age > 12 && (inp.wasPressed('light') || inp.wasPressed('menu') || inp.wasPressed('jump'));
      const full = this.line.text.length;
      if (adv) { if (this.shown < full) this.t = 9999; else this.next(); }
      else if (this.t > full / 1.3 + 200) this.next(); // passa sozinha
    }
    next() {
      this.i++; this.t = 0;
      if (this.i >= this.lines.length) this.finish(); else A().play('select');
    }
    finish() {
      if (this.done) return;
      this.done = true;
      if (this.game.story === this) this.game.story = null;
      if (this.onDone) this.onDone();
    }
    draw(ctx) {
      const L = this.line; if (!L) return;
      const g = this.game, f = g.frame, sp = speaker(L.key), left = this.i % 2 === 0, k = Math.min(1, this.age / 14);
      ctx.save();
      ctx.fillStyle = 'rgba(5,0,15,' + 0.45 * k + ')'; ctx.fillRect(0, 0, W, H);
      // faixas de cinema
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 64 * k); ctx.fillRect(0, H - 220 * k, W, 220 * k);
      ctx.globalAlpha = k;
      const py = H - 205;
      // quadro da fala (estilo HQ)
      ctx.fillStyle = '#fff8e6'; ctx.strokeStyle = OUT; ctx.lineWidth = 5;
      const bx = !L.key ? 110 : left ? 230 : 60, bw = !L.key ? W - 220 : W - 290;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, py, bw, 160, 18); else ctx.rect(bx, py, bw, 160); ctx.fill(); ctx.stroke();
      if (L.key) { // retrato grande que "fala"
        const cx = left ? 120 : W - 120, cy = py + 72, talking = this.shown < L.text.length, s = 1 + (talking ? Math.abs(Math.sin(f * 0.35)) * 0.04 : 0);
        ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
        ctx.beginPath(); ctx.arc(0, 0, 86, 0, Math.PI * 2); ctx.fillStyle = sp.color; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke();
        ctx.clip(); ctx.drawImage(TT.portrait(L.key, 180), -90, -92, 180, 180);
        ctx.restore();
        ctx.font = '30px ' + TT.FONT;
        const nw = ctx.measureText(sp.name).width + 40, nx = left ? bx + 24 : bx + bw - 24 - nw;
        ctx.fillStyle = sp.color; ctx.fillRect(nx, py - 22, nw, 42); ctx.lineWidth = 4; ctx.strokeRect(nx, py - 22, nw, 42);
        TT.drawText(ctx, sp.name, nx + nw / 2, py, 28, '#ffffff', OUT, 'center', 5);
      }
      const lines = wrap(ctx, L.text.slice(0, this.shown), bw - 70, 28);
      lines.forEach((ln, i) => TT.drawText(ctx, ln, bx + 34, py + 50 + i * 36, 28, L.key ? '#1c1424' : '#5a1a3a', null, 'left', 0));
      if (this.shown >= L.text.length && (f >> 4) % 2 === 0) TT.drawText(ctx, '▶', bx + bw - 30, py + 136, 26, '#d7263e', OUT, 'center', 4);
      const touch = g.touch && g.touch.visible;
      TT.drawText(ctx, touch ? 'ATAQUE avança  •  II pula a cena' : 'ATAQUE / ENTER avança  •  Esc pula a cena', W / 2, H - 22, 17, '#bfc4e8', OUT, 'center', 4);
      ctx.restore();
    }
  }
  TT.Story = Story;

  // ---------------------------------------------------------------- Rádio dos Titãs (o jogo continua)
  class Comms {
    constructor(game) { Object.assign(this, { game, queue: [], cur: null, t: 0, said: new Set() }); }
    // id opcional: a mesma fala não se repete
    say(lines, id) {
      if (id) { if (this.said.has(id)) return; this.said.add(id); }
      for (const l of lines) this.queue.push(l);
    }
    update() {
      if (!this.cur) { if (!this.queue.length) return; this.cur = this.queue.shift(); this.t = 0; A().play('switch'); }
      if (++this.t > this.cur.text.length / 1.4 + 150) this.cur = null;
    }
    draw(ctx) {
      const c = this.cur; if (!c) return;
      const sp = speaker(c.key), k = Math.min(1, this.t / 10, (this.cur.text.length / 1.4 + 150 - this.t) / 12), w = 700, x = W / 2 - w / 2, y = H - 104;
      ctx.save(); ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = 'rgba(10,6,28,0.88)'; ctx.strokeStyle = sp.color; ctx.lineWidth = 3;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, 84, 14); else ctx.rect(x, y, w, 84); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.arc(x + 46, y + 42, 32, 0, Math.PI * 2); ctx.fillStyle = sp.color; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke(); ctx.clip();
      ctx.drawImage(TT.portrait(c.key, 70), x + 11, y + 6, 70, 70); ctx.restore();
      // ondinhas de rádio
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = sp.color; ctx.globalAlpha = Math.max(0, k) * (0.4 + 0.6 * ((this.game.frame >> 3) % 3 === i)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 84, y + 20, 6 + i * 5, -0.8, 0.8); ctx.stroke(); }
      ctx.globalAlpha = Math.max(0, k);
      TT.drawText(ctx, 'RÁDIO • ' + sp.name, x + 98, y + 18, 15, sp.color, OUT, 'left', 3);
      const shown = c.text.slice(0, Math.floor(this.t * 1.4));
      wrap(ctx, shown, w - 120, 20).slice(0, 2).forEach((ln, i) => TT.drawText(ctx, ln, x + 98, y + 44 + i * 24, 20, '#ffffff', OUT, 'left', 4));
      ctx.restore();
    }
  }
  TT.Comms = Comms;

  // ---------------------------------------------------------------- Final da fase 11: a luz da Ravena
  // Trigon quase vencido: a luta para, a Ravena pede ajuda e o jogador aperta ATAQUE para dar a força
  // dos amigos a ela. Cada Titã acende e torce; com a barra cheia a Ravena Branca vence o pai com a luz.
  const CHEER = [
    { key: 'robin', text: 'Você é uma de nós, Ravena!' },
    { key: 'starfire', text: 'Nós acreditamos em você, amiga!' },
    { key: 'cyborg', text: 'Manda ver, Rae! BOOYAH!' },
    { key: 'beastboy', text: 'A gente tá com você! Sempre!' },
  ];
  class LightFinale {
    constructor(game, boss) {
      Object.assign(this, { game, boss, t: 0, phase: 'dark', power: 0, lit: 0, done: false, presses: 0 });
      this.raven = new TT.Titan(game, TT.TITANS.whiteraven ? 'whiteraven' : 'raven');
      this.raven.anim = 'jump';
      A().stopSong(); A().play('dark');
    }
    update(inp) {
      const g = this.game; this.t++;
      g.particles.update();
      this.raven.animT++;
      if (this.phase === 'dark') { if (this.t >= 150) { this.phase = 'mash'; this.t = 0; A().playSong('victory'); } return; }
      if (this.phase === 'mash') {
        let n = 0; for (const a of ['light', 'heavy', 'special', 'jump', 'menu']) if (inp.wasPressed(a)) n++;
        this.presses += n;
        this.power = Math.min(100, this.power + n * 4 + 0.16);
        if (n) for (let i = 0; i < 3; i++) g.particles.spawn('star', W / 2 + TT.rand(-260, 260), H - 150, { vx: TT.rand(-1, 1), vy: -TT.rand(4, 8), color: '#ffffff', size: 9, life: 30, rot: Math.random() });
        while (this.lit < Math.min(4, Math.floor(this.power / 24))) { this.lit++; A().play('switch'); g.shake = Math.max(g.shake, 6); }
        if (this.power >= 100) { this.phase = 'light'; this.t = 0; A().play('super'); A().voice('raven', 'Azarath Metrion Zinthos!'); }
        return;
      }
      if (this.t === 50) { g.whiteFlash = 14; A().play('boom'); g.shake = 30; }
      if (this.t >= 120) this.finish();
    }
    finish() {
      if (this.done) return;
      this.done = true;
      const g = this.game, b = this.boss;
      g.finale = null;
      b.hp = 0; b.die(1, { dmg: 999 });
    }
    draw(ctx) {
      const g = this.game, f = g.frame, t = this.t, ph = this.phase;
      const dark = ph === 'dark' ? Math.min(0.75, t / 60) : ph === 'mash' ? 0.75 - 0.35 * (this.power / 100) : Math.max(0, 0.4 - t / 60);
      ctx.save();
      ctx.fillStyle = 'rgba(10,0,8,' + dark + ')'; ctx.fillRect(0, 0, W, H);
      const rx = W / 2, ry = 250;
      const glow = ph === 'dark' ? Math.min(1, t / 150) * 0.4 : ph === 'mash' ? 0.4 + 0.6 * this.power / 100 : 1;
      // a Ravena Branca no céu, cada vez mais brilhante
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 12; i++) { // raios de luz
        const an = f * 0.004 + i * Math.PI / 6, L = 260 + 520 * glow;
        ctx.globalAlpha = 0.08 * glow; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(an - 0.06) * L, ry + Math.sin(an - 0.06) * L); ctx.lineTo(rx + Math.cos(an + 0.06) * L, ry + Math.sin(an + 0.06) * L); ctx.fill();
      }
      ctx.restore();
      TT.drawGlow(ctx, '#ffffff', rx, ry, 120 + 160 * glow, 0.5 + 0.5 * glow);
      TT.drawGlow(ctx, '#b89aff', rx, ry, 90 + 60 * glow, 0.5 * glow);
      ctx.globalAlpha = Math.min(1, 0.25 + glow);
      const r = this.raven; TT.computePose(r, r.pose); r.pose.armF = [2.6, 2.9]; r.pose.armB = [2.4, 2.8]; r.pose.cape = 1;
      TT.drawRig(ctx, r.style, r.pose, rx, ry + 130 + Math.sin(f * 0.05) * 6, 1, { t: r.animT, scale: 1.8 });
      ctx.globalAlpha = 1;
      if (ph === 'dark') {
        if (t > 20) TT.drawText(ctx, 'Trigon está quase vencido... mas ninguém vence ele sozinho.', W / 2, 90, 30, '#ffd0a0', OUT, 'center', 6);
        if (t > 70) TT.drawText(ctx, 'RAVENA: "Amigos... eu preciso de vocês."', W / 2, 136, 28, '#e6deff', OUT, 'center', 6);
      } else if (ph === 'mash') {
        const touch = g.touch && g.touch.visible;
        if ((f >> 4) % 2 === 0) TT.drawText(ctx, (touch ? 'APERTE ATAQUE' : 'APERTE ATAQUE (J) VÁRIAS VEZES') + ' PARA DAR SUA FORÇA À RAVENA!', W / 2, 74, 28, '#ffffff', OUT, 'center', 6);
        // barra de luz
        const bw = 640, bx = W / 2 - bw / 2, by = 106;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by, bw, 24);
        const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#9a7aff'); gr.addColorStop(1, '#ffffff');
        ctx.fillStyle = gr; ctx.fillRect(bx, by, bw * this.power / 100, 24);
        ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, 24);
        TT.drawText(ctx, 'LUZ DE AZARATH ' + Math.floor(this.power) + '%', W / 2, by + 13, 16, '#1c1424', null, 'center', 0);
      } else {
        const s = Math.min(1, t / 20);
        ctx.save(); ctx.translate(W / 2, 110); ctx.scale(0.6 + 0.4 * s, 0.6 + 0.4 * s);
        TT.drawText(ctx, 'AZARATH METRION ZINTHOS!', 0, 0, 62, '#ffffff', '#5a3aa0', 'center', 10);
        ctx.restore();
        if (t > 40) { // a luz atinge Trigon
          const b = this.boss, bx = b.x - g.camX, byy = b.y - 260;
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(200,180,255,0.8)'; ctx.lineWidth = 90; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(bx, byy); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 30; ctx.stroke();
          ctx.restore();
          TT.drawGlow(ctx, '#ffffff', bx, byy, 300, 1);
        }
      }
      // os quatro amigos torcendo (acendem conforme a barra enche)
      if (ph !== 'dark') CHEER.forEach((c, i) => {
        const cx = W / 2 + (i - 1.5) * 260, cy = H - 120, on = i < this.lit || ph === 'light', d = TT.TITANS[c.key];
        ctx.save(); ctx.globalAlpha = on ? 1 : 0.35;
        if (on) TT.drawGlow(ctx, d.color, cx, cy, 90, 0.6);
        ctx.beginPath(); ctx.arc(cx, cy, 52, 0, Math.PI * 2); ctx.fillStyle = on ? d.color : '#2a2440'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = on ? '#ffffff' : OUT; ctx.stroke();
        ctx.clip(); ctx.drawImage(TT.portrait(c.key, 110), cx - 55, cy - 56, 110, 110);
        ctx.restore();
        if (on && ph === 'mash') {
          ctx.font = '19px ' + TT.FONT;
          const tw = Math.min(250, ctx.measureText(c.text).width + 24);
          ctx.fillStyle = '#fff8e6'; ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.fillRect(cx - tw / 2, cy - 104, tw, 34); ctx.strokeRect(cx - tw / 2, cy - 104, tw, 34);
          TT.drawText(ctx, c.text, cx, cy - 87, Math.min(19, 19 * 226 / Math.max(1, ctx.measureText(c.text).width)), '#1c1424', null, 'center', 0);
        }
      });
      ctx.restore();
    }
  }
  TT.LightFinale = LightFinale;
})();
