// =============================================================
// LE ROBOT DES PHOTOS DE JOUEURS (LNH)
// Seulement des photos libres de droits, prises sur Wikimedia Commons
// (la banque d'images de Wikipédia) : licences CC BY, CC BY-SA, CC0 ou
// domaine public. Pour chaque joueur :
//   1. Wikidata donne sa catégorie Commons (grâce à son numéro LNH) ;
//   2. on garde la photo DATÉE la plus récente dont le nom contient le
//      nom du joueur (pour éviter les photos d'équipe ou d'autres joueurs).
// Résultat : data/photos.json, avec pour chaque photo son auteur, sa
// licence et sa date (affichés sous la photo, comme la licence l'exige).
// Chaque joueur est revérifié aux 14 jours (au plus 250 par passage).
// =============================================================

import { readFile, writeFile } from "node:fs/promises";

const FICHIER = "data/photos.json";
const UA = "MonTrioHockey/1.0 (https://wdaraiche84-del.github.io/hockey-favoris/; site de fan)";
const PAR_PASSAGE = 250, JOURS = 14;
const LICENCES = /^(CC BY(-SA)? \d(\.\d)?( [a-z]+)?|CC0( 1\.0)?|Public domain)$/i; // pas de « NC » ni de « ND »
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const lireJson = async (f, defaut) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return defaut; } };
const sansHtml = (t) => String(t || "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const simple = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const jourQc = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

async function lire(url, options = {}) {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(url, { ...options, headers: { "User-Agent": UA, Accept: "application/json", ...options.headers } });
      if (!r.ok) throw new Error(`erreur ${r.status}`);
      return await r.json();
    } catch (e) { if (i === 3) throw e; await pause(2000 * i); }
  }
}

// « 2023-03-12 19:33 » → « 2023-03-12 » ; « March 2019 » → « 2019 » ; rien de lisible → null
export function dateDe(brut) {
  const t = sansHtml(brut);
  const m = /\b((?:19|20)\d\d)(?:[-:/](\d\d)(?:[-:/](\d\d))?)?/.exec(t);
  if (!m || Number(m[1]) > new Date().getFullYear()) return null;
  return [m[1], m[2], m[3]].filter(Boolean).join("-");
}

// La meilleure photo parmi celles d'une catégorie : libre, datée, au nom du joueur, la plus récente
export function choisir(pages, nom) {
  const famille = simple(nom.split(" ").slice(1).join(" ") || nom);
  const bonnes = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0], md = ii?.extmetadata || {};
    if (!ii?.thumburl || ii.mime !== "image/jpeg") continue;
    const titre = p.title.replace(/^File:/, "");
    if (!simple(titre).includes(famille)) continue;
    if (/\b(and|vs\.?|team|teams|lineup|group)\b|&/i.test(titre)) continue; // photos de groupe
    const licence = sansHtml(md.LicenseShortName?.value);
    if (!LICENCES.test(licence)) continue;
    const d = dateDe(md.DateTimeOriginal?.value);
    if (!d) continue;
    bonnes.push({ u: ii.thumburl, f: ii.descriptionurl, a: sansHtml(md.Artist?.value).slice(0, 80) || "Auteur inconnu", l: licence, d });
  }
  return bonnes.sort((x, y) => y.d.localeCompare(x.d))[0] || null;
}

async function categorie(cat) {
  const p = new URLSearchParams({ action: "query", format: "json", formatversion: "2", generator: "categorymembers",
    gcmtitle: `Category:${cat}`, gcmtype: "file", gcmlimit: "200", prop: "imageinfo",
    iiprop: "url|mime|extmetadata", iiurlwidth: "330", iiextmetadatafilter: "DateTimeOriginal|LicenseShortName|Artist" });
  return (await lire(`https://commons.wikimedia.org/w/api.php?${p}`)).query?.pages || [];
}

if (process.argv[1]?.endsWith("maj-photos.mjs")) {
  const lnh = await lireJson("data/joueurs.json", { joueurs: [] });
  const etat = await lireJson(FICHIER, { vu: {}, photos: {} });
  const ids = new Set(lnh.joueurs.map((j) => String(j.id)));
  // Les joueurs partis de la LNH sont retirés
  for (const id of Object.keys(etat.photos)) if (!ids.has(id)) delete etat.photos[id];
  for (const id of Object.keys(etat.vu)) if (!ids.has(id)) delete etat.vu[id];

  const limite = new Date(Date.now() - JOURS * 864e5).toISOString().slice(0, 10);
  const aFaire = lnh.joueurs.filter((j) => !(etat.vu[j.id] >= limite)).slice(0, PAR_PASSAGE);
  if (!aFaire.length) { console.log("Photos : tout est à jour."); process.exit(0); }

  // 1. Wikidata : numéro LNH → catégorie Commons (une seule requête pour tout le groupe)
  const requete = `SELECT ?id ?cat WHERE { VALUES ?id { ${aFaire.map((j) => `"${j.id}"`).join(" ")} } ?p wdt:P3522 ?id ; wdt:P373 ?cat . }`;
  const res = await lire("https://query.wikidata.org/sparql", { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" },
    body: new URLSearchParams({ query: requete }) });
  const cats = new Map(res.results.bindings.map((b) => [b.id.value, b.cat.value]));

  // 2. Commons : la photo la plus récente de chaque joueur
  let trouvees = 0, erreurs = 0;
  for (const j of aFaire) {
    const cat = cats.get(String(j.id));
    try {
      const photo = cat ? choisir(await categorie(cat), j.nom) : null;
      if (photo) { etat.photos[j.id] = photo; trouvees++; } else delete etat.photos[j.id];
      etat.vu[j.id] = jourQc;
    } catch (e) { erreurs++; }
    if (cat) await pause(300); // poli envers Wikimedia
  }
  await writeFile(FICHIER, JSON.stringify(etat) + "\n");
  console.log(`Photos : ${aFaire.length} joueurs vérifiés (${cats.size} avec une catégorie Commons), ${trouvees} photos, ${erreurs} erreurs. Total : ${Object.keys(etat.photos).length} photos.`);
  if (erreurs > aFaire.length / 2) process.exit(1);
}
