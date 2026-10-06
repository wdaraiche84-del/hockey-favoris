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

// Chaque recherche est rattachée à une ligue. Pour l'OHL et la WHL, les
// médias sont surtout anglophones : on cherche aussi en anglais.
const RECHERCHES = [
  { q: "LNH hockey", lig: "lnh" }, { q: "LNH blessure", lig: "lnh" }, { q: "LNH échange OR transaction", lig: "lnh" },
  { q: "LNH suspension", lig: "lnh" }, { q: "Canadien de Montréal", lig: "lnh" }, { q: "Canadiens Montréal blessure", lig: "lnh" },
  { q: "Martin St-Louis Canadien", lig: "lnh" }, { q: "Kent Hughes Canadien", lig: "lnh" },
  { q: "Rocket de Laval", lig: "ahl" }, { q: "LAH hockey", lig: "ahl" }, { q: "AHL hockey", lig: "ahl", en: true, jours: 7 },
  { q: "LHJMQ", lig: "lhjmq", jours: 7 }, { q: "LHJMQ hockey junior", lig: "lhjmq", jours: 7 },
  { q: "OHL hockey", lig: "ohl", en: true, jours: 7 }, { q: "Ontario Hockey League", lig: "ohl", en: true, jours: 7 },
  { q: "WHL hockey", lig: "whl", en: true, jours: 7 }, { q: "Western Hockey League", lig: "whl", en: true, jours: 7 },
  { q: "KHL hockey", lig: "khl", jours: 7 }, { q: "Ligue continentale de hockey", lig: "khl", jours: 14 },
  { q: "KHL", lig: "khl", en: true, jours: 7 }, { q: "Kontinental Hockey League", lig: "khl", en: true, jours: 14 },
];
// Une vraie transaction : un geste concret, pas une rumeur ni une question
const TRANSACTION = /(?<!\p{L})(traded|acquires?|acquired|signs?|signed|re-signs?|extension|claimed|waivers|recall(s|ed)?|reassign(s|ed)?|loan(s|ed)|releases?|released|fired|hired|named (head )?coach|échangé|échangés|échange \w+ (à|aux|contre)|acquiert|acquis|obtient|obtenu|cède|cédé|signe|a signé|paraphe|prolonge|prolongation de contrat|contrat (de|d'une durée)|soumis au ballottage|plac\w*\s.{0,40}?au ballottage|réclamé|rappelé|rappelle|retranché|libéré|congédié|embauché|nommé (entraîneur|directeur|capitaine))(?!\p{L})/iu;
const SPECULATION = /\?|rumeur|rumou?r|could|might|should|would|interest|target|potential|possible|pourrai(t|ent)|surprise|choix|intéress|cible|possible|spécul|envisag|aimerai(t|ent)|songe|candidat|serait|devrai(t|ent)|options?\b/i;
function categorieDe(titre, source = "") {
  if (/bless|injur|\bIR\b|à l'écart|absen|opér[ée]|commotion|rétabli|retour au jeu|infirmerie|concussion|week-to-week|day-to-day|out for/i.test(titre)) return "blessure";
  if (/suspen|amende|sanction|audience disciplinaire|fined|hearing/i.test(titre)) return "suspension";
  if (TRANSACTION.test(titre) && !SPECULATION.test(titre) && !/rumeur/i.test(source)) return "transaction";
  return "nouvelle";
}
const LIGUES = [["ahl", /\b(LAH|AHL)\b|Rocket de Laval|Laval Rocket/], ["lnh", /\b(LNH|NHL)\b/], ["lhjmq", /\b(LHJMQ|QMJHL)\b/], ["ohl", /\bOHL\b/], ["whl", /\bWHL\b/], ["khl", /\b(KHL|LKH)\b/]];

// Paris sportifs, cotes, casinos : on n'en veut pas dans les articles
const JEU = /\bparis? sportifs?\b|\bpari\b|\bparie[rz]?\b|parieu|mise-o-jeu|mises? sportives?|\bcotes?\b|\bodds\b|\bbet(s|ting|tor)?\b|rue ?des ?joueurs|odds scanner|prédiction|prediction|pronostic|parlay|sportsbook|bookmak|casino|draftkings|fanduel|betmgm|bet365|betway|bet99|betrivers|caesars sportsbook|pointsbet|fanatics sportsbook|loto-québec|covers\.com|action network|pickswise|oddsshark|sportsline|dimers|\bprops?\b/i;

const decoder = (t) => t.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const champ = (bloc, nom) => { const m = bloc.match(new RegExp(`<${nom}[^>]*>([\\s\\S]*?)</${nom}>`)); return m ? decoder(m[1]) : ""; };

async function chercher({ q, en, jours = 3 }) {
  const langue = en ? { hl: "en-CA", gl: "CA", ceid: "CA:en" } : { hl: "fr-CA", gl: "CA", ceid: "CA:fr" };
  const url = "https://news.google.com/rss/search?" + new URLSearchParams({ q: `${q} when:${jours}d`, ...langue });
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
for (const r of RECHERCHES) {
  try {
    for (const n of await chercher(r)) {
      if (/bagarre|jette les gants|gants tombent|\bfights?\b/i.test(n.titre)) continue; // pas de bagarres dans les articles
      if (JEU.test(n.titre) || JEU.test(n.source)) continue; // pas de paris sportifs ni de casinos
      const cle = n.titre.toLowerCase().replace(/[^a-zà-ÿ0-9]+/g, " ").trim().slice(0, 80);
      if (!n.titre || tous.has(cle)) continue;
      n.cat = categorieDe(n.titre, n.source);
      // La ligue nommée dans le titre a priorité sur celle de la recherche
      const l = LIGUES.find(([, re]) => re.test(n.titre));
      n.lig = l ? l[0] : r.lig;
      tous.set(cle, n);
    }
  } catch (e) { console.warn("Nouvelles :", e.message); }
  await new Promise((r) => setTimeout(r, 400));
}

// Jusqu'à 25 articles par ligue, les plus récents d'abord
const parLigue = {};
for (const n of [...tous.values()].sort((a, b) => b.date.localeCompare(a.date))) {
  parLigue[n.lig] = parLigue[n.lig] || [];
  if (parLigue[n.lig].length < 25) parLigue[n.lig].push(n);
}
const liste = Object.values(parLigue).flat().sort((a, b) => b.date.localeCompare(a.date));
console.log(Object.entries(parLigue).map(([l, a]) => `${l} : ${a.length}`).join(", "));
if (!liste.length) { console.log("Aucune nouvelle trouvée, on garde les anciennes."); process.exit(0); }
const ancien = await readFile("data/nouvelles.json", "utf8").catch(() => "");
const nouveau = JSON.stringify(liste);
if (ancien !== nouveau) await writeFile("data/nouvelles.json", nouveau);
console.log(`${liste.length} nouvelles.`);
