// Outil temporaire : 3e tour (KHL : pagination et équipes ; Liiga : gardiens)
const K = "https://khl.api.webcaster.pro/api/khl_mobile/events_v2";
const UA = { "User-Agent": "Mozilla/5.0 (MonTrio)", Accept: "application/json" };
const lire = async (u) => { const r = await fetch(u, { headers: UA }); return [r.status, await r.text()]; };
for (const u of [K, `${K}?page=2`, `${K}?per_page=500`, `${K}?q[start_at_lt_time_from_unixtime]=${Math.floor(Date.now()/1000)}`, `${K}?order_direction=asc`]) {
  const [s, t] = await lire(u);
  let l = []; try { l = JSON.parse(t); } catch {}
  const ev = l.map((x) => x.event).filter(Boolean);
  const etats = {}; ev.forEach((e) => (etats[e.game_state_key] = (etats[e.game_state_key] || 0) + 1));
  const dates = ev.map((e) => e.start_at).sort();
  console.log(`\n### ${u} → ${s} n=${ev.length} états=${JSON.stringify(etats)} de ${new Date(dates[0]).toISOString?.()} à ${dates.length ? new Date(dates[dates.length - 1]).toISOString() : ""} stages=${[...new Set(ev.map((e) => e.stage_id))]}`);
  const fini = ev.find((e) => e.game_state_key === "finished");
  if (fini) console.log("UN FINI", JSON.stringify({ id: fini.id, khl_id: fini.khl_id, a: fini.team_a, b: fini.team_b, score: fini.score, scores: fini.scores, start: fini.start_at, type: fini.type_id, not_regular: fini.not_regular }));
  if (u === K) console.log("ÉQUIPES", JSON.stringify([...new Map(ev.flatMap((e) => [e.team_a, e.team_b]).map((t) => [t.khl_id, `${t.khl_id}|${t.name}|${t.location}`])).values()]));
}
for (const t of ["goalkeepers", "goalkeeperStats", "goalkeeper"]) {
  const [s, x] = await lire(`https://liiga.fi/api/v2/players/stats/summed/2027/2027/runkosarja/true?dataType=${t}`);
  let l = []; try { l = JSON.parse(x); } catch {}
  console.log(`\n### Liiga dataType=${t} → ${s} n=${l.length} gardiens=${l.filter?.((p) => p.goalkeeper).length} ex=${JSON.stringify((l.find?.((p) => p.goalkeeper) || {})).slice(0, 500)}`);
}
const [s2, g] = await lire("https://liiga.fi/api/v2/players/stats/summed/2027/2027/runkosarja/false?dataType=basicStats");
let l2 = []; try { l2 = JSON.parse(g); } catch {}
console.log(`\n### Liiga goalkeeper=false? → ${s2} n=${l2.length} gardiens=${l2.filter?.((p) => p.goalkeeper).length} ex=${JSON.stringify((l2.find?.((p) => p.goalkeeper && p.games) || {})).slice(0, 600)}`);
const [s3, jx] = await lire("https://liiga.fi/api/v2/games?tournament=runkosarja&season=2027");
const jeux = JSON.parse(jx);
console.log(`\n### Liiga matchs n=${jeux.length} finishedTypes=${JSON.stringify([...new Set(jeux.map((j) => j.finishedType))])} clés=${Object.keys(jeux[0]).join(",")}`);
const enCours = jeux.find((j) => !j.ended && new Date(j.start) < new Date());
console.log("EN COURS?", enCours && JSON.stringify({ id: enCours.id, start: enCours.start, started: enCours.started, gameTime: enCours.gameTime }));
console.log("TYPES BUT", JSON.stringify([...new Set(jeux.flatMap((j) => [...(j.homeTeam.goalEvents || []), ...(j.awayTeam.goalEvents || [])]).flatMap((e) => e.goalTypes || []))]), "périodes", JSON.stringify([...new Set(jeux.flatMap((j) => [...(j.homeTeam.goalEvents || [])]).map((e) => e.period))]));
