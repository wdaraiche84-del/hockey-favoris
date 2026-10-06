// =============================================================
// LE ROBOT DES LIGUES EUROPÉENNES
//   Liiga (Finlande) : équipes, joueurs et stats, calendrier,
//                      classement, points match par match
//   KHL              : calendrier, scores et classement (les stats
//                      des joueurs ne sont pas accessibles pour l'instant)
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
async function khl() {
  const API = "https://khl.api.webcaster.pro/api/khl_mobile/events_v2";
  const evenements = new Map();
  for (let page = 1; page <= 80; page++) {
    const liste = (await lire(`${API}?order_direction=asc&page=${page}`)).map((x) => x.event).filter(Boolean);
    if (!liste.length) break;
    for (const e of liste) evenements.set(e.id, e);
    if (liste.length < 16) break;
  }
  const equipes = {};
  const cleDe = (t) => {
    const [abr, nom, court] = KHL[t.name] || [t.name.slice(0, 3).toUpperCase(), `${t.name} (${t.location})`, t.name];
    const cle = `khl_${abr}`;
    equipes[cle] = equipes[cle] || { abr, nom, court, div: "KHL", conf: "KHL" };
    return cle;
  };
  const calendrier = [];
  const fiches = {};
  for (const e of evenements.values()) {
    if (e.not_regular) continue; // matchs hors saison (préparatoires, étoiles)
    const dom = cleDe(e.team_a), ext = cleDe(e.team_b);
    const fini = e.game_state_key === "finished", direct = !fini && e.game_state_key !== "not_yet_started";
    const m = { id: `khl-${e.id}`, date: dateQc(e.start_at), debut: new Date(e.start_at).toISOString(), dom, ext, etat: fini ? "fini" : direct ? "direct" : "avenir" };
    if (fini || direct) { const [a, b] = String(e.score || "0:0").split(":").map(Number); m.sd = a || 0; m.se = b || 0; }
    if (fini && e.scores?.bullitt) m.fin = "SO"; else if (fini && e.scores?.overtime) m.fin = "OT";
    calendrier.push(m);
    // Classement calculé à partir des résultats (victoire 2 points, défaite en prolongation 1 point)
    if (fini) {
      for (const [eq, nous, eux] of [[dom, m.sd, m.se], [ext, m.se, m.sd]]) {
        const f = (fiches[eq] = fiches[eq] || { eq, pj: 0, v: 0, d: 0, dp: 0, pts: 0, bp: 0, bc: 0, div: "KHL", conf: "KHL", serie: "", suite: [] });
        f.pj++; f.bp += nous; f.bc += eux;
        if (nous > eux) { f.v++; f.pts += 2; f.suite.push("W"); } else if (m.fin) { f.dp++; f.pts += 1; f.suite.push("L"); } else { f.d++; f.suite.push("L"); }
      }
    }
  }
  calendrier.sort((a, b) => a.debut.localeCompare(b.debut));
  const classement = Object.values(fiches).map(({ suite, ...f }) => {
    let n = 0; const dernier = suite[suite.length - 1];
    for (let i = suite.length - 1; i >= 0 && suite[i] === dernier; i--) n++;
    return { ...f, serie: dernier ? `${dernier}${n}` : "" };
  });
  await enregistrer("khl", "2026-27", equipes, [], classement, calendrier, {});
  console.log(`KHL : ${Object.keys(equipes).length} équipes, ${calendrier.length} matchs (sans stats de joueurs).`);
}

let erreurs = 0;
for (const [nom, f] of [["Liiga", liiga], ["KHL", khl]]) {
  try { await f(); } catch (e) { erreurs++; console.error(`${nom} : problème —`, e.message); }
}
if (erreurs === 2) process.exit(1);
