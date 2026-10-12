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

  TT.makeBackground = function (id) {
    if (id === 1) {
      return { layers: [new Layer(0.1, s1Far, 1), new Layer(0.35, s1Mid, 2), new Layer(1, s1Near, 3)], fg: null, id };
    }
    if (id === 3) {
      return { layers: [new Layer(0.1, s3Far, 8), new Layer(0.38, s3Mid, 9), new Layer(1, s3Near, 10)], fg: new Layer(1.18, s3Fg, 11), id };
    }
    return { layers: [new Layer(0.12, s2Far, 4), new Layer(0.4, s2Mid, 5), new Layer(1, s2Near, 6)], fg: new Layer(1.18, s2Fg, 7), id };
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
