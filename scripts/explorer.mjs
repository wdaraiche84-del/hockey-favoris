// Temporaire : cherche d'autres sources de stats de joueurs pour la KHL
const B = "https://khl.api.webcaster.pro/api/khl_mobile/";
const UA = { "User-Agent": "Mozilla/5.0 (Linux; Android 14) KHL/5.0", Accept: "application/json" };
async function voir(url, n = 700) {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) });
    const t = await r.text();
    console.log(`\n### ${r.status} ${url}\n${t.slice(0, n).replace(/\s+/g, " ")}`);
    return r.ok ? t : null;
  } catch (e) { console.log(`\n### ERREUR ${url} ${e.message}`); return null; }
}
const p = JSON.parse(await voir(B + "events_v2?order_direction=desc&page=1", 300) || "[]");
const fini = p.map((x) => x.event).find((e) => e?.game_state_key === "finished");
console.log("\n=== Événement fini complet ===\n" + JSON.stringify(fini).slice(0, 5000));
const id = fini?.id, ta = fini?.team_a?.id;
for (const c of [`event_v2?id=${id}`, `events_v2/${id}`, `event_v2/${id}`, `events/${id}`, `event?id=${id}`, `protocol_v2?id=${id}`, `protocol?event_id=${id}`,
  `events_v2/${id}/protocol`, `players_v2`, `players`, `players_v2?team_id=${ta}`, `teams_v2`, `teams`, `team_v2?id=${ta}`, `stat_players_v2`, `players_stats_v2`,
  `tournaments_v2`, `seasons_v2`, `players_v2?q=a`, `top_players_v2`, `leaders_v2`, `bombardiers_v2`, `goalkeepers_v2`])
  await voir(B + c, 900);
for (const u of ["https://www.khl.ru/stat/players/", "https://en.khl.ru/stat/players/", "https://text.khl.ru/", "https://www.khl.ru/game/"]) await voir(u, 200);
