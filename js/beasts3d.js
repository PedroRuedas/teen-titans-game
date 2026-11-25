'use strict';
// Formas 3D esculpidas da Fase 13: animais do Mutano, corvo da alma da Ravena e coelho da maldição.
//
// Cada forma é descrita como um conjunto de formas que se fundem suavemente (elipsoides, cones arredondados,
// anéis) e formas que escavam (boca, narinas, dobras da pele). A superfície dessa "escultura" vira uma malha
// lisa de uma peça só (surface nets sobre a função de distância), com cor por vértice, sombra de oclusão nas
// dobras e pesos de esqueleto: a malha dobra nas juntas como um boneco de verdade. Olhos, dentes, garras,
// chifres e presas são peças à parte presas aos ossos.
//
// Unidades = pixels do desenho 2D, pés em y = 0, frente = +X, profundidade em Z (z > 0 = lado da câmera).
// A geometria de cada forma é gerada uma vez (e guardada); cada Titã ganha o próprio esqueleto.
(function () {
  const TT = window.TT;
  let T = null;

  // ------------------------------------------------------------ Ruído (pelo, escamas, lã) e pintas
  function hash3(x, y, z) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = x - xi, fy = y - yi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
    const L = (a, b, k) => a + (b - a) * k;
    const c = (i, j, k) => hash3(xi + i, yi + j, zi + k);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w) * 2 - 1;
  }
  // distância ao ponto-semente mais próximo (células de Voronoi): pintas do guepardo
  function cellDist(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let best = 9;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const X = xi + i, Y = yi + j, Z = zi + k;
      const dx = X + hash3(X, Y, Z) - x, dy = Y + hash3(Y, Z, X) - y, dz = Z + hash3(Z, X, Y) - z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const WHITE = [1, 1, 1], BLANK_UV = [0.5, 0.08]; // faixa branca embaixo da textura do tronco
  const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);

  // ------------------------------------------------------------ A escultura
  class Sculpt {
    constructor(h) { this.h = h || 2.2; this.prims = []; this.bones = []; this.bi = {}; this.paint = null; this.bone('root', null, [0, 0, 0]); }
    bone(name, parent, at) { this.bi[name] = this.bones.length; this.bones.push({ name, parent, at }); return this; }
    at(name) { return this.bones[this.bi[name]].at; }
    ell(c, r, o) { return this.push(Object.assign({ t: 0, c, r }, o)); }
    cone(a, b, r1, r2, o) { return this.push(Object.assign({ t: 1, a, b, r1, r2 }, o)); }
    torus(c, R, r, axis, o) { return this.push(Object.assign({ t: 2, c, R, rr: r, axis }, o)); }
    push(p) {
      if (p.k == null) p.k = p.sub ? 2 : 4;
      p.rgb = rgb(p.col || '#ff00ff');
      p.bump = p.bump || 0; p.bf = p.bf || 0.3;
      if (p.bone == null) p.bone = 'root';
      p.b_i = this.bi[p.bone]; if (p.b_i == null) throw new Error('osso ' + p.bone);
      let lo, hi;
      if (p.t === 0) { lo = p.c.map((v, i) => v - p.r[i]); hi = p.c.map((v, i) => v + p.r[i]); }
      else if (p.t === 1) {
        const ba = [p.b[0] - p.a[0], p.b[1] - p.a[1], p.b[2] - p.a[2]], l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2];
        const L = Math.sqrt(l2); if (Math.abs(p.r1 - p.r2) >= L * 0.98) p.r2 = p.r1 - Math.sign(p.r1 - p.r2) * L * 0.98;
        p.ba = ba; p.l2 = l2; p.rr = p.r1 - p.r2; p.a2 = l2 - p.rr * p.rr; p.il2 = 1 / l2;
        lo = [0, 1, 2].map((i) => Math.min(p.a[i] - p.r1, p.b[i] - p.r2)); hi = [0, 1, 2].map((i) => Math.max(p.a[i] + p.r1, p.b[i] + p.r2));
      } else { const e = p.R + p.rr; lo = p.c.map((v) => v - e); hi = p.c.map((v) => v + e); }
      const m = p.k + p.bump * 1.2 + this.h * 2;
      p.bb = [lo[0] - m, lo[1] - m, lo[2] - m, hi[0] + m, hi[1] + m, hi[2] + m];
      this.prims.push(p);
      return p;
    }
    // espelha uma parte nos dois lados (s = 1 lado da câmera, -1 o outro)
    both(fn) { fn(1, 'F'); fn(-1, 'B'); }
  }
  function sd(p, x, y, z) {
    let d;
    if (p.t === 0) {
      const X = (x - p.c[0]) / p.r[0], Y = (y - p.c[1]) / p.r[1], Z = (z - p.c[2]) / p.r[2];
      const k0 = Math.sqrt(X * X + Y * Y + Z * Z), k1 = Math.sqrt(X * X / (p.r[0] * p.r[0]) + Y * Y / (p.r[1] * p.r[1]) + Z * Z / (p.r[2] * p.r[2]));
      d = k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(p.r[0], p.r[1], p.r[2]);
    } else if (p.t === 1) { // cone arredondado (Inigo Quilez)
      const pax = x - p.a[0], pay = y - p.a[1], paz = z - p.a[2], ba = p.ba, l2 = p.l2;
      const yy = pax * ba[0] + pay * ba[1] + paz * ba[2], zz = yy - l2;
      const qx = pax * l2 - ba[0] * yy, qy = pay * l2 - ba[1] * yy, qz = paz * l2 - ba[2] * yy;
      const x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = zz * zz * l2;
      const k = Math.sign(p.rr) * p.rr * p.rr * x2;
      if (Math.sign(zz) * p.a2 * z2 > k) d = Math.sqrt(x2 + z2) * p.il2 - p.r2;
      else if (Math.sign(yy) * p.a2 * y2 < k) d = Math.sqrt(x2 + y2) * p.il2 - p.r1;
      else d = (Math.sqrt(x2 * p.a2 * p.il2) + yy * p.rr) * p.il2 - p.r1;
    } else {
      const dx = x - p.c[0], dy = y - p.c[1], dz = z - p.c[2];
      let a, b;
      if (p.axis === 0) { a = Math.sqrt(dy * dy + dz * dz) - p.R; b = dx; } else if (p.axis === 1) { a = Math.sqrt(dx * dx + dz * dz) - p.R; b = dy; } else { a = Math.sqrt(dx * dx + dy * dy) - p.R; b = dz; }
      d = Math.sqrt(a * a + b * b) - p.rr;
    }
    if (p.bump) d += p.bump * noise3(x * p.bf, y * p.bf, z * p.bf);
    return d;
  }
  const inBB = (p, x, y, z) => x >= p.bb[0] && x <= p.bb[3] && y >= p.bb[1] && y <= p.bb[4] && z >= p.bb[2] && z <= p.bb[5];
  function field(S, x, y, z) {
    let d = 1e9;
    for (const p of S.adds) if (inBB(p, x, y, z)) d = smin(d, sd(p, x, y, z), p.k);
    if (d > 1e8) return 60;
    for (const p of S.subs) if (inBB(p, x, y, z)) d = smax(d, -sd(p, x, y, z), p.k);
    return d;
  }

  // Superfície (surface nets) + cor, oclusão e pesos de osso por vértice.
  function* meshOf(S) {
    S.adds = S.prims.filter((p) => !p.sub); S.subs = S.prims.filter((p) => p.sub);
    const h = S.h, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const p of S.adds) for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], p.bb[i]); mx[i] = Math.max(mx[i], p.bb[i + 3]); }
    const nx = Math.ceil((mx[0] - mn[0]) / h) + 1, ny = Math.ceil((mx[1] - mn[1]) / h) + 1, nz = Math.ceil((mx[2] - mn[2]) / h) + 1;
    const F = new Float32Array(nx * ny * nz);
    for (let k = 0; k < nz; k++) {
      const z = mn[2] + k * h;
      const lz = S.prims.filter((p) => z >= p.bb[2] && z <= p.bb[5]);
      for (let j = 0; j < ny; j++) {
        const y = mn[1] + j * h;
        const ly = lz.filter((p) => y >= p.bb[1] && y <= p.bb[4]);
        const adds = ly.filter((p) => !p.sub), subs = ly.filter((p) => p.sub);
        const row = nx * (j + ny * k);
        for (let i = 0; i < nx; i++) {
          const x = mn[0] + i * h;
          let d = 1e9;
          for (const p of adds) if (x >= p.bb[0] && x <= p.bb[3]) d = smin(d, sd(p, x, y, z), p.k);
          if (d > 1e8) { F[row + i] = 60; continue; }
          for (const p of subs) if (x >= p.bb[0] && x <= p.bb[3]) d = smax(d, -sd(p, x, y, z), p.k);
          F[row + i] = d;
        }
      }
      yield;
    }
    // um vértice por célula cortada pela superfície (média dos cruzamentos nas arestas)
    const cx = nx - 1, cy = ny - 1, cz = nz - 1, cell = new Int32Array(cx * cy * cz).fill(-1);
    const P = [];
    const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const val = new Float32Array(8);
    for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
      let mask = 0;
      for (let c = 0; c < 8; c++) {
        const v = F[(i + (c & 1)) + nx * ((j + ((c >> 1) & 1)) + ny * (k + ((c >> 2) & 1)))];
        val[c] = v; if (v < 0) mask |= 1 << c;
      }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of E) {
        const va = val[a], vb = val[b];
        if ((va < 0) === (vb < 0)) continue;
        const t = va / (va - vb);
        sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; sz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t; n++;
      }
      cell[i + cx * (j + cy * k)] = P.length / 3;
      P.push(mn[0] + (i + sx / n) * h, mn[1] + (j + sy / n) * h, mn[2] + (k + sz / n) * h);
    }
    // quadriláteros: um para cada aresta da grade que cruza a superfície
    const idx = [];
    const C = (i, j, k) => cell[i + cx * (j + cy * k)];
    for (let k = 1; k < cz; k++) for (let j = 1; j < cy; j++) for (let i = 1; i < cx; i++) {
      const f0 = F[i + nx * (j + ny * k)] < 0;
      // aresta em x: células (i, j-1..j, k-1..k)
      if (i < cx && (F[i + 1 + nx * (j + ny * k)] < 0) !== f0) quad(C(i, j, k), C(i, j - 1, k), C(i, j - 1, k - 1), C(i, j, k - 1));
      if (j < cy && (F[i + nx * (j + 1 + ny * k)] < 0) !== f0) quad(C(i, j, k), C(i - 1, j, k), C(i - 1, j, k - 1), C(i, j, k - 1));
      if (k < cz && (F[i + nx * (j + ny * (k + 1))] < 0) !== f0) quad(C(i, j, k), C(i - 1, j, k), C(i - 1, j - 1, k), C(i, j - 1, k));
    }
    function quad(a, b, c, d) { if (a < 0 || b < 0 || c < 0 || d < 0) return; idx.push(a, b, c, a, c, d); }
    const nv = P.length / 3;
    const uvs = new Float32Array(nv * 2);
    const pos = new Float32Array(P), nrm = new Float32Array(nv * 3), col = new Float32Array(nv * 3), sI = new Uint16Array(nv * 4), sW = new Float32Array(nv * 4);
    const e = 0.5, G = (x, y, z, out) => { // gradiente (tetraedro)
      const a = field(S, x + e, y - e, z - e), b = field(S, x - e, y - e, z + e), c = field(S, x - e, y + e, z - e), d = field(S, x + e, y + e, z + e);
      out[0] = a - b - c + d; out[1] = -a - b + c + d; out[2] = -a + b - c + d;
      const l = Math.hypot(out[0], out[1], out[2]) || 1; out[0] /= l; out[1] /= l; out[2] /= l;
    };
    const g = [0, 0, 0], nb = S.bones.length, wb = new Float32Array(nb);
    for (let v = 0; v < nv; v++) {
      if (v % 300 === 299) yield;
      let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      // assenta o vértice na superfície (um passo de Newton)
      G(x, y, z, g); const f0 = field(S, x, y, z); x -= g[0] * f0; y -= g[1] * f0; z -= g[2] * f0;
      pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
      G(x, y, z, g); nrm[v * 3] = g[0]; nrm[v * 3 + 1] = g[1]; nrm[v * 3 + 2] = g[2];
      // distância de cada peça: cor e pesos dos ossos
      let dmin = 1e9, dom = null; const ds = [];
      for (const p of S.adds) if (inBB(p, x, y, z)) { const d = sd(p, x, y, z); ds.push([p, d]); if (d < dmin) { dmin = d; dom = p; } }
      let cr = 0, cg = 0, cb = 0, cw = 0; wb.fill(0);
      for (const [p, d] of ds) {
        const rel = d - dmin;
        const wc = Math.exp(-rel / (p.cs || 0.9));
        const c0 = p.tex ? WHITE : p.paint ? p.paint(x, y, z, g[0], g[1], g[2], p.rgb) : p.rgb;
        cr += c0[0] * wc; cg += c0[1] * wc; cb += c0[2] * wc; cw += wc;
        wb[p.b_i] += Math.exp(-rel / (p.soft || 3.2));
      }
      let c = cw ? [cr / cw, cg / cw, cb / cw] : [1, 0, 1];
      // superfície escavada (boca, narinas): cor da peça que escava
      const fd = field(S, x, y, z);
      for (const p of S.subs) if (p.col && inBB(p, x, y, z)) { const ds2 = -sd(p, x, y, z); if (ds2 > fd - 0.8) c = mix(c, p.rgb, clamp((ds2 - fd + 0.8) / 0.8, 0, 1)); }
      if (S.paint) c = S.paint(x, y, z, g[0], g[1], g[2], c);
      const uv = dom && dom.tex && S.uvf ? S.uvf(x, y, z) : BLANK_UV; uvs[v * 2] = uv[0]; uvs[v * 2 + 1] = uv[1];
      // oclusão ambiente (dobras, axilas, embaixo da barriga)
      let occ = 0, sca = 1;
      for (let s = 1; s <= 3; s++) { const hh = 3.2 * s; occ += (hh - field(S, x + g[0] * hh, y + g[1] * hh, z + g[2] * hh)) * sca; sca *= 0.7; }
      const ao = clamp(1 - occ / 14, 0, 1), sh = 0.55 + 0.45 * ao;
      col[v * 3] = c[0] * sh; col[v * 3 + 1] = c[1] * sh; col[v * 3 + 2] = c[2] * sh;
      // 4 ossos mais fortes
      const top = [];
      for (let b = 0; b < nb; b++) if (wb[b] > 1e-4) top.push([b, wb[b]]);
      top.sort((a, b) => b[1] - a[1]);
      if (!top.length) top.push([0, 1]);
      const tw = top.slice(0, 4).reduce((s, t) => s + t[1], 0);
      for (let q = 0; q < 4; q++) { const t = top[q]; sI[v * 4 + q] = t ? t[0] : 0; sW[v * 4 + q] = t ? t[1] / tw : 0; }
    }
    // triângulos virados para fora (pela normal da superfície)
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      if (fx * (nrm[a] + nrm[b] + nrm[c]) + fy * (nrm[a + 1] + nrm[b + 1] + nrm[c + 1]) + fz * (nrm[a + 2] + nrm[b + 2] + nrm[c + 2]) < 0) { const s0 = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s0; }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nrm, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    geo.setAttribute('uv', new T.BufferAttribute(uvs, 2));
    geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(sI, 4));
    geo.setAttribute('skinWeight', new T.BufferAttribute(sW, 4));
    geo.setIndex(nv > 65535 ? new T.Uint32BufferAttribute(idx, 1) : new T.Uint16BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  }

  function* meshGroups(list) {
    const geos = [];
    for (const S of list) geos.push(yield* meshOf(S));
    let nv = 0, ni = 0;
    for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
    const out = new T.BufferGeometry(), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    for (const [name, n] of [['position', 3], ['normal', 3], ['color', 3], ['uv', 2], ['skinIndex', 4], ['skinWeight', 4]]) {
      const A = name === 'skinIndex' ? new Uint16Array(nv * n) : new Float32Array(nv * n);
      let o = 0; for (const g of geos) { A.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
      out.setAttribute(name, name === 'skinIndex' ? new T.Uint16BufferAttribute(A, n) : new T.BufferAttribute(A, n));
    }
    let o = 0, base = 0;
    for (const g of geos) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[o++] = a[i] + base; base += g.attributes.position.count; }
    out.setIndex(new T.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    return out;
  }

  // ------------------------------------------------------------ Cores do Mutano
  const G = {
    base: '#55a630', dark: '#2e6b1a', deep: '#1c4810', light: '#8fd15c', belly: '#b5e28a', skin: '#3f8a26', face: '#357a20',
    nose: '#143a0a', mouth: '#4a0c1a', tongue: '#c8455a', teeth: '#fbf8ec', claw: '#efe9d2', horn: '#e4ecc9', hoof: '#22401a', iris: '#2fd14a',
  };
  // pelagem: listras/manchas suaves de tom dentro do verde (dá leitura de pelo e volume)
  const furTone = (sc, amt) => (x, y, z, nx, ny, nz, c) => { const n = noise3(x * sc, y * sc * 1.6, z * sc); return mix(c, n > 0 ? rgb(G.light) : rgb(G.dark), Math.min(1, Math.abs(n) * amt)); };

  // ------------------------------------------------------------ Definição de cada forma
  // Cada definição devolve a escultura (S) e, separado, a lista de peças rígidas (olhos, dentes...).
  const DEF = {};

  DEF.gorilla = () => {
    const S = new Sculpt(2.1);
    S.bone('hips', 'root', [0, 50, 0]).bone('chest', 'hips', [6, 92, 0]).bone('head', 'chest', [46, 132, 0]).bone('jaw', 'head', [56, 122, 0]);
    S.both((s, k) => {
      S.bone('sh' + k, 'chest', [20, 126, 34 * s]).bone('el' + k, 'sh' + k, [34, 82, 50 * s]).bone('ha' + k, 'el' + k, [42, 42, 53 * s]);
      S.bone('th' + k, 'hips', [-2, 50, 18 * s]).bone('kn' + k, 'th' + k, [8, 28, 20 * s]).bone('ft' + k, 'kn' + k, [4, 8, 20 * s]);
    });
    const fur = { bump: 0.75, bf: 0.55, col: G.base, paint: furTone(0.06, 0.22) };
    S.ell([-2, 56, 0], [30, 24, 26], Object.assign({ bone: 'hips' }, fur));
    S.ell([18, 76, 0], [18, 22, 21], { bone: 'hips', col: G.skin, k: 8 });
    S.ell([6, 100, 0], [38, 40, 34], Object.assign({ bone: 'chest', k: 10 }, fur));
    S.ell([-6, 118, 0], [30, 24, 31], Object.assign({ bone: 'chest', k: 10 }, fur, { bump: 0.9 }));
    S.both((s) => S.ell([30, 108, 12 * s], [13, 13, 12], { bone: 'chest', col: G.skin, k: 6 }));
    S.cone([20, 118, 0], [44, 132, 0], 16, 13, Object.assign({ bone: 'chest', k: 8 }, fur));
    S.ell([44, 140, 0], [19, 19, 17], Object.assign({ bone: 'head', k: 6 }, fur, { bump: 1 }));
    S.ell([34, 155, 0], [13, 10, 7], Object.assign({ bone: 'head', k: 6 }, fur));
    S.ell([56, 136, 0], [10, 14, 14], { bone: 'head', col: G.face, k: 5 });
    S.cone([59, 147, -12], [59, 147, 12], 4.5, 4.5, { bone: 'head', col: G.deep, k: 3 });
    S.ell([64, 127, 0], [12, 10, 14], { bone: 'head', col: G.face, k: 4 });
    S.both((s) => { S.ell([75, 132, 4 * s], [2.6, 2.2, 2.4], { sub: true, col: G.nose, k: 1.2 }); S.ell([42, 140, 19 * s], [5, 7, 3], { bone: 'head', col: G.face, k: 2 }); S.ell([42, 140, 21 * s], [2.8, 4.5, 1.6], { sub: true, col: G.deep, k: 1 }); });
    S.ell([73, 120, 0], [6, 1.8, 10], { sub: true, col: G.mouth, k: 1.5 });
    S.ell([62, 115, 0], [11, 7, 12], { bone: 'jaw', col: G.face, k: 3 });
    S.both((s, k) => {
      S.cone([20, 126, 34 * s], [34, 84, 50 * s], 14, 11, Object.assign({ bone: 'sh' + k, k: 5, soft: 2 }, fur));
      S.ell([18, 124, 32 * s], [18, 16, 17], Object.assign({ bone: 'chest', k: 8 }, fur));
      S.ell([29, 104, 44 * s], [10, 14, 10], Object.assign({ bone: 'sh' + k, k: 4, soft: 2 }, fur));
      S.cone([34, 82, 50 * s], [42, 46, 53 * s], 12, 10, Object.assign({ bone: 'el' + k, k: 4, soft: 2 }, fur));
      S.cone([34, 84, 50 * s], [24, 76, 49 * s], 6, 1, Object.assign({ bone: 'el' + k, k: 3, soft: 2 }, fur, { bump: 0.4 }));
      S.ell([44, 36, 53 * s], [12, 10, 12], { bone: 'ha' + k, col: G.skin, k: 4, soft: 2 });
      for (const dz of [-7, -2.4, 2.4, 7]) S.cone([50, 40, 53 * s + dz], [55, 29, 53 * s + dz], 4, 3.6, { bone: 'ha' + k, col: G.skin, k: 1.5, soft: 2 });
      S.cone([38, 40, 44 * s], [44, 32, 42 * s], 3.6, 3, { bone: 'ha' + k, col: G.skin, k: 1.5, soft: 2 });
      S.cone([-2, 52, 18 * s], [8, 28, 20 * s], 15, 11, Object.assign({ bone: 'th' + k, k: 6 }, fur));
      S.cone([8, 28, 20 * s], [4, 10, 20 * s], 11, 9, Object.assign({ bone: 'kn' + k, k: 5 }, fur));
      S.ell([14, 6, 20 * s], [17, 6, 11], { bone: 'ft' + k, col: G.skin, k: 4 });
      for (const dz of [-6, -2, 2, 6]) S.cone([26, 6, 20 * s + dz], [33, 4, 20 * s + dz * 1.1], 3.4, 3, { bone: 'ft' + k, col: G.skin, k: 1.2 });
    });
    const parts = [
      ['eye', 'head', [60, 139, 8.5], 4.4, { iris: G.iris, dir: [1, 0.05, 0.35], lid: G.face, lidTilt: 0.2 }],
      ['eye', 'head', [60, 139, -8.5], 4.4, { iris: G.iris, dir: [1, 0.05, -0.35], lid: G.face, lidTilt: 0.2 }],
    ];
    for (const s of [-1, 1]) {
      parts.push(['fang', 'head', [71, 123, 5 * s], 2.2, 7, [0, -1, 0]], ['fang', 'jaw', [70, 117, 6 * s], 2, 6, [0.1, 1, 0]]);
      for (const dz of [-2, 0, 2]) parts.push(['tooth', 'head', [73, 122, dz], 1.4, 2.6, [0, -1, 0]]);
    }
    return { S, parts };
  };

  DEF.trex = () => {
    const S = new Sculpt(2.2);
    S.bone('hips', 'root', [0, 72, 0]).bone('chest', 'hips', [30, 84, 0]).bone('neck', 'chest', [46, 96, 0]).bone('head', 'neck', [64, 112, 0]).bone('jaw', 'head', [68, 104, 0]);
    S.bone('tail1', 'hips', [-24, 84, 0]).bone('tail2', 'tail1', [-72, 82, 0]).bone('tail3', 'tail2', [-116, 78, 0]);
    S.both((s, k) => {
      S.bone('th' + k, 'hips', [-2, 70, 16 * s]).bone('kn' + k, 'th' + k, [16, 40, 19 * s]).bone('an' + k, 'kn' + k, [-2, 16, 19 * s]).bone('to' + k, 'an' + k, [6, 4, 19 * s]);
      S.bone('ar' + k, 'chest', [44, 80, 13 * s]).bone('fa' + k, 'ar' + k, [50, 70, 15 * s]);
    });
    const scales = { bump: 0.7, bf: 0.55, col: G.base, paint: furTone(0.05, 0.45) };
    S.ell([4, 82, 0], [40, 26, 24], Object.assign({ bone: 'hips', k: 10 }, scales));
    S.ell([32, 86, 0], [22, 24, 21], Object.assign({ bone: 'chest', k: 10 }, scales));
    S.ell([16, 68, 0], [32, 12, 18], { bone: 'hips', col: G.belly, k: 8, paint: (x, y, z, nx, ny, nz, c) => (Math.sin(x * 0.45) > 0.55 && ny < -0.3 ? mix(c, rgb(G.light), 0.6) : c) });
    S.cone([34, 94, 0], [60, 110, 0], 17, 13, Object.assign({ bone: 'neck', k: 8 }, scales));
    S.ell([72, 118, 0], [20, 14, 14], Object.assign({ bone: 'head', k: 6 }, scales));
    S.cone([72, 116, 0], [112, 112, 0], 13, 9, Object.assign({ bone: 'head', k: 6 }, scales));
    S.both((s) => {
      S.ell([68, 110, 9 * s], [12, 9, 6], Object.assign({ bone: 'head', k: 5 }, scales));
      S.ell([79, 127, 8 * s], [9, 4, 5], { bone: 'head', col: G.deep, k: 3 });
      S.ell([114, 117, 4 * s], [2.4, 2, 2], { sub: true, col: G.nose, k: 1 });
    });
    S.ell([92, 106, 0], [28, 2.6, 15], { sub: true, col: G.mouth, k: 1.6 });
    S.cone([68, 102, 0], [112, 103, 0], 9, 6, Object.assign({ bone: 'jaw', k: 3 }, scales));
    S.ell([88, 98, 0], [18, 4, 8], { bone: 'jaw', col: G.belly, k: 3 });
    S.cone([-20, 86, 0], [-70, 84, 0], 22, 13, Object.assign({ bone: 'tail1', k: 8 }, scales));
    S.cone([-70, 84, 0], [-116, 79, 0], 13, 7, Object.assign({ bone: 'tail2', k: 6 }, scales));
    S.cone([-116, 79, 0], [-154, 74, 0], 7, 1.5, Object.assign({ bone: 'tail3', k: 5 }, scales));
    S.both((s, k) => {
      S.ell([2, 64, 16 * s], [22, 26, 13], Object.assign({ bone: 'th' + k, k: 8 }, scales));
      S.cone([16, 40, 19 * s], [-2, 16, 19 * s], 10, 7, Object.assign({ bone: 'kn' + k, k: 5 }, scales));
      S.cone([-2, 16, 19 * s], [5, 5, 19 * s], 7, 6, Object.assign({ bone: 'an' + k, k: 4 }, scales));
      for (const d of [-4.5, 0, 4.5]) S.cone([5, 5, 19 * s + d], [22, 3, 19 * s + d * 1.6], 4.5, 3, Object.assign({ bone: 'to' + k, k: 2 }, scales));
      S.cone([44, 80, 13 * s], [50, 70, 15 * s], 5, 4, Object.assign({ bone: 'ar' + k, k: 3 }, scales));
      S.cone([50, 70, 15 * s], [58, 72, 15 * s], 4, 3, Object.assign({ bone: 'fa' + k, k: 2 }, scales));
    });
    // listras escuras no dorso
    S.paint = (x, y, z, nx, ny, nz, c) => (ny > 0.35 && Math.sin(x * 0.17 + Math.abs(z) * 0.08) > 0.6 ? mix(c, rgb(G.dark), 0.75) : c);
    const parts = [];
    for (const s of [-1, 1]) {
      parts.push(['eye', 'head', [81, 121, 11.5 * s], 4.8, { iris: '#ffd23a', pupil: 'slit', dir: [0.55, 0.15, s], lid: G.base, lidTilt: 0.5 }]);
      for (let x = 76; x <= 112; x += 5) {
        const zz = (9 - (x - 76) * 0.09) * s;
        parts.push(['fang', 'head', [x, 108.5, zz], 1.6, x < 84 ? 7.5 : 6, [0, -1, 0]]);
        if (x < 110) parts.push(['fang', 'jaw', [x + 2, 104.5, zz * 0.92], 1.5, 5.5, [0, 1, 0]]);
      }
      for (const d of [-4.5, 0, 4.5]) parts.push(['claw', 'to' + (s > 0 ? 'F' : 'B'), [23, 3, 19 * s + d * 1.6], 2.4, 7, [1, -0.3, 0]]);
      parts.push(['claw', 'fa' + (s > 0 ? 'F' : 'B'), [59, 72, 15 * s], 1.6, 4.5, [0.7, -0.7, 0]]);
    }
    for (let i = 0; i < 12; i++) {
      const x = 40 - i * 15, bone = x > 24 ? 'chest' : x > -24 ? 'hips' : x > -72 ? 'tail1' : x > -116 ? 'tail2' : 'tail3';
      const y = x > 30 ? 104 : x > -20 ? 108 - Math.abs(x) * 0.05 : 86 + 22 * Math.max(0, 1 + (x + 20) / 140);
      parts.push(['spike', bone, [x, y, 0], 4.6 - i * 0.25, 9 - i * 0.4, [-0.25, 1, 0]]);
    }
    return { S, parts };
  };

  DEF.rhino = () => {
    const S = new Sculpt(2.1);
    S.bone('body', 'root', [0, 62, 0]).bone('neck', 'body', [46, 66, 0]).bone('head', 'neck', [64, 62, 0]).bone('tail', 'body', [-62, 70, 0]);
    S.both((s, k) => {
      S.bone('sh' + k, 'body', [30, 54, 17 * s]).bone('fk' + k, 'sh' + k, [32, 28, 17 * s]).bone('fh' + k, 'fk' + k, [32, 6, 17 * s]);
      S.bone('hp' + k, 'body', [-36, 56, 17 * s]).bone('hk' + k, 'hp' + k, [-38, 28, 17 * s]).bone('hh' + k, 'hk' + k, [-38, 6, 17 * s]);
    });
    const ftR = furTone(0.05, 0.35), hide = { bump: 0.7, bf: 0.18, col: G.base, paint: (x, y, z, nx, ny, nz, c) => (ny < -0.25 ? mix(c, rgb(G.light), 0.45) : ftR(x, y, z, nx, ny, nz, c)) };
    S.ell([-4, 64, 0], [56, 30, 29], Object.assign({ bone: 'body', k: 10 }, hide));
    S.ell([28, 72, 0], [26, 27, 27], Object.assign({ bone: 'body', k: 10 }, hide));
    S.ell([-38, 68, 0], [24, 25, 26], Object.assign({ bone: 'body', k: 10 }, hide));
    for (const x of [10, -22]) S.torus([x, 66, 0], 30, 1.6, 0, { sub: true, col: G.deep, k: 2.5 });
    S.torus([48, 66, 0], 19, 1.5, 0, { sub: true, col: G.deep, k: 2 });
    S.cone([40, 68, 0], [62, 62, 0], 20, 16, Object.assign({ bone: 'neck', k: 8 }, hide));
    S.cone([64, 62, 0], [96, 46, 0], 17, 12, Object.assign({ bone: 'head', k: 6 }, hide));
    S.ell([98, 43, 0], [10, 10, 13], { bone: 'head', col: G.face, k: 4 });
    S.ell([104, 37, 0], [4, 1.5, 11], { sub: true, col: G.mouth, k: 1 });
    S.both((s) => {
      S.ell([106, 47, 5 * s], [2.4, 2, 2], { sub: true, col: G.nose, k: 1 });
      S.cone([62, 72, 9 * s], [60, 90, 13 * s], 5, 2.5, { bone: 'head', col: G.base, k: 3 });
      S.ell([61, 84, 14 * s], [2.2, 5, 1.6], { sub: true, col: G.deep, k: 1 });
      S.ell([80, 66, 12 * s], [6, 3, 4], { bone: 'head', col: G.dark, k: 2 });
    });
    S.cone([96, 52, 0], [104, 72, 0], 8, 4, { bone: 'head', col: G.horn, k: 3, paint: (x, y, z, nx, ny, nz, c) => mix(c, rgb('#b8c79a'), clamp((70 - y) / 25, 0, 0.6)) });
    S.cone([104, 72, 0], [106, 90, 0], 4, 0.8, { bone: 'head', col: G.horn, k: 2 });
    S.cone([84, 60, 0], [87, 75, 0], 5.5, 0.8, { bone: 'head', col: G.horn, k: 2 });
    S.both((s, k) => {
      S.cone([30, 54, 17 * s], [32, 28, 17 * s], 12, 9, Object.assign({ bone: 'sh' + k, k: 6 }, hide));
      S.cone([32, 28, 17 * s], [32, 8, 17 * s], 9, 9, Object.assign({ bone: 'fk' + k, k: 4 }, hide));
      S.ell([33, 5, 17 * s], [10, 6, 10], { bone: 'fh' + k, col: G.dark, k: 3 });
      S.cone([-36, 56, 17 * s], [-38, 28, 17 * s], 13, 9, Object.assign({ bone: 'hp' + k, k: 6 }, hide));
      S.cone([-38, 28, 17 * s], [-38, 8, 17 * s], 9, 9, Object.assign({ bone: 'hk' + k, k: 4 }, hide));
      S.ell([-37, 5, 17 * s], [10, 6, 10], { bone: 'hh' + k, col: G.dark, k: 3 });
    });
    S.cone([-62, 70, 0], [-68, 48, 0], 3, 2, { bone: 'tail', col: G.base, k: 3 });
    S.ell([-69, 45, 0], [3.5, 5, 3.5], { bone: 'tail', col: G.deep, bump: 0.8, bf: 0.8, k: 2 });
    const parts = [];
    for (const s of [-1, 1]) {
      parts.push(['eye', 'head', [80, 61, 13 * s], 3.4, { iris: G.iris, dir: [0.5, 0, s], lid: G.base, lidTilt: 0.35 }]);
      for (const leg of ['fh', 'hh']) for (const dz of [-5, 0, 5]) parts.push(['nail', leg + (s > 0 ? 'F' : 'B'), [(leg === 'fh' ? 42 : -28), 4, 17 * s + dz], 3, 0, null]);
    }
    return { S, parts };
  };

  DEF.kangaroo = () => {
    const S = new Sculpt(1.7);
    S.bone('pelvis', 'root', [0, 44, 0]).bone('spine', 'pelvis', [4, 76, 0]).bone('head', 'spine', [14, 124, 0]);
    S.bone('tail1', 'pelvis', [-12, 38, 0]).bone('tail2', 'tail1', [-52, 16, 0]);
    S.both((s, k) => {
      S.bone('sh' + k, 'spine', [18, 98, 9 * s]).bone('el' + k, 'sh' + k, [22, 84, 10 * s]).bone('ha' + k, 'el' + k, [28, 86, 10 * s]);
      S.bone('th' + k, 'pelvis', [-2, 46, 10 * s]).bone('kn' + k, 'th' + k, [14, 26, 11 * s]).bone('an' + k, 'kn' + k, [-6, 10, 11 * s]).bone('to' + k, 'an' + k, [16, 3, 11 * s]);
    });
    const fur = { col: G.base, bump: 0.35, bf: 0.6, paint: furTone(0.07, 0.2) };
    S.ell([-4, 48, 0], [18, 18, 16], Object.assign({ bone: 'pelvis', k: 8 }, fur));
    S.cone([-2, 52, 0], [10, 106, 0], 19, 13, Object.assign({ bone: 'spine', k: 8 }, fur));
    S.ell([12, 96, 0], [13, 14, 12], Object.assign({ bone: 'spine', k: 6 }, fur));
    S.ell([14, 66, 0], [10, 18, 13], { bone: 'pelvis', col: G.belly, k: 6 });
    S.ell([23, 74, 0], [1.6, 1, 9], { sub: true, col: G.dark, k: 1 });
    S.cone([10, 106, 0], [14, 122, 0], 10, 8, Object.assign({ bone: 'spine', k: 5 }, fur));
    S.ell([16, 128, 0], [11, 11, 10], Object.assign({ bone: 'head', k: 4 }, fur));
    S.cone([18, 126, 0], [38, 120, 0], 8, 5.5, Object.assign({ bone: 'head', k: 4 }, fur));
    S.ell([39, 122, 0], [3.6, 3, 4], { bone: 'head', col: G.nose, k: 1.5 });
    S.ell([36, 116.5, 0], [4, 0.9, 4], { sub: true, col: G.mouth, k: 0.8 });
    S.both((s, k) => {
      S.ell([7, 147, 6 * s], [4, 14, 6], Object.assign({ bone: 'head', k: 3 }, fur, { bump: 0 }));
      S.ell([8.5, 148, 8 * s], [2, 10, 3.4], { sub: true, col: G.belly, k: 1.2 });
      S.ell([0, 42, 11 * s], [18, 22, 11], Object.assign({ bone: 'th' + k, k: 6 }, fur));
      S.cone([-2, 46, 10 * s], [14, 26, 11 * s], 12, 7, Object.assign({ bone: 'th' + k, k: 5 }, fur));
      S.cone([14, 26, 11 * s], [-6, 10, 11 * s], 7, 5, Object.assign({ bone: 'kn' + k, k: 4 }, fur));
      S.cone([-6, 10, 11 * s], [16, 3, 11 * s], 5, 4, Object.assign({ bone: 'an' + k, k: 3 }, fur));
      S.cone([16, 3, 11 * s], [28, 2, 11 * s], 4, 2.6, { bone: 'to' + k, col: G.dark, k: 2 });
      S.cone([18, 98, 9 * s], [22, 84, 10 * s], 3.6, 3, Object.assign({ bone: 'sh' + k, k: 3 }, fur));
      S.cone([22, 84, 10 * s], [28, 86, 10 * s], 3, 2.5, Object.assign({ bone: 'el' + k, k: 2 }, fur));
      S.ell([30, 87, 10 * s], [3, 2.6, 3], { bone: 'ha' + k, col: G.dark, k: 1.5 });
    });
    S.cone([-10, 40, 0], [-52, 16, 0], 11, 6, Object.assign({ bone: 'tail1', k: 6 }, fur));
    S.cone([-52, 16, 0], [-82, 6, 0], 6, 2.6, Object.assign({ bone: 'tail2', k: 4 }, fur));
    const parts = [];
    for (const s of [-1, 1]) {
      parts.push(['eye', 'head', [23, 131, 7.5 * s], 3.2, { iris: G.iris, dir: [0.7, 0.1, s], lid: G.base, lidTilt: 0.3 }]);
      parts.push(['claw', 'to' + (s > 0 ? 'F' : 'B'), [29, 2, 11 * s], 1.6, 4.5, [1, -0.2, 0]]);
    }
    return { S, parts };
  };

  DEF.ram = () => {
    const S = new Sculpt(1.6);
    S.bone('body', 'root', [0, 46, 0]).bone('neck', 'body', [30, 54, 0]).bone('head', 'neck', [44, 58, 0]).bone('tail', 'body', [-36, 52, 0]);
    S.both((s, k) => {
      S.bone('fl' + k, 'body', [20, 36, 10 * s]).bone('fk' + k, 'fl' + k, [22, 18, 10 * s]).bone('fh' + k, 'fk' + k, [22, 4, 10 * s]);
      S.bone('bl' + k, 'body', [-22, 36, 10 * s]).bone('bk' + k, 'bl' + k, [-24, 18, 10 * s]).bone('bh' + k, 'bk' + k, [-24, 4, 10 * s]);
    });
    const wool = { col: '#a5dc77', bump: 3.4, bf: 0.26, k: 8, paint: (x, y, z, nx, ny, nz, c) => mix(c, rgb('#d6f2b6'), clamp(noise3(x * 0.26, y * 0.26, z * 0.26) * 1.2 + 0.2, 0, 0.7)) };
    S.ell([-4, 52, 0], [34, 24, 22], Object.assign({ bone: 'body' }, wool));
    S.ell([18, 50, 0], [18, 20, 18], Object.assign({ bone: 'body' }, wool));
    S.ell([-28, 54, 0], [18, 20, 19], Object.assign({ bone: 'body' }, wool));
    S.cone([22, 54, 0], [42, 58, 0], 10, 8, { bone: 'neck', col: G.face, k: 6 });
    S.ell([46, 60, 0], [11, 11, 9], { bone: 'head', col: G.face, k: 4 });
    S.cone([46, 58, 0], [62, 50, 0], 8, 5.6, { bone: 'head', col: G.face, k: 4 });
    S.ell([63, 51, 0], [3, 3, 4], { bone: 'head', col: G.nose, k: 1.5 });
    S.ell([61, 46, 0], [3, 0.9, 3.6], { sub: true, col: G.mouth, k: 0.8 });
    S.ell([42, 70, 0], [8, 6, 8], Object.assign({ bone: 'head' }, wool, { bump: 2, k: 4 }));
    S.both((s, k) => {
      S.ell([38, 61, 11 * s], [7, 2.4, 4], { bone: 'head', col: G.face, k: 2 });
      S.cone([20, 36, 10 * s], [22, 18, 10 * s], 4.6, 3.4, { bone: 'fl' + k, col: G.face, k: 3 });
      S.cone([22, 18, 10 * s], [22, 6, 10 * s], 3.4, 3, { bone: 'fk' + k, col: G.face, k: 2 });
      S.ell([23, 3, 10 * s], [4.6, 3.4, 4.4], { bone: 'fh' + k, col: G.hoof, k: 1.5 });
      S.cone([-22, 36, 10 * s], [-24, 18, 10 * s], 5, 3.4, { bone: 'bl' + k, col: G.face, k: 3 });
      S.cone([-24, 18, 10 * s], [-24, 6, 10 * s], 3.4, 3, { bone: 'bk' + k, col: G.face, k: 2 });
      S.ell([-23, 3, 10 * s], [4.6, 3.4, 4.4], { bone: 'bh' + k, col: G.hoof, k: 1.5 });
    });
    S.ell([-38, 54, 0], [6, 7, 6], Object.assign({ bone: 'tail' }, wool, { bump: 2, k: 4 }));
    const parts = [];
    for (const s of [-1, 1]) {
      parts.push(['eye', 'head', [52, 63, 7.6 * s], 3, { iris: '#ffd23a', pupil: 'hslit', dir: [0.5, 0.1, s], lid: G.face, lidTilt: 0.45 }]);
      parts.push(['ramhorn', 'head', [40, 66, 8.5 * s], s]);
    }
    return { S, parts };
  };

  DEF.elephant = () => {
    const S = new Sculpt(2.5);
    S.bone('body', 'root', [0, 100, 0]).bone('head', 'body', [72, 124, 0]).bone('tail', 'body', [-72, 104, 0]);
    S.bone('t1', 'head', [96, 112, 0]).bone('t2', 't1', [102, 88, 0]).bone('t3', 't2', [106, 64, 0]).bone('t4', 't3', [108, 42, 0]);
    S.both((s, k) => {
      S.bone('ear' + k, 'head', [60, 134, 26 * s]);
      S.bone('fl' + k, 'body', [34, 70, 22 * s]).bone('fk' + k, 'fl' + k, [36, 36, 22 * s]).bone('fh' + k, 'fk' + k, [36, 6, 22 * s]);
      S.bone('bl' + k, 'body', [-40, 70, 22 * s]).bone('bk' + k, 'bl' + k, [-42, 36, 22 * s]).bone('bh' + k, 'bk' + k, [-42, 6, 22 * s]);
    });
    const ftE = furTone(0.04, 0.3), skin = { col: G.base, bump: 0.8, bf: 0.14, paint: (x, y, z, nx, ny, nz, c) => { const w = Math.sin(y * 0.55 + noise3(x * 0.05, y * 0.05, z * 0.05) * 3); return w > 0.85 ? mix(c, rgb(G.dark), 0.35) : ftE(x, y, z, nx, ny, nz, c); } };
    S.ell([-6, 102, 0], [62, 46, 44], Object.assign({ bone: 'body', k: 12 }, skin));
    S.ell([30, 110, 0], [32, 38, 38], Object.assign({ bone: 'body', k: 12 }, skin));
    S.ell([74, 128, 0], [28, 28, 24], Object.assign({ bone: 'head', k: 8 }, skin));
    S.ell([80, 146, 0], [20, 12, 20], Object.assign({ bone: 'head', k: 8 }, skin));
    const ring = (x, y, z, nx, ny, nz, c) => (Math.sin(y * 1.1) > 0.55 ? mix(c, rgb(G.dark), 0.5) : c);
    S.cone([94, 118, 0], [102, 88, 0], 13, 10, { bone: 't1', col: G.base, k: 6, paint: ring });
    S.cone([102, 88, 0], [106, 64, 0], 10, 8, { bone: 't2', col: G.base, k: 4, paint: ring });
    S.cone([106, 64, 0], [108, 42, 0], 8, 6.5, { bone: 't3', col: G.base, k: 3, paint: ring });
    S.cone([108, 42, 0], [109, 24, 0], 6.5, 6, { bone: 't4', col: G.base, k: 3, paint: ring });
    S.ell([109, 20, 0], [6.5, 3, 6.5], { bone: 't4', col: G.face, k: 2 });
    S.both((s) => S.ell([109, 18, 2.4 * s], [1.6, 2, 1.6], { sub: true, col: G.nose, k: 0.8 }));
    S.ell([90, 104, 0], [8, 4, 8], { sub: true, col: G.mouth, k: 2 });
    S.both((s, k) => {
      S.ell([54, 128, 34 * s], [26, 32, 4.5], { bone: 'ear' + k, col: G.base, k: 5, paint: (x, y, z, nx, ny, nz, c) => (nz * s < 0 || x > 64 ? mix(c, rgb('#9ed26f'), 0.7) : c) });
      S.ell([86, 134, 19 * s], [6, 3, 4], { bone: 'head', col: G.dark, k: 2 });
      for (const [lx, nm] of [[34, 'f'], [-40, 'b']]) {
        S.cone([lx, 72, 22 * s], [lx + 2, 36, 22 * s], 16, 14, Object.assign({ bone: nm + 'l' + k, k: 8 }, skin));
        S.cone([lx + 2, 36, 22 * s], [lx + 2, 8, 22 * s], 14, 14, Object.assign({ bone: nm + 'k' + k, k: 4 }, skin));
        S.ell([lx + 3, 6, 22 * s], [15, 7, 15], { bone: nm + 'h' + k, col: G.dark, k: 3 });
      }
    });
    S.cone([-70, 106, 0], [-80, 74, 0], 3, 2, { bone: 'tail', col: G.base, k: 3 });
    S.ell([-81, 70, 0], [3, 6, 3], { bone: 'tail', col: G.deep, bump: 0.8, bf: 0.9, k: 2 });
    const parts = [];
    for (const s of [-1, 1]) {
      const k = s > 0 ? 'F' : 'B';
      parts.push(['eye', 'head', [91, 134, 17 * s], 3.8, { iris: G.iris, dir: [0.6, 0.05, s], lid: G.base, lidTilt: 0.4 }]);
      parts.push(['tusk', 'head', [92, 104, 10 * s], s]);
      for (const [lx, nm] of [[52, 'fh'], [-26, 'bh']]) for (const dz of [-8, 0, 8]) parts.push(['nail', nm + k, [lx, 6, 22 * s + dz], 4.4, 0, null]);
    }
    return { S, parts };
  };

  DEF.beast = () => {
    const S = new Sculpt(2.0);
    S.bone('hips', 'root', [0, 54, 0]).bone('chest', 'hips', [8, 100, 0]).bone('head', 'chest', [42, 144, 0]).bone('jaw', 'head', [50, 134, 0]);
    S.both((s, k) => {
      S.bone('sh' + k, 'chest', [22, 124, 30 * s]).bone('el' + k, 'sh' + k, [32, 84, 44 * s]).bone('ha' + k, 'el' + k, [30, 46, 47 * s]);
      S.bone('th' + k, 'hips', [-2, 54, 16 * s]).bone('kn' + k, 'th' + k, [16, 34, 18 * s]).bone('an' + k, 'kn' + k, [-4, 16, 18 * s]).bone('to' + k, 'an' + k, [12, 4, 18 * s]);
    });
    const fur = { col: G.base, bump: 0.9, bf: 0.5, paint: furTone(0.08, 0.25) };
    S.ell([-2, 58, 0], [24, 20, 22], Object.assign({ bone: 'hips', k: 8 }, fur));
    S.ell([6, 100, 0], [32, 38, 28], Object.assign({ bone: 'chest', k: 10 }, fur));
    S.ell([-8, 118, 0], [26, 24, 26], Object.assign({ bone: 'chest', k: 10 }, fur, { bump: 1.2 }));
    S.ell([26, 104, 0], [12, 22, 20], { bone: 'chest', col: G.light, k: 6, bump: 0.6, bf: 0.4 });
    S.ell([18, 76, 0], [12, 16, 16], { bone: 'hips', col: G.light, k: 6 });
    for (let i = 0; i < 6; i++) { const bx = -30 + i * 10, by = 122 + Math.sin(i * 0.6) * 8; S.cone([bx, by, 0], [bx - 10, by + 16 - i, 0], 6, 0.8, { bone: 'chest', col: G.deep, k: 3 }); }
    S.cone([18, 124, 0], [40, 142, 0], 15, 12, Object.assign({ bone: 'chest', k: 8 }, fur));
    S.ell([42, 148, 0], [16, 15, 14], Object.assign({ bone: 'head', k: 5 }, fur, { bump: 1 }));
    S.cone([48, 144, 0], [76, 138, 0], 10, 6.5, { bone: 'head', col: G.base, k: 5 });
    S.ell([78, 140, 0], [5, 4, 5], { bone: 'head', col: G.nose, k: 1.5 });
    S.ell([66, 133.5, 0], [14, 1.6, 10], { sub: true, col: G.mouth, k: 1.2 });
    S.cone([46, 131, 0], [72, 131, 0], 7, 5, { bone: 'jaw', col: G.base, k: 3 });
    S.both((s, k) => {
      S.ell([51, 155, 7 * s], [8, 3.5, 5], { bone: 'head', col: G.deep, k: 2.5 });
      S.ell([37, 142, 13 * s], [9, 11, 6], Object.assign({ bone: 'head', k: 4 }, fur, { bump: 1 }));
      S.cone([36, 158, 9 * s], [28, 182, 12 * s], 7, 1, { bone: 'head', col: G.base, k: 3 });
      S.ell([33, 168, 12.5 * s], [2.4, 7, 2], { sub: true, col: G.deep, k: 1 });
      S.ell([20, 124, 28 * s], [16, 15, 15], Object.assign({ bone: 'chest', k: 8 }, fur));
      S.cone([22, 124, 30 * s], [32, 84, 44 * s], 11, 9, Object.assign({ bone: 'sh' + k, k: 4, soft: 2 }, fur));
      S.cone([32, 84, 44 * s], [30, 48, 47 * s], 9, 7, Object.assign({ bone: 'el' + k, k: 4, soft: 2 }, fur));
      S.ell([30, 40, 47 * s], [9, 9, 9], { bone: 'ha' + k, col: G.skin, k: 3, soft: 2 });
      for (const d of [-5.4, -1.8, 1.8, 5.4]) S.cone([31, 35, 47 * s + d], [33, 25, 47 * s + d * 1.1], 3, 2.5, { bone: 'ha' + k, col: G.skin, k: 1.2, soft: 2 });
      S.cone([-2, 54, 16 * s], [16, 34, 18 * s], 14, 9, Object.assign({ bone: 'th' + k, k: 6 }, fur));
      S.cone([16, 34, 18 * s], [-4, 16, 18 * s], 8, 6, Object.assign({ bone: 'kn' + k, k: 4 }, fur));
      S.cone([-4, 16, 18 * s], [12, 4, 18 * s], 6, 5, Object.assign({ bone: 'an' + k, k: 3 }, fur));
      for (const d of [-4, 0, 4]) S.cone([12, 4, 18 * s + d], [22, 3, 18 * s + d * 1.3], 3.4, 2.6, { bone: 'to' + k, col: G.skin, k: 1.5 });
    });
    const parts = [];
    for (const s of [-1, 1]) {
      const k = s > 0 ? 'F' : 'B';
      parts.push(['eye', 'head', [53, 149, 8 * s], 4, { iris: '#fff36a', pupil: 'slit', dir: [0.8, 0.1, s * 0.55], lid: G.deep, lidTilt: 0.15 }]);
      parts.push(['fang', 'head', [62, 135, 4.5 * s], 1.8, 7, [0, -1, 0]], ['fang', 'jaw', [64, 132, 5 * s], 1.7, 6, [0, 1, 0]]);
      for (const x of [56, 70]) parts.push(['tooth', 'head', [x, 134.6, 6 * s], 1.2, 3, [0, -1, 0]]);
      for (const d of [-5.4, -1.8, 1.8, 5.4]) parts.push(['claw', 'ha' + k, [33.5, 23, 47 * s + d * 1.1], 2, 10, [0.25, -1, 0]]);
      for (const d of [-4, 0, 4]) parts.push(['claw', 'to' + k, [23, 3, 18 * s + d * 1.3], 1.6, 5, [1, -0.2, 0]]);
    }
    return { S, parts };
  };

  DEF.cheetah = () => {
    const S = new Sculpt(1.35);
    S.bone('hips', 'root', [-28, 48, 0]).bone('chest', 'hips', [22, 50, 0]).bone('neck', 'chest', [36, 54, 0]).bone('head', 'neck', [52, 60, 0]);
    S.bone('tail1', 'hips', [-44, 50, 0]).bone('tail2', 'tail1', [-76, 42, 0]);
    S.both((s, k) => {
      S.bone('f1' + k, 'chest', [28, 44, 8 * s]).bone('f2' + k, 'f1' + k, [30, 26, 8 * s]).bone('f3' + k, 'f2' + k, [28, 8, 8 * s]);
      S.bone('b1' + k, 'hips', [-30, 46, 8 * s]).bone('b2' + k, 'b1' + k, [-36, 28, 8 * s]).bone('b3' + k, 'b2' + k, [-28, 10, 8 * s]);
    });
    const coat = { col: '#6fbf3e', paint: (x, y, z, nx, ny, nz, c) => (ny < -0.45 ? mix(c, rgb(G.belly), 0.8) : c) };
    S.ell([-28, 50, 0], [18, 14, 11], Object.assign({ bone: 'hips', k: 7 }, coat));
    S.cone([-26, 49, 0], [20, 51, 0], 10.5, 12, Object.assign({ bone: 'hips', k: 7 }, coat));
    S.ell([22, 50, 0], [18, 16, 12], Object.assign({ bone: 'chest', k: 7 }, coat));
    S.cone([30, 56, 0], [48, 60, 0], 10, 7.5, Object.assign({ bone: 'neck', k: 6 }, coat));
    S.ell([54, 62, 0], [10, 9, 9], Object.assign({ bone: 'head', k: 4 }, coat));
    S.ell([63, 58, 0], [6, 5, 6.5], { bone: 'head', col: G.belly, k: 3 });
    S.ell([68.4, 59.6, 0], [2.4, 2, 3], { bone: 'head', col: G.nose, k: 1 });
    S.ell([66, 54.4, 0], [3, 0.7, 4], { sub: true, col: G.mouth, k: 0.6 });
    S.both((s, k) => {
      S.ell([48, 70, 6.5 * s], [3.5, 4.5, 2], Object.assign({ bone: 'head', k: 2 }, coat));
      S.ell([49, 70.5, 7.6 * s], [1.8, 2.8, 0.9], { sub: true, col: G.deep, k: 0.8 });
      S.cone([28, 44, 8 * s], [30, 26, 8 * s], 6, 4, Object.assign({ bone: 'f1' + k, k: 4 }, coat));
      S.cone([30, 26, 8 * s], [28, 8, 8 * s], 4, 3, Object.assign({ bone: 'f2' + k, k: 3 }, coat));
      S.ell([31, 4, 8 * s], [5, 3, 4], Object.assign({ bone: 'f3' + k, k: 2 }, coat));
      S.cone([-30, 46, 8 * s], [-36, 28, 8 * s], 8, 5, Object.assign({ bone: 'b1' + k, k: 4 }, coat));
      S.cone([-36, 28, 8 * s], [-28, 10, 8 * s], 4.5, 3.5, Object.assign({ bone: 'b2' + k, k: 3 }, coat));
      S.cone([-28, 10, 8 * s], [-24, 4, 8 * s], 3.5, 3, Object.assign({ bone: 'b3' + k, k: 2 }, coat));
      S.ell([-21, 3, 8 * s], [5, 3, 4], Object.assign({ bone: 'b3' + k, k: 2 }, coat));
    });
    S.cone([-44, 50, 0], [-76, 42, 0], 4, 3, Object.assign({ bone: 'tail1', k: 3 }, coat));
    S.cone([-76, 42, 0], [-104, 50, 0], 3, 2.2, Object.assign({ bone: 'tail2', k: 2 }, coat));
    const spot = rgb(G.deep);
    S.paint = (x, y, z, nx, ny, nz, c) => {
      // listra "de lágrima" do olho até a boca
      for (const s of [-1, 1]) { const t = clamp(((x - 58) * 4 + (y - 64) * -9) / (16 + 81), 0, 1), px = 58 + 4 * t, py = 64 - 9 * t; if (Math.hypot(x - px, y - py) < 1.3 && z * s > 3) return mix(c, spot, 0.9); }
      if (x < -88) return Math.sin(x * 0.55) > 0.2 ? mix(c, spot, 0.9) : c;
      if (ny < -0.4 || x > 58) return c;
      return cellDist(x * 0.3, y * 0.3, z * 0.3) < 0.3 ? mix(c, spot, 0.9) : c;
    };
    const parts = [];
    for (const s of [-1, 1]) parts.push(['eye', 'head', [59.5, 65, 6 * s], 2.7, { iris: '#f2b23a', dir: [0.8, 0.1, s * 0.6], lid: '#6fbf3e', lidTilt: 0.4 }]);
    return { S, parts };
  };

  DEF.soulraven = () => {
    const S = new Sculpt(1.3);
    S.bone('body', 'root', [0, 58, 0]).bone('head', 'body', [24, 62, 0]).bone('tail', 'body', [-22, 56, 0]);
    S.both((s, k) => S.bone('wing' + k, 'body', [2, 64, 6 * s]));
    S.ell([0, 58, 0], [24, 10.5, 11.5], { bone: 'body', col: '#ffffff', k: 6 });
    S.ell([12, 56, 0], [13, 10, 10], { bone: 'body', col: '#ffffff', k: 6 });
    S.ell([26, 63, 0], [9, 8.5, 8], { bone: 'head', col: '#ffffff', k: 4 });
    S.cone([32, 62, 0], [47, 59, 0], 3.8, 0.4, { bone: 'head', col: '#ffffff', k: 2 });
    S.ell([-27, 57, 0], [12, 2.4, 10], { bone: 'tail', col: '#ffffff', k: 3 });
    return { S, parts: [] };
  };

  DEF.rabbit = () => {
    const S = new Sculpt(1.25);
    S.bone('body', 'root', [0, 22, 0]).bone('head', 'body', [16, 44, 0]);
    S.both((s, k) => S.bone('ear' + k, 'head', [12, 54, 5 * s]));
    const W = '#f6f4fa', fluff = { col: W, bump: 0.7, bf: 0.5 };
    S.ell([0, 24, 0], [20, 18, 17], Object.assign({ bone: 'body', k: 6 }, fluff));
    S.ell([8, 18, 0], [10, 12, 12], { bone: 'body', col: '#ffffff', k: 5 });
    S.ell([-20, 28, 0], [7, 7, 7], Object.assign({ bone: 'body', k: 3 }, fluff, { bump: 1.4 }));
    S.ell([18, 44, 0], [12, 11, 11], Object.assign({ bone: 'head', k: 5 }, fluff, { bump: 0.4 }));
    S.ell([30.4, 43, 0], [2.2, 1.8, 2.4], { bone: 'head', col: '#ff8aa8', k: 1 });
    S.ell([28.5, 38.5, 0], [2.2, 0.6, 3], { sub: true, col: '#8a2a3a', k: 0.6 });
    S.both((s, k) => {
      S.ell([24, 40, 6 * s], [6, 5, 5], Object.assign({ bone: 'head', k: 3 }, fluff, { bump: 0.4 }));
      S.ell([12, 66, 5 * s], [4, 13, 6], { bone: 'ear' + k, col: W, k: 3 });
      S.ell([13.4, 66, 6.8 * s], [2, 9, 3.2], { sub: true, col: '#ffb6c8', k: 1 });
      S.ell([-6, 16, 10 * s], [12, 12, 7], Object.assign({ bone: 'body', k: 4 }, fluff));
      S.ell([8, 3, 9 * s], [10, 3.5, 5], { bone: 'body', col: W, k: 3 });
      S.ell([14, 8, 6 * s], [4, 6, 4], { bone: 'body', col: W, k: 3 });
    });
    const parts = [];
    for (const s of [-1, 1]) parts.push(['eye', 'head', [24.5, 47, 6.8 * s], 2.6, { iris: '#7a1830', dir: [0.7, 0.1, s * 0.7] }]);
    parts.push(['tooth', 'head', [29, 39, 1.3], 1.3, 3, [0, -1, 0]], ['tooth', 'head', [29, 39, -1.3], 1.3, 3, [0, -1, 0]]);
    return { S, parts };
  };
  DEF.cheetahAtk = DEF.cheetah;

  // ------------------------------------------------------------ Geometria (gerada uma vez)
  const CACHE = new Map();
  // cada forma: { gen (gerador em andamento), geo (pronta), bones, parts, ms (tempo de trabalho) }
  function entry(name) {
    const key = name === 'cheetahAtk' ? 'cheetah' : name;
    let d = CACHE.get(key);
    if (!d) { const def = DEF[key](); d = { gen: meshOf(def.S), geo: null, bones: def.S.bones, parts: def.parts, ms: 0 }; CACHE.set(key, d); }
    return d;
  }
  function step(d, budget) { // avança o gerador por até "budget" ms; true quando terminou
    const t0 = performance.now();
    while (!d.geo) {
      const r = d.gen.next();
      if (r.done) { d.geo = r.value; d.tris = d.geo.index.count / 3; }
      if (performance.now() - t0 > budget) break;
    }
    d.ms += performance.now() - t0;
    return !!d.geo;
  }
  function data(name) { const d = entry(name); step(d, 1e9); return d; }
  const QUEUE = [];
  let pumping = false;
  function kick() { if (!pumping) { pumping = true; setTimeout(pump, 30); } }
  function pump() {
    pumping = false;
    while (QUEUE.length && CACHE.get(QUEUE[0]).geo) QUEUE.shift();
    if (!QUEUE.length) return;
    step(CACHE.get(QUEUE[0]), 4);
    pumping = true; setTimeout(pump, 33);
  }

  // ------------------------------------------------------------ Materiais
  const MATS = new Map();
  function rimify(m, col, power, amt) {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.rimCol = { value: new T.Color(col) };
      sh.fragmentShader = 'uniform vec3 rimCol;\n' + sh.fragmentShader.replace('#include <output_fragment>',
        `float rimK = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);\n outgoingLight += rimCol * pow(rimK, ${power.toFixed(1)}) * ${amt.toFixed(2)};\n#include <output_fragment>`);
    };
    m.customProgramCacheKey = () => 'rim' + col + power + amt;
    return m;
  }
  TT.rimify = (THREE, m, col, power, amt) => { T = T || THREE; return rimify(m, col, power, amt); };
  function grad4() {
    if (MATS.has('grad')) return MATS.get('grad');
    const gd = new Uint8Array([88, 88, 88, 255, 150, 150, 150, 255, 212, 212, 212, 255, 255, 255, 255, 255]);
    const g = new T.DataTexture(gd, 4, 1, T.RGBAFormat); g.minFilter = g.magFilter = T.NearestFilter; g.needsUpdate = true;
    MATS.set('grad', g); return g;
  }
  function bodyMat(rim) {
    const k = 'body' + rim;
    if (!MATS.has(k)) MATS.set(k, rimify(new T.MeshToonMaterial({ vertexColors: true, gradientMap: grad4() }), rim, 3, 0.55));
    return MATS.get(k);
  }
  function solid(col, rim) {
    const k = 's' + col + rim;
    if (!MATS.has(k)) MATS.set(k, rimify(new T.MeshToonMaterial({ color: new T.Color(col), gradientMap: grad4() }), rim || '#ffffff', 3, 0.35));
    return MATS.get(k);
  }
  function skinOutline(col, thick) {
    const k = 'ol' + col + thick;
    if (!MATS.has(k)) {
      const m = new T.MeshBasicMaterial({ color: new T.Color(col), side: T.BackSide });
      m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3( position ) + normal * ${thick.toFixed(2)};`); };
      m.customProgramCacheKey = () => 'olk' + thick;
      MATS.set(k, m);
    }
    return MATS.get(k);
  }
  // textura do olho: branco, íris com borda escura, pupila (redonda / fenda vertical / horizontal) e brilho
  function eyeTex(iris, pupil) {
    const k = 'eye' + iris + pupil;
    if (MATS.has(k)) return MATS.get(k);
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 128);
    const gr = g.createRadialGradient(128, 64, 4, 128, 64, 30);
    gr.addColorStop(0, iris); gr.addColorStop(0.75, iris); gr.addColorStop(1, '#0e1a08');
    g.fillStyle = gr; g.beginPath(); g.ellipse(128, 64, 30, 30, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#060806'; g.beginPath();
    if (pupil === 'slit') g.ellipse(128, 64, 5, 25, 0, 0, Math.PI * 2);
    else if (pupil === 'hslit') g.ellipse(128, 64, 22, 6, 0, 0, Math.PI * 2);
    else g.ellipse(128, 64, 14, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(119, 52, 7, 6, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(137, 74, 3, 3, 0, 0, Math.PI * 2); g.fill();
    const tx = new T.CanvasTexture(c); tx.anisotropy = 4;
    MATS.set(k, tx); return tx;
  }
  // chifre espiralado do carneiro (tubo afinando, com anéis)
  function ramHornGeo(side) {
    if (MATS.has('ramhorn' + side)) return MATS.get('ramhorn' + side);
    const N = 60, R = 12, segs = 10, pos = [], idx = [], nrm = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = 0.3 + t * Math.PI * 1.75, rad = R * (1 - 0.45 * t);
      const cx = -Math.sin(a) * rad * 0.9 + 4, cy = Math.cos(a) * rad - 2, cz = t * 7;
      const ta = a + 0.01, nx2 = -Math.sin(ta) * R * (1 - 0.45 * (t + 0.01)) * 0.9 + 4, ny2 = Math.cos(ta) * R * (1 - 0.45 * (t + 0.01)) - 2;
      const tg = new T.Vector3(nx2 - cx, ny2 - cy, 0.12).normalize(), up = new T.Vector3(0, 0, 1), sd2 = new T.Vector3().crossVectors(tg, up).normalize(), u2 = new T.Vector3().crossVectors(sd2, tg).normalize();
      const r = (4.6 - 3.4 * t) * (1 + 0.08 * Math.sin(i * 1.6));
      for (let j = 0; j <= segs; j++) {
        const b = j / segs * Math.PI * 2, n = sd2.clone().multiplyScalar(Math.cos(b)).add(u2.clone().multiplyScalar(Math.sin(b)));
        pos.push(cx + n.x * r, cy + n.y * r, (cz + n.z * r) * side); nrm.push(n.x, n.y, n.z * side);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
    MATS.set('ramhorn' + side, g); return g;
  }
  // presa do elefante: curva para a frente e para cima, afinando
  function tuskGeo() {
    if (MATS.has('tusk')) return MATS.get('tusk');
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new T.Vector3(t * 24, -t * 10 + t * t * 20, 0)); }
    const curve = new T.CatmullRomCurve3(pts), g = new T.TubeGeometry(curve, 24, 1, 10, false);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { // afina a ponta (o tubo sai com raio 1)
      const ring = Math.floor(i / 11), t = ring / 24, r = 4.2 * (1 - t * 0.85);
      const c = curve.getPoint(t);
      p.setXYZ(i, c.x + n.getX(i) * r, c.y + n.getY(i) * r, c.z + n.getZ(i) * r);
    }
    g.computeVertexNormals();
    MATS.set('tusk', g); return g;
  }

  // ------------------------------------------------------------ Montagem de uma forma para um Titã
  // W = World3D (materiais com contorno, brilhos), F = { g } da forma, M = modelo do Titã (lista de malhas
  // que piscam ao levar dano), f = o Titã. Devolve F.B (ossos) e F.R (posição de repouso de cada osso).
  function assemble(W, name, F, M, f) {
    T = T || window.THREE;
    const d = data(name);
    const pal = name === 'soulraven' ? TT.ravenPal(f) : null;
    const outlineCol = pal ? pal.rim : '#140a22';
    const body = F.body = new T.Group(); F.g.add(body);
    const holder = F.holder = new T.Group(); body.add(holder);
    const bones = d.bones.map(() => new T.Bone());
    F.B = {}; F.R = {};
    d.bones.forEach((b, i) => {
      const bone = bones[i], par = b.parent ? d.bones.find((q) => q.name === b.parent) : null;
      const pa = par ? par.at : [0, 0, 0];
      bone.position.set(b.at[0] - pa[0], b.at[1] - pa[1], b.at[2] - pa[2]);
      if (par) bones[d.bones.indexOf(par)].add(bone);
      F.B[b.name] = bone; F.R[b.name] = b.at;
    });
    const mat = pal ? bodyMatColored(pal) : bodyMat('#c8ffb0');
    const mesh = new T.SkinnedMesh(d.geo, mat);
    mesh.add(bones[0]);
    holder.add(mesh);
    mesh.updateMatrixWorld(true);
    const sk = new T.Skeleton(bones);
    mesh.bind(sk);
    mesh.castShadow = true; mesh.frustumCulled = false;
    mesh.userData.mat = mat;
    M.meshes.push(mesh);
    const ol = new T.SkinnedMesh(d.geo, skinOutline(outlineCol, pal ? 1.6 : 1.25));
    ol.frustumCulled = false; mesh.add(ol); ol.bind(sk, mesh.bindMatrix);
    F.mesh = mesh;
    // peças rígidas presas aos ossos
    const local = (bone, at) => { const r = F.R[bone]; return [at[0] - r[0], at[1] - r[1], at[2] - r[2]]; };
    const olMat = W.outlineMat;
    const piece = (bone, geo, m, at, o) => {
      const me = new T.Mesh(geo, m); const l = local(bone, at); me.position.set(l[0], l[1], l[2]);
      me.castShadow = true; me.userData.mat = m; M.meshes.push(me);
      if (!(o && o.outline === false)) { const om = new T.Mesh(geo, olMat); me.add(om); }
      F.B[bone].add(me); return me;
    };
    const aim = (me, dir) => { const v = new T.Vector3(dir[0], dir[1], dir[2]).normalize(); me.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v); };
    for (const p of d.parts) {
      const [kind, bone, at] = p;
      if (kind === 'eye') {
        const r = p[3], o = p[4];
        const em = W.mats.get('eyeM' + o.iris + o.pupil) || (() => { const m = new T.MeshToonMaterial({ map: eyeTex(o.iris, o.pupil), gradientMap: grad4() }); W.mats.set('eyeM' + o.iris + o.pupil, m); return m; })();
        const eye = piece(bone, W.geo('eyeball' + r, () => new T.SphereGeometry(r, 20, 14)), em, at, { outline: false });
        const v = new T.Vector3(o.dir[0], o.dir[1], o.dir[2]).normalize();
        eye.quaternion.setFromUnitVectors(new T.Vector3(1, 0, 0), v);
        if (o.lid) { // pálpebra de cima: dá o olhar bravo do desenho
          const lm = solid(o.lid), lid = new T.Mesh(W.geo('lid' + r, () => new T.SphereGeometry(r * 1.12, 18, 8, 0, Math.PI * 2, 0, 0.95)), lm);
          lid.rotation.z = -(o.lidTilt || 0.4); lid.userData.mat = lm; M.meshes.push(lid);
          lid.add(new T.Mesh(lid.geometry, olMat));
          eye.add(lid);
        }
      } else if (kind === 'fang' || kind === 'tooth' || kind === 'claw' || kind === 'spike') {
        const r = p[3], len = p[4], dir = p[5];
        const col = kind === 'spike' ? G.deep : kind === 'claw' ? G.claw : G.teeth;
        const geo = W.geo('fang' + r + ':' + len, () => { const g = new T.ConeGeometry(r, len, 8); g.translate(0, len / 2, 0); return g; });
        const me = piece(bone, geo, solid(col), at, { outline: kind !== 'tooth' });
        aim(me, dir);
      } else if (kind === 'nail') {
        const r = p[3];
        const me = piece(bone, W.geo('nail' + r, () => new T.SphereGeometry(r, 10, 8)), solid('#e9eccf'), at);
        me.scale.set(0.7, 0.6, 1);
      } else if (kind === 'ramhorn') {
        piece(bone, ramHornGeo(p[3]), solid(G.horn), at);
      } else if (kind === 'tusk') {
        const s = p[3], me = piece(bone, tuskGeo(), solid('#f6f2e0'), at);
        me.rotation.y = -s * 0.25;
      }
    }
    if (name === 'soulraven') buildRavenWings(W, F, M, pal);
    return F;
  }
  function bodyMatColored(pal) {
    const k = 'raven' + pal.crow;
    if (!MATS.has(k)) MATS.set(k, rimify(new T.MeshToonMaterial({ color: new T.Color(pal.crow), gradientMap: grad4() }), pal.rim, 2, 1.2));
    return MATS.get(k);
  }
  // asas do corvo da alma: penas em leque presas ao osso de cada asa
  function buildRavenWings(W, F, M, P) {
    const fm = rimify(new T.MeshToonMaterial({ color: new T.Color(P.crow), gradientMap: grad4(), side: T.DoubleSide }), P.rim, 2, 1.2);
    const om = skinOutline(P.rim, 1.2);
    const feather = W.geo('feather', () => { const g = new T.SphereGeometry(1, 12, 8); g.scale(5, 1.2, 1); g.translate(5, 0, 0); return g; });
    F.feathers = [];
    for (const [k, s] of [['F', 1], ['B', -1]]) {
      const bone = F.B['wing' + k];
      for (let i = 0; i < 9; i++) {
        const t = i / 8, len = 7 + 9 * Math.sin(t * Math.PI * 0.85) + (i > 5 ? 3 : 0);
        const me = new T.Mesh(feather, fm); me.userData.mat = fm; M.meshes.push(me);
        const o = new T.Mesh(feather, om); me.add(o);
        me.scale.set(len / 5, 1, 1);
        me.position.set(-t * 22, 0, s * (4 + t * 30));
        me.rotation.y = -s * (Math.PI / 2 - 0.4 - t * 1.1);
        bone.add(me); F.feathers.push(me);
      }
    }
    for (const s of [-1, 1]) { const e = new T.Mesh(W.geo('sph2.4', () => new T.SphereGeometry(2.4, 10, 8)), W.neon(P.eye)); e.position.set(4, 1.5, 5.6 * s); F.B.head.add(e); }
    F.glow = W.glowSprite(P.glow, 160, 0.55); F.B.body.add(F.glow);
  }

  // ------------------------------------------------------------ Animação (mesmos tempos dos desenhos 2D)
  const easeOut = (k) => 1 - (1 - k) * (1 - k);
  const popScale = (t) => { const p = clamp(t / 4, 0, 1); return 0.55 + 0.45 * easeOut(p) + Math.sin(p * Math.PI) * 0.12; };
  const ang = (dx, dy) => Math.atan2(dx, -dy); // 0 = para baixo, + = para a frente
  // dois ossos (up -> lo -> ponta "end") alcançando (tx, ty) no referencial de repouso; rotPar = giro do pai em z
  function ik(F, up, lo, end, tx, ty, bend, rotPar, piv) {
    const S = F.R[up], E = F.R[lo], H = F.R[end];
    if (rotPar) { const c = Math.cos(-rotPar), s = Math.sin(-rotPar), dx = tx - piv[0], dy = ty - piv[1]; tx = piv[0] + dx * c - dy * s; ty = piv[1] + dx * s + dy * c; }
    const L1 = Math.hypot(E[0] - S[0], E[1] - S[1]), L2 = Math.hypot(H[0] - E[0], H[1] - E[1]);
    const R1 = ang(E[0] - S[0], E[1] - S[1]), R2 = ang(H[0] - E[0], H[1] - E[1]);
    const dx = tx - S[0], dy = ty - S[1], d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.01);
    const c1 = Math.acos(clamp((d * d + L1 * L1 - L2 * L2) / (2 * d * L1), -1, 1));
    const A1 = ang(dx, dy) + bend * c1, ex = S[0] + Math.sin(A1) * L1, ey = S[1] - Math.cos(A1) * L1;
    const A2 = (Math.hypot(dx, dy) >= L1 + L2 - 0.02) ? A1 : ang(tx - ex, ty - ey);
    F.B[up].rotation.z = A1 - R1;
    F.B[lo].rotation.z = A2 - R2 - (A1 - R1);
    return A2 - R2;
  }
  const rz = (F, n, v) => { F.B[n].rotation.z = v; };
  const ANIM = {
    gorilla(F, fm) {
      const { t, s } = fm;
      const up = clamp(t / (s - 4), 0, 1), down = clamp((t - (s - 4)) / 4, 0, 1), rec = clamp((t - s - 5) / 14, 0, 1);
      let sx = 1, sy = 1;
      if (t < s - 4) { sx = 1 - 0.08 * easeOut(up); sy = 1 + 0.1 * easeOut(up); } else if (t < s + 5) { const k = clamp((t - s) / 5, 0, 1); sx = t < s ? 1 : 1.2 - 0.06 * k; sy = t < s ? 1.04 : 0.82 + 0.05 * k; } else { sx = TT.lerp(1.14, 1, rec); sy = TT.lerp(0.87, 1, rec); }
      const ps = popScale(t) * 1.05;
      F.body.scale.set(sx * ps, sy * ps, ps);
      let hx, hy;
      if (down <= 0) { const e = easeOut(up); hx = TT.lerp(52, 6, e); hy = TT.lerp(40, 205, e); } else { hx = TT.lerp(6, 104, down); hy = TT.lerp(205, 18, down * down); }
      if (t > s + 5) { hx = TT.lerp(104, 52, rec); hy = TT.lerp(18, 40, rec); }
      const lean = down > 0 && t < s + 5 ? -0.22 * down : t < s - 4 ? 0.12 * easeOut(up) : -0.22 * (1 - rec);
      rz(F, 'chest', lean);
      for (const [k, off] of [['F', 0], ['B', -10]]) ik(F, 'sh' + k, 'el' + k, 'ha' + k, hx + off, hy, -1, lean, F.R.chest);
      const roar = t >= s - 3 && t < s + 10;
      rz(F, 'head', roar ? 0.25 : -0.05 - lean);
      rz(F, 'jaw', roar ? -0.55 : 0);
      for (const k of ['F', 'B']) { rz(F, 'th' + k, 0.1 * (sy - 1) * 4); rz(F, 'kn' + k, -0.1 * (sy - 1) * 8); }
    },
    trex(F, fm) {
      const { t, s, end } = fm;
      const pre = clamp(t / s, 0, 1), run = t >= s && t < end, stop = clamp((t - end) / 10, 0, 1);
      const ph = t * 0.45, step = run ? Math.sin(ph) : 0, bob = run ? Math.abs(Math.cos(ph)) * 7 : 0;
      const tl = t < s ? -0.28 * easeOut(pre) : run ? 0.06 : -0.12 * (1 - stop);
      const jw = t < s ? 0.15 + 0.55 * pre : run ? 0.2 + Math.abs(Math.sin(t * 0.32)) * 0.45 : 0.15;
      const ps = popScale(t) * 1.15, sq = run ? 1 + Math.cos(ph * 2) * 0.03 : 1;
      F.body.position.y = bob; F.body.scale.set(ps / sq, ps * sq, ps);
      rz(F, 'hips', -tl);
      rz(F, 'neck', t < s ? 0.25 * pre : run ? Math.sin(t * 0.32) * 0.06 : 0);
      rz(F, 'head', t < s ? 0.15 * pre : 0);
      rz(F, 'jaw', -jw * 0.9);
      const wag = Math.sin(t * 0.25);
      F.B.tail1.rotation.set(0, wag * 0.12, tl * 0.6); F.B.tail2.rotation.set(0, wag * 0.16, 0.05); F.B.tail3.rotation.set(0, wag * 0.2, 0.08);
      for (const [k, sg] of [['F', 1], ['B', -1]]) {
        const p = step * sg;
        rz(F, 'th' + k, p * 0.55 + tl); rz(F, 'kn' + k, -Math.max(0, p) * 0.5); rz(F, 'an' + k, Math.max(0, -p) * 0.6); rz(F, 'to' + k, -(p * 0.55 + tl) * 0.8);
        rz(F, 'ar' + k, Math.sin(t * 0.6 + sg) * 0.4); rz(F, 'fa' + k, 0.3);
      }
    },
    rhino(F, fm) {
      const { t, s, end } = fm;
      const pre = clamp(t / s, 0, 1), run = t >= s && t < end, stop = clamp((t - end) / 8, 0, 1);
      const ph = t * 0.55, gal = run ? Math.sin(ph) : 0, bob = run ? Math.abs(Math.sin(ph)) * 6 : 0;
      const tl = t < s ? -0.18 * easeOut(pre) : run ? 0.08 : -0.1 * (1 - stop);
      const ps = popScale(t) * 1.1, st = run ? 1.06 : t < s ? 0.95 : 1;
      F.body.position.y = bob; F.body.scale.set(ps * st, ps / st, ps);
      rz(F, 'body', -tl);
      rz(F, 'head', -(run ? 0.12 + Math.sin(ph) * 0.05 : t < s ? -0.2 * pre : 0));
      rz(F, 'tail', Math.sin(t * 0.8) * 0.4);
      for (const [n1, n2, n3, sg] of [['shF', 'fkF', 'fhF', 1], ['shB', 'fkB', 'fhB', -1], ['hpF', 'hkF', 'hhF', -1], ['hpB', 'hkB', 'hhB', 1]]) {
        const p = gal * sg; rz(F, n1, p * 0.55 + tl); rz(F, n2, -Math.max(0, p) * 0.7); rz(F, n3, -(p * 0.55 + tl) + Math.max(0, p) * 0.7);
      }
    },
    kangaroo(F, fm) {
      const { t, s, end } = fm;
      const pre = clamp(t / s, 0, 1), hit = t >= s && t < end, rec = clamp((t - end) / 10, 0, 1);
      const ln = t < s ? -0.5 * easeOut(pre) : hit ? -0.75 : -0.75 * (1 - rec);
      const REST = [-6, 10], CH = [10, 46], EX = [78, 58];
      let A;
      if (t < s) A = [TT.lerp(REST[0], CH[0], easeOut(pre)), TT.lerp(REST[1], CH[1], easeOut(pre))];
      else if (t < end) { const k = clamp((t - s + 1) / 2, 0, 1); A = [TT.lerp(CH[0], EX[0], k), TT.lerp(CH[1], EX[1], k)]; }
      else { const k = rec * rec * (3 - 2 * rec); A = [TT.lerp(EX[0], REST[0], k), TT.lerp(EX[1], REST[1], k)]; }
      F.body.scale.setScalar(popScale(t) * 1.05);
      rz(F, 'pelvis', -ln * 0.6); rz(F, 'spine', -ln * 0.5);
      rz(F, 'head', hit ? -0.3 : ln * 0.6);
      rz(F, 'tail1', ln * 0.5); rz(F, 'tail2', ln * 0.3);
      for (const k of ['F', 'B']) {
        const footRot = ik(F, 'th' + k, 'kn' + k, 'an' + k, A[0] + (k === 'B' ? -3 : 0), A[1], 1, -ln * 0.6, F.R.pelvis);
        rz(F, 'an' + k, t < s && pre < 0.3 ? -footRot - (-ln * 0.6) : 0);
        rz(F, 'sh' + k, 0.5 + Math.sin(t * 0.3) * 0.1); rz(F, 'el' + k, 0.4);
      }
    },
    ram(F, fm) {
      const { t, s, end } = fm;
      const pre = clamp(t / s, 0, 1), run = t >= s && t < end, rec = clamp((t - end) / 8, 0, 1);
      const ph = t * 0.6, gal = run ? Math.sin(ph) : 0;
      const tl = t < s ? -0.28 * easeOut(pre) : run ? 0.16 : 0.16 * (1 - rec);
      F.body.position.y = run ? Math.abs(Math.sin(ph)) * 5 : 0; F.body.scale.setScalar(popScale(t) * 1.1);
      rz(F, 'body', -tl);
      rz(F, 'neck', -(run ? 0.3 : t < s ? -0.25 * pre : 0.1));
      rz(F, 'head', -(run ? 0.2 : 0));
      rz(F, 'tail', Math.sin(t * 0.9) * 0.4);
      for (const [n1, n2, n3, sg] of [['flF', 'fkF', 'fhF', 1], ['flB', 'fkB', 'fhB', -1], ['blF', 'bkF', 'bhF', -1], ['blB', 'bkB', 'bhB', 1]]) {
        const p = gal * sg; rz(F, n1, p * 0.5 + tl); rz(F, n2, -Math.max(0, p) * 0.6); rz(F, n3, -(p * 0.5 + tl) + Math.max(0, p) * 0.6);
      }
    },
    elephant(F, fm) {
      const { t, s } = fm;
      const rr = t < s - 3 ? easeOut(clamp(t / (s - 3), 0, 1)) : t < s ? 1 - (t - (s - 3)) / 3 : 0;
      const sq = t >= s && t < s + 6 ? 1 - (t - s) / 6 : 0;
      const ps = popScale(t) * 1.1;
      F.body.scale.set(ps * (1 + 0.1 * sq), ps * (1 - 0.12 * sq), ps);
      // empina girando em volta das patas de trás
      F.holder.position.set(-42, 0, 0); F.mesh.position.set(42, 0, 0); F.holder.rotation.z = 0.55 * rr;
      rz(F, 'head', 0.25 * rr);
      const DN = [0.12, 0.1, 0.06, 0.04], UP = [-2.2, -0.45, -0.5, -0.55];
      ['t1', 't2', 't3', 't4'].forEach((n, i) => rz(F, n, TT.lerp(DN[i], UP[i], rr) + Math.sin(t * 0.2 + i) * 0.05));
      for (const [k, sg] of [['F', 1], ['B', -1]]) F.B['ear' + k].rotation.y = sg * (0.12 + rr * 0.4 + Math.sin(t * 0.3) * 0.1);
      for (const k of ['F', 'B']) { rz(F, 'fl' + k, -0.55 * rr * 0.6); rz(F, 'fk' + k, 0.7 * rr); rz(F, 'bl' + k, -0.55 * rr); rz(F, 'bh' + k, 0.55 * rr); }
      rz(F, 'tail', Math.sin(t * 0.6) * 0.35);
    },
    beast(F, fm) {
      const { t, s, end } = fm;
      const act = t >= s && t < end, k8 = act ? (t - s) % 8 : 0, ph = k8 / 8, side = act ? Math.floor((t - s) / 8) % 2 : 0;
      const crouch = t < s ? easeOut(clamp(t / s, 0, 1)) : 0;
      const bob = act ? Math.abs(Math.sin((t - s) * 0.4)) * 7 : -crouch * 8;
      F.body.position.y = bob; F.body.scale.setScalar(popScale(t) * 1.12);
      const swing = (on) => (on ? TT.lerp(-2.5, 1.4, easeOut(Math.min(1, ph * 1.6))) : TT.lerp(1.4, -1.2, ph));
      const aF = act ? swing(side === 0) : TT.lerp(1.0, -1.8, crouch), aB = act ? swing(side === 1) : TT.lerp(0.8, -2.0, crouch);
      const lean = act ? -0.15 : 0.1 * crouch;
      rz(F, 'chest', lean);
      for (const [k, a] of [['F', aF], ['B', aB]]) {
        const S0 = F.R['sh' + k], E0 = F.R['el' + k], H0 = F.R['ha' + k];
        const R1 = ang(E0[0] - S0[0], E0[1] - S0[1]), R2 = ang(H0[0] - E0[0], H0[1] - E0[1]);
        rz(F, 'sh' + k, a - R1 - lean); rz(F, 'el' + k, (a - 0.6) - R2 - (a - R1));
      }
      rz(F, 'head', -(act ? 0.12 : -0.1 * crouch) - lean);
      rz(F, 'jaw', act ? -0.35 - Math.abs(Math.sin(t * 0.5)) * 0.2 : -0.1);
      for (const [k, sg] of [['F', 1], ['B', -1]]) { const p = act ? Math.sin((t - s) * 0.4) * sg : 0; rz(F, 'th' + k, p * 0.4 + crouch * 0.3); rz(F, 'kn' + k, -crouch * 0.4); }
      if (F.trail) F.trail.material.opacity = act && ph < 0.6 ? 0.9 * (1 - ph / 0.6) : 0;
    },
    cheetah(F, fm) {
      const t = fm.t, ph = t * 0.75, sn = Math.sin(ph), stretch = 1 + sn * 0.1, ps = popScale(t) * 1.05;
      F.body.position.y = Math.abs(Math.cos(ph)) * 5;
      F.body.scale.set(ps * stretch, ps / Math.sqrt(stretch), ps);
      rz(F, 'chest', sn * 0.12); rz(F, 'hips', -sn * 0.08);
      rz(F, 'head', -sn * 0.1);
      for (const [k, o] of [['F', 0.6], ['B', 2.2]]) { const a = ph + o; rz(F, 'f1' + k, Math.sin(a) * 0.7); rz(F, 'f2' + k, -Math.max(0, -Math.cos(a)) * 0.9); rz(F, 'f3' + k, -Math.sin(a) * 0.4); }
      for (const [k, o] of [['F', 3.4], ['B', 5.0]]) { const a = ph + o; rz(F, 'b1' + k, Math.sin(a) * 0.7); rz(F, 'b2' + k, Math.max(0, Math.cos(a)) * 0.6); rz(F, 'b3' + k, -Math.sin(a) * 0.4); }
      F.B.tail1.rotation.set(0, Math.sin(t * 0.3) * 0.2, -0.2 + sn * 0.2); F.B.tail2.rotation.set(0, 0, 0.45 + sn * 0.3);
    },
    soulraven(F, fm) {
      const t = fm.t, k = clamp(t / 5, 0, 1);
      F.body.scale.setScalar(1.2 * (0.6 + 0.4 * k));
      F.body.position.y = Math.sin(t * 0.35) * 4;
      for (const [n, sg] of [['wingF', 1], ['wingB', -1]]) F.B[n].rotation.x = -sg * Math.sin(t * 0.7) * 0.7;
      rz(F, 'tail', Math.sin(t * 0.5) * 0.15);
    },
    rabbit(F, fm, d) {
      const t = fm.t, moving = d && (d.state === 'walk' || d.state === 'run');
      F.body.position.y = moving ? Math.abs(Math.sin(t * 0.25)) * 10 : 0;
      F.body.scale.setScalar(1);
      const back = d && d.state !== 'idle' && d.state !== 'air';
      for (const [k, sg] of [['F', 1], ['B', -1]]) { F.B['ear' + k].rotation.z = (back ? 0.6 : 0) + Math.sin(t * 0.12 + sg) * 0.08; F.B['ear' + k].rotation.x = -sg * 0.15; }
      rz(F, 'head', moving ? Math.sin(t * 0.25) * 0.08 : 0);
    },
  };
  ANIM.cheetahAtk = ANIM.cheetah;

  // ------------------------------------------------------------ Corpo esculpido dos Titãs (roupa com detalhe)
  // Mesmas medidas do boneco antigo (estilo 2D), na pose de repouso do esqueleto de world3d.js (braços e
  // pernas retos para baixo). Tronco, cada braço e cada perna são esculpidos à parte (não se fundem entre si)
  // e juntados numa malha só, presa aos grupos do esqueleto (quadril, tronco, braço, antebraço, mão...).
  // O tronco usa a pintura do uniforme (TORSO3D em world3d.js) por coordenadas de textura cilíndricas.
  const FEM = { raven: 1, redraven: 1, whiteraven: 1, starfire: 1 };
  function humanDef(kind, st) {
    const th = st.torsoH, shW = st.shW, wW = st.waistW || st.hipW * 0.9, hipW = st.hipW;
    const L1 = st.legL[0], L2 = st.legL[1], A1 = st.armL[0], A2 = st.armL[1];
    const hipH = L1 + L2 - 4, neck = st.neck || 3, zf = 0.64, fem = FEM[kind];
    const B = new Sculpt(1);
    B.bone('hip', 'root', [0, hipH, 0]).bone('torso', 'hip', [0, hipH, 0]);
    const ARM = { F: [shW * 0.12, hipH + th - 6, shW * 0.47], B: [-shW * 0.16, hipH + th - 5, -shW * 0.47] };
    const LEG = { F: [3, hipH, hipW * 0.33], B: [-3, hipH, -hipW * 0.33] };
    for (const k of ['F', 'B']) {
      const a = ARM[k], l = LEG[k];
      B.bone('a' + k + 'u', 'torso', a).bone('a' + k + 'l', 'a' + k + 'u', [a[0], a[1] - A1, a[2]]).bone('a' + k + 'e', 'a' + k + 'l', [a[0], a[1] - A1 - A2, a[2]]);
      B.bone('l' + k + 'u', 'hip', l).bone('l' + k + 'l', 'l' + k + 'u', [l[0], l[1] - L1, l[2]]).bone('l' + k + 'e', 'l' + k + 'l', [l[0], l[1] - L1 - L2, l[2]]);
    }
    const group = (h) => { const S = new Sculpt(h); S.bones = B.bones; S.bi = B.bi; return S; };
    const skin = st.skin || '#f4c39e';
    // ---- tronco (pintado pela textura do uniforme)
    const TS = group(clamp(shW * 0.043, 1.15, 2.1));
    TS.uvf = (x, y, z) => [((Math.atan2(x, z / zf) / (Math.PI * 2)) + 1) % 1, 0.2 + 0.8 * clamp((y - hipH) / th, 0, 1)];
    TS.ell([0, hipH + 1, 0], [hipW * (fem ? 0.6 : 0.56), hipW * 0.42, hipW * 0.56 * 0.76], { bone: 'hip', col: st.leg, k: 3, cs: 0.6 });
    TS.ell([wW * 0.04, hipH + th * 0.3, 0], [wW * 0.52, th * 0.34, wW * 0.52 * 0.82], { bone: 'hip', tex: true, k: 6, soft: 7 });
    TS.ell([shW * 0.03, hipH + th * 0.66, 0], [shW * 0.46, th * 0.38, shW * 0.46 * zf], { bone: 'torso', tex: true, k: 7 });
    TS.ell([0, hipH + th * 0.9, 0], [shW * 0.48, th * 0.15, shW * 0.3], { bone: 'torso', tex: true, k: 5 });
    if (fem) for (const zz of [-1, 1]) TS.ell([shW * 0.2, hipH + th * 0.66, zz * shW * 0.17], [shW * 0.14, shW * 0.15, shW * 0.15], { bone: 'torso', tex: true, k: 4 });
    else for (const zz of [-1, 1]) TS.ell([shW * 0.17, hipH + th * 0.72, zz * shW * 0.19], [shW * 0.17, th * 0.16, shW * 0.19], { bone: 'torso', tex: true, k: 5 });
    TS.cone([0, hipH + th * 0.9, 0], [0, hipH + th + neck + 6, 0], st.headR * 0.37, st.headR * 0.33, { bone: 'torso', col: st.neckCol || skin, k: 3 });
    // ---- braços (manga, luva com punho, braçadeiras, mão com dedos)
    const groups = [TS];
    const ao = st.armOpt || {}, lo = st.legOpt || {};
    for (const k of ['F', 'B']) {
      const s = k === 'F' ? 1 : -1, a = ARM[k], AS = group(clamp(st.armW * 0.112, 0.78, 1.6)), w = st.armW, hR = st.handR;
      const split = ao.split != null ? ao.split : 2, top = a[1];
      const r0 = w * 0.54, r1 = w * 0.46;
      const tAt = (y) => { const d = top - y; return d < A1 ? d / A1 : 1 + (d - A1) / A2; };
      const paint = (x, y, z) => {
        const t = tAt(y);
        let c = t >= split ? st.glove : st.arm;
        if (ao.sleeve && t < ao.sleeve.len) c = ao.sleeve.col;
        if (ao.stripe && t < split && (z - a[2]) * s > w * 0.18 && t > 0.15) c = ao.stripe;
        for (const b of ao.band || []) if (t >= b.at && t <= b.at + b.len) c = b.col;
        return rgb(c);
      };
      const el = [a[0], top - A1, a[2]], wr = [a[0], top - A1 - A2, a[2]];
      AS.ell([a[0], top - 0.5, a[2]], [w * 0.62, w * 0.68, w * 0.62], { bone: 'a' + k + 'u', paint, k: 3 });
      AS.cone(a, el, r0, r0 * 0.88, { bone: 'a' + k + 'u', paint, k: 3, soft: 2.2 });
      AS.ell([a[0] + w * 0.12, top - A1 * 0.42, a[2]], [w * 0.36, A1 * 0.3, w * 0.4], { bone: 'a' + k + 'u', paint, k: 3, soft: 2.2 });
      AS.cone(el, [wr[0], wr[1] + 1.2, wr[2]], r1, r1 * 0.82, { bone: 'a' + k + 'l', paint, k: 3, soft: 2.2 });
      AS.ell([el[0] - w * 0.05, el[1] - A2 * 0.3, el[2]], [w * 0.42, A2 * 0.28, w * 0.42], { bone: 'a' + k + 'l', paint, k: 3, soft: 2.2 });
      if (ao.sleeve) AS.torus([a[0], top - ao.sleeve.len * A1, a[2]], r0 * 1.02, 0.75, 1, { bone: 'a' + k + 'u', col: ao.sleeve.col, k: 1.2 });
      if (split < 2 && split > 0.2) { const y = split < 1 ? top - split * A1 : top - A1 - (split - 1) * A2, rr = (split < 1 ? r0 : r1 * 0.9) + 0.5; AS.torus([a[0], y, a[2]], rr, 0.95, 1, { bone: split < 1 ? 'a' + k + 'u' : 'a' + k + 'l', col: st.glove, k: 1.2 }); }
      for (const b of ao.band || []) { const tt = b.at + b.len / 2, y = tt < 1 ? top - tt * A1 : top - A1 - (tt - 1) * A2; AS.torus([a[0], y, a[2]], (tt < 1 ? r0 : r1 * 0.9) + 0.35, Math.max(0.8, b.len * (tt < 1 ? A1 : A2) * 0.45), 1, { bone: tt < 1 ? 'a' + k + 'u' : 'a' + k + 'l', col: b.col, k: 1 }); }
      // mão: palma e dedos meio fechados (punho pronto para a briga)
      const hc = st.hand || st.glove, py = wr[1] - hR * 0.5;
      AS.ell([wr[0], py, wr[2]], [hR * 0.78, hR * 0.8, hR * 0.5], { bone: 'a' + k + 'e', col: hc, k: 1.5, soft: 1.5 });
      for (let i = 0; i < 4; i++) {
        const fx = wr[0] + (-0.5 + i * 0.33) * hR * 1.15, len = hR * (i === 0 || i === 3 ? 0.62 : 0.72);
        AS.cone([fx, py - hR * 0.55, wr[2]], [fx + hR * 0.05, py - hR * 0.55 - len, wr[2] - s * hR * 0.42], hR * 0.2, hR * 0.17, { bone: 'a' + k + 'e', col: hc, k: 0.6, soft: 1 });
      }
      AS.cone([wr[0] + hR * 0.5, py + hR * 0.2, wr[2] - s * hR * 0.2], [wr[0] + hR * 0.85, py - hR * 0.6, wr[2] - s * hR * 0.5], hR * 0.22, hR * 0.18, { bone: 'a' + k + 'e', col: hc, k: 0.8, soft: 1 });
      if (kind === 'cyborg') { // juntas mecânicas e placas
        AS.ell([a[0], top - 1, a[2]], [w * 0.72, w * 0.6, w * 0.72], { bone: 'a' + k + 'u', col: '#d3d9e2', k: 2 });
        AS.ell([a[0] + w * 0.1, top - 2, a[2] + s * w * 0.42], [w * 0.42, w * 0.42, w * 0.2], { bone: 'a' + k + 'u', col: '#3b78d8', k: 1 });
        AS.torus([a[0], el[1] - A2 * 0.45, a[2]], r1 * 0.95, 0.5, 1, { sub: true, col: '#3a3d47', k: 0.6 });
      }
      groups.push(AS);
    }
    // ---- pernas (joelho, panturrilha, bota com cano, bico e sola)
    for (const k of ['F', 'B']) {
      const s = k === 'F' ? 1 : -1, l = LEG[k], LS = group(clamp(st.legW * 0.11, 0.98, 1.7)), w = st.legW, fR = st.footR;
      const split = lo.split != null ? lo.split : 2, top = l[1];
      const tAt = (y) => { const d = top - y; return d < L1 ? d / L1 : 1 + (d - L1) / L2; };
      const paint = (x, y, z) => {
        const t = tAt(y);
        let c = t >= split ? st.boot : st.leg;
        if (lo.stripe && t < split && (z - l[2]) * s > w * 0.2 && t > 0.05) c = lo.stripe;
        for (const b of lo.band || []) if (t >= b.at && t <= b.at + b.len) c = b.col;
        return rgb(c);
      };
      const kn = [l[0], top - L1, l[2]], an = [l[0], top - L1 - L2, l[2]];
      LS.cone([l[0], top + 2, l[2]], kn, w * 0.6, w * 0.47, { bone: 'l' + k + 'u', paint, k: 3, soft: 2.4 });
      LS.ell([l[0] + w * 0.08, top - L1 * 0.35, l[2]], [w * 0.5, L1 * 0.32, w * 0.5], { bone: 'l' + k + 'u', paint, k: 3, soft: 2.4 });
      LS.ell([kn[0] + w * 0.26, kn[1], kn[2]], [w * 0.28, w * 0.34, w * 0.34], { bone: 'l' + k + 'l', paint, k: 2, soft: 2 });
      LS.cone(kn, an, w * 0.48, w * 0.36, { bone: 'l' + k + 'l', paint, k: 3, soft: 2.4 });
      LS.ell([kn[0] - w * 0.14, kn[1] - L2 * 0.3, kn[2]], [w * 0.4, L2 * 0.27, w * 0.4], { bone: 'l' + k + 'l', paint, k: 3, soft: 2.4 });
      if (split < 2 && split > 0.2) { const y = split < 1 ? top - split * L1 : top - L1 - (split - 1) * L2, rr = (split < 1 ? w * 0.52 : w * 0.44) + 0.6; LS.torus([l[0], y, l[2]], rr, 1.1, 1, { bone: split < 1 ? 'l' + k + 'u' : 'l' + k + 'l', col: st.boot, k: 1.2 }); }
      for (const b of lo.band || []) { const tt = b.at + b.len / 2, y = tt < 1 ? top - tt * L1 : top - L1 - (tt - 1) * L2; LS.torus([l[0], y, l[2]], (tt < 1 ? w * 0.52 : w * 0.42) + 0.35, Math.max(0.8, b.len * L1 * 0.45), 1, { bone: tt < 1 ? 'l' + k + 'u' : 'l' + k + 'l', col: b.col, k: 1 }); }
      const bc = st.boot, sole = lo.sole || '#2a2630';
      LS.ell([an[0] + fR * 0.5, an[1] - fR * 0.12, an[2]], [fR * 1.35, fR * 0.62, fR * 0.8], { bone: 'l' + k + 'e', col: bc, k: 2.2, soft: 1.5 });
      LS.ell([an[0] + fR * 1.25, an[1] - fR * 0.25, an[2]], [fR * 0.72, fR * 0.5, fR * 0.82], { bone: 'l' + k + 'e', col: bc, k: 2, soft: 1.5 });
      LS.ell([an[0] - fR * 0.45, an[1] - fR * 0.3, an[2]], [fR * 0.55, fR * 0.45, fR * 0.7], { bone: 'l' + k + 'e', col: bc, k: 2, soft: 1.5 });
      LS.ell([an[0] + fR * 0.45, an[1] - fR * 0.72, an[2]], [fR * 1.72, fR * 0.2, fR * 0.92], { bone: 'l' + k + 'e', col: sole, k: 0.8, cs: 0.4, soft: 1.5 });
      if (kind === 'cyborg') {
        LS.ell([kn[0] + w * 0.3, kn[1], kn[2]], [w * 0.3, w * 0.4, w * 0.42], { bone: 'l' + k + 'l', col: '#3a3d47', k: 1.5 });
        LS.ell([l[0] + w * 0.36, top - L1 * 0.45, l[2]], [w * 0.2, L1 * 0.2, w * 0.36], { bone: 'l' + k + 'u', col: '#3b78d8', k: 1.2 });
      }
      groups.push(LS);
    }
    // ---- detalhes de cada Titã
    if (kind === 'robin' || kind === 'apprentice') { // cinto de utilidades com bolsinhos
      const by = hipH + th * 0.15, R0 = wW * 0.53;
      TS.ell([0, by, 0], [R0 + 0.7, 1.7, R0 * 0.84 + 0.7], { bone: 'hip', tex: true, k: 1 });
      if (kind === 'robin') for (const a of [-1.2, -0.62, 0.62, 1.2, 2.2, -2.2]) TS.ell([Math.cos(a) * R0 * 1.06, by - 0.6, Math.sin(a) * R0 * 0.86], [2.3, 3.2, 2.3], { bone: 'hip', col: '#e0b018', k: 0.8, cs: 0.5 });
      TS.ell([R0 * 1.0, by, 0], [1.4, 3, 3.6], { bone: 'hip', col: '#ffe060', k: 0.8 });
    }
    if (kind === 'cyborg') { // placa do peito em relevo e abdômen segmentado
      TS.ell([shW * 0.3, hipH + th * 0.68, 0], [shW * 0.12, th * 0.22, shW * 0.3], { bone: 'torso', tex: true, k: 2 });
    }
    return { groups, bones: B.bones, hipH };
  }
  // geometria do corpo de um estilo (gerada aos poucos como as formas)
  function bodyKey(kind, st) { return 'body:' + kind + ':' + [st.torso, st.arm, st.glove, st.hand, st.leg, st.boot, st.skin, st.neckCol, st.torsoH, st.shW, st.armW, st.legW].join(','); }
  function bodyEntry(kind, st) {
    const key = bodyKey(kind, st);
    let d = CACHE.get(key);
    if (!d) { const def = humanDef(kind, st); d = { gen: meshGroups(def.groups), geo: null, bones: def.bones, hipH: def.hipH, ms: 0 }; CACHE.set(key, d); }
    return d;
  }
  // Monta o corpo esculpido no boneco M (world3d.js), preso aos grupos do esqueleto dele.
  // paint(g, st) = pintura do uniforme no tronco (256x128), ou null.
  function humanBody(W, M, kind, st, paint) {
    T = T || window.THREE;
    const d = bodyEntry(kind, st); step(d, 1e9);
    const map = { root: M.hip, hip: M.hip, torso: M.torso, aFu: M.armF.up, aFl: M.armF.lo, aFe: M.armF.end, aBu: M.armB.up, aBl: M.armB.lo, aBe: M.armB.end, lFu: M.legF.up, lFl: M.legF.lo, lFe: M.legF.end, lBu: M.legB.up, lBl: M.legB.lo, lBe: M.legB.end };
    const bones = d.bones.map((b) => map[b.name]);
    // pose de repouso (como foi esculpido) para amarrar a malha aos ossos
    const saved = [];
    M.root.traverse((o) => { if (o.isGroup) saved.push([o, o.rotation.clone()]); });
    for (const [o] of saved) o.rotation.set(0, 0, 0);
    const hy = M.hip.position.y, sy = M.sp.position.y, siy = M.spi.position.y;
    M.hip.position.y = d.hipH; M.sp.position.y = 0; M.spi.position.y = 0;
    const rp = M.root.position.clone(), rr = M.root.rotation.clone(), rs = M.root.scale.clone();
    M.root.position.set(0, 0, 0); M.root.rotation.set(0, 0, 0); M.root.scale.set(1, 1, 1);
    M.root.updateMatrixWorld(true);
    const tex = bodyTex(kind, st, paint);
    const mat = rimify(new T.MeshToonMaterial({ map: tex, vertexColors: true, gradientMap: grad4() }), '#ffffff', 3, 0.28);
    const mesh = new T.SkinnedMesh(d.geo, mat);
    M.root.add(mesh); mesh.updateMatrixWorld(true);
    const sk = new T.Skeleton(bones);
    mesh.bind(sk);
    const ol = new T.SkinnedMesh(d.geo, skinOutline('#140a22', 0.85));
    mesh.add(ol); ol.bind(sk, mesh.bindMatrix);
    mesh.castShadow = true; mesh.frustumCulled = false; ol.frustumCulled = false;
    mesh.userData.mat = mat; M.meshes.push(mesh);
    // joias das braçadeiras (Estelar)
    for (const k of ['F', 'B']) for (const b of (st.armOpt || {}).band || []) if (b.gem) {
      const tt = b.at + b.len / 2, A = M['arm' + k], grp = tt < 1 ? A.up : A.lo, y = tt < 1 ? -tt * st.armL[0] : -(tt - 1) * st.armL[1];
      const gm = new T.Mesh(W.sph(1.7, 10, 8), W.neon(b.gem)); gm.position.set((tt < 1 ? st.armW * 0.54 : st.armW * 0.42) + 1.4, y, 0); grp.add(gm);
    }
    for (const [o, r] of saved) o.rotation.copy(r);
    M.hip.position.y = hy; M.sp.position.y = sy; M.spi.position.y = siy;
    M.root.position.copy(rp); M.root.rotation.copy(rr); M.root.scale.copy(rs);
    return mesh;
  }
  function bodyTex(kind, st, paint) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 160);
    if (paint) paint(g, st); else { g.fillStyle = st.torso; g.fillRect(0, 0, 256, 128); }
    // costura suave dos lados e sombra embaixo do peito (volume na pintura)
    const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#ffffff'; g.fillRect(0, 128, 256, 32);
    const tx = new T.CanvasTexture(c); tx.anisotropy = 4;
    return tx;
  }

  TT.Beasts3D = {
    names: Object.keys(DEF),
    // gera a geometria (pesado: ~0,1-0,4 s por forma) sem montar nada; usado para pré-carregar
    prepare(THREE, name) { T = THREE; return data(name); },
    // pré-carrega em pedaços de ~4 ms a cada dois quadros do jogo
    prewarm(THREE, names) { T = THREE; for (const n of names) { const k = n === 'cheetahAtk' ? 'cheetah' : n; if (DEF[k] && !QUEUE.includes(k)) { entry(k); if (!CACHE.get(k).geo) QUEUE.push(k); } } kick(); },
    prewarmBody(THREE, kind, st) { T = THREE; const k = bodyKey(kind, st); if (!QUEUE.includes(k)) { bodyEntry(kind, st); if (!CACHE.get(k).geo) QUEUE.push(k); } kick(); },
    humanBody,
    has(name) { return !!DEF[name]; },
    make(W, name, F, M, f) {
      T = window.THREE;
      assemble(W, name, F, M, f);
      if (name === 'beast') { F.trail = W.glowSprite('#d6ffc0', 90, 0); F.B.haF.add(F.trail); }
      F.upd = (fm, d) => ANIM[name](F, fm, d);
      return F;
    },
    stats() { const o = {}; for (const [k, d] of CACHE) o[k] = { ms: Math.round(d.ms), tris: d.tris, done: !!d.geo }; return o; },
  };
})();
