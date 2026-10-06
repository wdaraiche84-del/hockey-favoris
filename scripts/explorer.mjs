// Temporaire : détail des stats par match de la SHL
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36", Accept: "application/json" };
const j = async (u) => (await fetch("https://www.shl.se/api" + u, { headers: UA })).json();
const ps = await j("/gameday/player-stats/yfdggwdkd6");
console.log("CLÉS:", Object.keys(ps));
for (const [k, v] of Object.entries(ps)) console.log(`\n== ${k}:`, JSON.stringify(v).slice(0, 2500));
const ls = await j("/statistics-v2/league-standings?ssgtUuid=qa98unlbd6");
console.log("\n== standings[0]:", JSON.stringify(ls.leagueStandings[0]).slice(0, 1500));
console.log("\n== colonnes:", ls.dataColumn.map((c) => `${c.key}/${c.shortKey}`).join(", "));
const sch = await j("/sports-v2/game-schedule?seasonUuid=ndcf81nlb3&seriesUuid=qQ9-bb0bzEWUk&gameTypeUuid=qQ9-af37Ti40B");
console.log("\n== états:", [...new Set(sch.gameInfo.map((g) => g.state))], "équipes:", sch.teamList.map((t) => `${t.teamCode}=${t.teamNames.long}|${t.teamNames.short}|${t.uuid}`).join(" ; "));
