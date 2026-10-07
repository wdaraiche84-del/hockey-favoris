// Temporaire : structure de la fiche d'un joueur (LNH) et des effectifs HockeyTech / KHL
const j = async (u) => (await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (MonTrio)" } })).json();
const l = await j("https://api-web.nhle.com/v1/player/8480018/landing");
const { seasonTotals, last5Games, featuredStats, careerTotals, awards, currentTeamRoster, ...reste } = l;
console.log("CLÉS:", Object.keys(l).join(", "));
console.log("BASE:", JSON.stringify(reste).slice(0, 2500));
console.log("SAISON[0]:", JSON.stringify(seasonTotals?.[0]), "\nSAISON[-1]:", JSON.stringify(seasonTotals?.at(-1)), "\nnb:", seasonTotals?.length);
console.log("AWARDS:", JSON.stringify(awards)?.slice(0, 600));
console.log("CAREER:", JSON.stringify(careerTotals)?.slice(0, 600));
const g = await j("https://api-web.nhle.com/v1/player/8478470/landing");
console.log("GARDIEN SAISON:", JSON.stringify(g.seasonTotals?.at(-1)));
const r = await j("https://lscluster.hockeytech.com/feed/?feed=modulekit&view=roster&key=f1aa699db3d81487&client_code=lhjmq&team_id=1&fmt=json&lang=en");
console.log("HT ROSTER:", JSON.stringify(r.SiteKit?.Roster?.[0]).slice(0, 1200));
