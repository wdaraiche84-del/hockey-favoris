// Temporaire : sonder la SHL (Suède)
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36", Accept: "application/json" };
const forme = (o, d = 0) => {
  if (Array.isArray(o)) return o.length ? `[${o.length}× ${forme(o[0], d + 1)}]` : "[]";
  if (o && typeof o === "object") return d > 6 ? "{…}" : "{" + Object.entries(o).map(([k, v]) => `${k}:${forme(v, d + 1)}`).join(", ") + "}";
  return JSON.stringify(o)?.slice(0, 40);
};
async function voir(u, n = 500) {
  try { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(20000) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    console.log(`\n### ${r.status} ${u}\n${j ? forme(j) : ""}\n${t.slice(0, n).replace(/\s+/g, " ")}`); return j; } catch (e) { console.log(`\n### ERREUR ${u} ${e.message}`); }
}
const S = "https://www.shl.se";
const q = "seasonUuid=ndcf81nlb3&seriesUuid=qQ9-bb0bzEWUk&gameTypeUuid=qQ9-af37Ti40B";
const sch = await voir(`${S}/api/sports-v2/game-schedule?${q}`, 1500);
// Chercher les routes d'API dans le code du site
const pages = ["/", "/statistik/spelare", "/tabell", "/matcher", "/lag"];
const routes = new Set(), scripts = new Set();
for (const p of pages) {
  const r = await fetch(S + p, { headers: UA }); const h = await r.text();
  console.log(`page ${p} → ${r.status}`);
  for (const m of h.matchAll(/\/api\/[a-zA-Z0-9\-_/]+/g)) routes.add(m[0]);
  for (const m of h.matchAll(/(?:src|href)="([^"]+\.js[^"]*)"/g)) scripts.add(m[1].startsWith("http") ? m[1] : S + (m[1].startsWith("/") ? "" : "/") + m[1]);
  if (p === "/statistik/spelare") console.log("extrait:", [...h.matchAll(/.{60}(api|uuid|Uuid).{100}/g)].slice(0, 15).map((m) => m[0]).join("\n"));
}
for (const s of scripts) { const t = await (await fetch(s, { headers: UA })).text(); for (const m of t.matchAll(/["'`](\/?(?:api\/)?(?:sports|statistics|stats|sports-v2|statistics-v2|gameday|game|player|team|standings|league)[a-zA-Z0-9\-_/${}.]*)["'`]/g)) routes.add(m[1]); }
console.log(`\n${scripts.size} scripts\nROUTES:\n` + [...routes].filter((r) => r.length > 4).slice(0, 200).join("\n"));
const g = (Array.isArray(sch) ? sch : sch?.gameInfo || sch?.games || []);
console.log("\nexemple match:", JSON.stringify(g?.[0] || sch).slice(0, 1500));
