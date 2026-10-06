// Temporaire : cherche des photos de hockey sous licence libre sur Wikimedia Commons
import { writeFile, mkdir } from "node:fs/promises";
const UA = { "User-Agent": "MonTrio/1.0 (https://wdaraiche84-del.github.io/hockey-favoris/; site de fan)" };
const LIBRE = /^(CC0|CC BY(-SA)? [0-9.]+|Public domain|PD.*)$/i;
const RECH = ["ice hockey game action", "ice hockey goaltender save", "ice hockey faceoff", "hockey rink arena", "ice hockey puck stick", "ice hockey skates ice", "pond hockey outdoor", "ice hockey goal net", "ice hockey player shot", "ice hockey referee"];
await mkdir("cand", { recursive: true });
const vus = new Set(), infos = [];
let n = 0;
for (const q of RECH) {
  const u = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ action: "query", format: "json", generator: "search", gsrsearch: `${q} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "25", prop: "imageinfo", iiprop: "url|size|extmetadata", iiurlwidth: "900" });
  const d = await (await fetch(u, { headers: UA })).json();
  for (const p of Object.values(d.query?.pages || {})) {
    const ii = p.imageinfo?.[0]; if (!ii || vus.has(p.title)) continue;
    const m = ii.extmetadata || {}, lic = (m.LicenseShortName?.value || "").trim();
    if (!LIBRE.test(lic) || ii.width < 1400 || ii.width < ii.height * 1.25) continue;
    vus.add(p.title);
    const f = `c${String(++n).padStart(3, "0")}.jpg`;
    const r = await fetch(ii.thumburl, { headers: UA }); if (!r.ok) { n--; continue; }
    await writeFile(`cand/${f}`, Buffer.from(await r.arrayBuffer()));
    infos.push({ f, q, titre: p.title, page: ii.descriptionurl, lic, auteur: (m.Artist?.value || "").replace(/<[^>]+>/g, "").trim().slice(0, 80), thumb: ii.thumburl });
    await new Promise((r) => setTimeout(r, 300));
  }
}
await writeFile("cand/infos.json", JSON.stringify(infos, null, 1));
console.log(`${infos.length} candidates`);
