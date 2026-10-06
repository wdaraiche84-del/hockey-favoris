// Temporaire : sonder les routes de la SHL
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36", Accept: "application/json" };
const forme = (o, d = 0) => {
  if (Array.isArray(o)) return o.length ? `[${o.length}× ${forme(o[0], d + 1)}]` : "[]";
  if (o && typeof o === "object") return d > 5 ? "{…}" : "{" + Object.entries(o).slice(0, 40).map(([k, v]) => `${k}:${forme(v, d + 1)}`).join(", ") + "}";
  return JSON.stringify(o)?.slice(0, 40);
};
async function voir(u, n = 300) {
  try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(20000) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    console.log(`\n### ${r.status} ${u.replace("https://www.shl.se/api", "")}\n${(j ? forme(j) : t.slice(0, 150)).slice(0, 1500)}\n${r.ok ? t.slice(0, n).replace(/\s+/g, " ") : ""}`); return j; } catch (e) { console.log(`\n### ERREUR ${u} ${e.message}`); }
}
const A = "https://www.shl.se/api";
const ssgt = "qa98unlbd6", game = "yfdggwdkd6", team = "8e6f-8e6fUXJvi", season = "ndcf81nlb3", series = "qQ9-bb0bzEWUk", gt = "qQ9-af37Ti40B";
const routes = ["/statistics-v2/league-standings", "/statistics-v2/stats-info", "/statistics-v2/overview", "/statistics-v2/featured/athlete/leaderboard", "/sports-v2/athletes/by-team-uuid", "/sports-v2/athlete-details",
  "/gameday/boxscore", "/gameday/player-stats", "/gameday/game-overview", "/gameday/team-stats", "/gameday/gameheader", "/gameday/play-by-play", "/statistics-v2/athlete/playerProfile_seasonGameLog", "/sports-v2/teams", "/statistics-v2/layout-info"];
for (const r of routes) await voir(A + r);
// Essais avec paramètres
for (const u of [
  `/statistics-v2/league-standings?ssgtUuid=${ssgt}`, `/statistics-v2/league-standings/${ssgt}`,
  `/statistics-v2/stats-info?ssgtUuid=${ssgt}`, `/statistics-v2/overview?ssgtUuid=${ssgt}`,
  `/sports-v2/athletes/by-team-uuid?teamUuid=${team}`, `/sports-v2/athletes/by-team-uuid/${team}`,
  `/gameday/boxscore/${game}`, `/gameday/boxscore?gameUuid=${game}`, `/gameday/player-stats/${game}`, `/gameday/game-overview/${game}`, `/gameday/play-by-play/${game}`, `/gameday/gameheader/${game}`,
]) await voir(A + u, 1500);
