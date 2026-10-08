// Temporaire : copier des pages de College Hockey News pour écrire le robot NCAA
import { mkdir, writeFile } from "node:fs/promises";
const UA = { "User-Agent": "Mozilla/5.0 (MonTrio, site de fan)" };
const B = "https://www.collegehockeynews.com";
await mkdir("pages", { recursive: true });
const PAGES = {
  "horaire-20261003.html": "/schedules/?date=20261003",
  "horaire-20261010.html": "/schedules/?date=20261010",
  "horaire.html": "/schedules/",
  "box-nia-rit.html": "/box/final/20261003/nia/rit/",
  "classement.html": "/reports/standings.php",
  "stats-michigan.html": "/stats/team/Michigan/31",
  "alignement-michigan.html": "/reports/roster/Michigan/31",
  "calendrier-michigan.html": "/schedules/team/Michigan/31",
  "equipes.html": "/reports/team/",
};
for (const [f, u] of Object.entries(PAGES)) {
  try { const r = await fetch(B + u, { headers: UA }); const t = await r.text(); await writeFile("pages/" + f, t); console.log(r.status, u, t.length); }
  catch (e) { console.log("ERREUR", u, e.message); }
  await new Promise((r) => setTimeout(r, 1000));
}
