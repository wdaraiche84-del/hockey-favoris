// =============================================================
// DONNÉES DU SITE
// Ces infos écrites à la main servent de SECOURS : le site utilise
// d'abord les données automatiques du robot (data/mtl.json).
// Les trios (FORMATION_MTL), eux, sont toujours écrits ici, car
// la LNH ne les publie pas. Dernière mise à jour : 5 octobre 2026.
// =============================================================

const MISE_A_JOUR = "5 octobre 2026";

// ---- Les joueurs --------------------------------------------
// id : identifiant unique (sans espaces ni accents)
// no : numéro de chandail (null = pas encore confirmé)
// pos : AG = ailier gauche, C = centre, AD = ailier droit,
//       D = défenseur, G = gardien
const JOUEURS = [
  // Attaquants du Canadien
  { id: "caufield",    nom: "Cole Caufield",      no: 13,   pos: "AG", equipe: "MTL" },
  { id: "suzuki",      nom: "Nick Suzuki",        no: 14,   pos: "C",  equipe: "MTL", capitaine: true },
  { id: "slafkovsky",  nom: "Juraj Slafkovský",   no: 20,   pos: "AD", equipe: "MTL" },
  { id: "kreider",     nom: "Chris Kreider",      no: null, pos: "AG", equipe: "MTL" },
  { id: "newhook",     nom: "Alex Newhook",       no: 15,   pos: "C",  equipe: "MTL" },
  { id: "demidov",     nom: "Ivan Demidov",       no: 93,   pos: "AD", equipe: "MTL" },
  { id: "bolduc",      nom: "Zachary Bolduc",     no: 76,   pos: "AG", equipe: "MTL" },
  { id: "evans",       nom: "Jake Evans",         no: 71,   pos: "C",  equipe: "MTL" },
  { id: "dach",        nom: "Kirby Dach",         no: 77,   pos: "AD", equipe: "MTL" },
  { id: "texier",      nom: "Alexandre Texier",   no: null, pos: "AG", equipe: "MTL" },
  { id: "danault",     nom: "Phillip Danault",    no: 24,   pos: "C",  equipe: "MTL" },
  { id: "anderson",    nom: "Josh Anderson",      no: 17,   pos: "AD", equipe: "MTL" },
  { id: "kapanen",     nom: "Oliver Kapanen",     no: 91,   pos: "C",  equipe: "MTL" },
  // Défenseurs du Canadien
  { id: "hutson",      nom: "Lane Hutson",        no: 48,   pos: "D",  equipe: "MTL" },
  { id: "dobson",      nom: "Noah Dobson",        no: 53,   pos: "D",  equipe: "MTL" },
  { id: "matheson",    nom: "Mike Matheson",      no: 8,    pos: "D",  equipe: "MTL" },
  { id: "carrier",     nom: "Alexandre Carrier",  no: 45,   pos: "D",  equipe: "MTL" },
  { id: "guhle",       nom: "Kaiden Guhle",       no: 21,   pos: "D",  equipe: "MTL" },
  { id: "reinbacher",  nom: "David Reinbacher",   no: null, pos: "D",  equipe: "MTL" },
  { id: "arber-xhekaj",nom: "Arber Xhekaj",       no: 72,   pos: "D",  equipe: "MTL" },
  { id: "struble",     nom: "Jayden Struble",     no: 47,   pos: "D",  equipe: "MTL" },
  // Gardiens du Canadien
  { id: "dobes",       nom: "Jakub Dobeš",        no: 75,   pos: "G",  equipe: "MTL" },
  { id: "montembeault",nom: "Samuel Montembeault",no: 35,   pos: "G",  equipe: "MTL" },
  // Espoir hors LNH (exemple d'une autre ligue)
  { id: "hage",        nom: "Michael Hage",       no: null, pos: "C",  equipe: "MICH",
    note: "Espoir du Canadien. Joue à l'Université du Michigan (NCAA) en 2026-27. Son calendrier n'est pas encore ajouté au site." },
];

// ---- Les équipes --------------------------------------------
const EQUIPES = {
  MTL:  { nom: "Canadiens de Montréal", ligue: "LNH" },
  MICH: { nom: "Université du Michigan", ligue: "NCAA" },
};

// ---- Formation du Canadien (début de saison 2026-27) --------
// Les trios changent souvent : c'est une photo à un moment donné.
const FORMATION_MTL = {
  trios: [
    ["caufield", "suzuki", "slafkovsky"],
    ["kreider", "newhook", "demidov"],
    ["bolduc", "evans", "dach"],
    ["texier", "danault", "anderson"],
  ],
  paires: [
    ["hutson", "dobson"],
    ["matheson", "carrier"],
    ["guhle", "reinbacher"],
  ],
  gardiens: ["dobes", "montembeault"],
  reserve: ["kapanen", "arber-xhekaj", "struble"],
};

// ---- Calendrier du Canadien (sept. à déc. 2026) -------------
// dom : true = à domicile (Centre Bell), false = à l'étranger
// heure : heure de l'Est
const CALENDRIER_MTL = [
  { date: "2026-09-29", adv: "Maple Leafs de Toronto",     dom: false, heure: "19 h 00", res: { mtl: 3, adv: 2 } },
  { date: "2026-10-03", adv: "Penguins de Pittsburgh",     dom: false, heure: "19 h 00", res: { mtl: 5, adv: 6, prol: true } },
  { date: "2026-10-06", adv: "Hurricanes de la Caroline",  dom: true,  heure: "19 h 00", note: "Match d'ouverture local" },
  { date: "2026-10-08", adv: "Predators de Nashville",     dom: true,  heure: "19 h 00" },
  { date: "2026-10-10", adv: "Red Wings de Detroit",       dom: true,  heure: "19 h 00" },
  { date: "2026-10-13", adv: "Sabres de Buffalo",          dom: true,  heure: "18 h 30" },
  { date: "2026-10-14", adv: "Capitals de Washington",     dom: false, heure: "19 h 30" },
  { date: "2026-10-17", adv: "Sabres de Buffalo",          dom: true,  heure: "19 h 00" },
  { date: "2026-10-20", adv: "Sharks de San Jose",         dom: true,  heure: "19 h 00" },
  { date: "2026-10-23", adv: "Blackhawks de Chicago",      dom: false, heure: "20 h 00" },
  { date: "2026-10-25", adv: "Jets de Winnipeg",           dom: false, heure: "19 h 00", note: "Classique Héritage" },
  { date: "2026-10-27", adv: "Blues de St. Louis",         dom: false, heure: "20 h 00" },
  { date: "2026-10-29", adv: "Stars de Dallas",            dom: false, heure: "20 h 00" },
  { date: "2026-10-31", adv: "Penguins de Pittsburgh",     dom: true,  heure: "19 h 00" },
  { date: "2026-11-03", adv: "Jets de Winnipeg",           dom: true,  heure: "19 h 00" },
  { date: "2026-11-05", adv: "Mammoth de l'Utah",          dom: true,  heure: "19 h 00" },
  { date: "2026-11-07", adv: "Maple Leafs de Toronto",     dom: false, heure: "19 h 00" },
  { date: "2026-11-10", adv: "Wild du Minnesota",          dom: true,  heure: "19 h 00" },
  { date: "2026-11-12", adv: "Bruins de Boston",           dom: false, heure: "19 h 00" },
  { date: "2026-11-14", adv: "Avalanche du Colorado",      dom: true,  heure: "19 h 00" },
  { date: "2026-11-16", adv: "Rangers de New York",        dom: false, heure: "19 h 30" },
  { date: "2026-11-18", adv: "Devils du New Jersey",       dom: false, heure: "19 h 30" },
  { date: "2026-11-19", adv: "Hurricanes de la Caroline",  dom: false, heure: "19 h 00" },
  { date: "2026-11-21", adv: "Flyers de Philadelphie",     dom: true,  heure: "19 h 00" },
  { date: "2026-11-23", adv: "Kings de Los Angeles",       dom: true,  heure: "19 h 30" },
  { date: "2026-11-25", adv: "Avalanche du Colorado",      dom: false, heure: "21 h 30" },
  { date: "2026-11-28", adv: "Golden Knights de Vegas",    dom: false, heure: "16 h 00" },
  { date: "2026-11-30", adv: "Mammoth de l'Utah",          dom: false, heure: "21 h 30" },
  { date: "2026-12-02", adv: "Lightning de Tampa Bay",     dom: true,  heure: "19 h 30" },
  { date: "2026-12-05", adv: "Panthers de la Floride",     dom: true,  heure: "13 h 00" },
  { date: "2026-12-06", adv: "Sénateurs d'Ottawa",         dom: true,  heure: "19 h 00" },
  { date: "2026-12-08", adv: "Golden Knights de Vegas",    dom: true,  heure: "19 h 00" },
  { date: "2026-12-10", adv: "Ducks d'Anaheim",            dom: true,  heure: "19 h 00" },
  { date: "2026-12-12", adv: "Blue Jackets de Columbus",   dom: false, heure: "13 h 00" },
  { date: "2026-12-14", adv: "Oilers d'Edmonton",          dom: true,  heure: "19 h 30" },
  { date: "2026-12-18", adv: "Sabres de Buffalo",          dom: false, heure: "19 h 30" },
  { date: "2026-12-19", adv: "Wild du Minnesota",          dom: false, heure: "19 h 00" },
  { date: "2026-12-22", adv: "Blue Jackets de Columbus",   dom: false, heure: "19 h 00" },
  { date: "2026-12-26", adv: "Maple Leafs de Toronto",     dom: true,  heure: "19 h 00" },
  { date: "2026-12-27", adv: "Stars de Dallas",            dom: true,  heure: "19 h 00" },
  { date: "2026-12-29", adv: "Blue Jackets de Columbus",   dom: true,  heure: "19 h 00" },
  { date: "2026-12-31", adv: "Lightning de Tampa Bay",     dom: false, heure: "14 h 00" },
];

// ---- Statistiques par match ---------------------------------
// b = buts, a = passes. Seuls les points connus sont inscrits.
const STATS_MATCHS = {
  "2026-09-29": { anderson: { b: 1, a: 1 }, bolduc: { b: 1 }, carrier: { b: 1, a: 1 }, dach: { a: 1 }, matheson: { a: 1 } },
  "2026-10-03": { caufield: { b: 2 }, suzuki: { b: 1, a: 3 }, kreider: { b: 1 }, demidov: { b: 1 }, hutson: { a: 3 } },
};
