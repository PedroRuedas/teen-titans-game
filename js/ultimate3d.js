'use strict';
// "Titãs, AVANTE!" em 3D: depois das faixas com os retratos (2D), a cena vai para uma arena própria no meio
// do céu de Jump City. Cada Titã entra no seu plano de câmera (na ordem da cutscene: quem chamou começa):
//   Robin     — corrida em câmera baixa, golpe de bastão e três birdarangues girando;
//   Estelar   — voa por cima e despeja starbolts verdes, câmera de baixo para cima;
//   Ciborgue  — câmera por cima do ombro, o braço vira canhão e o feixe sônico atravessa o alvo;
//   Mutano    — vira T-Rex e atropela o alvo, câmera rasante na frente;
//   Ravena    — sobe envolta em energia e um CORVO DA ALMA gigante mergulha sobre o alvo.
// No final os cinco cercam o alvo no ar, a câmera gira em volta, os cinco feixes se juntam, a esfera de
// energia explode e a onda de choque varre a arena. O dano de verdade é o mesmo de sempre (resolveSuper).
// Usa o motor do modo 3D (js/world3d.js) num World3D separado, com palco próprio. Sem WebGL: cena 2D.
(function () {
  const TT = window.TT;
  const W = TT.W, H = TT.H, A = () => TT.audio;
  const YMID = (TT.FLOOR_TOP + TT.FLOOR_BOTTOM) / 2, KD = 2.4;
  const yOf = (z) => YMID + z / KD; // profundidade 3D -> "y" do jogo
  const COL = { robin: '#ffd23a', starfire: '#5dff8a', cyborg: '#5fc2ff', beastboy: '#8dff5a', raven: '#b98cff' };
  const SHOT = 66, FIN = 130; // quadros (de roteiro) de cada Titã e do final
  const RATE = 1.36;           // a cena roda 1,36 quadro de roteiro por quadro do jogo (cena curta e ágil)
  const WORDS = ['POW!', 'BAM!', 'WHAM!', 'KAPOW!', 'CRASH!', 'THWACK!', 'BOOM!'];
  const lerp = (a, b, k) => a + (b - a) * k, sm = (k) => k * k * (3 - 2 * k), cl = (v, a, b) => Math.max(a, Math.min(b, v));

  // ------------------------------------------------------------ Palco: arena flutuante no céu do fim de tarde
  function buildArena(w) {
    const T = window.THREE, S = w.scene;
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#0a0620'); gr.addColorStop(0.35, '#2a1660'); gr.addColorStop(0.5, '#7a2f8a'); gr.addColorStop(0.56, '#ff7a6a'); gr.addColorStop(0.62, '#ffc27a'); gr.addColorStop(1, '#1a0f30');
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
    const r = TT.seeded(2026);
    for (let i = 0; i < 320; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.7) + ')'; const s = r() < 0.1 ? 3 : 1.6; g.fillRect(r() * 1024, r() * 230, s, s); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,' + (140 + r() * 80 | 0) + ',170,' + (0.15 + r() * 0.25) + ')'; g.fillRect(r() * 1024, 250 + r() * 50, 80 + r() * 200, 3 + r() * 6); }
    // silhueta da cidade lá embaixo e a Torre Titã
    g.fillStyle = '#1a1036';
    for (let x = 0; x < 1024; x += 14 + r() * 20) { const h = 20 + r() * 60; g.fillRect(x, 318 - h, 12 + r() * 14, h + 200); }
    g.fillRect(500, 220, 24, 100); g.fillRect(470, 214, 84, 22);
    for (let i = 0; i < 260; i++) { g.fillStyle = r() < 0.6 ? '#ffe2a0' : '#9ae8ff'; g.fillRect(r() * 1024, 270 + r() * 50, 2, 2); }
    const sky = new T.Mesh(new T.SphereGeometry(20000, 40, 20), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), side: T.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10; S.add(sky); w.sky = sky;
    S.fog = new T.Fog(0x3a1f5e, 3000, 12000);
    // plataforma: disco com o "T" dourado no meio e anéis de neon
    const fc = document.createElement('canvas'); fc.width = fc.height = 1024;
    const fg = fc.getContext('2d');
    const rg = fg.createRadialGradient(512, 512, 40, 512, 512, 512); rg.addColorStop(0, '#4a3a78'); rg.addColorStop(0.7, '#2c2050'); rg.addColorStop(1, '#170f30');
    fg.fillStyle = rg; fg.fillRect(0, 0, 1024, 1024);
    fg.strokeStyle = 'rgba(140,110,220,0.35)'; fg.lineWidth = 3;
    for (let k = 1; k < 9; k++) { fg.beginPath(); fg.arc(512, 512, k * 58, 0, Math.PI * 2); fg.stroke(); }
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; fg.beginPath(); fg.moveTo(512 + Math.cos(a) * 120, 512 + Math.sin(a) * 120); fg.lineTo(512 + Math.cos(a) * 500, 512 + Math.sin(a) * 500); fg.stroke(); }
    fg.fillStyle = '#f2c230'; fg.strokeStyle = '#140a22'; fg.lineWidth = 10;
    fg.beginPath(); fg.rect(392, 360, 240, 64); fg.rect(476, 420, 72, 250); fg.fill(); fg.stroke();
    const ft = new T.CanvasTexture(fc); ft.anisotropy = 8;
    const disk = new T.Mesh(new T.CylinderGeometry(1100, 1180, 60, 64), [new T.MeshToonMaterial({ color: 0x2a1e48, gradientMap: w.grad }), new T.MeshToonMaterial({ map: ft, gradientMap: w.grad }), new T.MeshToonMaterial({ color: 0x140c28, gradientMap: w.grad })]);
    disk.position.y = -30; disk.receiveShadow = true; S.add(disk);
    w.rings = [];
    for (const [R, col] of [[1110, 0x5ff2ff], [1150, 0xff5fd2]]) { const ring = new T.Mesh(new T.TorusGeometry(R, 5, 8, 120), new T.MeshBasicMaterial({ color: col })); ring.rotation.x = Math.PI / 2; ring.position.y = -2; S.add(ring); w.rings.push(ring); }
    // pilares com cristais girando em volta
    w.crystals = [];
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2, x = Math.cos(a) * 1250, z = Math.sin(a) * 1250;
      const p = new T.Mesh(new T.CylinderGeometry(34, 46, 260, 8), new T.MeshToonMaterial({ color: 0x3a2a60, gradientMap: w.grad })); p.position.set(x, 100, z); p.castShadow = true; S.add(p);
      const cr = new T.Mesh(new T.OctahedronGeometry(46), w.gem(k % 2 ? '#ff9ae8' : '#9af5ff', { emissive: k % 2 ? 0x601040 : 0x104060 })); cr.position.set(x, 300, z); S.add(cr); w.crystals.push(cr);
      const gl = w.glowSprite(k % 2 ? '#ff5fd2' : '#5ff2ff', 220, 0.5); gl.position.copy(cr.position); S.add(gl);
    }
    // efeitos: feixes, esfera, onda de choque, birdarangues, starbolts, faíscas
    const add = { transparent: true, blending: T.AdditiveBlending, depthWrite: false };
    w.beams = Object.keys(COL).map((k) => { const m = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 12, 1, true), new T.MeshBasicMaterial(Object.assign({ color: COL[k], side: T.DoubleSide }, add))); m.visible = false; S.add(m); const core = new T.Mesh(m.geometry, new T.MeshBasicMaterial(Object.assign({ color: 0xffffff, side: T.DoubleSide }, add))); m.add(core); core.scale.set(0.4, 1, 0.4); return m; });
    w.orb = new T.Mesh(new T.SphereGeometry(1, 32, 20), new T.MeshBasicMaterial(Object.assign({ color: 0xffffff, opacity: 0.9 }, add))); w.orb.visible = false; S.add(w.orb);
    w.orbGlow = w.glowSprite('#fff0b0', 1, 0); S.add(w.orbGlow);
    w.wave = new T.Mesh(new T.TorusGeometry(1, 0.06, 8, 80), new T.MeshBasicMaterial(Object.assign({ color: 0xffe14a, opacity: 0.9 }, add))); w.wave.rotation.x = Math.PI / 2; w.wave.visible = false; S.add(w.wave);
    w.dome = new T.Mesh(new T.SphereGeometry(1, 28, 16), new T.MeshBasicMaterial(Object.assign({ color: 0x7a40ff, opacity: 0.35 }, add))); w.dome.visible = false; S.add(w.dome);
    w.rangs = [0, 1, 2].map(() => { const m = new T.Mesh(new T.TorusGeometry(10, 3.2, 6, 3), w.toon('#ffd23a')); m.visible = false; m.castShadow = true; S.add(m); return m; });
    w.bolts = Array.from({ length: 10 }, () => { const s = w.glowSprite('#5dff8a', 70, 0.95); s.visible = false; const core = new T.Mesh(w.sph(9, 10, 8), w.neon('#d9ffe4')); s.add(core); core.scale.setScalar(1 / 70); S.add(s); return s; });
    w.sparks = Array.from({ length: 70 }, () => { const s = w.glowSprite('#ffffff', 26, 0); s.visible = false; S.add(s); return { s, vx: 0, vy: 0, vz: 0, life: 0 }; });
    w.fallback = null;
  }

  class Ultimate3D {
    constructor(game) {
      this.game = game;
      this.w = new TT.World3D(game, { hero: buildArena });
      this.w.prepare();
    }
    get ready() { return this.w.ready && !this.w.failed && !!this.w.rings; }

    // ------------------------------------------------------------ Início (chamado pela cutscene)
    begin(cut) {
      const w = this.w;
      this.cut = cut; this.t = 0; this.rt = 0; this.done = false; this.resolved = false; this.gone = false;
      this.actors = cut.queue.map((s) => s.a);
      this.order = cut.queue.map((s) => s.key);
      this.target = cut.target;
      this.th = cut.tH || 120; this.tz = 0; this.tvz = 0; this.thurt = 0; this.tdx = 0;
      this.words = []; this.shake = 0; this.white = 0;
      this.total = this.order.length * SHOT + FIN;
      for (const M of w.models.values()) w.scene.remove(M.root);
      w.models.clear();
      for (const a of this.actors) { a.x = -9999; a.atk = null; a.state = 'idle'; a.anim = 'idle'; a.z = 0; a.vx = 0; a.vz = 0; a.invul = 0; a.flash = 0; }
      for (const b of w.beams) b.visible = false;
      for (const r of w.rangs) r.visible = false;
      for (const b of w.bolts) b.visible = false;
      w.orb.visible = false; w.wave.visible = false; w.dome.visible = false; w.orbGlow.material.opacity = 0;
      this.soul = null; this.cv = null;
      A().play('whoosh');
    }
    // alvo fica em (0, altura, 0)
    tPos() { return [this.tdx, this.tz + this.th * 0.5, 0]; }
    hit(power, col, word) {
      this.thurt = 8; this.tdx = Math.min(60, this.tdx + power * 2);
      this.tvz = Math.max(this.tvz, power * 1.15 + (this.tz > 60 ? 0 : 3));
      this.shake = Math.max(this.shake, power * 1.2);
      const [x, y, z] = this.tPos();
      this.burst(x, y, z, col, power > 6 ? 14 : 8, power > 6 ? 9 : 6);
      if (word && this.t - (this.lastWord || -99) > 8) { this.lastWord = this.t; this.words.push({ x: x + TT.rand(-40, 40), y: y + 60, z, text: TT.choice(WORDS), col, t: 0, rot: TT.rand(-0.3, 0.3) }); }
      A().play(power > 6 ? 'boom' : 'hit');
      this.cut.hits = (this.cut.hits || 0) + 1;
    }
    burst(x, y, z, col, n, sp) {
      for (let i = 0; i < n; i++) {
        const p = this.w.sparks.find((q) => q.life <= 0); if (!p) break;
        const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2;
        p.vx = Math.cos(a) * Math.cos(b) * sp; p.vy = Math.sin(b) * sp + 2; p.vz = Math.sin(a) * Math.cos(b) * sp; p.life = p.max = 14 + (Math.random() * 10 | 0);
        p.s.position.set(x, y, z); p.s.visible = true; p.s.material.color.set(Math.random() < 0.4 ? '#ffffff' : col);
      }
    }
    // coloca um Titã: posição 3D (x, z), altura h, olhando para (fx, fz)
    place(a, x, z, h, fx, fz) { a.x = x; a.y = yOf(z); a.z = h || 0; a.facing = fx >= x ? 1 : -1; a._look = [fx - x, fz - z]; }
    attack(a, def, t) { a.state = 'attack'; a.anim = 'attack'; a.atk = { def, t, hits: new Set(), landed: false }; }

    // ------------------------------------------------------------ Passo (60 por segundo)
    step(inp) {
      if (this.done) return;
      if (this.t > 20 && this.t < this.total - FIN + 88 && inp && (inp.wasPressed('light') || inp.wasPressed('jump') || inp.wasPressed('start'))) { this.t = this.total - FIN + 86; this.rt = Math.ceil(this.t / RATE); this.white = 10; for (const k of this.order) this.cut.shown.add(k); }
      const n = Math.floor(++this.rt * RATE) - this.t;
      for (let i = 0; i < n && !this.done; i++) this.vstep();
    }
    vstep() {
      ++this.t;
      // alvo quicando (malabarismo)
      if (this.tz > 0 || this.tvz) { this.tvz -= 0.75; this.tz += this.tvz; if (this.tz <= 0) { this.tz = 0; this.tvz = 0; } }
      this.tdx *= 0.9; if (this.thurt > 0) this.thurt--; this.shake *= 0.85; if (this.white > 0) this.white--;
      for (const a of this.actors) { a.animT++; a.x = -9999; }
      const n = this.order.length, si = Math.floor((this.t - 1) / SHOT);
      if (si < n) this.shotStep(this.order[si], this.actors[si], (this.t - 1) % SHOT);
      else this.finale(this.t - n * SHOT);
      for (const wd of this.words) wd.t++;
      this.words = this.words.filter((wd) => wd.t < 34);
      if (this.t >= this.total) this.done = true;
    }

    shotStep(key, a, k) {
      const w = this.w, d = a.def, [tx, ty] = this.tPos();
      for (const b of w.beams) b.visible = false;
      if (k === 0) { a.atk = null; a.state = 'dash'; a.animT = 0; this.cut.shown.add(key); A().play(key === 'beastboy' ? 'roar' : 'whoosh'); }
      if (key === 'robin') {
        // corre de longe, golpe de bastão e três birdarangues que dão a volta
        const run = sm(cl(k / 14, 0, 1));
        this.place(a, lerp(-700, -110, run), lerp(220, 40, run), 0, tx, 0);
        if (k < 14) { a.state = 'dash'; a.anim = 'dash'; } else if (k < 34) { if (k === 14) this.attack(a, d.light[2], 0); a.atk.t++; if (a.atk.t === d.light[2].s) this.hit(8, COL.robin, true); }
        else { if (k === 34) { this.attack(a, d.special, 0); A().play('birdarang'); } a.atk.t = Math.min(a.atk.t + 1, d.special.s + 2); this.place(a, -170, 60, 0, tx, 0); }
        w.rangs.forEach((r, i) => {
          const q = (k - 36 - i * 4) / 22; r.visible = q > 0 && q < 1;
          if (!r.visible) return;
          const ang = q * Math.PI * 1.3 + i * 0.6, R = 170 * Math.sin(q * Math.PI);
          r.position.set(lerp(-150, tx, q) + Math.sin(ang) * 30, 90 + ty * q * 0.5 + i * 18, Math.cos(ang) * R * 0.5 + (i - 1) * 40);
          r.rotation.set(Math.PI / 2, 0, k * 0.9);
          if (Math.abs(q - 0.72) < 0.03) this.hit(6, COL.robin, true);
        });
        if (k === SHOT - 1) w.rangs.forEach((r) => { r.visible = false; });
      } else if (key === 'starfire') {
        // voa por cima do alvo despejando starbolts
        const fly = sm(cl(k / 18, 0, 1));
        this.place(a, lerp(-600, -160, fly), lerp(-300, -80, fly), lerp(380, 230, fly) + Math.sin(k * 0.2) * 8, tx, 0);
        if (k >= 16) { if (k === 16) this.attack(a, d.light[2], 0); a.atk.t = Math.min(a.atk.t + 1, d.light[2].s + 1); a.state = 'attack'; }
        w.bolts.forEach((b, i) => {
          const q = (k - 20 - i * 3.5) / 9; b.visible = q > 0 && q < 1;
          if (!b.visible) return;
          const sx = a.x + 30, sy = a.z + 120, sz = Math.cos(a._look ? 0 : 0) - 80 + (i % 3 - 1) * 30;
          b.position.set(lerp(sx, tx + TT.rand(-10, 10), q), lerp(sy, ty, q), lerp(sz, 0, q));
          if (q > 0.88 && !b.userData.hit) { b.userData.hit = true; this.hit(5, COL.starfire, i % 3 === 0); }
          if (q < 0.2) b.userData.hit = false;
        });
        if (k === SHOT - 1) w.bolts.forEach((b) => { b.visible = false; });
      } else if (key === 'cyborg') {
        // o braço vira canhão e o feixe sônico atravessa o alvo
        this.place(a, -330, 90, 0, tx, 0);
        const def = d.special && d.special.form === 'cannon' ? d.special : (d.ender && d.ender.form === 'cannon' ? d.ender : d.special);
        if (k === 4) { this.attack(a, def, 0); A().play('alarm'); }
        if (a.atk) { a.atk.t = Math.min(a.atk.t + 1, def.s + Math.min(def.a || 20, 30)); a.state = 'attack'; }
        if (k >= 20 && k < 54) {
          const b = w.beams[2], sx = a.x + 70, sy = a.z + 95, sz = 90 - 40;
          this.beam(b, [sx, sy, sz], [tx + 40, ty, 0], 18 + Math.sin(k * 1.3) * 4);
          if ((k - 20) % 4 === 0) this.hit(4, COL.cyborg, (k - 20) % 12 === 0);
          if (k === 20) A().play('sonic');
          this.tz += (110 - this.tz) * 0.15; this.tvz = 0;
        }
      } else if (key === 'beastboy') {
        // vira T-Rex e atropela
        const run = cl((k - 6) / 30, 0, 1);
        this.place(a, lerp(-820, 140, run), lerp(-40, 0, run), 0, 999, 0);
        if (k === 6) { A().play('roar'); }
        const def = { form: 'trex', s: 8, a: 40, r: 10, reach: [0, 180] };
        if (k >= 6) { if (!a.atk || a.atk.def.form !== 'trex') this.attack(a, def, 0); a.atk.t = Math.min(k - 6 + 1, def.s + def.a - 2); }
        if (k === 26 || k === 32) this.hit(9, COL.beastboy, true);
      } else if (key === 'raven') {
        // sobe com a aura e um corvo da alma gigante mergulha sobre o alvo
        this.place(a, -260, -120, 60 + sm(cl(k / 20, 0, 1)) * 120, tx, 0);
        if (k === 2) { this.attack(a, d.special, 0); A().play('dark'); }
        if (a.atk) { a.atk.t = Math.min(a.atk.t + 1, d.special.s - 1); a.state = 'attack'; }
        if (k === 18) this.soul = { k: 0 };
        if (this.soul) {
          const s = this.soul; s.k++;
          const q = sm(cl(s.k / 26, 0, 1));
          s.x = lerp(-500, tx, q); s.y = lerp(520, ty - 20, q); s.z = lerp(-400, 0, q); s.scale = lerp(6, 4, q);
          if (s.k === 26) { this.hit(10, COL.raven, true); A().play('boom'); w.dome.visible = true; this.domeT = 0; }
          if (s.k > 30) this.soul = null;
        }
        if (w.dome.visible) { this.domeT++; const r = 40 + this.domeT * 14; w.dome.scale.setScalar(r); w.dome.position.set(tx, ty, 0); w.dome.material.opacity = Math.max(0, 0.4 - this.domeT * 0.02); if (this.domeT > 20) w.dome.visible = false; }
      }
    }

    beam(b, from, to, r) {
      const T = window.THREE, dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2], L = Math.hypot(dx, dy, dz);
      b.visible = true; b.position.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2);
      b.scale.set(r, L, r);
      b.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx / L, dy / L, dz / L));
      b.material.opacity = 0.75;
    }

    finale(k) {
      const w = this.w, n = this.order.length;
      if (k === 1) { A().play('super'); this.tvz = 14; }
      // os cinco em círculo em volta do alvo, de frente para ele
      this.tz += (230 - this.tz) * 0.08; if (k > 20) this.tvz = 0;
      const R = 430;
      this.order.forEach((key, i) => {
        const a = this.actors[i], ang = i / n * Math.PI * 2 + Math.PI * 0.5;
        const drop = sm(cl((k - i * 4) / 18, 0, 1));
        const hover = key === 'starfire' || key === 'raven' ? 70 : 0;
        this.place(a, Math.cos(ang) * R, Math.sin(ang) * R, lerp(500, hover, drop), 0, 0);
        if (k === 18 + i * 4) A().play('land');
        if (k < 40) { a.atk = null; a.state = 'idle'; a.anim = 'idle'; }
        else if (k === 40) { const def = key === 'cyborg' && a.def.special.form === 'cannon' ? a.def.special : a.def.special; this.attack(a, def, 0); }
        if (a.atk) { a.atk.t = Math.min(a.atk.t + 1, (a.atk.def.s || 10) + 1); a.state = 'attack'; }
      });
      const [tx, ty] = this.tPos();
      // feixes dos cinco até o alvo, a esfera cresce
      if (k >= 46 && k < 92) {
        if (k === 46) { A().play('sonic'); A().play('starbolt'); }
        this.order.forEach((key, i) => {
          const a = this.actors[i];
          this.beam(w.beams[Object.keys(COL).indexOf(key)], [a.x, a.z + 90, (a.y - YMID) * KD], [tx, ty, 0], 10 + (k - 46) * 0.25 + Math.sin(k + i) * 2);
        });
        w.orb.visible = true; const r = 20 + (k - 46) * 2.6; w.orb.scale.setScalar(r); w.orb.position.set(tx, ty, 0);
        w.orbGlow.position.set(tx, ty, 0); w.orbGlow.scale.setScalar(r * 6); w.orbGlow.material.opacity = 0.8;
        if ((k - 46) % 6 === 0) this.hit(3, TT.choice(Object.values(COL)), false);
        this.shake = Math.max(this.shake, 3 + (k - 46) * 0.15);
      } else for (const b of w.beams) b.visible = false;
      if (k === 92) { // KA-BOOM
        this.white = 14; this.shake = 30; w.orb.visible = false;
        A().play('boom'); A().play('shockwave');
        this.burst(tx, ty, 0, '#ffe14a', 40, 16);
        this.words.push({ x: tx, y: ty + 140, z: 0, text: 'KA-BOOM!', col: '#ff3b30', t: 0, rot: -0.08, big: true });
        w.wave.visible = true; this.waveT = 0;
        this.th = 0; this.gone = true;
      }
      if (w.wave.visible) { this.waveT++; const r = 60 + this.waveT * 40; w.wave.scale.set(r, r, r); w.wave.position.set(0, 20, 0); w.wave.material.opacity = Math.max(0, 0.95 - this.waveT / 30); if (this.waveT > 30) w.wave.visible = false; }
      if (k > 92) w.orbGlow.material.opacity = Math.max(0, w.orbGlow.material.opacity - 0.05);
      if (k === 104 && !this.resolved) { this.resolved = true; this.game.resolveSuper(); }
    }

    // ------------------------------------------------------------ Câmera de cada plano
    camera() {
      const n = this.order.length, si = Math.floor((this.t - 1) / SHOT), k = (this.t - 1) % SHOT, [tx, ty] = this.tPos();
      if (si >= n) {
        const f = this.t - n * SHOT, a = f * 0.025 + 0.6;
        const dist = f < 92 ? lerp(1500, 1050, cl(f / 60, 0, 1)) : lerp(1050, 1700, cl((f - 92) / 30, 0, 1));
        return { x: tx, y: ty * 0.7, z: 0, yaw: a, pitch: f < 92 ? 0.12 : 0.35, fov: 46, dist, roll: Math.sin(f * 0.05) * 0.04 };
      }
      const key = this.order[si], a = this.actors[si], q = k / SHOT;
      switch (key) {
        case 'robin': return { x: lerp(a.x, tx, 0.5), y: 70, z: 40, yaw: lerp(-0.9, 0.5, sm(q)), pitch: 0.08, fov: 42, dist: lerp(520, 640, q), roll: -0.04 };
        case 'starfire': return { x: lerp(a.x, tx, 0.5), y: 160, z: -40, yaw: 0.55, pitch: lerp(-0.25, -0.05, q), fov: 50, dist: 700, roll: 0.06 };
        case 'cyborg': return { x: a.x - 60, y: 120, z: 90, yaw: lerp(-1.5, -1.15, q), pitch: 0.12, fov: 40, dist: 300, roll: 0 };
        case 'beastboy': return { x: lerp(a.x + 260, tx, cl(q * 1.2, 0, 1)), y: 70, z: 0, yaw: lerp(1.25, 0.9, q), pitch: 0.04, fov: 50, dist: lerp(520, 760, q), roll: 0.05 };
        case 'raven': return { x: this.soul ? lerp(-260, tx, 0.5) : -150, y: lerp(220, 320, q), z: -60, yaw: lerp(0.2, 0.7, q), pitch: 0.1, fov: 54, dist: lerp(1000, 1150, q), roll: 0 };
        default: return { x: tx, y: 100, z: 0, yaw: 0.5, pitch: 0.2, fov: 45, dist: 900, roll: 0 };
      }
    }

    // ------------------------------------------------------------ Desenho
    draw(ctx, alpha) {
      const w = this.w, T = window.THREE, g = this.game, s = g.scale;
      w.syncSize();
      // câmera (suavizada entre planos)
      const want = this.camera();
      if (!this.cv || (this.t - 1) % SHOT === 0) this.cv = Object.assign({}, want);
      else for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'fov', 'dist', 'roll']) this.cv[k] += (want[k] - this.cv[k]) * 0.18;
      const c = this.cv, cam = w.cam, sh = this.shake;
      const ox = sh ? TT.rand(-sh, sh) : 0, oy = sh ? TT.rand(-sh, sh) * 0.7 : 0, cp = Math.cos(c.pitch);
      cam.position.set(c.x + Math.sin(c.yaw) * cp * c.dist + ox, c.y + Math.sin(c.pitch) * c.dist + oy, c.z + Math.cos(c.yaw) * cp * c.dist);
      cam.up.set(Math.sin(c.roll || 0), Math.cos(c.roll || 0), 0); cam.lookAt(c.x + ox, c.y + oy, c.z);
      cam.fov = c.fov; cam.near = 10; cam.far = 40000; cam.updateProjectionMatrix();
      w.cv = c; w.sky.position.copy(cam.position);
      w.sun.target.position.set(0, 0, 0); w.sun.position.set(-700, 1500, 900);
      // personagens
      const used = new Set();
      for (const a of this.actors) {
        if (a.x < -5000) continue;
        const M = w.modelFor(a); if (!M) continue;
        used.add(a); w.syncModel(a, M); M.root.visible = true;
        if (a._look && !(w.formOf(a))) M.root.rotation.y = Math.atan2(-a._look[1], a._look[0]);
        else if (a._look) M.root.rotation.y = Math.atan2(-a._look[1], a._look[0]);
      }
      // corvo da alma gigante: uma Ravena em esquiva (forma de corvo), bem grande
      if (this.soul && this.soul.x != null) {
        if (!this.soulActor) { this.soulActor = new TT.Titan(g, this.cut.queue.find((q) => q.key === 'raven') ? 'raven' : 'raven'); }
        const sa = this.soulActor; sa.state = 'dash'; sa.animT = (sa.animT || 0) + 1; sa.x = this.soul.x; sa.y = YMID; sa.z = this.soul.y - 58; sa.facing = 1;
        const M = w.modelFor(sa);
        if (M) { used.add(sa); w.syncModel(sa, M); M.root.scale.multiplyScalar(this.soul.scale); M.root.position.z = this.soul.z; M.root.rotation.y = 0; M.root.visible = true; }
      }
      // alvo (o inimigo de verdade, só posicionado aqui; o modelo dele é deste palco)
      const tg = this.target;
      if (!this.gone && tg) {
        const [tx] = this.tPos(), keep = { x: tg.x, y: tg.y, z: tg.z, facing: tg.facing, state: tg.state, st: tg.st, flash: tg.flash };
        tg.x = tx; tg.y = YMID; tg.z = this.tz; tg.facing = -1; if (this.thurt > 0) { tg.state = 'hurt'; tg.st = 4; tg.flash = this.thurt > 5 ? 5 : 0; }
        let M = null; try { M = w.modelFor(tg); } catch (e) { M = null; }
        if (M) { used.add(tg); try { w.syncModel(tg, M); } catch (e) { /* desenho de apoio */ } M.root.visible = true; M.root.rotation.y = Math.PI; }
        else this.fallback(tx);
        Object.assign(tg, keep);
      } else if (this.fb) this.fb.visible = false;
      for (const [d, M] of w.models) if (!used.has(d)) M.root.visible = false;
      // faíscas
      for (const p of w.sparks) {
        if (p.life <= 0) { p.s.visible = false; continue; }
        p.life--; p.vy -= 0.4; p.s.position.x += p.vx; p.s.position.y += p.vy; p.s.position.z += p.vz;
        const k = p.life / p.max; p.s.material.opacity = k; p.s.scale.setScalar(10 + 30 * k);
      }
      w.crystals.forEach((cr, i) => { cr.rotation.y += 0.03; cr.position.y = 300 + Math.sin(this.t * 0.05 + i) * 20; });
      w.rings[0].rotation.z += 0.004; w.rings[1].rotation.z -= 0.003;
      if (w.gfx) w.gfx.render(w.scene, cam); else w.renderer.render(w.scene, cam);
      ctx.save(); ctx.globalAlpha = alpha; ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.drawImage(w.canvas, 0, 0, W, H);
      // onomatopeias presas no espaço 3D
      const v = new T.Vector3();
      for (const wd of this.words) {
        v.set(wd.x, wd.y, wd.z).project(cam); if (v.z > 1) continue;
        const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H, k = Math.min(1, wd.t / 4), sz = (wd.big ? 110 : 54) * (0.6 + 0.4 * k) * (1 + Math.sin(wd.t * 0.3) * 0.03);
        ctx.save(); ctx.globalAlpha = alpha * Math.min(1, (34 - wd.t) / 10); ctx.translate(x, y - wd.t * 1.2); ctx.rotate(wd.rot);
        TT.drawText(ctx, wd.text, 0, 0, sz, '#ffe14a', wd.col, 'center', wd.big ? 14 : 9);
        ctx.restore();
      }
      // faixas de cinema e legenda do plano
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 62); ctx.fillRect(0, H - 62, W, 62);
      const n = this.order.length, si = Math.floor((this.t - 1) / SHOT);
      const NAMES = { robin: 'ROBIN', starfire: 'ESTELAR', cyborg: 'CIBORGUE', beastboy: 'MUTANO', raven: 'RAVENA' };
      if (si < n) { const key = this.order[si]; TT.drawText(ctx, NAMES[key] || key, 40, H - 31, 34, COL[key], '#17121f', 'left', 6); }
      else TT.drawText(ctx, 'TITÃS, AVANTE!', W / 2, H - 31, 38, '#ffe14a', '#17121f', 'center', 7);
      if (this.t < this.total - FIN + 60) TT.drawText(ctx, (g.touch && g.touch.visible ? 'ATAQUE' : 'ENTER') + ' pula a cena', W - 30, 31, 20, '#9a95b8', '#17121f', 'right', 4);
      if (this.white > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, this.white / 8) + ')'; ctx.fillRect(0, 0, W, H); }
      ctx.restore();
    }
    // alvo sem modelo 3D (chefes especiais): golem de cristal escuro com um olho
    fallback(tx) {
      const T = window.THREE, w = this.w;
      if (!this.fb) {
        const g = this.fb = new T.Group();
        const body = new T.Mesh(new T.IcosahedronGeometry(70, 0), w.gem('#3a2a5a', { emissive: 0x200a40 })); body.castShadow = true; g.add(body);
        const eye = new T.Mesh(w.sph(18, 16, 12), w.neon('#ff3050')); eye.position.set(-60, 10, 0); g.add(eye);
        g.add(w.glowSprite('#ff3050', 120, 0.7)); g.children[2].position.copy(eye.position);
        w.scene.add(g);
      }
      this.fb.visible = true; this.fb.position.set(tx, this.tz + 80, 0); this.fb.rotation.y += 0.05; this.fb.rotation.z = this.thurt > 0 ? 0.3 : 0;
    }
  }
  TT.Ultimate3D = Ultimate3D;
})();
