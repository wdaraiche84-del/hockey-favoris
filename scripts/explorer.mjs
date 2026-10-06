// Outil temporaire : 2e tour d'exploration (KHL et Liiga).
const K = "https://khl.api.webcaster.pro/api/khl_mobile";
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36", Accept: "application/json, text/html" };
async function essai(nom, url, n = 1500) {
  try { const r = await fetch(url, { headers: UA }); const t = await r.text(); console.log(`\n### ${nom} → ${r.status} ${r.headers.get("content-type")}\n${t.slice(0, n)}`); return t; }
  catch (e) { console.log(`\n### ${nom} → ERREUR ${e.message}`); }
}
const ev = JSON.parse(await essai("KHL events terminés", `${K}/events_v2?q[game_state_key_eq]=finished&order_direction=desc`, 600) || "[]");
const fini = ev.find((e) => e.event?.game_state_key === "finished")?.event;
console.log("STAGE", fini?.stage_id, "ID", fini?.id, "KHL_ID", fini?.khl_id);
if (fini) {
  await essai("KHL un match", `${K}/event_v2?id=${fini.id}`, 3000);
  await essai("KHL un match (2)", `${K}/events/${fini.id}`, 1500);
  await essai("KHL protocole", `${K}/protocol_v2?id=${fini.id}`, 1500);
}
await essai("KHL stages (stage_id)", `${K}/stages?q[id_eq]=407`, 800);
await essai("KHL players stage", `${K}/players_v2?stage_id=407`, 800);
await essai("KHL teams stage", `${K}/teams_v2?stage_id=407`, 800);
await essai("KHL players_stat", `${K}/players_stat_v2?stage_id=407`, 800);
await essai("KHL table stage", `${K}/table_v2?stage_id=407`, 800);
await essai("khl.ru stats HTML", "https://www.khl.ru/stat/players/1288/", 400);
await essai("en.khl.ru stats HTML", "https://en.khl.ru/stat/players/1288/", 400);
await essai("Liiga classement", "https://liiga.fi/api/v2/standings/?season=2027", 600);
const jeux = JSON.parse(await essai("Liiga matchs", "https://liiga.fi/api/v2/games?tournament=runkosarja&season=2027", 200) || "[]");
const j = jeux.find((g) => g.ended);
console.log("LIIGA match terminé", j && JSON.stringify({ id: j.id, start: j.start, home: j.homeTeam?.teamName, hg: j.homeTeam?.goals, away: j.awayTeam?.teamName, ag: j.awayTeam?.goals, finishedType: j.finishedType, ended: j.ended }));
if (j) await essai("Liiga détail match", `https://liiga.fi/api/v2/games/2027/${j.id}`, 2500);
const st = JSON.parse(await essai("Liiga stats (rapide)", "https://liiga.fi/api/v2/players/stats/summed/2027/2027/runkosarja/true?dataType=basicStats", 50) || "[]");
console.log("LIIGA joueurs :", st.length, "avec matchs :", st.filter((p) => p.games > 0).length, "gardiens :", st.filter((p) => p.goalkeeper).length);
console.log("UN GARDIEN", JSON.stringify(st.find((p) => p.goalkeeper && p.games > 0)).slice(0, 900));
