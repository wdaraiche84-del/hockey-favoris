// =============================================================
// LE ROBOT DES LIENS DE PARTAGE
// Quand on colle un lien dans Messenger, Discord, Facebook ou un
// texto, l'application lit une petite fiche cachée dans la page
// (titre, description, image). Le site étant une seule page, ces
// fiches seraient toutes pareilles. Ce robot crée donc une mini-page
// par joueur, par équipe et par match, avec une adresse lisible :
//   lnh/joueur/nick-suzuki/8480018/            → joueur
//   lnh/equipe/canadiens-de-montreal/          → équipe
//   lnh/match/hurricanes-canadiens-2026-10-06/2026020041/ → match
// (même règle que la fonction cheminJoli de plus.js)
// Chaque mini-page a sa propre fiche, puis envoie aussitôt le
// visiteur à la bonne place sur le site.
// On n'écrit que les pages qui ont changé.
// =============================================================

import { readFile, writeFile, mkdir, readdir, unlink, rm } from "node:fs/promises";

// L'adresse du site : à changer ici le jour où il aura son propre nom de domaine
const SITE = "https://wdaraiche84-del.github.io/hockey-favoris/";
const IMAGE = SITE + "icones/apercu.png";

// Le préfixe des adresses : le nom français de la ligue
const PREFIXE = { lnh: "lnh", ahl: "lah", lhjmq: "lhjmq", ohl: "ohl", whl: "whl", khl: "khl", shl: "shl", liiga: "liiga", nl: "nl" };
const slugUrl = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const LIGUES = { lnh: "LNH", ahl: "LAH", lhjmq: "LHJMQ", ohl: "OHL", whl: "WHL", khl: "KHL", shl: "SHL", liiga: "Liiga", nl: "National League" };
const POS = { AG: "Ailier gauche", C: "Centre", AD: "Ailier droit", AV: "Attaquant", D: "Défenseur", G: "Gardien" };
const lireJson = async (f) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return null; } };
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pl = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const dec = (x, n) => (x == null ? "–" : Number(x).toFixed(n).replace(".", ","));

function page({ titre, description, cible }) {
  const url = SITE + "#/" + cible;
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website"><meta property="og:locale" content="fr_CA"><meta property="og:site_name" content="MonTrioHockey">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${IMAGE}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#111111">
<meta http-equiv="refresh" content="0; url=${esc(url)}">
<link rel="canonical" href="${esc(url)}">
<script>location.replace(${JSON.stringify(url)});</script>
</head><body style="font-family:system-ui;background:#111;color:#eee;padding:24px">
<p><a href="${esc(url)}" style="color:#FB923C">${esc(titre)} · ouvrir MonTrioHockey</a></p>
</body></html>
`;
}

// ---- Les données de toutes les ligues ----
const equipes = {}, joueurs = [], cal = [], classements = {};
const lnh = await lireJson("data/joueurs.json");
if (lnh) {
  // Nom court comme sur le site : « Canadiens de Montréal » → « Canadiens »
  for (const [abr, nom] of Object.entries(lnh.equipes)) equipes[abr] = { abr, nom, court: nom.split(/\s(?:de|du|des)\s|\sd'/)[0], lig: "lnh" };
  for (const j of lnh.joueurs) joueurs.push({ ...j, lig: "lnh" });
  cal.push(...((await lireJson("data/calendrier.json")) || []));
  classements.lnh = (await lireJson("data/classement.json")) || [];
}
for (const lig of Object.keys(LIGUES).filter((l) => l !== "lnh")) {
  const infos = await lireJson(`data/ligues/${lig}/infos.json`);
  if (!infos) continue;
  for (const [k, e] of Object.entries(infos.equipes)) equipes[k] = { ...e, lig };
  for (const j of infos.joueurs) joueurs.push({ ...j, lig });
  cal.push(...((await lireJson(`data/ligues/${lig}/calendrier.json`)) || []));
  classements[lig] = infos.classement || [];
}
const nomEq = (k) => equipes[k]?.nom || k;
const abr = (k) => equipes[k]?.abr || k;
const dateFr = (d) => new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Toronto" }).format(new Date(d)).replace(/^(\D+ )1 /, "$11er ");
const heureFr = (d) => new Intl.DateTimeFormat("fr-CA", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(new Date(d));

// ---- Les mini-pages ----
const pages = new Map(); // chemin → contenu
for (const j of joueurs) {
  const eq = nomEq(j.eq), lig = LIGUES[j.lig];
  let stats = "";
  if (j.s && j.s.pj) stats = `Saison : ${j.s.b} B, ${j.s.a} A, ${pl(j.s.pts, "point")} en ${pl(j.s.pj, "match")}. `;
  if (j.g && j.g.pj) stats = `Saison : ${j.g.v}-${j.g.d}-${j.g.dp}, moyenne ${dec(j.g.moy, 2)}, ${j.g.pct != null ? j.g.pct.toFixed(3).replace(/^0/, "") : "–"} d'arrêts. `;
  pages.set(`${PREFIXE[j.lig]}/joueur/${slugUrl(j.nom)}/${j.id}/index.html`, page({
    titre: `${j.nom}${j.no != null ? ` · n° ${j.no}` : ""} · ${eq}`,
    description: `${POS[j.pos] || j.pos} · ${lig}. ${stats}Stats match par match et prochains matchs sur MonTrioHockey.`,
    cible: `joueur/${j.id}`,
  }));
}
for (const [k, e] of Object.entries(equipes)) {
  const c = classements[e.lig] || [];
  const t = c.find((x) => x.eq === k);
  const tri = [...c].sort((a, b) => b.pts - a.pts || a.pj - b.pj);
  const rang = t ? tri.indexOf(t) + 1 : null;
  pages.set(`${PREFIXE[e.lig]}/equipe/${slugUrl(e.nom)}/index.html`, page({
    titre: `${e.nom} · ${LIGUES[e.lig]}`,
    description: t ? `Fiche ${t.v}-${t.d}-${t.dp}, ${pl(t.pts, "point")}${rang ? `, ${rang === 1 ? "1er" : `${rang}e`} de la ligue` : ""}. Résultats, calendrier, meneurs et effectif sur MonTrioHockey.` : `Calendrier, meneurs et effectif sur MonTrioHockey.`,
    cible: `equipe/${k}`,
  }));
}
for (const m of cal) {
  if (!equipes[m.dom] || !equipes[m.ext] || !m.debut) continue;
  const lig = LIGUES[equipes[m.dom].lig];
  const fin = m.fin === "SO" ? " (tirs de barrage)" : m.fin === "OT" ? " (prolongation)" : "";
  const joue = m.etat === "fini";
  pages.set(`${PREFIXE[equipes[m.dom].lig]}/match/${slugUrl(equipes[m.ext].court || equipes[m.ext].nom)}-${slugUrl(equipes[m.dom].court || equipes[m.dom].nom)}-${String(m.date)}/${m.id}/index.html`, page({
    titre: joue ? `${abr(m.ext)} ${m.se} – ${m.sd} ${abr(m.dom)} · Final${fin}` : `${abr(m.ext)} @ ${abr(m.dom)} · ${dateFr(m.debut)}, ${heureFr(m.debut)}`,
    description: joue
      ? `${nomEq(m.ext)} contre ${nomEq(m.dom)}, ${dateFr(m.debut)} (${lig}). Le récit du match, les 3 étoiles, les marqueurs et la feuille de match sur MonTrioHockey.`
      : `${nomEq(m.ext)} contre ${nomEq(m.dom)} (${lig}). L'avant-match : face-à-face, forme récente et joueurs à surveiller sur MonTrioHockey.`,
    cible: `match/${m.id}`,
  }));
}

// ---- On écrit seulement ce qui a changé, et on retire les pages qui n'existent plus ----
let ecrites = 0, retirees = 0;
for (const vieux of ["j", "e", "m"]) await rm(vieux, { recursive: true, force: true }); // anciennes adresses
for (const pre of Object.values(PREFIXE)) {
  for (const type of ["joueur", "equipe", "match"]) {
    const dossier = `${pre}/${type}`;
    let fichiers = [];
    try { fichiers = await readdir(dossier, { recursive: true }); } catch { continue; }
    for (const f of fichiers) {
      if (!f.endsWith("index.html")) continue;
      const chemin = `${dossier}/${f}`;
      if (!pages.has(chemin)) { await unlink(chemin); retirees++; }
    }
  }
}
for (const [chemin, contenu] of pages) {
  if ((await readFile(chemin, "utf8").catch(() => null)) === contenu) continue;
  await mkdir(chemin.replace(/\/[^/]+$/, ""), { recursive: true });
  await writeFile(chemin, contenu); ecrites++;
}
console.log(`Liens de partage : ${pages.size} pages (${ecrites} mises à jour, ${retirees} retirées).`);
