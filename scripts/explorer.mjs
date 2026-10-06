// Outil temporaire : vérifie quelles sources de données européennes répondent.
const ESSAIS = {
  "KHL (appli mobile)": "https://khl.api.webcaster.pro/api/khl_mobile/stages_v2",
  "KHL matchs": "https://khl.api.webcaster.pro/api/khl_mobile/events_v2?q[stage_id_in][]=1288",
  "KHL site": "https://www.khl.ru/api/calendar/",
  "Liiga matchs": "https://liiga.fi/api/v2/games?tournament=runkosarja&season=2027",
  "Liiga classement": "https://liiga.fi/api/v2/standings/?season=2027",
  "SHL": "https://www.shl.se/api/sports-v2/season-series-game-types-filter",
  "SHL horaire": "https://www.shl.se/api/sports-v2/game-schedule",
  "Suisse NL": "https://www.sihf.ch/Statistic/api/cms/cache300?alias=results&searchQuery=1//1&filterQuery=2027/1/&orderBy=gameLast&orderByDescending=true&take=20&filterBy=Season,League&callback=externalStatisticsCallback&skip=-1&language=fr",
  "Allemagne DEL": "https://www.penny-del.org/api/v2/stats/standings",
  "Tchéquie": "https://www.hokej.cz/api/",
  "API-Sports (sans clé)": "https://v1.hockey.api-sports.io/status",
};
for (const [nom, url] of Object.entries(ESSAIS)) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (hockey-favoris)", Accept: "application/json" } });
    const t = await r.text();
    console.log(`\n### ${nom} → ${r.status} ${r.headers.get("content-type")}\n${t.slice(0, 700)}`);
  } catch (e) { console.log(`\n### ${nom} → ERREUR ${e.message}`); }
}
