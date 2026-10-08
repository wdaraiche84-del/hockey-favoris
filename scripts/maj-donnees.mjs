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
          pct: g?.savePercentage != null ? +g.savePercentage.toFixed(3) : null, bl: g?.shutouts ?? 0 };
      } else {
        j.s = { pj: s?.gamesPlayed ?? 0, b: s?.goals ?? 0, a: s?.assists ?? 0, pts: s?.points ?? 0, pm: s?.plusMinus ?? 0,
          // Stats avancées : tirs, buts en avantage et en infériorité numérique, buts gagnants, punitions,
          // temps de glace moyen (secondes) et % de mises au jeu gagnées
          tirs: s?.shots ?? 0, bav: s?.powerPlayGoals ?? 0, bin: s?.shorthandedGoals ?? 0, bg: s?.gameWinningGoals ?? 0,
          pun: s?.penaltyMinutes ?? 0, tg: Math.round(s?.avgTimeOnIcePerGame ?? 0), mj: s?.faceoffWinPctg ? +s.faceoffWinPctg.toFixed(3) : null };
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

  // Recrues de la saison (service de statistiques de la LNH)
  try {
    for (const type of ["skater", "goalie"]) {
      const exp = encodeURIComponent(`gameTypeId=2 and seasonId=${saison} and isRookie='1'`);
      const rep = await fetch(`https://api.nhle.com/stats/rest/en/${type}/summary?isAggregate=false&isGame=false&start=0&limit=-1&cayenneExp=${exp}`, { headers: { "User-Agent": "hockey-favoris (site de fan)" } });
      if (!rep.ok) throw new Error(`recrues ${rep.status}`);
      for (const r of (await rep.json()).data || []) { const j = parId.get(r.playerId); if (j) j.r = 1; }
    }
  } catch (e) { console.warn("Recrues :", e.message); }

  // Encore plus de stats (service de statistiques de la LNH) : points en avantage et en infériorité,
  // buts en prolongation et dans un filet désert, mises en échec, tirs bloqués, revirements,
  // punitions provoquées, temps de glace en AN et en DN, présences ; gardiens : départs de qualité
  const statsLnh = async (vue) => {
    const exp = encodeURIComponent(`gameTypeId=2 and seasonId=${saison}`);
    const rep = await fetch(`https://api.nhle.com/stats/rest/en/${vue}?isAggregate=true&isGame=false&start=0&limit=-1&cayenneExp=${exp}`, { headers: { "User-Agent": "hockey-favoris (site de fan)" } });
    if (!rep.ok) throw new Error(`${vue} ${rep.status}`);
    return (await rep.json()).data || [];
  };
  const fusion = async (vue, f) => {
    try { for (const r of await statsLnh(vue)) { const j = parId.get(r.playerId); if (j) f(j, r); } }
    catch (e) { console.warn("Stats", vue, ":", e.message); }
  };
  await fusion("skater/summary", (j, r) => j.s && Object.assign(j.s, { pav: r.ppPoints ?? 0, pin: r.shPoints ?? 0, bp: r.otGoals ?? 0 }));
  await fusion("skater/realtime", (j, r) => j.s && Object.assign(j.s, { bf: r.emptyNetGoals ?? 0, me: r.hits ?? 0, tb: r.blockedShots ?? 0, rp: r.takeaways ?? 0, rv: r.giveaways ?? 0, pb: r.firstGoals ?? 0 }));
  await fusion("skater/timeonice", (j, r) => j.s && Object.assign(j.s, { tav: Math.round(r.ppTimeOnIcePerGame ?? 0), tdn: Math.round(r.shTimeOnIcePerGame ?? 0), pres: r.shiftsPerGame != null ? +r.shiftsPerGame.toFixed(1) : null }));
  await fusion("skater/penalties", (j, r) => j.s && Object.assign(j.s, { pprov: r.penaltiesDrawn ?? 0 }));
  await fusion("goalie/advanced", (j, r) => j.g && Object.assign(j.g, { dq: r.qualityStart ?? 0, tit: r.gamesStarted ?? 0 }));
  await fusion("goalie/summary", (j, r) => j.g && Object.assign(j.g, { arr: r.saves ?? 0, tr: r.shotsAgainst ?? 0 }));

  // Les records de la saison mesurés par le système de suivi de la LNH (vitesse, tir, distance)
  let records = null;
  try {
    const ed = await lire(`/edge/skater-landing/now`);
    const L = ed.leaders || {}, rec = (o, val) => (o?.player?.id && val != null ? { id: String(o.player.id), v: +Number(val).toFixed(1) } : null);
    records = {
      tir: rec(L.hardestShot, L.hardestShot?.shotSpeed?.metric),
      vitesse: rec(L.maxSkatingSpeed, L.maxSkatingSpeed?.skatingSpeed?.metric),
      distance: rec(L.totalDistanceSkated, L.totalDistanceSkated?.distanceSkated?.metric),
      distanceMatch: rec(L.distanceMaxGame, L.distanceMaxGame?.distanceSkated?.metric),
    };
  } catch (e) { console.warn("Records :", e.message); }

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
      // Course aux séries : rang dans la division, rang de meilleure 2e place, qualification (x, y, z, e…)
      rd: t.divisionSequence ?? null, rw: t.wildcardSequence ?? null, q: t.clinchIndicator || "",
      vr: t.regulationWins ?? null,
    }));
  } catch (e) { console.warn("Classement :", e.message); }
  // Stats d'équipe : avantage et désavantage numérique, tirs par match, mises au jeu
  try {
    const st = await lire(`/standings/now`);
    const parNom = Object.fromEntries((st.standings || []).map((t) => [texte(t.teamName).toLowerCase(), texte(t.teamAbbrev)]));
    const exp = encodeURIComponent(`gameTypeId=2 and seasonId=${saison}`);
    const r = await fetch(`https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=${exp}`, { headers: { "User-Agent": "hockey-favoris (site de fan)" } });
    for (const t of (r.ok ? (await r.json()).data : []) || []) {
      const c = classement.find((x) => x.eq === parNom[String(t.teamFullName).toLowerCase()]);
      if (!c) continue;
      const arr = (v, n) => (v == null ? null : +Number(v).toFixed(n));
      Object.assign(c, { av: arr(t.powerPlayPct, 3), dn: arr(t.penaltyKillPct, 3), tpm: arr(t.shotsForPerGame, 1), tcm: arr(t.shotsAgainstPerGame, 1), mj: arr(t.faceoffWinPct, 3) });
    }
  } catch (e) { console.warn("Stats d'équipe :", e.message); }

  // Tableau des séries éliminatoires (seulement quand les séries ont commencé)
  let series = null;
  if (calendrier.some((m) => m.series)) {
    try {
      const b = await lire(`/playoff-bracket/${saison.slice(4)}`);
      series = (b.series || []).filter((x) => x.topSeedTeam || x.bottomSeedTeam).map((x) => ({
        ronde: x.playoffRound, lettre: x.seriesLetter,
        haut: { eq: x.topSeedTeam?.abbrev || null, rang: x.topSeedRankAbbrev || "", v: x.topSeedWins ?? 0 },
        bas: { eq: x.bottomSeedTeam?.abbrev || null, rang: x.bottomSeedRankAbbrev || "", v: x.bottomSeedWins ?? 0 },
        gagnant: x.winningTeamId ? (x.winningTeamId === x.topSeedTeam?.id ? x.topSeedTeam?.abbrev : x.bottomSeedTeam?.abbrev) : null,
      }));
    } catch (e) { console.warn("Séries :", e.message); }
  }

  // 4. Stats de chaque joueur, match par match (seulement les matchs pas encore traités)
  //    Patineur : [buts, passes, +/-, tirs, minutes de punition, temps de glace]
  //    Gardien  : ["G", arrêts, tirs reçus, buts accordés, décision (W/L/O), temps de jeu]
  // Déroulement d'un match terminé : buts période par période, 3 étoiles officielles → data/sommaires/ID.json
  await mkdir("data/sommaires", { recursive: true });
  async function deroulement(id) {
    const l = await lire(`/gamecenter/${id}/landing`);
    const per = (l.summary?.scoring || []).map((p) => ({
      n: p.periodDescriptor?.number, type: p.periodDescriptor?.periodType || "REG",
      buts: (p.goals || []).map((g) => ({
        t: g.timeInPeriod, eq: texte(g.teamAbbrev), id: String(g.playerId), nom: `${texte(g.firstName)} ${texte(g.lastName)}`.trim(),
        passes: (g.assists || []).map((a) => [String(a.playerId), `${texte(a.firstName)} ${texte(a.lastName)}`.trim()]),
        force: g.strength || "ev", mod: g.goalModifier && g.goalModifier !== "none" ? g.goalModifier : "", se: g.awayScore, sd: g.homeScore, tir: g.shotType || "",
      })),
    }));
    const etoiles = (l.summary?.threeStars || []).map((x) => String(x.playerId));
    await writeFile(`data/sommaires/${id}.json`, JSON.stringify({ per, etoiles }));
  }
  const dejaSommaire = new Set((await import("node:fs/promises").then((f) => f.readdir("data/sommaires"))).map((f) => f.replace(".json", "")));
  let rattrapage = 0;
  for (const m of calendrier) {
    if (m.etat !== "fini" || dejaSommaire.has(String(m.id)) || rattrapage >= 150) continue;
    try { await deroulement(m.id); rattrapage++; } catch (e) { console.warn("Déroulement", m.id, e.message); }
  }
  if (rattrapage) console.log(`Déroulements de match : ${rattrapage} ajoutés.`);

  const traites = new Set(await lireJson("data/traites-v3.json", []));
  const points = {};
  for (const eq of Object.keys(EQUIPES)) points[eq] = traites.size ? await lireJson(`data/points/${eq}.json`, {}) : {};
  for (const m of calendrier) {
    // Les matchs des 3 derniers jours sont relus : la LNH corrige parfois un but ou une passe après coup
    const recent = Date.now() - new Date(m.debut || m.date) < 3 * 86400e3;
    if (m.etat === "avenir" || (traites.has(m.id) && !recent)) continue;
    try {
      const box = await lire(`/gamecenter/${m.id}/boxscore`);
      for (const [cote, eq] of [["homeTeam", m.dom], ["awayTeam", m.ext]]) {
        const e = box.playerByGameStats?.[cote] || {};
        const ligne = {};
        for (const p of [...(e.forwards || []), ...(e.defense || [])]) {
          ligne[p.playerId] = [p.goals || 0, p.assists || 0, p.plusMinus || 0, p.sog ?? p.shots ?? 0, p.pim || 0, p.toi || ""];
        }
        for (const g of e.goalies || []) {
          if (!g.toi || g.toi === "00:00") continue;
          const [sv, sa] = String(g.saveShotsAgainst || "0/0").split("/").map(Number);
          ligne[g.playerId] = ["G", sv || 0, sa || 0, g.goalsAgainst ?? (sa - sv) ?? 0, g.decision || "", g.toi];
        }
        if (points[eq]) points[eq][m.id] = ligne;
      }
      if (m.etat === "fini") {
        traites.add(m.id);
      }
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
  if (series) await ecrire("data/series.json", series);
  for (const eq of Object.keys(EQUIPES)) await ecrire(`data/points/${eq}.json`, points[eq]);
  await ecrire("data/traites-v3.json", [...traites].sort());

  const ancienJoueurs = await lireJson("data/joueurs.json", null);
  const memesJoueurs = ancienJoueurs && JSON.stringify(ancienJoueurs.joueurs) === JSON.stringify(joueurs) && JSON.stringify(ancienJoueurs.records ?? null) === JSON.stringify(records);
  if (change || !memesJoueurs) {
    await writeFile("data/joueurs.json", JSON.stringify({ misAJour: new Date().toISOString(), saison, equipes: EQUIPES, joueurs, records }));
    console.log(`Fichiers mis à jour : ${joueurs.length} joueurs, ${calendrier.length} matchs.`);
  } else {
    console.log("Aucun changement depuis la dernière fois.");
  }
}

principal().catch((e) => {
  console.error("Le robot a rencontré un problème :", e.message);
  process.exit(1);
});
