// Temporaire : sonder l'API de la National League (Suisse) et la SHL
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36", Accept: "application/json" };
const forme = (o, d = 0) => {
  if (Array.isArray(o)) return o.length ? `[${o.length}× ${forme(o[0], d + 1)}]` : "[]";
  if (o && typeof o === "object") return d > 5 ? "{…}" : "{" + Object.entries(o).map(([k, v]) => `${k}:${forme(v, d + 1)}`).join(", ") + "}";
  return JSON.stringify(o)?.slice(0, 40);
};
async function voir(u, n = 600) {
  try {
    const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(20000) }); const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch {}
    console.log(`\n### ${r.status} ${u}\n${j ? forme(j) : t.slice(0, 200).replace(/\s+/g, " ")}\n${t.slice(0, n).replace(/\s+/g, " ")}`);
    return j;
  } catch (e) { console.log(`\n### ERREUR ${u} ${e.message}`); }
}
const N = "https://www.nationalleague.ch/api/";
const teams = await voir(N + "teams", 1200);
const games = await voir(N + "games", 1500);
await voir(N + "games/current", 800);
const tops = await voir(N + "player/topscorer", 1500);
await voir(N + "player", 1500);
const tid = Array.isArray(teams) ? (teams[0]?.teamId ?? teams[0]?.id) : null;
if (tid) await voir(N + `player/team/${tid}`, 2000);
const liste = Array.isArray(games) ? games : games?.games || games?.data || [];
const fini = liste.find?.((g) => /final|finish|ended|played/i.test(JSON.stringify(g).slice(0, 2000)) ) || liste[0];
const gid = fini?.gameId ?? fini?.id;
if (gid) await voir(N + `games/${gid}`, 4000);
const pid = (Array.isArray(tops) ? tops[0] : null)?.playerId;
if (pid) await voir(N + `player/${pid}`, 2500);
// SHL
const [, h] = await fetch("https://www.shl.se/", { headers: UA }).then(async (r) => [r.status, await r.text()]);
console.log("\n##### SHL indices:", [...new Set([...h.matchAll(/[a-zA-Z\-\/]*(sports-v2|statistics-v2|api\/[a-z\-]+|seasonUuid|seriesUuid|gameUuid)[a-zA-Z0-9\-\/=?&"]{0,80}/g)].map((m) => m[0]))].slice(0, 60).join("\n"));
for (const u of ["https://www.shl.se/api/sports-v2/game-schedule", "https://www.shl.se/api/sports/game-info", "https://www.shl.se/api/sports-v2/season-series-game-types-filter", "https://www.shl.se/api/statistics-v2/player"]) await voir(u, 800);
