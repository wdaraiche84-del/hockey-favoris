// Temporaire : quelles sources publient le hockey NCAA?
const UA = { "User-Agent": "Mozilla/5.0 (MonTrio, site de fan)" };
async function voir(url, n = 1500) {
  try {
    const r = await fetch(url, { headers: UA });
    const t = await r.text();
    console.log(`\n===== ${r.status} ${r.headers.get("content-type")} ${url} (${t.length} car.)`);
    console.log(t.slice(0, n));
    try { return JSON.parse(t); } catch { return t; }
  } catch (e) { console.log(`\n===== ERREUR ${url} : ${e.message}`); return null; }
}
const cles = (o, p = "", prof = 0) => { if (!o || typeof o !== "object" || prof > 3) return; for (const [k, v] of Object.entries(o).slice(0, 25)) { console.log(`${p}${k}: ${Array.isArray(v) ? `[${v.length}]` : typeof v === "object" && v ? "{}" : JSON.stringify(v)?.slice(0, 80)}`); if (v && typeof v === "object") cles(Array.isArray(v) ? v[0] : v, p + "  ", prof + 1); } };

// --- ESPN ---
const E = "https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey";
for (const d of ["20261003", "20261004", "20261010"]) {
  const s = await voir(`${E}/scoreboard?dates=${d}&limit=200&groups=50`, 600);
  if (s?.events) console.log("ESPN matchs", d, ":", s.events.length, s.events.slice(0, 3).map((e) => `${e.id} ${e.name} ${e.status?.type?.name}`));
  if (d === "20261003" && s?.events?.[0]) { console.log("--- structure d'un match"); cles(s.events[0]); }
}
const sb = await voir(`${E}/scoreboard?dates=20261003&limit=200`, 0);
const ev = sb?.events?.find((e) => e.status?.type?.completed) || sb?.events?.[0];
if (ev) {
  const sm = await voir(`${E}/summary?event=${ev.id}`, 300);
  if (sm && typeof sm === "object") { console.log("--- summary"); cles(sm); console.log("--- boxscore.players[0]"); console.log(JSON.stringify(sm.boxscore?.players?.[0])?.slice(0, 3000)); }
}
await voir(`${E}/teams?limit=100`, 500);
await voir("https://site.api.espn.com/apis/v2/sports/hockey/mens-college-hockey/standings", 1500);
await voir(`${E}/standings`, 500);

// --- NCAA.com ---
const N = "https://data.ncaa.com/casablanca";
const ns = await voir(`${N}/scoreboard/icehockey-men/d1/2026/10/03/scoreboard.json`, 800);
const g = ns?.games?.[0]?.game;
if (g) {
  console.log("--- structure NCAA"); cles(ns.games[0]);
  const id = g.gameID || g.url?.split("/").pop();
  const bx = await voir(`${N}/game/${id}/boxscore.json`, 2500);
  await voir(`https://data.ncaa.com/casablanca/game/${id}/gameInfo.json`, 800);
}
await voir("https://www.ncaa.com/standings/icehockey-men/d1", 300);
await voir("https://www.ncaa.com/stats/icehockey-men/d1/current/individual/566", 300);

// --- Autres ---
await voir("https://www.collegehockeynews.com/stats/", 300);
await voir("https://www.uscho.com/standings/d-i-men/", 300);
await voir("https://www.collegehockeystats.net/", 300);
