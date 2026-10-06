// =============================================================
// LE ROBOT DES NOUVELLES (section « À la une »)
// Va chercher les manchettes du hockey sur Google Actualités, en
// français. On garde seulement le titre, la source, la date et le
// lien : le visiteur lit l'article complet sur le site d'origine.
// Chaque manchette reçoit une catégorie (blessure, transaction…) et,
// si on la reconnaît, une ligue.
// Résultat : data/nouvelles.json
// =============================================================

import { readFile, writeFile } from "node:fs/promises";

const RECHERCHES = [
  "LNH hockey", "LNH blessure", "LNH échange OR transaction", "LNH suspension",
  "Canadien de Montréal", "Canadiens Montréal blessure", "Canadiens Montréal alignement", "Martin St-Louis Canadien",
  "Kent Hughes Canadien", "Rocket de Laval", "LHJMQ", "KHL hockey",
];
// Une vraie transaction : un geste concret, pas une rumeur ni une question
const TRANSACTION = /(?<!\p{L})(échangé|échangés|échange \w+ (à|aux|contre)|acquiert|acquis|obtient|obtenu|cède|cédé|signe|a signé|paraphe|prolonge|prolongation de contrat|contrat (de|d'une durée)|soumis au ballottage|plac\w*\s.{0,40}?au ballottage|réclamé|rappelé|rappelle|retranché|libéré|congédié|embauché|nommé (entraîneur|directeur|capitaine))(?!\p{L})/iu;
const SPECULATION = /\?|rumeur|pourrai(t|ent)|surprise|choix|intéress|cible|possible|spécul|envisag|aimerai(t|ent)|songe|candidat|serait|devrai(t|ent)|options?\b/i;
function categorieDe(titre, source = "") {
  if (/bless|injur|\bIR\b|à l'écart|absen|opér[ée]|commotion|rétabli|retour au jeu|infirmerie/i.test(titre)) return "blessure";
  if (/suspen|amende|sanction|audience disciplinaire/i.test(titre)) return "suspension";
  if (TRANSACTION.test(titre) && !SPECULATION.test(titre) && !/rumeur/i.test(source)) return "transaction";
  return "nouvelle";
}
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
      if (/bagarre|jette les gants|gants tombent|\bfight/i.test(n.titre)) continue; // pas de bagarres sur le site
      const cle = n.titre.toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, " ").trim().slice(0, 80);
      if (!n.titre || tous.has(cle)) continue;
      n.cat = categorieDe(n.titre, n.source);
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
