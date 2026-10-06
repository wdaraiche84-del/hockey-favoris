// =============================================================
// LE « SERVICE WORKER » DE L'APPLICATION
// C'est ce qui permet d'installer MonTrio sur le téléphone.
// Règle simple : on demande toujours la version la plus récente
// sur internet, et on garde une copie de secours pour pouvoir
// ouvrir l'app même sans connexion (avec les dernières données vues).
// Pour forcer une mise à jour chez tout le monde, change VERSION.
// =============================================================
const VERSION = "montrio-v5";
const ESSENTIEL = ["./", "index.html", "style.css", "app.js", "config.js", "donnees.js", "manifest.webmanifest", "icones/icone-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ESSENTIEL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // On ne touche qu'aux fichiers du site lui-même (pas au direct ni aux polices)
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((rep) => {
        if (rep.ok) { const copie = rep.clone(); caches.open(VERSION).then((c) => c.put(e.request, copie)); }
        return rep;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
