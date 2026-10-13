'use strict';
// Áudio sintetizado (WebAudio): efeitos, trilhas em loop e vozes dos Titãs (síntese de fala do navegador).
// Arquivos próprios (mp3/ogg) configurados em audio/arquivos.js substituem a trilha e as vozes sintetizadas.
(function () {
  const TT = window.TT;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Trilhas: 16 passos por compasso; um acorde por compasso. Valores = nota MIDI (0 = pausa).
  const SONGS = {
    // Tema de abertura de Teen Titans (arranjo de memória, em Mi maior): verso, os gritos "Teen Titans!" e o "GO!" final.
    theme: {
      bpm: 172,
      chords: [[52, 56, 59], [52, 56, 59], [49, 52, 56], [47, 51, 54], [45, 49, 52], [45, 49, 52], [47, 51, 54], [47, 51, 54]],
      lead: [71, 0, 71, 0, 71, 69, 0, 71, 0, 73, 0, 71, 0, 68, 0, 0, //  When there's trou-ble you know who to call
             76, 0, 0, 0, 76, 0, 71, 0, 0, 0, 0, 0, 0, 0, 0, 0, //  TEEN TI-TANS!
             71, 0, 71, 0, 71, 69, 0, 71, 0, 73, 0, 76, 0, 73, 0, 0, //  From their tow-er they can see it all
             76, 0, 0, 0, 76, 0, 71, 0, 0, 0, 0, 0, 0, 0, 0, 0, //  TEEN TI-TANS!
             73, 0, 73, 0, 73, 71, 0, 73, 0, 76, 0, 73, 0, 71, 0, 0, //  When there's e-vil on the at-tack
             69, 0, 69, 0, 69, 68, 0, 69, 0, 71, 0, 69, 0, 68, 0, 0, //  you can rest know-ing they got your back
             68, 0, 71, 0, 76, 0, 76, 0, 78, 0, 76, 0, 75, 0, 76, 0, //  because when the world needs he-roes on pa-trol
             78, 0, 0, 0, 78, 0, 80, 0, 83, 0, 0, 0, 83, 0, 0, 0], //  TEEN TI-TANS... GO!
      drums: 'punk', hits: [16, 20, 22, 48, 52, 54, 112, 116, 118, 120],
    },
    boss: {
      bpm: 168,
      chords: [[45, 48, 52], [46, 50, 53], [45, 48, 52], [44, 47, 51]],
      lead: [69, 69, 0, 72, 0, 69, 0, 75, 0, 74, 0, 72, 0, 69, 0, 67,
             70, 70, 0, 74, 0, 70, 0, 77, 0, 76, 0, 74, 0, 70, 0, 69,
             69, 69, 0, 72, 0, 69, 0, 75, 0, 74, 0, 72, 0, 76, 0, 77,
             80, 0, 79, 0, 77, 0, 75, 0, 74, 0, 72, 0, 71, 0, 68, 0],
      drums: 'metal',
    },
    // Chefe Overload: rápido, com saltos de oitava "elétricos"
    overload: {
      bpm: 176,
      chords: [[50, 53, 57], [51, 55, 58], [50, 53, 57], [49, 52, 56]],
      lead: [74, 86, 0, 74, 0, 81, 0, 74, 77, 0, 76, 0, 74, 0, 72, 0,
             75, 87, 0, 75, 0, 82, 0, 75, 79, 0, 77, 0, 75, 0, 74, 0,
             74, 86, 0, 74, 0, 81, 0, 74, 77, 0, 79, 0, 81, 0, 82, 0,
             85, 0, 84, 0, 82, 0, 81, 0, 79, 0, 77, 0, 76, 0, 73, 0],
      drums: 'metal',
    },
    // Chefe Plasmus: pesado e arrastado, como lodo
    plasmus: {
      bpm: 150,
      chords: [[45, 48, 52], [46, 49, 53], [43, 46, 50], [44, 47, 51]],
      lead: [69, 0, 0, 68, 0, 0, 69, 0, 72, 0, 0, 71, 0, 0, 69, 0,
             70, 0, 0, 69, 0, 0, 70, 0, 73, 0, 0, 72, 0, 0, 70, 0,
             67, 0, 0, 66, 0, 0, 67, 0, 70, 0, 72, 0, 74, 0, 75, 0,
             76, 0, 75, 0, 74, 0, 72, 0, 71, 0, 0, 0, 68, 0, 0, 0],
      drums: 'metal',
    },
    // Chefe Irmão Sangue: órgão sombrio em Ré menor, com escala diminuta
    blood: {
      bpm: 140,
      chords: [[50, 53, 57], [46, 50, 53], [49, 52, 55], [50, 53, 57]],
      lead: [74, 0, 73, 74, 0, 77, 0, 74, 0, 70, 0, 69, 0, 70, 0, 0,
             74, 0, 73, 74, 0, 77, 0, 82, 0, 81, 0, 77, 0, 74, 0, 0,
             73, 0, 76, 0, 79, 0, 82, 0, 81, 0, 79, 0, 76, 0, 73, 0,
             74, 0, 0, 77, 0, 0, 81, 0, 86, 0, 0, 0, 85, 0, 0, 0],
      drums: 'metal',
    },
    // Chefe Mumbo: marcha de circo/show de mágica, saltitante e cromática
    mumbo: {
      bpm: 164,
      chords: [[45, 48, 52], [44, 47, 52], [45, 48, 52], [40, 44, 47]],
      lead: [76, 0, 75, 76, 0, 72, 0, 69, 0, 72, 0, 76, 0, 81, 0, 0,
             80, 0, 79, 80, 0, 76, 0, 71, 0, 74, 0, 76, 0, 80, 0, 0,
             81, 0, 80, 81, 0, 76, 0, 72, 0, 76, 0, 81, 0, 84, 0, 83,
             81, 0, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0, 71, 0, 68, 0],
      drums: 'rock',
    },
    // Chefe Slade: Mi menor frio e calculista, como um relógio (notas repetidas em "tique-taque")
    slade: {
      bpm: 158,
      chords: [[52, 55, 59], [48, 52, 55], [45, 48, 52], [47, 51, 54]],
      lead: [76, 0, 76, 0, 79, 0, 76, 0, 83, 0, 82, 0, 79, 0, 76, 0,
             76, 0, 76, 0, 79, 0, 76, 0, 84, 0, 83, 0, 79, 0, 76, 0,
             72, 0, 72, 0, 76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 72, 0,
             71, 0, 75, 0, 78, 0, 83, 0, 87, 0, 0, 0, 86, 0, 83, 0],
      drums: 'metal',
    },
    // Chefe Mallah e o Cérebro: marcha de cientista louco em Lá menor, com tercinas "de laboratório"
    brain: {
      bpm: 162,
      chords: [[45, 48, 52], [41, 45, 48], [43, 47, 50], [44, 47, 52]],
      lead: [69, 72, 76, 0, 81, 0, 76, 0, 72, 75, 76, 0, 69, 0, 0, 0,
             65, 69, 72, 0, 77, 0, 72, 0, 69, 72, 74, 0, 65, 0, 0, 0,
             67, 71, 74, 0, 79, 0, 74, 0, 71, 74, 79, 0, 83, 0, 81, 0,
             80, 0, 76, 0, 80, 0, 83, 0, 88, 0, 0, 0, 87, 0, 83, 0],
      drums: 'metal',
    },
    victory: {
      bpm: 120,
      chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]],
      lead: [72, 0, 76, 0, 79, 0, 84, 0, 0, 0, 79, 0, 84, 0, 0, 0,
             77, 0, 81, 0, 84, 0, 81, 0, 77, 0, 0, 0, 0, 0, 0, 0,
             79, 0, 83, 0, 86, 0, 83, 0, 79, 0, 77, 0, 74, 0, 0, 0,
             72, 0, 76, 0, 79, 0, 76, 0, 84, 0, 0, 0, 0, 0, 0, 0],
      drums: 'rock',
    },
  };

  // Titãs que falam nos golpes (teste com a Ravena; os outros só mostram o balão).
  TT.VOICED = ['raven'];
  // Voz sintetizada usada se o arquivo da fala não existir.
  const VOICES = {
    raven: { pitch: 0.75, rate: 0.82, female: true },
  };
  // Grafia para o sintetizador pronunciar como na série.
  const SPEAK = {
    'Azarath Metrion Zinthos!': 'Ázarath... Métrion... Zíntos!',
  };
  const FEMALE = /maria|francisca|thalita|luciana|leila|zira|aria|jenny|michelle|female|feminin/i;
  const voiceCache = {};
  function pickVoice(ss, lang, female) {
    const k = lang + (female ? 'f' : 'm');
    if (voiceCache[k] !== undefined) return voiceCache[k];
    const all = ss.getVoices();
    if (!all.length) return null; // a lista ainda não carregou: tenta de novo na próxima fala
    const pre = lang.slice(0, 2).toLowerCase();
    const same = all.filter((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase());
    const pool = same.length ? same : all.filter((v) => v.lang.toLowerCase().startsWith(pre));
    const byGender = pool.filter((v) => FEMALE.test(v.name) === !!female);
    const best = (l) => l.find((v) => /natural|online/i.test(v.name)) || l[0];
    return (voiceCache[k] = best(byGender) || best(pool) || null);
  }

  // Arquivos próprios (audio/arquivos.js). Os que falharem ao carregar caem de volta no som sintetizado.
  const badFiles = new Set();
  function musicFile(name) {
    const cfg = window.TT_AUDIO_FILES || {}, m = cfg.musica || {};
    const f = m[name] || (name === 'theme' ? cfg.tema : '');
    return f && !badFiles.has(f) ? f : '';
  }

  class AudioSys {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.song = null;
      this.step = 0;
      this.nextTime = 0;
      this.timer = null;
      this.lastPlay = {};
      this.lastVoice = 0;
      this.track = null;
    }

    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) { this.ctx = null; return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
      this.music = c.createGain(); this.music.gain.value = 0.3; this.music.connect(this.master);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.timer = setInterval(() => this.schedule(), 30);
      if (this.pendingSong) this.playSong(this.pendingSong);
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
      if (this.track) { if (this.muted) this.track.pause(); else this.track.play().catch(() => {}); }
      if (this.muted && window.speechSynthesis) window.speechSynthesis.cancel();
    }

    tone(freq, dur, type, vol, slideTo, delay, dest) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + (delay || 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(dest || this.sfx);
      o.start(t); o.stop(t + dur + 0.02);
    }

    noise(dur, vol, freq, type, delay, dest, q) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + (delay || 0);
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 2000;
      if (q) f.Q.value = q;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f); f.connect(g); g.connect(dest || this.sfx);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }

    play(name) {
      if (!this.ctx || this.muted) return;
      // Limita a repetição do mesmo som no mesmo instante (evita estouro de volume).
      const now = this.ctx.currentTime;
      if (this.lastPlay[name] && now - this.lastPlay[name] < 0.03) return;
      this.lastPlay[name] = now;
      switch (name) {
        case 'hit': this.noise(0.09, 0.5, 1800); this.tone(160, 0.08, 'square', 0.25, 60); break;
        case 'hitHeavy': this.noise(0.18, 0.7, 1200); this.tone(110, 0.2, 'sawtooth', 0.35, 40); break;
        case 'whoosh': this.noise(0.12, 0.18, 3000, 'bandpass', 0, null, 1.5); break;
        case 'jump': this.tone(300, 0.12, 'square', 0.12, 620); break;
        case 'land': this.noise(0.06, 0.15, 500); break;
        case 'laser': this.tone(1400, 0.15, 'sawtooth', 0.12, 300); break;
        case 'starbolt': this.tone(880, 0.18, 'triangle', 0.25, 1500); this.tone(440, 0.18, 'sine', 0.15, 900); break;
        case 'birdarang': this.tone(1200, 0.09, 'square', 0.07, 2200); this.noise(0.15, 0.12, 4000, 'highpass'); break;
        case 'sonic': this.tone(90, 0.7, 'sawtooth', 0.35, 60); this.tone(700, 0.7, 'square', 0.12, 200); this.noise(0.7, 0.3, 900); break;
        case 'dark': this.tone(220, 0.6, 'sine', 0.3, 55); this.tone(330, 0.6, 'triangle', 0.15, 80); break;
        case 'roar': this.noise(0.6, 0.5, 400); this.tone(80, 0.6, 'sawtooth', 0.4, 50); break;
        case 'boom': this.noise(0.55, 0.9, 700); this.tone(70, 0.5, 'sine', 0.6, 30); break;
        case 'pickup': [0, 0.07, 0.14].forEach((d, i) => this.tone(660 * Math.pow(1.26, i), 0.1, 'square', 0.12, 0, d)); break;
        case 'switch': this.tone(520, 0.08, 'square', 0.12, 880); this.tone(880, 0.1, 'square', 0.1, 1320, 0.06); break;
        case 'ko': this.tone(400, 0.6, 'square', 0.2, 80); break;
        case 'select': this.tone(660, 0.07, 'square', 0.15); this.tone(990, 0.1, 'square', 0.12, 0, 0.06); break;
        case 'super': [0, 0.1, 0.2, 0.3].forEach((d, i) => this.tone(330 * Math.pow(1.335, i), 0.35, 'sawtooth', 0.18, 0, d)); this.noise(1.2, 0.4, 2500, 'bandpass', 0.35); break;
        case 'break': this.noise(0.25, 0.6, 1500); this.tone(200, 0.12, 'square', 0.15, 90); break;
        case 'drill': this.noise(0.25, 0.25, 600, 'bandpass', 0, null, 4); this.tone(55, 0.25, 'sawtooth', 0.12); break;
        case 'alarm': this.tone(880, 0.25, 'square', 0.15, 660); this.tone(880, 0.25, 'square', 0.15, 660, 0.3); break;
        case 'zap': this.noise(0.18, 0.4, 5000, 'highpass'); this.tone(1800, 0.12, 'square', 0.1, 400); this.tone(90, 0.15, 'sawtooth', 0.15, 60); break;
        case 'thunder': this.noise(0.7, 0.8, 1400); this.noise(0.25, 0.4, 6000, 'highpass'); this.tone(60, 0.6, 'sawtooth', 0.4, 30); break;
        case 'shockwave': this.noise(0.5, 0.7, 300); this.tone(50, 0.5, 'sine', 0.7, 25); break;
        default: break;
      }
    }

    playSong(name) {
      if (!this.ctx) { this.pendingSong = name; return; }
      this.songName = name;
      const file = musicFile(name);
      if (file) { // arquivo próprio no lugar da trilha sintetizada
        this.song = null;
        if (this.track && this.track.dataset.src === file) { if (this.track.paused && !this.muted) this.track.play().catch(() => {}); return; }
        this.stopTrack();
        const el = new Audio(file);
        el.dataset.src = file; el.loop = true; el.volume = 0.5;
        el.addEventListener('error', () => { // arquivo não encontrado: volta para a versão sintetizada
          if (this.track !== el) return;
          this.track = null; badFiles.add(file);
          if (this.songName === name) this.playSong(name);
        });
        this.track = el;
        if (!this.muted) el.play().catch(() => {});
        return;
      }
      this.stopTrack();
      if (this.song === SONGS[name]) return;
      this.song = SONGS[name] || null;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.08;
    }
    stopTrack() { if (this.track) { this.track.pause(); this.track = null; } }

    stopSong() { this.song = null; this.pendingSong = null; this.songName = null; this.stopTrack(); }

    // Fala de um personagem (key = 'raven'...). Arquivo próprio > voz sintetizada.
    voice(key, text) {
      if (this.muted || !text || !this.ctx) return;
      const files = (window.TT_AUDIO_FILES && window.TT_AUDIO_FILES.vozes) || {};
      const f = files[key + ':' + text] || files[key + ':*'];
      if (f && !badFiles.has(f)) {
        const el = new Audio(f); el.volume = 0.95;
        el.addEventListener('error', () => badFiles.add(f));
        el.play().catch(() => {});
        return;
      }
      const ss = window.speechSynthesis, v = VOICES[key];
      if (!ss || !window.SpeechSynthesisUtterance || !v) return;
      const now = performance.now();
      if (now - this.lastVoice < 600) return;
      this.lastVoice = now;
      ss.cancel();
      let say = SPEAK[text] || text;
      if (say === say.toUpperCase()) say = say.toLowerCase(); // em maiúsculas o sintetizador soletra
      const u = new SpeechSynthesisUtterance(say);
      u.lang = v.lang || 'pt-BR'; u.pitch = v.pitch; u.rate = v.rate; u.volume = 1;
      const vc = pickVoice(ss, u.lang, v.female);
      if (vc) u.voice = vc;
      ss.speak(u);
    }

    schedule() {
      const c = this.ctx;
      if (!c || !this.song || this.muted) return;
      const s = this.song;
      const stepDur = 60 / s.bpm / 4;
      if (this.nextTime < c.currentTime - 0.5) this.nextTime = c.currentTime + 0.05;
      while (this.nextTime < c.currentTime + 0.12) {
        this.playStep(s, this.step, this.nextTime - c.currentTime, stepDur);
        this.step = (this.step + 1) % s.lead.length;
        this.nextTime += stepDur;
      }
    }

    playStep(s, i, d, stepDur) {
      const bar = (i / 16) | 0, b = i % 16, ch = s.chords[bar % s.chords.length];
      const M = this.music;
      // Baixo em colcheias
      if (b % 2 === 0) this.tone(mtof(ch[0] - 12), stepDur * 1.8, 'sawtooth', 0.22, 0, d, M);
      // Acorde em contratempo (guitarra "power chord" sintetizada)
      if (b % 4 === 2) {
        this.tone(mtof(ch[0]), stepDur * 1.5, 'square', 0.05, 0, d, M);
        this.tone(mtof(ch[2]), stepDur * 1.5, 'square', 0.05, 0, d, M);
      }
      const n = s.lead[i];
      if (n) this.tone(mtof(n), stepDur * 1.7, 'triangle', 0.17, 0, d, M);
      if (s.hits && s.hits.includes(i)) { // pancada da banda inteira nos gritos
        this.tone(mtof(n || ch[0] + 12), stepDur * 2.2, 'square', 0.09, 0, d, M);
        this.noise(0.25, 0.3, 4000, 'highpass', d, M);
      }
      // Bateria
      const kick = s.drums === 'metal' ? b % 2 === 0 : (b === 0 || b === 6 || b === 8 || (s.drums === 'punk' && b === 10));
      if (kick) this.tone(140, 0.12, 'sine', 0.55, 40, d, M);
      if (b === 4 || b === 12) this.noise(0.12, 0.35, 2500, 'bandpass', d, M, 0.8);
      if (b % 2 === 1 || s.drums !== 'rock') this.noise(0.03, 0.08, 7000, 'highpass', d, M);
    }
  }

  TT.audio = new AudioSys();
})();
