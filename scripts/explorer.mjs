// Temporaire : déroulement d'un match LNH, stats d'équipe, classement HockeyTech
const j = async (u) => (await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (MonTrio)" } })).json();
const l = await j("https://api-web.nhle.com/v1/gamecenter/2026020040/landing");
console.log("SUMMARY KEYS:", Object.keys(l.summary || {}).join(", "));
console.log("SCORING[0]:", JSON.stringify(l.summary?.scoring?.[0]).slice(0, 1800));
console.log("SHOTS BY PERIOD:", JSON.stringify(l.summary?.shotsByPeriod || l.summary?.teamGameStats)?.slice(0, 600));
const t = await j("https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=" + encodeURIComponent("gameTypeId=2 and seasonId=20262027"));
console.log("TEAM SUMMARY:", JSON.stringify(t.data?.[0]).slice(0, 900));
const st = await j("https://api-web.nhle.com/v1/standings/now");
console.log("STANDINGS name:", JSON.stringify(st.standings?.[0]?.teamName), JSON.stringify(st.standings?.[0]?.teamCommonName));
const h = await j("https://lscluster.hockeytech.com/feed/?feed=modulekit&view=statviewtype&type=standings&stat=conference&key=f1aa699db3d81487&client_code=lhjmq&fmt=json&lang=en");
console.log("HT STANDINGS ROW:", JSON.stringify((h.SiteKit?.Statviewtype || []).find((r) => !r.repeatheader)).slice(0, 1500));
