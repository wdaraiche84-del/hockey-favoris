// Temporaire : champs disponibles pour les stats avancées et les recrues
const UA = { "User-Agent": "Mozilla/5.0 (MonTrio)", Accept: "application/json" };
const j = async (u) => { try { const r = await fetch(u, { headers: UA }); const t = await r.text(); return [r.status, t]; } catch (e) { return [0, e.message]; } };
const voir = async (titre, u, n = 1500) => { const [s, t] = await j(u); console.log(`\n### ${titre} ${s} ${u}\n${t.slice(0, n)}`); return t; };
await voir("club-stats MTL", "https://api-web.nhle.com/v1/club-stats/MTL/now", 2500);
await voir("recrues stats REST", "https://api.nhle.com/stats/rest/en/skater/summary?isAggregate=false&isGame=false&start=0&limit=5&cayenneExp=" + encodeURIComponent("gameTypeId=2 and seasonId=20262027 and isRookie='1'"), 1500);
await voir("bios REST", "https://api.nhle.com/stats/rest/en/skater/bios?limit=3&cayenneExp=" + encodeURIComponent("gameTypeId=2 and seasonId=20262027"), 1500);
await voir("bracket 2026", "https://api-web.nhle.com/v1/playoff-bracket/2026", 2500);
await voir("ht topscorers ahl", "https://lscluster.hockeytech.com/feed/?feed=modulekit&view=statviewtype&type=topscorers&key=50c2cd9b5e18e390&client_code=ahl&season_id=&first=0&limit=2&fmt=json&lang=en", 2500);
await voir("ht topgoalies ahl", "https://lscluster.hockeytech.com/feed/?feed=modulekit&view=statviewtype&type=topgoalies&key=50c2cd9b5e18e390&client_code=ahl&season_id=&first=0&limit=1&fmt=json&lang=en", 1500);
