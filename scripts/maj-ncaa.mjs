// =============================================================
// LE ROBOT DE LA NCAA (hockey universitaire masculin, Division 1)
// Source : College Hockey News (collegehockeynews.com), qui publie
// le calendrier, les feuilles de match, les stats et le classement
// de toutes les équipes (pages ouvertes aux robots, voir robots.txt).
// Même format que les autres ligues : data/ligues/ncaa/
//
// Pour ménager le site source :
//  - à chaque passage : 3 pages (équipes, calendrier, classement)
//    + les feuilles des matchs qui viennent de se terminer ;
//  - les stats et l'alignement d'une équipe sont relus seulement
//    quand elle vient de jouer (ou une fois par semaine).
// =============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SOURCE = "https://www.collegehockeynews.com";
const DOSSIER = "data/ligues/ncaa";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function page(chemin, essais = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(SOURCE + chemin, { headers: { "User-Agent": "Mozilla/5.0 (MonTrio, site de fan)" } });
      if (!r.ok) throw new Error(`erreur ${r.status}`);
      const t = await r.text();
      await pause(700); // une page à la fois, sans presse
      return propre(t);
    } catch (e) {
      if (i >= essais) throw new Error(`${chemin} → ${e.message}`);
      await pause(2000 * i);
    }
  }
}
// HTML sur une ligne, sans scripts ni images
const propre = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>|<img[^>]*>|<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").replace(/> </g, "><");
const texte = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#8209;/g, "-").replace(/&amp;/g, "&").replace(/&#039;|&apos;/g, "'").replace(/\s+/g, " ").trim();
// Cellules d'une rangée (avec leur balise d'ouverture, pour lire les « data-text »)
const cellules = (ligne) => [...ligne.matchAll(/<t[dh][\s>][\s\S]*?(?=<t[dh][\s>]|<\/tr>|$)/g)].map((m) => m[0]);
const num = (x) => { const n = Number(texte(x)); return Number.isFinite(n) ? n : 0; };
const sansAccent = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const cleNom = (s) => sansAccent(texte(s)).toLowerCase().replace(/[^a-z]/g, "");
async function ecrireSiChange(f, contenu) {
  const nouveau = JSON.stringify(contenu);
  if ((await readFile(f, "utf8").catch(() => null)) === nouveau) return false;
  await writeFile(f, nouveau); return true;
}
async function lireJson(f, defaut) { try { return JSON.parse(await readFile(f, "utf8")); } catch { return defaut; } }

// Abréviations usuelles (identifiant de l'équipe chez College Hockey News → abréviation)
const ABR = {
  1: "AFA", 6: "ARMY", 8: "BEN", 13: "CAN", 23: "HC", 39: "NIA", 49: "RIT", 50: "RMU", 51: "SHU",
  31: "MICH", 32: "MSU", 34: "MINN", 43: "ND", 44: "OSU", 60: "PSU", 58: "WIS",
  64: "AUG", 7: "BSU", 11: "BGSU", 21: "FSU", 24: "LSSU", 33: "MTU", 35: "MNSU", 42: "NMU",
  12: "BRN", 14: "CLK", 15: "COLG", 18: "COR", 19: "DAR", 22: "HARV", 45: "PRIN", 47: "QU", 48: "RPI", 53: "SLU", 54: "UNI", 59: "YALE",
  9: "BC", 10: "BU", 17: "UCONN", 25: "MAINE", 26: "UML", 27: "UMASS", 29: "MER", 38: "UNH", 41: "NU", 46: "PROV", 55: "UVM",
  61: "ASU", 16: "CC", 20: "DU", 30: "MIA", 36: "UMD", 37: "OMA", 40: "UND", 52: "SCSU", 63: "UST", 57: "WMU",
  3: "UAA", 4: "UAF", 433: "LIN", 62: "LIU", 66: "MARY", 422: "STO",
};
// Fuseau de l'heure affichée par la source (heure locale de l'aréna)
const FUSEAUX = { ET: "America/New_York", CT: "America/Chicago", MT: "America/Denver", PT: "America/Los_Angeles", AT: "America/Anchorage", AK: "America/Anchorage" };
const MOIS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
// Heure locale d'un fuseau → moment exact (ISO)
function versIso(date, h, min, fuseau) {
  const essai = new Date(`${date}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`);
  const vu = new Date(essai.toLocaleString("en-US", { timeZone: fuseau }));
  const ecart = vu.getTime() - new Date(essai.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(essai.getTime() - ecart).toISOString();
}
const saisonEnCours = () => { const d = new Date(), an = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; return [an, an + 1]; };

// ---- 1. Les équipes et leur association (conférence) -----------
async function lireEquipes() {
  const h = await page("/reports/team/");
  const equipes = {}, parId = {};
  let conf = null;
  for (const m of h.matchAll(/<tr class="stats-section"><td colspan="\d+">(.*?)<\/td><\/tr>|<tr><td>([^<]+)<\/td><td><a href="\/reports\/team\/([^/"]+)\/(\d+)">/g)) {
    if (m[1]) { conf = texte(m[1]).replace(/^Independents?$/, "Indépendants"); continue; }
    const id = Number(m[4]), abr = ABR[id] || texte(m[2]).replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase();
    const cle = `ncaa_${abr}`, nom = texte(m[2]);
    equipes[cle] = { abr, nom, court: nom, div: conf, conf };
    parId[id] = { cle, slug: m[3], id };
  }
  return { equipes, parId };
}

// ---- 2. Le calendrier de toute la saison ------------------------
function lireCalendrier(h, parId) {
  const debutListe = h.indexOf('data-display="list"');
  const liste = debutListe >= 0 ? h.slice(debutListe) : h;
  const matchs = [];
  let date = null, groupe = "";
  for (const m of liste.matchAll(/<tr class="stats-section"><td colspan="99">(.*?)<\/td><\/tr>|<tr class="sked-header"><td colspan="99">(.*?)<\/td><\/tr>|<tr valign="top">([\s\S]*?)<\/tr>/g)) {
    if (m[1]) { const d = /(\w+) (\d+), (\d{4})/.exec(texte(m[1])); if (d && MOIS[d[1]]) date = `${d[3]}-${String(MOIS[d[1]]).padStart(2, "0")}-${String(d[2]).padStart(2, "0")}`; continue; }
    if (m[2]) { groupe = texte(m[2]); continue; }
    if (!date || /Exhibition/i.test(groupe)) continue;
    const c = cellules(m[3]);
    const idEq = (x) => Number((/\/reports\/team\/[^/]+\/(\d+)/.exec(x) || [])[1]);
    const ext = parId[idEq(c[0])], dom = parId[idEq(c[3])];
    if (!ext || !dom) continue; // match contre une équipe hors Division 1
    const se = texte(c[1]), sd = texte(c[4]);
    const statut = texte(c[6]);
    const box = (/href="(\/box\/final\/[^"]+)"/.exec(m[3]) || [])[1] || null;
    const noMatch = (/(?:gd|gid)=(\d+)/.exec(m[3]) || [])[1];
    const id = noMatch ? `ncaa-${noMatch}` : `ncaa-${date.replace(/-/g, "")}-${ABR[ext.id] || ext.id}-${ABR[dom.id] || dom.id}`;
    // Heure : « 7:05 ET » ; les matchs terminés n'en ont plus (on garde celle d'avant si on l'a)
    const hm = /(\d{1,2}):(\d{2})\s*(ET|CT|MT|PT|AT|AK|Local)?/.exec(statut);
    let debut = null;
    if (hm) {
      let h24 = Number(hm[1]) % 12 + 12; // les matchs de hockey universitaire sont l'après-midi ou le soir
      if (Number(hm[1]) >= 10 && Number(hm[1]) < 12 && /AM/i.test(statut)) h24 = Number(hm[1]);
      const fuseau = dom.id === 61 && hm[3] === "MT" ? "America/Phoenix" : FUSEAUX[hm[3]] || "America/New_York";
      debut = versIso(date, h24, Number(hm[2]), fuseau);
    }
    const conf = /Non-Conference|Tournament|\(at /i.test(groupe) ? null : groupe;
    const x = { id, date, debut, dom: dom.cle, ext: ext.cle, box, conf, neutre: /\bvs\.?\b/.test(texte(c[2])) };
    if (sd !== "" && se !== "") { x.sd = Number(sd); x.se = Number(se); }
    matchs.push(x);
  }
  return matchs;
}

// ---- 3. Le classement par association ---------------------------
function lireClassement(h, parId, serieDe, butsConf) {
  const classement = [];
  for (const t of h.split("<table").slice(1)) {
    const conf = texte((/<td colspan="99">(.*?)<\/td>/.exec(t) || [])[1]).replace(/^Independents?$/, "Indépendants");
    if (!conf) continue;
    // Nombre de colonnes « Association » : 7 (PJ, PTS, %, VR, DR, VP, DP) ou 6 chez les indépendants (PJ, PTS, %, V, D, N)
    const nConf = Number((/<th colspan="(\d+)" class="center">Conference/.exec(t) || [])[1]) || 7;
    for (const ligne of t.split("<tr>").slice(1)) {
      const idEq = Number((/\/schedules\/team\/[^/]+\/(\d+)/.exec(ligne) || [])[1]);
      const eq = parId[idEq];
      if (!eq) continue;
      const c = cellules(ligne);
      // Global : PJ, V, D, N, | VR, DR, VP, DP, BP, BC
      const g = c.slice(3 + nConf).map(num);
      const [gpj, gv, gd, gn] = g, [bpG, bcG] = [g[9], g[10]];
      const serie = serieDe(eq.cle);
      if (nConf < 7) { // indépendants : pas de classement d'association, on montre la fiche globale
        classement.push({ eq: eq.cle, pj: gpj, v: gv, d: gd, dp: 0, n: gn, pts: gv * 2 + gn, bp: bpG, bc: bcG, div: conf, conf, serie });
        continue;
      }
      const [pj, pts, , rw, rl, ow, ol] = c.slice(2, 9).map(num);
      const b = butsConf[eq.cle] || { bp: 0, bc: 0 };
      classement.push({ eq: eq.cle, pj, v: rw + ow, d: rl, dp: ol, pts, bp: b.bp, bc: b.bc, div: conf, conf, serie, fiche: `${gv}-${gd}-${gn}` });
    }
  }
  return classement;
}

// ---- 4. Joueurs : alignement (bio) et stats de la saison --------
function lireAlignement(h) {
  const bios = {};
  for (const ligne of h.split("<tr>").slice(1)) {
    const id = (/\/players\/career\/[^/]+\/(\d+)/.exec(ligne) || [])[1];
    if (!id) continue;
    const c = cellules(ligne);
    const pos = (/data-text="([DFG])"/.exec(ligne) || [])[1];
    const pouces = Number((/data-text="(\d{2})"/.exec(c[5] || "") || [])[1]); // taille en pouces
    const lb = num(c[6]);
    const naissance = (/data-text="(\d{4}-\d{2}-\d{2})"/.exec(c[7] || "") || [])[1] || null;
    const ville = texte(c[8]);
    const rep = /^(\d{4})-([A-Z]{2,3})-(\d+)$/.exec(texte(c[10])); // repêchage LNH, ex. « 2025-EDM-5 » (année, équipe, ronde)
    const [nomFamille, prenom] = texte(c[2]).split(",").map((x) => x.trim());
    bios[id] = { nom: prenom ? `${prenom} ${nomFamille}` : nomFamille, no: num(c[1]) || null, pos: pos === "F" ? "AV" : pos || null,
      bio: { naissance, taille: pouces ? Math.round(pouces * 2.54) : null, poids: lb ? Math.round(lb * 0.4536) : null, ville: ville || null },
      rep: rep ? { annee: Number(rep[1]), eq: rep[2], ronde: Number(rep[3]) } : null };
  }
  return bios;
}
function lireStatsEquipe(h, cle, bios) {
  const joueurs = [];
  const [pat = "", gar = ""] = [(/<table[^>]*id="skaters"[\s\S]*?<\/table>/.exec(h) || [])[0], (/<table[^>]*id="goalies"[\s\S]*?<\/table>/.exec(h) || [])[0]];
  const base = (ligne) => {
    const id = (/\/players\/career\/[^/]+\/(\d+)/.exec(ligne) || [])[1];
    if (!id) return null;
    const nom = texte((/<a [^>]*>(.*?)<\/a>/.exec(ligne) || [])[1]);
    const b = bios[id] || {};
    const j = { id: `ncaa-${id}`, nom, no: b.no ?? null, pos: b.pos || null, eq: cle };
    if (b.bio && (b.bio.naissance || b.bio.taille)) j.bio = b.bio;
    if (b.rep) j.rep = b.rep;
    return j;
  };
  for (const ligne of pat.split("<tr>").slice(1)) {
    const j = base(ligne); if (!j) continue;
    const c = cellules(ligne);
    // Nom, PJ, B, A, Pts, Pts/PJ, Tirs, %, PUN, BG, BAN, BIN, +/-, TG/PJ
    if (!j.pos) j.pos = (/,\s*(F|D)\s*,/.exec(texte(c[0])) || [])[1] === "D" ? "D" : "AV";
    if (j.pos === "G") continue;
    const tg = Number((/data-text="([\d.]+)"/.exec(c[13] || "") || [])[1]);
    j.s = { pj: num(c[1]), b: num(c[2]), a: num(c[3]), pts: num(c[4]), pm: num(c[12]), tirs: num(c[6]), pun: num(c[8]) };
    if (tg) j.s.tg = Math.round(tg);
    joueurs.push(j);
  }
  for (const ligne of gar.split("<tr>").slice(1)) {
    const j = base(ligne); if (!j) continue;
    const c = cellules(ligne);
    // Nom, PJ, V, D, N, BC, MIN, MOY, BL, ARR, %
    j.pos = "G";
    const arr = num(c[9]), bc = num(c[5]);
    j.g = { pj: num(c[1]), v: num(c[2]), d: num(c[3]), dp: num(c[4]), moy: num(c[7]), pct: arr + bc ? +(arr / (arr + bc)).toFixed(3) : null, bl: num(c[8]), arr, tr: arr + bc };
    joueurs.push(j);
  }
  // Joueurs de l'alignement qui n'ont pas encore joué
  const vus = new Set(joueurs.map((j) => j.id));
  for (const [id, b] of Object.entries(bios)) {
    if (vus.has(`ncaa-${id}`) || !b.nom || !b.pos) continue;
    const j = { id: `ncaa-${id}`, nom: b.nom, no: b.no ?? null, pos: b.pos, eq: cle };
    if (b.bio && (b.bio.naissance || b.bio.taille)) j.bio = b.bio;
    if (b.rep) j.rep = b.rep;
    if (b.pos === "G") j.g = { pj: 0, v: 0, d: 0, dp: 0, moy: 0, pct: null };
    else j.s = { pj: 0, b: 0, a: 0, pts: 0, pm: 0 };
    joueurs.push(j);
  }
  return joueurs;
}

// ---- 5. Feuille de match → points match par match ---------------
//    Patineur [B, A, +/-, tirs, PUN, TG] ; gardien ["G", arrêts, tirs, BC, décision, TG]
function lireFeuille(h, m, idsParNom) {
  const res = { lignes: {}, fin: null };
  // Prolongation ou tirs de barrage : colonnes en plus dans le tableau des buts par période
  const entete = (/<div id="goals">[\s\S]*?<\/thead>/.exec(h) || [""])[0];
  const periodes = [...entete.matchAll(/<td class="center">([^<]*)<\/td>/g)].map((x) => texte(x[1]));
  if (periodes.some((p) => /SO/i.test(p))) res.fin = "SO";
  else if (periodes.some((p) => /OT/i.test(p) || /^[4-9]$/.test(p))) res.fin = "OT";
  // Gardiens : une section par équipe (équipe en tête de colonne)
  const gardiens = {};
  const blocG = (/<div id="goalies">([\s\S]*?)<\/table>/.exec(h) || [])[1] || "";
  for (const sec of blocG.split("<thead>").slice(1)) {
    const equipe = texte((/<td>(.*?)<\/td>/.exec(sec) || [])[1]);
    for (const ligne of sec.split("<tr>").slice(1)) {
      const c = cellules(ligne);
      const nom = texte(c[0]);
      if (!nom || /EMPTY NET/i.test(nom)) continue;
      (gardiens[equipe] = gardiens[equipe] || []).push({ nom, arr: num(c[1]), bc: num(c[2]), temps: texte(c[3]) });
    }
  }
  // Sommaires des joueurs : un tableau par équipe
  for (const t of h.split('<div class="playersum">').slice(1)) {
    const equipe = texte((/<td>(.*?)<\/td>/.exec(t) || [])[1]);
    const cle = equipe && [m.dom, m.ext].find((k) => cleNom(m.noms[k]) === cleNom(equipe));
    if (!cle) continue;
    const ids = idsParNom[cle] || {};
    const nomsGardiens = new Set((gardiens[equipe] || []).map((g) => cleNom(g.nom)));
    const ligne = {};
    for (const tr of t.split("<tr").slice(2)) {
      const c = cellules(tr);
      const nom = texte(c[0]);
      const id = ids[cleNom(nom)];
      if (!id || nomsGardiens.has(cleNom(nom))) continue;
      // Nom, B, A, Pts, +/-, Tirs, TG, PUN
      ligne[id] = [num(c[1]), num(c[2]), num(c[4]), num(c[5]), num(c[7]), texte(c[6])];
    }
    const nous = cle === m.dom ? m.sd : m.se, eux = cle === m.dom ? m.se : m.sd;
    const gs = gardiens[equipe] || [];
    const principal = [...gs].sort((a, b) => enSec(b.temps) - enSec(a.temps))[0];
    for (const g of gs) {
      const id = ids[cleNom(g.nom)];
      if (!id) continue;
      const dec = g !== principal ? "" : nous > eux ? "W" : nous < eux ? (res.fin ? "O" : "L") : "";
      ligne[id] = ["G", g.arr, g.arr + g.bc, g.bc, dec, g.temps];
    }
    res.lignes[cle] = ligne;
  }
  return res;
}
const enSec = (t) => { const [a, b] = String(t || "").split(":").map(Number); return (a || 0) * 60 + (b || 0); };

// Séquence en cours (ex. « W3 ») à partir des matchs terminés
function series(calendrier) {
  const suites = {};
  for (const m of calendrier) if (m.etat === "fini" && m.sd !== m.se) {
    (suites[m.dom] = suites[m.dom] || []).push(m.sd > m.se ? "W" : "L");
    (suites[m.ext] = suites[m.ext] || []).push(m.se > m.sd ? "W" : "L");
  }
  return (eq) => { const s = suites[eq] || [], d = s[s.length - 1]; let n = 0; for (let i = s.length - 1; i >= 0 && s[i] === d; i--) n++; return d ? `${d}${n}` : ""; };
}

// ---- Le passage du robot -----------------------------------------
// (seulement quand le fichier est lancé directement ; les tests peuvent importer les fonctions)
export { lireEquipes, lireCalendrier, lireClassement, lireAlignement, lireStatsEquipe, lireFeuille, propre };
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [an1, an2] = saisonEnCours();
  const saison = `${an1}-${String(an2).slice(2)}`;
  await mkdir(`${DOSSIER}/points`, { recursive: true });
  const { equipes, parId } = await lireEquipes();
  const nomDe = Object.fromEntries(Object.entries(equipes).map(([k, e]) => [k, e.nom]));
  const bruts = lireCalendrier(await page(`/schedules/season/${an1}-${String(an2).slice(2)}`), parId);

  // État gardé d'un passage à l'autre : feuilles déjà lues, heure des matchs, dernière lecture des équipes
  const etat = await lireJson(`${DOSSIER}/etat.json`, { traites: [], heures: {}, equipesLues: {} });
  const traites = new Set(etat.traites);
  const ancien = await lireJson(`${DOSSIER}/infos.json`, { joueurs: [] });
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const calendrier = bruts.map((x) => {
    if (x.debut) etat.heures[x.id] = x.debut;
    const debut = x.debut || etat.heures[x.id] || versIso(x.date, 19, 0, "America/New_York");
    const score = x.sd != null;
    const etatM = score && (x.box || x.date < aujourdhui) ? "fini" : score ? "direct" : "avenir";
    const m = { id: x.id, date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date(debut)), debut, dom: x.dom, ext: x.ext, etat: etatM };
    if (score) { m.sd = x.sd; m.se = x.se; }
    return { m, x };
  });
  calendrier.sort((a, b) => a.m.debut.localeCompare(b.m.debut));

  // Feuilles de match : seulement celles qu'on n'a pas encore lues
  const points = {};
  for (const cle of Object.keys(equipes)) points[cle] = traites.size ? await lireJson(`${DOSSIER}/points/${cle}.json`, {}) : {};
  const aRelire = new Set(); // équipes qui viennent de jouer
  const nouvelles = calendrier.filter(({ m, x }) => m.etat === "fini" && x.box && !traites.has(m.id));
  for (const { x } of nouvelles) { aRelire.add(x.dom); aRelire.add(x.ext); }

  // Stats et alignements : équipes qui viennent de jouer, ou pas relues depuis 7 jours
  const ilYa7Jours = new Date(Date.now() - 7 * 864e5).toISOString();
  for (const [cle] of Object.entries(equipes)) if (!etat.equipesLues[cle] || etat.equipesLues[cle] < ilYa7Jours || !ancien.joueurs.some((j) => j.eq === cle)) aRelire.add(cle);
  const joueursParEquipe = {};
  for (const j of ancien.joueurs || []) (joueursParEquipe[j.eq] = joueursParEquipe[j.eq] || []).push(j);
  let lues = 0;
  for (const { cle, slug, id } of Object.values(parId)) {
    if (!aRelire.has(cle)) continue;
    try {
      const bios = lireAlignement(await page(`/reports/roster/${slug}/${id}`));
      joueursParEquipe[cle] = lireStatsEquipe(await page(`/stats/team/${slug}/${id}`), cle, bios);
      etat.equipesLues[cle] = new Date().toISOString();
      lues++;
    } catch (e) { console.warn("NCAA équipe", slug, e.message); }
  }
  const joueurs = Object.values(joueursParEquipe).flat();

  // Noms → identifiants, par équipe (pour les feuilles de match, qui n'ont que les noms)
  const idsParNom = {};
  for (const j of joueurs) (idsParNom[j.eq] = idsParNom[j.eq] || {})[cleNom(j.nom)] = j.id;
  let feuilles = 0;
  for (const { m, x } of nouvelles) {
    try {
      const f = lireFeuille(await page(x.box), { ...m, noms: nomDe }, idsParNom);
      if (f.fin) m.fin = f.fin;
      for (const [cle, ligne] of Object.entries(f.lignes)) if (Object.keys(ligne).length) points[cle][m.id] = ligne;
      etat.fins = etat.fins || {};
      if (f.fin) etat.fins[m.id] = f.fin;
      traites.add(m.id);
      feuilles++;
    } catch (e) { console.warn("NCAA feuille", x.box, e.message); }
  }
  for (const { m } of calendrier) if (!m.fin && etat.fins?.[m.id]) m.fin = etat.fins[m.id];

  // Classement (buts pour et contre : matchs d'association seulement)
  const cal = calendrier.map(({ m }) => m);
  const butsConf = {};
  for (const { m, x } of calendrier) if (x.conf && m.etat === "fini") for (const [eq, bp, bc] of [[m.dom, m.sd, m.se], [m.ext, m.se, m.sd]]) {
    const b = (butsConf[eq] = butsConf[eq] || { bp: 0, bc: 0 }); b.bp += bp; b.bc += bc;
  }
  const classement = lireClassement(await page("/reports/standings.php"), parId, series(cal), butsConf);

  // Écriture
  etat.traites = [...traites].sort();
  const ids = new Set(cal.map((m) => m.id));
  for (const k of Object.keys(etat.heures)) if (!ids.has(k)) delete etat.heures[k];
  await ecrireSiChange(`${DOSSIER}/etat.json`, etat);
  let change = await ecrireSiChange(`${DOSSIER}/calendrier.json`, cal);
  for (const cle of Object.keys(equipes)) change = (await ecrireSiChange(`${DOSSIER}/points/${cle}.json`, points[cle] || {})) || change;
  const contenu = { saison, equipes, joueurs, classement, source: "College Hockey News" };
  if (change || JSON.stringify({ ...ancien, misAJour: undefined }) !== JSON.stringify({ ...contenu, misAJour: undefined })) {
    await writeFile(`${DOSSIER}/infos.json`, JSON.stringify({ misAJour: new Date().toISOString(), ...contenu }));
  }
  console.log(`NCAA : ${Object.keys(equipes).length} équipes, ${joueurs.length} joueurs, ${cal.length} matchs, ${feuilles} feuilles lues, ${lues} équipes relues.`);
}
