const H = { headers: { "User-Agent": "hockey-favoris (site de fan)" } };
const r = await (await fetch("https://api-web.nhle.com/v1/edge/skater-landing/now", H)).json();
for (const [k, v] of Object.entries(r.leaders || {})) { const c = { ...v }; delete c.overlay; if (c.player) c.player = c.player.id; console.log("EDGE", k, JSON.stringify(c).slice(0, 300)); }
const g = await (await fetch("https://api-web.nhle.com/v1/edge/goalie-landing/now", H)).json().catch(() => ({}));
for (const [k, v] of Object.entries(g.leaders || {})) { const c = { ...v }; delete c.overlay; if (c.player) c.player = c.player.id; console.log("EDGEG", k, JSON.stringify(c).slice(0, 300)); }
const t = await (await fetch("https://lscluster.hockeytech.com/feed/?feed=modulekit&view=seasons&fmt=json&key=50c2cd9b5e18e390&client_code=ahl", H)).json();
const sid = t.SiteKit.Seasons[0].season_id;
const s = await (await fetch(`https://lscluster.hockeytech.com/feed/?feed=modulekit&view=statviewtype&type=topscorers&season_id=${sid}&first=0&limit=1&fmt=json&key=50c2cd9b5e18e390&client_code=ahl`, H)).json();
console.log("HT", sid, JSON.stringify(s.SiteKit.Statviewtype[0]));
const gg = await (await fetch(`https://lscluster.hockeytech.com/feed/?feed=modulekit&view=statviewtype&type=topgoalies&season_id=${sid}&first=0&limit=1&fmt=json&key=50c2cd9b5e18e390&client_code=ahl`, H)).json();
console.log("HTG", JSON.stringify(gg.SiteKit.Statviewtype[0]));
