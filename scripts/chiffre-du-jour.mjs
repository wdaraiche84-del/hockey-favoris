// =============================================================
// LE CHIFFRE DU JOUR (LNH)
// Une fois par jour (après 8 h, heure du Québec), le robot choisit
// la stat la plus étonnante parmi :
//   - une séquence de matchs avec au moins un point ou un but ;
//   - un gros match la veille (3 points ou plus) ;
//   - un blanchissage la veille ;
//   - une série de victoires d'une équipe ;
//   - à défaut, le meneur des marqueurs.
// Il évite de reprendre le même joueur ou la même équipe que la veille.
// Résultat : data/chiffre-du-jour.json (affiché sur l'accueil du site),
// et un message dans #lnh sur Discord (si le secret DISCORD_TOKEN existe).
// =============================================================

import { readFile, writeFile } from "node:fs/promises";

const FICHIER = "data/chiffre-du-jour.json";
const SITE = "https://wdaraiche84-del.github.io/hockey-favoris/";
const lireJson = async (f, defaut) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return defaut; } };
const dateQc = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(d);
const heureQc = (d) => Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "numeric", hourCycle: "h23" }).format(d));
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
// « 2 buts et 1 passe », « 4 passes » (sans les zéros)
const butsPasses = (b, a) => [b && pluriel(b, "but"), a && pluriel(a, "passe")].filter(Boolean).join(" et ") || "aucun point";
// « les Ducks d'Anaheim », « le Lightning de Tampa Bay », « l'Avalanche du Colorado »
const avecArticle = (nom) => {
  const surnom = nom.split(/ (?:de|du|d')\b| d'/)[0]; // « Maple Leafs » dans « Maple Leafs de Toronto »
  return /s$/i.test(surnom) ? `les ${nom}` : /^[aeiouhé]/i.test(nom) ? `l'${nom}` : `le ${nom}`;
};

// Tous les candidats, avec une note : plus c'est rare, plus la note est haute
export function candidats({ joueurs, equipes, calendrier, points, classement }, hier) {
  const nomEq = (eq) => equipes[eq] || eq, contre = (eq) => `contre ${avecArticle(nomEq(eq))}`;
  const parId = new Map(joueurs.map((j) => [String(j.id), j]));
  const finis = calendrier.filter((m) => m.etat === "fini").sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  const liste = [];

  // Séquences : on remonte les matchs de l'équipe, du plus récent au plus ancien (seulement ceux où le joueur a joué)
  const parJoueur = new Map();
  for (const eq of Object.keys(points)) {
    for (const m of finis.filter((x) => x.dom === eq || x.ext === eq)) {
      for (const [id, l] of Object.entries(points[eq][String(m.id)] || {})) {
        if (!Array.isArray(l) || l[0] === "G") continue;
        if (!parJoueur.has(id)) parJoueur.set(id, []);
        parJoueur.get(id).push({ b: Number(l[0]) || 0, a: Number(l[1]) || 0 });
      }
    }
  }
  for (const [id, lignes] of parJoueur) {
    const j = parId.get(id);
    if (!j) continue;
    let pts = 0, b = 0, a = 0;
    for (let i = lignes.length - 1; i >= 0 && lignes[i].b + lignes[i].a > 0; i--) { pts++; b += lignes[i].b; a += lignes[i].a; }
    if (pts >= 3) liste.push({ note: 2 * pts, sujet: id, chiffre: pts, texte: `matchs de suite avec au moins un point pour ${j.nom}`,
      detail: `${butsPasses(b, a)} pendant cette séquence`, lien: `#/joueur/${id}` });
    let buts = 0;
    for (let i = lignes.length - 1; i >= 0 && lignes[i].b > 0; i--) buts++;
    if (buts >= 3) liste.push({ note: 3 * buts, sujet: id, chiffre: buts, texte: `matchs de suite avec au moins un but pour ${j.nom}`,
      detail: `Sa séquence de buts est toujours active`, lien: `#/joueur/${id}` });
  }

  // La veille : gros match et blanchissage
  for (const m of finis.filter((x) => x.date === hier)) {
    for (const eq of [m.dom, m.ext]) {
      const adv = eq === m.dom ? m.ext : m.dom;
      for (const [id, l] of Object.entries(points[eq]?.[String(m.id)] || {})) {
        const j = parId.get(id);
        if (!j || !Array.isArray(l)) continue;
        if (l[0] === "G") {
          if (Number(l[3]) === 0 && Number(l[2]) >= 15) liste.push({ note: 7, sujet: id, chiffre: Number(l[1]), texte: `arrêts pour ${j.nom}, qui a signé un blanchissage hier soir ${contre(adv)}`,
            detail: `${nomEq(eq)} ${eq === m.dom ? m.sd : m.se}, ${nomEq(adv)} 0`, lien: `#/match/${m.id}` });
          continue;
        }
        const p = (Number(l[0]) || 0) + (Number(l[1]) || 0);
        if (p >= 3) liste.push({ note: 3 * p + (Number(l[0]) || 0), sujet: id, chiffre: p, texte: `points pour ${j.nom} hier soir ${contre(adv)}`,
          detail: butsPasses(Number(l[0]) || 0, Number(l[1]) || 0), lien: `#/match/${m.id}` });
      }
    }
  }

  // Séries de victoires
  for (const t of classement) {
    const n = /^W(\d+)$/.exec(t.serie || "");
    if (n && Number(n[1]) >= 3) liste.push({ note: 2 * Number(n[1]), sujet: t.eq, chiffre: Number(n[1]), texte: `victoires de suite pour ${nomEq(t.eq)}`,
      detail: `${t.pts} points au classement`, lien: `#/equipe/${t.eq}` });
  }

  // À défaut : le meneur des marqueurs
  const meneur = joueurs.filter((j) => j.s?.pj).sort((x, y) => y.s.pts - x.s.pts || y.s.b - x.s.b)[0];
  if (meneur) liste.push({ note: 1, sujet: String(meneur.id), chiffre: meneur.s.pts, texte: `points pour ${meneur.nom}, meneur des marqueurs de la LNH`,
    detail: `${butsPasses(meneur.s.b, meneur.s.a)} en ${pluriel(meneur.s.pj, "match")}`, lien: `#/joueur/${meneur.id}` });
  return liste;
}

export function choisir(liste, sujetHier) {
  return [...liste].sort((a, b) => b.note - a.note).find((c) => c.sujet !== sujetHier) || liste[0] || null;
}

async function publierDiscord(c) {
  if (!process.env.DISCORD_TOKEN) return false;
  const { api } = await import("./discord.mjs");
  const [g] = await api("/users/@me/guilds");
  const salon = (await api(`/guilds/${g.id}/channels`)).find((x) => x.type === 0 && x.name === "lnh");
  if (!salon) return false;
  await api(`/channels/${salon.id}/messages`, "POST", {
    embeds: [{ title: `📊 Le chiffre du jour : ${c.chiffre}`, description: `**${c.chiffre}** ${c.texte}.\n${c.detail}.`, url: SITE + c.lien, color: 0xEA580C,
      footer: { text: "MonTrioHockey · chaque matin, une stat de la LNH" } }],
    allowed_mentions: { parse: [] },
  });
  return true;
}

if (process.argv[1]?.endsWith("chiffre-du-jour.mjs")) {
  const maintenant = new Date(), aujourdhui = dateQc(maintenant);
  const etat = await lireJson(FICHIER, {});
  if (etat.date !== aujourdhui) {
    if (heureQc(maintenant) < 8) { console.log("Chiffre du jour : on attend 8 h (les matchs de la veille doivent être terminés)."); process.exit(0); }
    const lnh = await lireJson("data/joueurs.json", { joueurs: [], equipes: {} });
    const calendrier = await lireJson("data/calendrier.json", []);
    const points = {};
    for (const eq of Object.keys(lnh.equipes || {})) points[eq] = await lireJson(`data/points/${eq}.json`, {});
    const hier = dateQc(new Date(maintenant.getTime() - 864e5));
    const c = choisir(candidats({ joueurs: lnh.joueurs || [], equipes: lnh.equipes || {}, calendrier, points, classement: await lireJson("data/classement.json", []) }, hier), etat.sujet);
    if (!c) { console.log("Chiffre du jour : rien à dire (saison pas commencée?)."); process.exit(0); }
    Object.assign(etat, { date: aujourdhui, ...c, publie: null });
    await writeFile(FICHIER, JSON.stringify(etat, null, 1) + "\n");
    console.log(`Chiffre du jour : ${c.chiffre} ${c.texte}`);
  }
  if (etat.publie !== aujourdhui) {
    try {
      if (await publierDiscord(etat)) { etat.publie = aujourdhui; await writeFile(FICHIER, JSON.stringify(etat, null, 1) + "\n"); console.log("Publié dans #lnh."); }
    } catch (e) { console.log("Discord :", e.message); }
  }
}
