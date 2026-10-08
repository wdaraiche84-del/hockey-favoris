// =============================================================
// LE « SERVICE WORKER » DE L'APPLICATION
// C'est ce qui permet d'installer MonTrioHockey sur le téléphone.
// Règle simple : on demande toujours la version la plus récente
// sur internet, et on garde une copie de secours pour pouvoir
// ouvrir l'app même sans connexion (avec les dernières données vues).
// Pour forcer une mise à jour chez tout le monde, change VERSION.
// =============================================================
const VERSION = "montrio-v28";
const ESSENTIEL = ["./", "index.html", "style.css?v=28", "app.js?v=28", "plus.js?v=28", "config.js?v=28", "donnees.js?v=28", "manifest.webmanifest", "icones/icone-192.png"];

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
    // Les pages elles-mêmes : toujours vérifier auprès du serveur qu'on a la dernière version
    fetch(e.request.mode === "navigate" ? new Request(e.request.url, { cache: "no-cache", credentials: "same-origin" }) : e.request)
      .then((rep) => {
        if (rep.ok) { const copie = rep.clone(); caches.open(VERSION).then((c) => c.put(e.request, copie)); }
        return rep;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});

// ---- Alertes sur le téléphone (envoyées par le relais) ----
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { titre: "MonTrioHockey", texte: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titre || "MonTrioHockey", {
    body: d.texte || "", tag: d.tag || undefined, icon: "icones/icone-192.png", badge: "icones/icone-192.png", data: { url: d.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "./";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((fen) => {
    const ouverte = fen.find((f) => f.url.startsWith(self.registration.scope));
    if (ouverte) { ouverte.navigate(url).catch(() => {}); return ouverte.focus(); }
    return clients.openWindow(url);
  }));
});
