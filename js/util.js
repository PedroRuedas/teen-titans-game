'use strict';
// Núcleo compartilhado: constantes, matemática, entrada (teclado + gamepad).
(function () {
  const TT = (window.TT = window.TT || {});

  TT.W = 1280;
  TT.H = 720;
  TT.FLOOR_TOP = 470;
  TT.FLOOR_BOTTOM = 696;
  TT.GRAVITY = 0.85;

  TT.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  TT.lerp = (a, b, t) => a + (b - a) * t;
  TT.rand = (a, b) => a + Math.random() * (b - a);
  TT.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  TT.choice = (arr) => arr[(Math.random() * arr.length) | 0];
  TT.sign = (v) => (v < 0 ? -1 : 1);
  TT.easeOut = (t) => 1 - (1 - t) * (1 - t);
  TT.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // RNG determinístico (xorshift) para cenários cacheados.
  TT.seeded = function (seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  };

  // Escurece/clareia uma cor hex (#rrggbb) por um fator.
  const shadeCache = new Map();
  TT.shade = function (hex, f) {
    const key = hex + f;
    let v = shadeCache.get(key);
    if (v) return v;
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    v = '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1);
    shadeCache.set(key, v);
    return v;
  };

  // ---------------------------------------------------------------- Dificuldade
  // Multiplicadores centralizados. NORMAL = balanceamento original (tudo 1).
  //  enemyHp/bossHp: vida; dmg: dano recebido pelos Titãs; aggr: agressividade (divide os cooldowns
  //  dos inimigos); tokens: ataques simultâneos extras; windup: duração do aviso dos chefes;
  //  bossCool: intervalo entre golpes dos chefes; pizza: chance de dropar vida; regen: cura fora de campo.
  TT.DIFFICULTY = {
    easy: { name: 'FÁCIL', color: '#5dff8a', enemyHp: 0.75, bossHp: 0.8, dmg: 0.6, aggr: 0.7, tokens: -1, windup: 1.45, bossCool: 1.3, pizza: 1.8, regen: 2.5 },
    normal: { name: 'NORMAL', color: '#ffe14a', enemyHp: 1, bossHp: 1, dmg: 1, aggr: 1, tokens: 0, windup: 1, bossCool: 1, pizza: 1, regen: 1 },
    hard: { name: 'DIFÍCIL', color: '#ff5a4a', enemyHp: 1.3, bossHp: 1.3, dmg: 1.4, aggr: 1.4, tokens: 1, windup: 0.72, bossCool: 0.75, pizza: 0.5, regen: 0.4 },
  };
  TT.DIFF_ORDER = ['easy', 'normal', 'hard'];

  // Armazenamento local tolerante a falhas (modo privado, storage bloqueado...).
  TT.store = {
    get(k, def) {
      try { const v = window.localStorage.getItem('jovensTitas.' + k); return v == null ? def : v; } catch (e) { return def; }
    },
    set(k, v) {
      try { window.localStorage.setItem('jovensTitas.' + k, String(v)); return true; } catch (e) { return false; }
    },
  };

  TT.makeCanvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };

  // ---------------------------------------------------------------- Entrada
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    KeyJ: 'light', KeyZ: 'light',
    KeyK: 'heavy', KeyX: 'heavy',
    KeyL: 'special', KeyC: 'special',
    Space: 'jump',
    ShiftLeft: 'dash', ShiftRight: 'dash',
    KeyU: 'super', KeyV: 'super',
    KeyQ: 'prev', KeyE: 'next',
    Digit1: 't0', Digit2: 't1', Digit3: 't2', Digit4: 't3', Digit5: 't4',
    Numpad1: 't0', Numpad2: 't1', Numpad3: 't2', Numpad4: 't3', Numpad5: 't4',
    Enter: 'start', NumpadEnter: 'start',
    Escape: 'pause', KeyP: 'pause',
    KeyM: 'mute',
  };

  // Gamepad (layout "standard"): índice do botão -> ação.
  const PADMAP = {
    0: 'jump', 1: 'special', 2: 'light', 3: 'heavy',
    4: 'prev', 5: 'next', 6: 'super', 7: 'dash',
    9: 'pause', 8: 'mute',
    12: 'up', 13: 'down', 14: 'left', 15: 'right',
  };

  class Input {
    constructor() {
      this.keys = new Set();
      this.down = new Set();
      this.pressed = new Set();
      this.padPrev = new Set();
      this.padNow = new Set();
      this.bot = null; // controlador automático (testes/demo)
      this.anyKey = false;
      window.addEventListener('keydown', (e) => {
        const a = KEYMAP[e.code];
        this.anyKey = true;
        if (!a) return;
        e.preventDefault();
        if (!this.keys.has(a)) this.pressed.add(a);
        this.keys.add(a);
        if (a === 'pause' || a === 'start') this.pressed.add('menu');
      });
      window.addEventListener('keyup', (e) => {
        const a = KEYMAP[e.code];
        if (a) this.keys.delete(a);
      });
      window.addEventListener('blur', () => this.keys.clear());
    }

    pollPad() {
      this.padNow.clear();
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (!p || !p.connected) continue;
        p.buttons.forEach((b, i) => {
          if (b.pressed && PADMAP[i]) this.padNow.add(PADMAP[i]);
        });
        const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        if (ax < -0.35) this.padNow.add('left');
        if (ax > 0.35) this.padNow.add('right');
        if (ay < -0.35) this.padNow.add('up');
        if (ay > 0.35) this.padNow.add('down');
        if (p.buttons[9] && p.buttons[9].pressed) this.padNow.add('start');
        if (p.buttons[0] && p.buttons[0].pressed) this.padNow.add('confirm');
        break;
      }
      for (const a of this.padNow) if (!this.padPrev.has(a)) {
        this.pressed.add(a);
        if (a === 'pause' || a === 'start' || a === 'confirm') this.pressed.add('menu');
        this.anyKey = true;
      }
      this.padPrev = new Set(this.padNow);
    }

    // Monta o estado do quadro: teclado + gamepad + bot.
    sample() {
      this.pollPad();
      this.down.clear();
      for (const a of this.keys) this.down.add(a);
      for (const a of this.padNow) this.down.add(a);
      if (this.bot) {
        for (const a of this.bot.down) this.down.add(a);
        for (const a of this.bot.pressed) this.pressed.add(a);
        this.bot.pressed.clear();
      }
    }

    isDown(a) { return this.down.has(a); }
    wasPressed(a) { return this.pressed.has(a); }
    consume(a) { this.pressed.delete(a); }
    endStep() { this.pressed.clear(); }
  }
  TT.Input = Input;
})();
