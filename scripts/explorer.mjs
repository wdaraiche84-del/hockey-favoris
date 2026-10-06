// Outil temporaire : teste des accès aux données européennes.
const K = "https://khl.api.webcaster.pro/api/khl_mobile";
const ESSAIS = {
  "KHL events (sans filtre)": `${K}/events_v2`,
  "KHL events page": `${K}/events_v2?page=1`,
  "KHL teams": `${K}/teams_v2`,
  "KHL seasons": `${K}/seasons_v2`,
  "KHL tournaments": `${K}/tournaments_v2`,
  "KHL stages": `${K}/stages`,
  "KHL players": `${K}/players_v2?q[team_id_in][]=1`,
  "KHL table": `${K}/table_v2`,
  "KHL feed": `${K}/feed`,
  "KHL webcaster racine": "https://khl.api.webcaster.pro/api/khl_mobile/",
  "Liiga équipes": "https://liiga.fi/api/v2/teams/info?season=2027",
  "Liiga joueurs stats": "https://liiga.fi/api/v2/players/stats/summed/2027/2027/runkosarja/true?dataType=basicStats",
  "Liiga un match": "https://liiga.fi/api/v2/games/2027/1",
  "SHL saisons/séries": "https://www.shl.se/api/sports-v2/season-series-game-types-filter",
  "SHL équipes": "https://www.shl.se/api/sports-v2/teams",
  "SHL classement": "https://www.shl.se/api/sports-v2/standings",
};
for (const [nom, url] of Object.entries(ESSAIS)) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (MonTrio)", Accept: "application/json" } });
    const t = await r.text();
    console.log(`\n### ${nom} → ${r.status} ${r.headers.get("content-type")}\n${t.slice(0, 1200)}`);
  } catch (e) { console.log(`\n### ${nom} → ERREUR ${e.message}`); }
}
