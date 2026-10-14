'use strict';
// Jogo online com um amigo (2 jogadores pela internet), no estilo "jogo remoto":
// - quem CRIA a sala (anfitrião) roda a partida normalmente, em co-op; o amigo é o P2;
// - quem ENTRA na sala (convidado) não roda o jogo: manda os próprios botões (teclado, controle ou botões
//   na tela) e recebe a imagem e o som do jogo do anfitrião, ao vivo (WebRTC, direto entre os dois).
// Assim as duas telas mostram sempre a mesma partida, sem precisar sincronizar o jogo.
// Os dois navegadores se encontram pelo servidor gratuito do PeerJS (só para a apresentação; o jogo
// em si vai direto de um para o outro). A biblioteca só é baixada quando alguém usa o JOGAR ONLINE.
(function () {
  const TT = window.TT;
  const PEERJS = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  const PREFIX = 'jovens-titas-';
  const SITE = 'https://jovens-titas-jump-city.netlify.app/';
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, que se confundem
  const A = () => TT.audio;

  const CSS = `
  #tt-online { position: fixed; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center;
    background: rgba(7,4,15,0.82); font-family: ${TT.FONT}; color: #fff; }
  #tt-online.on { display: flex; }
  #tt-online .box { width: min(560px, 92vw); background: #140c2e; border: 4px solid #ffe14a; border-radius: 22px;
    padding: 22px 24px; box-shadow: 0 10px 0 rgba(0,0,0,0.5); text-align: center; }
  #tt-online h2 { margin: 0 0 6px; font-size: 40px; color: #ffe14a; letter-spacing: 0.03em; -webkit-text-stroke: 1.5px #17121f; }
  #tt-online p { margin: 8px 0; font-family: system-ui, sans-serif; font-size: 16px; line-height: 1.35; color: #d8d4f0; }
  #tt-online .row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin: 14px 0 4px; }
  #tt-online button { font-family: ${TT.FONT}; font-size: 22px; padding: 10px 18px; border-radius: 14px; cursor: pointer;
    border: 3px solid #17121f; background: #ffe14a; color: #17121f; box-shadow: 0 5px 0 rgba(0,0,0,0.45); }
  #tt-online button.alt { background: #6fe3ff; }
  #tt-online button.ghost { background: #3a3157; color: #fff; }
  #tt-online button:active { transform: translateY(3px); box-shadow: 0 2px 0 rgba(0,0,0,0.45); }
  #tt-online input { font-family: ${TT.FONT}; font-size: 30px; width: 7.5em; text-align: center; letter-spacing: 0.25em;
    text-transform: uppercase; padding: 8px; border-radius: 12px; border: 3px solid #17121f; background: #fff; color: #17121f; }
  #tt-online .code { font-size: 64px; color: #9effa8; letter-spacing: 0.18em; margin: 4px 0; -webkit-text-stroke: 2px #17121f; }
  #tt-online .msg { min-height: 1.4em; color: #ffd0a0; }
  #tt-online .ok { color: #9effa8; }
  #tt-badge { position: fixed; bottom: 6px; left: 50%; transform: translateX(-50%); z-index: 25; display: none; gap: 8px; align-items: center;
    font-family: ${TT.FONT}; font-size: 14px; color: #fff; background: rgba(20,12,46,0.75); border: 2px solid #6fe3ff;
    border-radius: 12px; padding: 4px 10px; pointer-events: auto; }
  #tt-badge.on { display: flex; }
  #tt-badge button { font-family: ${TT.FONT}; font-size: 13px; border-radius: 8px; border: 2px solid #17121f; background: #ff5a4a; color: #fff; padding: 2px 8px; cursor: pointer; }
  #tt-video { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #000; z-index: 5; display: none; }
  #tt-video.on { display: block; }`;

  function loadPeerJS() {
    if (window.Peer) return Promise.resolve();
    if (loadPeerJS.p) return loadPeerJS.p;
    loadPeerJS.p = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = PEERJS; s.async = true;
      s.onload = () => (window.Peer ? res() : rej(new Error('PeerJS não carregou')));
      s.onerror = () => { loadPeerJS.p = null; rej(new Error('sem internet')); };
      document.head.appendChild(s);
    });
    return loadPeerJS.p;
  }
  const newCode = () => Array.from({ length: 5 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
  const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  // Põe o H.264 na frente da lista de vídeo: nos celulares ele é codificado pelo hardware (bem mais leve e
  // rápido que o VP8 por software). Se o aparelho não tiver H.264, a lista fica como está.
  function preferH264(sdp) {
    const lines = sdp.split('\r\n'), mi = lines.findIndex((l) => l.startsWith('m=video'));
    if (mi < 0) return sdp;
    const h264 = [];
    for (const l of lines) { const m = /^a=rtpmap:(\d+) H264\/90000/i.exec(l); if (m) h264.push(m[1]); }
    if (!h264.length) return sdp;
    const parts = lines[mi].split(' '), pts = parts.slice(3);
    lines[mi] = parts.slice(0, 3).concat(pts.filter((p) => h264.includes(p)), pts.filter((p) => !h264.includes(p))).join(' ');
    return lines.join('\r\n');
  }

  class Online {
    constructor(game) {
      this.game = game;
      this.role = null;      // 'host' | 'guest' | null
      this.peer = null; this.conn = null; this.call = null;
      this.code = null;
      this.panelOpen = false;
      this.remote = null;    // botões do amigo (anfitrião)
      this.sentDown = ''; this.tick = 0;
      this.build();
      // convidado: tecla apertada vai para o anfitrião na hora (o Input já registrou a tecla antes deste ouvinte)
      window.addEventListener('keydown', () => { if (this.guest) this.flush(); });
      window.addEventListener('keyup', () => { if (this.guest) this.flush(); });
      // link de convite: ?sala=CODIGO abre a janela já com o código
      const m = /[?&]sala=([A-Za-z0-9]+)/.exec(location.search);
      if (m) setTimeout(() => this.openPanel(cleanCode(m[1])), 400);
    }

    get connected() { return !!(this.conn && this.conn.open); }
    get guest() { return this.role === 'guest' && !!this.conn; }
    get hosting() { return this.role === 'host' && this.connected; }

    // ------------------------------------------------------------------ Interface
    build() {
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      const ov = this.ov = document.createElement('div'); ov.id = 'tt-online';
      ov.innerHTML = '<div class="box"></div>';
      this.box = ov.firstChild;
      // não deixa o jogo receber as teclas digitadas na janela
      for (const ev of ['keydown', 'keyup']) ov.addEventListener(ev, (e) => { if (e.key === 'Escape' && ev === 'keydown' && this.role !== 'host') this.closePanel(); e.stopPropagation(); });
      document.body.appendChild(ov);
      const badge = this.badge = document.createElement('div'); badge.id = 'tt-badge';
      badge.innerHTML = '<span></span><button>SAIR</button>';
      badge.querySelector('button').addEventListener('click', () => this.leave(true));
      document.body.appendChild(badge);
      const v = this.video = document.createElement('video'); v.id = 'tt-video';
      v.playsInline = true; v.autoplay = true;
      document.body.appendChild(v);
    }

    screen(html) { this.box.innerHTML = html; }
    msg(text, ok) { const m = this.box.querySelector('.msg'); if (m) { m.textContent = text; m.classList.toggle('ok', !!ok); } }
    status(text) { this.badge.querySelector('span').textContent = text; this.badge.classList.toggle('on', !!text); }

    openPanel(code) {
      this.panelOpen = true;
      this.ov.classList.add('on');
      if (this.role === 'host' && this.code) return this.showHost();
      this.screen(`<h2>JOGAR ONLINE</h2>
        <p>Jogue com um amigo pela internet. Quem <b>cria a sala</b> joga como P1 e manda a imagem do jogo;
        quem <b>entra</b> joga como P2 de qualquer lugar.</p>
        <div class="row"><button data-a="create">CRIAR SALA</button></div>
        <p>ou digite o código da sala do seu amigo:</p>
        <div class="row"><input maxlength="5" placeholder="CÓDIGO" value="${code || ''}"><button class="alt" data-a="join">ENTRAR</button></div>
        <p class="msg"></p>
        <div class="row"><button class="ghost" data-a="close">FECHAR</button></div>`);
      const input = this.box.querySelector('input');
      input.addEventListener('input', () => { input.value = cleanCode(input.value); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.join(input.value); });
      this.box.querySelector('[data-a=create]').onclick = () => this.create();
      this.box.querySelector('[data-a=join]').onclick = () => this.join(input.value);
      this.box.querySelector('[data-a=close]').onclick = () => this.closePanel();
      if (!code) setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (e) { /* ok */ } }, 50);
    }

    closePanel() {
      this.panelOpen = false;
      this.ov.classList.remove('on');
      this.game.input.held.clear();
    }

    // ------------------------------------------------------------------ Anfitrião
    async create() {
      A().init();
      this.msg('Conectando...');
      try { await loadPeerJS(); } catch (e) { this.msg('Não consegui conectar ao servidor. Verifique a internet.'); return; }
      this.leave(false);
      this.role = 'host';
      const tryOpen = (left) => {
        const code = newCode();
        const peer = this.peer = new window.Peer(PREFIX + code.toLowerCase());
        peer.on('open', () => { this.code = code; this.showHost(); this.status('ONLINE • SALA ' + code + ' • esperando o amigo'); });
        peer.on('connection', (c) => this.onGuest(c));
        peer.on('error', (err) => {
          if (err.type === 'unavailable-id' && left > 0) { peer.destroy(); tryOpen(left - 1); return; } // código já em uso
          if (!this.code) { this.msg('Erro ao criar a sala (' + err.type + '). Tente de novo.'); this.role = null; }
        });
        peer.on('disconnected', () => { if (this.peer === peer && !peer.destroyed) try { peer.reconnect(); } catch (e) { /* ok */ } });
      };
      tryOpen(3);
    }

    // No itch.io o jogo roda num quadro de outro endereço (itch.zone), que não recebe o ?sala=: o link vai para o site do jogo.
    link() {
      const base = /(^|\.)itch\.(zone|io)$/.test(location.hostname) ? SITE : location.origin + location.pathname;
      return base + '?sala=' + this.code;
    }

    showHost() {
      const friend = this.connected;
      this.screen(`<h2>${friend ? 'AMIGO CONECTADO!' : 'SALA CRIADA'}</h2>
        <p>${friend ? 'Feche esta janela e escolha <b>JOGAR</b>. Seu amigo controla o P2.' : 'Mande este código (ou o link) para o seu amigo:'}</p>
        <div class="code">${this.code}</div>
        <div class="row">${navigator.share ? '<button class="alt" data-a="share">COMPARTILHAR LINK</button>' : ''}<button class="alt" data-a="copy">COPIAR LINK</button></div>
        <p class="msg ${friend ? 'ok' : ''}">${friend ? 'Conectado!' : 'Esperando o amigo entrar...'}</p>
        <div class="row"><button data-a="close">${friend ? 'JOGAR!' : 'FECHAR'}</button><button class="ghost" data-a="end">FECHAR A SALA</button></div>`);
      const sh = this.box.querySelector('[data-a=share]');
      if (sh) sh.onclick = () => navigator.share({ title: 'Jovens Titãs', text: 'Joga comigo! Sala ' + this.code, url: this.link() }).catch(() => {});
      this.box.querySelector('[data-a=copy]').onclick = () => {
        const done = () => this.msg('Link copiado! ' + this.link(), true);
        try { navigator.clipboard.writeText(this.link()).then(done, () => this.msg(this.link())); } catch (e) { this.msg(this.link()); }
      };
      this.box.querySelector('[data-a=close]').onclick = () => this.closePanel();
      this.box.querySelector('[data-a=end]').onclick = () => { this.leave(true); };
    }

    onGuest(c) {
      if (this.connected) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; }
      this.conn = c;
      c.on('open', () => {
        const g = this.game;
        this.remote = g.input.remote = { down: new Set(), pressed: new Set() };
        g.setPlayers(2);
        g.renderCap = 1; g.resize(); // 1280x720: menos para desenhar e para codificar no vídeo
        if (g.state !== 'play') { g.menuIdx = 0; }
        c.send({ t: 'hi', code: this.code });
        this.startStream(c.peer);
        this.status('ONLINE • SALA ' + this.code + ' • amigo conectado (P2)');
        if (this.panelOpen) this.showHost();
        A().play('pickup');
        g.say(g.slotTitan(1), 'Cheguei!', '#9effa8');
      });
      c.on('data', (m) => {
        if (!m || !this.remote) return;
        if (m.t === 'in') { this.remote.down = new Set(m.d || []); for (const a of m.p || []) this.remote.pressed.add(a); }
      });
      c.on('close', () => this.friendLeft());
      c.on('error', () => this.friendLeft());
    }

    // Manda a imagem do canvas (e o som do jogo) para o amigo.
    startStream(peerId) {
      // 30 quadros por segundo de vídeo (o jogo continua a 60): metade do trabalho de codificação, imagem estável
      const canvas = this.game.canvas, stream = canvas.captureStream(30);
      for (const tr of stream.getVideoTracks()) { try { tr.contentHint = 'motion'; } catch (e) { /* ok */ } }
      try {
        A().init();
        const au = A(), ctx = au.ctx;
        if (ctx && au.master) {
          if (!this.audioDest) { this.audioDest = ctx.createMediaStreamDestination(); au.master.connect(this.audioDest); }
          for (const tr of this.audioDest.stream.getAudioTracks()) stream.addTrack(tr);
        }
      } catch (e) { /* sem som para o amigo */ }
      this.call = this.peer.call(peerId, stream, { sdpTransform: preferH264 });
      // limita a resolução/bitrate do vídeo (a tela do anfitrião pode ser 2x)
      setTimeout(() => {
        try {
          const pc = this.call && this.call.peerConnection;
          for (const s of pc ? pc.getSenders() : []) {
            if (!s.track || s.track.kind !== 'video') continue;
            const p = s.getParameters(); p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}];
            p.encodings[0].maxBitrate = 2500000;
            p.encodings[0].maxFramerate = 30;
            p.encodings[0].scaleResolutionDownBy = Math.max(1, canvas.width / 960); // vídeo em 960x540
            p.degradationPreference = 'maintain-framerate'; // se apertar, perde nitidez mas não trava
            s.setParameters(p).catch(() => {});
          }
        } catch (e) { /* o navegador escolhe */ }
      }, 300);
    }

    friendLeft() {
      if (this.role !== 'host' || !this.remote) return;
      const g = this.game;
      this.remote = g.input.remote = null;
      this.conn = null;
      if (this.call) { try { this.call.close(); } catch (e) { /* ok */ } this.call = null; }
      g.setPlayers(1);
      g.renderCap = 0; g.resize();
      this.status(this.code ? 'ONLINE • SALA ' + this.code + ' • seu amigo saiu (pode entrar de novo)' : '');
      if (g.state === 'play' || g.state === 'pause') g.say(g.player, 'Meu amigo caiu! Sigo sozinho.', '#ffd0a0');
      if (this.panelOpen) this.showHost();
    }

    // Uma vez por quadro do anfitrião: conta para o amigo em que tela o jogo está (para os botões dele).
    hostTick() {
      if (!this.hosting) return;
      if (++this.tick % 10 === 0) { try { this.conn.send({ t: 'st', s: this.game.state, e: Math.round(this.game.energy) }); } catch (e) { /* ok */ } }
    }

    // ------------------------------------------------------------------ Convidado
    async join(raw) {
      const code = cleanCode(raw);
      if (code.length !== 5) { this.msg('O código tem 5 letras/números.'); return; }
      A().init();
      this.msg('Procurando a sala ' + code + '...');
      try { await loadPeerJS(); } catch (e) { this.msg('Não consegui conectar ao servidor. Verifique a internet.'); return; }
      this.leave(false);
      this.role = 'guest'; this.code = code;
      const peer = this.peer = new window.Peer();
      const fail = (text) => { if (this.peer !== peer) return; this.msg(text); this.leave(false); };
      const timer = setTimeout(() => { if (!this.connected) fail('Não encontrei a sala ' + code + '. Confira o código e se seu amigo está com a sala aberta.'); }, 15000);
      peer.on('error', (err) => { clearTimeout(timer); fail(err.type === 'peer-unavailable' ? 'A sala ' + code + ' não existe (ou já foi fechada).' : 'Erro de conexão (' + err.type + ').'); });
      peer.on('call', (call) => {
        this.call = call;
        call.answer(undefined, { sdpTransform: preferH264 });
        call.on('stream', (s) => { this.lowLatency(call); this.showVideo(s); });
      });
      peer.on('open', () => {
        const c = this.conn = peer.connect(PREFIX + code.toLowerCase(), { reliable: true });
        c.on('open', () => { clearTimeout(timer); this.msg('Conectado! Recebendo a imagem do jogo...', true); });
        c.on('data', (m) => {
          if (!m) return;
          if (m.t === 'full') { clearTimeout(timer); fail('A sala ' + code + ' já tem dois jogadores.'); }
          if (m.t === 'st') { this.game.state = m.s; this.game.energy = m.e; } // só para os botões na tela (o jogo roda no anfitrião)
        });
        c.on('close', () => { if (this.role === 'guest') this.hostLeft(); });
      });
    }

    showVideo(stream) {
      const v = this.video;
      v.srcObject = stream;
      v.classList.add('on');
      this.game.canvas.style.visibility = 'hidden';
      this.closePanel();
      this.status('ONLINE • SALA ' + this.code + ' • você é o P2');
      v.muted = false;
      const p = v.play();
      if (p && p.catch) p.catch(() => { v.muted = true; v.play().catch(() => {}); this.status('ONLINE • toque na tela para ligar o som'); const on = () => { v.muted = false; v.play().catch(() => {}); this.status('ONLINE • SALA ' + this.code + ' • você é o P2'); window.removeEventListener('pointerdown', on); }; window.addEventListener('pointerdown', on); });
    }

    // Pede ao navegador o menor atraso possível no vídeo recebido (sem "folga" no buffer).
    lowLatency(call) {
      try {
        for (const r of call.peerConnection.getReceivers()) {
          if ('jitterBufferTarget' in r) r.jitterBufferTarget = 0;
          if ('playoutDelayHint' in r) r.playoutDelayHint = 0;
        }
      } catch (e) { /* o navegador decide */ }
    }

    // Manda os botões do convidado agora (chamado no aperto, sem esperar o próximo quadro).
    flush() { if (this.connected) this.guestTick(); }

    hostLeft() {
      this.leave(false);
      this.openPanel();
      this.msg('O anfitrião fechou a sala (ou a conexão caiu).');
    }

    // Uma vez por quadro de tela do convidado: lê os botões e manda para o anfitrião.
    guestTick() {
      const inp = this.game.input;
      inp.sample();
      const P = inp.pl[0];
      if (P.pressed.has('mute')) { this.video.muted = !this.video.muted; P.pressed.delete('mute'); }
      const down = [...P.down].sort().join(','), pressed = [...P.pressed];
      this.tick++;
      if (this.connected && (pressed.length || down !== this.sentDown || this.tick % 20 === 0)) {
        try { this.conn.send({ t: 'in', d: [...P.down], p: pressed }); } catch (e) { /* ok */ }
        this.sentDown = down;
      }
      inp.endStep();
    }

    // ------------------------------------------------------------------ Sair
    leave(closeUi) {
      const wasHost = this.role === 'host' && this.remote;
      if (this.conn) { try { this.conn.close(); } catch (e) { /* ok */ } }
      if (this.call) { try { this.call.close(); } catch (e) { /* ok */ } }
      if (this.peer) { try { this.peer.destroy(); } catch (e) { /* ok */ } }
      this.peer = this.conn = this.call = null;
      if (wasHost) { this.remote = this.game.input.remote = null; this.game.setPlayers(1); }
      if (this.game.renderCap) { this.game.renderCap = 0; this.game.resize(); }
      if (this.role === 'guest') {
        this.video.srcObject = null; this.video.classList.remove('on');
        this.game.canvas.style.visibility = '';
        this.game.state = 'title'; this.game.stateT = 0;
      }
      this.role = null; this.code = null;
      this.status('');
      if (closeUi) this.closePanel();
    }

    // Item do menu do título.
    label() {
      if (this.hosting) return { text: 'ONLINE:', value: 'AMIGO CONECTADO', color: '#9effa8' };
      if (this.role === 'host' && this.code) return { text: 'ONLINE:', value: 'SALA ' + this.code, color: '#ffe14a' };
      return { text: 'JOGAR ONLINE', color: '#6fe3ff' };
    }
  }
  TT.Online = Online;
})();
