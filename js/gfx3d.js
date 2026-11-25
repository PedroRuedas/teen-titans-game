'use strict';
// Pós-processamento da Fase 13 (modo 3D): a cena é desenhada num alvo com antisserrilhado (MSAA) e
// profundidade, e um passe final junta tudo:
//   - oclusão de contato nas dobras e cantos (prédio x calçada, pé x chão, ombro x pescoço), só pela
//     profundidade: mede se o ponto está "no fundo de um vinco" em relação aos vizinhos dos dois lados
//     (em 1/z, que é linear na tela para superfícies planas: chão e paredes lisas não escurecem);
//   - contorno de tinta pela profundidade (silhuetas e quinas do cenário, como o traço do desenho);
//   - brilho (bloom) das luzes: janelas acesas, neon, postes, poderes;
//   - nitidez, gradação de cor (contraste, saturação, sombras frias e luzes quentes) e vinheta.
// Mais: sombras do sol nítidas (mapa maior e enquadrado na câmera), filtro anisotrópico máximo nas texturas
// (asfalto e calçada nítidos de longe) e resolução dinâmica (cai um pouco se a placa de vídeo não aguentar).
(function () {
  const TT = window.TT;
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const BRIGHT = `uniform sampler2D tColor; uniform vec2 px; uniform float thr; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tColor, vUv + px * vec2(-1.0, -1.0)).rgb + texture2D(tColor, vUv + px * vec2(1.0, -1.0)).rgb
             + texture2D(tColor, vUv + px * vec2(-1.0, 1.0)).rgb + texture2D(tColor, vUv + px * vec2(1.0, 1.0)).rgb;
      c *= 0.25;
      float l = max(c.r, max(c.g, c.b));
      float k = smoothstep(thr, thr + 0.05, l);
      gl_FragColor = vec4(c * k, 1.0);
    }`;
  const BLUR = `uniform sampler2D tSrc; uniform vec2 dir; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
      c += (texture2D(tSrc, vUv + dir * 1.384).rgb + texture2D(tSrc, vUv - dir * 1.384).rgb) * 0.316;
      c += (texture2D(tSrc, vUv + dir * 3.230).rgb + texture2D(tSrc, vUv - dir * 3.230).rgb) * 0.070;
      gl_FragColor = vec4(c, 1.0);
    }`;
  const FINAL = `uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tBloom;
    uniform vec2 px; uniform float near; uniform float far; uniform float proj;
    uniform float ao; uniform float edge; uniform float bloom; uniform float sharp; uniform float vig; uniform float sat; uniform float con;
    varying vec2 vUv;
    float lz(vec2 uv){ float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = texture2D(tColor, vUv).rgb;
      float d0 = texture2D(tDepth, vUv).x;
      bool sky = d0 > 0.99995;
      float z0 = lz(vUv);
      if (sharp > 0.0) {
        vec3 n = texture2D(tColor, vUv + vec2(px.x, 0.0)).rgb + texture2D(tColor, vUv - vec2(px.x, 0.0)).rgb
               + texture2D(tColor, vUv + vec2(0.0, px.y)).rgb + texture2D(tColor, vUv - vec2(0.0, px.y)).rgb;
        c = max(c + (c * 4.0 - n) * sharp, 0.0);
      }
      if (!sky) {
        float w0 = 1.0 / z0;
        // contorno: segunda derivada de 1/z (zero em superfícies planas, alta em silhuetas e quinas)
        if (edge > 0.0) {
          float wl = 1.0 / lz(vUv - vec2(px.x, 0.0)), wr = 1.0 / lz(vUv + vec2(px.x, 0.0));
          float wd = 1.0 / lz(vUv - vec2(0.0, px.y)), wu = 1.0 / lz(vUv + vec2(0.0, px.y));
          float e = (abs(wl + wr - 2.0 * w0) + abs(wu + wd - 2.0 * w0)) / w0;
          // só no lado de perto (o traço fica no objeto da frente)
          float nearer = step(w0, max(max(wl, wr), max(wu, wd)) + 1e-9);
          float ln = smoothstep(0.012, 0.05, e) * (1.0 - smoothstep(2400.0, 7000.0, z0));
          c = mix(c, vec3(0.075, 0.04, 0.12), ln * edge * mix(0.55, 1.0, nearer));
        }
        // oclusão de contato: pares opostos de amostras; ponto no fundo de um vinco fica mais escuro
        if (ao > 0.0) {
          float rad = clamp(proj * 26.0 / z0, 3.0, 46.0), occ = 0.0, a0 = hash(vUv * 731.0) * 6.2831;
          for (int i = 0; i < 6; i++) {
            float a = a0 + float(i) * 0.5236, r = rad * (0.35 + 0.65 * float(i + 1) / 6.0);
            vec2 o = vec2(cos(a), sin(a)) * r * px;
            float z1 = lz(vUv + o), z2 = lz(vUv - o);
            float cv = ((1.0 / z1 + 1.0 / z2) * 0.5 - w0) * z0 * z0; // > 0: o ponto está mais fundo que os vizinhos
            float rng = 1.0 - smoothstep(40.0, 120.0, max(abs(z1 - z0), abs(z2 - z0)));
            occ += smoothstep(0.6, 7.0, cv) * rng;
          }
          c *= 1.0 - ao * clamp(occ / 6.0, 0.0, 1.0);
        }
      }
      c += texture2D(tBloom, vUv).rgb * bloom;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, sat);
      c = (c - 0.5) * con + 0.5;
      c += mix(vec3(-0.012, -0.004, 0.03), vec3(0.018, 0.008, -0.014), smoothstep(0.15, 0.85, l));
      vec2 q = vUv - 0.5;
      c *= 1.0 - dot(q, q) * vig;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`;

  class Gfx3D {
    constructor(w) {
      const T = window.THREE, r = w.renderer;
      this.w = w; this.T = T; this.r = r;
      this.gl2 = !!r.capabilities.isWebGL2;
      this.mobile = !!w.mobile;
      this.res = 1; this.acc = 0; this.n = 0; this.tick = 0;
      this.maxAniso = Math.min(16, r.capabilities.getMaxAnisotropy() || 1);
      const samples = this.gl2 && !this.mobile ? 4 : 0;
      this.rt = new T.WebGLRenderTarget(4, 4, { samples });
      this.rt.depthTexture = new T.DepthTexture(4, 4);
      this.rt.depthTexture.type = T.UnsignedIntType;
      const lin = { minFilter: T.LinearFilter, magFilter: T.LinearFilter };
      this.bA = new T.WebGLRenderTarget(4, 4, lin); this.bB = new T.WebGLRenderTarget(4, 4, lin);
      const quad = (fs, uni) => { const m = new T.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: uni, depthTest: false, depthWrite: false }); const s = new T.Scene(); s.add(new T.Mesh(new T.PlaneGeometry(2, 2), m)); return { s, m }; };
      this.cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      this.bright = quad(BRIGHT, { tColor: { value: null }, px: { value: new T.Vector2() }, thr: { value: 0.975 } });
      this.blur = quad(BLUR, { tSrc: { value: null }, dir: { value: new T.Vector2() } });
      this.final = quad(FINAL, {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, tBloom: { value: this.bA.texture },
        px: { value: new T.Vector2() }, near: { value: 5 }, far: { value: 60000 }, proj: { value: 1 },
        ao: { value: this.mobile ? 0 : 0.55 }, edge: { value: 0.85 }, bloom: { value: 0.45 }, sharp: { value: this.mobile ? 0.12 : 0.22 },
        vig: { value: 0.55 }, sat: { value: 1.12 }, con: { value: 1.05 },
      });
      // sol: sombra nítida e enquadrada na câmera
      const sun = w.sun;
      sun.shadow.mapSize.set(this.mobile ? 1024 : 4096, this.mobile ? 1024 : 4096);
      sun.shadow.normalBias = 0.9; sun.shadow.bias = -0.00025;
      // luz de recorte fria vindo de trás (separa os personagens do fundo)
      const rim = new T.DirectionalLight(0x8fb4ff, 0.38); rim.position.set(600, 500, -1600); w.scene.add(rim); w.scene.add(rim.target);
      this.rim = rim;
    }
    // tamanho do alvo de desenho (o World3D já calcula a resolução da tela)
    setSize(wd, ht) {
      if (this.rt.width === wd && this.rt.height === ht) return;
      this.rt.setSize(wd, ht);
      const bw = Math.max(1, wd >> 2), bh = Math.max(1, ht >> 2);
      this.bA.setSize(bw, bh); this.bB.setSize(bw, bh);
      this.final.m.uniforms.px.value.set(1 / wd, 1 / ht);
      this.bright.m.uniforms.px.value.set(1 / wd, 1 / ht);
    }
    // a cada ~2 s: filtro anisotrópico em toda textura nova (chão e paredes nítidos de longe)
    aniso() {
      const k = this.maxAniso;
      this.w.scene.traverse((o) => {
        const m = o.material; if (!m) return;
        for (const mm of Array.isArray(m) ? m : [m]) for (const key of ['map', 'emissiveMap']) {
          const t = mm[key];
          if (t && t.anisotropy < k) { t.anisotropy = k; if (t.minFilter !== this.T.LinearMipmapLinearFilter && t.image && t.image.width) t.minFilter = this.T.LinearMipmapLinearFilter; t.needsUpdate = true; }
        }
      });
    }
    render(scene, cam) {
      const r = this.r, U = this.final.m.uniforms;
      if (this.tick++ % 120 === 0) this.aniso();
      // sombra: enquadra o pedaço da cena que a câmera vê
      const sc = this.w.sun.shadow.camera, d = this.w.cv ? this.w.cv.dist || 1600 : 1600;
      const half = TT.clamp(d * 0.55, 520, 1100);
      if (Math.abs(sc.right - half) > 20) { sc.left = -half; sc.right = half; sc.top = half * 0.82; sc.bottom = -half * 0.82; sc.updateProjectionMatrix(); }
      this.rim.target.position.copy(this.w.sun.target.position);
      this.rim.position.set(this.w.sun.target.position.x + 600, 500, this.w.sun.target.position.z - 1600);
      // cena -> alvo com MSAA e profundidade
      r.setRenderTarget(this.rt); r.render(scene, cam);
      // brilho: luzes fortes, 1/4 da resolução, desfocadas duas vezes
      this.bright.m.uniforms.tColor.value = this.rt.texture;
      r.setRenderTarget(this.bA); r.render(this.bright.s, this.cam);
      const bu = this.blur.m.uniforms;
      for (let i = 0; i < 2; i++) {
        bu.tSrc.value = this.bA.texture; bu.dir.value.set((1 + i) / this.bA.width, 0); r.setRenderTarget(this.bB); r.render(this.blur.s, this.cam);
        bu.tSrc.value = this.bB.texture; bu.dir.value.set(0, (1 + i) / this.bA.height); r.setRenderTarget(this.bA); r.render(this.blur.s, this.cam);
      }
      // passe final na tela
      U.near.value = cam.near; U.far.value = cam.far;
      U.proj.value = this.rt.height / (2 * Math.tan(cam.fov * Math.PI / 360));
      r.setRenderTarget(null); r.render(this.final.s, this.cam);
    }
    // resolução dinâmica: tempo do quadro 3D inteiro (inclui esperar a placa de vídeo), a cada 90 quadros
    track(ms) {
      this.acc += ms; this.n++;
      if (this.n < 90) return;
      const avg = this.acc / this.n; this.acc = 0; this.n = 0;
      if (avg > 13 && this.res > 0.62) this.res = Math.max(0.62, this.res - 0.1);
      else if (avg < 6 && this.res < 1) this.res = Math.min(1, this.res + 0.05);
    }
  }
  TT.Gfx3D = Gfx3D;
})();
