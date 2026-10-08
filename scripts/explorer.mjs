// Temporaire : copier des pages de College Hockey News pour écrire le robot NCAA
import { mkdir, writeFile } from "node:fs/promises";
const UA = { "User-Agent": "Mozilla/5.0 (MonTrio, site de fan)" };
const B = "https://www.collegehockeynews.com";
await mkdir("pages", { recursive: true });
const PAGES = {
  "saison.html": "/schedules/season/2026-27",
  "semaine.html": "/schedules/week/2026-10-03",
  "overall.html": "/stats/overall.php",
  "goalie.html": "/stats/overall-goalie.php",
  "horaire-20251010.html": "/schedules/?date=20251010",
  "horaire-20251011.html": "/schedules/?date=20251011",
};
for (const [f, u] of Object.entries(PAGES)) {
  try { const r = await fetch(B + u, { headers: UA }); const t = await r.text(); await writeFile("pages/" + f, t); console.log(r.status, u, t.length); }
  catch (e) { console.log("ERREUR", u, e.message); }
  await new Promise((r) => setTimeout(r, 1000));
}
