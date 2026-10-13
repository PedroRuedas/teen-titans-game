// Service worker do app: guarda os arquivos do jogo para abrir sem internet.
// Rede primeiro (sempre pega a versão nova quando há conexão); sem conexão, usa o que foi guardado.
// Não assume a página que já está aberta (sem skipWaiting/clients.claim): passa a valer na próxima visita,
// para nunca trocar de controle no meio de uma partida.
const CACHE = 'jovens-titas-v2';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'js/util.js', 'audio/arquivos.js', 'js/audio.js', 'js/render.js', 'js/faces.js', 'js/anim.js', 'js/backgrounds.js',
  'js/entities.js', 'js/stages.js', 'js/cutscene.js', 'js/game.js', 'js/touch.js', 'js/main.js',
  'audio/vozes/ravena-azarath.mp3', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
