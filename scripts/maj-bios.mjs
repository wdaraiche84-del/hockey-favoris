// =============================================================
// LE ROBOT DES FICHES COMPLÈTES (LNH)
// Une fois par jour, il va chercher pour chaque joueur de la LNH :
//   · sa bio : naissance, taille, poids, lance de la gauche ou de la droite
//   · son repêchage : année, ronde, rang, équipe
//   · sa carrière : toutes ses saisons, dans toutes les ligues (junior, LAH, Europe…)
//   · ses trophées
// Résultat : data/carriere/ID.json (un petit fichier par joueur,
// lu seulement quand on ouvre sa fiche).
// Les nouveaux joueurs (sans fichier) sont traités à chaque passage.
// =============================================================

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";

const API = "https://api-web.nhle.com/v1";
const DOSSIER = "data/carriere";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const texte = (v) => (v && typeof v === "object" ? v.fr || v.default : v) || "";
const lireJson = async (f) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return null; } };
async function lire(chemin) {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(API + chemin, { headers: { "User-Agent": "MonTrioHockey (site de fan)" } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`erreur ${r.status}`);
      return await r.json();
    } catch (e) { if (i === 3) throw e; await pause(1500 * i); }
  }
}
const saisonFr = (s) => { const t = String(s); return `${t.slice(0, 4)}-${t.slice(6, 8)}`; };
const jourQc = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());

const lnh = await lireJson("data/joueurs.json");
if (!lnh) { console.log("Pas de joueurs LNH."); process.exit(0); }
await mkdir(DOSSIER, { recursive: true });
const existants = new Set((await readdir(DOSSIER)).map((f) => f.replace(/\.json$/, "")));
const dernier = (await readFile(`${DOSSIER}/_jour.txt`, "utf8").catch(() => "")).trim();
const tous = dernier !== jourQc; // une fois par jour : tout le monde ; sinon seulement les nouveaux
const aFaire = lnh.joueurs.filter((j) => tous || !existants.has(j.id));
let ecrits = 0, erreurs = 0;

for (const j of aFaire) {
  try {
    const p = await lire(`/player/${j.id}/landing`);
    if (!p) continue;
    const d = p.draftDetails;
    const fiche = {
      bio: {
        naissance: p.birthDate || null, ville: texte(p.birthCity) || null, prov: texte(p.birthStateProvince) || null, pays: p.birthCountry || null,
        taille: p.heightInCentimeters || null, poids: p.weightInKilograms || null, tir: p.shootsCatches || null,
      },
      rep: d ? { annee: d.year, eq: d.teamAbbrev, ronde: d.round, rang: d.overallPick } : null,
      // [saison, ligue, équipe, type (s = saison, e = séries), PJ, B, A, PTS, +/-, PUN]
      // gardien : [saison, ligue, équipe, type, PJ, V, D, DP, moyenne, % arrêts, blanchissages]
      saisons: (p.seasonTotals || []).map((s) => {
        const base = [saisonFr(s.season), s.leagueAbbrev || "", texte(s.teamName), s.gameTypeId === 3 ? "e" : "s", s.gamesPlayed ?? 0];
        return j.pos === "G"
          ? [...base, s.wins ?? 0, s.losses ?? 0, s.otLosses ?? s.ties ?? 0, s.goalsAgainstAvg != null ? +s.goalsAgainstAvg.toFixed(2) : null, s.savePctg != null ? +s.savePctg.toFixed(3) : null, s.shutouts ?? 0]
          : [...base, s.goals ?? 0, s.assists ?? 0, s.points ?? 0, s.plusMinus ?? null, s.pim ?? 0];
      }),
      trophees: (p.awards || []).map((a) => ({ nom: texte(a.trophy), saisons: (a.seasons || []).map((x) => saisonFr(x.seasonId)) })),
    };
    const f = `${DOSSIER}/${j.id}.json`, nouveau = JSON.stringify(fiche);
    if ((await readFile(f, "utf8").catch(() => null)) !== nouveau) { await writeFile(f, nouveau); ecrits++; }
    await pause(120);
  } catch (e) { erreurs++; console.warn(j.id, e.message); }
}
if (tous && erreurs < aFaire.length / 2) await writeFile(`${DOSSIER}/_jour.txt`, jourQc);
console.log(`Fiches complètes : ${aFaire.length} joueurs lus, ${ecrits} fichiers mis à jour, ${erreurs} erreurs.`);
