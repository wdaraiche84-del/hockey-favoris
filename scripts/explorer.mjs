// Temporaire : forme des buts dans /v1/score/now
const r = await fetch("https://api-web.nhle.com/v1/score/now"); const d = await r.json();
const g = (d.games || []).find((x) => (x.goals || []).length) || d.games?.[0];
console.log("clés match:", Object.keys(g || {}).join(", "));
console.log("état:", g?.gameState, "clock:", JSON.stringify(g?.clock), "period:", JSON.stringify(g?.periodDescriptor));
console.log("but:", JSON.stringify(g?.goals?.[0], null, 1)?.slice(0, 2500));
console.log("teams:", JSON.stringify(g?.homeTeam)?.slice(0, 400));
