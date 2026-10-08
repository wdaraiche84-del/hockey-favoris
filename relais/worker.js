// =============================================================
// LE RELAIS DE MONTRIO (à installer sur Cloudflare Workers)
// Il fait deux choses :
//  1. Le direct : il va chercher les scores de la LNH pour le site
//     (les navigateurs n'ont pas le droit de les lire directement).
//  2. Les alertes sur le téléphone : chaque minute, il regarde les
//     matchs de la LNH et envoie une notification aux visiteurs
//     abonnés : 30 minutes avant le match, quand un de leurs favoris
//     marque, et à la fin du match.
//  3. Le bot Discord (si DISCORD_TOKEN et DISCORD_PUBLIC_KEY sont
//     configurés) : le résultat de chaque match de la LNH dans
//     #résultats, les commandes /score, /joueur et /classement, et le
//     bouton qui donne le rôle 🔔 Annonces.
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
// Seuls les vrais services d'alertes des navigateurs sont acceptés (Chrome, Firefox, Apple, Microsoft)
const SERVICES_PUSH = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /\.notify\.windows\.com$/, /^push\.services\.mozilla\.com$/];
const MAX_ABONNES = 5000;
const MAX_ENVOIS = 40; // le plan gratuit permet 50 requêtes sortantes par réveil
// Petite mémoire (le temps que le relais reste éveillé) : évite de surcharger la LNH et l'espace KV
const memoire = { direct: new Map(), etat: null, vapid: null, cleSignature: null, jetons: new Map() };

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
    // ---- Discord : commandes et boutons (Discord appelle cette adresse) ----
    if (url.pathname === "/discord") return interactionDiscord(requete, env, ctx);
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...entetes, "Content-Type": "application/json" } });

    // ---- Alertes : clé publique, abonnement, désabonnement ----
    if (url.pathname === "/alertes/etat") return json({ actif: !!env.ABONNES });
    if (url.pathname.startsWith("/alertes/")) {
      if (!env.ABONNES) return json({ erreur: "Les alertes ne sont pas encore activées sur le relais." }, 503);
      if (url.pathname === "/alertes/cle" && requete.method === "GET") return json({ cle: (await clesVapid(env)).publique });
      if (requete.method !== "POST") return json({ erreur: "Méthode non permise" }, 405);
      if (!SITES.includes(origine)) return json({ erreur: "Origine non permise" }, 403);
      let corps;
      try { corps = await requete.json(); } catch { return json({ erreur: "Demande illisible" }, 400); }
      const sub = corps.abonnement;
      const hote = (() => { try { const u = new URL(sub?.endpoint); return u.protocol === "https:" ? u.hostname : ""; } catch { return ""; } })();
      const b64 = /^[A-Za-z0-9_-]+={0,2}$/;
      if (!hote || !SERVICES_PUSH.some((r) => r.test(hote)) || String(sub.endpoint).length > 600
        || !b64.test(sub.keys?.p256dh || "") || !/^.{86,88}$/.test(sub.keys.p256dh) || !b64.test(sub.keys?.auth || "") || !/^.{21,24}$/.test(sub.keys.auth)) {
        return json({ erreur: "Abonnement invalide" }, 400);
      }
      const cle = await empreinte(sub.endpoint);
      const abonnes = (await env.ABONNES.get("abonnes", "json")) || {};
      let nouveau;
      if (url.pathname === "/alertes/abonner") {
        const propre = (l, re) => (Array.isArray(l) ? [...new Set(l.map(String).filter((x) => re.test(x)))].slice(0, 60).sort() : []);
        nouveau = { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          equipes: propre(corps.equipes, /^[A-Z]{3}$/), joueurs: propre(corps.joueurs, /^\d{6,8}$/) };
        // On n'écrit que si quelque chose a changé (le plan gratuit limite les écritures)
        if (JSON.stringify(abonnes[cle]) === JSON.stringify(nouveau)) return json({ ok: true });
        if (!abonnes[cle] && Object.keys(abonnes).length >= MAX_ABONNES) return json({ erreur: "Trop d'abonnés pour l'instant" }, 503);
        abonnes[cle] = nouveau;
      } else if (url.pathname === "/alertes/desabonner") {
        if (!abonnes[cle]) return json({ ok: true });
        delete abonnes[cle];
      } else return json({ erreur: "Adresse inconnue" }, 404);
      await env.ABONNES.put("abonnes", JSON.stringify(abonnes));
      return json({ ok: true });
    }

    // ---- Le direct (lecture seule) ----
    if (requete.method !== "GET" || !PERMIS.some((r) => r.test(url.pathname))) {
      return new Response("Adresse non permise", { status: 404, headers: entetes });
    }
    // Une même réponse sert tout le monde pendant 15 secondes
    let x = memoire.direct.get(url.pathname);
    if (!x || Date.now() - x.t > 15000) {
      const source = await fetch(SOURCE + url.pathname, { headers: { "User-Agent": "MonTrio (site de fan)" } });
      x = { t: Date.now(), statut: source.status, corps: await source.text() };
      if (source.ok) {
        memoire.direct.set(url.pathname, x);
        if (memoire.direct.size > 60) memoire.direct.delete(memoire.direct.keys().next().value);
      }
    }
    return new Response(x.corps, { status: x.statut, headers: { ...entetes, "Content-Type": "application/json", "Cache-Control": "public, max-age=15" } });
  },

  // Chaque minute (déclencheur « Cron » : * * * * *)
  async scheduled(evenement, env, ctx) {
    if (env.ABONNES) ctx.waitUntil(verifierMatchs(env));
  },
};

// ---- Surveillance des matchs ----------------------------------
const texte = (v) => (v && typeof v === "object" ? v.default : v) || "";
export async function verifierMatchs(env, envoyer = envoyerPush) {
  const abonnes = (await env.ABONNES.get("abonnes", "json")) || {};
  if (!Object.keys(abonnes).length && !env.DISCORD_TOKEN) return; // personne à prévenir : on ne fait rien
  const rep = await fetch(SOURCE + "/v1/score/now", { headers: { "User-Agent": "MonTrio (site de fan)" } });
  if (!rep.ok) return;
  const donnees = await rep.json();
  // L'état gardé en mémoire est plus récent que celui de KV (qui peut avoir jusqu'à une minute de retard)
  const lu = (await env.ABONNES.get("etat", "json")) || {};
  const etat = memoire.etat && (memoire.etat._t || 0) >= (lu._t || 0) ? memoire.etat : lu;
  const avis = []; // { equipes, joueurs, titre, texte, url, tag }
  const finals = []; // matchs qui viennent de se terminer (pour Discord)
  let change = false;
  for (const g of donnees.games || []) {
    const id = String(g.id), dom = g.homeTeam?.abbrev, ext = g.awayTeam?.abbrev;
    const enCours = g.gameState === "LIVE" || g.gameState === "CRIT";
    const fini = g.gameState === "FINAL" || g.gameState === "OFF";
    const avant = etat[id];
    if (!enCours && !fini) {
      // Rappel une seule fois, dans les 30 minutes avant le début du match
      const minutes = Math.round((Date.parse(g.startTimeUTC) - Date.now()) / 60000);
      if ((g.gameState === "FUT" || g.gameState === "PRE") && minutes > 0 && minutes <= 30 && !avant) {
        avis.push({ equipes: [dom, ext], titre: `⏰ ${ext} – ${dom} commence bientôt`, texte: `Mise au jeu dans ${minutes} minute${minutes > 1 ? "s" : ""}`, url: `#/match/${id}`, tag: `avant-${id}` });
        etat[id] = { buts: 0, fini: false }; change = true; // le match est surveillé dès la première seconde
      }
      continue;
    }
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
      finals.push(g);
    }
    if (buts.length !== avant.buts || fini !== avant.fini) { etat[id] = { buts: buts.length, fini }; change = true; }
  }
  // On oublie les matchs qui ne sont plus dans la liste du jour
  const ids = new Set((donnees.games || []).map((g) => String(g.id)));
  for (const k of Object.keys(etat)) if (k !== "_t" && !ids.has(k)) { delete etat[k]; change = true; }
  if (change) { etat._t = Date.now(); memoire.etat = etat; await env.ABONNES.put("etat", JSON.stringify(etat)); }
  if (env.DISCORD_TOKEN && finals.length) {
    try { await publierResultats(env, finals); } catch (e) { console.log("Discord :", e.message); }
  }
  if (!avis.length || !Object.keys(abonnes).length) return avis;

  // Chaque abonné reçoit au plus une alerte par but : celle de son joueur favori en priorité
  const vapid = await clesVapid(env);
  let retires = false, envois = 0;
  for (const [cle, a] of Object.entries(abonnes)) {
    const dejaTag = new Set();
    for (const x of avis) {
      if (envois >= MAX_ENVOIS) break;
      const vise = (x.joueurs || []).some((j) => a.joueurs.includes(j)) || (x.equipes || []).some((e) => a.equipes.includes(e));
      if (!vise || dejaTag.has(x.tag)) continue;
      dejaTag.add(x.tag);
      envois++;
      const statut = await envoyer(a.sub, { titre: x.titre, texte: x.texte, url: SITE_PRINCIPAL + x.url, tag: x.tag }, vapid);
      if (statut === 403 || statut === 404 || statut === 410) { delete abonnes[cle]; retires = true; break; } // abonnement expiré ou refusé
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
  if (memoire.vapid) return memoire.vapid;
  let k = await env.ABONNES.get("vapid", "json");
  if (!k) {
    const paire = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    k = { publique: b64u(await crypto.subtle.exportKey("raw", paire.publicKey)), privee: await crypto.subtle.exportKey("jwk", paire.privateKey) };
    await env.ABONNES.put("vapid", JSON.stringify(k));
  }
  memoire.vapid = k;
  return k;
}
export async function jetonVapid(endpoint, k) {
  const aud = new URL(endpoint).origin, garde = memoire.jetons.get(aud);
  if (garde && garde.exp - Date.now() / 1000 > 3600) return garde.jeton; // un jeton sert plusieurs heures
  const entete = b64u(enc(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const charge = b64u(enc(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SITE_PRINCIPAL })));
  memoire.cleSignature ||= await crypto.subtle.importKey("jwk", k.privee, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, memoire.cleSignature, enc(`${entete}.${charge}`));
  const jeton = `${entete}.${charge}.${b64u(sig)}`;
  memoire.jetons.set(aud, { jeton, exp: Math.floor(Date.now() / 1000) + 12 * 3600 });
  return jeton;
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

// ---- Discord : résultats, commandes et bouton de rôle ------------------
// Secrets à mettre dans Cloudflare (Settings → Variables and Secrets) :
//   DISCORD_TOKEN      : le jeton du bot (secret)
//   DISCORD_PUBLIC_KEY : la « Public Key » de l'application (pas secrète)
const DISCORD = "https://discord.com/api/v10";
const ORANGE = 0xEA580C;
async function discord(env, chemin, options = {}) {
  const r = await fetch(DISCORD + chemin, {
    method: options.method || "GET",
    headers: { Authorization: `Bot ${env.DISCORD_TOKEN}`, "Content-Type": "application/json", "User-Agent": "DiscordBot (MonTrioHockey, 1)" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!r.ok) throw new Error(`Discord ${r.status} ${chemin}`);
  return r.status === 204 ? null : r.json();
}
// Serveur, salons et rôles (gardés un jour dans KV pour ne pas les redemander à chaque fois)
async function infosDiscord(env, forcer = false) {
  if (memoire.discord && !forcer) return memoire.discord;
  let d = !forcer && env.ABONNES ? await env.ABONNES.get("discord", "json") : null;
  if (!d) {
    const [g] = await discord(env, "/users/@me/guilds");
    if (!g) throw new Error("le bot n'est dans aucun serveur");
    const [salons, roles] = await Promise.all([discord(env, `/guilds/${g.id}/channels`), discord(env, `/guilds/${g.id}/roles`)]);
    d = { serveur: g.id, salons: Object.fromEntries(salons.filter((c) => c.type === 0).map((c) => [c.name, c.id])), roles: Object.fromEntries(roles.map((r) => [r.name, r.id])) };
    if (env.ABONNES) await env.ABONNES.put("discord", JSON.stringify(d), { expirationTtl: 86400 });
  }
  return (memoire.discord = d);
}

// Résultat d'un match de la LNH dans #résultats, dès la fin du match
async function publierResultats(env, finals) {
  let d = await infosDiscord(env);
  if (!d.salons["résultats"]) d = await infosDiscord(env, true); // salon créé depuis la dernière lecture
  const salon = d.salons["résultats"];
  if (!salon) return;
  for (const g of finals) await discord(env, `/channels/${salon}/messages`, { method: "POST", body: { embeds: [carteResultat(g)], allowed_mentions: { parse: [] } } });
}
const nomEquipe = (t) => texte(t.name?.fr ? { default: t.name.fr } : t.name) || t.abbrev;
export function carteResultat(g) {
  const dom = g.homeTeam, ext = g.awayTeam, type = g.gameOutcome?.lastPeriodType;
  const fin = type === "OT" ? " (prolongation)" : type === "SO" ? " (tirs de barrage)" : "";
  const marqueurs = (abr) => {
    const n = {};
    for (const b of g.goals || []) if (texte(b.teamAbbrev) === abr) {
      const qui = `${texte(b.firstName)} ${texte(b.lastName)}`.trim() || texte(b.name);
      n[qui] = (n[qui] || 0) + 1;
    }
    return Object.entries(n).map(([k, v]) => (v > 1 ? `${k} (${v})` : k)).join("\n") || "—";
  };
  return {
    title: `🏁 ${ext.abbrev} ${ext.score ?? 0} – ${dom.score ?? 0} ${dom.abbrev}${fin}`,
    url: `${SITE_PRINCIPAL}#/match/${g.id}`, color: ORANGE,
    description: `**${nomEquipe(ext)}** ${ext.score ?? 0} – ${dom.score ?? 0} **${nomEquipe(dom)}**`,
    fields: [{ name: `Buts · ${ext.abbrev}`, value: marqueurs(ext.abbrev), inline: true }, { name: `Buts · ${dom.abbrev}`, value: marqueurs(dom.abbrev), inline: true }],
    footer: { text: "MonTrioHockey · le récit du match sur le site" },
  };
}

// Discord appelle /discord pour chaque commande ou clic de bouton
export async function interactionDiscord(requete, env) {
  if (requete.method !== "POST" || !env.DISCORD_PUBLIC_KEY) return new Response("Adresse non permise", { status: 404 });
  const sig = requete.headers.get("X-Signature-Ed25519"), ts = requete.headers.get("X-Signature-Timestamp");
  const corps = await requete.text();
  if (!sig || !ts || !(await signatureValide(env.DISCORD_PUBLIC_KEY, sig, ts + corps))) return new Response("Signature invalide", { status: 401 });
  const i = JSON.parse(corps);
  const repondre = (obj) => new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } });
  if (i.type === 1) return repondre({ type: 1 }); // vérification de Discord
  const message = (data) => repondre({ type: 4, data: { allowed_mentions: { parse: [] }, ...data } });
  try {
    if (i.type === 2) {
      const opt = Object.fromEntries((i.data.options || []).map((o) => [o.name, o.value]));
      if (i.data.name === "score") return message(await commandeScore());
      if (i.data.name === "joueur") return message(await commandeJoueur(String(opt.nom || "")));
      if (i.data.name === "classement") return message(await commandeClassement(opt.groupe || "ligue"));
    }
    if (i.type === 3 && i.data.custom_id === "role:annonces") return message(await basculerRole(env, i, "🔔 Annonces"));
  } catch (e) {
    console.log("Discord :", e.message);
    return message({ content: "Oups, un petit problème. Réessaie dans un instant.", flags: 64 });
  }
  return message({ content: "Commande inconnue.", flags: 64 });
}
const hex = (h) => Uint8Array.from(String(h).match(/../g) || [], (x) => parseInt(x, 16));
async function signatureValide(cle, sig, contenu) {
  try {
    const k = await crypto.subtle.importKey("raw", hex(cle), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" }, k, hex(sig), enc(contenu));
  } catch { return false; }
}
// Données du site (gardées 5 minutes)
async function donneesSite(fichier) {
  const x = (memoire.site ||= {})[fichier];
  if (x && Date.now() - x.t < 300000) return x.d;
  const r = await fetch(`${SITE_PRINCIPAL}data/${fichier}`);
  if (!r.ok) throw new Error(`site ${r.status} ${fichier}`);
  const d = await r.json();
  memoire.site[fichier] = { t: Date.now(), d };
  return d;
}
async function scoresDuJour() {
  let x = memoire.direct.get("/v1/score/now");
  if (!x || Date.now() - x.t > 15000) {
    const r = await fetch(SOURCE + "/v1/score/now", { headers: { "User-Agent": "MonTrio (site de fan)" } });
    x = { t: Date.now(), statut: r.status, corps: await r.text() };
    if (r.ok) memoire.direct.set("/v1/score/now", x);
  }
  return JSON.parse(x.corps);
}
const lienSite = (h = "") => `${SITE_PRINCIPAL}${h}`;
const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// /score : les matchs du jour, en direct
export async function commandeScore() {
  const d = await scoresDuJour();
  const jeux = d.games || [];
  const [a, m, j] = String(d.currentDate || "").split("-").map(Number);
  const titre = `🏒 La LNH ${j ? `le ${j === 1 ? "1er" : j} ${MOIS_FR[m - 1]}` : "aujourd'hui"}`;
  if (!jeux.length) return { embeds: [{ title: titre, description: "Aucun match de la LNH aujourd'hui.", color: ORANGE, url: lienSite() }] };
  const lignes = jeux.map((g) => {
    const e = g.awayTeam, h = g.homeTeam, etat = g.gameState;
    if (etat === "FUT" || etat === "PRE") return `${e.abbrev} @ ${h.abbrev} · <t:${Math.floor(Date.parse(g.startTimeUTC) / 1000)}:t>`;
    const sc = `${e.abbrev} **${e.score ?? 0} – ${h.score ?? 0}** ${h.abbrev}`;
    if (etat === "LIVE" || etat === "CRIT") {
      const p = g.periodDescriptor?.number, t = g.clock?.inIntermission ? "entracte" : g.clock?.timeRemaining || "";
      return `🔴 ${sc} · ${p > 3 ? "prol." : p ? `${p}${p === 1 ? "re" : "e"} pér.` : ""} ${t}`.trim();
    }
    const type = g.gameOutcome?.lastPeriodType;
    return `${sc} · Final${type === "OT" ? " (prol.)" : type === "SO" ? " (TB)" : ""}`;
  });
  return { embeds: [{ title: titre, description: lignes.join("\n").slice(0, 4000), color: ORANGE, url: lienSite(), footer: { text: "Heures affichées selon ton appareil · MonTrioHockey" } }] };
}

// /joueur : les stats d'un joueur de la LNH
const simple = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").trim();
export async function commandeJoueur(recherche) {
  const q = simple(recherche);
  if (q.length < 2) return { content: "Écris au moins 2 lettres du nom du joueur (ex. `/joueur Suzuki`).", flags: 64 };
  const d = await donneesSite("joueurs.json");
  const tous = d.joueurs || [];
  const exacts = tous.filter((j) => simple(j.nom) === q || simple(j.nom).split(" ").slice(1).join(" ") === q);
  const trouves = exacts.length ? exacts : tous.filter((j) => simple(j.nom).includes(q));
  if (!trouves.length) return { content: `Aucun joueur de la LNH trouvé pour « ${recherche.slice(0, 40)} ». Les autres ligues sont sur le site : ${lienSite()}`, flags: 64 };
  const equipe = (j) => d.equipes?.[j.eq] || j.eq;
  if (trouves.length > 1) {
    const liste = trouves.slice(0, 10).map((j) => `• **${j.nom}** · ${equipe(j)}`).join("\n");
    return { content: `Plusieurs joueurs trouvés. Précise le nom :\n${liste}${trouves.length > 10 ? "\n…" : ""}`, flags: 64 };
  }
  const j = trouves[0], gardien = j.pos === "G";
  const POS = { C: "Centre", L: "Ailier gauche", R: "Ailier droit", D: "Défenseur", G: "Gardien" };
  const st = gardien ? j.g || {} : j.s || {};
  const signe = (n) => (n > 0 ? `+${n}` : `${n ?? 0}`);
  const champs = gardien
    ? [["PJ", st.pj], ["V", st.v], ["D", st.d], ["DP", st.dp], ["Moy.", st.moy != null ? Number(st.moy).toFixed(2).replace(".", ",") : "–"], ["% arr.", st.pct != null ? Number(st.pct).toFixed(3).replace(/^0/, "") : "–"]]
    : [["PJ", st.pj], ["Buts", st.b], ["Passes", st.a], ["Points", st.pts], ["+/-", signe(st.pm)], ["Tirs", st.tirs ?? "–"]];
  return { embeds: [{
    title: `${j.nom}${j.no ? ` · #${j.no}` : ""}`, url: lienSite(`#/joueur/${j.id}`), color: ORANGE,
    description: `${POS[j.pos] || j.pos} · ${equipe(j)}\nSaison ${String(d.saison || "").replace(/^(\d{4})\d{2}(\d{2})$/, "$1-$2")}`.trim(),
    fields: champs.map(([n, v]) => ({ name: n, value: String(v ?? 0), inline: true })),
    footer: { text: "MonTrioHockey · stats match par match sur le site" },
  }] };
}

// /classement : le classement de la LNH
export async function commandeClassement(groupe) {
  const c = await donneesSite("classement.json");
  const choix = { est: ["Eastern", "Association de l'Est"], ouest: ["Western", "Association de l'Ouest"] }[groupe];
  const liste = c.filter((t) => !choix || t.conf === choix[0]).sort((a, b) => b.pts - a.pts || a.pj - b.pj || b.v - a.v);
  const ligne = (t, n) => `${String(n + 1).padStart(2)}  ${t.eq.padEnd(4)}${String(t.pj).padStart(3)}${String(t.v).padStart(3)}${String(t.d).padStart(3)}${String(t.dp).padStart(3)}${String(t.pts).padStart(4)}`;
  const tableau = ["  #  ÉQ   PJ  V  D DP PTS", ...liste.map(ligne)].join("\n");
  return { embeds: [{ title: `🏆 Classement · ${choix ? choix[1] : "toute la LNH"}`, url: lienSite("#/classement"), color: ORANGE,
    description: "```\n" + tableau.slice(0, 3900) + "\n```", footer: { text: "PJ matchs · V victoires · D défaites · DP défaites en prolongation · PTS points" } }] };
}

// Bouton « 🔔 Annonces » : donne le rôle, ou l'enlève si on l'a déjà
async function basculerRole(env, i, nomRole) {
  let d = await infosDiscord(env);
  if (!d.roles[nomRole]) d = await infosDiscord(env, true);
  const role = d.roles[nomRole];
  if (!role || !i.member) return { content: "Ce rôle n'existe pas encore sur le serveur.", flags: 64 };
  const deja = (i.member.roles || []).includes(role);
  try {
    await discord(env, `/guilds/${i.guild_id}/members/${i.member.user.id}/roles/${role}`, { method: deja ? "DELETE" : "PUT" });
  } catch (e) {
    return { content: "Je n'ai pas la permission de donner ce rôle. Un membre de l'équipe doit placer le rôle du bot au-dessus de 🔔 Annonces.", flags: 64 };
  }
  return { content: deja ? "🔕 C'est noté : tu ne recevras plus les mentions d'annonces." : "🔔 C'est fait! Tu recevras une mention lors des grosses nouveautés du site.", flags: 64 };
}
