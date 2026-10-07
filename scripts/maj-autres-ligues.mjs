// =============================================================
// LE ROBOT DES AUTRES LIGUES (LAH, LHJMQ, OHL, WHL)
// Ces quatre ligues utilisent le même fournisseur de statistiques
// (HockeyTech). Pour chacune, le robot range dans data/ligues/XXX/ :
//   infos.json       équipes, joueurs et stats, classement
//   calendrier.json  tous les matchs de la saison
//   points/EQ.json   buts et passes de chaque joueur, match par match
//   traites.json     (interne) les matchs déjà traités
// Si une ligue a un problème, les autres continuent quand même.
// =============================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";

const BASE = "https://lscluster.hockeytech.com/feed/";
const LIGUES = {
  ahl: { cle: "50c2cd9b5e18e390", nom: "LAH" },
  lhjmq: { cle: "f1aa699db3d81487", nom: "LHJMQ", francais: true },
  ohl: { cle: "f1aa699db3d81487", nom: "OHL" },
  whl: { cle: "f1aa699db3d81487", nom: "WHL" },
};
const POSITIONS = { C: "C", LW: "AG", RW: "AD", F: "AV", D: "D", G: "G" };

// ---- Traduction des noms d'associations et de divisions -----
const TRAD = {
  "Eastern Conference": "Association de l'Est", "Western Conference": "Association de l'Ouest",
  "East Division": "Division Est", "West Division": "Division Ouest", "Central Division": "Division Centrale",
  "Pacific Division": "Division Pacifique", "Atlantic Division": "Division Atlantique", "North Division": "Division Nord",
  "Midwest Division": "Division Midwest", "U.S. Division": "Division américaine", "B.C. Division": "Division C.-B.",
  "Eastern Conf": "Association de l'Est", "Western Conf": "Association de l'Ouest",
};
const tr = (t) => TRAD[t] || t || "";

// ---- Outils -------------------------------------------------
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function lire(params, essais = 3) {
  const url = BASE + "?" + new URLSearchParams({ fmt: "json", lang: "en", ...params });
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "hockey-favoris (site de fan)" } });
      if (!r.ok) throw new Error(`erreur ${r.status}`);
      const t = (await r.text()).trim().replace(/^\(/, "").replace(/\)$/, "");
      await pause(120);
      return JSON.parse(t);
    } catch (e) {
      if (i >= essais) throw new Error(`${params.view || params.tab} → ${e.message}`);
      await pause(1500 * i);
    }
  }
}
async function lireJson(f, defaut) { try { return JSON.parse(await readFile(f, "utf8")); } catch { return defaut; } }
const n = (v) => (v === "" || v == null ? 0 : Number(v));
const dec = (v, d) => (v === "" || v == null || isNaN(Number(v)) ? null : +Number(v).toFixed(d));

async function uneLigue(lig, conf) {
  const mk = (view, extra = {}) => lire({ feed: "modulekit", view, key: conf.cle, client_code: lig, ...extra }).then((x) => x.SiteKit || {});
  const dossier = `data/ligues/${lig}`;
  await mkdir(`${dossier}/points`, { recursive: true });

  // 1. Saison en cours : la plus récente qui compte (saison régulière ou séries)
  const saisons = (await mk("seasons")).Seasons || [];
  const saison = saisons.find((s) => s.career === "1") || saisons[0];
  const sid = saison.season_id;

  // 2. Équipes (clé unique : ligue_code, ex. ahl_LAV)
  const equipes = {}, parIdEquipe = {};
  for (const t of (await mk("teamsbyseason", { season_id: sid })).Teamsbyseason || []) {
    const cle = `${lig}_${t.code}`;
    const nom = conf.francais ? `${t.nickname} de ${t.city}` : `${t.city} ${t.nickname}`;
    equipes[cle] = { abr: t.code.toUpperCase(), nom, court: t.nickname, div: tr(t.division_long_name), id: t.id };
    parIdEquipe[t.id] = cle;
  }

  // 3. Effectifs
  const joueurs = [], parId = new Map();
  for (const [cle, e] of Object.entries(equipes)) {
    let ro = [];
    try { ro = (await mk("roster", { team_id: e.id, season_id: sid })).Roster || []; } catch (er) { console.warn(lig, e.abr, er.message); }
    for (const p of Array.isArray(ro) ? ro : []) {
      const pos = POSITIONS[p.position];
      if (!pos || !p.player_id || parId.has(p.player_id)) continue;
      const j = { id: `${lig}-${p.player_id}`, nom: `${p.first_name} ${p.last_name}`.trim(), no: p.tp_jersey_number ? Number(p.tp_jersey_number) : null, pos, eq: cle };
      parId.set(p.player_id, j); joueurs.push(j);
    }
  }

  // 4. Stats de la saison (patineurs puis gardiens)
  const patineurs = (await mk("statviewtype", { type: "topscorers", season_id: sid, first: 0, limit: 2000 })).Statviewtype || [];
  for (const s of patineurs) {
    const j = parId.get(s.player_id);
    if (j && j.pos !== "G") {
      j.s = { pj: n(s.games_played), b: n(s.goals), a: n(s.assists), pts: n(s.points), pm: n(s.plus_minus),
        tirs: n(s.shots), bav: n(s.power_play_goals), bin: n(s.short_handed_goals), bg: n(s.game_winning_goals), pun: n(s.penalty_minutes),
        mj: n(s.faceoff_attempts) > 0 ? +(n(s.faceoff_wins) / n(s.faceoff_attempts)).toFixed(3) : null };
      if (s.rookie === "1") j.r = 1;
    }
  }
  const gardiens = (await mk("statviewtype", { type: "topgoalies", season_id: sid, first: 0, limit: 500 })).Statviewtype || [];
  for (const g of gardiens) {
    const j = parId.get(g.player_id);
    if (j) j.g = { pj: n(g.games_played), v: n(g.wins), d: n(g.losses), dp: g.non_reg_losses != null && g.non_reg_losses !== "" ? n(g.non_reg_losses) : n(g.ot_losses) + n(g.shootout_losses),
      moy: dec(g.goals_against_average, 2), pct: dec(g.save_percentage, 3), bl: n(g.shutouts) };
    if (j && g.rookie === "1") j.r = 1;
  }
  for (const j of joueurs) {
    if (j.pos === "G" && !j.g) j.g = { pj: 0, v: 0, d: 0, dp: 0, moy: null, pct: null };
    if (j.pos !== "G" && !j.s) j.s = { pj: 0, b: 0, a: 0, pts: 0, pm: 0 };
  }

  // 5. Classement
  const classement = [];
  let assoc = "";
  for (const r of (await mk("statviewtype", { type: "standings", stat: "conference", season_id: sid })).Statviewtype || []) {
    if (r.repeatheader) { assoc = tr(r.name); continue; }
    const cle = parIdEquipe[r.team_id] || `${lig}_${r.team_code}`;
    if (!equipes[cle]) continue;
    equipes[cle].conf = assoc;
    classement.push({ eq: cle, pj: n(r.games_played), v: n(r.wins), d: n(r.losses), dp: n(r.ot_losses) + n(r.shootout_losses),
      pts: n(r.points), bp: n(r.goals_for), bc: n(r.goals_against), div: equipes[cle].div, conf: assoc,
      serie: (r.streak_wl || "").replace(/^(\d+)([WL])$/, "$2$1") });
  }

  // 6. Calendrier
  const calendrier = [];
  for (const g of (await mk("schedule", { season_id: sid })).Schedule || []) {
    const dom = parIdEquipe[g.home_team], ext = parIdEquipe[g.visiting_team];
    if (!dom || !ext) continue;
    const fini = g.final === "1", direct = !fini && g.started === "1";
    const m = { id: `${lig}-${g.game_id}`, date: g.date_played, debut: g.GameDateISO8601 ? new Date(g.GameDateISO8601).toISOString() : null,
      dom, ext, etat: fini ? "fini" : direct ? "direct" : "avenir" };
    if (fini || direct) { m.sd = n(g.home_goal_count); m.se = n(g.visiting_goal_count); }
    if (fini && g.shootout === "1") m.fin = "SO"; else if (fini && n(g.overtime) > 0) m.fin = "OT";
    if (saison.playoff === "1") m.series = true;
    calendrier.push(m);
  }
  calendrier.sort((a, b) => (a.debut || a.date).localeCompare(b.debut || b.date));

  // 7. Stats de chaque joueur, match par match (seulement les matchs pas encore traités)
  //    Même format que la LNH : patineur [B, A, +/-, tirs, PUN, ""] ; gardien ["G", arrêts, tirs, BC, décision, ""]
  const traites = new Set(await lireJson(`${dossier}/traites-v2.json`, []));
  const points = {};
  for (const cle of Object.keys(equipes)) points[cle] = traites.size ? await lireJson(`${dossier}/points/${cle}.json`, {}) : {};
  for (const m of calendrier) {
    if (m.etat === "avenir" || traites.has(m.id)) continue;
    try {
      const gs = (await lire({ feed: "gc", tab: "gamesummary", game_id: m.id.split("-")[1], key: conf.cle, client_code: lig })).GC?.Gamesummary;
      if (!gs) continue;
      const finalDom = n(gs.home?.goals ?? m.sd), finalExt = n(gs.visitor?.goals ?? m.se);
      for (const [cote, cle, gagne] of [["home_team_lineup", m.dom, finalDom > finalExt], ["visitor_team_lineup", m.ext, finalExt > finalDom]]) {
        const ligne = {};
        for (const p of gs[cote]?.players || []) {
          ligne[`${lig}-${p.player_id}`] = [n(p.goals), n(p.assists), n(p.plusminus), n(p.shots), n(p.pim), ""];
        }
        for (const g of gs[cote]?.goalies || []) {
          const sa = n(g.shots_against), ga = n(g.goals_against);
          const temps = g.time || g.minutes_played || "";
          if (!sa && !ga && (!temps || /^0+:?0*$/.test(temps))) continue;
          const sv = g.saves != null && g.saves !== "" ? n(g.saves) : sa - ga;
          ligne[`${lig}-${g.player_id}`] = ["G", sv, sa, ga, g.decision || "", String(temps)];
        }
        if (points[cle]) points[cle][m.id] = ligne;
      }
      if (m.etat === "fini") {
        traites.add(m.id);
      }
    } catch (e) { console.warn(lig, "sommaire", m.id, e.message); }
  }

  // 8. On écrit seulement ce qui a changé
  let change = false;
  async function ecrire(f, contenu) {
    const nouveau = JSON.stringify(contenu);
    if ((await readFile(f, "utf8").catch(() => null)) === nouveau) return;
    await writeFile(f, nouveau); change = true;
  }
  for (const e of Object.values(equipes)) delete e.id;
  await ecrire(`${dossier}/calendrier.json`, calendrier);
  for (const cle of Object.keys(equipes)) await ecrire(`${dossier}/points/${cle}.json`, points[cle]);
  await ecrire(`${dossier}/traites-v2.json`, [...traites].sort());
  const ancien = await lireJson(`${dossier}/infos.json`, null);
  const contenu = { saison: saison.season_name, equipes, joueurs, classement };
  if (change || !ancien || JSON.stringify({ ...ancien, misAJour: undefined }) !== JSON.stringify({ ...contenu, misAJour: undefined })) {
    await writeFile(`${dossier}/infos.json`, JSON.stringify({ misAJour: new Date().toISOString(), ...contenu }));
  }
  console.log(`${conf.nom} : ${Object.keys(equipes).length} équipes, ${joueurs.length} joueurs, ${calendrier.length} matchs.`);
}

let erreurs = 0;
for (const [lig, conf] of Object.entries(LIGUES)) {
  try { await uneLigue(lig, conf); } catch (e) { erreurs++; console.error(`${conf.nom} : problème —`, e.message); }
}
if (erreurs === Object.keys(LIGUES).length) process.exit(1);
