// Temporaire : détails des stats de joueurs KHL (webcaster)
const B = "https://khl.api.webcaster.pro/api/khl_mobile/";
const H = (l) => ({ "User-Agent": "Mozilla/5.0 (Linux; Android 14) KHL/5.0", Accept: "application/json", "Accept-Language": l });
const j = async (u, l = "ru") => { const r = await fetch(B + u, { headers: H(l) }); return r.ok ? r.json() : `ERR ${r.status}`; };
const forme = (o, d = 0) => { // squelette d'un objet JSON
  if (Array.isArray(o)) return o.length ? `[${o.length}× ${forme(o[0], d + 1)}]` : "[]";
  if (o && typeof o === "object") return d > 4 ? "{…}" : "{" + Object.entries(o).map(([k, v]) => `${k}:${forme(v, d + 1)}`).join(", ") + "}";
  return JSON.stringify(o)?.slice(0, 30);
};
for (const [u, l] of [["players_v2?locale=en", "ru"], ["players_v2?lang=en", "ru"], ["players_v2", "en"], ["players?locale=en", "en"], ["leaders_v2", "ru"]]) {
  const d = await j(u, l); console.log(`\n### ${u} [${l}] → ${Array.isArray(d) ? d.length : ""} ${JSON.stringify(d).slice(0, 250)}`);
}
const tous = await j("players"); console.log("\n### players total", tous.length);
const g = tous.find((x) => /врат|goal/i.test(x.player.role)); console.log("gardien players:", JSON.stringify(g));
const v2 = await j("players_v2"); console.log("\n### players_v2 total", v2.length, "\nrôles:", [...new Set(v2.map((x) => x.player.role_key))]);
const g2 = v2.find((x) => x.player.role_key === "goaltender" || /goal/.test(x.player.role_key)); console.log("gardien v2:", JSON.stringify(g2).slice(0, 1500));
console.log("pays:", [...new Set(v2.map((x) => x.player.country))].join(", "));
console.log("joueur v2 complet:", JSON.stringify(v2[5]).slice(0, 1800));
for (const pg of [2, 3, 30]) { const d = await j(`players_v2?page=${pg}`); console.log(`page ${pg}:`, Array.isArray(d) ? d.length : d); }
const ev = await j("event_v2?id=3000171");
console.log("\n### forme event_v2:\n" + forme(ev));
console.log("\n### event_v2 brut (fin):\n" + JSON.stringify(ev).slice(2500, 9000));
const ev2 = await j("event_v2?id=3000171", "en"); console.log("\n### event en:", JSON.stringify(ev2).slice(0, 300));
const t = await j("teams"); console.log("\n### teams total", t.length, JSON.stringify(t[0]?.team).slice(0, 400));
for (const u of ["player_v2?id=33797", "player?id=33797", "player_v2?id=33797&stage=regular"]) { const d = await j(u); console.log(`\n### ${u}\n${forme(d)}\n${JSON.stringify(d).slice(0, 1500)}`); }
