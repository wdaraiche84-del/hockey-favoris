// Temporaire : trouver les API des sites de la SHL, de la National League (Suisse) et de la DEL
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };
async function txt(u) { try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(20000) }); return [r.status, await r.text()]; } catch (e) { return [0, e.message]; } }
for (const site of ["https://www.shl.se/", "https://www.nationalleague.ch/fr", "https://www.sihf.ch/fr/game-center/national-league/", "https://www.penny-del.org/", "https://www.hokej.cz/tipsport-extraliga"]) {
  const [st, h] = await txt(site);
  console.log(`\n##### ${site} → ${st} (${h.length} car.)`);
  const base = new URL(site);
  const scripts = [...h.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => new URL(m[1], base).href).slice(0, 40);
  const trouve = new Set();
  const scan = (t) => { for (const m of t.matchAll(/["'`]((?:https?:\/\/[a-z0-9.\-]+)?\/?(?:api|Statistic|statistic|feed|data)\/[A-Za-z0-9_\-\/{}.$?=&]{3,120})["'`]/g)) trouve.add(m[1]); for (const m of t.matchAll(/https?:\/\/[a-z0-9.\-]*(api|data|stats?)[a-z0-9.\-]*\.[a-z]{2,}[A-Za-z0-9_\-\/]*/g)) trouve.add(m[0]); };
  scan(h);
  for (const s of scripts) { const [, t] = await txt(s); scan(t); }
  console.log([...trouve].slice(0, 120).join("\n"));
}
