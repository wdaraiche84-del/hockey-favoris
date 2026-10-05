// =============================================================
// LE RELAIS POUR LE DIRECT (à installer sur Cloudflare Workers)
// Les navigateurs n'ont pas toujours le droit de lire directement
// le service de la LNH depuis un autre site. Ce petit relais va
// chercher le score pour le site, et ajoute l'autorisation qu'il
// faut. Il garde chaque réponse 15 secondes pour rester léger.
// Instructions d'installation : voir relais/LISEZMOI.md
// =============================================================

const SOURCE = "https://api-web.nhle.com";
// Seules ces adresses sont relayées (le relais ne sert à rien d'autre)
const PERMIS = [/^\/v1\/score\/now$/, /^\/v1\/gamecenter\/\d+\/boxscore$/];
const SITE = "https://wdaraiche84-del.github.io";

export default {
  async fetch(requete, env, ctx) {
    const url = new URL(requete.url);
    const entetes = {
      "Access-Control-Allow-Origin": SITE,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Vary": "Origin",
    };
    if (requete.method === "OPTIONS") return new Response(null, { headers: entetes });
    if (requete.method !== "GET" || !PERMIS.some((r) => r.test(url.pathname))) {
      return new Response("Adresse non permise", { status: 404, headers: entetes });
    }

    const cache = caches.default;
    const cle = new Request(SOURCE + url.pathname);
    let rep = await cache.match(cle);
    if (!rep) {
      const source = await fetch(SOURCE + url.pathname, { headers: { "User-Agent": "hockey-favoris (site de fan)" } });
      rep = new Response(source.body, source);
      rep.headers.set("Cache-Control", "public, max-age=15");
      if (source.ok) ctx.waitUntil(cache.put(cle, rep.clone()));
    }
    const finale = new Response(rep.body, rep);
    for (const [k, v] of Object.entries(entetes)) finale.headers.set(k, v);
    return finale;
  },
};
