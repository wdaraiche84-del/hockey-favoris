// Temporaire : 3e tour, structure des pages de College Hockey News
const UA = { "User-Agent": "Mozilla/5.0 (MonTrio, site de fan)" };
const B = "https://www.collegehockeynews.com";
async function lire(url) { try { const r = await fetch(url, { headers: UA }); const t = await r.text(); console.log(`\n\n######## ${r.status} ${url} (${t.length} car.)`); return t; } catch (e) { console.log(`\n######## ERREUR ${url} ${e.message}`); return ""; } }
const propre = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, "").replace(/\s+/g, " ").replace(/> </g, "><");
const tables = (h, n = 3, max = 3500) => { const p = propre(h); let i = 0, k = 0; while (k < n && (i = p.indexOf("<table", i)) >= 0) { console.log(`--- table ${k}:`, p.slice(i, i + max)); i++; k++; } };
const apres = (h, mot, n = 3000) => { const p = propre(h); const i = p.indexOf(mot); console.log(`--- après « ${mot} » :`, i < 0 ? "(absent)" : p.slice(i, i + n)); };
const liens = (t, re) => [...new Set([...t.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => re.test(h)))];

let t = await lire(`${B}/stats/overall.php`); tables(t, 1, 5000);
t = await lire(`${B}/stats/overall-goalie.php`); tables(t, 1, 3000);
t = await lire(`${B}/stats/team/Michigan/31`); tables(t, 3, 4000);
t = await lire(`${B}/reports/roster/Michigan/31`); tables(t, 1, 3000);
t = await lire(`${B}/schedules/?date=20261003`); apres(t, "Niagara", 3000);
console.log(liens(t, /standings|schedules\/\?date|scoreboard/).slice(0, 30).join("\n"));
t = await lire(`${B}/schedules/?date=20261010`); apres(t, "Michigan", 2500);
t = await lire(`${B}/box/final/20261003/nia/rit/`); tables(t, 12, 3000);
t = await lire(`${B}/`); console.log(liens(t, /standing/i).join("\n"));
for (const u of ["/standings/conference.php", "/reports/standings/", "/standings/index.php", "/ratings/standings.php"]) { t = await lire(B + u); if (t.includes("<table")) tables(t, 1, 2500); }
t = await lire(`${B}/schedules/team/Michigan/31`); tables(t, 1, 3000);
