'use strict';
// Cenários em camadas com parallax. Cada camada é pintada em blocos (chunks) cacheados em canvas
// fora da tela: o custo de desenho por quadro é só um drawImage por bloco visível.
(function () {
  const TT = window.TT;
  const H = TT.H, FT = TT.FLOOR_TOP;
  const CHUNK = 512;

  class Layer {
    constructor(factor, painter, seed) {
      this.factor = factor;
      this.painter = painter;
      this.seed = seed || 1;
      this.cache = new Map();
      this.scale = 1;
    }
    setScale(s) {
      if (s !== this.scale) { this.scale = s; this.cache.clear(); }
    }
    chunk(i) {
      let c = this.cache.get(i);
      if (c) return c;
      const s = this.scale;
      c = TT.makeCanvas((CHUNK + 2) * s, H * s);
      const g = c.getContext('2d');
      g.scale(s, s);
      g.translate(-i * CHUNK, 0);
      g.lineCap = 'round'; g.lineJoin = 'round';
      const x0 = i * CHUNK, x1 = x0 + CHUNK + 2;
      g.save();
      g.beginPath(); g.rect(x0, 0, CHUNK + 2, H); g.clip();
      this.painter(g, x0, x1, this.seed);
      g.restore();
      this.cache.set(i, c);
      return c;
    }
    draw(ctx, camX) {
      const lx = camX * this.factor;
      // margem de 40px para cobrir as bordas durante o tremor de tela
      const first = Math.floor((lx - 40) / CHUNK), last = Math.floor((lx + TT.W + 40) / CHUNK);
      for (let i = first; i <= last; i++) {
        const c = this.chunk(i);
        const dx = Math.round((i * CHUNK - lx) * this.scale) / this.scale;
        ctx.drawImage(c, dx, 0, CHUNK + 2, H);
      }
      // pré-gera no máximo um bloco à frente por quadro (evita engasgos ao rolar a tela)
      for (const i of [last + 1, first - 1]) if (!this.cache.has(i)) { this.chunk(i); break; }
      // descarta blocos distantes para manter a memória baixa
      if (this.cache.size > 10) {
        for (const k of this.cache.keys()) if (k < first - 2 || k > last + 2) this.cache.delete(k);
      }
    }
    // Pré-gera os blocos visíveis a partir de camX (evita engasgos durante o jogo).
    warm(camX) {
      const lx = camX * this.factor;
      for (let i = Math.floor(lx / CHUNK) - 1; i <= Math.floor((lx + TT.W) / CHUNK) + 1; i++) this.chunk(i);
    }
  }
  TT.Layer = Layer;

  // Itera "células" determinísticas que tocam [x0,x1].
  function cells(x0, x1, w, seed, fn) {
    const a = Math.floor(x0 / w) - 1, b = Math.floor(x1 / w) + 1;
    for (let i = a; i <= b; i++) fn(i * w, TT.seeded(i * 7919 + seed * 104729 + 13), i);
  }

  function clipX(g, a, b, fn) {
    g.save(); g.beginPath(); g.rect(a, -10, b - a, H + 20); g.clip(); fn(); g.restore();
  }

  const OUT = '#17121f';

  // =============================================================== FASE 1 — Torre Titã
  function s1Far(g, x0, x1) {
    const sky = g.createLinearGradient(0, 0, 0, 345);
    sky.addColorStop(0, '#241848'); sky.addColorStop(0.35, '#6b3b80'); sky.addColorStop(0.72, '#e46e5c'); sky.addColorStop(1, '#ffc27a');
    g.fillStyle = sky; g.fillRect(x0, 0, x1 - x0, 345);
    // estrelinhas no alto
    cells(x0, x1, 90, 3, (cx, r) => {
      g.fillStyle = 'rgba(255,240,220,' + (0.3 + r() * 0.5) + ')';
      g.fillRect(cx + r() * 90, r() * 120, 2, 2);
    });
    // sol
    const sx = 760, sy = 300;
    if (x1 > sx - 260 && x0 < sx + 260) {
      const gl = g.createRadialGradient(sx, sy, 10, sx, sy, 250);
      gl.addColorStop(0, 'rgba(255,240,180,0.9)'); gl.addColorStop(0.3, 'rgba(255,190,110,0.45)'); gl.addColorStop(1, 'rgba(255,150,90,0)');
      g.fillStyle = gl; g.fillRect(sx - 260, sy - 260, 520, 520);
      g.beginPath(); g.arc(sx, sy, 62, 0, Math.PI * 2); g.fillStyle = '#ffe9a8'; g.fill();
    }
    // nuvens estilizadas
    cells(x0, x1, 340, 5, (cx, r) => {
      const y = 70 + r() * 150, w = 120 + r() * 160;
      g.fillStyle = r() > 0.5 ? 'rgba(255,170,150,0.55)' : 'rgba(150,90,150,0.5)';
      for (let k = 0; k < 5; k++) {
        g.beginPath(); g.ellipse(cx + k * w / 5, y + Math.sin(k * 1.7) * 6, w / 4, 16 + r() * 10, 0, 0, Math.PI * 2); g.fill();
      }
    });
    // skyline de Jump City do outro lado da baía
    cells(x0, x1, 46, 7, (cx, r) => {
      const h = 40 + r() * 120 * (0.5 + 0.5 * Math.sin(cx * 0.004)), w = 30 + r() * 20;
      g.fillStyle = '#4b2f63'; g.fillRect(cx, 345 - h, w, h);
      if (r() > 0.6) { g.fillRect(cx + w / 2 - 2, 345 - h - 20, 4, 20); }
      g.fillStyle = 'rgba(255,214,120,0.7)';
      for (let wy = 345 - h + 8; wy < 335; wy += 12) for (let wx = cx + 5; wx < cx + w - 6; wx += 9) if (r() > 0.55) g.fillRect(wx, wy, 4, 5);
    });
    // mar
    const sea = g.createLinearGradient(0, 345, 0, H);
    sea.addColorStop(0, '#e98f78'); sea.addColorStop(0.08, '#7a5b9c'); sea.addColorStop(0.5, '#33407e'); sea.addColorStop(1, '#1b2350');
    g.fillStyle = sea; g.fillRect(x0, 345, x1 - x0, H - 345);
    cells(x0, x1, 60, 9, (cx, r) => {
      for (let k = 0; k < 4; k++) {
        const y = 352 + r() * 110, near = Math.abs(cx - sx) < 160;
        g.fillStyle = near ? 'rgba(255,225,160,0.75)' : 'rgba(255,200,200,0.22)';
        g.fillRect(cx + r() * 60, y, 14 + r() * 30, 2);
      }
    });
  }

  function drawTower(g, cx) {
    const base = 470;
    // ilha
    g.fillStyle = '#3c2c45';
    g.beginPath(); g.ellipse(cx, base + 8, 360, 46, 0, Math.PI, Math.PI * 2); g.fill();
    // coluna
    const cw = 190, top = 150;
    const col = g.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
    col.addColorStop(0, '#c9d3ea'); col.addColorStop(0.55, '#f2f5ff'); col.addColorStop(1, '#8e9bc0');
    g.fillStyle = col; g.fillRect(cx - cw / 2, top, cw, base - top);
    g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(cx - cw / 2, top, cw, base - top);
    // faixas de vidro
    for (let y = top + 40; y < base - 40; y += 56) {
      const glass = g.createLinearGradient(0, y, 0, y + 30);
      glass.addColorStop(0, '#79b8ff'); glass.addColorStop(1, '#2d5fb8');
      g.fillStyle = glass; g.fillRect(cx - cw / 2 + 8, y, cw - 16, 28);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(cx - cw / 2 + 14, y + 4, 40, 5);
      g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(cx - cw / 2 + 8, y, cw - 16, 28);
    }
    // barra do T
    const bw = 560, by = 40, bh = 130;
    const bar = g.createLinearGradient(0, by, 0, by + bh);
    bar.addColorStop(0, '#f6f8ff'); bar.addColorStop(1, '#a9b5d6');
    g.fillStyle = bar; g.beginPath(); g.rect(cx - bw / 2, by, bw, bh); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 4; g.stroke();
    const glass = g.createLinearGradient(0, by + 30, 0, by + 100);
    glass.addColorStop(0, '#8cc6ff'); glass.addColorStop(1, '#2a58ad');
    g.fillStyle = glass; g.fillRect(cx - bw / 2 + 12, by + 34, bw - 24, 60);
    g.fillStyle = 'rgba(255,220,170,0.45)'; g.fillRect(cx - bw / 2 + 12, by + 34, bw - 24, 10);
    g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(cx - bw / 2 + 12, by + 34, bw - 24, 60);
    for (let x = cx - bw / 2 + 12 + 70; x < cx + bw / 2 - 12; x += 70) { g.beginPath(); g.moveTo(x, by + 34); g.lineTo(x, by + 94); g.stroke(); }
    // reflexo do pôr do sol
    g.fillStyle = 'rgba(255,170,120,0.25)'; g.fillRect(cx - cw / 2, top, 40, base - top);
  }

  function s1Mid(g, x0, x1) {
    if (x1 > 560 && x0 < 1240) drawTower(g, 900);
    // rochas da ilha / costão
    cells(x0, x1, 210, 11, (cx, r) => {
      const y = 470, w = 90 + r() * 140, h = 20 + r() * 40;
      g.fillStyle = r() > 0.5 ? '#4a3550' : '#3a2a44';
      g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + w * 0.2, y - h); g.lineTo(cx + w * 0.55, y - h * 0.7); g.lineTo(cx + w * 0.8, y - h * 1.1); g.lineTo(cx + w, y); g.closePath(); g.fill();
    });
  }

  function s1NearExterior(g, x0, x1) {
    // grama da ilha
    g.fillStyle = '#2f6b3c'; g.fillRect(x0, 438, x1 - x0, 40);
    cells(x0, x1, 22, 21, (cx, r) => {
      g.fillStyle = r() > 0.5 ? '#3d8a4a' : '#2a5e35';
      g.beginPath(); g.moveTo(cx, 446); g.lineTo(cx + 5 + r() * 6, 424 + r() * 12); g.lineTo(cx + 12, 446); g.fill();
    });
    // pedras no topo
    cells(x0, x1, 300, 23, (cx, r) => {
      if (r() < 0.4) return;
      const x = cx + r() * 200, w = 50 + r() * 70, h = 30 + r() * 30;
      g.fillStyle = '#6d6377'; g.strokeStyle = OUT; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, 470); g.quadraticCurveTo(x + 4, 470 - h, x + w * 0.5, 468 - h); g.quadraticCurveTo(x + w, 470 - h * 0.8, x + w, 470); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,190,150,0.35)'; g.beginPath(); g.ellipse(x + w * 0.4, 474 - h, w * 0.25, 5, 0, 0, Math.PI * 2); g.fill();
    });
    // piso de pedra
    const fl = g.createLinearGradient(0, FT, 0, H);
    fl.addColorStop(0, '#b49b88'); fl.addColorStop(1, '#7b6455');
    g.fillStyle = fl; g.fillRect(x0, FT, x1 - x0, H - FT);
    g.strokeStyle = 'rgba(60,40,40,0.35)'; g.lineWidth = 2;
    const rows = [FT, 512, 562, 622, 700];
    for (let i = 0; i < rows.length - 1; i++) {
      g.beginPath(); g.moveTo(x0, rows[i]); g.lineTo(x1, rows[i]); g.stroke();
      const w = 70 + i * 22, off = i % 2 ? w / 2 : 0;
      for (let x = Math.floor((x0 - off) / w) * w + off; x < x1; x += w) { g.beginPath(); g.moveTo(x, rows[i]); g.lineTo(x - 8, rows[i + 1]); g.stroke(); }
    }
    cells(x0, x1, 120, 29, (cx, r) => { g.fillStyle = 'rgba(255,220,190,0.12)'; g.fillRect(cx + r() * 80, FT + 10 + r() * 200, 30 + r() * 30, 6); });
    g.fillStyle = 'rgba(40,20,40,0.35)'; g.fillRect(x0, FT, x1 - x0, 6);
  }

  const S1_INT = 2600, S1_OPS = 5100;
  function s1NearInterior(g, x0, x1) {
    // parede
    const wall = g.createLinearGradient(0, 0, 0, FT);
    wall.addColorStop(0, '#1b1f36'); wall.addColorStop(1, '#2f3658');
    g.fillStyle = wall; g.fillRect(x0, 0, x1 - x0, FT);
    // painéis
    g.strokeStyle = 'rgba(120,140,200,0.18)'; g.lineWidth = 2;
    for (let x = Math.floor(x0 / 130) * 130; x < x1; x += 130) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x, FT - 12); g.stroke(); }
    // faixa de luz
    g.fillStyle = '#6fe3ff'; g.fillRect(x0, 52, x1 - x0, 4);
    g.fillStyle = 'rgba(111,227,255,0.18)'; g.fillRect(x0, 44, x1 - x0, 20);

    const hallEnd = Math.min(x1, S1_OPS);
    if (x0 < hallEnd) clipX(g, x0, hallEnd, () => {
      // corredor: janelas e portas alternadas
      cells(x0, x1, 560, 31, (cx, r, i) => {
        if (cx < S1_INT || cx + 560 > S1_OPS + 100) return;
        const wx = cx + 60, ww = 330, wy = 100, wh = 270;
        g.clearRect(wx, wy, ww, wh);
        g.strokeStyle = OUT; g.lineWidth = 8; g.strokeRect(wx, wy, ww, wh);
        g.strokeStyle = '#5d6a8c'; g.lineWidth = 4; g.strokeRect(wx + 4, wy + 4, ww - 8, wh - 8);
        g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh * 0.62); g.lineTo(wx + ww, wy + wh * 0.62); g.stroke();
        g.fillStyle = 'rgba(160,210,255,0.12)';
        g.beginPath(); g.moveTo(wx + 20, wy + wh); g.lineTo(wx + 90, wy); g.lineTo(wx + 130, wy); g.lineTo(wx + 60, wy + wh); g.fill();
        // porta deslizante com o "T"
        const dx = cx + 430, dw = 110, dy = 200;
        g.fillStyle = '#3c4570'; g.fillRect(dx, dy, dw, FT - dy - 8);
        g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(dx, dy, dw, FT - dy - 8);
        g.strokeStyle = '#7f8cc0'; g.lineWidth = 2; g.beginPath(); g.moveTo(dx + dw / 2, dy); g.lineTo(dx + dw / 2, FT - 8); g.stroke();
        g.fillStyle = '#f2f5ff'; g.fillRect(dx + 30, dy + 30, 50, 12); g.fillRect(dx + 49, dy + 30, 12, 46);
        g.fillStyle = i % 2 ? '#4cff9a' : '#ff5a5a'; g.fillRect(dx + dw + 8, dy + 80, 8, 14);
      });
    });
    if (x1 > S1_OPS) clipX(g, Math.max(x0, S1_OPS), x1, () => {
      // sala principal: janela panorâmica
      const wy = 70, wh = 330;
      g.clearRect(Math.max(x0, S1_OPS + 80), wy, x1 - Math.max(x0, S1_OPS + 80), wh);
      g.strokeStyle = OUT; g.lineWidth = 8;
      g.beginPath(); g.moveTo(S1_OPS + 80, wy); g.lineTo(x1 + 10, wy); g.moveTo(S1_OPS + 80, wy + wh); g.lineTo(x1 + 10, wy + wh); g.moveTo(S1_OPS + 80, wy); g.lineTo(S1_OPS + 80, wy + wh); g.stroke();
      g.strokeStyle = '#5d6a8c'; g.lineWidth = 6;
      for (let x = S1_OPS + 80 + 170; x < x1; x += 170) { g.beginPath(); g.moveTo(x, wy); g.lineTo(x, wy + wh); g.stroke(); }
      g.fillStyle = 'rgba(160,210,255,0.08)'; g.fillRect(S1_OPS + 80, wy, 9000, wh);
      // sofá dos Titãs
      const sx = 5600, sw = 420;
      if (x1 > sx - 20 && x0 < sx + sw + 20) {
        g.fillStyle = '#4a4f8a'; g.strokeStyle = OUT; g.lineWidth = 4;
        g.beginPath(); g.roundRect ? g.roundRect(sx, 392, sw, 60, 14) : g.rect(sx, 392, sw, 60); g.fill(); g.stroke();
        g.fillStyle = '#5c62a6'; g.beginPath(); g.roundRect ? g.roundRect(sx + 12, 420, sw - 24, 40, 10) : g.rect(sx + 12, 420, sw - 24, 40); g.fill(); g.stroke();
        g.fillStyle = '#ff9a3c'; g.beginPath(); g.moveTo(sx + 300, 418); g.lineTo(sx + 340, 412); g.lineTo(sx + 330, 426); g.closePath(); g.fill(); // fatia de pizza esquecida
      }
      // console / telão
      const tx = 6150;
      if (x1 > tx - 10 && x0 < tx + 200) {
        g.fillStyle = '#20243a'; g.fillRect(tx, 380, 180, 80); g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(tx, 380, 180, 80);
        for (let k = 0; k < 6; k++) { g.fillStyle = ['#ff5a5a', '#4cff9a', '#6fe3ff'][k % 3]; g.fillRect(tx + 16 + k * 26, 400, 14, 8); }
      }
    });
    // rodapé e piso
    g.fillStyle = '#12142a'; g.fillRect(x0, FT - 12, x1 - x0, 14);
    g.fillStyle = '#6fe3ff'; g.fillRect(x0, FT - 4, x1 - x0, 2);
    const fl = g.createLinearGradient(0, FT, 0, H);
    fl.addColorStop(0, '#4a5278'); fl.addColorStop(0.4, '#353b5c'); fl.addColorStop(1, '#22263e');
    g.fillStyle = fl; g.fillRect(x0, FT, x1 - x0, H - FT);
    g.strokeStyle = 'rgba(150,170,230,0.16)'; g.lineWidth = 2;
    for (const y of [520, 585, 660]) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    for (let x = Math.floor(x0 / 140) * 140; x < x1 + 140; x += 140) { g.beginPath(); g.moveTo(x, FT); g.lineTo(x - 70, H); g.stroke(); }
    // reflexos das janelas no piso polido
    cells(x0, x1, 560, 31, (cx) => {
      if (cx < S1_INT || cx + 560 > S1_OPS + 100) return;
      g.fillStyle = 'rgba(255,190,150,0.10)'; g.fillRect(cx + 60, FT + 6, 330, 50);
    });
    if (x1 > S1_OPS) { g.fillStyle = 'rgba(255,190,150,0.08)'; g.fillRect(Math.max(x0, S1_OPS + 80), FT + 6, x1, 70); }
  }

  function s1Near(g, x0, x1) {
    if (x0 < S1_INT) clipX(g, x0, Math.min(x1, S1_INT), () => s1NearExterior(g, x0, x1));
    if (x1 > S1_INT) clipX(g, Math.max(x0, S1_INT), x1, () => s1NearInterior(g, x0, x1));
    // entrada da torre (borda grossa)
    if (x0 < S1_INT + 20 && x1 > S1_INT - 20) {
      g.fillStyle = '#d9def0'; g.fillRect(S1_INT - 14, 0, 28, FT);
      g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(S1_INT - 14, -4, 28, FT + 4);
    }
  }

  // =============================================================== FASE 2 — Perfuratriz do Terror
  function s2Far(g, x0, x1) {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b0814'); bg.addColorStop(0.55, '#24162a'); bg.addColorStop(1, '#3a2224');
    g.fillStyle = bg; g.fillRect(x0, 0, x1 - x0, H);
    // arcos de túneis ao longe
    cells(x0, x1, 380, 41, (cx, r) => {
      const w = 200 + r() * 120, y = 320 + r() * 40;
      const gl = g.createRadialGradient(cx + w / 2, y, 5, cx + w / 2, y, w * 0.7);
      gl.addColorStop(0, 'rgba(255,160,80,0.35)'); gl.addColorStop(1, 'rgba(255,120,60,0)');
      g.fillStyle = gl; g.fillRect(cx - 40, y - w, w + 80, w * 1.6);
      g.fillStyle = '#120c18';
      g.beginPath(); g.moveTo(cx, H); g.lineTo(cx, y); g.quadraticCurveTo(cx + w / 2, y - w * 0.7, cx + w, y); g.lineTo(cx + w, H); g.lineTo(cx + w - 26, H); g.lineTo(cx + w - 26, y + 8); g.quadraticCurveTo(cx + w / 2, y - w * 0.55, cx + 26, y + 8); g.lineTo(cx + 26, H); g.closePath(); g.fill();
    });
    // estalactites
    cells(x0, x1, 70, 43, (cx, r) => {
      const h = 30 + r() * 90;
      g.fillStyle = '#1a1220';
      g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx + 18 + r() * 20, h); g.lineTo(cx + 50, 0); g.fill();
    });
  }

  function s2Mid(g, x0, x1) {
    cells(x0, x1, 300, 47, (cx, r) => {
      // vigas de aço
      g.fillStyle = '#3b2f3a'; g.fillRect(cx + 40, 0, 26, 480);
      g.fillStyle = '#4f404b'; g.fillRect(cx + 44, 0, 6, 480);
      g.strokeStyle = '#2a2029'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(cx + 66, 120); g.lineTo(cx + 300, 60); g.stroke();
      // lâmpada pendurada
      const lx = cx + 150, ly = 150 + (r() * 30) | 0;
      g.strokeStyle = '#120c14'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx, 0); g.lineTo(lx, ly); g.stroke();
      g.fillStyle = '#2a2029'; g.beginPath(); g.moveTo(lx - 14, ly + 10); g.lineTo(lx - 6, ly); g.lineTo(lx + 6, ly); g.lineTo(lx + 14, ly + 10); g.fill();
      const gl = g.createRadialGradient(lx, ly + 14, 2, lx, ly + 60, 170);
      gl.addColorStop(0, 'rgba(255,214,140,0.55)'); gl.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gl; g.fillRect(lx - 180, ly, 360, 340);
      g.fillStyle = '#ffe2a0'; g.beginPath(); g.arc(lx, ly + 11, 5, 0, Math.PI * 2); g.fill();
    });
    // canos
    g.fillStyle = '#4a3a2e'; g.fillRect(x0, 210, x1 - x0, 16);
    g.fillStyle = '#6a5442'; g.fillRect(x0, 212, x1 - x0, 4);
    cells(x0, x1, 180, 49, (cx) => { g.fillStyle = '#2e241d'; g.fillRect(cx, 206, 12, 24); });
  }

  const S2_CHASE0 = 2700, S2_CHASE1 = 5800, S2_LAB = 6600;
  function s2Near(g, x0, x1) {
    // parede rochosa baixa
    const wall = g.createLinearGradient(0, 300, 0, FT);
    wall.addColorStop(0, '#3d2a2c'); wall.addColorStop(1, '#5a3d33');
    g.fillStyle = wall;
    g.beginPath(); g.moveTo(x0, FT);
    for (let x = Math.floor(x0 / 40) * 40; x <= x1 + 40; x += 40) g.lineTo(x, 320 + Math.sin(x * 0.013) * 20 + Math.sin(x * 0.051) * 8);
    g.lineTo(x1 + 40, FT); g.closePath(); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
    cells(x0, x1, 90, 51, (cx, r) => {
      g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,200,160,0.08)';
      g.beginPath(); g.ellipse(cx + r() * 90, 360 + r() * 100, 18 + r() * 24, 8 + r() * 10, r(), 0, Math.PI * 2); g.fill();
    });
    // escoras de madeira
    cells(x0, x1, 420, 53, (cx) => {
      g.fillStyle = '#6b4a2e'; g.strokeStyle = OUT; g.lineWidth = 3;
      g.fillRect(cx + 20, 290, 22, FT - 290); g.strokeRect(cx + 20, 290, 22, FT - 290);
      g.fillRect(cx + 260, 290, 22, FT - 290); g.strokeRect(cx + 260, 290, 22, FT - 290);
      g.fillRect(cx + 4, 280, 294, 20); g.strokeRect(cx + 4, 280, 294, 20);
      g.strokeStyle = '#4a321f'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + 26, 300); g.lineTo(cx + 26, FT - 6); g.stroke();
    });
    // zona da perseguição: faixas de perigo
    if (x1 > S2_CHASE0 && x0 < S2_CHASE1) clipX(g, Math.max(x0, S2_CHASE0), Math.min(x1, S2_CHASE1), () => {
      for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) {
        g.fillStyle = (x / 40) % 2 ? '#f2c12e' : '#1c1a1e';
        g.beginPath(); g.moveTo(x, FT - 30); g.lineTo(x + 20, FT - 30); g.lineTo(x + 40, FT - 12); g.lineTo(x + 20, FT - 12); g.fill();
      }
      cells(x0, x1, 700, 57, (cx) => {
        if (cx < S2_CHASE0 || cx > S2_CHASE1 - 300) return;
        g.fillStyle = '#f2c12e'; g.strokeStyle = OUT; g.lineWidth = 4;
        g.fillRect(cx + 200, 360, 150, 60); g.strokeRect(cx + 200, 360, 150, 60);
        TT.drawText(g, 'PERIGO!', cx + 275, 391, 28, '#1c1a1e');
      });
    });
    // laboratório H.I.V.E. (arena do chefe)
    if (x1 > S2_LAB) clipX(g, Math.max(x0, S2_LAB), x1, () => {
      const lab = g.createLinearGradient(0, 0, 0, FT);
      lab.addColorStop(0, '#141826'); lab.addColorStop(1, '#2b3044');
      g.fillStyle = lab; g.fillRect(Math.max(x0, S2_LAB), 220, x1, FT - 220);
      g.strokeStyle = 'rgba(240,198,46,0.22)'; g.lineWidth = 2;
      for (let y = 240; y < FT; y += 34) for (let x = Math.floor(x0 / 40) * 40 + ((y / 34) % 2) * 20; x < x1; x += 40) {
        g.beginPath();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); }
        g.closePath(); g.stroke();
      }
      cells(x0, x1, 360, 59, (cx, r) => {
        if (cx < S2_LAB) return;
        g.fillStyle = '#0d1018'; g.fillRect(cx + 60, 270, 170, 100); g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(cx + 60, 270, 170, 100);
        g.fillStyle = '#123a2a'; g.fillRect(cx + 70, 280, 150, 80);
        g.strokeStyle = '#4cff9a'; g.lineWidth = 2; g.beginPath();
        for (let k = 0; k < 15; k++) g.lineTo(cx + 74 + k * 10, 320 + Math.sin(k * 1.3 + r() * 6) * 20);
        g.stroke();
      });
      g.fillStyle = '#f0c62e'; g.fillRect(Math.max(x0, S2_LAB), 220, x1, 8);
    });
    // piso de terra com trilhos
    const fl = g.createLinearGradient(0, FT, 0, H);
    fl.addColorStop(0, '#6b4a36'); fl.addColorStop(1, '#3a281e');
    g.fillStyle = fl; g.fillRect(x0, FT, x1 - x0, H - FT);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0, FT, x1 - x0, 8);
    for (let x = Math.floor(x0 / 48) * 48; x < x1; x += 48) { g.fillStyle = '#4a3020'; g.fillRect(x, 572, 18, 64); }
    for (const ry of [584, 620]) {
      g.fillStyle = '#8f949e'; g.fillRect(x0, ry, x1 - x0, 6);
      g.fillStyle = '#c9ced8'; g.fillRect(x0, ry, x1 - x0, 2);
    }
    cells(x0, x1, 160, 61, (cx, r) => {
      if (r() > 0.55) { g.fillStyle = 'rgba(120,160,220,0.25)'; g.beginPath(); g.ellipse(cx + r() * 100, 500 + r() * 60, 40 + r() * 30, 8, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#5a3e2c'; g.strokeStyle = OUT; g.lineWidth = 2;
      const px = cx + r() * 140, py = 650 + r() * 40;
      g.beginPath(); g.ellipse(px, py, 8 + r() * 10, 5 + r() * 4, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    });
  }

  // Primeiro plano (desenhado à frente dos personagens): escoras esparsas
  function s2Fg(g, x0, x1) {
    cells(x0, x1, 1300, 67, (cx) => {
      const x = cx + 600;
      g.fillStyle = '#3e2a1c'; g.fillRect(x, 0, 48, H);
      g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(x, -4, 48, H + 8);
      g.fillStyle = 'rgba(255,190,120,0.15)'; g.fillRect(x + 6, 0, 8, H);
    });
  }

  // =============================================================== FASE 3 — Usina de Energia
  const S3_HALL = 2600, S3_CORE = 5750;

  // Torre de transmissão em treliça (silhueta).
  function pylon(g, x, base, h, col, lw) {
    const w = h * 0.32;
    g.strokeStyle = col; g.lineWidth = lw;
    g.beginPath();
    g.moveTo(x - w / 2, base); g.lineTo(x - w * 0.12, base - h); g.lineTo(x + w * 0.12, base - h); g.lineTo(x + w / 2, base);
    for (let k = 1; k < 6; k++) {
      const y = base - h * k / 6, hw = w / 2 - (w / 2 - w * 0.12) * k / 6, y2 = base - h * (k - 1) / 6, hw2 = w / 2 - (w / 2 - w * 0.12) * (k - 1) / 6;
      g.moveTo(x - hw, y); g.lineTo(x + hw2, y2); g.moveTo(x + hw, y); g.lineTo(x - hw2, y2); g.moveTo(x - hw, y); g.lineTo(x + hw, y);
    }
    // braços com isoladores
    for (const [yy, ww] of [[0.78, 0.9], [0.62, 0.75]]) { g.moveTo(x - w * ww, base - h * yy); g.lineTo(x + w * ww, base - h * yy); }
    g.stroke();
  }

  function s3Far(g, x0, x1) {
    const sky = g.createLinearGradient(0, 0, 0, 420);
    sky.addColorStop(0, '#060818'); sky.addColorStop(0.5, '#141a44'); sky.addColorStop(0.85, '#2c2a5e'); sky.addColorStop(1, '#4b3a6a');
    g.fillStyle = sky; g.fillRect(x0, 0, x1 - x0, H);
    cells(x0, x1, 70, 71, (cx, r) => {
      g.fillStyle = 'rgba(220,230,255,' + (0.25 + r() * 0.6) + ')';
      const s = r() > 0.85 ? 3 : 2; g.fillRect(cx + r() * 70, r() * 260, s, s);
    });
    // lua
    const mx = 980, my = 110;
    if (x1 > mx - 160 && x0 < mx + 160) {
      const gl = g.createRadialGradient(mx, my, 20, mx, my, 150);
      gl.addColorStop(0, 'rgba(200,230,255,0.35)'); gl.addColorStop(1, 'rgba(120,160,255,0)');
      g.fillStyle = gl; g.fillRect(mx - 160, my - 160, 320, 320);
      g.beginPath(); g.arc(mx, my, 44, 0, Math.PI * 2); g.fillStyle = '#e8f0ff'; g.fill();
      g.fillStyle = 'rgba(160,180,220,0.45)'; g.beginPath(); g.arc(mx - 12, my - 8, 9, 0, Math.PI * 2); g.arc(mx + 14, my + 12, 6, 0, Math.PI * 2); g.fill();
    }
    // brilho da cidade no horizonte
    const hz = g.createLinearGradient(0, 300, 0, 420);
    hz.addColorStop(0, 'rgba(90,200,255,0)'); hz.addColorStop(1, 'rgba(90,200,255,0.18)');
    g.fillStyle = hz; g.fillRect(x0, 300, x1 - x0, 120);
    // torres de resfriamento ao longe
    cells(x0, x1, 520, 73, (cx, r) => {
      const x = cx + r() * 200, w = 90 + r() * 50, h = 120 + r() * 60, base = 420;
      g.fillStyle = '#1b1d3e';
      g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + w * 0.22, base - h * 0.55, x + w * 0.12, base - h); g.lineTo(x + w * 0.88, base - h); g.quadraticCurveTo(x + w * 0.78, base - h * 0.55, x + w, base); g.closePath(); g.fill();
      g.fillStyle = 'rgba(180,200,255,0.12)';
      for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + w / 2 + k * 14, base - h - 16 - k * 22, 30 + k * 10, 12 + k * 4, 0, 0, Math.PI * 2); g.fill(); } // vapor
      g.fillStyle = '#ff3a3a'; g.fillRect(x + w / 2 - 2, base - h - 4, 4, 4);
    });
    // linhas de transmissão ao longe
    cells(x0, x1, 300, 75, (cx) => pylon(g, cx + 150, 420, 130, '#232650', 2.5));
    g.strokeStyle = '#2a2d5a'; g.lineWidth = 1.5;
    for (const yy of [318, 339]) {
      g.beginPath();
      for (let x = Math.floor(x0 / 300) * 300 + 150 - 300; x < x1 + 300; x += 300) { g.moveTo(x, yy); g.quadraticCurveTo(x + 150, yy + 26, x + 300, yy); }
      g.stroke();
    }
    g.fillStyle = '#10122a'; g.fillRect(x0, 420, x1 - x0, H - 420);
  }

  function s3Mid(g, x0, x1) {
    // prédios da usina: galpões de turbinas, chaminés e canos
    cells(x0, x1, 420, 81, (cx, r) => {
      const x = cx + r() * 60, w = 240 + r() * 100, h = 150 + r() * 90, base = 470;
      g.fillStyle = '#1e2448'; g.fillRect(x, base - h, w, h);
      g.fillStyle = '#262e5a'; g.fillRect(x, base - h, w, 14);
      // janelas com luz ciano/amarela
      for (let wy = base - h + 30; wy < base - 30; wy += 34) for (let wx = x + 16; wx < x + w - 30; wx += 40) {
        const on = r();
        g.fillStyle = on > 0.7 ? 'rgba(255,214,90,0.75)' : on > 0.4 ? 'rgba(90,220,255,0.6)' : 'rgba(40,50,90,0.9)';
        g.fillRect(wx, wy, 22, 14);
      }
      // chaminé
      if (r() > 0.4) {
        const chx = x + w * 0.7, ch = 120 + r() * 80;
        g.fillStyle = '#1a1f3d'; g.fillRect(chx, base - h - ch, 26, ch);
        g.fillStyle = '#c83a3a'; g.fillRect(chx, base - h - ch + 10, 26, 8); g.fillRect(chx, base - h - ch + 40, 26, 8);
      }
    });
    // canos grossos horizontais
    g.fillStyle = '#2b335f'; g.fillRect(x0, 380, x1 - x0, 18);
    g.fillStyle = '#3c4780'; g.fillRect(x0, 382, x1 - x0, 4);
    cells(x0, x1, 210, 83, (cx) => { g.fillStyle = '#20264a'; g.fillRect(cx, 376, 14, 26); });
    // torres de transmissão médias com cabos
    cells(x0, x1, 640, 85, (cx) => pylon(g, cx + 320, 470, 230, '#14183a', 4));
    g.strokeStyle = '#0e1130'; g.lineWidth = 2.5;
    for (const yy of [290, 326]) {
      g.beginPath();
      for (let x = Math.floor(x0 / 640) * 640 + 320 - 640; x < x1 + 640; x += 640) { g.moveTo(x, yy); g.quadraticCurveTo(x + 320, yy + 50, x + 640, yy); }
      g.stroke();
    }
  }

  // Painel de alta tensão com placa de perigo.
  function hvPanel(g, x, y, w, h) {
    g.fillStyle = '#5a6278'; g.strokeStyle = OUT; g.lineWidth = 4;
    g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
    g.fillStyle = '#6c7590'; g.fillRect(x + 6, y + 6, w - 12, 10);
    g.strokeStyle = '#3e4558'; g.lineWidth = 2;
    for (let k = x + 14; k < x + w - 10; k += 14) { g.beginPath(); g.moveTo(k, y + h - 34); g.lineTo(k, y + h - 12); g.stroke(); } // grade
    // placa triangular
    const cx = x + w / 2, cy = y + h * 0.42, s = Math.min(w, h) * 0.26;
    g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 1.1, cy + s * 0.75); g.lineTo(cx - s * 1.1, cy + s * 0.75); g.closePath();
    g.fillStyle = '#f2c12e'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
    g.fillStyle = OUT; g.beginPath(); // raio
    g.moveTo(cx + s * 0.1, cy - s * 0.6); g.lineTo(cx - s * 0.3, cy + s * 0.1); g.lineTo(cx, cy + s * 0.1); g.lineTo(cx - s * 0.12, cy + s * 0.65); g.lineTo(cx + s * 0.32, cy - s * 0.05); g.lineTo(cx + s * 0.02, cy - s * 0.05); g.closePath(); g.fill();
    // luzinhas
    g.fillStyle = '#4cff9a'; g.fillRect(x + 10, y + h - 8, 6, 4); g.fillStyle = '#ff4a3a'; g.fillRect(x + 20, y + h - 8, 6, 4);
  }

  // Turbina gigante embutida na parede do galpão.
  function turbine(g, cx, cy, R) {
    g.fillStyle = '#2a3150'; g.strokeStyle = OUT; g.lineWidth = 5;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#3a4470'; g.beginPath(); g.arc(cx, cy, R * 0.86, 0, Math.PI * 2); g.fill();
    const gl = g.createRadialGradient(cx, cy, 4, cx, cy, R * 0.8);
    gl.addColorStop(0, 'rgba(120,240,255,0.9)'); gl.addColorStop(0.3, 'rgba(60,180,255,0.45)'); gl.addColorStop(1, 'rgba(30,60,140,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(cx, cy, R * 0.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#20263f'; g.strokeStyle = OUT; g.lineWidth = 3;
    for (let k = 0; k < 6; k++) { // pás
      const a = k * Math.PI / 3 + 0.3;
      g.beginPath(); g.moveTo(cx, cy);
      g.quadraticCurveTo(cx + Math.cos(a - 0.4) * R * 0.5, cy + Math.sin(a - 0.4) * R * 0.5, cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8);
      g.quadraticCurveTo(cx + Math.cos(a + 0.25) * R * 0.45, cy + Math.sin(a + 0.25) * R * 0.45, cx, cy);
      g.fill(); g.stroke();
    }
    g.fillStyle = '#c9d2e8'; g.beginPath(); g.arc(cx, cy, R * 0.14, 0, Math.PI * 2); g.fill(); g.stroke();
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g.fillStyle = '#8590b0'; g.beginPath(); g.arc(cx + Math.cos(a) * R * 0.93, cy + Math.sin(a) * R * 0.93, 3.5, 0, Math.PI * 2); g.fill(); }
  }

  // Bobina de Tesla (núcleo da usina).
  function coil(g, x, base) {
    g.fillStyle = '#3b4262'; g.strokeStyle = OUT; g.lineWidth = 4;
    g.fillRect(x - 40, base - 40, 80, 40); g.strokeRect(x - 40, base - 40, 80, 40);
    g.fillStyle = '#b87333';
    for (let y = base - 230; y < base - 40; y += 12) { g.fillRect(x - 22, y, 44, 8); }
    g.strokeRect(x - 22, base - 232, 44, 192);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x - 18, base - 232, 8, 192);
    g.beginPath(); g.ellipse(x, base - 250, 56, 22, 0, 0, Math.PI * 2); g.fillStyle = '#c9d2e8'; g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.ellipse(x - 14, base - 256, 22, 7, 0, 0, Math.PI * 2); g.fill();
    const gl = g.createRadialGradient(x, base - 250, 10, x, base - 250, 140);
    gl.addColorStop(0, 'rgba(120,240,255,0.35)'); gl.addColorStop(1, 'rgba(120,240,255,0)');
    g.fillStyle = gl; g.fillRect(x - 140, base - 390, 280, 280);
  }

  function s3Near(g, x0, x1) {
    // --- pátio externo: cerca, transformadores e painéis
    if (x0 < S3_HALL) clipX(g, x0, Math.min(x1, S3_HALL), () => {
      g.fillStyle = '#161a36'; g.fillRect(x0, 330, x1 - x0, FT - 330);
      // cerca de arame
      g.strokeStyle = 'rgba(150,170,220,0.35)'; g.lineWidth = 1.5;
      for (let x = Math.floor(x0 / 18) * 18 - 200; x < x1 + 200; x += 18) { g.beginPath(); g.moveTo(x, 300); g.lineTo(x + 130, FT - 20); g.moveTo(x + 130, 300); g.lineTo(x, FT - 20); g.stroke(); }
      cells(x0, x1, 160, 91, (cx) => { g.fillStyle = '#4a5270'; g.fillRect(cx, 290, 8, FT - 300); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(cx, 290, 8, FT - 300); });
      g.strokeStyle = '#8c95b5'; g.lineWidth = 2;
      for (let x = Math.floor(x0 / 24) * 24; x < x1; x += 24) { g.beginPath(); g.arc(x + 12, 292, 6, 0, Math.PI * 2); g.stroke(); } // arame farpado
      // transformadores e painéis
      cells(x0, x1, 560, 93, (cx, r) => {
        if (cx + 500 > S3_HALL) return;
        hvPanel(g, cx + 60, 340, 120, 120);
        const tx = cx + 260;
        g.fillStyle = '#4b5574'; g.strokeStyle = OUT; g.lineWidth = 4;
        g.fillRect(tx, 300, 170, 160); g.strokeRect(tx, 300, 170, 160);
        g.fillStyle = '#3a4260'; for (let k = tx + 12; k < tx + 160; k += 16) g.fillRect(k, 312, 8, 136); // aletas
        for (const ix of [tx + 30, tx + 85, tx + 140]) { // isoladores
          g.fillStyle = '#d9dde6'; for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(ix, 296 - k * 12, 12, 5, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); }
        }
        if (r() > 0.5) { g.fillStyle = '#f2c12e'; g.fillRect(tx + 50, 380, 70, 22); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(tx + 50, 380, 70, 22); TT.drawText(g, '13.8 kV', tx + 85, 391, 14, OUT); }
      });
    });
    // --- galpão das turbinas
    if (x1 > S3_HALL && x0 < S3_CORE) clipX(g, Math.max(x0, S3_HALL), Math.min(x1, S3_CORE), () => {
      const wall = g.createLinearGradient(0, 0, 0, FT);
      wall.addColorStop(0, '#12152c'); wall.addColorStop(1, '#262c50');
      g.fillStyle = wall; g.fillRect(x0, 0, x1 - x0, FT);
      // vigas e passarela
      g.fillStyle = '#1b2040'; for (let x = Math.floor(x0 / 260) * 260; x < x1; x += 260) g.fillRect(x, 0, 24, FT);
      g.fillStyle = '#2e3766'; g.fillRect(x0, 140, x1 - x0, 12);
      g.strokeStyle = '#3c4780'; g.lineWidth = 2;
      for (let x = Math.floor(x0 / 30) * 30; x < x1; x += 30) { g.beginPath(); g.moveTo(x, 152); g.lineTo(x, 180); g.stroke(); }
      g.beginPath(); g.moveTo(x0, 180); g.lineTo(x1, 180); g.stroke();
      // luzes de teto (amarelas)
      cells(x0, x1, 330, 95, (cx) => {
        if (cx < S3_HALL) return;
        const gl = g.createRadialGradient(cx + 160, 60, 4, cx + 160, 140, 220);
        gl.addColorStop(0, 'rgba(255,220,120,0.4)'); gl.addColorStop(1, 'rgba(255,200,90,0)');
        g.fillStyle = gl; g.fillRect(cx - 60, 40, 440, 400);
        g.fillStyle = '#ffe28a'; g.fillRect(cx + 140, 50, 40, 8);
      });
      // turbinas gigantes
      cells(x0, x1, 700, 97, (cx, r) => {
        if (cx < S3_HALL || cx + 400 > S3_CORE) return;
        turbine(g, cx + 250, 330, 120);
        hvPanel(g, cx + 450, 330, 110, 130);
        if (r() > 0.4) { g.fillStyle = '#f2c12e'; g.fillRect(cx + 430, 230, 150, 50); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(cx + 430, 230, 150, 50); TT.drawText(g, 'ALTA TENSÃO', cx + 505, 256, 20, OUT); }
      });
      // cabos grossos pendurados
      g.strokeStyle = '#0b0d1e'; g.lineWidth = 7;
      cells(x0, x1, 380, 99, (cx, r) => {
        if (cx < S3_HALL) return;
        g.beginPath(); g.moveTo(cx, 160); g.quadraticCurveTo(cx + 190, 250 + r() * 60, cx + 380, 160); g.stroke();
      });
    });
    // --- núcleo do reator (arena do Overload)
    if (x1 > S3_CORE) clipX(g, Math.max(x0, S3_CORE), x1, () => {
      const wall = g.createLinearGradient(0, 0, 0, FT);
      wall.addColorStop(0, '#0a0c1c'); wall.addColorStop(1, '#1b2448');
      g.fillStyle = wall; g.fillRect(x0, 0, x1 - x0, FT);
      // grade hexagonal ciano na parede
      g.strokeStyle = 'rgba(80,220,255,0.14)'; g.lineWidth = 2;
      for (let y = 60; y < FT; y += 40) for (let x = Math.floor(x0 / 46) * 46 + ((y / 40) % 2) * 23; x < x1 + 46; x += 46) {
        g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); } g.closePath(); g.stroke();
      }
      cells(x0, x1, 400, 101, (cx) => { if (cx >= S3_CORE - 100) coil(g, cx + 200, FT - 2); });
      g.fillStyle = '#f2c12e'; g.fillRect(Math.max(x0, S3_CORE), 40, x1, 8);
    });
    // borda entre pátio e galpão
    if (x0 < S3_HALL + 30 && x1 > S3_HALL - 30) {
      g.fillStyle = '#3a4370'; g.fillRect(S3_HALL - 16, 0, 32, FT);
      g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(S3_HALL - 16, -4, 32, FT + 4);
    }
    // piso metálico com chapas, grade e faixas de perigo
    const fl = g.createLinearGradient(0, FT, 0, H);
    fl.addColorStop(0, '#4a536e'); fl.addColorStop(0.5, '#363d56'); fl.addColorStop(1, '#232838');
    g.fillStyle = fl; g.fillRect(x0, FT, x1 - x0, H - FT);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x0, FT, x1 - x0, 8);
    for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) { // faixa amarela e preta
      g.fillStyle = (x / 40) % 2 ? '#f2c12e' : '#1c1a1e';
      g.beginPath(); g.moveTo(x, FT + 8); g.lineTo(x + 20, FT + 8); g.lineTo(x + 40, FT + 20); g.lineTo(x + 20, FT + 20); g.fill();
    }
    g.strokeStyle = 'rgba(20,24,40,0.55)'; g.lineWidth = 2;
    for (const y of [540, 610, 680]) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    for (let x = Math.floor(x0 / 160) * 160; x < x1 + 160; x += 160) { g.beginPath(); g.moveTo(x, FT + 20); g.lineTo(x - 60, H); g.stroke(); }
    cells(x0, x1, 160, 103, (cx, r) => {
      g.fillStyle = 'rgba(140,160,210,0.35)';
      for (const [px, py] of [[cx + 12, 548], [cx + 140, 548], [cx + 12, 602], [cx + 140, 602]]) g.fillRect(px, py, 4, 4); // rebites
      if (r() > 0.55) { // grade de ventilação com luz ciano
        const gx = cx + 40 + r() * 60, gy = 560 + r() * 80;
        g.fillStyle = '#1a1e2e'; g.fillRect(gx, gy, 70, 26);
        g.fillStyle = 'rgba(90,220,255,0.35)'; for (let k = 0; k < 5; k++) g.fillRect(gx + 4 + k * 13, gy + 4, 8, 18);
        g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(gx, gy, 70, 26);
      }
      if (r() > 0.6) { // cabo no chão
        g.strokeStyle = '#111422'; g.lineWidth = 6;
        g.beginPath(); g.moveTo(cx, 650 + r() * 30); g.bezierCurveTo(cx + 50, 630, cx + 100, 690, cx + 160, 660); g.stroke();
      }
    });
  }

  // Primeiro plano: colunas de cano e cabos pendurados
  function s3Fg(g, x0, x1) {
    cells(x0, x1, 1400, 107, (cx) => {
      const x = cx + 700;
      g.fillStyle = '#1e2440'; g.fillRect(x, 0, 44, H);
      g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(x, -4, 44, H + 8);
      g.fillStyle = 'rgba(90,220,255,0.18)'; g.fillRect(x + 6, 0, 6, H);
      g.fillStyle = '#f2c12e'; for (let y = 120; y < H; y += 220) g.fillRect(x - 4, y, 52, 12);
    });
  }

  // =============================================================== FASE 4 — Fábrica de Gosma
  // Tudo dentro da fábrica, iluminada pelas clarabóias: azulejos verde-água, gosma rosa por toda parte.
  const S4_MIX = 2700, S4_LAB = 5850;
  const GOO = '#e0569f', GOO_D = '#a8317a', GOO_L = '#ff9ccf', TEAL = '#5fb8a8', TEAL_D = '#3e8a80';

  // Gosma escorrendo de uma borda (pingos arredondados).
  function drips(g, x0, x1, y, r, maxL) {
    g.fillStyle = GOO;
    g.fillRect(x0, y - 6, x1 - x0, 10);
    for (let x = x0 + 8; x < x1 - 8; x += 18 + r() * 26) {
      const l = 8 + r() * maxL, w = 6 + r() * 6;
      g.fillRect(x - w / 2, y, w, l);
      g.beginPath(); g.arc(x, y + l, w * 0.75, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(255,220,240,0.6)'; g.fillRect(x0, y - 4, x1 - x0, 2);
  }

  // Pote de gosma na esteira.
  function jar(g, x, base, col) {
    g.fillStyle = 'rgba(230,250,255,0.55)'; g.strokeStyle = OUT; g.lineWidth = 2.5;
    g.fillRect(x - 14, base - 34, 28, 34); g.strokeRect(x - 14, base - 34, 28, 34);
    g.fillStyle = col; g.fillRect(x - 12, base - 22, 24, 21);
    g.fillStyle = '#d83a3a'; g.fillRect(x - 15, base - 42, 30, 9); g.strokeRect(x - 15, base - 42, 30, 9);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(x - 10, base - 31, 4, 26);
  }

  // Tanque misturador de vidro com pás girando a gosma.
  function mixer(g, cx, base, r) {
    const w = 210, top = 150;
    g.fillStyle = '#c9d6dc'; g.strokeStyle = OUT; g.lineWidth = 5;
    g.fillRect(cx - w / 2 - 14, base - 46, w + 28, 46); g.strokeRect(cx - w / 2 - 14, base - 46, w + 28, 46);
    g.fillRect(cx - w / 2 - 14, top - 26, w + 28, 30); g.strokeRect(cx - w / 2 - 14, top - 26, w + 28, 30);
    // vidro com gosma em espiral
    g.fillStyle = 'rgba(210,240,255,0.25)'; g.fillRect(cx - w / 2, top + 4, w, base - 50 - top);
    const lv = top + 60 + r() * 40;
    const gr = g.createLinearGradient(0, lv, 0, base - 46);
    gr.addColorStop(0, GOO_L); gr.addColorStop(1, GOO_D);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(cx - w / 2, lv + 10);
    for (let k = 0; k <= 8; k++) g.quadraticCurveTo(cx - w / 2 + k * w / 8 - w / 16, lv + (k % 2 ? -10 : 14), cx - w / 2 + k * w / 8, lv + 6);
    g.lineTo(cx + w / 2, base - 46); g.lineTo(cx - w / 2, base - 46); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,220,240,0.6)'; g.lineWidth = 4;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(cx, lv + 60 + k * 60, 70 - k * 10, 14, 0, 0.2, Math.PI - 0.2); g.stroke(); }
    // eixo e pás do misturador
    g.fillStyle = '#7d8a94'; g.fillRect(cx - 5, top + 4, 10, base - 120 - top);
    g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(cx - 5, top + 4, 10, base - 120 - top);
    g.fillStyle = '#7d8a94'; g.fillRect(cx - 60, base - 128, 120, 10); g.strokeRect(cx - 60, base - 128, 120, 10);
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx - w / 2 + 14, top + 12); g.lineTo(cx - w / 2 + 14, base - 60); g.stroke(); // reflexo
    g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - w / 2, top + 4); g.lineTo(cx - w / 2, base - 46); g.moveTo(cx + w / 2, top + 4); g.lineTo(cx + w / 2, base - 46); g.stroke();
    // motor em cima e mostrador
    g.fillStyle = '#3e4a54'; g.fillRect(cx - 30, top - 64, 60, 40); g.strokeRect(cx - 30, top - 64, 60, 40);
    g.fillStyle = '#4cff9a'; g.fillRect(cx - 20, top - 54, 10, 8); g.fillStyle = '#ffd23a'; g.fillRect(cx - 4, top - 54, 10, 8);
    drips(g, cx - w / 2 - 14, cx - w / 2 + 50, top + 4, r, 40);
  }

  function s4Far(g, x0, x1) {
    // parede alta da fábrica com clarabóias de fim de tarde
    const wall = g.createLinearGradient(0, 0, 0, 440);
    wall.addColorStop(0, '#2c5452'); wall.addColorStop(1, '#3f7a72');
    g.fillStyle = wall; g.fillRect(x0, 0, x1 - x0, H);
    cells(x0, x1, 300, 111, (cx) => {
      const sx = cx + 60, sw = 180;
      const sky = g.createLinearGradient(0, 20, 0, 200);
      sky.addColorStop(0, '#ffb36b'); sky.addColorStop(1, '#ffe2a6');
      g.fillStyle = sky; g.fillRect(sx, 24, sw, 170);
      g.strokeStyle = '#1f3c3a'; g.lineWidth = 6; g.strokeRect(sx, 24, sw, 170);
      g.lineWidth = 3; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(sx + k * sw / 4, 24); g.lineTo(sx + k * sw / 4, 194); g.stroke(); }
      g.beginPath(); g.moveTo(sx, 110); g.lineTo(sx + sw, 110); g.stroke();
      // fachos de luz entrando
      g.fillStyle = 'rgba(255,230,170,0.09)';
      g.beginPath(); g.moveTo(sx, 194); g.lineTo(sx + sw, 194); g.lineTo(sx + sw + 140, 440); g.lineTo(sx + 100, 440); g.closePath(); g.fill();
    });
    // silos de gosma ao fundo
    cells(x0, x1, 520, 113, (cx, r) => {
      const x = cx + 80 + r() * 200, w = 110 + r() * 40, h = 190 + r() * 60, base = 440;
      g.fillStyle = '#27494a'; g.fillRect(x, base - h, w, h);
      g.beginPath(); g.ellipse(x + w / 2, base - h, w / 2, 16, 0, Math.PI, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(224,86,159,0.55)'; g.fillRect(x + w * 0.42, base - h + 20, w * 0.16, h - 30); // visor rosa
      g.fillStyle = '#1f3c3a'; for (let y = base - h + 30; y < base; y += 40) g.fillRect(x, y, w, 4);
    });
    g.fillStyle = '#224241'; g.fillRect(x0, 440, x1 - x0, H - 440);
  }

  function s4Mid(g, x0, x1) {
    // passarelas com corrimão e tubos transparentes cheios de gosma
    g.fillStyle = '#2f5e5a'; g.fillRect(x0, 250, x1 - x0, 12);
    g.strokeStyle = '#2f5e5a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x0, 222); g.lineTo(x1, 222); g.stroke();
    for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) { g.beginPath(); g.moveTo(x, 222); g.lineTo(x, 250); g.stroke(); }
    cells(x0, x1, 340, 121, (cx, r) => {
      const y = 300 + r() * 60;
      g.fillStyle = 'rgba(200,240,240,0.35)'; g.fillRect(cx - 10, y, 360, 26);
      g.fillStyle = 'rgba(224,86,159,0.8)'; g.fillRect(cx - 10, y + 10, 360, 14);
      g.fillStyle = 'rgba(255,200,230,0.7)';
      for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(cx + r() * 340, y + 16, 3 + r() * 3, 0, Math.PI * 2); g.fill(); } // bolhas
      g.fillStyle = '#2f5e5a'; g.fillRect(cx + 150, y - 4, 14, 34);
    });
    cells(x0, x1, 600, 123, (cx, r) => { // engrenagens grandes na parede
      const gx = cx + 300, gy = 380 + r() * 30, R = 46 + r() * 20;
      g.fillStyle = '#2f5e5a';
      g.beginPath(); for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, rr = k % 2 ? R : R + 10; g.lineTo(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr); } g.closePath(); g.fill();
      g.fillStyle = '#3f7a72'; g.beginPath(); g.arc(gx, gy, R * 0.35, 0, Math.PI * 2); g.fill();
    });
  }

  function s4Near(g, x0, x1) {
    // parede de azulejos verde-água em todas as áreas
    g.fillStyle = TEAL; g.fillRect(x0, 0, x1 - x0, FT);
    g.strokeStyle = TEAL_D; g.lineWidth = 2;
    for (let y = 20; y < FT; y += 34) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    for (let y = 20, row = 0; y < FT; y += 34, row++) for (let x = Math.floor(x0 / 34) * 34 + (row % 2) * 17; x < x1; x += 34) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 34); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0, 0, x1 - x0, 60);
    g.fillStyle = '#2f5e5a'; g.fillRect(x0, FT - 70, x1 - x0, 70); // rodapé escuro
    // --- linha de envase: esteiras com potes de gosma
    if (x0 < S4_MIX) clipX(g, x0, Math.min(x1, S4_MIX), () => {
      cells(x0, x1, 560, 131, (cx, r) => {
        if (cx + 520 > S4_MIX) return;
        const by = 380, bx = cx + 30, bw = 470;
        // bico dosador soltando gosma
        g.fillStyle = '#c9d6dc'; g.strokeStyle = OUT; g.lineWidth = 4;
        g.fillRect(bx + 170, 170, 90, 80); g.strokeRect(bx + 170, 170, 90, 80);
        g.beginPath(); g.moveTo(bx + 190, 250); g.lineTo(bx + 240, 250); g.lineTo(bx + 222, 290); g.lineTo(bx + 208, 290); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = GOO; g.fillRect(bx + 211, 290, 8, by - 330);
        g.fillStyle = '#d83a3a'; g.fillRect(bx + 182, 190, 66, 22); g.strokeRect(bx + 182, 190, 66, 22);
        TT.drawText(g, 'GOSMA', bx + 215, 202, 15, '#ffffff');
        // esteira
        g.fillStyle = '#3e4a54'; g.fillRect(bx, by, bw, 22); g.strokeRect(bx, by, bw, 22);
        g.fillStyle = '#5c6a76'; for (let k = bx + 8; k < bx + bw; k += 22) { g.beginPath(); g.arc(k, by + 11, 7, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = '#2f3a42'; for (const lx of [bx + 20, bx + bw - 34]) { g.fillRect(lx, by + 22, 14, FT - by - 26); g.strokeRect(lx, by + 22, 14, FT - by - 26); }
        for (let k = 0; k < 6; k++) jar(g, bx + 40 + k * 74, by, k % 3 === 2 ? '#8cff4a' : GOO);
        // caixas prontas empilhadas
        const kx = cx + 520 - 20;
        if (r() > 0.4 && kx + 60 < S4_MIX) {
          g.fillStyle = '#c99a5b'; g.strokeStyle = OUT; g.lineWidth = 3;
          for (const [ox, oy] of [[0, 0], [62, 0], [30, -50]]) { g.fillRect(kx + ox, FT - 54 + oy, 58, 50); g.strokeRect(kx + ox, FT - 54 + oy, 58, 50); }
        }
      });
      drips(g, x0, Math.min(x1, S4_MIX), 60, TT.seeded(Math.floor(x0) + 7), 50);
    });
    // --- salão dos misturadores
    if (x1 > S4_MIX && x0 < S4_LAB) clipX(g, Math.max(x0, S4_MIX), Math.min(x1, S4_LAB), () => {
      cells(x0, x1, 480, 141, (cx, r) => {
        if (cx < S4_MIX - 100 || cx + 380 > S4_LAB) return;
        mixer(g, cx + 200, FT - 6, r);
        // painel de controle
        const px = cx + 340;
        g.fillStyle = '#c9d6dc'; g.strokeStyle = OUT; g.lineWidth = 3;
        g.fillRect(px, 300, 90, 140); g.strokeRect(px, 300, 90, 140);
        g.fillStyle = '#222b30'; g.fillRect(px + 10, 312, 70, 44);
        g.strokeStyle = '#8cff4a'; g.lineWidth = 2; g.beginPath(); for (let k = 0; k <= 10; k++) g.lineTo(px + 12 + k * 6.6, 334 + Math.sin(k * 1.3 + r() * 3) * 12); g.stroke();
        for (let k = 0; k < 3; k++) { g.fillStyle = ['#d83a3a', '#ffd23a', '#4cff9a'][k]; g.beginPath(); g.arc(px + 22 + k * 23, 380, 7, 0, Math.PI * 2); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); }
      });
      // tubos rosa no teto ligando os tanques
      g.fillStyle = 'rgba(200,240,240,0.5)'; g.fillRect(x0, 70, x1 - x0, 30);
      g.fillStyle = GOO; g.fillRect(x0, 82, x1 - x0, 16);
      g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(x0 - 4, 70, x1 - x0 + 8, 30);
    });
    // --- câmara de contenção do Plasmus: tanque gigante estourado
    if (x1 > S4_LAB) clipX(g, Math.max(x0, S4_LAB), x1, () => {
      g.fillStyle = 'rgba(80,20,60,0.35)'; g.fillRect(x0, 0, x1 - x0, FT); // luz de alarme rosada
      cells(x0, x1, 620, 151, (cx, r) => {
        if (cx < S4_LAB - 200) return;
        const tx = cx + 180, tw = 220, top = 110;
        g.fillStyle = '#c9d6dc'; g.strokeStyle = OUT; g.lineWidth = 5;
        g.fillRect(tx - 16, FT - 52, tw + 32, 48); g.strokeRect(tx - 16, FT - 52, tw + 32, 48);
        g.fillRect(tx - 16, top - 34, tw + 32, 38); g.strokeRect(tx - 16, top - 34, tw + 32, 38);
        g.fillStyle = 'rgba(224,86,159,0.25)'; g.fillRect(tx, top + 4, tw, FT - 56 - top);
        g.fillStyle = GOO_D; g.fillRect(tx, FT - 120, tw, 68);
        // buraco estourado no vidro com gosma escorrendo para fora
        g.fillStyle = TEAL; g.beginPath();
        g.moveTo(tx + 50, top + 120); g.lineTo(tx + 90, top + 80); g.lineTo(tx + 120, top + 110); g.lineTo(tx + 170, top + 70); g.lineTo(tx + 160, top + 160); g.lineTo(tx + 190, top + 210); g.lineTo(tx + 110, top + 230); g.lineTo(tx + 60, top + 200); g.closePath();
        g.globalAlpha = 0.5; g.fill(); g.globalAlpha = 1;
        g.strokeStyle = 'rgba(240,250,255,0.9)'; g.lineWidth = 3; g.stroke();
        g.fillStyle = GOO; g.beginPath(); g.moveTo(tx + 110, top + 230); g.quadraticCurveTo(tx + 120, FT - 40, tx + 60, FT + 30); g.lineTo(tx + 170, FT + 30); g.quadraticCurveTo(tx + 140, FT - 40, tx + 150, top + 225); g.closePath(); g.fill();
        g.strokeStyle = OUT; g.lineWidth = 5; g.beginPath(); g.moveTo(tx, top + 4); g.lineTo(tx, FT - 52); g.moveTo(tx + tw, top + 4); g.lineTo(tx + tw, FT - 52); g.stroke();
        // sirene giratória
        g.fillStyle = '#d83a3a'; g.beginPath(); g.arc(cx + 500, 60, 20, Math.PI, Math.PI * 2); g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
        const gl = g.createRadialGradient(cx + 500, 60, 4, cx + 500, 60, 150);
        gl.addColorStop(0, 'rgba(255,80,80,0.4)'); gl.addColorStop(1, 'rgba(255,80,80,0)');
        g.fillStyle = gl; g.fillRect(cx + 350, -90, 300, 300);
        if (r() > 0.3) { g.fillStyle = '#d83a3a'; g.fillRect(cx + 430, 110, 150, 40); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(cx + 430, 110, 150, 40); TT.drawText(g, 'CONTENÇÃO', cx + 505, 131, 18, '#ffffff'); }
      });
      drips(g, Math.max(x0, S4_LAB), x1, 30, TT.seeded(Math.floor(x0) + 11), 90);
    });
    // portas de correr entre as áreas
    for (const bx of [S4_MIX, S4_LAB]) if (x0 < bx + 40 && x1 > bx - 40) {
      g.fillStyle = '#c9d6dc'; g.fillRect(bx - 24, 0, 48, FT);
      g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(bx - 24, -4, 48, FT + 4);
      g.fillStyle = GOO; g.fillRect(bx - 24, 0, 48, 40); g.fillRect(bx - 8, 40, 12, 60);
    }
    // piso quadriculado branco e verde-água coberto de gosma
    for (let y = FT, row = 0; y < H; y += 32, row++) {
      for (let x = Math.floor(x0 / 48) * 48; x < x1; x += 48) {
        g.fillStyle = ((x / 48) + row) % 2 ? '#dfeeea' : '#9fd1c6';
        g.fillRect(x, y, 48, 32);
      }
    }
    const shade = g.createLinearGradient(0, FT, 0, H);
    shade.addColorStop(0, 'rgba(20,50,50,0.35)'); shade.addColorStop(1, 'rgba(20,50,50,0.05)');
    g.fillStyle = shade; g.fillRect(x0, FT, x1 - x0, H - FT);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0, FT, x1 - x0, 6);
    cells(x0, x1, 190, 161, (cx, r) => {
      if (r() > 0.35) { // poça de gosma brilhante
        const px = cx + r() * 140, py = 520 + r() * 170, rx = 34 + r() * 50;
        g.fillStyle = GOO_D; g.beginPath(); g.ellipse(px, py + 3, rx, rx * 0.3, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = GOO; g.beginPath(); g.ellipse(px, py, rx * 0.95, rx * 0.27, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,230,245,0.75)'; g.beginPath(); g.ellipse(px - rx * 0.35, py - 3, rx * 0.25, 3, 0, 0, Math.PI * 2); g.fill();
      }
      if (r() > 0.6) { g.fillStyle = '#4a6a66'; g.beginPath(); g.arc(cx + r() * 180, 600 + r() * 80, 11, 0, Math.PI * 2); g.fill(); } // ralo
    });
  }

  // Primeiro plano: cano rosa vertical pingando gosma
  function s4Fg(g, x0, x1) {
    cells(x0, x1, 1500, 171, (cx, r) => {
      const x = cx + 750;
      g.fillStyle = 'rgba(200,240,240,0.55)'; g.fillRect(x, 0, 46, H);
      g.fillStyle = GOO; g.fillRect(x + 8, 0, 30, H);
      g.fillStyle = 'rgba(255,220,240,0.6)'; g.fillRect(x + 12, 0, 6, H);
      g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(x, -4, 46, H + 8);
      g.fillStyle = '#c9d6dc'; for (let y = 140; y < H; y += 260) { g.fillRect(x - 6, y, 58, 16); g.strokeRect(x - 6, y, 58, 16); }
    });
  }

  // =============================================================== FASE 5 — Academia H.I.V.E.
  // Pátio à noite em frente ao prédio da academia, corredor de armários e salas de aula,
  // e o salão do Irmão Sangue (vermelho, com o emblema gigante).
  const S5_HALL = 2700, S5_THRONE = 5850;
  const HV_Y = '#f0c62e', HV_D = '#1e1b26', BLOOD = '#c4162a', BLOOD_D = '#6a0c1c';

  function hexPath(g, x, y, r) {
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.closePath();
  }
  // Emblema da H.I.V.E.: hexágono com "H".
  function hiveLogo(g, x, y, r, fill, letter, rim) {
    hexPath(g, x, y, r); g.fillStyle = fill; g.fill();
    g.strokeStyle = rim || OUT; g.lineWidth = Math.max(3, r * 0.1); g.stroke();
    g.font = 'bold ' + Math.round(r * 1.05) + 'px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = letter; g.fillText('H', x, y + r * 0.06);
  }

  function s5Far(g, x0, x1) {
    const sky = g.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, '#120a26'); sky.addColorStop(0.7, '#3a1a4e'); sky.addColorStop(1, '#6a2a5a');
    g.fillStyle = sky; g.fillRect(x0, 0, x1 - x0, H);
    cells(x0, x1, 90, 201, (cx, r) => { // estrelas
      g.fillStyle = 'rgba(255,240,220,' + (0.4 + r() * 0.5) + ')';
      g.fillRect(cx + r() * 90, r() * 300, 2, 2);
    });
    cells(x0, x1, 1100, 203, (cx, r) => { // lua cheia
      if (r() < 0.5) return;
      const mx = cx + 300 + r() * 400, my = 90 + r() * 50;
      const gl = g.createRadialGradient(mx, my, 20, mx, my, 140);
      gl.addColorStop(0, 'rgba(255,240,210,0.35)'); gl.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = gl; g.fillRect(mx - 140, my - 140, 280, 280);
      g.fillStyle = '#fff2d6'; g.beginPath(); g.arc(mx, my, 44, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(200,180,170,0.4)'; g.beginPath(); g.arc(mx - 12, my - 8, 9, 0, Math.PI * 2); g.arc(mx + 14, my + 12, 6, 0, Math.PI * 2); g.fill();
    });
    // morros com pinheiros (a academia fica isolada)
    g.fillStyle = '#1d1230';
    g.beginPath(); g.moveTo(x0, 440);
    for (let x = Math.floor(x0 / 40) * 40; x <= x1 + 40; x += 40) g.lineTo(x, 380 + Math.sin(x * 0.004) * 30 + Math.sin(x * 0.013) * 12);
    g.lineTo(x1, 440); g.closePath(); g.fill();
    cells(x0, x1, 46, 205, (cx, r) => {
      const x = cx + r() * 30, b = 395 + Math.sin(x * 0.004) * 30, h = 30 + r() * 30;
      g.beginPath(); g.moveTo(x, b - h); g.lineTo(x + 12, b + 4); g.lineTo(x - 12, b + 4); g.closePath(); g.fill();
    });
    g.fillStyle = '#160d24'; g.fillRect(x0, 440, x1 - x0, H - 440);
  }

  function s5Mid(g, x0, x1) {
    // prédio da academia: blocos hexagonais com janelas amarelas e o letreiro H.I.V.E.
    cells(x0, x1, 760, 211, (cx, r) => {
      const bx = cx + 60, bw = 560, top = 150 + r() * 30, base = 470;
      g.fillStyle = '#2c2440'; g.fillRect(bx, top, bw, base - top);
      g.fillStyle = '#241d36'; g.fillRect(bx, top, 40, base - top); g.fillRect(bx + bw - 40, top, 40, base - top);
      // telhado em favo de mel
      for (let k = 0; k < 7; k++) { hexPath(g, bx + 40 + k * 80, top - 4, 30); g.fillStyle = '#3a2f55'; g.fill(); }
      // janelas em hexágono, algumas acesas
      for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) {
        const wx = bx + 80 + k * 82 + (row % 2) * 30, wy = top + 60 + row * 70;
        if (wy > base - 30) continue;
        hexPath(g, wx, wy, 18); g.fillStyle = r() > 0.35 ? '#ffd86a' : '#1a1428'; g.fill();
        g.strokeStyle = '#18121f'; g.lineWidth = 3; g.stroke();
      }
      // torre central com o emblema
      const tx = bx + bw / 2;
      g.fillStyle = '#332a4a'; g.fillRect(tx - 70, top - 110, 140, 110);
      hexPath(g, tx, top - 110, 74); g.fillStyle = '#3a2f55'; g.fill();
      hiveLogo(g, tx, top - 70, 42, HV_Y, HV_D, '#18121f');
      const gl = g.createRadialGradient(tx, top - 70, 10, tx, top - 70, 140);
      gl.addColorStop(0, 'rgba(255,220,90,0.25)'); gl.addColorStop(1, 'rgba(255,220,90,0)');
      g.fillStyle = gl; g.fillRect(tx - 140, top - 210, 280, 280);
    });
  }

  function s5Near(g, x0, x1) {
    // --- pátio: muro baixo com grade, postes de luz e bandeiras da H.I.V.E.
    if (x0 < S5_HALL) clipX(g, x0, Math.min(x1, S5_HALL), () => {
      g.fillStyle = '#4a4258'; g.fillRect(x0, 400, x1 - x0, 70);
      g.fillStyle = '#5c536c'; g.fillRect(x0, 396, x1 - x0, 10);
      g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, 400); g.lineTo(x1, 400); g.stroke();
      g.strokeStyle = 'rgba(30,20,40,0.5)'; g.lineWidth = 2;
      for (let y = 420; y < 470; y += 24) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
      g.strokeStyle = '#18121f'; g.lineWidth = 4; // grade de ferro
      for (let x = Math.floor(x0 / 26) * 26; x < x1; x += 26) { g.beginPath(); g.moveTo(x, 396); g.lineTo(x, 320); g.stroke(); g.beginPath(); g.moveTo(x - 5, 326); g.lineTo(x, 314); g.lineTo(x + 5, 326); g.stroke(); }
      g.beginPath(); g.moveTo(x0, 340); g.lineTo(x1, 340); g.stroke();
      cells(x0, x1, 520, 221, (cx) => {
        const px = cx + 120;
        // poste de luz
        g.fillStyle = '#2a2433'; g.fillRect(px - 5, 250, 10, 220); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(px - 5, 250, 10, 220);
        g.fillStyle = '#ffe9a0'; hexPath(g, px, 240, 16); g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
        const gl = g.createRadialGradient(px, 240, 6, px, 240, 120);
        gl.addColorStop(0, 'rgba(255,230,150,0.4)'); gl.addColorStop(1, 'rgba(255,230,150,0)');
        g.fillStyle = gl; g.fillRect(px - 120, 120, 240, 240);
        // bandeira
        const fx = cx + 360;
        g.fillStyle = '#2a2433'; g.fillRect(fx - 3, 160, 6, 310);
        g.fillStyle = HV_D; g.fillRect(fx + 3, 170, 80, 120); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(fx + 3, 170, 80, 120);
        g.fillStyle = HV_Y; g.fillRect(fx + 3, 170, 80, 10); g.fillRect(fx + 3, 280, 80, 10);
        hiveLogo(g, fx + 43, 230, 26, HV_Y, HV_D);
      });
      // piso do pátio: lajotas hexagonais
      g.fillStyle = '#6a6078'; g.fillRect(x0, FT, x1 - x0, H - FT);
      g.strokeStyle = 'rgba(40,30,50,0.45)'; g.lineWidth = 2;
      for (let y = FT + 14, row = 0; y < H + 30; y += 30, row++) for (let x = Math.floor(x0 / 52) * 52 + (row % 2) * 26 - 52; x < x1 + 52; x += 52) {
        g.beginPath(); g.ellipse(x, y, 24, 12, 0, 0, Math.PI * 2); g.stroke();
      }
      const sh = g.createLinearGradient(0, FT, 0, H);
      sh.addColorStop(0, 'rgba(20,10,40,0.45)'); sh.addColorStop(1, 'rgba(20,10,40,0.05)');
      g.fillStyle = sh; g.fillRect(x0, FT, x1 - x0, H - FT);
    });
    // --- corredor: armários, portas de sala de aula e cartazes
    if (x1 > S5_HALL && x0 < S5_THRONE) clipX(g, Math.max(x0, S5_HALL), Math.min(x1, S5_THRONE), () => {
      const wall = g.createLinearGradient(0, 0, 0, FT);
      wall.addColorStop(0, '#2e2840'); wall.addColorStop(1, '#4a4060');
      g.fillStyle = wall; g.fillRect(x0, 0, x1 - x0, FT);
      g.fillStyle = HV_Y; g.fillRect(x0, 150, x1 - x0, 8); // faixa amarela
      g.fillStyle = HV_D; for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) g.fillRect(x, 150, 20, 8);
      cells(x0, x1, 240, 231, (cx) => { // luminárias no teto
        g.fillStyle = '#d9dde6'; g.fillRect(cx + 60, 0, 120, 14);
        const gl = g.createLinearGradient(0, 14, 0, 160);
        gl.addColorStop(0, 'rgba(255,250,220,0.18)'); gl.addColorStop(1, 'rgba(255,250,220,0)');
        g.fillStyle = gl; g.beginPath(); g.moveTo(cx + 60, 14); g.lineTo(cx + 180, 14); g.lineTo(cx + 230, 160); g.lineTo(cx + 10, 160); g.closePath(); g.fill();
      });
      const signs = ['VILANIA AVANÇADA', 'LABORATÓRIO DO MAL', 'ROBÓTICA SINISTRA', 'PLANOS MALIGNOS 101', 'DETENÇÃO'];
      cells(x0, x1, 600, 233, (cx, r, i) => {
        if (cx < S5_HALL - 100 || cx + 560 > S5_THRONE) return;
        // fileira de armários
        for (let k = 0; k < 7; k++) {
          const lx = cx + 20 + k * 44;
          g.fillStyle = k % 3 === 1 ? '#566788' : '#5b6b8a'; g.fillRect(lx, 250, 42, FT - 254);
          g.strokeStyle = OUT; g.lineWidth = 2.5; g.strokeRect(lx, 250, 42, FT - 254);
          g.fillStyle = '#4a5874'; for (let v = 0; v < 4; v++) g.fillRect(lx + 8, 264 + v * 7, 26, 3);
          g.fillStyle = '#d9dde6'; g.fillRect(lx + 32, 340, 4, 16);
          if (r() < 0.12) { g.fillStyle = '#2a2a38'; g.fillRect(lx + 2, 252, 38, FT - 258); g.fillStyle = '#7a5a9a'; g.fillRect(lx + 8, 300, 26, 30); } // armário aberto
        }
        // porta da sala com janela e placa
        const dx = cx + 360;
        g.fillStyle = '#6a4a36'; g.fillRect(dx, 230, 110, FT - 230); g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(dx, 230, 110, FT - 230);
        g.fillStyle = '#ffe9a0'; g.fillRect(dx + 25, 260, 60, 70); g.strokeRect(dx + 25, 260, 60, 70);
        g.strokeStyle = '#6a4a36'; g.lineWidth = 3; g.beginPath(); g.moveTo(dx + 55, 260); g.lineTo(dx + 55, 330); g.stroke();
        g.fillStyle = '#d9dde6'; g.beginPath(); g.arc(dx + 92, 360, 6, 0, Math.PI * 2); g.fill();
        g.fillStyle = HV_D; g.fillRect(dx - 20, 186, 150, 34); g.strokeStyle = HV_Y; g.lineWidth = 3; g.strokeRect(dx - 20, 186, 150, 34);
        TT.drawText(g, signs[((i % signs.length) + signs.length) % signs.length], dx + 55, 204, 15, HV_Y);
        // cartaz da H.I.V.E. ou do Irmão Sangue
        if (r() > 0.4) {
          g.fillStyle = r() > 0.5 ? BLOOD : HV_Y; g.fillRect(cx + 500, 200, 70, 96); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(cx + 500, 200, 70, 96);
          hiveLogo(g, cx + 535, 238, 22, HV_D, HV_Y);
          TT.drawText(g, 'OBEDEÇA', cx + 535, 280, 13, '#ffffff');
        }
      });
      // piso encerado xadrez roxo e cinza, com reflexo das luzes
      for (let y = FT, row = 0; y < H; y += 32, row++) for (let x = Math.floor(x0 / 48) * 48; x < x1; x += 48) {
        g.fillStyle = ((x / 48) + row) % 2 ? '#3e3654' : '#625a7c'; g.fillRect(x, y, 48, 32);
      }
      const sh = g.createLinearGradient(0, FT, 0, H);
      sh.addColorStop(0, 'rgba(20,10,40,0.4)'); sh.addColorStop(1, 'rgba(20,10,40,0.05)');
      g.fillStyle = sh; g.fillRect(x0, FT, x1 - x0, H - FT);
      cells(x0, x1, 240, 237, (cx) => { g.fillStyle = 'rgba(255,250,220,0.1)'; g.fillRect(cx + 70, FT + 20, 100, 8); g.fillRect(cx + 90, FT + 60, 70, 5); });
    });
    // --- salão do Irmão Sangue: cortinas vermelhas, vitrais em hexágono e o emblema gigante
    if (x1 > S5_THRONE) clipX(g, Math.max(x0, S5_THRONE), x1, () => {
      const wall = g.createLinearGradient(0, 0, 0, FT);
      wall.addColorStop(0, '#1a0a14'); wall.addColorStop(1, '#3a1222');
      g.fillStyle = wall; g.fillRect(x0, 0, x1 - x0, FT);
      cells(x0, x1, 640, 241, (cx) => {
        if (cx < S5_THRONE - 300) return;
        const ex = cx + 320;
        // vitrais vermelhos
        for (const vx of [cx + 90, cx + 550]) {
          hexPath(g, vx, 170, 56); g.fillStyle = '#7a1424'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 6; g.stroke();
          g.strokeStyle = '#2a0a12'; g.lineWidth = 3;
          for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; g.beginPath(); g.moveTo(vx + Math.cos(a) * 54, 170 + Math.sin(a) * 54); g.lineTo(vx - Math.cos(a) * 54, 170 - Math.sin(a) * 54); g.stroke(); }
          const gl = g.createRadialGradient(vx, 170, 10, vx, 170, 110);
          gl.addColorStop(0, 'rgba(255,60,80,0.35)'); gl.addColorStop(1, 'rgba(255,60,80,0)');
          g.fillStyle = gl; g.fillRect(vx - 110, 60, 220, 220);
        }
        // cortinas
        for (const [cx0, dir] of [[cx + 170, 1], [cx + 470, -1]]) {
          g.fillStyle = BLOOD; g.beginPath(); g.moveTo(cx0 - 50, 0); g.lineTo(cx0 + 50, 0);
          g.quadraticCurveTo(cx0 + 20 * dir, 250, cx0 + 40 * dir, FT); g.lineTo(cx0 - 40 * dir, FT); g.quadraticCurveTo(cx0 - 30 * dir, 250, cx0 - 50, 0); g.closePath(); g.fill();
          g.strokeStyle = BLOOD_D; g.lineWidth = 4;
          for (const o of [-24, 0, 24]) { g.beginPath(); g.moveTo(cx0 + o, 0); g.quadraticCurveTo(cx0 + o * 0.6 + 10 * dir, 250, cx0 + o * 0.4 + 20 * dir, FT); g.stroke(); }
          g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(cx0 - 50, 0); g.quadraticCurveTo(cx0 - 30 * dir, 250, cx0 - 40 * dir, FT); g.stroke();
        }
        // emblema gigante do Irmão Sangue
        const gl = g.createRadialGradient(ex, 200, 20, ex, 200, 200);
        gl.addColorStop(0, 'rgba(255,40,70,0.4)'); gl.addColorStop(1, 'rgba(255,40,70,0)');
        g.fillStyle = gl; g.fillRect(ex - 200, 0, 400, 400);
        hiveLogo(g, ex, 200, 92, BLOOD, '#1a0a14', '#ff6a7a');
        // trono no tablado
        g.fillStyle = '#2a1018'; g.fillRect(ex - 140, FT - 40, 280, 40); g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(ex - 140, FT - 40, 280, 40);
        g.fillStyle = BLOOD_D; g.beginPath(); g.moveTo(ex - 50, FT - 40); g.lineTo(ex - 50, 330); g.lineTo(ex, 300); g.lineTo(ex + 50, 330); g.lineTo(ex + 50, FT - 40); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = BLOOD; g.fillRect(ex - 38, 380, 76, 50);
      });
      // piso de pedra escura com tapete vermelho
      g.fillStyle = '#2a2030'; g.fillRect(x0, FT, x1 - x0, H - FT);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      for (let y = FT + 40; y < H; y += 46) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
      for (let x = Math.floor(x0 / 90) * 90; x < x1; x += 90) { g.beginPath(); g.moveTo(x, FT); g.lineTo(x - 30, H); g.stroke(); }
      g.fillStyle = BLOOD_D; g.fillRect(x0, 560, x1 - x0, 70);
      g.fillStyle = BLOOD; g.fillRect(x0, 566, x1 - x0, 58);
      g.fillStyle = HV_Y; g.fillRect(x0, 570, x1 - x0, 3); g.fillRect(x0, 617, x1 - x0, 3);
      const sh = g.createLinearGradient(0, FT, 0, H);
      sh.addColorStop(0, 'rgba(30,0,10,0.5)'); sh.addColorStop(1, 'rgba(30,0,10,0.1)');
      g.fillStyle = sh; g.fillRect(x0, FT, x1 - x0, H - FT);
    });
    // portas duplas entre as áreas
    for (const bx of [S5_HALL, S5_THRONE]) if (x0 < bx + 90 && x1 > bx - 90) {
      g.fillStyle = '#3a2a22'; g.fillRect(bx - 80, 120, 160, FT - 120);
      g.strokeStyle = OUT; g.lineWidth = 5; g.strokeRect(bx - 80, 120, 160, FT - 120);
      g.fillStyle = '#6a4a36'; g.fillRect(bx - 70, 150, 66, FT - 150); g.fillRect(bx + 4, 150, 66, FT - 150);
      g.lineWidth = 3; g.strokeRect(bx - 70, 150, 66, FT - 150); g.strokeRect(bx + 4, 150, 66, FT - 150);
      hiveLogo(g, bx, 120, 34, bx === S5_THRONE ? BLOOD : HV_Y, HV_D);
    }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0, FT, x1 - x0, 6);
  }

  // Primeiro plano: colunas de pedra com flâmulas da H.I.V.E.
  function s5Fg(g, x0, x1) {
    cells(x0, x1, 1500, 251, (cx) => {
      const x = cx + 750;
      g.fillStyle = '#2a2236'; g.fillRect(x, 0, 60, H);
      g.fillStyle = '#3a3048'; g.fillRect(x + 8, 0, 12, H);
      g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(x, -4, 60, H + 8);
      g.fillStyle = HV_D; g.fillRect(x + 6, 60, 48, 150); g.strokeRect(x + 6, 60, 48, 150);
      g.fillStyle = HV_Y; g.beginPath(); g.moveTo(x + 6, 210); g.lineTo(x + 30, 236); g.lineTo(x + 54, 210); g.closePath(); g.fill(); g.stroke();
      hiveLogo(g, x + 30, 130, 18, HV_Y, HV_D);
    });
  }

  // =============================================================== FASE 6 — O Show do Mumbo
  // Rua do teatro à noite (letreiro com lâmpadas), bastidores do palco e o mundo dentro da cartola.
  const S6_STAGE = 2700, S6_HAT = 5850;
  const MB = '#86aee6', PURP = '#3a1a5e', GOLD = '#f2c94a';

  function star5(g, x, y, r, col) {
    g.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = col; g.fill();
  }
  // Rostinho do Mumbo para cartazes (pele azul, nariz comprido, cartola).
  function mumboFace(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.strokeStyle = OUT; g.lineWidth = 2.5;
    g.fillStyle = MB; g.beginPath(); g.arc(0, 0, 20, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(8, -2); g.quadraticCurveTo(30, 2, 34, 10); g.quadraticCurveTo(22, 12, 10, 8); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#f2f2f6'; g.beginPath(); g.ellipse(-16, 4, 7, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = OUT; g.beginPath(); g.arc(6, -4, 2.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1c1b26'; g.fillRect(-16, -50, 32, 36); g.strokeRect(-16, -50, 32, 36);
    g.fillRect(-26, -16, 52, 6); g.strokeRect(-26, -16, 52, 6);
    g.fillStyle = '#c4162a'; g.fillRect(-16, -24, 32, 6);
    g.restore();
  }

  function s6Far(g, x0, x1) {
    const sky = g.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, '#0c0a24'); sky.addColorStop(1, '#3a2460');
    g.fillStyle = sky; g.fillRect(x0, 0, x1 - x0, H);
    cells(x0, x1, 80, 301, (cx, r) => { g.fillStyle = 'rgba(255,245,220,' + (0.3 + r() * 0.5) + ')'; g.fillRect(cx + r() * 80, r() * 260, 2, 2); });
    // holofotes do show cruzando o céu
    cells(x0, x1, 700, 303, (cx, r) => {
      const bx = cx + 200 + r() * 300, ang = -0.5 + r();
      g.fillStyle = 'rgba(255,240,180,0.08)';
      g.beginPath(); g.moveTo(bx, 440); g.lineTo(bx + Math.sin(ang) * 500 - 60, 0); g.lineTo(bx + Math.sin(ang) * 500 + 60, 0); g.closePath(); g.fill();
    });
    // silhuetas dos prédios de Jump City
    cells(x0, x1, 130, 305, (cx, r) => {
      const w = 90 + r() * 40, h = 120 + r() * 160;
      g.fillStyle = '#1a1438'; g.fillRect(cx, 440 - h, w, h);
      g.fillStyle = 'rgba(255,220,130,0.5)';
      for (let y = 450 - h; y < 430; y += 22) for (let x = cx + 10; x < cx + w - 10; x += 18) if (r() > 0.6) g.fillRect(x, y, 7, 10);
    });
    g.fillStyle = '#120e28'; g.fillRect(x0, 440, x1 - x0, H - 440);
  }

  function s6Mid(g, x0, x1) {
    cells(x0, x1, 420, 311, (cx, r) => { // prédios mais próximos com caixas d'água
      const w = 170 + r() * 80, h = 190 + r() * 90, x = cx + r() * 100;
      g.fillStyle = '#2a2050'; g.fillRect(x, 470 - h, w, h);
      g.fillStyle = '#231a44'; g.fillRect(x + w - 30, 470 - h, 30, h);
      g.fillStyle = 'rgba(255,214,120,0.6)';
      for (let y = 490 - h; y < 450; y += 30) for (let xx = x + 14; xx < x + w - 40; xx += 26) if (r() > 0.5) g.fillRect(xx, y, 12, 16);
      if (r() > 0.5) { g.fillStyle = '#1a1438'; g.fillRect(x + 30, 440 - h, 36, 30); g.fillRect(x + 34, 470 - h - 2, 4, 4); g.fillRect(x + 58, 470 - h - 2, 4, 4); }
    });
  }

  function s6Near(g, x0, x1) {
    // --- rua do teatro
    if (x0 < S6_STAGE) clipX(g, x0, Math.min(x1, S6_STAGE), () => {
      cells(x0, x1, 1300, 321, (cx) => {
        const tx = cx + 300;
        // fachada de tijolos
        g.fillStyle = '#6a2a3a'; g.fillRect(tx - 40, 120, 760, FT - 120);
        g.strokeStyle = 'rgba(40,10,20,0.45)'; g.lineWidth = 2;
        for (let y = 130, row = 0; y < FT; y += 18, row++) { g.beginPath(); g.moveTo(tx - 40, y); g.lineTo(tx + 720, y); g.stroke(); for (let x = tx - 40 + (row % 2) * 18; x < tx + 720; x += 36) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 18); g.stroke(); } }
        g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(tx - 40, 120, 760, FT - 120);
        // letreiro com lâmpadas
        g.fillStyle = '#1c1b26'; g.fillRect(tx + 60, 140, 560, 110); g.strokeRect(tx + 60, 140, 560, 110);
        g.fillStyle = GOLD; for (let x = tx + 70; x < tx + 620; x += 22) { g.beginPath(); g.arc(x, 148, 4, 0, Math.PI * 2); g.arc(x, 242, 4, 0, Math.PI * 2); g.fill(); }
        TT.drawText(g, 'MUMBO', tx + 340, 182, 52, GOLD, OUT, 'center', 6);
        TT.drawText(g, 'O MAGNÍFICO • HOJE!', tx + 340, 224, 22, '#ffffff', OUT, 'center', 4);
        const gl = g.createRadialGradient(tx + 340, 195, 30, tx + 340, 195, 360);
        gl.addColorStop(0, 'rgba(255,220,120,0.25)'); gl.addColorStop(1, 'rgba(255,220,120,0)');
        g.fillStyle = gl; g.fillRect(tx - 20, 0, 720, FT);
        // portas e cartazes do Mumbo
        g.fillStyle = '#3a1a22'; g.fillRect(tx + 250, 300, 180, FT - 300); g.strokeRect(tx + 250, 300, 180, FT - 300);
        g.fillStyle = '#c99a3a'; g.fillRect(tx + 336, 300, 8, FT - 300);
        for (const px of [tx + 90, tx + 490]) {
          g.fillStyle = PURP; g.fillRect(px, 290, 110, 150); g.strokeStyle = GOLD; g.lineWidth = 5; g.strokeRect(px, 290, 110, 150);
          mumboFace(g, px + 55, 380, 1.1);
          star5(g, px + 20, 310, 9, GOLD); star5(g, px + 92, 420, 7, GOLD);
          TT.drawText(g, 'MÁGICA!', px + 55, 425, 15, '#ffffff', OUT, 'center', 3);
        }
        // bilheteria
        g.fillStyle = '#c4162a'; g.fillRect(tx + 640, 330, 70, FT - 330); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(tx + 640, 330, 70, FT - 330);
        g.fillStyle = '#ffe9a0'; g.fillRect(tx + 652, 345, 46, 40); g.strokeRect(tx + 652, 345, 46, 40);
      });
      // muro baixo entre os prédios (para a rua não ficar vazia)
      cells(x0, x1, 1300, 323, (cx) => {
        const wx = cx + 1060, ww = 540;
        g.fillStyle = '#4a3a5a'; g.fillRect(wx, 340, ww, FT - 340);
        g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(wx, 340, ww, FT - 340);
        g.fillStyle = '#ffffff'; g.fillRect(wx + 120, 370, 90, 60); g.strokeRect(wx + 120, 370, 90, 60);
        TT.drawText(g, 'ESGOTADO', wx + 165, 400, 14, '#c4162a');
        // poste
        g.fillStyle = '#1c1b26'; g.fillRect(wx + 400, 230, 10, FT - 230);
        g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(wx + 405, 226, 14, 0, Math.PI * 2); g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
      });
      // calçada e rua
      g.fillStyle = '#7a7088'; g.fillRect(x0, FT, x1 - x0, 60);
      g.strokeStyle = 'rgba(40,30,50,0.4)'; g.lineWidth = 2;
      for (let x = Math.floor(x0 / 80) * 80; x < x1; x += 80) { g.beginPath(); g.moveTo(x, FT); g.lineTo(x - 10, FT + 60); g.stroke(); }
      g.fillStyle = '#9a90a8'; g.fillRect(x0, FT + 56, x1 - x0, 8);
      g.fillStyle = '#3a3448'; g.fillRect(x0, FT + 64, x1 - x0, H - FT - 64);
      g.fillStyle = '#e8d070'; for (let x = Math.floor(x0 / 120) * 120; x < x1; x += 120) g.fillRect(x, 650, 60, 6);
    });
    // --- bastidores e palco
    if (x1 > S6_STAGE && x0 < S6_HAT) clipX(g, Math.max(x0, S6_STAGE), Math.min(x1, S6_HAT), () => {
      g.fillStyle = '#2a1e2a'; g.fillRect(x0, 0, x1 - x0, FT);
      g.fillStyle = '#3a2a36'; for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) g.fillRect(x, 0, 8, FT); // tábuas da parede
      cells(x0, x1, 260, 331, (cx, r) => { // cordas e sacos de areia
        const x = cx + r() * 200;
        g.strokeStyle = '#c9a66a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 120 + r() * 120); g.stroke();
        if (r() > 0.5) { g.fillStyle = '#a07a4a'; g.beginPath(); g.ellipse(x, 250, 14, 20, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); }
      });
      cells(x0, x1, 640, 333, (cx, r) => {
        if (cx < S6_STAGE - 100 || cx + 600 > S6_HAT) return;
        // cortina roxa do palco ao fundo
        g.fillStyle = '#4a1f6a'; g.fillRect(cx + 20, 60, 260, FT - 60);
        g.strokeStyle = '#2e1244'; g.lineWidth = 6; for (let x = cx + 40; x < cx + 280; x += 34) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x + 4, FT); g.stroke(); }
        g.fillStyle = GOLD; g.fillRect(cx + 20, 60, 260, 16);
        // armário mágico com estrelas
        const bx = cx + 330;
        g.fillStyle = '#2c3a8a'; g.fillRect(bx, 250, 110, FT - 250); g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(bx, 250, 110, FT - 250);
        g.fillStyle = '#1e2a6a'; g.fillRect(bx + 10, 262, 90, FT - 274);
        for (const [sx, sy] of [[bx + 30, 300], [bx + 80, 340], [bx + 40, 400], [bx + 76, 430]]) star5(g, sx, sy, 10, GOLD);
        // cartas gigantes encostadas e cartola no suporte
        g.save(); g.translate(cx + 500, FT - 4); g.rotate(-0.12);
        g.fillStyle = '#f6f2e6'; g.fillRect(-40, -130, 80, 130); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(-40, -130, 80, 130);
        g.fillStyle = r() > 0.5 ? '#d0202a' : '#1a1a22'; g.font = 'bold 54px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(r() > 0.5 ? '♥' : '♠', 0, -62);
        g.restore();
        g.fillStyle = '#5a4030'; g.fillRect(cx + 572, 380, 8, FT - 380);
        TT.drawTopHat(g, cx + 576, 384, 0.8, false);
      });
      // holofotes no teto
      cells(x0, x1, 480, 337, (cx) => {
        const lx = cx + 200;
        g.fillStyle = '#1c1b26'; g.fillRect(lx - 16, 0, 32, 30);
        g.fillStyle = 'rgba(255,240,190,0.12)'; g.beginPath(); g.moveTo(lx - 14, 30); g.lineTo(lx + 14, 30); g.lineTo(lx + 120, FT); g.lineTo(lx - 120, FT); g.closePath(); g.fill();
      });
      // palco de tábuas
      g.fillStyle = '#8a5a36'; g.fillRect(x0, FT, x1 - x0, H - FT);
      g.strokeStyle = 'rgba(50,25,10,0.45)'; g.lineWidth = 2;
      for (let y = FT + 28; y < H; y += 28) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
      for (let y = FT, row = 0; y < H; y += 28, row++) for (let x = Math.floor(x0 / 160) * 160 + (row % 2) * 80; x < x1; x += 160) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 28); g.stroke(); }
      cells(x0, x1, 480, 339, (cx) => { g.fillStyle = 'rgba(255,240,190,0.14)'; g.beginPath(); g.ellipse(cx + 200, 600, 140, 40, 0, 0, Math.PI * 2); g.fill(); });
      const sh = g.createLinearGradient(0, FT, 0, H);
      sh.addColorStop(0, 'rgba(30,10,20,0.4)'); sh.addColorStop(1, 'rgba(30,10,20,0.05)');
      g.fillStyle = sh; g.fillRect(x0, FT, x1 - x0, H - FT);
    });
    // --- dentro da cartola: espiral roxa e azul, cartas e cartolas flutuando
    if (x1 > S6_HAT) clipX(g, Math.max(x0, S6_HAT), x1, () => {
      g.fillStyle = '#2a1050'; g.fillRect(x0, 0, x1 - x0, FT);
      cells(x0, x1, 900, 341, (cx) => { // espiral hipnótica
        const sx = cx + 450, sy = 200;
        for (let k = 0; k < 16; k++) {
          const a0 = k * Math.PI / 8;
          g.fillStyle = k % 2 ? '#3a1a70' : '#1e5a8a';
          g.beginPath(); g.moveTo(sx, sy); g.arc(sx, sy, 700, a0, a0 + Math.PI / 8); g.closePath(); g.fill();
        }
        const gl = g.createRadialGradient(sx, sy, 10, sx, sy, 260);
        gl.addColorStop(0, 'rgba(255,255,255,0.55)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gl; g.fillRect(sx - 260, sy - 260, 520, 520);
      });
      cells(x0, x1, 220, 343, (cx, r) => { // objetos flutuando
        const x = cx + r() * 160, y = 60 + r() * 330, kind = r();
        if (kind < 0.4) {
          g.save(); g.translate(x, y); g.rotate(r() * 1.2 - 0.6);
          g.fillStyle = '#f6f2e6'; g.fillRect(-22, -32, 44, 64); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(-22, -32, 44, 64);
          const red = r() > 0.5; g.fillStyle = red ? '#d0202a' : '#1a1a22'; g.font = 'bold 28px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(red ? '♦' : '♣', 0, 2);
          g.restore();
        } else if (kind < 0.65) TT.drawTopHat(g, x, y + 30, 0.55 + r() * 0.3, false);
        else star5(g, x, y, 10 + r() * 10, r() > 0.5 ? GOLD : '#ffffff');
      });
      // chão: xadrez preto e branco tingido de roxo
      for (let y = FT, row = 0; y < H; y += 36, row++) for (let x = Math.floor(x0 / 64) * 64; x < x1; x += 64) {
        g.fillStyle = ((x / 64) + row) % 2 ? '#1e1430' : '#d8cfee'; g.fillRect(x, y, 64, 36);
      }
      const sh = g.createLinearGradient(0, FT, 0, H);
      sh.addColorStop(0, 'rgba(60,20,120,0.55)'); sh.addColorStop(1, 'rgba(60,20,120,0.15)');
      g.fillStyle = sh; g.fillRect(x0, FT, x1 - x0, H - FT);
    });
    // passagens: porta dos bastidores e a boca da cartola gigante
    if (x0 < S6_STAGE + 90 && x1 > S6_STAGE - 90) {
      g.fillStyle = '#1c1b26'; g.fillRect(S6_STAGE - 80, 120, 160, FT - 120);
      g.strokeStyle = OUT; g.lineWidth = 5; g.strokeRect(S6_STAGE - 80, 120, 160, FT - 120);
      g.fillStyle = '#6a3a2a'; g.fillRect(S6_STAGE - 66, 160, 132, FT - 160); g.lineWidth = 3; g.strokeRect(S6_STAGE - 66, 160, 132, FT - 160);
      g.fillStyle = GOLD; star5(g, S6_STAGE, 220, 22, GOLD);
      TT.drawText(g, 'CAMARIM', S6_STAGE, 140, 18, GOLD);
    }
    if (x0 < S6_HAT + 160 && x1 > S6_HAT - 160) {
      g.fillStyle = '#14131c'; g.fillRect(S6_HAT - 150, 0, 300, FT);
      g.fillStyle = '#c4162a'; g.fillRect(S6_HAT - 150, 300, 300, 40);
      g.strokeStyle = OUT; g.lineWidth = 5; g.strokeRect(S6_HAT - 150, -4, 300, FT + 4);
      g.fillStyle = 'rgba(160,120,255,0.35)'; g.beginPath(); g.ellipse(S6_HAT, FT - 70, 90, 140, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0, FT, x1 - x0, 6);
  }

  // Primeiro plano: cortina vermelha de veludo presa com corda dourada.
  function s6Fg(g, x0, x1) {
    cells(x0, x1, 1500, 351, (cx) => {
      const x = cx + 750;
      g.fillStyle = '#9a1222'; g.beginPath(); g.moveTo(x - 40, 0); g.lineTo(x + 60, 0); g.quadraticCurveTo(x + 30, 260, x + 50, H); g.lineTo(x - 30, H); g.quadraticCurveTo(x - 10, 260, x - 40, 0); g.closePath(); g.fill();
      g.strokeStyle = '#5a0a14'; g.lineWidth = 5; for (const o of [-10, 15, 35]) { g.beginPath(); g.moveTo(x + o, 0); g.quadraticCurveTo(x + o - 10, 260, x + o + 5, H); g.stroke(); }
      g.strokeStyle = OUT; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 40, 0); g.quadraticCurveTo(x - 10, 260, x - 30, H); g.stroke();
      g.fillStyle = GOLD; g.fillRect(x - 36, 300, 92, 12); g.strokeRect(x - 36, 300, 92, 12);
    });
  }

  // =============================================================== FASE 7 — O Covil do Slade
  // Jump City em ruínas sob o céu vermelho de Trigon (com os cidadãos virados pedra), o covil
  // subterrâneo cheio de engrenagens e o salão do trono de Slade.
  const S7_LAIR = 2700, S7_THRONE = 5850;
  const RUST = '#b8642a', STEEL = '#3a3d47', STEEL_D = '#262830', LAVA = '#ff7a1a';

  // Engrenagem: dentes, anel e furo central. col = cor do metal.
  function gear(g, cx, cy, R, teeth, col, rot) {
    rot = rot || 0;
    g.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = rot + (i / (teeth * 2)) * Math.PI * 2, a1 = rot + ((i + 1) / (teeth * 2)) * Math.PI * 2, r = i % 2 ? R : R * 0.86;
      g.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r); g.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    }
    g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
    g.beginPath(); g.arc(cx, cy, R * 0.62, 0, Math.PI * 2); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = R * 0.08; g.stroke();
    for (let k = 0; k < 5; k++) { // raios
      const a = rot + k * Math.PI * 2 / 5;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2); g.lineTo(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6);
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = R * 0.1; g.stroke();
    }
    g.beginPath(); g.arc(cx, cy, R * 0.18, 0, Math.PI * 2); g.fillStyle = '#16171b'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  }
  // Máscara do Slade (metade preta, metade cobre, um olho) para telões e emblemas.
  function sladeMask(g, x, y, r) {
    g.save(); g.beginPath(); g.ellipse(x, y, r * 0.82, r, 0, 0, Math.PI * 2); g.fillStyle = '#c8641c'; g.fill();
    g.clip(); g.fillStyle = '#16171b'; g.fillRect(x - r, y - r, r, r * 2); g.restore();
    g.beginPath(); g.ellipse(x, y, r * 0.82, r, 0, 0, Math.PI * 2); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#100'; g.beginPath(); g.ellipse(x + r * 0.36, y - r * 0.18, r * 0.2, r * 0.1, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#16171b'; for (let i = 0; i < 3; i++) g.fillRect(x + r * 0.08 + i * r * 0.14, y + r * 0.4, r * 0.06, r * 0.36);
  }
  // Cidadão virado pedra pelo Trigon (episódio "O Fim").
  function statue(g, x, base, s, pose) {
    g.save(); g.translate(x, base); g.scale(s, s);
    g.fillStyle = '#8e8880'; g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.ellipse(0, -96, 13, 14, 0, 0, Math.PI * 2); g.fill(); g.stroke(); // cabeça
    g.beginPath(); g.moveTo(-14, -82); g.lineTo(14, -82); g.lineTo(11, -38); g.lineTo(-11, -38); g.closePath(); g.fill(); g.stroke(); // tronco
    g.beginPath(); g.moveTo(-9, -38); g.lineTo(-12, 0); g.lineTo(-3, 0); g.lineTo(0, -30); g.lineTo(3, 0); g.lineTo(12, 0); g.lineTo(9, -38); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 9; g.strokeStyle = OUT; g.lineCap = 'round';
    const arms = pose ? [[-14, -78, -34, -112], [14, -78, 30, -110]] : [[-14, -78, -40, -64], [14, -78, 22, -120]]; // braços para cima, assustado
    for (const [a, b, c, d] of arms) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
    g.lineWidth = 5; g.strokeStyle = '#8e8880';
    for (const [a, b, c, d] of arms) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); }
    g.strokeStyle = 'rgba(40,30,30,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-6, -92); g.lineTo(2, -84); g.lineTo(-2, -60); g.stroke(); // rachadura
    g.restore();
  }

  function s7Far(g, x0, x1) {
    const sky = g.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, '#1a0406'); sky.addColorStop(0.45, '#5a0f0e'); sky.addColorStop(0.85, '#c03a14'); sky.addColorStop(1, '#ff8a2a');
    g.fillStyle = sky; g.fillRect(x0, 0, x1 - x0, H);
    // os quatro olhos de Trigon no céu
    cells(x0, x1, 2200, 701, (cx) => {
      const ex = cx + 1100;
      for (const [dx, dy] of [[-70, 0], [70, 0], [-36, -46], [36, -46]]) {
        const gl = g.createRadialGradient(ex + dx, 120 + dy, 2, ex + dx, 120 + dy, 46);
        gl.addColorStop(0, 'rgba(255,240,180,0.9)'); gl.addColorStop(0.3, 'rgba(255,60,30,0.6)'); gl.addColorStop(1, 'rgba(255,40,20,0)');
        g.fillStyle = gl; g.fillRect(ex + dx - 46, 74 + dy, 92, 92);
        g.fillStyle = 'rgba(255,230,160,0.9)'; g.beginPath(); g.ellipse(ex + dx, 120 + dy, 18, 7, 0, 0, Math.PI * 2); g.fill();
      }
    });
    // nuvens escuras
    cells(x0, x1, 360, 703, (cx, r) => {
      const y = 50 + r() * 200, w = 140 + r() * 180;
      g.fillStyle = r() > 0.5 ? 'rgba(40,6,10,0.55)' : 'rgba(90,20,14,0.5)';
      for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + k * w / 5, y + Math.sin(k * 1.9) * 7, w / 4, 14 + r() * 10, 0, 0, Math.PI * 2); g.fill(); }
    });
    // silhuetas da cidade em ruínas com janelas em brasa
    cells(x0, x1, 120, 705, (cx, r) => {
      const w = 80 + r() * 40, h = 110 + r() * 170, top = 440 - h;
      g.fillStyle = '#2a0a0c';
      g.beginPath(); g.moveTo(cx, 440); g.lineTo(cx, top + r() * 30); g.lineTo(cx + w * 0.3, top + r() * 40); g.lineTo(cx + w * 0.5, top + 20 + r() * 40); g.lineTo(cx + w * 0.75, top); g.lineTo(cx + w, top + r() * 50); g.lineTo(cx + w, 440); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,120,40,0.55)';
      for (let y = top + 50; y < 425; y += 24) for (let x = cx + 10; x < cx + w - 12; x += 20) if (r() > 0.75) g.fillRect(x, y, 7, 10);
    });
    g.fillStyle = '#1e0608'; g.fillRect(x0, 440, x1 - x0, H - 440);
  }

  function s7Mid(g, x0, x1) {
    cells(x0, x1, 460, 711, (cx, r) => { // prédios quebrados mais perto, com fumaça
      const w = 170 + r() * 90, h = 180 + r() * 110, x = cx + r() * 120, top = 470 - h;
      g.fillStyle = '#3a1416';
      g.beginPath(); g.moveTo(x, 470); g.lineTo(x, top + 30); g.lineTo(x + w * 0.25, top); g.lineTo(x + w * 0.4, top + 40); g.lineTo(x + w * 0.62, top + 14); g.lineTo(x + w, top + 60); g.lineTo(x + w, 470); g.closePath(); g.fill();
      g.fillStyle = '#2a0e10'; g.fillRect(x + w - 30, top + 60, 30, h - 60);
      g.fillStyle = 'rgba(255,140,60,0.5)';
      for (let y = top + 60; y < 450; y += 30) for (let xx = x + 14; xx < x + w - 40; xx += 26) if (r() > 0.6) g.fillRect(xx, y, 12, 14);
      if (r() > 0.4) { // coluna de fumaça
        g.fillStyle = 'rgba(30,10,12,0.45)';
        for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(x + w * 0.5 + k * 14, top - k * 40, 30 + k * 8, 22 + k * 4, 0, 0, Math.PI * 2); g.fill(); }
      }
    });
  }

  function s7Near(g, x0, x1) {
    // --- Jump City em ruínas
    if (x0 < S7_LAIR) clipX(g, x0, Math.min(x1, S7_LAIR), () => {
      cells(x0, x1, 900, 721, (cx, r) => {
        const fx = cx + 60, w = 520;
        // fachada de tijolos rachada com topo quebrado
        g.fillStyle = '#5a2a26';
        g.beginPath(); g.moveTo(fx, FT); g.lineTo(fx, 170); g.lineTo(fx + 120, 140); g.lineTo(fx + 200, 200); g.lineTo(fx + 330, 120); g.lineTo(fx + 420, 180); g.lineTo(fx + w, 150); g.lineTo(fx + w, FT); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(30,8,8,0.45)'; g.lineWidth = 2;
        for (let y = 200, row = 0; y < FT; y += 20, row++) { g.beginPath(); g.moveTo(fx, y); g.lineTo(fx + w, y); g.stroke(); }
        g.strokeStyle = OUT; g.lineWidth = 4; g.stroke();
        g.beginPath(); g.moveTo(fx, FT); g.lineTo(fx, 170); g.lineTo(fx + 120, 140); g.lineTo(fx + 200, 200); g.lineTo(fx + 330, 120); g.lineTo(fx + 420, 180); g.lineTo(fx + w, 150); g.lineTo(fx + w, FT); g.stroke();
        // janelas quebradas com fogo dentro
        for (let k = 0; k < 4; k++) {
          const wx = fx + 40 + k * 120, wy = 230 + (k % 2) * 30;
          g.fillStyle = '#1a0608'; g.fillRect(wx, wy, 70, 90); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(wx, wy, 70, 90);
          const gl = g.createRadialGradient(wx + 35, wy + 70, 4, wx + 35, wy + 70, 60);
          gl.addColorStop(0, 'rgba(255,200,80,0.9)'); gl.addColorStop(1, 'rgba(255,80,20,0)');
          g.fillStyle = gl; g.fillRect(wx, wy, 70, 90);
          g.fillStyle = '#1a0608'; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + 30, wy + 26); g.lineTo(wx + 14, wy + 40); g.lineTo(wx, wy + 30); g.closePath(); g.fill(); // caco de vidro
        }
        // rachadura grande na parede
        g.strokeStyle = '#1a0608'; g.lineWidth = 4; g.beginPath(); g.moveTo(fx + 300, 150); g.lineTo(fx + 280, 230); g.lineTo(fx + 310, 300); g.lineTo(fx + 290, 380); g.stroke();
        // cidadãos de pedra na calçada
        statue(g, fx + 590, FT + 14, 1, r() > 0.5);
        statue(g, fx + 680, FT + 20, 0.85, r() > 0.5);
        // poste entortado
        g.save(); g.translate(fx + 800, FT); g.rotate(0.25);
        g.fillStyle = '#1c1b26'; g.fillRect(-5, -240, 10, 240); g.beginPath(); g.arc(0, -244, 13, 0, Math.PI * 2); g.fillStyle = '#3a2a2a'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke();
        g.restore();
      });
      // asfalto rachado com fendas de lava
      g.fillStyle = '#4a3a3a'; g.fillRect(x0, FT, x1 - x0, 56);
      g.fillStyle = '#5e4a48'; g.fillRect(x0, FT + 52, x1 - x0, 8);
      g.fillStyle = '#2e2426'; g.fillRect(x0, FT + 60, x1 - x0, H - FT - 60);
      cells(x0, x1, 300, 723, (cx, r) => {
        const x = cx + r() * 200, y = FT + 80 + r() * 120;
        g.save(); g.globalCompositeOperation = 'lighter';
        g.strokeStyle = 'rgba(255,110,30,0.85)'; g.lineWidth = 5; g.lineJoin = 'miter';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40, y + 8 - r() * 16); g.lineTo(x + 80, y + 4); g.lineTo(x + 110, y + 14 - r() * 20); g.stroke();
        g.strokeStyle = 'rgba(255,230,140,0.9)'; g.lineWidth = 2; g.stroke();
        g.restore();
      });
    });
    // --- covil subterrâneo: paredes de aço, engrenagens, canos e telões com a máscara
    if (x1 > S7_LAIR && x0 < S7_THRONE) clipX(g, Math.max(x0, S7_LAIR), Math.min(x1, S7_THRONE), () => {
      g.fillStyle = STEEL_D; g.fillRect(x0, 0, x1 - x0, FT);
      for (let x = Math.floor(x0 / 160) * 160; x < x1; x += 160) { // painéis rebitados
        g.fillStyle = STEEL; g.fillRect(x + 4, 20, 152, FT - 40);
        g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(x + 4, 20, 152, FT - 40);
        g.fillStyle = '#5c6169'; for (const [rx, ry] of [[14, 30], [146, 30], [14, FT - 30], [146, FT - 30]]) { g.beginPath(); g.arc(x + rx, ry, 3, 0, Math.PI * 2); g.fill(); }
      }
      cells(x0, x1, 620, 731, (cx, r) => { // engrenagens gigantes encaixadas
        const gx = cx + 160 + r() * 120, gy = 140 + r() * 80, R = 90 + r() * 40;
        gear(g, gx, gy, R, 14, RUST, r());
        gear(g, gx + R * 1.55, gy + R * 0.6, R * 0.6, 10, '#8a909a', r());
      });
      cells(x0, x1, 520, 733, (cx, r) => { // telão com a máscara do Slade
        const mx = cx + 340 + r() * 60, my = 300;
        g.fillStyle = '#0c0d10'; g.fillRect(mx - 70, my - 54, 140, 108); g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(mx - 70, my - 54, 140, 108);
        g.fillStyle = 'rgba(255,122,26,0.18)'; g.fillRect(mx - 64, my - 48, 128, 96);
        sladeMask(g, mx, my, 38);
        g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = my - 48; y < my + 48; y += 6) g.fillRect(mx - 64, y, 128, 2); // linhas do monitor
      });
      // canos no teto e lâmpadas laranja
      g.fillStyle = '#5c6169'; g.fillRect(x0, 40, x1 - x0, 18); g.fillStyle = '#4a4e57'; g.fillRect(x0, 62, x1 - x0, 12);
      g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(x0 - 4, 40, x1 - x0 + 8, 18);
      cells(x0, x1, 400, 735, (cx) => {
        const lx = cx + 200;
        g.fillStyle = '#16171b'; g.fillRect(lx - 3, 74, 6, 40);
        const gl = g.createRadialGradient(lx, 124, 4, lx, 124, 120);
        gl.addColorStop(0, 'rgba(255,170,80,0.8)'); gl.addColorStop(1, 'rgba(255,120,30,0)');
        g.fillStyle = gl; g.fillRect(lx - 120, 4, 240, 240);
        g.beginPath(); g.arc(lx, 122, 10, 0, Math.PI * 2); g.fillStyle = '#ffd08a'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
      });
      // piso de grade metálica
      g.fillStyle = '#2c2e36'; g.fillRect(x0, FT, x1 - x0, H - FT);
      g.strokeStyle = 'rgba(10,10,14,0.6)'; g.lineWidth = 3;
      for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) { g.beginPath(); g.moveTo(x, FT); g.lineTo(x - 20, H); g.stroke(); }
      for (let y = FT + 30; y < H; y += 30) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
      const sh = g.createLinearGradient(0, FT, 0, H);
      sh.addColorStop(0, 'rgba(0,0,0,0.4)'); sh.addColorStop(1, 'rgba(255,90,20,0.12)');
      g.fillStyle = sh; g.fillRect(x0, FT, x1 - x0, H - FT);
    });
    // --- salão do trono: parede de engrenagens, o "S" gigante e a poltrona do Slade
    if (x1 > S7_THRONE) clipX(g, Math.max(x0, S7_THRONE), x1, () => {
      g.fillStyle = '#16171b'; g.fillRect(x0, 0, x1 - x0, FT);
      cells(x0, x1, 300, 741, (cx, r) => gear(g, cx + r() * 200, 60 + r() * 300, 70 + r() * 70, 12, r() > 0.5 ? '#4a3a30' : '#3a3d47', r()));
      cells(x0, x1, 1400, 743, (cx) => {
        const sx = cx + 700, sy = 210;
        const gl = g.createRadialGradient(sx, sy, 20, sx, sy, 260);
        gl.addColorStop(0, 'rgba(255,120,30,0.55)'); gl.addColorStop(1, 'rgba(255,80,20,0)');
        g.fillStyle = gl; g.fillRect(sx - 260, sy - 260, 520, 520);
        g.beginPath(); g.arc(sx, sy, 130, 0, Math.PI * 2); g.fillStyle = '#1e1f24'; g.fill(); g.strokeStyle = RUST; g.lineWidth = 12; g.stroke();
        g.strokeStyle = OUT; g.lineWidth = 4; g.beginPath(); g.arc(sx, sy, 136, 0, Math.PI * 2); g.stroke();
        TT.drawText(g, 'S', sx, sy + 8, 190, LAVA, OUT, 'center', 12);
        // poltrona de espaldar alto voltada para os telões
        const tx = sx + 330;
        g.fillStyle = '#2a1c1a'; g.beginPath(); g.moveTo(tx - 50, FT); g.lineTo(tx - 46, FT - 260); g.quadraticCurveTo(tx, FT - 300, tx + 46, FT - 260); g.lineTo(tx + 50, FT); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 4; g.stroke();
        g.fillStyle = RUST; g.fillRect(tx - 60, FT - 110, 120, 20); g.strokeRect(tx - 60, FT - 110, 120, 20);
      });
      // piso escuro com rachaduras brilhando (fogo de Trigon por baixo)
      g.fillStyle = '#1e1a1c'; g.fillRect(x0, FT, x1 - x0, H - FT);
      for (let y = FT, row = 0; y < H; y += 44, row++) for (let x = Math.floor(x0 / 110) * 110 + (row % 2) * 55; x < x1; x += 110) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(x, y, 110, 44); }
      cells(x0, x1, 260, 745, (cx, r) => {
        const x = cx + r() * 150, y = FT + 40 + r() * 150;
        g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,90,20,0.8)'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30, y - 10); g.lineTo(x + 60, y + 6); g.lineTo(x + 92, y - 4); g.stroke(); g.restore();
      });
    });
    // passagens: escada para o subsolo e a porta-cofre redonda do salão
    if (x0 < S7_LAIR + 120 && x1 > S7_LAIR - 120) {
      g.fillStyle = '#1c1b22'; g.fillRect(S7_LAIR - 100, 110, 200, FT - 110);
      g.strokeStyle = OUT; g.lineWidth = 5; g.strokeRect(S7_LAIR - 100, 110, 200, FT - 110);
      g.fillStyle = '#0c0c10'; g.fillRect(S7_LAIR - 80, 170, 160, FT - 170);
      g.fillStyle = '#3a3d47'; for (let i = 0; i < 6; i++) g.fillRect(S7_LAIR - 80 + i * 6, FT - 40 - i * 40, 160 - i * 12, 8); // degraus descendo
      TT.drawText(g, 'PERIGO', S7_LAIR, 140, 22, '#ffe14a', OUT, 'center', 4);
    }
    if (x0 < S7_THRONE + 170 && x1 > S7_THRONE - 170) {
      g.fillStyle = '#16171b'; g.fillRect(S7_THRONE - 160, 0, 320, FT);
      g.beginPath(); g.arc(S7_THRONE, FT - 170, 150, 0, Math.PI * 2); g.fillStyle = '#0a0a0c'; g.fill(); g.strokeStyle = '#8a909a'; g.lineWidth = 18; g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 4; g.beginPath(); g.arc(S7_THRONE, FT - 170, 160, 0, Math.PI * 2); g.stroke();
      gear(g, S7_THRONE + 150, FT - 170, 60, 10, RUST, 0.2); // porta-cofre aberta (engrenagem de tranca)
      g.fillStyle = 'rgba(255,120,30,0.3)'; g.beginPath(); g.arc(S7_THRONE, FT - 170, 130, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0, FT, x1 - x0, 6);
  }

  // Primeiro plano: canos verticais com válvulas e correntes penduradas.
  function s7Fg(g, x0, x1) {
    cells(x0, x1, 1500, 751, (cx) => {
      const x = cx + 750;
      g.fillStyle = '#4a4e57'; g.fillRect(x, 0, 46, H);
      g.fillStyle = '#6a6f7a'; g.fillRect(x + 8, 0, 10, H);
      g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(x, -4, 46, H + 8);
      for (const y of [140, 420]) { g.fillStyle = RUST; g.fillRect(x - 8, y, 62, 22); g.strokeRect(x - 8, y, 62, 22); }
      g.beginPath(); g.arc(x + 23, 300, 26, 0, Math.PI * 2); g.strokeStyle = '#c4162a'; g.lineWidth = 7; g.stroke(); // válvula
      g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
      g.strokeStyle = '#2a2d33'; g.lineWidth = 5; // corrente
      for (let y = 0; y < 220; y += 16) { g.beginPath(); g.ellipse(x + 110, y, 5, 9, 0, 0, Math.PI * 2); g.stroke(); }
    });
  }

  // =============================================================== FASE 8 — A Base da Irmandade
  // Montanhas nevadas sob a aurora, o hangar onde a Irmandade guarda os heróis congelados em blocos de
  // gelo (como no fim da série) e o laboratório do Cérebro com tanques e telões.
  const S8_HANGAR = 2700, S8_LAB = 5850;
  const SNOW = '#eef5ff', SNOW_D = '#c4d4ea', ICE_C = '#9fd8ff', B_RED = '#c4162a';

  // Emblema da Irmandade do Mal: círculo vermelho com um "B" (de Brotherhood) e um raio.
  function brotherhoodLogo(g, x, y, r) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = B_RED; g.fill(); g.strokeStyle = OUT; g.lineWidth = Math.max(2, r * 0.1); g.stroke();
    g.beginPath(); g.arc(x, y, r * 0.78, 0, Math.PI * 2); g.strokeStyle = '#1c1a22'; g.lineWidth = r * 0.08; g.stroke();
    TT.drawText(g, 'B', x, y + r * 0.06, r * 1.15, '#ffffff', OUT, 'center', Math.max(2, r * 0.12));
  }
  // Herói congelado num bloco de gelo (silhueta colorida dentro do gelo, como na base da Irmandade).
  function frozenHero(g, x, base, col, s) {
    g.save(); g.translate(x, base); g.scale(s, s);
    g.fillStyle = col; g.strokeStyle = 'rgba(20,20,40,0.5)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(0, -128, 13, 14, 0, 0, Math.PI * 2); g.fill(); // cabeça
    g.fillRect(-14, -114, 28, 46); g.fillRect(-12, -68, 10, 58); g.fillRect(2, -68, 10, 58); // corpo e pernas
    g.save(); g.translate(-14, -108); g.rotate(0.9); g.fillRect(-4, 0, 9, 40); g.restore(); // braços protegendo o rosto
    g.save(); g.translate(14, -108); g.rotate(-1.9); g.fillRect(-4, 0, 9, 40); g.restore();
    // bloco de gelo
    g.fillStyle = 'rgba(170,225,255,0.55)';
    g.beginPath(); g.moveTo(-46, 0); g.lineTo(-52, -150); g.lineTo(-20, -172); g.lineTo(34, -166); g.lineTo(52, -140); g.lineTo(46, 0); g.closePath(); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-36, -130); g.lineTo(-30, -60); g.moveTo(26, -150); g.lineTo(34, -110); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(-40, -160, 12, 150);
    g.restore();
  }
  function pine(g, x, base, h) {
    g.fillStyle = '#5a4030'; g.fillRect(x - 5, base - 20, 10, 20);
    for (let i = 0; i < 4; i++) {
      const w = h * (0.42 - i * 0.08), y = base - 18 - i * h * 0.2;
      g.beginPath(); g.moveTo(x - w, y); g.lineTo(x, y - h * 0.34); g.lineTo(x + w, y); g.closePath();
      g.fillStyle = '#24543e'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2.5; g.stroke();
      g.fillStyle = SNOW; g.beginPath(); g.moveTo(x - w * 0.5, y - h * 0.17); g.lineTo(x, y - h * 0.34); g.lineTo(x + w * 0.5, y - h * 0.17); g.quadraticCurveTo(x, y - h * 0.24, x - w * 0.5, y - h * 0.17); g.fill();
    }
  }

  function s8Far(g, x0, x1) {
    const sky = g.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, '#050a24'); sky.addColorStop(0.5, '#14285a'); sky.addColorStop(1, '#3a5a8e');
    g.fillStyle = sky; g.fillRect(x0, 0, x1 - x0, H);
    // estrelas
    cells(x0, x1, 80, 801, (cx, r) => { g.fillStyle = 'rgba(255,255,255,' + (0.4 + r() * 0.6) + ')'; g.fillRect(cx + r() * 80, r() * 260, 2, 2); });
    // aurora boreal: faixas verdes e rosadas ondulando
    cells(x0, x1, 1100, 803, (cx) => {
      for (const [col, y0, amp] of [['rgba(93,255,170,0.22)', 90, 30], ['rgba(120,255,200,0.16)', 130, 40], ['rgba(255,120,220,0.12)', 70, 24]]) {
        g.beginPath(); g.moveTo(cx, y0);
        for (let x = 0; x <= 1100; x += 50) g.lineTo(cx + x, y0 + Math.sin(x * 0.012 + y0) * amp);
        for (let x = 1100; x >= 0; x -= 50) g.lineTo(cx + x, y0 + 70 + Math.sin(x * 0.012 + y0 + 1) * amp);
        g.closePath(); g.fillStyle = col; g.fill();
      }
    });
    // montanhas nevadas
    cells(x0, x1, 520, 805, (cx, r) => {
      const h = 220 + r() * 120, w = 520, base = 440, px = cx + w * (0.35 + r() * 0.3);
      g.beginPath(); g.moveTo(cx - 60, base); g.lineTo(px, base - h); g.lineTo(cx + w + 60, base); g.closePath(); g.fillStyle = '#4a5a80'; g.fill();
      g.beginPath(); g.moveTo(px - h * 0.32, base - h * 0.62); g.lineTo(px, base - h); g.lineTo(px + h * 0.36, base - h * 0.6); g.lineTo(px + h * 0.12, base - h * 0.66); g.lineTo(px - h * 0.08, base - h * 0.58); g.closePath(); g.fillStyle = SNOW; g.fill();
    });
    g.fillStyle = '#8aa2c8'; g.fillRect(x0, 440, x1 - x0, H - 440);
  }

  function s8Mid(g, x0, x1) {
    cells(x0, x1, 700, 811, (cx, r) => { // a base: domos e torres de metal na neve
      const x = cx + r() * 200, base = 470;
      g.fillStyle = '#5c6a86'; g.strokeStyle = OUT; g.lineWidth = 3;
      g.beginPath(); g.arc(x + 110, base, 110, Math.PI, 0); g.closePath(); g.fill(); g.stroke(); // domo
      g.fillStyle = SNOW; g.beginPath(); g.arc(x + 110, base, 110, Math.PI * 1.15, Math.PI * 1.85); g.arc(x + 110, base - 20, 92, Math.PI * 1.85, Math.PI * 1.15, true); g.closePath(); g.fill();
      g.fillStyle = '#ffe9a0'; for (let i = 0; i < 4; i++) g.fillRect(x + 50 + i * 34, base - 46, 14, 10);
      g.fillStyle = '#4a566e'; g.fillRect(x + 250, base - 210, 46, 210); g.strokeRect(x + 250, base - 210, 46, 210); // torre
      brotherhoodLogo(g, x + 273, base - 170, 18);
      g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(x + 273, base - 216, 5, 0, Math.PI * 2); g.fill();
    });
    cells(x0, x1, 300, 813, (cx, r) => pine(g, cx + r() * 200, 478, 110 + r() * 50));
  }

  function s8Near(g, x0, x1) {
    // --- lado de fora: neve funda, pinheiros, a cerca da base e placas
    if (x0 < S8_HANGAR) clipX(g, x0, Math.min(x1, S8_HANGAR), () => {
      cells(x0, x1, 820, 821, (cx, r) => {
        const fx = cx + 60;
        pine(g, fx + 40, FT + 6, 230);
        // muro de aço da base com o emblema e luzes vermelhas
        g.fillStyle = '#4a566e'; g.fillRect(fx + 160, 210, 460, FT - 210); g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(fx + 160, 210, 460, FT - 210);
        g.fillStyle = '#3a4458'; for (let x = fx + 160; x < fx + 620; x += 46) g.fillRect(x, 210, 6, FT - 210);
        g.fillStyle = SNOW; g.beginPath(); g.moveTo(fx + 150, 214); g.quadraticCurveTo(fx + 390, 180, fx + 630, 214); g.lineTo(fx + 630, 222); g.lineTo(fx + 150, 222); g.closePath(); g.fill();
        brotherhoodLogo(g, fx + 390, 320, 56);
        TT.drawText(g, 'IRMANDADE DO MAL', fx + 390, 410, 26, '#ffe14a', OUT, 'center', 5);
        for (const lx of [fx + 200, fx + 580]) { const gl = g.createRadialGradient(lx, 240, 2, lx, 240, 60); gl.addColorStop(0, 'rgba(255,60,50,0.9)'); gl.addColorStop(1, 'rgba(255,60,50,0)'); g.fillStyle = gl; g.fillRect(lx - 60, 180, 120, 120); }
        pine(g, fx + 720, FT + 6, 200);
        if (r() > 0.4) { g.fillStyle = '#2a3550'; g.fillRect(fx + 680, FT - 120, 8, 120); g.fillStyle = '#ffe14a'; g.fillRect(fx + 650, FT - 140, 70, 34); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(fx + 650, FT - 140, 70, 34); TT.drawText(g, 'PERIGO', fx + 685, FT - 123, 16, '#c4162a', OUT, 'center', 3); }
      });
      // chão de neve com montinhos e rastros
      g.fillStyle = SNOW; g.fillRect(x0, FT, x1 - x0, H - FT);
      g.fillStyle = SNOW_D; for (let y = FT + 40; y < H; y += 46) g.fillRect(x0, y, x1 - x0, 3);
      cells(x0, x1, 220, 823, (cx, r) => { g.fillStyle = '#dce8f8'; g.beginPath(); g.ellipse(cx + r() * 150, FT + 30 + r() * 170, 60, 12, 0, 0, Math.PI * 2); g.fill(); });
    });
    // --- hangar: heróis congelados em blocos de gelo, guindastes e piso de metal com gelo
    if (x1 > S8_HANGAR && x0 < S8_LAB) clipX(g, Math.max(x0, S8_HANGAR), Math.min(x1, S8_LAB), () => {
      g.fillStyle = '#2a3244'; g.fillRect(x0, 0, x1 - x0, FT);
      for (let x = Math.floor(x0 / 200) * 200; x < x1; x += 200) { // vigas
        g.fillStyle = '#3a4458'; g.fillRect(x, 0, 18, FT); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(x, -4, 18, FT + 8);
        g.strokeStyle = '#4a566e'; g.lineWidth = 6; g.beginPath(); g.moveTo(x + 18, 40); g.lineTo(x + 200, 160); g.stroke();
      }
      const cols = ['#d7263e', '#79c64c', '#ffe14a', '#5f8fe0', '#f3a35a', '#7b55c9'];
      cells(x0, x1, 340, 831, (cx, r) => frozenHero(g, cx + 170, FT - 4, TT.choice(cols.slice(Math.floor(r() * 3))), 1.15));
      // luzes azuis frias penduradas
      cells(x0, x1, 340, 833, (cx) => {
        const lx = cx + 60;
        g.strokeStyle = '#1c1a22'; g.lineWidth = 3; g.beginPath(); g.moveTo(lx, 0); g.lineTo(lx, 90); g.stroke();
        const gl = g.createRadialGradient(lx, 100, 4, lx, 100, 130); gl.addColorStop(0, 'rgba(160,230,255,0.6)'); gl.addColorStop(1, 'rgba(160,230,255,0)');
        g.fillStyle = gl; g.fillRect(lx - 130, 0, 260, 260);
        g.fillStyle = '#e6fbff'; g.beginPath(); g.arc(lx, 98, 9, 0, Math.PI * 2); g.fill();
      });
      // piso de metal com placas de gelo
      g.fillStyle = '#4a566e'; g.fillRect(x0, FT, x1 - x0, H - FT);
      g.strokeStyle = 'rgba(10,10,20,0.4)'; g.lineWidth = 2; for (let x = Math.floor(x0 / 90) * 90; x < x1; x += 90) { g.beginPath(); g.moveTo(x, FT); g.lineTo(x - 40, H); g.stroke(); }
      cells(x0, x1, 260, 835, (cx, r) => { g.fillStyle = 'rgba(190,235,255,0.55)'; g.beginPath(); g.ellipse(cx + r() * 160, FT + 50 + r() * 150, 70, 16, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.stroke(); });
    });
    // --- laboratório do Cérebro: tanques verdes, telões com o cérebro e o emblema gigante
    if (x1 > S8_LAB) clipX(g, Math.max(x0, S8_LAB), x1, () => {
      g.fillStyle = '#1c2030'; g.fillRect(x0, 0, x1 - x0, FT);
      cells(x0, x1, 260, 841, (cx, r) => { // tanques com líquido verde e bolhas
        const tx = cx + 60 + r() * 80, top = 150 + r() * 60;
        g.fillStyle = 'rgba(120,230,170,0.45)'; g.fillRect(tx, top, 70, FT - top - 30);
        g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(tx, top, 70, FT - top - 30);
        g.fillStyle = '#5c6169'; g.fillRect(tx - 8, top - 16, 86, 18); g.fillRect(tx - 8, FT - 34, 86, 34);
        g.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(tx + 15 + r() * 40, top + 20 + r() * (FT - top - 70), 3 + r() * 3, 0, Math.PI * 2); g.fill(); }
      });
      cells(x0, x1, 1300, 843, (cx) => {
        const mx = cx + 650;
        g.fillStyle = '#0c0d10'; g.fillRect(mx - 170, 70, 340, 200); g.strokeStyle = OUT; g.lineWidth = 5; g.strokeRect(mx - 170, 70, 340, 200);
        g.fillStyle = 'rgba(93,255,170,0.15)'; g.fillRect(mx - 160, 80, 320, 180);
        TT.drawBrainJar(g, mx, 210, 2.2, 0, false, false);
        g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 80; y < 260; y += 6) g.fillRect(mx - 160, y, 320, 2);
        brotherhoodLogo(g, mx - 300, 170, 60); brotherhoodLogo(g, mx + 300, 170, 60);
      });
      g.fillStyle = '#2a3040'; g.fillRect(x0, FT, x1 - x0, H - FT);
      for (let y = FT, row = 0; y < H; y += 44, row++) for (let x = Math.floor(x0 / 110) * 110 + (row % 2) * 55; x < x1; x += 110) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(x, y, 110, 44); }
      cells(x0, x1, 300, 845, (cx, r) => { const gl = g.createRadialGradient(cx + 100, FT + 90 + r() * 80, 4, cx + 100, FT + 90, 90); gl.addColorStop(0, 'rgba(93,255,170,0.25)'); gl.addColorStop(1, 'rgba(93,255,170,0)'); g.fillStyle = gl; g.fillRect(cx, FT, 200, H - FT); });
    });
    // passagens: portão do hangar e porta blindada do laboratório
    for (const [px, col] of [[S8_HANGAR, '#3a4458'], [S8_LAB, '#2a3040']]) {
      if (x0 > px + 180 || x1 < px - 180) continue;
      g.fillStyle = col; g.fillRect(px - 150, 60, 300, FT - 60); g.strokeStyle = OUT; g.lineWidth = 5; g.strokeRect(px - 150, 60, 300, FT - 60);
      g.fillStyle = '#0c0d14'; g.fillRect(px - 110, 140, 220, FT - 140);
      g.fillStyle = '#ffe14a'; for (let i = 0; i < 8; i++) g.fillRect(px - 110 + i * 28, 120, 14, 14); // faixa de perigo
      g.fillStyle = '#1c1a22'; for (let i = 0; i < 8; i++) g.fillRect(px - 96 + i * 28, 120, 14, 14);
      brotherhoodLogo(g, px, 92, 22);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0, FT, x1 - x0, 6);
  }

  // Primeiro plano: pingentes de gelo pendurados e canos com gelo.
  function s8Fg(g, x0, x1) {
    cells(x0, x1, 1400, 851, (cx) => {
      const x = cx + 700;
      if (x > S8_LAB - 300) return; // nada na frente da arena do chefe
      g.fillStyle = '#5c6a86'; g.fillRect(x, 0, 40, H); g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(x, -4, 40, H + 8);
      g.fillStyle = 'rgba(200,240,255,0.85)';
      for (let i = 0; i < 6; i++) { const ix = x - 50 + i * 26, L = 40 + (i * 37) % 60; g.beginPath(); g.moveTo(ix, 0); g.lineTo(ix + 14, 0); g.lineTo(ix + 7, L); g.closePath(); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.stroke(); }
      g.fillStyle = SNOW; g.beginPath(); g.ellipse(x + 20, H - 6, 60, 22, 0, 0, Math.PI * 2); g.fill();
    });
  }

  // =============================================================== DETALHES DOS CENÁRIOS
  // Objetos de cenário reaproveitáveis, uma passada de luz e sombra comum a todas as fases e uma camada
  // de detalhes própria de cada fase. Tudo é pintado no mesmo bloco em cache do primeiro plano
  // (custo só quando o bloco é gerado). Objetos que ficam de pé no chão encostam na parede (base em FT+6),
  // atrás de quem anda; no chão só há marcas planas (poças, rachaduras, faixas), para não confundir com itens.

  // Poça de luz (elíptica), em modo aditivo.
  function glowPool(g, x, y, rx, ry, col, a) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a == null ? 0.35 : a;
    g.translate(x, y); g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(-rx, -rx, rx * 2, rx * 2);
    g.restore();
  }
  // Cone de luz de uma luminária (do bocal até o chão).
  function lightCone(g, x, top, bottom, w0, w1, col, a) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a == null ? 0.18 : a;
    const gr = g.createLinearGradient(0, top, 0, bottom);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - w0, top); g.lineTo(x + w0, top); g.lineTo(x + w1, bottom); g.lineTo(x - w1, bottom); g.closePath(); g.fill();
    g.restore();
  }
  // Luminária pendurada com cone de luz e mancha no chão.
  function hangLamp(g, x, cordTop, y, col, shade) {
    g.strokeStyle = '#15121c'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, cordTop); g.lineTo(x, y - 12); g.stroke();
    lightCone(g, x, y, FT + 30, 16, 120, col, 0.16);
    g.fillStyle = shade || '#3a3d47'; g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x - 9, y - 14); g.lineTo(x + 9, y - 14); g.lineTo(x + 22, y + 2); g.lineTo(x - 22, y + 2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff6d0'; g.beginPath(); g.ellipse(x, y + 3, 13, 4, 0, 0, Math.PI * 2); g.fill();
    glowPool(g, x, y + 2, 46, 30, col, 0.6);
    glowPool(g, x, FT + 60, 130, 34, col, 0.22);
  }
  function crate(g, x, base, w, h, col, mark) {
    g.fillStyle = col; g.strokeStyle = OUT; g.lineWidth = 3;
    g.fillRect(x, base - h, w, h); g.strokeRect(x, base - h, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
    g.strokeRect(x + 5, base - h + 5, w - 10, h - 10);
    g.beginPath(); g.moveTo(x + 5, base - h + 5); g.lineTo(x + w - 5, base - 5); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 2, base - h + 2, w - 4, 4);
    if (mark) TT.drawText(g, mark, x + w / 2, base - h / 2, Math.min(18, h * 0.32), '#1c1a22', null, 'center', 0);
  }
  function barrel(g, x, base, col, band, label) {
    const w = 46, h = 66;
    g.fillStyle = col; g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x - w / 2, base - h + 6); g.quadraticCurveTo(x - w / 2 - 4, base - h / 2, x - w / 2, base - 4);
    g.lineTo(x + w / 2, base - 4); g.quadraticCurveTo(x + w / 2 + 4, base - h / 2, x + w / 2, base - h + 6); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(x, base - h + 6, w / 2, 7, 0, 0, Math.PI * 2); g.fillStyle = TT.shade(col, -0.25); g.fill(); g.stroke();
    g.strokeStyle = band || '#2a2d33'; g.lineWidth = 4;
    for (const yy of [base - h + 20, base - 18]) { g.beginPath(); g.moveTo(x - w / 2 - 1, yy); g.lineTo(x + w / 2 + 1, yy); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x - w / 2 + 6, base - h + 14, 6, h - 26);
    if (label) { g.fillStyle = '#ffe14a'; g.beginPath(); g.moveTo(x, base - 46); g.lineTo(x + 11, base - 28); g.lineTo(x - 11, base - 28); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); TT.drawText(g, '!', x, base - 34, 13, '#1c1a22', null, 'center', 0); }
  }
  // Poça plana com reflexo (no chão).
  function puddle(g, x, y, rx, col, hi) {
    g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, rx * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = hi || 'rgba(255,255,255,0.45)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x - rx * 0.5, y - rx * 0.05); g.lineTo(x - rx * 0.1, y - rx * 0.05); g.moveTo(x + rx * 0.15, y + rx * 0.06); g.lineTo(x + rx * 0.45, y + rx * 0.06); g.stroke();
  }
  // Rachadura em zigue-zague (chão ou parede).
  function crack(g, x, y, len, col, r) {
    g.strokeStyle = col || 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y);
    let cx = x, cy = y;
    for (let i = 0; i < 5; i++) { cx += len / 5; cy += (r() - 0.5) * len * 0.3; g.lineTo(cx, cy); }
    g.stroke();
    g.beginPath(); g.moveTo(x + len * 0.4, y + (r() - 0.5) * 6); g.lineTo(x + len * 0.55, y + len * 0.18); g.stroke();
  }
  // Cartaz preso com fita; draw(g, x, y, w, h) desenha o conteúdo.
  function poster(g, x, y, w, h, bg, draw, tilt) {
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(tilt || 0); g.translate(-w / 2, -h / 2);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(4, 5, w, h);
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = OUT; g.lineWidth = 2.5; g.strokeRect(0, 0, w, h);
    if (draw) draw(g, 0, 0, w, h);
    g.fillStyle = 'rgba(255,250,200,0.75)'; g.fillRect(-4, -3, 14, 7); g.fillRect(w - 10, -3, 14, 7);
    g.restore();
  }
  function plant(g, x, base, s, pot) {
    g.save(); g.translate(x, base); g.scale(s, s);
    g.fillStyle = '#2e8a4e'; g.strokeStyle = OUT; g.lineWidth = 2.5;
    for (const [a, l] of [[-1.1, 48], [-0.6, 62], [-0.1, 70], [0.4, 60], [0.9, 50], [-1.4, 36], [1.3, 38]]) {
      g.save(); g.translate(0, -36); g.rotate(a);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -l * 0.5, 0, -l); g.quadraticCurveTo(-10, -l * 0.5, 0, 0); g.fill(); g.stroke();
      g.restore();
    }
    g.fillStyle = pot || '#c46a3a'; g.beginPath(); g.moveTo(-18, -40); g.lineTo(18, -40); g.lineTo(13, 0); g.lineTo(-13, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(-16, -40, 32, 5);
    g.restore();
  }
  // Painel com monitores e botões piscando (os botões são fixos no bloco em cache).
  function consoleDesk(g, x, base, w, scr, r) {
    g.fillStyle = '#3a3d47'; g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, base); g.lineTo(x + 10, base - 52); g.lineTo(x + w - 10, base - 52); g.lineTo(x + w, base); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#2a2d33'; g.fillRect(x + 10, base - 60, w - 20, 10); g.strokeRect(x + 10, base - 60, w - 20, 10);
    for (let i = 0; i < Math.floor(w / 26); i++) { g.fillStyle = ['#ff3b30', '#4cff9a', '#ffe14a', '#6fe3ff'][Math.floor(r() * 4)]; g.fillRect(x + 16 + i * 26, base - 40, 10, 7); }
    const n = Math.max(1, Math.floor(w / 90));
    for (let i = 0; i < n; i++) {
      const sx = x + 14 + i * ((w - 28) / n), sw = (w - 28) / n - 10;
      g.fillStyle = '#16171b'; g.fillRect(sx, base - 128, sw, 62); g.strokeRect(sx, base - 128, sw, 62);
      g.fillStyle = scr; g.fillRect(sx + 5, base - 123, sw - 10, 52);
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.beginPath();
      for (let k = 0; k <= 8; k++) { const px = sx + 8 + k * (sw - 16) / 8, py = base - 97 + Math.sin(k * 1.3 + r() * 6) * 12; if (k) g.lineTo(px, py); else g.moveTo(px, py); }
      g.stroke(); g.strokeStyle = OUT; g.lineWidth = 3;
      glowPool(g, sx + sw / 2, base - 97, sw * 0.8, 40, scr, 0.25);
    }
  }
  function pipeRun(g, x0, x1, y, r, col) {
    g.fillStyle = col; g.fillRect(x0, y - r, x1 - x0, r * 2);
    g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y - r); g.lineTo(x1, y - r); g.moveTo(x0, y + r); g.lineTo(x1, y + r); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x0, y - r + 3, x1 - x0, 3);
    for (let x = Math.ceil(x0 / 160) * 160; x < x1; x += 160) { g.fillStyle = TT.shade(col, -0.3); g.fillRect(x - 5, y - r - 3, 10, r * 2 + 6); g.strokeRect(x - 5, y - r - 3, 10, r * 2 + 6); }
  }
  function cableSag(g, xa, xb, y, sag, col, w) {
    g.strokeStyle = col || '#15121c'; g.lineWidth = w || 4;
    g.beginPath(); g.moveTo(xa, y); g.quadraticCurveTo((xa + xb) / 2, y + sag, xb, y); g.stroke();
  }
  function sign(g, x, y, w, h, text, bg, fg) {
    g.fillStyle = bg; g.strokeStyle = OUT; g.lineWidth = 3; g.fillRect(x - w / 2, y - h / 2, w, h); g.strokeRect(x - w / 2, y - h / 2, w, h);
    TT.drawText(g, text, x, y + 1, Math.min(h * 0.62, 20), fg || '#1c1a22', null, 'center', 0);
  }
  function rubble(g, x, base, n, cols, r) {
    for (let i = 0; i < n; i++) {
      const w = 14 + r() * 30, h = 10 + r() * 18, px = x + (r() - 0.5) * n * 16, py = base - r() * 8;
      g.fillStyle = TT.choice(cols); g.strokeStyle = OUT; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px - w / 2, py); g.lineTo(px - w * 0.3, py - h); g.lineTo(px + w * 0.25, py - h * 0.85); g.lineTo(px + w / 2, py); g.closePath(); g.fill(); g.stroke();
    }
  }
  function vent(g, x, y, w, h) {
    g.fillStyle = '#2a2d33'; g.strokeStyle = OUT; g.lineWidth = 3; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
    g.strokeStyle = '#5c6169'; g.lineWidth = 2; for (let yy = y + 6; yy < y + h - 3; yy += 6) { g.beginPath(); g.moveTo(x + 4, yy); g.lineTo(x + w - 4, yy); g.stroke(); }
  }
  function bench(g, x, base, col) {
    g.fillStyle = col || '#8a5a3a'; g.strokeStyle = OUT; g.lineWidth = 3;
    g.fillRect(x, base - 34, 110, 10); g.strokeRect(x, base - 34, 110, 10);
    g.fillRect(x + 4, base - 64, 102, 9); g.strokeRect(x + 4, base - 64, 102, 9);
    g.fillStyle = '#2a2d33'; for (const lx of [x + 8, x + 94]) { g.fillRect(lx, base - 64, 8, 64); g.strokeRect(lx, base - 64, 8, 64); }
  }
  // Poste de luz com halo.
  function lampPost(g, x, base, h, col) {
    g.fillStyle = '#1c1b26'; g.strokeStyle = OUT; g.lineWidth = 3;
    g.fillRect(x - 5, base - h, 10, h); g.strokeRect(x - 5, base - h, 10, h);
    g.fillRect(x - 12, base - 14, 24, 14); g.strokeRect(x - 12, base - 14, 24, 14);
    g.beginPath(); g.moveTo(x - 14, base - h); g.lineTo(x + 14, base - h); g.lineTo(x + 8, base - h - 22); g.lineTo(x - 8, base - h - 22); g.closePath(); g.fillStyle = '#fff3c0'; g.fill(); g.stroke();
    glowPool(g, x, base - h - 10, 70, 70, col, 0.5);
    lightCone(g, x, base - h, base + 40, 12, 90, col, 0.14);
    glowPool(g, x, base + 50, 120, 32, col, 0.22);
  }
  // Passada de luz e sombra comum: sombra onde a parede encontra o chão, chão escurecendo para a frente
  // da tela e vinheta leve nas bordas de cima.
  function ambientPass(g, x0, x1, tint) {
    const ao = g.createLinearGradient(0, FT - 36, 0, FT + 46);
    ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(0.45, 'rgba(0,0,0,0.28)'); ao.addColorStop(0.55, 'rgba(0,0,0,0.32)'); ao.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ao; g.fillRect(x0, FT - 36, x1 - x0, 82);
    const fl = g.createLinearGradient(0, FT + 60, 0, H);
    fl.addColorStop(0, 'rgba(0,0,0,0)'); fl.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = fl; g.fillRect(x0, FT + 60, x1 - x0, H - FT - 60);
    const top = g.createLinearGradient(0, 0, 0, 120);
    top.addColorStop(0, tint || 'rgba(0,0,0,0.25)'); top.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = top; g.fillRect(x0, 0, x1 - x0, 120);
  }
  // Primeiro plano da fase com a camada de detalhes e a passada de luz por cima.
  function detailed(near, det, tint) {
    return function (g, x0, x1, seed) {
      near(g, x0, x1, seed);
      g.save(); det(g, x0, x1); g.restore();
      ambientPass(g, x0, x1, tint);
    };
  }

  // Trecho [a, b) da fase: só pinta se o bloco toca o trecho (e recorta nele).
  function part(g, x0, x1, a, b, fn) { if (x1 > a && x0 < b) clipX(g, Math.max(x0, a), Math.min(x1, b), fn); }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  // ---------------------------------------------------------------- Fase 1 — Torre Titã
  // A sala dos Titãs: o janelão vira o telão (como na série) e o sofá semicircular fica de frente para ele.
  // wx = borda esquerda da janela do corredor (330 x 270, de y = 100 a 370).
  function titansCouch(g, wx, base) {
    const sc = g.createLinearGradient(0, 104, 0, 366); sc.addColorStop(0, '#3a6ad8'); sc.addColorStop(1, '#1a2a6a');
    g.fillStyle = sc; g.fillRect(wx + 4, 104, 322, 262);
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 2; for (let y = 108; y < 366; y += 6) { g.beginPath(); g.moveTo(wx + 4, y); g.lineTo(wx + 326, y); g.stroke(); }
    TT.drawText(g, 'GAME OVER', wx + 165, 200, 40, '#ffe14a', OUT, 'center', 7); // o videogame do Mutano e do Ciborgue
    TT.drawText(g, 'MUTANO 0  x  CIBORGUE 99', wx + 165, 252, 17, '#ffffff', OUT, 'center', 3);
    glowPool(g, wx + 165, 240, 240, 150, '#6fa8ff', 0.3);
    glowPool(g, wx + 165, FT + 50, 220, 40, '#6fa8ff', 0.2);
    // sofá em meia-lua
    const x = wx - 25;
    g.fillStyle = '#5a6a8a'; g.strokeStyle = OUT; g.lineWidth = 4;
    g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - 70); g.quadraticCurveTo(x + 190, base - 120, x + 380, base - 70); g.lineTo(x + 380, base); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#6e7fa2'; g.beginPath(); g.moveTo(x + 16, base - 30); g.quadraticCurveTo(x + 190, base - 76, x + 364, base - 30); g.lineTo(x + 364, base - 4); g.lineTo(x + 16, base - 4); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; for (const k of [0.33, 0.66]) { g.beginPath(); g.moveTo(x + 380 * k, base - 58); g.lineTo(x + 380 * k, base - 4); g.stroke(); }
    g.fillStyle = '#e8d2a8'; g.strokeStyle = OUT; g.lineWidth = 2.5; g.fillRect(x + 60, base - 48, 56, 12); g.strokeRect(x + 60, base - 48, 56, 12);
    TT.drawText(g, 'PIZZA', x + 88, base - 42, 9, '#c4162a', null, 'center', 0);
    g.fillStyle = '#2a2d33'; g.beginPath(); g.ellipse(x + 280, base - 44, 16, 7, 0.2, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  function d1(g, x0, x1) {
    part(g, x0, x1, -1e5, S1_INT, () => {
      cells(x0, x1, 760, 901, (cx, r) => {
        lampPost(g, cx + 120, FT + 4, 210, '#ffd98a');
        if (r() < 0.6) bench(g, cx + 220 + r() * 120, FT + 6);
        plant(g, cx + 520 + r() * 120, FT + 6, 0.9 + r() * 0.3, '#8a5a3a');
      });
      cells(x0, x1, 340, 903, (cx, r) => { // marcas da invasão: queimados e rachaduras no piso
        if (r() < 0.5) { g.fillStyle = 'rgba(30,20,20,0.22)'; g.beginPath(); g.ellipse(cx + r() * 200, FT + 90 + r() * 120, 70, 16, 0, 0, Math.PI * 2); g.fill(); }
        crack(g, cx + r() * 200, FT + 40 + r() * 170, 60 + r() * 60, 'rgba(60,40,30,0.35)', r);
      });
    });
    part(g, x0, x1, S1_INT, S1_OPS, () => {
      // luminárias do teto e vasos ao lado das portas
      cells(x0, x1, 280, 905, (cx) => { if (cx > S1_INT) hangLamp(g, cx + 140, 64, 96, '#bfe6ff', '#2f3658'); });
      cells(x0, x1, 560, 31, (cx, r) => { if (cx >= S1_INT && cx + 560 <= S1_OPS + 100) plant(g, cx + 400, FT + 6, 0.8, '#3a3d47'); });
      if (x0 < 3800 && x1 > 3370) titansCouch(g, 3420, FT + 6);
      if (x0 < 4500 && x1 > 4000) { // balcão da cozinha com pizzas empilhadas e o micro-ondas
        g.fillStyle = '#d9dde6'; g.strokeStyle = OUT; g.lineWidth = 4; g.fillRect(4060, FT - 90, 300, 96); g.strokeRect(4060, FT - 90, 300, 96);
        g.fillStyle = '#3a3d47'; g.fillRect(4050, FT - 100, 320, 14); g.strokeRect(4050, FT - 100, 320, 14);
        for (let i = 0; i < 4; i++) { g.fillStyle = '#e8d2a8'; g.fillRect(4090 - i * 3, FT - 116 - i * 12, 70, 11); g.strokeRect(4090 - i * 3, FT - 116 - i * 12, 70, 11); }
        g.fillStyle = '#c9cfd8'; g.fillRect(4240, FT - 160, 90, 58); g.strokeRect(4240, FT - 160, 90, 58); g.fillStyle = '#16171b'; g.fillRect(4250, FT - 150, 56, 38);
        g.fillStyle = '#4cff9a'; g.fillRect(4312, FT - 148, 10, 6);
      }
    });
    part(g, x0, x1, S1_OPS, 1e5, () => {
      cells(x0, x1, 520, 907, (cx, r) => consoleDesk(g, cx + 40, FT + 6, 240, pick(r, ['#2a7bff', '#1f9a6a', '#7a3ad8']), r));
      cells(x0, x1, 520, 909, (cx) => { g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(cx + 380, 80, 9, 0, Math.PI * 2); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); glowPool(g, cx + 380, 80, 60, 60, '#ff3b30', 0.45); });
    });
  }

  // ---------------------------------------------------------------- Fase 2 — Perfuratriz do Terror
  function mineCart(g, x, base) {
    g.fillStyle = '#6a4a32'; g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, base - 70); g.lineTo(x + 110, base - 70); g.lineTo(x + 98, base - 16); g.lineTo(x + 12, base - 16); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#8e8880'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + 18 + i * 18, base - 72, 10 + (i % 2) * 4, Math.PI, 0); g.fill(); g.stroke(); } // pedras
    g.fillStyle = '#2a2d33'; for (const wx of [x + 26, x + 84]) { g.beginPath(); g.arc(wx, base - 12, 11, 0, Math.PI * 2); g.fill(); g.stroke(); }
  }
  function hiveGraffiti(g, x, y, s) {
    g.save(); g.globalAlpha = 0.55; hiveLogo(g, x, y, 34 * s, 'rgba(240,198,46,0.8)', 'H', '#1c1a22'); g.restore();
    g.strokeStyle = 'rgba(240,198,46,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 40 * s, y + 46 * s); g.lineTo(x + 50 * s, y + 40 * s); g.stroke();
  }
  function d2(g, x0, x1) {
    part(g, x0, x1, -1e5, S2_LAB, () => {
      cells(x0, x1, 420, 911, (cx) => hangLamp(g, cx + 210, 0, 120, '#ffc870', '#5a4030'));
      cells(x0, x1, 900, 913, (cx, r) => {
        const k = r();
        if (k < 0.35) mineCart(g, cx + 80 + r() * 300, FT + 6);
        else if (k < 0.7) { crate(g, cx + 100, FT + 6, 70, 60, '#9a6a3a', 'TNT'); crate(g, cx + 172, FT + 6, 56, 48, '#8a5a2a'); crate(g, cx + 120, FT - 54, 52, 44, '#a87a4a'); }
        else { barrel(g, cx + 160, FT + 6, '#5a6a3a', null, true); barrel(g, cx + 210, FT + 6, '#6a5a3a'); }
        if (r() < 0.5) hiveGraffiti(g, cx + 600 + r() * 150, 250 + r() * 60, 0.9);
      });
      cells(x0, x1, 300, 915, (cx, r) => { // poças com o reflexo das lâmpadas e gotas no teto
        if (r() < 0.55) puddle(g, cx + r() * 220, FT + 60 + r() * 140, 50 + r() * 40, 'rgba(70,90,110,0.45)', 'rgba(255,220,150,0.5)');
        g.fillStyle = 'rgba(160,200,230,0.6)'; g.beginPath(); g.ellipse(cx + 80 + r() * 140, 40 + r() * 30, 3, 6, 0, 0, Math.PI * 2); g.fill();
      });
    });
    part(g, x0, x1, S2_LAB, 1e5, () => {
      cells(x0, x1, 480, 917, (cx, r) => consoleDesk(g, cx + 60, FT + 6, 220, '#1f9a6a', r));
      cells(x0, x1, 480, 919, (cx) => { g.fillStyle = '#ffe14a'; g.fillRect(cx + 330, FT - 140, 70, 34); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(cx + 330, FT - 140, 70, 34); TT.drawText(g, 'GIZMO', cx + 365, FT - 123, 14, '#1c1a22', null, 'center', 0); });
    });
  }

  // ---------------------------------------------------------------- Fase 3 — Usina de Energia
  function gaugePanel(g, x, y, r) {
    g.fillStyle = '#4a5468'; g.strokeStyle = OUT; g.lineWidth = 3; g.fillRect(x, y, 120, 90); g.strokeRect(x, y, 120, 90);
    for (let i = 0; i < 3; i++) {
      const gx = x + 22 + i * 38, gy = y + 32;
      g.fillStyle = '#f2f5ff'; g.beginPath(); g.arc(gx, gy, 14, 0, Math.PI * 2); g.fill(); g.stroke();
      const a = -2.4 + r() * 2.2; g.strokeStyle = '#c4162a'; g.lineWidth = 2; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + Math.cos(a) * 11, gy + Math.sin(a) * 11); g.stroke(); g.strokeStyle = OUT; g.lineWidth = 3;
    }
    for (let i = 0; i < 4; i++) { g.fillStyle = i === 3 && r() < 0.5 ? '#ff3b30' : '#4cff9a'; g.fillRect(x + 16 + i * 26, y + 64, 14, 10); }
  }
  function d3(g, x0, x1) {
    part(g, x0, x1, -1e5, S3_HALL, () => {
      cells(x0, x1, 360, 921, (cx, r) => { // poças refletindo a lua e marcas de queimado dos raios
        if (r() < 0.6) puddle(g, cx + r() * 220, FT + 70 + r() * 130, 55 + r() * 35, 'rgba(60,80,120,0.45)', 'rgba(230,240,255,0.55)');
        if (r() < 0.4) { g.fillStyle = 'rgba(20,20,30,0.3)'; g.beginPath(); g.ellipse(cx + r() * 200, FT + 50 + r() * 150, 46, 12, 0, 0, Math.PI * 2); g.fill(); }
      });
      cells(x0, x1, 820, 923, (cx, r) => {
        if (r() < 0.5) { barrel(g, cx + 640, FT + 6, '#c9a02a', '#2a2d33', true); barrel(g, cx + 692, FT + 6, '#c9a02a', '#2a2d33'); }
        else crate(g, cx + 620, FT + 6, 90, 70, '#5c6a86', 'ALTA');
      });
    });
    part(g, x0, x1, S3_HALL, S3_CORE, () => {
      cells(x0, x1, 540, 925, (cx, r) => gaugePanel(g, cx + 360, FT - 190, r));
      cells(x0, x1, 270, 927, (cx) => hangLamp(g, cx + 135, 70, 140, '#cfe8ff', '#3a4458'));
      cells(x0, x1, 400, 929, (cx, r) => { // cabos grossos atravessando o chão
        g.strokeStyle = 'rgba(15,15,25,0.55)'; g.lineWidth = 9; g.beginPath(); const y = FT + 40 + r() * 140; g.moveTo(cx, y); g.bezierCurveTo(cx + 120, y - 30, cx + 260, y + 30, cx + 400, y); g.stroke();
      });
    });
    part(g, x0, x1, S3_CORE, 1e5, () => {
      cells(x0, x1, 300, 931, (cx) => glowPool(g, cx + 150, FT + 60, 160, 40, '#6fe3ff', 0.35));
      cells(x0, x1, 600, 933, (cx, r) => consoleDesk(g, cx + 360, FT + 6, 200, '#2a7bff', r));
    });
  }

  // ---------------------------------------------------------------- Fase 4 — Fábrica de Gosma
  function pallet(g, x, base, r) {
    g.fillStyle = '#9a6a3a'; g.strokeStyle = OUT; g.lineWidth = 3; g.fillRect(x, base - 12, 130, 12); g.strokeRect(x, base - 12, 130, 12);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 5 - row; i++) jar(g, x + 18 + i * 24 + row * 12, base - 12 - row * 34, pick(r, ['#ff5ab4', '#b8ff5a', '#6fe3ff']));
  }
  function d4(g, x0, x1) {
    part(g, x0, x1, -1e5, S4_LAB, () => {
      cells(x0, x1, 300, 941, (cx, r) => { // poças de gosma brilhando
        if (r() < 0.55) { const x = cx + r() * 200, y = FT + 60 + r() * 140; puddle(g, x, y, 40 + r() * 40, 'rgba(226,90,180,0.55)', 'rgba(255,220,240,0.8)'); glowPool(g, x, y, 70, 18, '#ff5ab4', 0.25); }
      });
      cells(x0, x1, 900, 943, (cx, r) => {
        const k = r();
        if (k < 0.4) pallet(g, cx + 600, FT + 6, r);
        else if (k < 0.75) { barrel(g, cx + 640, FT + 6, '#e05aa8', '#5a1040', true); barrel(g, cx + 692, FT + 6, '#e05aa8', '#5a1040'); barrel(g, cx + 666, FT - 60, '#b8ff5a', '#2a5a10'); }
        else sign(g, cx + 680, FT - 140, 150, 40, 'CUIDADO: GOSMA', '#ffe14a');
      });
    });
    part(g, x0, x1, S4_LAB, 1e5, () => {
      cells(x0, x1, 260, 945, (cx, r) => { // cacos de vidro do tanque estourado
        for (let i = 0; i < 4; i++) { const x = cx + r() * 240, y = FT + 40 + r() * 170; g.fillStyle = 'rgba(200,240,255,0.55)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y - 4); g.lineTo(x + 6, y + 6); g.closePath(); g.fill(); }
      });
      cells(x0, x1, 560, 947, (cx) => { g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(cx + 280, 60, 10, 0, Math.PI * 2); g.fill(); glowPool(g, cx + 280, 60, 90, 90, '#ff3b30', 0.5); });
    });
  }

  // ---------------------------------------------------------------- Fase 5 — Academia H.I.V.E.
  function candelabra(g, x, base) {
    g.fillStyle = '#c9a02a'; g.strokeStyle = OUT; g.lineWidth = 3;
    g.fillRect(x - 4, base - 150, 8, 150); g.strokeRect(x - 4, base - 150, 8, 150); g.fillRect(x - 22, base - 10, 44, 10); g.strokeRect(x - 22, base - 10, 44, 10);
    g.beginPath(); g.moveTo(x - 34, base - 150); g.quadraticCurveTo(x, base - 120, x + 34, base - 150); g.lineWidth = 6; g.strokeStyle = '#c9a02a'; g.stroke();
    for (const dx of [-34, 0, 34]) { g.fillStyle = '#f2ead8'; g.fillRect(x + dx - 4, base - 176, 8, 24); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(x + dx - 4, base - 176, 8, 24); g.fillStyle = '#ffb020'; g.beginPath(); g.ellipse(x + dx, base - 184, 4, 8, 0, 0, Math.PI * 2); g.fill(); glowPool(g, x + dx, base - 184, 40, 40, '#ff7a1a', 0.55); }
  }
  function d5(g, x0, x1) {
    part(g, x0, x1, -1e5, S5_HALL, () => {
      cells(x0, x1, 700, 951, (cx, r) => { // cercas vivas aparadas em hexágono e marcas no pátio
        const x = cx + 200 + r() * 200;
        g.fillStyle = '#2e6a3e'; g.strokeStyle = OUT; g.lineWidth = 3; hexPath(g, x, FT - 40, 46); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.12)'; hexPath(g, x - 8, FT - 50, 26); g.fill();
        g.fillStyle = '#5a4030'; g.fillRect(x - 6, FT - 4, 12, 10);
      });
      cells(x0, x1, 320, 953, (cx, r) => { if (r() < 0.5) puddle(g, cx + r() * 220, FT + 70 + r() * 130, 50, 'rgba(60,40,90,0.45)', 'rgba(255,225,120,0.55)'); });
    });
    part(g, x0, x1, S5_HALL, S5_THRONE, () => {
      // mesmo padrão do corredor (blocos de 600: armários, porta e cartaz): faixa acima dos armários,
      // banco na frente deles e bebedouro ao lado da porta
      const quotes = ['PLANO MALIGNO: PASSO 2 = LUCRO', 'VILANIA 101 — PROVA NA SEXTA', 'TITÃS 0 x H.I.V.E. 1', 'OBEDEÇA AO DIRETOR', 'SEJA MAU. SEJA H.I.V.E.'];
      cells(x0, x1, 600, 233, (cx, r, i) => {
        if (cx < S5_HALL - 100 || cx + 560 > S5_THRONE) return;
        g.fillStyle = '#2a1c3a'; g.strokeStyle = '#f0c62e'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(cx + 40, 178); g.lineTo(cx + 308, 178); g.lineTo(cx + 300, 206); g.lineTo(cx + 308, 234); g.lineTo(cx + 40, 234); g.lineTo(cx + 48, 206); g.closePath(); g.fill(); g.stroke();
        TT.drawText(g, quotes[((i % quotes.length) + quotes.length) % quotes.length], cx + 174, 207, 15, '#f0c62e', OUT, 'center', 3);
        if (((i % 2) + 2) % 2 === 0) bench(g, cx + 120, FT + 6, '#5a3a2a');
        // bebedouro
        const fx = cx + 488;
        g.fillStyle = '#c9cfd8'; g.strokeStyle = OUT; g.lineWidth = 3; g.fillRect(fx, FT - 110, 50, 40); g.strokeRect(fx, FT - 110, 50, 40);
        g.fillStyle = '#8a909a'; g.fillRect(fx + 18, FT - 70, 14, 76); g.strokeRect(fx + 18, FT - 70, 14, 76);
        g.fillStyle = '#6fe3ff'; g.beginPath(); g.ellipse(fx + 25, FT - 106, 14, 4, 0, 0, Math.PI * 2); g.fill();
      });
    });
    part(g, x0, x1, S5_THRONE, 1e5, () => {
      cells(x0, x1, 420, 959, (cx) => candelabra(g, cx + 210, FT + 6));
      g.fillStyle = 'rgba(160,10,30,0.45)'; g.fillRect(x0, FT + 70, x1 - x0, 90); // passadeira vermelha
      g.fillStyle = 'rgba(240,198,46,0.5)'; g.fillRect(x0, FT + 70, x1 - x0, 5); g.fillRect(x0, FT + 155, x1 - x0, 5);
    });
  }

  // ---------------------------------------------------------------- Fase 6 — O Show do Mumbo
  function hydrant(g, x, base) {
    g.fillStyle = '#d7263e'; g.strokeStyle = OUT; g.lineWidth = 3;
    g.fillRect(x - 12, base - 50, 24, 50); g.strokeRect(x - 12, base - 50, 24, 50);
    g.beginPath(); g.arc(x, base - 50, 14, Math.PI, 0); g.fill(); g.stroke();
    g.fillRect(x - 20, base - 36, 40, 10); g.strokeRect(x - 20, base - 36, 40, 10);
    g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x - 8, base - 48, 4, 40);
  }
  function trashCan(g, x, base) {
    g.fillStyle = '#5c6169'; g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x - 22, base - 60); g.lineTo(x + 22, base - 60); g.lineTo(x + 18, base); g.lineTo(x - 18, base); g.closePath(); g.fill(); g.stroke();
    g.fillRect(x - 26, base - 68, 52, 10); g.strokeRect(x - 26, base - 68, 52, 10);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; for (const dx of [-10, 0, 10]) { g.beginPath(); g.moveTo(x + dx, base - 54); g.lineTo(x + dx * 0.8, base - 6); g.stroke(); }
  }
  function dressingMirror(g, x, y) {
    g.fillStyle = '#3a2a1c'; g.strokeStyle = OUT; g.lineWidth = 4; g.fillRect(x, y, 160, 120); g.strokeRect(x, y, 160, 120);
    g.fillStyle = 'rgba(180,200,230,0.5)'; g.fillRect(x + 16, y + 16, 128, 88);
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 30, y + 90); g.lineTo(x + 70, y + 30); g.stroke();
    for (let i = 0; i < 6; i++) for (const [bx, by] of [[x + 8 + i * 29, y + 4], [x + 8 + i * 29, y + 116]]) { g.fillStyle = '#fff3c0'; g.beginPath(); g.arc(bx, by, 5, 0, Math.PI * 2); g.fill(); glowPool(g, bx, by, 18, 18, '#ffd98a', 0.6); }
  }
  function costumeRack(g, x, base, r) {
    g.strokeStyle = '#2a2d33'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - 170); g.lineTo(x + 150, base - 170); g.lineTo(x + 150, base); g.stroke();
    for (let i = 0; i < 5; i++) {
      const cx = x + 18 + i * 28, col = pick(r, ['#7a3ad8', '#d7263e', '#1f9a6a', '#2a7bff', '#f0c62e']);
      g.fillStyle = col; g.strokeStyle = OUT; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(cx - 12, base - 160); g.lineTo(cx + 12, base - 160); g.lineTo(cx + 16, base - 70); g.lineTo(cx - 16, base - 70); g.closePath(); g.fill(); g.stroke();
    }
  }
  function d6(g, x0, x1) {
    part(g, x0, x1, -1e5, S6_STAGE, () => {
      cells(x0, x1, 820, 961, (cx, r) => {
        hydrant(g, cx + 130, FT + 6);
        trashCan(g, cx + 420 + r() * 120, FT + 6);
        poster(g, cx + 600, 230, 100, 140, '#1c1a40', (pg, px, py, w, h) => { TT.drawTopHat(pg, px + w / 2, py + 70, 0.9, false); TT.drawText(pg, 'MUMBO!', px + w / 2, py + 112, 18, '#ffe14a', OUT, 'center', 4); TT.drawText(pg, 'HOJE!', px + w / 2, py + 22, 14, '#ff5ab4', OUT, 'center', 3); }, (r() - 0.5) * 0.1);
      });
      cells(x0, x1, 300, 963, (cx, r) => { if (r() < 0.65) { const x = cx + r() * 220, y = FT + 90 + r() * 110; puddle(g, x, y, 50 + r() * 30, 'rgba(40,40,80,0.5)', pick(r, ['rgba(255,225,74,0.7)', 'rgba(255,90,180,0.7)'])); } });
    });
    part(g, x0, x1, S6_STAGE, S6_HAT, () => {
      cells(x0, x1, 900, 965, (cx, r) => {
        if (r() < 0.5) dressingMirror(g, cx + 560, 200); else costumeRack(g, cx + 560, FT + 6, r);
        crate(g, cx + 790, FT + 6, 84, 64, '#5a3a2a', 'MUMBO');
      });
      cells(x0, x1, 360, 967, (cx, r) => { // sacos de areia e cordas penduradas
        g.strokeStyle = '#a88a5a'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 180, 0); g.lineTo(cx + 180, 140 + r() * 60); g.stroke();
        g.fillStyle = '#c9b48a'; g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx + 180, 160 + r() * 60, 16, 22, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      });
    });
    part(g, x0, x1, S6_HAT, 1e5, () => {
      cells(x0, x1, 340, 969, (cx, r) => { // estrelas, pombas e dados flutuando no mundo da cartola
        for (let i = 0; i < 3; i++) TT.drawBurst(g, cx + r() * 320, 60 + r() * 300, 8 + r() * 8, 5, pick(r, ['#ffe14a', '#ffffff', '#ff8ad6']), OUT, r());
        if (r() < 0.6) { const x = cx + r() * 300, y = 120 + r() * 200; g.fillStyle = '#ffffff'; g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.ellipse(x, y, 20, 11, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.beginPath(); g.moveTo(x - 4, y - 4); g.quadraticCurveTo(x - 10, y - 28, x + 14, y - 24); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.arc(x + 18, y - 6, 7, 0, Math.PI * 2); g.fill(); g.stroke(); }
        if (r() < 0.4) { const x = cx + r() * 300, y = 100 + r() * 220; g.save(); g.translate(x, y); g.rotate(r()); g.fillStyle = '#ffffff'; g.strokeStyle = OUT; g.lineWidth = 3; g.fillRect(-18, -18, 36, 36); g.strokeRect(-18, -18, 36, 36); g.fillStyle = OUT; for (const [a, b] of [[-9, -9], [9, 9], [0, 0]]) { g.beginPath(); g.arc(a, b, 3.5, 0, Math.PI * 2); g.fill(); } g.restore(); }
      });
    });
  }

  // ---------------------------------------------------------------- Fase 7 — O Covil do Slade
  function carWreck(g, x, base) {
    g.save(); g.translate(x, base); g.rotate(-0.08);
    g.fillStyle = '#3a3440'; g.strokeStyle = OUT; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, -20); g.lineTo(20, -60); g.lineTo(120, -66); g.lineTo(160, -36); g.lineTo(200, -32); g.lineTo(200, -6); g.lineTo(0, -6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#16171b'; g.fillRect(40, -56, 70, 22);
    g.fillStyle = '#2a2d33'; for (const wx of [40, 160]) { g.beginPath(); g.arc(wx, -6, 18, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.restore();
    TT.drawFlame(g, x + 80, base - 60, 70, 3, 1); TT.drawFlame(g, x + 130, base - 64, 50, 7, 2);
    glowPool(g, x + 100, base - 70, 140, 110, '#ff7a1a', 0.45);
  }
  function workbench(g, x, base) {
    g.fillStyle = '#5a4030'; g.strokeStyle = OUT; g.lineWidth = 4; g.fillRect(x, base - 76, 220, 14); g.strokeRect(x, base - 76, 220, 14);
    g.fillStyle = '#2a2d33'; for (const lx of [x + 10, x + 196]) { g.fillRect(lx, base - 62, 14, 62); g.strokeRect(lx, base - 62, 14, 62); }
    // cabeças de robô do Slade e ferramentas na bancada
    for (let i = 0; i < 2; i++) { const hx = x + 50 + i * 90; g.fillStyle = '#2a2d33'; g.beginPath(); g.arc(hx, base - 98, 20, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#ff7a1a'; g.fillRect(hx - 2, base - 104, 18, 6); }
    g.strokeStyle = '#8a909a'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 150, base - 84); g.lineTo(x + 200, base - 92); g.stroke();
    glowPool(g, x + 110, base - 90, 120, 50, '#ffb070', 0.25);
  }
  function torch(g, x, y) {
    g.fillStyle = '#3a2a1c'; g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x + 10, y); g.lineTo(x + 5, y + 40); g.lineTo(x - 5, y + 40); g.closePath(); g.fill(); g.stroke();
    TT.drawFlame(g, x, y + 2, 46, 5, x % 7); glowPool(g, x, y - 16, 120, 120, '#ff7a1a', 0.5);
  }
  function d7(g, x0, x1) {
    part(g, x0, x1, -1e5, S7_LAIR, () => {
      cells(x0, x1, 1100, 971, (cx, r) => {
        if (r() < 0.6) carWreck(g, cx + 640, FT + 6);
        rubble(g, cx + 300, FT + 8, 7, ['#6a5a52', '#8e8880', '#4a3a3a'], r);
        if (r() < 0.6) { g.save(); g.translate(cx + 900, FT + 6); g.rotate(0.5); g.fillStyle = '#5c6169'; g.strokeStyle = OUT; g.lineWidth = 3; g.fillRect(-4, -150, 8, 150); g.strokeRect(-4, -150, 8, 150); g.fillStyle = '#2a7a3a'; g.fillRect(-46, -160, 92, 28); g.strokeRect(-46, -160, 92, 28); TT.drawText(g, 'RUA 7', 0, -146, 14, '#ffffff', null, 'center', 0); g.restore(); }
      });
      cells(x0, x1, 260, 973, (cx, r) => rubble(g, cx + r() * 200, FT + 60 + r() * 140, 2, ['rgba(80,60,60,0.7)', 'rgba(110,90,80,0.7)'], r));
    });
    part(g, x0, x1, S7_LAIR, S7_THRONE, () => {
      cells(x0, x1, 760, 975, (cx, r) => workbench(g, cx + 470, FT + 6));
      cells(x0, x1, 380, 977, (cx, r) => { g.strokeStyle = '#2a2d33'; g.lineWidth = 5; const len = 120 + r() * 120; for (let y = 70; y < 70 + len; y += 16) { g.beginPath(); g.ellipse(cx + 120, y, 5, 9, 0, 0, Math.PI * 2); g.stroke(); } g.fillStyle = '#5c6169'; g.beginPath(); g.moveTo(cx + 110, 70 + len); g.lineTo(cx + 130, 70 + len); g.lineTo(cx + 120, 90 + len); g.closePath(); g.fill(); });
      cells(x0, x1, 300, 979, (cx, r) => { if (r() < 0.5) puddle(g, cx + r() * 220, FT + 70 + r() * 130, 50, 'rgba(30,20,20,0.5)', 'rgba(255,150,60,0.6)'); });
    });
    part(g, x0, x1, S7_THRONE, 1e5, () => {
      cells(x0, x1, 360, 981, (cx) => torch(g, cx + 180, 200));
    });
  }

  // ---------------------------------------------------------------- Fase 8 — A Base da Irmandade
  function snowmobile(g, x, base) {
    g.fillStyle = '#c4162a'; g.strokeStyle = OUT; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, base - 30); g.lineTo(x + 40, base - 62); g.lineTo(x + 120, base - 62); g.lineTo(x + 150, base - 34); g.lineTo(x + 150, base - 20); g.lineTo(x, base - 20); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#16171b'; g.fillRect(x + 50, base - 78, 30, 16); g.strokeRect(x + 50, base - 78, 30, 16);
    g.fillStyle = '#2a2d33'; g.fillRect(x + 6, base - 20, 140, 14); g.strokeRect(x + 6, base - 20, 140, 14);
    g.strokeStyle = '#8a909a'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 10, base - 2); g.lineTo(x + 60, base - 2); g.stroke();
    g.fillStyle = SNOW; g.beginPath(); g.ellipse(x + 80, base - 62, 46, 6, 0, 0, Math.PI * 2); g.fill();
  }
  function snowman(g, x, base) {
    g.fillStyle = SNOW; g.strokeStyle = OUT; g.lineWidth = 3;
    for (const [dy, rr] of [[-30, 30], [-82, 23], [-122, 17]]) { g.beginPath(); g.arc(x, base + dy, rr, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.fillStyle = '#ff7a1a'; g.beginPath(); g.moveTo(x + 4, base - 122); g.lineTo(x + 28, base - 118); g.lineTo(x + 4, base - 116); g.fill();
    g.fillStyle = OUT; g.beginPath(); g.arc(x - 6, base - 128, 2.5, 0, Math.PI * 2); g.arc(x + 6, base - 128, 2.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = B_RED; g.fillRect(x - 22, base - 108, 44, 8); // cachecol vermelho da Irmandade
  }
  function d8(g, x0, x1) {
    part(g, x0, x1, -1e5, S8_HANGAR, () => {
      cells(x0, x1, 1000, 991, (cx, r) => {
        const k = r();
        if (k < 0.4) snowmobile(g, cx + 650, FT + 6);
        else if (k < 0.65) snowman(g, cx + 700, FT + 6);
        else { crate(g, cx + 640, FT + 6, 80, 64, '#5c6a86', 'B'); g.fillStyle = SNOW; g.fillRect(cx + 636, FT - 62, 88, 10); }
      });
      cells(x0, x1, 240, 993, (cx, r) => { // pegadas na neve
        let x = cx + r() * 60, y = FT + 60 + r() * 140;
        g.fillStyle = 'rgba(150,170,200,0.45)';
        for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(x, y + (i % 2 ? 10 : -10), 8, 4, 0, 0, Math.PI * 2); g.fill(); x += 34; }
      });
    });
    part(g, x0, x1, S8_HANGAR, S8_LAB, () => {
      cells(x0, x1, 700, 995, (cx, r) => {
        if (r() < 0.5) consoleDesk(g, cx + 420, FT + 6, 200, '#5fc8ff', r);
        else { crate(g, cx + 430, FT + 6, 90, 70, '#4a566e', 'B'); crate(g, cx + 524, FT + 6, 70, 54, '#5c6a86'); }
      });
      cells(x0, x1, 340, 997, (cx, r) => { // névoa fria no chão e cabos
        glowPool(g, cx + 170, FT + 40, 200, 30, '#cfefff', 0.18);
        g.strokeStyle = 'rgba(10,10,20,0.5)'; g.lineWidth = 7; g.beginPath(); const y = FT + 70 + r() * 120; g.moveTo(cx, y); g.bezierCurveTo(cx + 120, y + 20, cx + 220, y - 30, cx + 340, y); g.stroke();
      });
    });
    part(g, x0, x1, S8_LAB, 1e5, () => {
      cells(x0, x1, 520, 999, (cx, r) => consoleDesk(g, cx + 300, FT + 6, 180, '#4cff9a', r));
      cells(x0, x1, 300, 1001, (cx, r) => { if (r() < 0.6) puddle(g, cx + r() * 220, FT + 70 + r() * 130, 46, 'rgba(60,140,100,0.45)', 'rgba(180,255,210,0.7)'); });
    });
  }

  // =============================================================== FASE 9 — O Canal do Control Freak
  // A rua do Cine Jump e da loja de eletrônicos à noite, o estúdio do Canal 9 (que ele tomou com o controle
  // remoto) e o porão dele: pôsteres, bonecos, pilhas de quadrinhos e o telão gigante.
  const S9_STUDIO = 2700, S9_LAIR = 5850;
  const BARS = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];

  // Barras coloridas de teste de TV (fora do ar).
  function colorBars(g, x, y, w, h) {
    const bw = w / BARS.length;
    BARS.forEach((c, i) => { g.fillStyle = c; g.fillRect(x + i * bw, y, bw + 0.5, h * 0.72); });
    ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'].forEach((c, i) => { g.fillStyle = c; g.fillRect(x + i * bw, y + h * 0.72, bw + 0.5, h * 0.08); });
    g.fillStyle = '#1d1d4a'; g.fillRect(x, y + h * 0.8, w * 0.3, h * 0.2);
    g.fillStyle = '#f0f0f0'; g.fillRect(x + w * 0.3, y + h * 0.8, w * 0.25, h * 0.2);
    g.fillStyle = '#131313'; g.fillRect(x + w * 0.55, y + h * 0.8, w * 0.45, h * 0.2);
  }
  // Chuvisco de TV fora de sintonia.
  function staticNoise(g, x, y, w, h, r) {
    g.fillStyle = '#5a5a66'; g.fillRect(x, y, w, h);
    for (let i = 0; i < w * h / 40; i++) { const v = Math.floor(120 + r() * 135); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(x + r() * (w - 3), y + r() * (h - 2), 3, 2); }
  }
  // TV de tubo com antena; screen: 'bars' | 'static' | cor sólida. Brilho da tela no ar em volta.
  function crtTV(g, x, base, w, h, screen, r, antenna) {
    const y = base - h;
    g.fillStyle = '#4a3a30'; g.strokeStyle = OUT; g.lineWidth = 3;
    if (g.roundRect) { g.beginPath(); g.roundRect(x, y, w, h, 8); g.fill(); g.stroke(); } else { g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h); }
    const sx = x + 8, sy = y + 8, sw = w * 0.72, sh = h - 16;
    if (screen === 'bars') colorBars(g, sx, sy, sw, sh);
    else if (screen === 'static') staticNoise(g, sx, sy, sw, sh, r);
    else { g.fillStyle = screen; g.fillRect(sx, sy, sw, sh); }
    g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(sx, sy, sw, sh);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(sx + 3, sy + 3, sw * 0.3, 4);
    for (let i = 0; i < 2; i++) { g.fillStyle = '#c9b48a'; g.beginPath(); g.arc(x + w * 0.86, y + 18 + i * 18, 5, 0, Math.PI * 2); g.fill(); g.stroke(); } // botões
    g.fillStyle = '#2a2d33'; for (let i = 0; i < 3; i++) g.fillRect(x + w * 0.8, y + h - 26 + i * 6, w * 0.13, 3);
    if (antenna) { g.strokeStyle = '#8a909a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2 - 30, y - 40); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2 + 26, y - 44); g.stroke(); }
    glowPool(g, sx + sw / 2, sy + sh / 2, sw, sh * 0.9, screen === 'static' ? '#c8d0ff' : '#8ab0ff', 0.25);
  }
  // Logo do Control Freak: "CF" num controle remoto estilizado.
  function freakLogo(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = '#2a2d33'; g.strokeStyle = OUT; g.lineWidth = 4;
    if (g.roundRect) { g.beginPath(); g.roundRect(-22, -50, 44, 100, 14); g.fill(); g.stroke(); } else { g.fillRect(-22, -50, 44, 100); g.strokeRect(-22, -50, 44, 100); }
    g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(0, -32, 8, 0, Math.PI * 2); g.fill(); g.stroke();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.fillStyle = ['#ffe14a', '#5fc8ff', '#7bff8a'][i]; g.fillRect(-14 + j * 16, -14 + i * 16, 12, 10); }
    TT.drawText(g, 'CF', 0, 38, 20, '#ffe14a', OUT, 'center', 4);
    g.restore();
  }
  // Pôster de filme (ficção científica dos anos 50 que o Control Freak adora).
  function moviePoster(g, x, y, w, h, r, tilt) {
    const k = Math.floor(r() * 3);
    poster(g, x, y, w, h, ['#1a2a6a', '#5a1030', '#103a2a'][k], (pg, px, py, pw, ph) => {
      if (k === 0) { // disco voador
        pg.fillStyle = '#c9d3e2'; pg.beginPath(); pg.ellipse(px + pw / 2, py + ph * 0.42, pw * 0.36, ph * 0.08, 0, 0, Math.PI * 2); pg.fill(); pg.stroke();
        pg.fillStyle = '#7bff8a'; pg.beginPath(); pg.ellipse(px + pw / 2, py + ph * 0.38, pw * 0.14, ph * 0.08, 0, Math.PI, 0); pg.fill();
        pg.fillStyle = 'rgba(255,255,160,0.5)'; pg.beginPath(); pg.moveTo(px + pw * 0.42, py + ph * 0.48); pg.lineTo(px + pw * 0.2, py + ph * 0.82); pg.lineTo(px + pw * 0.8, py + ph * 0.82); pg.lineTo(px + pw * 0.58, py + ph * 0.48); pg.fill();
      } else if (k === 1) { // monstro gigante
        pg.fillStyle = '#3a8a4e'; pg.beginPath(); pg.ellipse(px + pw / 2, py + ph * 0.55, pw * 0.3, ph * 0.3, 0, 0, Math.PI * 2); pg.fill(); pg.stroke();
        pg.fillStyle = '#ffe14a'; pg.beginPath(); pg.arc(px + pw * 0.42, py + ph * 0.45, 4, 0, Math.PI * 2); pg.arc(px + pw * 0.58, py + ph * 0.45, 4, 0, Math.PI * 2); pg.fill();
      } else { // robô
        pg.fillStyle = '#9aa3b2'; pg.fillRect(px + pw * 0.3, py + ph * 0.3, pw * 0.4, ph * 0.4); pg.strokeRect(px + pw * 0.3, py + ph * 0.3, pw * 0.4, ph * 0.4);
        pg.fillStyle = '#ff3b30'; pg.fillRect(px + pw * 0.36, py + ph * 0.4, pw * 0.28, ph * 0.06);
      }
      TT.drawText(pg, ['INVASORES!', 'O MONSTRO', 'ROBÔ 3000'][k], px + pw / 2, py + ph * 0.12, Math.min(14, pw * 0.16), '#ffe14a', OUT, 'center', 3);
    }, tilt);
  }

  function s9Far(g, x0, x1) {
    const sky = g.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, '#0c0624'); sky.addColorStop(0.55, '#2a1458'); sky.addColorStop(1, '#6a2a7a');
    g.fillStyle = sky; g.fillRect(x0, 0, x1 - x0, H);
    cells(x0, x1, 90, 901, (cx, r) => { g.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.5) + ')'; g.fillRect(cx + r() * 90, r() * 220, 2, 2); });
    // lua cheia
    cells(x0, x1, 2400, 903, (cx) => { glowPool(g, cx + 600, 110, 160, 160, '#fff3c0', 0.35); g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(cx + 600, 110, 44, 0, Math.PI * 2); g.fill(); });
    // prédios distantes com antenas de TV
    cells(x0, x1, 150, 905, (cx, r) => {
      const h = 140 + r() * 180, w = 90 + r() * 50, x = cx + r() * 40, top = 440 - h;
      g.fillStyle = '#1c1240'; g.fillRect(x, top, w, h);
      g.fillStyle = 'rgba(255,220,140,0.5)'; for (let yy = top + 12; yy < 430; yy += 22) for (let xx = x + 8; xx < x + w - 10; xx += 18) if (r() < 0.35) g.fillRect(xx, yy, 8, 10);
      if (r() < 0.6) { g.strokeStyle = '#2c2058'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + w / 2, top); g.lineTo(x + w / 2, top - 40); g.moveTo(x + w / 2 - 16, top - 30); g.lineTo(x + w / 2 + 16, top - 30); g.moveTo(x + w / 2 - 10, top - 18); g.lineTo(x + w / 2 + 10, top - 18); g.stroke(); }
    });
    g.fillStyle = '#140c30'; g.fillRect(x0, 440, x1 - x0, H - 440);
  }

  function s9Mid(g, x0, x1) {
    // torre de transmissão do Canal 9 com a luz vermelha no alto
    cells(x0, x1, 1500, 911, (cx) => {
      const x = cx + 700, base = 470;
      g.strokeStyle = '#3a2c66'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(x - 60, base); g.lineTo(x, base - 400); g.lineTo(x + 60, base); g.stroke();
      g.lineWidth = 3; for (let y = base - 40; y > base - 380; y -= 40) { const w = 60 * (base - y) / 400; g.beginPath(); g.moveTo(x - 60 + w, y); g.lineTo(x + 60 - w, y - 40); g.moveTo(x + 60 - w, y); g.lineTo(x - 60 + w, y - 40); g.stroke(); }
      g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(x, base - 404, 7, 0, Math.PI * 2); g.fill();
      glowPool(g, x, base - 404, 40, 40, '#ff3b30', 0.6);
      sign(g, x, base - 200, 90, 34, 'CANAL 9', '#ffe14a');
    });
    cells(x0, x1, 420, 913, (cx, r) => { // prédios mais perto, com parabólicas
      const x = cx + r() * 120, w = 200 + r() * 80, h = 160 + r() * 90, top = 470 - h;
      g.fillStyle = '#2a1c52'; g.strokeStyle = OUT; g.lineWidth = 3; g.fillRect(x, top, w, h); g.strokeRect(x, top, w, h);
      for (let yy = top + 16; yy < 450; yy += 30) for (let xx = x + 12; xx < x + w - 20; xx += 30) { g.fillStyle = r() < 0.4 ? '#7a8aff' : r() < 0.5 ? '#ffd98a' : '#1c1240'; g.fillRect(xx, yy, 16, 18); }
      g.fillStyle = '#9aa3b2'; g.beginPath(); g.ellipse(x + w * 0.7, top - 14, 22, 12, -0.5, 0, Math.PI * 2); g.fill(); g.stroke();
    });
  }

  function s9Near(g, x0, x1) {
    // --- rua: fachada do Cine Jump e da loja de eletrônicos com a vitrine cheia de TVs
    part(g, x0, x1, -1e5, S9_STUDIO, () => {
      cells(x0, x1, 900, 921, (cx, r) => {
        const fx = cx + 40;
        // cinema: fachada vermelha, letreiro com lâmpadas e cartazes
        g.fillStyle = '#7a1a2a'; g.strokeStyle = OUT; g.lineWidth = 4; g.fillRect(fx, 120, 400, FT - 120); g.strokeRect(fx, 120, 400, FT - 120);
        g.fillStyle = '#f2e6c8'; g.fillRect(fx + 30, 150, 340, 70); g.strokeRect(fx + 30, 150, 340, 70);
        TT.drawText(g, 'CINE JUMP', fx + 200, 104, 34, '#ffe14a', OUT, 'center', 6);
        TT.drawText(g, 'HOJE: A VINGANÇA', fx + 200, 172, 20, '#1c1a22', null, 'center', 0);
        TT.drawText(g, 'DO CONTROLE REMOTO', fx + 200, 200, 20, '#c4162a', null, 'center', 0);
        for (let i = 0; i < 18; i++) { const lx = fx + 30 + i * 20; for (const ly of [144, 226]) { g.fillStyle = '#fff3a0'; g.beginPath(); g.arc(lx, ly, 4, 0, Math.PI * 2); g.fill(); } }
        glowPool(g, fx + 200, 185, 230, 80, '#ffd98a', 0.3);
        moviePoster(g, fx + 40, 250, 90, 130, r, 0); moviePoster(g, fx + 270, 250, 90, 130, r, 0);
        g.fillStyle = '#2a0c14'; g.fillRect(fx + 150, 270, 100, FT - 270); g.strokeRect(fx + 150, 270, 100, FT - 270); // porta
        g.fillStyle = '#ffd98a'; g.fillRect(fx + 196, 280, 8, FT - 290);
        // loja de eletrônicos: vitrine com TVs empilhadas
        const sx = fx + 440;
        g.fillStyle = '#2a3a5a'; g.fillRect(sx, 150, 420, FT - 150); g.strokeRect(sx, 150, 420, FT - 150);
        sign(g, sx + 210, 130, 300, 40, 'MEGA ELETRÔNICOS', '#5fc8ff');
        g.fillStyle = '#0c0d18'; g.fillRect(sx + 20, 180, 380, FT - 200); g.strokeRect(sx + 20, 180, 380, FT - 200);
        for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
          const s = row === 2 ? 'static' : (row + col) % 2 ? 'bars' : TT.choice(['#ff3b30', '#5fc8ff', '#7bff8a', '#ffe14a']);
          crtTV(g, sx + 30 + col * 92, 180 + 82 * (row + 1), 84, 74, s, r);
        }
        g.fillStyle = 'rgba(200,220,255,0.12)'; g.beginPath(); g.moveTo(sx + 40, 180); g.lineTo(sx + 120, 180); g.lineTo(sx + 60, FT - 20); g.lineTo(sx + 20, FT - 20); g.fill(); // reflexo no vidro
      });
      // calçada
      g.fillStyle = '#5a5470'; g.fillRect(x0, FT, x1 - x0, 46);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; for (let x = Math.floor(x0 / 120) * 120; x < x1; x += 120) { g.beginPath(); g.moveTo(x, FT); g.lineTo(x - 10, FT + 46); g.stroke(); }
      g.fillStyle = '#8a84a0'; g.fillRect(x0, FT + 46, x1 - x0, 8);
      g.fillStyle = '#2c2838'; g.fillRect(x0, FT + 54, x1 - x0, H - FT - 54); // asfalto
      g.fillStyle = '#ffe14a'; for (let x = Math.floor(x0 / 160) * 160; x < x1; x += 160) g.fillRect(x, FT + 150, 80, 8);
    });
    // --- estúdio do Canal 9: paredes escuras, treliças com refletores, cenário de ficção científica e "NO AR"
    part(g, x0, x1, S9_STUDIO, S9_LAIR, () => {
      g.fillStyle = '#1a1626'; g.fillRect(x0, 0, x1 - x0, FT);
      g.fillStyle = '#231e34'; for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) g.fillRect(x, 0, 30, FT); // espuma acústica
      g.fillStyle = '#3a3d47'; g.fillRect(x0, 40, x1 - x0, 14); g.strokeStyle = OUT; g.lineWidth = 3; g.strokeRect(x0 - 4, 40, x1 - x0 + 8, 14); // treliça
      g.strokeStyle = '#5c6169'; g.lineWidth = 2; for (let x = Math.floor(x0 / 28) * 28; x < x1; x += 28) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 14, 54); g.lineTo(x + 28, 40); g.stroke(); }
      cells(x0, x1, 1000, 931, (cx, r) => {
        const x = cx + 180;
        // cenário: painel com planetas e o disco voador de papelão
        g.fillStyle = '#10183a'; g.strokeStyle = OUT; g.lineWidth = 4; g.fillRect(x, 120, 520, FT - 150); g.strokeRect(x, 120, 520, FT - 150);
        for (let i = 0; i < 40; i++) { g.fillStyle = '#fff'; g.fillRect(x + r() * 510, 125 + r() * (FT - 170), 2, 2); }
        g.fillStyle = '#e2702a'; g.beginPath(); g.arc(x + 120, 210, 46, 0, Math.PI * 2); g.fill(); g.stroke();
        g.strokeStyle = '#ffd98a'; g.lineWidth = 5; g.beginPath(); g.ellipse(x + 120, 210, 74, 14, -0.3, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#5fc8ff'; g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.arc(x + 420, 170, 24, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#c9d3e2'; g.beginPath(); g.ellipse(x + 290, 300, 90, 20, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#7bff8a'; g.beginPath(); g.ellipse(x + 290, 290, 36, 26, 0, Math.PI, 0); g.fill(); g.stroke();
        g.strokeStyle = '#8a909a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 290, 264); g.lineTo(x + 290, 54); g.stroke(); // fio segurando o disco
        // placa "NO AR"
        g.fillStyle = '#2a0c14'; g.strokeStyle = OUT; g.lineWidth = 3; g.fillRect(x + 600, 90, 150, 50); g.strokeRect(x + 600, 90, 150, 50);
        TT.drawText(g, 'NO AR', x + 675, 116, 30, '#ff3b30', OUT, 'center', 4);
        glowPool(g, x + 675, 115, 110, 50, '#ff3b30', 0.45);
        // telão do estúdio com as barras coloridas e o logo
        g.fillStyle = '#0c0d10'; g.fillRect(x + 590, 170, 200, 140); g.strokeRect(x + 590, 170, 200, 140);
        colorBars(g, x + 598, 178, 184, 124);
        freakLogo(g, x + 690, 236, 0.5);
        // refletores na treliça, com cone de luz até o chão
        for (const lx of [x + 60, x + 470, x + 860]) {
          g.fillStyle = '#2a2d33'; g.strokeStyle = OUT; g.lineWidth = 3;
          g.beginPath(); g.moveTo(lx - 14, 56); g.lineTo(lx + 14, 56); g.lineTo(lx + 20, 86); g.lineTo(lx - 20, 86); g.closePath(); g.fill(); g.stroke();
          g.fillStyle = '#fff6d0'; g.beginPath(); g.ellipse(lx, 87, 16, 4, 0, 0, Math.PI * 2); g.fill();
          lightCone(g, lx, 88, FT + 40, 16, 140, '#fff3c0', 0.12);
          glowPool(g, lx, FT + 60, 150, 36, '#fff3c0', 0.2);
        }
      });
      // piso preto brilhante com marcações de fita
      g.fillStyle = '#16141e'; g.fillRect(x0, FT, x1 - x0, H - FT);
      g.fillStyle = 'rgba(255,255,255,0.05)'; for (let y = FT + 20; y < H; y += 40) g.fillRect(x0, y, x1 - x0, 2);
      cells(x0, x1, 300, 933, (cx, r) => { g.fillStyle = r() < 0.5 ? '#ffe14a' : '#ff3b30'; const x = cx + r() * 200, y = FT + 40 + r() * 160; g.fillRect(x, y, 30, 5); g.fillRect(x, y, 5, 22); });
    });
    // --- porão do Control Freak: pôsteres, estantes com bonecos, telão gigante e carpete
    part(g, x0, x1, S9_LAIR, 1e5, () => {
      g.fillStyle = '#3a2a4a'; g.fillRect(x0, 0, x1 - x0, FT);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, FT); g.stroke(); } // lambri
      cells(x0, x1, 1300, 941, (cx, r) => {
        const mx = cx + 650;
        // telão gigante com o rosto dele... e chuvisco nas bordas
        g.fillStyle = '#16171b'; g.strokeStyle = OUT; g.lineWidth = 6; g.fillRect(mx - 230, 60, 460, 260); g.strokeRect(mx - 230, 60, 460, 260);
        staticNoise(g, mx - 218, 72, 436, 236, r);
        g.fillStyle = 'rgba(40,20,80,0.8)'; g.fillRect(mx - 160, 92, 320, 196);
        freakLogo(g, mx, 190, 1.4);
        glowPool(g, mx, 190, 300, 170, '#8ab0ff', 0.25);
        for (const s of [-1, 1]) { g.fillStyle = '#2a2d33'; g.strokeStyle = OUT; g.lineWidth = 4; g.fillRect(mx + s * 290 - 30, 150, 60, 170); g.strokeRect(mx + s * 290 - 30, 150, 60, 170); g.fillStyle = '#16171b'; g.beginPath(); g.arc(mx + s * 290, 200, 22, 0, Math.PI * 2); g.arc(mx + s * 290, 278, 26, 0, Math.PI * 2); g.fill(); } // caixas de som
        // estantes com bonecos e pôsteres
        for (const sx of [mx - 620, mx + 380]) {
          g.fillStyle = '#5a3a2a'; g.strokeStyle = OUT; g.lineWidth = 3;
          for (let i = 0; i < 3; i++) { g.fillRect(sx, 170 + i * 80, 220, 10); g.strokeRect(sx, 170 + i * 80, 220, 10); }
          for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) {
            const bx = sx + 18 + j * 42, by = 170 + i * 80;
            g.fillStyle = TT.shade(['#d7263e', '#5f8fe0', '#79c64c', '#ffe14a', '#7b55c9'][Math.floor(r() * 5)], 0);
            g.fillRect(bx - 7, by - 36, 14, 22); g.strokeRect(bx - 7, by - 36, 14, 22);
            g.beginPath(); g.arc(bx, by - 44, 8, 0, Math.PI * 2); g.fill(); g.stroke();
            g.fillRect(bx - 6, by - 14, 5, 14); g.fillRect(bx + 1, by - 14, 5, 14);
          }
          moviePoster(g, sx + 30, 30, 70, 100, r, -0.05); moviePoster(g, sx + 130, 34, 70, 100, r, 0.06);
        }
      });
      // carpete roxo com estampa
      g.fillStyle = '#4a2a5a'; g.fillRect(x0, FT, x1 - x0, H - FT);
      g.fillStyle = 'rgba(255,225,74,0.12)'; for (let y = FT + 24, row = 0; y < H; y += 48, row++) for (let x = Math.floor(x0 / 80) * 80 + (row % 2) * 40; x < x1; x += 80) { g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x + 12, y); g.lineTo(x, y + 10); g.lineTo(x - 12, y); g.closePath(); g.fill(); }
    });
    // passagens: porta do estúdio (com a luz "NO AR") e a escada do porão
    for (const [px, col, txt] of [[S9_STUDIO, '#2a2d3a', 'ESTÚDIO'], [S9_LAIR, '#3a2a3a', 'PORÃO']]) {
      if (x0 > px + 180 || x1 < px - 180) continue;
      g.fillStyle = col; g.fillRect(px - 150, 60, 300, FT - 60); g.strokeStyle = OUT; g.lineWidth = 5; g.strokeRect(px - 150, 60, 300, FT - 60);
      g.fillStyle = '#0c0d14'; g.fillRect(px - 100, 150, 200, FT - 150);
      sign(g, px, 112, 160, 38, txt, '#ffe14a');
      g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(px, 78, 8, 0, Math.PI * 2); g.fill(); glowPool(g, px, 78, 40, 40, '#ff3b30', 0.6);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0, FT, x1 - x0, 6);
  }

  // Câmera de estúdio no tripé.
  function studioCamera(g, x, base, f) {
    g.strokeStyle = OUT; g.lineWidth = 5;
    g.beginPath(); g.moveTo(x, base - 90); g.lineTo(x - 40, base); g.moveTo(x, base - 90); g.lineTo(x + 40, base); g.moveTo(x, base - 90); g.lineTo(x, base); g.stroke();
    g.strokeStyle = '#5c6169'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#2a2d33'; g.strokeStyle = OUT; g.lineWidth = 3;
    g.fillRect(x - 46, base - 136, 80, 46); g.strokeRect(x - 46, base - 136, 80, 46);
    g.fillRect(x + f * 34 - (f > 0 ? 0 : 30), base - 128, 30, 30); g.strokeRect(x + f * 34 - (f > 0 ? 0 : 30), base - 128, 30, 30);
    g.fillStyle = '#5fc8ff'; g.beginPath(); g.arc(x + f * 64, base - 113, 9, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(x - 36, base - 128, 4, 0, Math.PI * 2); g.fill();
    TT.drawText(g, '9', x - 8, base - 112, 18, '#ffe14a', OUT, 'center', 3);
  }
  function popcornSpill(g, x, y, r) {
    g.fillStyle = '#d7263e'; g.strokeStyle = OUT; g.lineWidth = 2.5;
    g.save(); g.translate(x, y); g.rotate(1.3);
    g.beginPath(); g.moveTo(-14, -20); g.lineTo(14, -20); g.lineTo(10, 18); g.lineTo(-10, 18); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.fillRect(-4, -20, 6, 38);
    g.restore();
    for (let i = 0; i < 14; i++) { g.fillStyle = r() < 0.7 ? '#fff6dc' : '#ffe14a'; g.beginPath(); g.arc(x - 30 - r() * 60, y + (r() - 0.5) * 24, 4 + r() * 3, 0, Math.PI * 2); g.fill(); }
  }
  function d9(g, x0, x1) {
    part(g, x0, x1, -1e5, S9_STUDIO, () => {
      cells(x0, x1, 900, 951, (cx, r) => {
        lampPost(g, cx + 20, FT + 4, 230, '#ffd98a');
        const k = r();
        if (k < 0.5) { g.fillStyle = '#c4162a'; g.strokeStyle = OUT; g.lineWidth = 3; g.fillRect(cx + 470, FT - 120, 80, 126); g.strokeRect(cx + 470, FT - 120, 80, 126); g.fillStyle = '#bfefff'; g.fillRect(cx + 480, FT - 108, 60, 40); g.strokeRect(cx + 480, FT - 108, 60, 40); TT.drawText(g, 'INGRESSOS', cx + 510, FT - 54, 12, '#ffe14a', OUT, 'center', 2); } // bilheteria
        else crtTV(g, cx + 490, FT + 6, 90, 76, 'static', r, true); // TV jogada na calçada
      });
      cells(x0, x1, 420, 953, (cx, r) => { if (r() < 0.55) popcornSpill(g, cx + 150 + r() * 160, FT + 30 + r() * 20, r); });
    });
    part(g, x0, x1, S9_STUDIO, S9_LAIR, () => {
      cells(x0, x1, 620, 955, (cx, r) => {
        studioCamera(g, cx + 140 + r() * 80, FT + 8, r() < 0.5 ? 1 : -1);
        if (r() < 0.5) crate(g, cx + 400, FT + 6, 90, 60, '#3a3d47', 'CANAL 9');
      });
      cells(x0, x1, 360, 957, (cx, r) => { const y = FT + 50 + r() * 140; cableSag(g, cx, cx + 360, y, 26, '#0c0d10', 5); });
    });
    part(g, x0, x1, S9_LAIR, 1e5, () => {
      cells(x0, x1, 560, 959, (cx, r) => {
        // pufe, pilha de caixas de pizza e latinhas
        g.fillStyle = '#5f8fe0'; g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.ellipse(cx + 120, FT - 20, 56, 34, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        for (let i = 0; i < 3 + Math.floor(r() * 3); i++) { g.fillStyle = '#e8d2a8'; g.fillRect(cx + 300 - i * 2, FT - 6 - i * 12, 76, 12); g.strokeRect(cx + 300 - i * 2, FT - 6 - i * 12, 76, 12); }
        for (let i = 0; i < 4; i++) { g.fillStyle = ['#d7263e', '#79c64c', '#5fc8ff'][i % 3]; g.fillRect(cx + 420 + i * 18, FT - 18, 12, 22); g.strokeRect(cx + 420 + i * 18, FT - 18, 12, 22); }
      });
      cells(x0, x1, 300, 961, (cx, r) => { if (r() < 0.5) { g.fillStyle = TT.shade('#ffe14a', -0.1); g.save(); g.translate(cx + r() * 220, FT + 60 + r() * 140); g.rotate(r() - 0.5); g.fillRect(-20, -14, 40, 28); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(-20, -14, 40, 28); g.restore(); } }); // gibis no chão
    });
  }
  // Primeiro plano: colunas de treliça com refletores (fora da arena do chefe).
  function s9Fg(g, x0, x1) {
    cells(x0, x1, 1400, 971, (cx) => {
      const x = cx + 700;
      if (x > S9_LAIR - 300 || x < S9_STUDIO - 200) return;
      g.fillStyle = '#2a2d33'; g.fillRect(x, 0, 34, H); g.strokeStyle = OUT; g.lineWidth = 4; g.strokeRect(x, -4, 34, H + 8);
      g.strokeStyle = '#5c6169'; g.lineWidth = 3; for (let y = 0; y < H; y += 34) { g.beginPath(); g.moveTo(x + 2, y); g.lineTo(x + 32, y + 34); g.stroke(); }
      g.fillStyle = '#16171b'; g.beginPath(); g.moveTo(x - 20, 200); g.lineTo(x + 54, 200); g.lineTo(x + 64, 250); g.lineTo(x - 30, 250); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 4; g.stroke();
    });
  }

  TT.makeBackground = function (id) {
    if (id === 9) {
      return { layers: [new Layer(0.1, s9Far, 32), new Layer(0.38, s9Mid, 33), new Layer(1, detailed(s9Near, d9, 'rgba(20,0,40,0.3)'), 34)], fg: new Layer(1.18, s9Fg, 35), id };
    }
    if (id === 8) {
      return { layers: [new Layer(0.1, s8Far, 28), new Layer(0.38, s8Mid, 29), new Layer(1, detailed(s8Near, d8), 30)], fg: new Layer(1.18, s8Fg, 31), id };
    }
    if (id === 7) {
      return { layers: [new Layer(0.1, s7Far, 24), new Layer(0.38, s7Mid, 25), new Layer(1, detailed(s7Near, d7, 'rgba(60,0,0,0.3)'), 26)], fg: new Layer(1.18, s7Fg, 27), id };
    }
    if (id === 6) {
      return { layers: [new Layer(0.1, s6Far, 20), new Layer(0.38, s6Mid, 21), new Layer(1, detailed(s6Near, d6), 22)], fg: new Layer(1.18, s6Fg, 23), id };
    }
    if (id === 5) {
      return { layers: [new Layer(0.1, s5Far, 16), new Layer(0.38, s5Mid, 17), new Layer(1, detailed(s5Near, d5), 18)], fg: new Layer(1.18, s5Fg, 19), id };
    }
    if (id === 1) {
      return { layers: [new Layer(0.1, s1Far, 1), new Layer(0.35, s1Mid, 2), new Layer(1, detailed(s1Near, d1, 'rgba(0,0,0,0.12)'), 3)], fg: null, id };
    }
    if (id === 4) {
      return { layers: [new Layer(0.1, s4Far, 12), new Layer(0.38, s4Mid, 13), new Layer(1, detailed(s4Near, d4), 14)], fg: new Layer(1.18, s4Fg, 15), id };
    }
    if (id === 3) {
      return { layers: [new Layer(0.1, s3Far, 8), new Layer(0.38, s3Mid, 9), new Layer(1, detailed(s3Near, d3), 10)], fg: new Layer(1.18, s3Fg, 11), id };
    }
    return { layers: [new Layer(0.12, s2Far, 4), new Layer(0.4, s2Mid, 5), new Layer(1, detailed(s2Near, d2), 6)], fg: new Layer(1.18, s2Fg, 7), id };
  };

  // Vinheta pré-renderizada
  let vignette = null;
  TT.vignette = function () {
    if (vignette) return vignette;
    vignette = TT.makeCanvas(640, 360);
    const g = vignette.getContext('2d');
    const gr = g.createRadialGradient(320, 180, 120, 320, 180, 390);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,0,20,0.55)');
    g.fillStyle = gr; g.fillRect(0, 0, 640, 360);
    return vignette;
  };
})();
