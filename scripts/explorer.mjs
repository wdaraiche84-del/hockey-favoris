// Temporaire : 2e tour, stats des joueurs NCAA
const UA = { "User-Agent": "Mozilla/5.0 (MonTrio, site de fan)" };
async function lire(url) { try { const r = await fetch(url, { headers: UA }); const t = await r.text(); console.log(`\n===== ${r.status} ${url} (${t.length} car.)`); return t; } catch (e) { console.log(`\n===== ERREUR ${url} ${e.message}`); return ""; } }
const liens = (t, re) => [...new Set([...t.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => re.test(h)))];
const texte = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

// --- College Hockey News ---
let t = await lire("https://www.collegehockeynews.com/stats/");
console.log(liens(t, /stats|box|team/).slice(0, 60).join("\n"));
const i = t.indexOf("<table"); console.log(t.slice(i, i + 2500));
t = await lire("https://www.collegehockeynews.com/schedules/?date=20261003");
const box = liens(t, /box/); console.log(box.slice(0, 15).join("\n"));
if (box[0]) { const b = await lire(new URL(box[0], "https://www.collegehockeynews.com").href); console.log(texte(b).slice(0, 4000)); const j = b.indexOf("<table"); console.log(b.slice(j, j + 3000)); }
t = await lire("https://www.collegehockeynews.com/reports/team/Michigan/31");
console.log(liens(t, /stats|roster|team|player/).slice(0, 40).join("\n"));
t = await lire("https://www.collegehockeynews.com/stats/team/Michigan/31");
console.log(texte(t).slice(0, 3000));
t = await lire("https://www.collegehockeynews.com/standings/");
console.log(texte(t).slice(0, 1500));
t = await lire("https://www.collegehockeynews.com/robots.txt"); console.log(t.slice(0, 1500));

// --- NCAA.com ---
t = await lire("https://www.ncaa.com/stats/icehockey-men/d1");
console.log(liens(t, /stats\/icehockey/).slice(0, 40).join("\n"));
t = await lire("https://www.ncaa.com/scoreboard/icehockey-men/d1/2026/10/03/all-conf");
console.log(liens(t, /game\//).slice(0, 10).join("\n"));
console.log((t.match(/https?:\/\/[a-z.]*ncaa\.com\/[^"' ]*(json|graphql)[^"' ]*/g) || []).slice(0, 10).join("\n"));
const g = liens(t, /^\/game\/\d+/)[0];
if (g) { const b = await lire("https://www.ncaa.com" + g + "/boxscore"); console.log((b.match(/https?:\/\/[a-z.]*ncaa\.com\/[^"' ]*/g) || []).filter((u) => /json|graphql|sdata/.test(u)).slice(0, 10).join("\n")); console.log(texte(b).slice(0, 2000)); }

// --- ESPN : stats par équipe / athlète ---
const E = "https://site.api.espn.com/apis/site/v2/sports/hockey/mens-college-hockey";
const eq = JSON.parse((await lire(`${E}/teams?limit=200`)) || "{}").sports?.[0]?.leagues?.[0]?.teams?.map((x) => x.team) || [];
console.log("équipes ESPN :", eq.length);
const mich = eq.find((x) => /Michigan Wolverines/.test(x.displayName));
if (mich) {
  console.log("Michigan id", mich.id);
  t = await lire(`${E}/teams/${mich.id}/roster`); console.log(t.slice(0, 1500));
  t = await lire(`${E}/teams/${mich.id}/statistics`); console.log(t.slice(0, 1500));
  t = await lire(`https://site.web.api.espn.com/apis/common/v3/sports/hockey/mens-college-hockey/teams/${mich.id}/statistics`); console.log(t.slice(0, 800));
  const ros = JSON.parse((await lire(`${E}/teams/${mich.id}/roster`)) || "{}");
  const a = (ros.athletes || []).flatMap((x) => x.items || [x]).find((x) => /Hage/.test(x.fullName || "")) || (ros.athletes || []).flatMap((x) => x.items || [x])[0];
  if (a) { console.log("athlète", a.id, a.fullName); t = await lire(`https://site.web.api.espn.com/apis/common/v3/sports/hockey/mens-college-hockey/athletes/${a.id}/stats`); console.log(t.slice(0, 1500)); t = await lire(`https://sports.core.api.espn.com/v2/sports/hockey/leagues/mens-college-hockey/seasons/2027/types/2/athletes/${a.id}/statistics`); console.log(t.slice(0, 1500)); }
}
t = await lire("https://site.api.espn.com/apis/v2/sports/hockey/mens-college-hockey/standings?season=2027"); console.log(t.slice(0, 2500));
