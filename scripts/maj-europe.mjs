// =============================================================
// LE ROBOT DES LIGUES EUROPÉENNES
//   Liiga (Finlande) : équipes, joueurs et stats, calendrier,
//                      classement, points match par match
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
for (const [nom, f] of [["Liiga", liiga], ["KHL", khl]]) {
  try { await f(); } catch (e) { erreurs++; console.error(`${nom} : problème —`, e.message); }
}
if (erreurs === 2) process.exit(1);
