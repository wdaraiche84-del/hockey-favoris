// =============================================================
// LE ROBOT DES STATS (toute la LNH)
// Ce programme est lancé automatiquement par GitHub (voir
// .github/workflows/maj-donnees.yml). Il va chercher les données
// des 32 équipes auprès du service de statistiques de la LNH,
// puis les range dans le dossier data/ :
//   data/joueurs.json     tous les joueurs et leurs stats de la saison
//   data/calendrier.json  tous les matchs de la saison
//   data/points/XXX.json  les buts et passes de chaque joueur, match par match
//   data/classement.json  le classement de la ligue
//   data/traites.json     (interne) les matchs déjà traités
// =============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";

const API = "https://api-web.nhle.com/v1";

const EQUIPES = {
  ANA: "Ducks d'Anaheim", BOS: "Bruins de Boston", BUF: "Sabres de Buffalo", CAR: "Hurricanes de la Caroline",
  CBJ: "Blue Jackets de Columbus", CGY: "Flames de Calgary", CHI: "Blackhawks de Chicago", COL: "Avalanche du Colorado",
  DAL: "Stars de Dallas", DET: "Red Wings de Detroit", EDM: "Oilers d'Edmonton", FLA: "Panthers de la Floride",
  LAK: "Kings de Los Angeles", MIN: "Wild du Minnesota", MTL: "Canadiens de Montréal", NJD: "Devils du New Jersey",
  NSH: "Predators de Nashville", NYI: "Islanders de New York", NYR: "Rangers de New York", OTT: "Sénateurs d'Ottawa",
  PHI: "Flyers de Philadelphie", PIT: "Penguins de Pittsburgh", SEA: "Kraken de Seattle", SJS: "Sharks de San Jose",
  STL: "Blues de St. Louis", TBL: "Lightning de Tampa Bay", TOR: "Maple Leafs de Toronto", UTA: "Mammoth de l'Utah",
  VAN: "Canucks de Vancouver", VGK: "Golden Knights de Vegas", WPG: "Jets de Winnipeg", WSH: "Capitals de Washington",
};
const POSITIONS = { C: "C", L: "AG", R: "AD", D: "D", G: "G" };

// ---- Outils -------------------------------------------------
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function lire(chemin, essais = 3) {
  for (let i = 1; ; i++) {
    try {
      const rep = await fetch(API + chemin, { headers: { "User-Agent": "hockey-favoris (site de fan)" } });
      if (!rep.ok) throw new Error(`erreur ${rep.status}`);
      await pause(120); // on ne bombarde pas le service
      return await rep.json();
    } catch (e) {
      if (i >= essais) throw new Error(`${chemin} → ${e.message}`);
      await pause(1500 * i);
    }
  }
}
const texte = (v) => (v && typeof v === "object" ? v.default : v) || "";
async function lireJson(f, defaut) {
  try { return JSON.parse(await readFile(f, "utf8")); } catch { return defaut; }
}
function saisonActuelle() {
  const d = new Date();
  const debut = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${debut}${debut + 1}`;
}

// ---- Programme principal ------------------------------------
async function principal() {
  const saison = saisonActuelle();
  const joueurs = [];
  const parId = new Map();
  const matchs = new Map();

  for (const eq of Object.keys(EQUIPES)) {
    // 1. Effectif
    const roster = await lire(`/roster/${eq}/current`);
    // 2. Stats de la saison
    let stats = {};
    try { stats = await lire(`/club-stats/${eq}/now`); } catch (e) { console.warn(eq, "stats :", e.message); }
    const sp = Object.fromEntries((stats.skaters || []).map((s) => [s.playerId, s]));
    const sg = Object.fromEntries((stats.goalies || []).map((s) => [s.playerId, s]));

    for (const p of [...(roster.forwards || []), ...(roster.defensemen || []), ...(roster.goalies || [])]) {
      if (parId.has(p.id)) continue;
      const j = {
        id: String(p.id),
        nom: `${texte(p.firstName)} ${texte(p.lastName)}`,
        no: p.sweaterNumber ?? null,
        pos: POSITIONS[p.positionCode] || p.positionCode,
        eq,
      };
      const g = sg[p.id], s = sp[p.id];
      if (j.pos === "G") {
        j.g = { pj: g?.gamesPlayed ?? 0, v: g?.wins ?? 0, d: g?.losses ?? 0, dp: g?.overtimeLosses ?? 0,
          moy: g?.goalsAgainstAverage != null ? +g.goalsAgainstAverage.toFixed(2) : null,
          pct: g?.savePercentage != null ? +g.savePercentage.toFixed(3) : null };
      } else {
        j.s = { pj: s?.gamesPlayed ?? 0, b: s?.goals ?? 0, a: s?.assists ?? 0, pts: s?.points ?? 0, pm: s?.plusMinus ?? 0 };
      }
      parId.set(p.id, j);
      joueurs.push(j);
    }

    // 3. Calendrier de l'équipe (on fusionne les 32 en un seul)
    const horaire = await lire(`/club-schedule-season/${eq}/${saison}`);
    for (const m of horaire.games || []) {
      if (m.gameType !== 2 && m.gameType !== 3) continue; // saison régulière et séries
      if (matchs.has(m.id)) continue;
      const fini = m.gameState === "FINAL" || m.gameState === "OFF";
      const direct = m.gameState === "LIVE" || m.gameState === "CRIT";
      const x = {
        id: m.id, date: m.gameDate, debut: m.startTimeUTC,
        dom: m.homeTeam?.abbrev, ext: m.awayTeam?.abbrev,
        etat: fini ? "fini" : direct ? "direct" : "avenir",
      };
      if (fini || direct) { x.sd = m.homeTeam?.score ?? 0; x.se = m.awayTeam?.score ?? 0; }
      const type = m.gameOutcome?.lastPeriodType;
      if (fini && (type === "OT" || type === "SO")) x.fin = type;
      if (m.gameType === 3) x.series = true;
      matchs.set(m.id, x);
    }
    console.log(`${eq} : ok`);
  }

  const calendrier = [...matchs.values()].sort((a, b) => (a.debut || a.date).localeCompare(b.debut || b.date));

  // Classement de la ligue
  let classement = [];
  try {
    const st = await lire(`/standings/now`);
    classement = (st.standings || []).map((t) => ({
      eq: texte(t.teamAbbrev), pj: t.gamesPlayed ?? 0, v: t.wins ?? 0, d: t.losses ?? 0, dp: t.otLosses ?? 0,
      pts: t.points ?? 0, bp: t.goalFor ?? 0, bc: t.goalAgainst ?? 0,
      div: t.divisionName || "", conf: t.conferenceName || "",
      serie: t.streakCode ? `${t.streakCode}${t.streakCount ?? ""}` : "",
    }));
  } catch (e) { console.warn("Classement :", e.message); }

  // 4. Buts et passes match par match (seulement les matchs pas encore traités)
  const traites = new Set(await lireJson("data/traites.json", []));
  const points = {};
  for (const eq of Object.keys(EQUIPES)) points[eq] = await lireJson(`data/points/${eq}.json`, {});
  for (const m of calendrier) {
    if (m.etat === "avenir" || traites.has(m.id)) continue;
    try {
      const box = await lire(`/gamecenter/${m.id}/boxscore`);
      for (const [cote, eq] of [["homeTeam", m.dom], ["awayTeam", m.ext]]) {
        const e = box.playerByGameStats?.[cote] || {};
        const ligne = {};
        for (const p of [...(e.forwards || []), ...(e.defense || [])]) {
          if (p.goals || p.assists) ligne[p.playerId] = [p.goals || 0, p.assists || 0];
        }
        if (points[eq]) points[eq][m.id] = ligne;
      }
      if (m.etat === "fini") traites.add(m.id);
    } catch (e) {
      console.warn("Sommaire non disponible pour", m.id, e.message);
    }
  }

  // 5. On écrit seulement les fichiers qui ont changé
  await mkdir("data/points", { recursive: true });
  let change = false;
  async function ecrire(f, contenu) {
    const nouveau = JSON.stringify(contenu);
    const ancien = await readFile(f, "utf8").catch(() => null);
    if (ancien === nouveau) return;
    await writeFile(f, nouveau);
    change = true;
  }
  await ecrire("data/calendrier.json", calendrier);
  if (classement.length) await ecrire("data/classement.json", classement);
  for (const eq of Object.keys(EQUIPES)) await ecrire(`data/points/${eq}.json`, points[eq]);
  await ecrire("data/traites.json", [...traites].sort());

  const ancienJoueurs = await lireJson("data/joueurs.json", null);
  const memesJoueurs = ancienJoueurs && JSON.stringify(ancienJoueurs.joueurs) === JSON.stringify(joueurs);
  if (change || !memesJoueurs) {
    await writeFile("data/joueurs.json", JSON.stringify({ misAJour: new Date().toISOString(), saison, equipes: EQUIPES, joueurs }));
    console.log(`Fichiers mis à jour : ${joueurs.length} joueurs, ${calendrier.length} matchs.`);
  } else {
    console.log("Aucun changement depuis la dernière fois.");
  }
}

principal().catch((e) => {
  console.error("Le robot a rencontré un problème :", e.message);
  process.exit(1);
});
