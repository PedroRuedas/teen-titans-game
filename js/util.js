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
  // Teclas do P1 (sempre) e teclas globais (menus).
  const KEYS_P1 = {
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
    KeyJ: 'light', KeyZ: 'light', KeyK: 'heavy', KeyX: 'heavy', KeyL: 'special', KeyC: 'special',
    Space: 'jump', ShiftLeft: 'dash', ShiftRight: 'dash', KeyU: 'super', KeyV: 'super',
    KeyQ: 'prev', KeyE: 'next',
    Digit1: 't0', Digit2: 't1', Digit3: 't2', Digit4: 't3', Digit5: 't4',
    Enter: 'start', NumpadEnter: 'start', Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
  };
  // Setas e Numpad1-5: do P1 só no modo 1 jogador.
  const KEYS_SOLO = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    Numpad1: 't0', Numpad2: 't1', Numpad3: 't2', Numpad4: 't3', Numpad5: 't4',
  };
  // P2 no modo 2 jogadores: setas + teclado numérico.
  const KEYS_P2 = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    Numpad1: 'light', Numpad2: 'heavy', Numpad3: 'special', Numpad0: 'jump', NumpadDecimal: 'dash',
    Numpad4: 'prev', Numpad6: 'next', Numpad5: 'super',
  };
  TT.KEYS = { P1: KEYS_P1, SOLO: KEYS_SOLO, P2: KEYS_P2 };

  // Gamepad (layout "standard"): índice do botão -> ação.
  const PADMAP = {
    0: 'jump', 1: 'special', 2: 'light', 3: 'heavy',
    4: 'prev', 5: 'next', 6: 'super', 7: 'dash',
    9: 'pause', 8: 'mute',
    12: 'up', 13: 'down', 14: 'left', 15: 'right',
  };
  const MENU_ACTS = { pause: 1, start: 1, confirm: 1 };

  // Estado de entrada de um jogador.
  class PlayerInput {
    constructor() { this.down = new Set(); this.pressed = new Set(); this.padPrev = new Set(); this.padNow = new Set(); this.bot = null; }
    isDown(a) { return this.down.has(a); }
    wasPressed(a) { return this.pressed.has(a); }
    consume(a) { this.pressed.delete(a); }
  }
  TT.PlayerInput = PlayerInput;

  class Input {
    constructor() {
      this.pl = [new PlayerInput(), new PlayerInput()];
      this.twoPlayers = false;
      this.held = new Map(); // código da tecla -> [jogador, ação]
      this.touch = null;     // controles de toque (js/touch.js), sempre do P1
      this.remote = null;    // botões do amigo no jogo online (js/online.js), sempre do P2
      this.anyKey = false;
      window.addEventListener('keydown', (e) => {
        if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return; // digitando (código da sala)
        this.anyKey = true;
        const m = this.mapKey(e.code);
        if (!m) return;
        e.preventDefault();
        if (this.held.has(e.code)) return; // repetição automática
        this.held.set(e.code, m);
        const P = this.pl[m[0]];
        P.pressed.add(m[1]);
        if (MENU_ACTS[m[1]]) P.pressed.add('menu');
      });
      window.addEventListener('keyup', (e) => { this.held.delete(e.code); });
      window.addEventListener('blur', () => this.held.clear());
    }

    // Tecla -> [jogador, ação], conforme o modo (1 ou 2 jogadores).
    mapKey(code) {
      if (KEYS_P1[code]) return [0, KEYS_P1[code]];
      // online: o P2 é o amigo, então as setas continuam sendo do P1
      if (this.twoPlayers && !this.remote) return KEYS_P2[code] ? [1, KEYS_P2[code]] : null;
      return KEYS_SOLO[code] ? [0, KEYS_SOLO[code]] : null;
    }

    // Gamepads: no modo 1 jogador o primeiro controle é do P1; no modo 2, o 1º é do P1 e o 2º do P2.
    pollPad() {
      for (const P of this.pl) P.padNow.clear();
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let n = 0;
      for (const p of pads) {
        if (!p || !p.connected) continue;
        const P = this.pl[n];
        p.buttons.forEach((b, i) => { if (b.pressed && PADMAP[i]) P.padNow.add(PADMAP[i]); });
        const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        if (ax < -0.35) P.padNow.add('left');
        if (ax > 0.35) P.padNow.add('right');
        if (ay < -0.35) P.padNow.add('up');
        if (ay > 0.35) P.padNow.add('down');
        if (p.buttons[9] && p.buttons[9].pressed) P.padNow.add('start');
        if (p.buttons[0] && p.buttons[0].pressed) P.padNow.add('confirm');
        if (++n >= (this.twoPlayers && !this.remote ? 2 : 1)) break;
      }
      for (const P of this.pl) {
        for (const a of P.padNow) if (!P.padPrev.has(a)) {
          P.pressed.add(a);
          if (MENU_ACTS[a]) P.pressed.add('menu');
          this.anyKey = true;
        }
        P.padPrev = new Set(P.padNow);
      }
    }

    // Monta o estado do quadro: teclado + gamepad + bots.
    sample() {
      this.pollPad();
      for (const P of this.pl) P.down.clear();
      for (const [, m] of this.held) this.pl[m[0]].down.add(m[1]);
      if (this.touch) for (const a of this.touch.down()) this.pl[0].down.add(a);
      if (this.remote) { // amigo online = P2
        const P = this.pl[1];
        for (const a of this.remote.down) P.down.add(a);
        for (const a of this.remote.pressed) { P.pressed.add(a); if (MENU_ACTS[a]) P.pressed.add('menu'); }
        this.remote.pressed.clear();
      }
      for (const P of this.pl) {
        for (const a of P.padNow) P.down.add(a);
        if (P.bot) {
          for (const a of P.bot.down) P.down.add(a);
          for (const a of P.bot.pressed) P.pressed.add(a);
          P.bot.pressed.clear();
        }
      }
    }

    // Compatibilidade: "bot" e "pressed" do P1.
    get bot() { return this.pl[0].bot; }
    set bot(b) { this.pl[0].bot = b; }
    get pressed() { return this.pl[0].pressed; }
    // Consultas globais (menus): qualquer jogador.
    isDown(a) { return this.pl[0].down.has(a) || this.pl[1].down.has(a); }
    wasPressed(a) { return this.pl[0].pressed.has(a) || this.pl[1].pressed.has(a); }
    consume(a) { for (const P of this.pl) P.pressed.delete(a); }
    endStep() { for (const P of this.pl) P.pressed.clear(); }
  }
  TT.Input = Input;
})();
