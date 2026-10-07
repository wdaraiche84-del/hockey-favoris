const H = { headers: { "User-Agent": "hockey-favoris (site de fan)" } };
const exp = encodeURIComponent("gameTypeId=2 and seasonId=20262027");
for (const u of ["skater/realtime", "skater/summary", "skater/timeonice", "skater/powerplay", "goalie/summary", "goalie/advanced", "skater/puckPossessions", "skater/faceoffwins", "skater/penalties", "skater/shottype"]) {
  try {
    const r = await fetch(`https://api.nhle.com/stats/rest/en/${u}?isAggregate=false&isGame=false&start=0&limit=1&sort=%5B%7B%22property%22:%22gamesPlayed%22,%22direction%22:%22DESC%22%7D%5D&cayenneExp=${exp}`, H);
    const j = await r.json();
    console.log("==", u, r.status, j.total, JSON.stringify(j.data?.[0]));
  } catch (e) { console.log("==", u, e.message); }
}
// EDGE
for (const u of ["https://api-web.nhle.com/v1/edge/skater-detail/8480018/now", "https://api-web.nhle.com/v1/edge/skater-landing/now"]) {
  try { const r = await fetch(u, H); console.log("==", u, r.status, (await r.text()).slice(0, 1500)); } catch (e) { console.log(e.message); }
}
