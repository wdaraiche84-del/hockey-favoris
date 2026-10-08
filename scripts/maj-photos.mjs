// =============================================================
// LE ROBOT DES PHOTOS DE JOUEURS (LNH)
// Seulement des photos libres de droits, prises sur Wikimedia Commons
// (la banque d'images de Wikipédia) : licences CC BY, CC BY-SA, CC0 ou
// domaine public. Pour chaque joueur :
//   1. Wikidata donne sa catégorie Commons et sa photo principale (celle
//      choisie par Wikipédia), grâce à son numéro LNH ;
//   2. on garde la photo DATÉE la plus récente parmi sa photo principale
//      et les photos de sa catégorie dont le titre contient son nom complet,
//      sans le nom d'un autre joueur ni un objet (gants, bâton, chandail…).
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

// La meilleure photo : libre, datée, la plus récente. La photo principale (choisie par Wikipédia)
// est acceptée telle quelle ; les autres doivent montrer ce joueur seul, et pas un objet.
export function choisir(pages, nom, { principale = "", autres = [] } = {}) {
  const complet = simple(nom);
  const bonnes = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0], md = ii?.extmetadata || {};
    if (!ii?.thumburl || ii.mime !== "image/jpeg") continue;
    const titre = p.title.replace(/^File:/, ""), t = simple(titre), mots = titre.replace(/[_-]/g, " ");
    // Jamais : bagarres (règle du site), mises en échec, objets (gants, bâton, chandail…)
    if (/\b(fights?|fighting|brawl|bagarre|checking|checks|hit|hits|gloves?|sticks?|jersey|sweater|helmet|mask|skates?|autograph|signature|card|banner|statue|mural)\b/i.test(mots)) continue;
    if (titre !== principale) {
      if (!t.includes(complet)) continue;
      if (/\b(and|with|vs\.?|team|teams|lineup|group)\b|&/i.test(mots)) continue; // photos de groupe
      if (autres.some((a) => a !== complet && t.includes(a))) continue; // un autre joueur est nommé
    }
    const licence = sansHtml(md.LicenseShortName?.value);
    if (!LICENCES.test(licence)) continue;
    const d = dateDe(md.DateTimeOriginal?.value);
    if (!d) continue;
    bonnes.push({ u: ii.thumburl.split("?")[0], f: ii.descriptionurl, a: sansHtml(md.Artist?.value).slice(0, 80) || "Auteur inconnu", l: licence, d });
  }
  return bonnes.sort((x, y) => y.d.localeCompare(x.d))[0] || null;
}

async function fichiers(titres) {
  const p = new URLSearchParams({ action: "query", format: "json", formatversion: "2", titles: titres.join("|"), prop: "imageinfo",
    iiprop: "url|mime|extmetadata", iiurlwidth: "330", iiextmetadatafilter: "DateTimeOriginal|LicenseShortName|Artist" });
  return (await lire(`https://commons.wikimedia.org/w/api.php?${p}`)).query?.pages || [];
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
  const requete = `SELECT ?id ?cat ?img WHERE { VALUES ?id { ${aFaire.map((j) => `"${j.id}"`).join(" ")} } ?p wdt:P3522 ?id . OPTIONAL { ?p wdt:P373 ?cat } OPTIONAL { ?p wdt:P18 ?img } }`;
  const res = await lire("https://query.wikidata.org/sparql", { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json" },
    body: new URLSearchParams({ query: requete }) });
  const cats = new Map(), principales = new Map();
  for (const b of res.results.bindings) {
    if (b.cat) cats.set(b.id.value, b.cat.value);
    if (b.img) principales.set(b.id.value, decodeURIComponent(b.img.value.split("/").pop()).replace(/_/g, " "));
  }
  const autres = lnh.joueurs.map((j) => simple(j.nom));

  // 2. Commons : la photo la plus récente de chaque joueur
  let trouvees = 0, erreurs = 0;
  for (const j of aFaire) {
    const cat = cats.get(String(j.id)), principale = principales.get(String(j.id));
    try {
      const pages = [...(cat ? await categorie(cat) : []), ...(principale ? await fichiers([`File:${principale}`]) : [])];
      const photo = choisir(pages, j.nom, { principale, autres });
      if (photo) { etat.photos[j.id] = photo; trouvees++; } else delete etat.photos[j.id];
      etat.vu[j.id] = jourQc;
    } catch (e) { erreurs++; }
    if (cat || principale) await pause(300); // poli envers Wikimedia
  }
  await writeFile(FICHIER, JSON.stringify(etat) + "\n");
  console.log(`Photos : ${aFaire.length} joueurs vérifiés (${cats.size} avec une catégorie Commons, ${principales.size} avec une photo principale), ${trouvees} photos, ${erreurs} erreurs. Total : ${Object.keys(etat.photos).length} photos.`);
  if (erreurs > aFaire.length / 2) process.exit(1);
}
