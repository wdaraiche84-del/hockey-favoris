// =============================================================
// LE ROBOT DES STATS
// Ce programme est lancé automatiquement par GitHub (voir
// .github/workflows/maj-donnees.yml). Il va chercher les données
// du Canadien auprès du service de statistiques de la LNH, puis
// les range dans data/mtl.json. Le site lit ensuite ce fichier.
// =============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";

const EQUIPE = "MTL";
const API = "https://api-web.nhle.com/v1";
const FICHIER = "data/mtl.json";

// Noms des équipes en français
const NOMS_FR = {
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
async function lire(chemin) {
  const rep = await fetch(API + chemin, { headers: { "User-Agent": "hockey-favoris (site de fan)" } });
  if (!rep.ok) throw new Error(`${chemin} → erreur ${rep.status}`);
  return rep.json();
}
const texte = (v) => (v && typeof v === "object" ? v.default : v) || "";
const simplifier = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");

function saisonActuelle() {
  // La saison commence à l'automne : en octobre 2026, c'est 2026-2027
  const d = new Date();
  const debut = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${debut}${debut + 1}`;
}

// ---- Programme principal ------------------------------------
async function principal() {
  const saison = saisonActuelle();
  let ancien = null;
  try { ancien = JSON.parse(await readFile(FICHIER, "utf8")); } catch { /* premier passage */ }

  // 1. L'effectif actuel
  const roster = await lire(`/roster/${EQUIPE}/current`);
  const tous = [...(roster.forwards || []), ...(roster.defensemen || []), ...(roster.goalies || [])];

  // Identifiant simple : le nom de famille (ou prénom-nom si deux joueurs ont le même)
  const compte = {};
  for (const p of tous) { const n = simplifier(texte(p.lastName)); compte[n] = (compte[n] || 0) + 1; }
  const idDe = {};
  for (const p of tous) {
    const n = simplifier(texte(p.lastName));
    idDe[p.id] = compte[n] > 1 ? `${simplifier(texte(p.firstName))}-${n}` : n;
  }

  // 2. Les stats de la saison
  const stats = await lire(`/club-stats/${EQUIPE}/now`);
  const statsPatineur = Object.fromEntries((stats.skaters || []).map((s) => [s.playerId, s]));
  const statsGardien = Object.fromEntries((stats.goalies || []).map((s) => [s.playerId, s]));

  const joueurs = tous.map((p) => {
    const j = {
      id: idDe[p.id], nhlId: p.id,
      nom: `${texte(p.firstName)} ${texte(p.lastName)}`,
      no: p.sweaterNumber ?? null,
      pos: POSITIONS[p.positionCode] || p.positionCode,
      equipe: EQUIPE,
    };
    const s = statsPatineur[p.id];
    const g = statsGardien[p.id];
    if (g) j.gardien = { pj: g.gamesPlayed ?? 0, v: g.wins ?? 0, d: g.losses ?? 0, dp: g.overtimeLosses ?? 0,
      moy: g.goalsAgainstAverage ?? null, pct: g.savePercentage ?? null };
    else j.stats = { pj: s?.gamesPlayed ?? 0, b: s?.goals ?? 0, a: s?.assists ?? 0, pts: s?.points ?? 0, pm: s?.plusMinus ?? 0 };
    return j;
  });

  // 3. Le calendrier complet de la saison
  const horaire = await lire(`/club-schedule-season/${EQUIPE}/${saison}`);
  const calendrier = (horaire.games || [])
    .filter((m) => m.gameType === 2 || m.gameType === 3) // saison régulière et séries
    .map((m) => {
      const dom = m.homeTeam?.abbrev === EQUIPE;
      const nous = dom ? m.homeTeam : m.awayTeam;
      const eux = dom ? m.awayTeam : m.homeTeam;
      const fini = m.gameState === "FINAL" || m.gameState === "OFF";
      const live = m.gameState === "LIVE" || m.gameState === "CRIT";
      const match = {
        id: m.id, date: m.gameDate, debut: m.startTimeUTC, dom,
        adv: NOMS_FR[eux.abbrev] || texte(eux.placeName) || eux.abbrev, advAbrev: eux.abbrev,
        etat: fini ? "fini" : live ? "direct" : "avenir",
      };
      if (m.gameType === 3) match.note = "Séries";
      if (fini || live) {
        match.res = { mtl: nous.score ?? 0, adv: eux.score ?? 0 };
        const type = m.gameOutcome?.lastPeriodType;
        if (fini && type === "OT") match.res.prol = true;
        if (fini && type === "SO") match.res.tb = true;
      }
      return match;
    });

  // 4. Les points de chaque joueur, match par match
  // (on garde les matchs déjà traités pour ne pas tout redemander)
  const matchs = {};
  for (const m of calendrier.filter((x) => x.etat !== "avenir")) {
    if (m.etat === "fini" && ancien?.matchs?.[m.date]) { matchs[m.date] = ancien.matchs[m.date]; continue; }
    try {
      const box = await lire(`/gamecenter/${m.id}/boxscore`);
      const cote = box.homeTeam?.abbrev === EQUIPE ? "homeTeam" : "awayTeam";
      const equipe = box.playerByGameStats?.[cote] || {};
      const ligne = {};
      for (const p of [...(equipe.forwards || []), ...(equipe.defense || [])]) {
        const id = idDe[p.playerId] || simplifier(texte(p.name).split(" ").slice(-1)[0]);
        ligne[id] = { b: p.goals ?? 0, a: p.assists ?? 0 };
      }
      matchs[m.date] = ligne;
    } catch (e) {
      console.warn("Sommaire non disponible pour", m.date, e.message);
    }
  }

  // 5. On écrit le fichier seulement si quelque chose a changé
  const nouveau = { saison, joueurs, calendrier, matchs };
  if (ancien) {
    const { misAJour, ...ancienSansDate } = ancien;
    if (JSON.stringify(ancienSansDate) === JSON.stringify(nouveau)) {
      console.log("Aucun changement depuis la dernière fois.");
      return;
    }
  }
  await mkdir("data", { recursive: true });
  await writeFile(FICHIER, JSON.stringify({ misAJour: new Date().toISOString(), ...nouveau }, null, 1));
  console.log(`Fichier mis à jour : ${joueurs.length} joueurs, ${calendrier.length} matchs.`);
}

principal().catch((e) => {
  console.error("Le robot a rencontré un problème :", e.message);
  process.exit(1);
});
