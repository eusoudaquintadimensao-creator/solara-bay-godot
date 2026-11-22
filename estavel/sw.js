// Solara Bay — service worker (PWA, t60). Um por pasta (link principal e /estavel/ têm o seu).
// · ATUAL.txt / version.json: sempre da rede (sem cache) — é assim que o jogo descobre versão nova.
// · páginas .html / navegação: rede primeiro (versão nova chega logo), cache se estiver sem internet.
// · arquivos versionados (solara-030-stepN.*, loading_bg_vN.*): cache primeiro (nunca mudam), e baixa uma vez só.
// · guarda só as 2 versões mais novas para não encher o celular.
const CACHE = 'solara-bay-v1';
const VERSIONED = /\/(solara-\d+-[\w-]+)\.[\w.]+$|\/loading_bg_v\d+\.\w+$|\/icon_\d+\.png$/;
const NEVER = /\/(ATUAL\.txt|version\.json)$/;

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

async function trim(cache, keepSlug) {
  const keys = await cache.keys(); const slugs = [];
  for (const r of keys) { const m = new URL(r.url).pathname.match(/\/(solara-\d+-[\w-]+)\./); if (m && !slugs.includes(m[1])) slugs.push(m[1]); }
  const keep = new Set([keepSlug, ...slugs.filter((s) => s !== keepSlug).slice(-1)]);
  for (const r of keys) { const m = new URL(r.url).pathname.match(/\/(solara-\d+-[\w-]+)\./); if (m && !keep.has(m[1])) await cache.delete(r); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;   // TikTok etc.: não mexe
  const path = url.pathname;
  if (NEVER.test(path)) { e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || Response.error()))); return; }
  if (VERSIONED.test(path)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE); const key = url.origin + path;   // sem ?v=
      const hit = await cache.match(key); if (hit) return hit;
      const res = await fetch(req); if (res.ok && res.status === 200) { cache.put(key, res.clone()); const m = path.match(/\/(solara-\d+-[\w-]+)\./); if (m) trim(cache, m[1]); }
      return res;
    })());
    return;
  }
  if (req.mode === 'navigate' || path.endsWith('.html') || path.endsWith('/')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE); const key = url.origin + path;
      try { const res = await fetch(req, { cache: 'no-store' }); if (res.ok) cache.put(key, res.clone()); return res; }
      catch (err) { return (await cache.match(key)) || (await cache.match(url.origin + url.pathname.replace(/[^/]*$/, ''))) || Response.error(); }
    })());
  }
});
