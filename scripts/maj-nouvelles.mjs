// =============================================================
// LE ROBOT DES NOUVELLES (section « Le buzz »)
// Va chercher les manchettes du hockey sur Google Actualités, en
// français. On garde seulement le titre, la source, la date et le
// lien : le visiteur lit l'article complet sur le site d'origine.
// Chaque manchette reçoit une catégorie (blessure, bagarre…) et,
// si on la reconnaît, une ligue.
// Résultat : data/nouvelles.json
// =============================================================

import { readFile, writeFile } from "node:fs/promises";

const RECHERCHES = [
  "LNH hockey", "LNH blessure", "LNH échange OR transaction", "hockey bagarre",
  "Canadien de Montréal", "LHJMQ", "LAH hockey Rocket", "KHL hockey",
];
const CATEGORIES = [
  ["blessure", /bless|injur|ir\b|à l'écart|absent pour|opér[ée]|commotion|rétabli/i],
  ["bagarre", /bagarre|combat|jette les gants|gants tombent|fight/i],
  ["suspension", /suspen|amende|sanction|audience disciplinaire/i],
  ["transaction", /échang|trade|signe|contrat|prolongation de contrat|rappel|cédé|ballottage|waiver|acquiert|acquis|congédi|embauch/i],
];
const LIGUES = [["lnh", /\b(LNH|NHL)\b/], ["ahl", /\b(LAH|AHL)\b|Rocket de Laval/], ["lhjmq", /\b(LHJMQ|QMJHL)\b/], ["ohl", /\bOHL\b/], ["whl", /\bWHL\b/], ["khl", /\b(KHL|LKH)\b/]];

const decoder = (t) => t.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const champ = (bloc, nom) => { const m = bloc.match(new RegExp(`<${nom}[^>]*>([\\s\\S]*?)</${nom}>`)); return m ? decoder(m[1]) : ""; };

async function chercher(q) {
  const url = "https://news.google.com/rss/search?" + new URLSearchParams({ q: `${q} when:3d`, hl: "fr-CA", gl: "CA", ceid: "CA:fr" });
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (MonTrio, site de fan)" } });
  if (!r.ok) throw new Error(`${q} → ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, b]) => {
    const source = champ(b, "source");
    let titre = champ(b, "title");
    if (source && titre.endsWith(` - ${source}`)) titre = titre.slice(0, -(source.length + 3));
    return { titre, source, lien: champ(b, "link"), date: new Date(champ(b, "pubDate")).toISOString() };
  });
}

const tous = new Map();
for (const q of RECHERCHES) {
  try {
    for (const n of await chercher(q)) {
      const cle = n.titre.toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, " ").trim().slice(0, 80);
      if (!n.titre || tous.has(cle)) continue;
      n.cat = (CATEGORIES.find(([, re]) => re.test(n.titre)) || ["nouvelle"])[0];
      const l = LIGUES.find(([, re]) => re.test(n.titre));
      if (l) n.lig = l[0];
      tous.set(cle, n);
    }
  } catch (e) { console.warn("Nouvelles :", e.message); }
  await new Promise((r) => setTimeout(r, 400));
}

const liste = [...tous.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
if (!liste.length) { console.log("Aucune nouvelle trouvée, on garde les anciennes."); process.exit(0); }
const ancien = await readFile("data/nouvelles.json", "utf8").catch(() => "");
const nouveau = JSON.stringify(liste);
if (ancien !== nouveau) await writeFile("data/nouvelles.json", nouveau);
console.log(`${liste.length} nouvelles.`);
