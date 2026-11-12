// GitHub Pages lets browsers reuse every file for 10 minutes without asking, so right after a deploy a player
// could get the new index.html with an old board.js. Here every request to the site asks the server whether the
// file changed (a 304 if not, the body still comes from the browser cache), so each load is all of one version.
// It caches nothing of its own and never touches localStorage: progress is safe.
self.addEventListener('install', () => self.skipWaiting()); // a new sw.js takes over without waiting for tabs to close
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return; // Wiktionary, fonts…
  // If revalidating fails (offline, or a browser that rejects the option) it falls back to a normal request
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(noCache, () => fetch(e.request)));
});

// The same response marked no-cache: otherwise Chrome's in-memory cache reuses a script on reload without asking here.
function noCache(res) {
  if (res.type !== 'basic' || res.redirected) return res; // a rebuilt response loses its URL, and modules resolve imports against it
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-cache');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
