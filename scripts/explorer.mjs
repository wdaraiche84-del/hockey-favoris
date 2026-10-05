// Outil temporaire : affiche des échantillons des flux HockeyTech
// pour apprendre leur forme. Sera retiré une fois le robot écrit.
const BASE = "https://lscluster.hockeytech.com/feed/";
const LIGUES = { ahl: "50c2cd9b5e18e390", lhjmq: "f1aa699db3d81487", ohl: "f1aa699db3d81487", whl: "f1aa699db3d81487" };

async function lire(params) {
  const url = BASE + "?" + new URLSearchParams({ fmt: "json", lang: "en", ...params });
  const r = await fetch(url);
  let t = await r.text();
  t = t.trim().replace(/^\(/, "").replace(/\)$/, "");
  try { return JSON.parse(t); } catch { return { _brut: t.slice(0, 400), _statut: r.status }; }
}
const montrer = (titre, x) => console.log(`\n### ${titre}\n` + JSON.stringify(x).slice(0, 1800));
const premier = (o) => { if (Array.isArray(o)) return o.slice(0, 2); return o; };

for (const [code, key] of Object.entries(LIGUES)) {
  console.log(`\n================ ${code} ================`);
  const mk = (view, extra = {}) => lire({ feed: "modulekit", view, key, client_code: code, ...extra });
  const saisons = await mk("seasons");
  const liste = saisons?.SiteKit?.Seasons || [];
  montrer("seasons (5 premières)", liste.slice(0, 5));
  const reg = liste.find((s) => s.career === "1" && s.playoff === "0") || liste[0];
  const sid = reg?.season_id;
  console.log("SAISON CHOISIE", sid, reg?.season_name);
  const eqs = await mk("teamsbyseason", { season_id: sid });
  const teams = eqs?.SiteKit?.Teamsbyseason || [];
  montrer("teamsbyseason (2) + nombre", { n: teams.length, ex: teams.slice(0, 2) });
  if (teams[0]) {
    const ro = await mk("roster", { team_id: teams[0].id, season_id: sid });
    const r = ro?.SiteKit?.Roster || ro;
    montrer("roster (3)", premier(Array.isArray(r) ? r.slice(0, 3) : r));
  }
  const sc = await mk("schedule", { season_id: sid });
  const sch = sc?.SiteKit?.Schedule || [];
  montrer("schedule (n + 1 joué + 1 à venir)", { n: sch.length, joue: sch.find((g) => g.final === "1"), avenir: sch.find((g) => g.final !== "1") });
  const top = await mk("statviewtype", { type: "topscorers", season_id: sid, first: 0, limit: 3 });
  montrer("topscorers", top?.SiteKit?.Statviewtype || top);
  const gk = await mk("statviewtype", { type: "topgoalies", season_id: sid, first: 0, limit: 2 });
  montrer("topgoalies", gk?.SiteKit?.Statviewtype || gk);
  const st = await mk("statviewtype", { type: "standings", stat: "conference", season_id: sid });
  montrer("standings", st?.SiteKit?.Statviewtype || st);
  const sb = await mk("scorebar", { numberofdaysahead: 1, numberofdaysback: 1 });
  montrer("scorebar (1)", (sb?.SiteKit?.Scorebar || []).slice(0, 1));
  const fini = sch.find((g) => g.final === "1");
  if (fini) {
    const gs = await lire({ feed: "gc", tab: "gamesummary", game_id: fini.game_id, key, client_code: code });
    const g = gs?.GC?.Gamesummary;
    montrer("gamesummary clés", g ? Object.keys(g) : gs);
    if (g) {
      montrer("gamesummary home_team_lineup", g.home_team_lineup ? Object.keys(g.home_team_lineup) : null);
      montrer("gamesummary un joueur", g.home_team_lineup?.players?.[0]);
      montrer("gamesummary goals[0]", g.goals?.[0]);
    }
  }
}
// relance
