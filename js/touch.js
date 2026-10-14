'use strict';
// Controles de toque (celular/tablet): analógico à esquerda, botões de golpe à direita e uma fileira
// de botões pequenos no alto (avante, trocar, pausa, tela cheia). Ficam numa camada HTML por cima do
// canvas e controlam sempre o P1. Ligar/desligar e a opacidade ficam no item "BOTÕES NA TELA" do
// título e da pausa (salvo no navegador).
(function () {
  const TT = window.TT;

  // Valores do item de menu: desligado ou a opacidade dos botões.
  const LEVELS = ['off', 0.25, 0.4, 0.55, 0.7, 0.85, 1];
  const DEFAULT_OP = 0.55;

  // Botões: ação, rótulo, cor, posição (vmin a partir do canto direito/inferior) e diâmetro.
  const BUTTONS = [
    { act: 'light', label: 'ATAQUE', col: '#ffd23a', r: 4, b: 5, d: 20, ok: true },
    { act: 'jump', label: 'PULO', col: '#5ee07a', r: 26, b: 3, d: 14, ok: true },
    { act: 'heavy', label: 'FORTE', col: '#ff5a4a', r: 22.5, b: 20, d: 14 },
    { act: 'special', label: 'ESPECIAL', col: '#5fb6ff', r: 5, b: 27, d: 15 },
    { act: 'dash', label: 'ESQUIVA', col: '#b48cff', r: 42, b: 2.5, d: 12 },
  ];
  // Fileira do alto (à direita, embaixo do placar).
  const TOP = [
    { act: 'super', label: 'AVANTE!', col: '#ffe14a', w: 17 },
    { act: 'next', label: 'TROCAR', col: '#9effa8', w: 14 },
    { act: 'pause', label: 'II', col: '#ffffff', w: 9 },
    { act: 'fullscreen', icon: true, col: '#ffffff', w: 9 },
  ];

  const CSS = `
  #tt-touch { position: fixed; inset: 0; pointer-events: none; z-index: 10; user-select: none; -webkit-user-select: none;
    -webkit-touch-callout: none; font-family: ${TT.FONT}; display: none; }
  #tt-touch.on { display: block; }
  #tt-touch .tb { position: absolute; pointer-events: auto; touch-action: none; border-radius: 50%; display: flex;
    align-items: center; justify-content: center; color: #17121f; font-size: 2.7vmin; letter-spacing: 0.02em;
    border: 0.6vmin solid #17121f; box-shadow: 0 0.8vmin 0 rgba(0,0,0,0.45), inset 0 -0.9vmin 0 rgba(0,0,0,0.18);
    transition: transform 60ms, filter 60ms; }
  #tt-touch .tb.down { transform: translateY(0.6vmin) scale(0.93); filter: brightness(1.35); box-shadow: 0 0.2vmin 0 rgba(0,0,0,0.45); }
  #tt-touch .top { border-radius: 2.4vmin; height: 8.5vmin; font-size: 2.6vmin; }
  #tt-touch .top.full { animation: tt-pulse 0.6s infinite alternate; }
  #tt-touch .top.off { filter: grayscale(1) brightness(0.7); }
  @keyframes tt-pulse { from { box-shadow: 0 0 0 0 rgba(255,225,74,0.9); } to { box-shadow: 0 0 0 1.6vmin rgba(255,225,74,0); } }
  #tt-stick-zone { position: absolute; left: 0; bottom: 0; width: 45vw; height: 62vh; pointer-events: auto; touch-action: none; }
  #tt-stick { position: absolute; width: 30vmin; height: 30vmin; margin: -15vmin 0 0 -15vmin; border-radius: 50%;
    background: rgba(255,255,255,0.18); border: 0.6vmin solid rgba(255,255,255,0.75); box-shadow: inset 0 0 0 0.6vmin #17121f; }
  #tt-knob { position: absolute; left: 50%; top: 50%; width: 13vmin; height: 13vmin; margin: -6.5vmin 0 0 -6.5vmin; border-radius: 50%;
    background: #e8ecff; border: 0.6vmin solid #17121f; box-shadow: 0 0.6vmin 0 rgba(0,0,0,0.4); }
  #tt-rotate { position: fixed; inset: 0; z-index: 20; display: none; align-items: center; justify-content: center; flex-direction: column;
    background: rgba(7,4,15,0.92); color: #ffe14a; font-family: ${TT.FONT}; font-size: 6vmin; text-align: center; gap: 3vmin; }
  #tt-rotate small { color: #ffffff; font-size: 3.6vmin; }
  #tt-rotate.on { display: flex; }`;

  // Ícone de tela cheia (quatro cantos), igual em qualquer aparelho.
  const FS_ICON = '<svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="#17121f" stroke-width="3" stroke-linecap="round">'
    + '<path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/></svg>';

  function hasTouch() {
    try { return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0; } catch (e) { return false; }
  }

  class TouchControls {
    constructor(game) {
      this.game = game;
      this.input = game.input;
      this.held = new Map(); // pointerId -> ação do botão segurado
      this.stick = null;     // { id, x0, y0 } enquanto o analógico está sendo usado
      this.dirs = new Set();
      // nível salvo: 'off' ou um número; sem nada salvo, liga sozinho em aparelho de toque
      const saved = TT.store.get('botoes', null);
      this.level = saved === 'off' ? 'off' : saved != null && !isNaN(+saved) ? TT.clamp(+saved, 0.25, 1) : hasTouch() ? DEFAULT_OP : 'off';
      this.auto = saved == null;
      this.build();
      this.apply();
      // primeiro toque na tela de um aparelho sem nada salvo: liga os botões
      window.addEventListener('touchstart', () => { if (this.auto && this.level === 'off') { this.level = DEFAULT_OP; this.apply(); } }, { passive: true });
      window.addEventListener('resize', () => this.apply());
      window.addEventListener('blur', () => this.releaseAll());
    }

    get visible() { return this.level !== 'off'; }

    build() {
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      const root = this.root = document.createElement('div'); root.id = 'tt-touch';
      // analógico flutuante: aparece onde o dedo encosta dentro da zona da esquerda
      const zone = document.createElement('div'); zone.id = 'tt-stick-zone';
      const base = this.base = document.createElement('div'); base.id = 'tt-stick';
      const knob = this.knob = document.createElement('div'); knob.id = 'tt-knob';
      base.appendChild(knob); zone.appendChild(base); root.appendChild(zone);
      this.resetStick();
      zone.addEventListener('pointerdown', (e) => this.stickDown(e));
      zone.addEventListener('pointermove', (e) => this.stickMove(e));
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, (e) => this.stickUp(e));
      this.btns = {};
      for (const b of BUTTONS) {
        const el = this.button(b);
        Object.assign(el.style, { right: b.r + 'vmin', bottom: b.b + 'vmin', width: b.d + 'vmin', height: b.d + 'vmin', background: b.col });
        if (b.d >= 18) el.style.fontSize = '3.2vmin';
      }
      let x = 2;
      for (const b of TOP.slice().reverse()) {
        if (b.act === 'fullscreen' && !document.documentElement.requestFullscreen) continue;
        const el = this.button(b);
        el.classList.add('top');
        Object.assign(el.style, { right: x + 'vmin', top: '13vmin', width: b.w + 'vmin', background: b.col });
        x += b.w + 1.5;
      }
      document.body.appendChild(root);
      const rot = this.rotate = document.createElement('div'); rot.id = 'tt-rotate';
      rot.innerHTML = '↻ GIRE O CELULAR<small>O jogo funciona deitado (tela na horizontal)</small>';
      document.body.appendChild(rot);
    }

    button(b) {
      const el = document.createElement('div');
      el.className = 'tb'; el.dataset.act = b.act;
      if (b.icon) el.innerHTML = FS_ICON; else el.textContent = b.label;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro sintético */ }
        TT.audio.init();
        el.classList.add('down');
        if (b.act === 'fullscreen') { this.fullscreen(); return; }
        this.held.set(e.pointerId, b.act);
        this.press(b.act);
        // nos menus (título, pausa, fim de fase) ATAQUE e PULO também confirmam
        if (b.ok && this.game.state !== 'play') this.press('menu');
      });
      const up = (e) => { el.classList.remove('down'); if (this.held.delete(e.pointerId)) this.changed(); };
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      this.root.appendChild(el);
      this.btns[b.act] = el;
      return el;
    }

    // Aperto (vale um quadro) — o "segurado" vem de this.held na amostragem da entrada.
    press(a) { this.input.pl[0].pressed.add(a); this.input.anyKey = true; this.changed(); }
    // Jogo online (amigo): manda o botão na hora, sem esperar o próximo quadro.
    changed() { const o = this.game.online; if (o && o.guest) o.flush(); }

    // Ações seguradas agora (botões + direções do analógico), lidas por Input.sample().
    down() {
      const s = new Set(this.dirs);
      for (const a of this.held.values()) s.add(a);
      return s;
    }

    resetStick() { Object.assign(this.base.style, { left: '17vmin', top: 'calc(100% - 19vmin)' }); this.knob.style.transform = ''; }

    stickDown(e) {
      if (this.stick) return;
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro sintético */ }
      TT.audio.init();
      this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), settled: false };
      Object.assign(this.base.style, { left: e.clientX + 'px', top: e.clientY + 'px' });
      this.stickMove(e);
    }

    stickMove(e) {
      const s = this.stick;
      if (!s || e.pointerId !== s.id) return;
      const R = Math.min(innerWidth, innerHeight) * 0.13; // curso do analógico
      let dx = e.clientX - s.x0, dy = e.clientY - s.y0, d = Math.hypot(dx, dy);
      // logo que o dedo encosta, o ponto de contato "assenta" (o dedo achata e o centro desce alguns pixels):
      // nesse começo a origem acompanha o dedo, senão o boneco já sairia andando para baixo
      // (só um pequeno deslocamento a partir do toque; um movimento rápido de verdade passa direto)
      if (!s.settled) {
        if (performance.now() - s.t < 100 && Math.hypot(e.clientX - s.sx, e.clientY - s.sy) < R * 0.25) { s.x0 = e.clientX; s.y0 = e.clientY; dx = dy = d = 0; }
        else s.settled = true;
      }
      // analógico flutuante: se o dedo passa do curso, a base vem junto (a direção segue o movimento atual do
      // dedo, e não um ponto de partida antigo)
      if (d > R) {
        s.x0 = e.clientX - dx / d * R; s.y0 = e.clientY - dy / d * R;
        dx = dx / d * R; dy = dy / d * R; d = R;
        Object.assign(this.base.style, { left: s.x0 + 'px', top: s.y0 + 'px' });
      }
      this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      // direções com preferência pela horizontal: o polegar faz um arco ao empurrar para o lado, então até
      // 40° de inclinação é só esquerda/direita; para cima/baixo precisa de mais inclinação e mais curso
      const nd = new Set(), ax = Math.abs(dx), ay = Math.abs(dy), ang = Math.atan2(ay, ax) * 180 / Math.PI;
      if (ax > R * 0.28 && ang < 62) nd.add(dx > 0 ? 'right' : 'left');
      if (ay > R * 0.42 && ang > 40) nd.add(dy > 0 ? 'down' : 'up');
      const prev = this.dirs;
      this.dirs = nd;
      for (const k of nd) if (!prev.has(k)) this.press(k); // aperto novo: navega nos menus
      if (nd.size !== prev.size || [...nd].some((k) => !prev.has(k))) this.changed();
    }

    stickUp(e) {
      if (!this.stick || e.pointerId !== this.stick.id) return;
      this.stick = null; this.dirs = new Set(); this.changed();
      this.resetStick();
    }

    releaseAll() {
      this.held.clear(); this.dirs = new Set(); this.stick = null;
      if (this.base) this.resetStick();
      for (const k in this.btns) this.btns[k].classList.remove('down');
    }

    fullscreen() {
      const d = document;
      try {
        if (d.fullscreenElement) d.exitFullscreen();
        else {
          const p = d.documentElement.requestFullscreen();
          // no Android, trava na horizontal depois de entrar em tela cheia
          if (p && p.then) p.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* sem suporte */ } }).catch(() => {});
        }
      } catch (e) { /* sem suporte */ }
    }

    // Menu: avança/volta entre DESLIGADOS e as opacidades, e salva.
    cycle(dir) {
      const i = LEVELS.indexOf(this.level), n = LEVELS.length;
      this.level = LEVELS[((i < 0 ? 0 : i) + dir + n) % n];
      this.auto = false;
      TT.store.set('botoes', this.level);
      this.apply();
    }

    label() {
      return this.visible ? { text: 'BOTÕES NA TELA:', value: Math.round(this.level * 100) + '%', color: '#6fe3ff' }
        : { text: 'BOTÕES NA TELA:', value: 'DESLIGADOS', color: '#9a95b8' };
    }

    apply() {
      if (!this.root) return;
      this.root.classList.toggle('on', this.visible);
      this.root.style.opacity = this.visible ? String(this.level) : '0';
      if (!this.visible) this.releaseAll();
      this.rotate.classList.toggle('on', this.visible && hasTouch() && innerHeight > innerWidth);
    }

    // Uma vez por quadro de tela: AVANTE! pisca com a energia cheia e fica apagado sem energia.
    update() {
      if (!this.visible) return;
      const g = this.game, sup = this.btns.super;
      if (sup) {
        const full = g.state === 'play' && g.energy >= 100;
        sup.classList.toggle('full', full);
        sup.classList.toggle('off', g.state === 'play' && !full);
      }
    }
  }
  TT.TouchControls = TouchControls;
  TT.TOUCH_LEVELS = LEVELS;
})();
