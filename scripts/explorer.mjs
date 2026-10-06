// Outil temporaire : teste API-Sports (hockey) avec la clé rangée dans les secrets GitHub.
// La clé n'est jamais affichée.
const CLE = process.env.APISPORTS_KEY;
if (!CLE) { console.log("AUCUNE CLÉ : le secret APISPORTS_KEY n'est pas lu."); process.exit(0); }
console.log("Clé trouvée (" + CLE.length + " caractères).");
const BASE = "https://v1.hockey.api-sports.io";
async function api(chemin) {
  const r = await fetch(BASE + chemin, { headers: { "x-apisports-key": CLE } });
  const j = await r.json();
  console.log(`\n### ${chemin} → ${r.status} résultats=${j.results} erreurs=${JSON.stringify(j.errors)} restant=${r.headers.get("x-ratelimit-requests-remaining")}`);
  return j;
}
const st = await api("/status");
console.log(JSON.stringify(st.response).slice(0, 400));
const lg = await api("/leagues?search=KHL");
for (const l of lg.response || []) console.log("LIGUE", l.id, l.name, l.country?.name, JSON.stringify((l.seasons || []).slice(-2)));
const khl = (lg.response || []).find((l) => /^KHL$/i.test(l.name)) || (lg.response || [])[0];
if (khl) {
  const saison = (khl.seasons || []).map((s) => s.season).sort().pop();
  const jeux = await api(`/games?league=${khl.id}&season=${saison}`);
  console.log("NB MATCHS", (jeux.response || []).length, "EXEMPLE", JSON.stringify((jeux.response || []).find((g) => g.status?.short === "FT") || {}).slice(0, 1200));
  const cl = await api(`/standings?league=${khl.id}&season=${saison}`);
  console.log("CLASSEMENT", JSON.stringify(cl.response).slice(0, 800));
  const g = (jeux.response || []).find((x) => x.status?.short === "FT");
  if (g) { const ev = await api(`/games/events?game=${g.id}`); console.log("ÉVÉNEMENTS", JSON.stringify(ev.response).slice(0, 1200)); }
}
