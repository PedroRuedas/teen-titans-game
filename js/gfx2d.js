'use strict';
// Pós-processamento das fases 2D (o mesmo acabamento do modo 3D, js/gfx3d.js): depois que o mundo é desenhado
// no canvas (antes do placar), a imagem passa por um WebGL que aplica
//   - brilho (bloom) das luzes fortes: poderes, neon, lâmpadas, fogo;
//   - nitidez e contraste local (realça o traço e o volume das pinturas);
//   - gradação de cor: saturação, contraste, sombras frias e luzes quentes;
// e o resultado volta para o mesmo canvas (o jogo online continua transmitindo o canvas normal).
// Mais: sombra de contato macia sob personagens e caixas, e sombra no pé do cenário (chão encontrando o fundo).
// Se o aparelho não aguentar (quadros lentos), o efeito diminui sozinho e, no limite, desliga.
(function () {
  const TT = window.TT;
  const VS = 'attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  const HEAD = 'precision mediump float; varying vec2 v;';
  const DOWN = HEAD + `uniform sampler2D s; uniform vec2 px; uniform float thr;
    void main(){
      vec3 c = texture2D(s, v + px * vec2(-1.0, -1.0)).rgb + texture2D(s, v + px * vec2(1.0, -1.0)).rgb
             + texture2D(s, v + px * vec2(-1.0, 1.0)).rgb + texture2D(s, v + px * vec2(1.0, 1.0)).rgb;
      c *= 0.25;
      if (thr > 0.0) { float l = dot(c, vec3(0.299, 0.587, 0.114)); c *= smoothstep(thr, thr + 0.1, l); }
      gl_FragColor = vec4(c, 1.0);
    }`;
  const BLUR = HEAD + `uniform sampler2D s; uniform vec2 dir;
    void main(){
      vec3 c = texture2D(s, v).rgb * 0.227;
      c += (texture2D(s, v + dir * 1.384).rgb + texture2D(s, v - dir * 1.384).rgb) * 0.316;
      c += (texture2D(s, v + dir * 3.230).rgb + texture2D(s, v - dir * 3.230).rgb) * 0.070;
      gl_FragColor = vec4(c, 1.0);
    }`;
  const FINAL = HEAD + `uniform sampler2D s; uniform sampler2D bl; uniform sampler2D cl; uniform vec2 px;
    uniform float sharp; uniform float bloom; uniform float clar; uniform float sat; uniform float con;
    void main(){
      vec3 c = texture2D(s, v).rgb;
      vec3 n = texture2D(s, v + vec2(px.x, 0.0)).rgb + texture2D(s, v - vec2(px.x, 0.0)).rgb
             + texture2D(s, v + vec2(0.0, px.y)).rgb + texture2D(s, v - vec2(0.0, px.y)).rgb;
      c = max(c + (c * 4.0 - n) * sharp, 0.0);
      vec3 b = texture2D(cl, v).rgb;
      c = c + (c - b) * clar;
      c += texture2D(bl, v).rgb * bloom;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, sat);
      c = (c - 0.5) * con + 0.5;
      c += mix(vec3(-0.010, -0.004, 0.026), vec3(0.016, 0.008, -0.012), smoothstep(0.15, 0.85, l));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`;

  class Gfx2D {
    constructor() {
      this.enabled = true; this.ok = false; this.level = 2; // 2 = completo, 1 = só nitidez e cor, 0 = desligado
      this.acc = 0; this.n = 0; this.last = 0;
      this.mobile = TT.isTouchDevice ? TT.isTouchDevice() : false;
      try { this.init(); this.ok = true; } catch (e) { console.warn('[2D] pós-processamento indisponível:', e && e.message); }
    }
    init() {
      const c = this.canvas = document.createElement('canvas');
      const gl = this.gl = c.getContext('webgl', { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
      if (!gl) throw new Error('sem WebGL');
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const prog = (fs) => {
        const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
        gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
        return { p, u };
      };
      this.pDown = prog(DOWN); this.pBlur = prog(BLUR); this.pFinal = prog(FINAL);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.src = this.tex();
      this.rt = [0, 1, 2, 3].map(() => ({ t: this.tex(), f: gl.createFramebuffer(), w: 0, h: 0 }));
      c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ok = false; });
    }
    tex() {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    size(r, w, h) {
      if (r.w === w && r.h === h) return;
      const gl = this.gl; r.w = w; r.h = h;
      gl.bindTexture(gl.TEXTURE_2D, r.t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, r.f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.t, 0);
    }
    pass(P, target, tex, uni) {
      const gl = this.gl;
      gl.useProgram(P.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
      gl.viewport(0, 0, target ? target.w : this.canvas.width, target ? target.h : this.canvas.height);
      tex.forEach((t, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); });
      for (const k in uni) { const v = uni[k], loc = P.u[k]; if (loc == null) continue; if (typeof v === 'number') gl.uniform1f(loc, v); else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]); else gl.uniform1i(loc, v[0]); }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    // aplica no canvas do jogo (chamado depois do mundo e antes do placar)
    apply(game, ctx) {
      if (!this.enabled || !this.ok || this.level <= 0) return;
      const now = performance.now();
      if (this.last) { this.acc += Math.min(100, now - this.last); this.n++; }
      this.last = now;
      if (this.n >= 120) { // quadros lentos: tira primeiro o brilho, depois tudo
        const avg = this.acc / this.n; this.acc = 0; this.n = 0;
        if (avg > 24 && this.level > 0) { this.level--; console.warn('[2D] pós-processamento reduzido (quadros lentos):', this.level); }
      }
      const src = game.canvas, W = src.width, H = src.height, gl = this.gl, c = this.canvas;
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.src);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      const [A, B, C, D] = this.rt, qw = Math.max(1, W >> 2), qh = Math.max(1, H >> 2);
      const full = this.level >= 2;
      if (full) {
        for (const r of this.rt) this.size(r, qw, qh);
        // brilho: só o que é bem claro, em 1/4 da resolução, desfocado duas vezes
        this.pass(this.pDown, A, [this.src], { s: [0], px: [1 / W, 1 / H], thr: 0.9 });
        for (let i = 0; i < 2; i++) {
          this.pass(this.pBlur, B, [A.t], { s: [0], dir: [(1 + i) / qw, 0] });
          this.pass(this.pBlur, A, [B.t], { s: [0], dir: [0, (1 + i) / qh] });
        }
        // imagem desfocada (para o contraste local)
        this.pass(this.pDown, C, [this.src], { s: [0], px: [1 / W, 1 / H], thr: 0 });
        this.pass(this.pBlur, D, [C.t], { s: [0], dir: [1 / qw, 0] });
        this.pass(this.pBlur, C, [D.t], { s: [0], dir: [0, 1 / qh] });
      }
      const k = W / TT.W; // nitidez proporcional à resolução (em tela pequena, menos)
      this.pass(this.pFinal, null, full ? [this.src, A.t, C.t] : [this.src, this.src, this.src], {
        s: [0], bl: [1], cl: [2], px: [1 / W, 1 / H],
        sharp: TT.clamp(0.1 + 0.1 * k, 0.12, 0.3), bloom: full ? 0.36 : 0, clar: full ? 0.3 : 0, sat: 1.1, con: 1.05,
      });
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(c, 0, 0);
      ctx.restore();
    }
  }
  TT.Gfx2D = Gfx2D;

  // ------------------------------------------------------------ Sombras macias
  // Sombra de contato: núcleo escuro bem no ponto onde o personagem encosta no chão, sumindo para as bordas.
  let shadowSprite = null;
  function sprite() {
    if (shadowSprite) return shadowSprite;
    const c = TT.makeCanvas ? TT.makeCanvas(128, 64) : Object.assign(document.createElement('canvas'), { width: 128, height: 64 });
    const g = c.getContext('2d');
    g.save(); g.translate(64, 32); g.scale(1, 0.5);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 62);
    gr.addColorStop(0, 'rgba(12,4,22,1)'); gr.addColorStop(0.35, 'rgba(12,4,22,0.82)'); gr.addColorStop(0.7, 'rgba(12,4,22,0.35)'); gr.addColorStop(1, 'rgba(12,4,22,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 62, 0, Math.PI * 2); g.fill();
    g.restore();
    shadowSprite = c;
    return c;
  }
  // x, y = ponto no chão; rx, ry = raios da elipse antiga; a = opacidade (0..1); lift = 0 no chão, 1 bem alto
  TT.softShadow = function (ctx, x, y, rx, ry, a, lift) {
    const s = sprite(), up = lift || 0;
    const k = 1.35 + up * 0.5, w = rx * 2 * k, h = Math.max(ry * 2 * k, 6);
    ctx.save();
    ctx.globalAlpha = a * (1 - up * 0.55);
    ctx.drawImage(s, x - w / 2, y - h / 2, w, h);
    if (up < 0.05) { ctx.globalAlpha = a * 0.55; ctx.drawImage(s, x - w * 0.28, y - h * 0.22, w * 0.56, h * 0.44); } // contato
    ctx.restore();
  };
  // Sombra no pé do cenário (onde o chão encontra o fundo) e leve escurecida na frente do chão
  TT.groundDepth = function (ctx) {
    const FT = TT.FLOOR_TOP, W = TT.W, H = TT.H;
    if (!TT._gd) {
      const c = Object.assign(document.createElement('canvas'), { width: 4, height: 256 }), g = c.getContext('2d');
      let gr = g.createLinearGradient(0, 0, 0, 60);
      gr.addColorStop(0, 'rgba(10,4,20,0.34)'); gr.addColorStop(0.35, 'rgba(10,4,20,0.14)'); gr.addColorStop(1, 'rgba(10,4,20,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 4, 60);
      TT._gd = c;
      const f = Object.assign(document.createElement('canvas'), { width: 4, height: 128 }), gf = f.getContext('2d');
      gr = gf.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(10,4,20,0)'); gr.addColorStop(1, 'rgba(10,4,20,0.22)');
      gf.fillStyle = gr; gf.fillRect(0, 0, 4, 128);
      TT._gf = f;
    }
    ctx.drawImage(TT._gd, 0, 0, 4, 60, -20, FT - 6, W + 40, 60);
    ctx.drawImage(TT._gf, 0, 0, 4, 128, -20, H - 128, W + 40, 128);
  };
})();
