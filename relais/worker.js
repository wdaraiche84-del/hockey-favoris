// =============================================================
// LE RELAIS DE MONTRIO (à installer sur Cloudflare Workers)
// Il fait deux choses :
//  1. Le direct : il va chercher les scores de la LNH pour le site
//     (les navigateurs n'ont pas le droit de les lire directement).
//  2. Les alertes sur le téléphone : chaque minute, il regarde les
//     matchs de la LNH et envoie une notification aux visiteurs
//     abonnés quand un de leurs favoris marque, ou à la fin du match.
// Instructions d'installation : voir relais/LISEZMOI.md
// Rien de secret ici : la clé d'envoi des alertes est créée par le
// relais lui-même au premier usage et gardée dans son espace (KV).
// =============================================================

const SOURCE = "https://api-web.nhle.com";
// Seules ces adresses sont relayées (le relais ne sert à rien d'autre)
const PERMIS = [/^\/v1\/score\/now$/, /^\/v1\/gamecenter\/\d+\/boxscore$/];
// Les adresses du site qui ont le droit d'utiliser le relais
const SITES = ["https://montriohockey.ca", "https://www.montriohockey.ca", "https://wdaraiche84-del.github.io"];
const SITE_PRINCIPAL = "https://wdaraiche84-del.github.io/hockey-favoris/";

export default {
  async fetch(requete, env, ctx) {
    const url = new URL(requete.url);
    const origine = requete.headers.get("Origin");
    const entetes = {
      "Access-Control-Allow-Origin": SITES.includes(origine) ? origine : SITES[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    if (requete.method === "OPTIONS") return new Response(null, { headers: entetes });
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...entetes, "Content-Type": "application/json" } });

    // ---- Alertes : clé publique, abonnement, désabonnement ----
    if (url.pathname === "/alertes/etat") return json({ actif: !!env.ABONNES });
    if (url.pathname.startsWith("/alertes/")) {
      if (!env.ABONNES) return json({ erreur: "Les alertes ne sont pas encore activées sur le relais." }, 503);
      if (url.pathname === "/alertes/cle" && requete.method === "GET") return json({ cle: (await clesVapid(env)).publique });
      if (requete.method !== "POST") return json({ erreur: "Méthode non permise" }, 405);
      let corps;
      try { corps = await requete.json(); } catch { return json({ erreur: "Demande illisible" }, 400); }
      const sub = corps.abonnement;
      if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return json({ erreur: "Abonnement invalide" }, 400);
      const cle = await empreinte(sub.endpoint);
      const abonnes = (await env.ABONNES.get("abonnes", "json")) || {};
      if (url.pathname === "/alertes/abonner") {
        const propre = (l, re) => (Array.isArray(l) ? l.map(String).filter((x) => re.test(x)).slice(0, 60) : []);
        abonnes[cle] = { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          equipes: propre(corps.equipes, /^[A-Z]{3}$/), joueurs: propre(corps.joueurs, /^\d{6,8}$/), maj: Date.now() };
      } else if (url.pathname === "/alertes/desabonner") delete abonnes[cle];
      else return json({ erreur: "Adresse inconnue" }, 404);
      await env.ABONNES.put("abonnes", JSON.stringify(abonnes));
      return json({ ok: true });
    }

    // ---- Le direct (lecture seule) ----
    if (requete.method !== "GET" || !PERMIS.some((r) => r.test(url.pathname))) {
      return new Response("Adresse non permise", { status: 404, headers: entetes });
    }
    const cache = caches.default;
    const cle = new Request(SOURCE + url.pathname);
    let rep = await cache.match(cle);
    if (!rep) {
      const source = await fetch(SOURCE + url.pathname, { headers: { "User-Agent": "MonTrio (site de fan)" } });
      rep = new Response(source.body, source);
      rep.headers.set("Cache-Control", "public, max-age=15");
      if (source.ok) ctx.waitUntil(cache.put(cle, rep.clone()));
    }
    const finale = new Response(rep.body, rep);
    for (const [k, v] of Object.entries(entetes)) finale.headers.set(k, v);
    return finale;
  },

  // Chaque minute (déclencheur « Cron » : * * * * *)
  async scheduled(evenement, env, ctx) {
    if (env.ABONNES) ctx.waitUntil(verifierMatchs(env));
  },
};

// ---- Surveillance des matchs ----------------------------------
const texte = (v) => (v && typeof v === "object" ? v.default : v) || "";
export async function verifierMatchs(env, envoyer = envoyerPush) {
  const rep = await fetch(SOURCE + "/v1/score/now", { headers: { "User-Agent": "MonTrio (site de fan)" } });
  if (!rep.ok) return;
  const donnees = await rep.json();
  const etat = (await env.ABONNES.get("etat", "json")) || {};
  const avis = []; // { equipes, joueurs, titre, texte, url, tag }
  let change = false;
  for (const g of donnees.games || []) {
    const id = String(g.id), dom = g.homeTeam?.abbrev, ext = g.awayTeam?.abbrev;
    const enCours = g.gameState === "LIVE" || g.gameState === "CRIT";
    const fini = g.gameState === "FINAL" || g.gameState === "OFF";
    if (!enCours && !fini) continue;
    const avant = etat[id];
    const buts = g.goals || [];
    if (!avant) {
      // Premier passage : si le match vient de commencer, on surveille dès maintenant ;
      // sinon on note la situation sans rien envoyer (pas de déluge d'alertes au démarrage)
      etat[id] = { buts: enCours && buts.length === 0 ? 0 : buts.length, fini }; change = true; continue;
    }
    const score = `${ext} ${g.awayTeam?.score ?? 0} – ${g.homeTeam?.score ?? 0} ${dom}`;
    buts.slice(avant.buts).forEach((but, k) => {
      const n = avant.buts + k, tag = `but-${id}-${n}`;
      const eq = texte(but.teamAbbrev), auteur = `${texte(but.firstName)} ${texte(but.lastName)}`.trim() || texte(but.name);
      const passes = (but.assists || []).map((a) => texte(a.name)).filter(Boolean);
      const situation = but.strength === "pp" ? " en avantage numérique" : but.strength === "sh" ? " en infériorité numérique" : but.goalModifier === "empty-net" ? " dans un filet désert" : "";
      avis.push({ joueurs: [String(but.playerId)], titre: `⭐ ${auteur} marque!`, texte: `${score}${situation}`, url: `#/match/${id}`, tag });
      for (const a of but.assists || []) avis.push({ joueurs: [String(a.playerId)], titre: `⭐ Passe pour ${texte(a.name)}!`, texte: `${score} · but de ${auteur}`, url: `#/match/${id}`, tag });
      avis.push({ equipes: [dom, ext], titre: `🚨 But de ${eq}!`, texte: `${score} · ${auteur}${situation}${passes.length ? ` (${passes.join(", ")})` : ""}`, url: `#/match/${id}`, tag });
    });
    if (fini && !avant.fini) {
      const type = g.gameOutcome?.lastPeriodType;
      avis.push({ equipes: [dom, ext], titre: "🏁 Final", texte: `${score}${type === "OT" ? " (prolongation)" : type === "SO" ? " (tirs de barrage)" : ""}`, url: `#/match/${id}`, tag: `final-${id}` });
    }
    if (buts.length !== avant.buts || fini !== avant.fini) { etat[id] = { buts: buts.length, fini }; change = true; }
  }
  // On oublie les matchs qui ne sont plus dans la liste du jour
  const ids = new Set((donnees.games || []).map((g) => String(g.id)));
  for (const k of Object.keys(etat)) if (!ids.has(k)) { delete etat[k]; change = true; }
  if (change) await env.ABONNES.put("etat", JSON.stringify(etat));
  if (!avis.length) return avis;

  // Chaque abonné reçoit au plus une alerte par but : celle de son joueur favori en priorité
  const abonnes = (await env.ABONNES.get("abonnes", "json")) || {};
  const vapid = await clesVapid(env);
  let retires = false;
  for (const [cle, a] of Object.entries(abonnes)) {
    const dejaTag = new Set();
    for (const x of avis) {
      const vise = (x.joueurs || []).some((j) => a.joueurs.includes(j)) || (x.equipes || []).some((e) => a.equipes.includes(e));
      if (!vise || dejaTag.has(x.tag)) continue;
      dejaTag.add(x.tag);
      const statut = await envoyer(a.sub, { titre: x.titre, texte: x.texte, url: SITE_PRINCIPAL + x.url, tag: x.tag }, vapid);
      if (statut === 404 || statut === 410) { delete abonnes[cle]; retires = true; break; } // abonnement expiré
    }
  }
  if (retires) await env.ABONNES.put("abonnes", JSON.stringify(abonnes));
  return avis;
}

// ---- Outils : base64url, empreinte -----------------------------
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const concat = (...l) => { const t = new Uint8Array(l.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of l) { t.set(x, i); i += x.length; } return t; };
const enc = (s) => new TextEncoder().encode(s);
async function empreinte(t) { return b64u(await crypto.subtle.digest("SHA-256", enc(t))).slice(0, 32); }

// ---- Clés VAPID : créées une seule fois, gardées dans KV -----------
export async function clesVapid(env) {
  let k = await env.ABONNES.get("vapid", "json");
  if (!k) {
    const paire = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    k = { publique: b64u(await crypto.subtle.exportKey("raw", paire.publicKey)), privee: await crypto.subtle.exportKey("jwk", paire.privateKey) };
    await env.ABONNES.put("vapid", JSON.stringify(k));
  }
  return k;
}
export async function jetonVapid(endpoint, k) {
  const entete = b64u(enc(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const charge = b64u(enc(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SITE_PRINCIPAL })));
  const cle = await crypto.subtle.importKey("jwk", k.privee, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cle, enc(`${entete}.${charge}`));
  return `${entete}.${charge}.${b64u(sig)}`;
}

// ---- Chiffrement du message (norme Web Push, RFC 8291 « aes128gcm ») ----
async function hkdf(sel, ikm, info, longueur) {
  const cle = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sel, info }, cle, longueur * 8));
}
export async function chiffrer(sub, message) {
  const uaPublique = deB64u(sub.keys.p256dh), auth = deB64u(sub.keys.auth);
  const paire = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublique = new Uint8Array(await crypto.subtle.exportKey("raw", paire.publicKey));
  const cleUa = await crypto.subtle.importKey("raw", uaPublique, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: cleUa }, paire.privateKey, 256));
  const ikm = await hkdf(auth, secret, concat(enc("WebPush: info\0"), uaPublique, asPublique), 32);
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sel, ikm, enc("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sel, ikm, enc("Content-Encoding: nonce\0"), 12);
  const cleAes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const clair = concat(enc(message), new Uint8Array([2])); // 2 = dernier (et seul) bloc
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cleAes, clair));
  const rs = new Uint8Array([0, 0, 16, 0]); // taille de bloc : 4096
  return concat(sel, rs, new Uint8Array([asPublique.length]), asPublique, chiffre);
}
export async function envoyerPush(sub, donnees, vapid) {
  try {
    const corps = await chiffrer(sub, JSON.stringify(donnees));
    const rep = await fetch(sub.endpoint, {
      method: "POST",
      headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "3600", Urgency: "high",
        Authorization: `vapid t=${await jetonVapid(sub.endpoint, vapid)}, k=${vapid.publique}` },
      body: corps,
    });
    return rep.status;
  } catch (e) { return 0; }
}
