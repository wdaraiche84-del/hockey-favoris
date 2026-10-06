// =============================================================
// LE ROBOT DES LIGUES EUROPÉENNES
//   Liiga (Finlande) : équipes, joueurs et stats, calendrier,
//                      classement, points match par match
//   National League  : (Suisse) équipes, joueurs et stats, calendrier,
//                      classement, stats match par match
//   SHL              : (Suède) même chose, à partir du site officiel
//   KHL              : équipes, joueurs et stats, calendrier, classement
//                      officiel, stats match par match (source : l'API de
//                      l'application mobile officielle de la KHL)
// Même format que les autres ligues : data/ligues/XXX/
// =============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function lire(url, essais = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (MonTrio, site de fan)", Accept: "application/json" } });
      if (!r.ok) throw new Error(`erreur ${r.status}`);
      await pause(150);
      return await r.json();
    } catch (e) {
      if (i >= essais) throw new Error(`${url} → ${e.message}`);
      await pause(1500 * i);
    }
  }
}
// Date du match à l'heure du Québec (AAAA-MM-JJ)
const dateQc = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date(d));
async function ecrireSiChange(f, contenu) {
  const nouveau = JSON.stringify(contenu);
  if ((await readFile(f, "utf8").catch(() => null)) === nouveau) return false;
  await writeFile(f, nouveau); return true;
}
async function lireJson(f, defaut) { try { return JSON.parse(await readFile(f, "utf8")); } catch { return defaut; } }
async function enregistrer(lig, saison, equipes, joueurs, classement, calendrier, points) {
  const dossier = `data/ligues/${lig}`;
  await mkdir(`${dossier}/points`, { recursive: true });
  let change = await ecrireSiChange(`${dossier}/calendrier.json`, calendrier);
  for (const cle of Object.keys(equipes)) change = (await ecrireSiChange(`${dossier}/points/${cle}.json`, points[cle] || {})) || change;
  const ancien = await lireJson(`${dossier}/infos.json`, null);
  const contenu = { saison, equipes, joueurs, classement };
  if (change || !ancien || JSON.stringify({ ...ancien, misAJour: undefined }) !== JSON.stringify({ ...contenu, misAJour: undefined })) {
    await writeFile(`${dossier}/infos.json`, JSON.stringify({ misAJour: new Date().toISOString(), ...contenu }));
  }
}

// ---- Liiga ---------------------------------------------------
async function liiga() {
  const d = new Date();
  const saison = d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear(); // 2026-27 = « 2027 » pour la Liiga
  const API = "https://liiga.fi/api/v2";
  const stats = await lire(`${API}/players/stats/summed/${saison}/${saison}/runkosarja/true?dataType=basicStats`);
  const jeux = await lire(`${API}/games?tournament=runkosarja&season=${saison}`);
  const tableau = await lire(`${API}/standings/?season=${saison}`).catch(() => ({ season: [] }));

  // Équipes : abréviation tirée des stats des joueurs (ex. KAL), nom tiré des matchs
  const abrDe = {};
  for (const p of stats) if (p.teamId && p.teamShortName) abrDe[String(p.teamId)] = p.teamShortName.toUpperCase();
  const equipes = {}, cleDe = {};
  for (const g of jeux) {
    for (const t of [g.homeTeam, g.awayTeam]) {
      const num = String(t.teamId).split(":")[0];
      if (cleDe[t.teamId]) continue;
      const abr = abrDe[num] || t.teamName.slice(0, 3).toUpperCase();
      const cle = `liiga_${abr}`;
      cleDe[t.teamId] = cle; cleDe[num] = cle;
      equipes[cle] = { abr, nom: t.teamName, court: t.teamName, div: "Liiga", conf: "Liiga" };
    }
  }
  // Joueurs (les gardiens ne sont pas dans cette source)
  const joueurs = stats.filter((p) => !p.removed && cleDe[String(p.teamId)]).map((p) => ({
    id: `liiga-${p.playerId}`, nom: `${p.firstName} ${p.lastName}`, no: p.jersey ?? null,
    pos: p.goalkeeper ? "G" : p.role === "P" ? "D" : "AV", eq: cleDe[String(p.teamId)],
    s: { pj: p.games || 0, b: p.goals || 0, a: p.assists || 0, pts: p.points || 0, pm: p.plusMinus || 0 },
  }));
  // Calendrier et points (marqueurs et passeurs de chaque but ; pas les tirs de barrage)
  const calendrier = [], points = {};
  for (const g of jeux) {
    const dom = cleDe[g.homeTeam.teamId], ext = cleDe[g.awayTeam.teamId];
    const fini = !!g.ended, direct = !fini && !!g.started;
    const m = { id: `liiga-${g.id}`, date: dateQc(g.start), debut: new Date(g.start).toISOString(), dom, ext, etat: fini ? "fini" : direct ? "direct" : "avenir" };
    if (fini || direct) { m.sd = g.homeTeam.goals ?? 0; m.se = g.awayTeam.goals ?? 0; }
    if (fini && /WINNING_SHOT/.test(g.finishedType)) m.fin = "SO";
    else if (fini && /EXTENDED/.test(g.finishedType)) m.fin = "OT";
    calendrier.push(m);
    if (fini || direct) {
      for (const [t, cle] of [[g.homeTeam, dom], [g.awayTeam, ext]]) {
        const ligne = {};
        for (const but of t.goalEvents || []) {
          if (but.period >= 5) continue; // tirs de barrage
          const ajoute = (id, i) => { if (!id) return; const k = `liiga-${id}`; ligne[k] = ligne[k] || [0, 0, 0, 0, 0, ""]; ligne[k][i]++; };
          ajoute(but.scorerPlayerId, 0);
          for (const a of but.assistantPlayerIds || []) ajoute(a, 1);
        }
        (points[cle] = points[cle] || {})[m.id] = ligne;
      }
    }
  }
  calendrier.sort((a, b) => a.debut.localeCompare(b.debut));
  // Classement (la Liiga donne 3 points par victoire en temps réglementaire)
  const classement = (tableau.season || []).map((t) => {
    const cle = cleDe[t.teamId] || cleDe[String(t.teamId).split(":")[0]];
    return cle && { eq: cle, pj: t.games ?? 0, v: (t.wins ?? 0) + (t.overtimeWins ?? 0), d: t.losses ?? 0, dp: t.overtimeLosses ?? 0, // « ties » = matchs allés en prolongation, déjà comptés ailleurs
      pts: t.points ?? 0, bp: t.goals ?? 0, bc: t.goalsAgainst ?? 0, div: "Liiga", conf: "Liiga", serie: "" };
  }).filter(Boolean);
  await enregistrer("liiga", `${saison - 1}-${String(saison).slice(2)}`, equipes, joueurs, classement, calendrier, points);
  console.log(`Liiga : ${Object.keys(equipes).length} équipes, ${joueurs.length} joueurs, ${calendrier.length} matchs.`);
}


// ---- Outils communs -------------------------------------------
// Secondes → « mm:ss »
const secMmss = (s) => { s = Math.round(Number(s) || 0); return s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : ""; };
// Séquence en cours (ex. « W3 ») à partir des matchs terminés
function series(calendrier) {
  const suites = {};
  for (const m of calendrier) if (m.etat === "fini") {
    (suites[m.dom] = suites[m.dom] || []).push(m.sd > m.se ? "W" : "L");
    (suites[m.ext] = suites[m.ext] || []).push(m.se > m.sd ? "W" : "L");
  }
  return (eq) => { const s = suites[eq] || [], d = s[s.length - 1]; let n = 0; for (let i = s.length - 1; i >= 0 && s[i] === d; i--) n++; return d ? `${d}${n}` : ""; };
}
const saisonEnCours = () => { const d = new Date(), an = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; return `${an}-${String(an + 1).slice(2)}`; };
async function pointsExistants(dossier, equipes, fichier) {
  await mkdir(`${dossier}/points`, { recursive: true });
  const traites = new Set(await lireJson(`${dossier}/${fichier}`, []));
  const points = {};
  for (const cle of Object.keys(equipes)) points[cle] = traites.size ? await lireJson(`${dossier}/points/${cle}.json`, {}) : {};
  return { traites, points };
}

// ---- National League (Suisse) ---------------------------------
async function nl() {
  const API = "https://www.nationalleague.ch/api/";
  const dossier = "data/ligues/nl";
  const POS = { forwarder: "AV", forward: "AV", defender: "D", defense: "D", goalkeeper: "G" };
  const equipes = {}, parId = {};
  const court = (nom) => nom.replace(/\b(HC|SC|EHC|EV|HCD|Lakers|Lions|Tigers)\b/g, "").replace(/\s+/g, " ").trim() || nom;
  const tableau = await lire(API + "teams");
  for (const t of tableau) {
    const cle = `nl_${t.shortName}`;
    equipes[cle] = { abr: t.shortName, nom: t.name, court: court(t.name), div: "National League", conf: "National League" };
    parId[String(t.teamId)] = cle;
  }
  // Calendrier (sans les matchs préparatoires)
  const calendrier = [];
  for (const g of await lire(API + "games")) {
    if (g.isExhibition) continue;
    const dom = parId[String(g.homeTeamId)], ext = parId[String(g.awayTeamId)];
    if (!dom || !ext) continue;
    const fini = g.status === "finished", avant = /before|scheduled|notStarted|planned/i.test(g.status || "");
    const m = { id: `nl-${g.gameId}`, date: dateQc(g.date), debut: new Date(g.date).toISOString(), dom, ext, etat: fini ? "fini" : avant ? "avenir" : "direct" };
    if (!avant) { m.sd = g.homeTeamResult ?? 0; m.se = g.awayTeamResult ?? 0; }
    if (fini && g.isShootout) m.fin = "SO"; else if (fini && g.isOvertime) m.fin = "OT";
    calendrier.push(m);
  }
  calendrier.sort((a, b) => a.debut.localeCompare(b.debut));
  const serieDe = series(calendrier);
  // Classement (3 points par victoire en temps réglementaire, 2 en prolongation, 1 pour une défaite en prolongation)
  const classement = tableau.map((t) => {
    const cle = parId[String(t.teamId)];
    const dp = (t.glot || 0) + (t.glpe || 0);
    const d = (t.gw || 0) + (t.gl || 0) === (t.gp || 0) ? (t.gl || 0) - dp : (t.gl || 0); // « gl » peut inclure les défaites en prolongation
    return { eq: cle, pj: t.gp || 0, v: t.gw || 0, d: Math.max(0, d), dp, pts: t.po || 0, bp: t.g || 0, bc: t.ga || 0, div: "National League", conf: "National League", serie: serieDe(cle) };
  });
  // Joueurs et stats de la saison
  const joueurs = [], parNo = {};
  for (const p of await lire(API + "player")) {
    const pos = POS[p.position], eq = parId[String(p.teamId)];
    if (!pos || !eq) continue;
    const j = { id: `nl-${p.playerId}`, nom: `${p.firstName} ${p.lastName}`.trim(), no: p.number ? Number(p.number) : null, pos, eq };
    if (pos === "G") j.g = { pj: p.gp || 0, v: p.gw || 0, d: p.gl || 0, dp: 0, moy: p.gp ? +Number(p.gaPerGame || 0).toFixed(2) : null, pct: p.sa ? +(p.svs / p.sa).toFixed(3) : null };
    else j.s = { pj: p.gp || 0, b: p.g || 0, a: p.assists ?? ((p.a1 || 0) + (p.a2 || 0)), pts: p.points || 0, pm: p.plusMinus || 0 };
    joueurs.push(j);
    parNo[`${eq}#${Number(p.number)}`] = j.id;
  }
  // Stats match par match
  const { traites, points } = await pointsExistants(dossier, equipes, "traites-v1.json");
  for (const m of calendrier) {
    if (m.etat === "avenir" || traites.has(m.id)) continue;
    try {
      const g = await lire(API + `games/${m.id.slice(3)}`);
      for (const [stats, alignement, cle] of [[g.playerStatsHome, g.lineupHome, m.dom], [g.playerStatsAway, g.lineupAway, m.ext]]) {
        const idDe = {};
        for (const bloc of alignement || []) for (const p of bloc.players || []) idDe[Number(p.number)] = `nl-${p.playerId}`;
        const ligne = {};
        for (const p of stats || []) {
          const id = idDe[Number(p.number)] || parNo[`${cle}#${Number(p.number)}`];
          if (!id) continue;
          if (p.position === "goalkeeper") {
            if (!p.mip) continue;
            const ga = p.ga || 0, sv = Math.max(0, p.svs || 0), sa = p.sa || sv + ga;
            ligne[id] = ["G", sv, sa, ga, "", secMmss(p.mip)];
          } else {
            const toi = p.toi || 0;
            ligne[id] = [p.g || 0, p.a ?? ((p.a1 || 0) + (p.a2 || 0)), p.plMi ?? ((p.pl || 0) - (p.mi || 0)), p.sog || 0, p.pim || 0, secMmss(toi)];
          }
        }
        if (Object.keys(ligne).length) points[cle][m.id] = ligne;
      }
      if (m.etat === "fini") traites.add(m.id);
    } catch (e) { console.warn("NL sommaire", m.id, e.message); }
  }
  await ecrireSiChange(`${dossier}/traites-v1.json`, [...traites].sort());
  await enregistrer("nl", saisonEnCours(), equipes, joueurs, classement, calendrier, points);
  console.log(`National League : ${Object.keys(equipes).length} équipes, ${joueurs.length} joueurs, ${calendrier.length} matchs.`);
}

// ---- SHL (Suède) ------------------------------------------------
async function shl() {
  const API = "https://www.shl.se/api/";
  const dossier = "data/ligues/shl";
  const POS = { LW: "AG", RW: "AD", CE: "C", C: "C", F: "AV", LD: "D", RD: "D", D: "D", GK: "G" };
  const filtre = (await lire(API + "sports-v2/season-series-game-types-filter")).defaultSsgtFilter;
  const sch = await lire(API + `sports-v2/game-schedule?seasonUuid=${filtre.season}&seriesUuid=${filtre.series}&gameTypeUuid=${filtre.gameType}`);
  const equipes = {};
  for (const t of sch.teamList || []) {
    const n = t.teamNames || {};
    equipes[`shl_${t.teamCode}`] = { abr: t.teamCode, nom: (n.long || t.teamCode).trim(), court: (n.short || n.long || t.teamCode).trim(), div: "SHL", conf: "SHL" };
  }
  const calendrier = [];
  for (const g of sch.gameInfo || []) {
    const dom = `shl_${g.homeTeamInfo?.code}`, ext = `shl_${g.awayTeamInfo?.code}`;
    if (!equipes[dom] || !equipes[ext]) continue;
    const fini = g.state === "post-game", avant = g.state === "pre-game";
    const m = { id: `shl-${g.uuid}`, date: dateQc(g.rawStartDateTime), debut: new Date(g.rawStartDateTime).toISOString(), dom, ext, etat: fini ? "fini" : avant ? "avenir" : "direct" };
    if (!avant) { m.sd = g.homeTeamInfo.score ?? 0; m.se = g.awayTeamInfo.score ?? 0; }
    if (fini && g.shootout) m.fin = "SO"; else if (fini && g.overtime) m.fin = "OT";
    calendrier.push(m);
  }
  calendrier.sort((a, b) => a.debut.localeCompare(b.debut));
  const serieDe = series(calendrier);
  const ssgt = sch.gameInfo?.[0]?.ssgtUuid;
  const classement = [];
  if (ssgt) for (const t of (await lire(API + `statistics-v2/league-standings?ssgtUuid=${ssgt}`)).leagueStandings || []) {
    const cle = `shl_${t.info?.teamId}`; if (!equipes[cle]) continue;
    classement.push({ eq: cle, pj: t.GP || 0, v: (t.W || 0) + (t.OTW || 0), d: t.L || 0, dp: t.OTL || 0, pts: t.Points || 0, bp: t.G || 0, bc: t.GA || 0, div: "SHL", conf: "SHL", serie: serieDe(cle) });
  }
  // Stats match par match ; les stats de la saison sont l'addition de tous les matchs
  const { traites, points } = await pointsExistants(dossier, equipes, "traites-v1.json");
  const infos = await lireJson(`${dossier}/joueurs-vus.json`, {}); // id → { nom, no, pos, eq }
  for (const m of calendrier) {
    if (m.etat === "avenir" || traites.has(m.id)) continue;
    try {
      const ps = await lire(API + `gameday/player-stats/${m.id.slice(4)}`);
      for (const [cote, cle] of [["homeTeamValue", m.dom], ["awayTeamValue", m.ext]]) {
        const ligne = {};
        for (const p of ps.stats?.[cote] || []) {
          const pid = p.info?.playerId, nom = ps.players?.[cote]?.[pid];
          if (!pid || !nom) continue;
          const id = `shl-${pid}`;
          infos[id] = { nom: nom.fullName || `${nom.firstName} ${nom.lastName}`, no: p.NR ?? null, pos: POS[p.POS] || "AV", eq: cle };
          const toi = String(p.TOI || "");
          if (/^0?0:00$/.test(toi) && !p.G && !p.A) continue; // n'a pas joué
          ligne[id] = [p.G || 0, p.A || 0, p["+/-"] || 0, p.SOG || 0, p.PIM || 0, toi.replace(/^0(\d)/, "$1")];
        }
        for (const g of ps.gkStats?.[cote] || []) {
          const pid = g.info?.playerId, nom = ps.goalkeepers?.[cote]?.[pid];
          if (!pid || !nom) continue;
          const id = `shl-${pid}`;
          infos[id] = { nom: nom.fullName || `${nom.firstName} ${nom.lastName}`, no: g.NR ?? null, pos: "G", eq: cle };
          if (!g.SOGA && !g.GA) continue;
          ligne[id] = ["G", g.SVS || 0, g.SOGA || 0, g.GA || 0, "", ""];
        }
        if (Object.keys(ligne).length) points[cle][m.id] = ligne;
      }
      if (m.etat === "fini") traites.add(m.id);
    } catch (e) { console.warn("SHL sommaire", m.id, e.message); }
  }
  // Totaux de la saison à partir des matchs
  const parMatch = Object.fromEntries(calendrier.map((m) => [m.id, m]));
  const joueurs = Object.entries(infos).map(([id, j]) => {
    const x = { id, ...j };
    if (j.pos === "G") x.g = { pj: 0, v: 0, d: 0, dp: 0, moy: null, pct: null, _sv: 0, _sa: 0, _ga: 0 };
    else x.s = { pj: 0, b: 0, a: 0, pts: 0, pm: 0 };
    return x;
  });
  const parId = new Map(joueurs.map((j) => [j.id, j]));
  for (const [cle, matchs] of Object.entries(points)) for (const [mid, ligne] of Object.entries(matchs)) {
    const m = parMatch[mid]; if (!m) continue;
    // Le gardien qui a fait face au plus de tirs reçoit la décision
    const gardiens = Object.entries(ligne).filter(([, l]) => l[0] === "G").sort((a, b) => b[1][2] - a[1][2]);
    for (const [id, l] of Object.entries(ligne)) {
      const j = parId.get(id); if (!j) continue;
      if (l[0] === "G" && j.g) {
        j.g.pj++; j.g._sv += l[1]; j.g._sa += l[2]; j.g._ga += l[3];
        if (m.etat === "fini" && gardiens[0]?.[0] === id) {
          const gagne = m.dom === cle ? m.sd > m.se : m.se > m.sd;
          if (gagne) { j.g.v++; l[4] = "W"; } else if (m.fin) { j.g.dp++; l[4] = "O"; } else { j.g.d++; l[4] = "L"; }
        }
      } else if (j.s) { j.s.pj++; j.s.b += l[0]; j.s.a += l[1]; j.s.pts += l[0] + l[1]; j.s.pm += l[2]; }
    }
  }
  for (const j of joueurs) if (j.g) {
    const { _sv, _sa, _ga, ...g } = j.g;
    j.g = { ...g, moy: g.pj ? +(_ga / g.pj).toFixed(2) : null, pct: _sa ? +(_sv / _sa).toFixed(3) : null };
  }
  await ecrireSiChange(`${dossier}/joueurs-vus.json`, infos);
  await ecrireSiChange(`${dossier}/traites-v1.json`, [...traites].sort());
  await enregistrer("shl", saisonEnCours(), equipes, joueurs, classement, calendrier, points);
  console.log(`SHL : ${Object.keys(equipes).length} équipes, ${joueurs.length} joueurs, ${calendrier.length} matchs.`);
}

// ---- KHL -----------------------------------------------------
// Noms des équipes en français (la source est en russe)
const KHL = {
  "СКА": ["SKA", "SKA Saint-Pétersbourg", "SKA"], "ЦСКА": ["CSK", "CSKA Moscou", "CSKA"], "Динамо М": ["DYN", "Dynamo Moscou", "Dynamo"],
  "Спартак": ["SPA", "Spartak Moscou", "Spartak"], "Локомотив": ["LOK", "Lokomotiv Iaroslavl", "Lokomotiv"], "Торпедо": ["TRP", "Torpedo Nijni Novgorod", "Torpedo"],
  "Динамо Мн": ["DMN", "Dinamo Minsk", "Dinamo Minsk"], "Северсталь": ["SEV", "Severstal Tcherepovets", "Severstal"], "Драконы": ["SHA", "Dragons de Shanghai", "Dragons"],
  "ХК Сочи": ["SOC", "HK Sotchi", "Sotchi"], "Ак Барс": ["AKB", "Ak Bars Kazan", "Ak Bars"], "Авангард": ["AVG", "Avangard Omsk", "Avangard"],
  "Металлург Мг": ["MMG", "Metallurg Magnitogorsk", "Metallurg"], "Трактор": ["TRK", "Traktor Tcheliabinsk", "Traktor"], "Салават Юлаев": ["SAL", "Salavat Ioulaïev Oufa", "Salavat"],
  "Сибирь": ["SIB", "Sibir Novossibirsk", "Sibir"], "Автомобилист": ["AVT", "Avtomobilist Iekaterinbourg", "Avtomobilist"], "Адмирал": ["ADM", "Admiral Vladivostok", "Admiral"],
  "Амур": ["AMR", "Amour Khabarovsk", "Amour"], "Барыс": ["BAR", "Barys Astana", "Barys"], "Нефтехимик": ["NKH", "Neftekhimik Nijnekamsk", "Neftekhimik"],
  "Лада": ["LAD", "Lada Togliatti", "Lada"], "Куньлунь Ред Стар": ["KRS", "Kunlun Red Star", "Kunlun"], "Витязь": ["VIT", "Vitiaz Podolsk", "Vitiaz"],
};
const POS_KHL = { forward: "AV", defensemen: "D", goaltender: "G" };
const TRAD_KHL = { east: "Association de l'Est", west: "Association de l'Ouest" };
// « Goldobin Nikolai » → « Nikolai Goldobin »
const prenomNom = (n) => { const [nom, ...prenom] = String(n || "").trim().split(/\s+/); return [...prenom, nom].join(" ").trim(); };
// Minutes décimales → « mm:ss »
const mmss = (m) => { if (!m) return ""; const t = Math.round(m * 60); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
const val = (stats, id) => stats?.find((x) => x.id === id)?.val ?? 0;

async function khl() {
  const B = "https://khl.api.webcaster.pro/api/khl_mobile/";
  const dossier = "data/ligues/khl";
  await mkdir(`${dossier}/points`, { recursive: true });

  // 1. Tous les matchs de la saison
  const evenements = new Map();
  for (let page = 1; page <= 80; page++) {
    const liste = (await lire(`${B}events_v2?order_direction=asc&page=${page}`)).map((x) => x.event).filter(Boolean);
    if (!liste.length) break;
    for (const e of liste) evenements.set(e.id, e);
    if (liste.length < 16) break;
  }
  const equipes = {}, parIdEquipe = {};
  const cleDe = (t) => {
    const [abr, nom, court] = KHL[t.name] || [t.name.slice(0, 3).toUpperCase(), `${t.name} (${t.location})`, t.name];
    const cle = `khl_${abr}`;
    equipes[cle] = equipes[cle] || { abr, nom, court, div: "KHL", conf: "KHL" };
    parIdEquipe[t.id] = cle;
    return cle;
  };
  const calendrier = [];
  const suites = {};
  for (const e of evenements.values()) {
    if (e.not_regular) continue; // matchs hors saison (préparatoires, étoiles)
    const dom = cleDe(e.team_a), ext = cleDe(e.team_b);
    const fini = e.game_state_key === "finished", direct = !fini && e.game_state_key !== "not_yet_started";
    const m = { id: `khl-${e.id}`, date: dateQc(e.start_at), debut: new Date(e.start_at).toISOString(), dom, ext, etat: fini ? "fini" : direct ? "direct" : "avenir" };
    if (fini || direct) { const [a, b] = String(e.score || "0:0").split(":").map(Number); m.sd = a || 0; m.se = b || 0; }
    if (fini && e.scores?.bullitt) m.fin = "SO"; else if (fini && e.scores?.overtime) m.fin = "OT";
    calendrier.push(m);
  }
  calendrier.sort((a, b) => a.debut.localeCompare(b.debut));
  for (const m of calendrier) if (m.etat === "fini") {
    (suites[m.dom] = suites[m.dom] || []).push(m.sd > m.se ? "W" : "L");
    (suites[m.ext] = suites[m.ext] || []).push(m.se > m.sd ? "W" : "L");
  }
  const serieDe = (eq) => { const s = suites[eq] || [], d = s[s.length - 1]; let n = 0; for (let i = s.length - 1; i >= 0 && s[i] === d; i--) n++; return d ? `${d}${n}` : ""; };

  // 2. Classement officiel (avec associations et divisions)
  const classement = [];
  for (const { team: t } of await lire(`${B}teams_v2?locale=en`).catch(() => [])) {
    const cle = parIdEquipe[t.id]; if (!cle) continue;
    equipes[cle].conf = TRAD_KHL[t.conference_key] || "KHL";
    equipes[cle].div = t.division_key ? `Division ${t.division_key[0].toUpperCase()}${t.division_key.slice(1)}` : "KHL";
  }
  for (const { team: t } of await lire(`${B}teams`)) {
    const cle = parIdEquipe[t.id]; if (!cle) continue;
    const n = (x) => Number(x) || 0;
    classement.push({ eq: cle, pj: n(t.gp), v: n(t.w) + n(t.otw) + n(t.sow), d: n(t.l), dp: n(t.otl) + n(t.sol), pts: n(t.pts),
      bp: n(t.gf), bc: n(t.ga), div: equipes[cle].div, conf: equipes[cle].conf, serie: serieDe(cle) });
  }

  // 3. Joueurs et stats de la saison (16 par page)
  const joueurs = [], parId = new Map();
  for (let page = 1; page <= 120; page++) {
    const liste = (await lire(`${B}players_v2?locale=en&page=${page}`)).map((x) => x.player).filter(Boolean);
    if (!liste.length) break;
    for (const p of liste) {
      const pos = POS_KHL[p.role_key], eq = parIdEquipe[p.team?.id];
      if (!pos || !eq || parId.has(p.id)) continue;
      const j = { id: `khl-${p.id}`, nom: prenomNom(p.name), no: p.shirt_number ?? null, pos, eq };
      if (p.country && p.country !== "Russia") j.pays = p.country;
      if (pos === "G") {
        const st = p.stats || [];
        j.g = { pj: val(st, "gp"), v: val(st, "w"), d: val(st, "l"), dp: 0, moy: val(st, "gaa") || null, pct: val(st, "sv_pct") ? +(val(st, "sv_pct") / 100).toFixed(3) : null };
      } else {
        const st = p.stats || [];
        j.s = { pj: val(st, "gp"), b: val(st, "g"), a: val(st, "a"), pts: val(st, "pts"), pm: val(st, "pm") };
      }
      parId.set(p.id, j); joueurs.push(j);
    }
    if (liste.length < 16) break;
  }

  // 4. Stats de chaque joueur, match par match (seulement les nouveaux matchs)
  //    Patineur [B, A, +/-, tirs, PUN, TG] (pas de +/- par match dans la source) ; gardien ["G", arrêts, tirs, BC, décision, TG]
  const traites = new Set(await lireJson(`${dossier}/traites-v3.json`, []));
  const points = {};
  for (const cle of Object.keys(equipes)) points[cle] = traites.size ? await lireJson(`${dossier}/points/${cle}.json`, {}) : {};
  let nouveaux = 0;
  for (const m of calendrier) {
    if (m.etat === "avenir" || traites.has(m.id) || nouveaux >= 400) continue;
    try {
      const ev = (await lire(`${B}event_v2?id=${m.id.slice(4)}`)).event;
      if (!ev) continue;
      const cotes = [[ev.team_a, m.dom, ev.team_b], [ev.team_b, m.ext, ev.team_a]];
      for (const [t, cle, adv] of cotes) {
        const ligne = {};
        // Passes : la source les donne seulement dans la liste des buts (numéro de chandail + équipe)
        // (les passeurs sont toujours de l'équipe du marqueur ; on les reconnaît par numéro ou par nom)
        const passes = {};
        const parNo = new Map((t.players || []).map((p) => [String(p.shirt_number), p.id]));
        const parNom = new Map((t.players || []).map((p) => [String(p.name).toLowerCase(), p.id]));
        for (const but of ev.goals || []) {
          if (Number(but.author?.team_id) !== t.id || (but.period ?? 0) >= 5) continue;
          for (const as of but.assistants || []) {
            const no = as.shirt_number ?? as.number ?? as.player?.shirt_number;
            const nom = String(as.name ?? as.player?.name ?? "").toLowerCase();
            const id = (no != null && parNo.get(String(no))) || parNom.get(nom);
            if (id) passes[id] = (passes[id] || 0) + 1;
          }
        }
        const butsPour = (ev.goals || []).filter((x) => Number(x.author?.team_id) === t.id);
        const gardiens = (t.players || []).filter((p) => p.role_key === "goaltender" && val(p.match_stats, "toi") > 0);
        const principal = gardiens.sort((a, b) => val(b.match_stats, "toi") - val(a.match_stats, "toi"))[0];
        for (const p of t.players || []) {
          const st = p.match_stats || [];
          if (p.role_key === "goaltender") {
            if (p !== principal) continue;
            // Buts contre : ceux de l'adversaire, sauf dans un filet désert et en tirs de barrage
            const ga = (ev.goals || []).filter((x) => Number(x.author?.team_id) === adv.id && !/пуст/i.test(x.status || "") && (x.period ?? 0) < 5).length;
            const sa = Math.max(adv.shots || 0, ga);
            ligne[`khl-${p.id}`] = ["G", sa - ga, sa, ga, "", mmss(val(st, "toi"))];
          } else {
            const b = butsPour.filter((x) => x.author?.shirt_number === p.shirt_number && (x.period ?? 0) < 5).length || val(st, "goals");
            ligne[`khl-${p.id}`] = [b, passes[p.id] || 0, null, val(st, "shots"), val(st, "pim"), mmss(val(st, "toi"))];
          }
        }
        if (points[cle] && Object.keys(ligne).length) points[cle][m.id] = ligne;
      }
      nouveaux++;
      if (m.etat === "fini") traites.add(m.id);
    } catch (e) { console.warn("KHL sommaire", m.id, e.message); }
  }
  await ecrireSiChange(`${dossier}/traites-v3.json`, [...traites].sort());
  const d = new Date(), an = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  await enregistrer("khl", `${an}-${String(an + 1).slice(2)}`, equipes, joueurs, classement, calendrier, points);
  console.log(`KHL : ${Object.keys(equipes).length} équipes, ${joueurs.length} joueurs, ${calendrier.length} matchs, ${nouveaux} sommaires lus.`);
}

let erreurs = 0;
const LISTE = [["Liiga", liiga], ["KHL", khl], ["National League", nl], ["SHL", shl]];
for (const [nom, f] of LISTE) {
  try { await f(); } catch (e) { erreurs++; console.error(`${nom} : problème —`, e.message); }
}
if (erreurs === LISTE.length) process.exit(1);
