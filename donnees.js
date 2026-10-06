// =============================================================
// DONNÉES ÉCRITES À LA MAIN
// Presque tout vient maintenant des robots (dossier data/).
// Ici, on garde seulement ce qu'aucune source ne publie.
// =============================================================

// ---- Joueurs hors LNH ---------------------------------------
const AUTRES_JOUEURS = [
  { id: "hage", nom: "Michael Hage", no: null, pos: "C", eq: "MICH",
    note: "Espoir du Canadien. Joue à l'Université du Michigan (NCAA) en 2026-27. Ses stats seront ajoutées avec les autres ligues." },
];
const AUTRES_EQUIPES = { MICH: "Université du Michigan (NCAA)" };

// ---- Gros noms pour les bagarres -----------------------------
// Une bagarre de la LNH apparaît dans « À la une » seulement si elle
// vaut la peine : un gardien qui jette les gants, une bagarre générale (3 ou
// plus dans le même match), un des meilleurs pointeurs de la ligue,
// un joueur du Canadien ou un des joueurs de cette liste. Ajoute ou retire des noms ici.
const GROS_NOMS = [
  "Arber Xhekaj", "Tom Wilson", "Brady Tkachuk", "Matthew Tkachuk", "Ryan Reaves",
  "Radko Gudas", "Nicolas Deslauriers", "Connor McDavid", "Sidney Crosby", "Auston Matthews",
  "Nathan MacKinnon", "Alex Ovechkin", "Juraj Slafkovský", "Josh Anderson", "Keegan Kolesar",
];

// ---- Favoris proposés au premier passage --------------------
const FAVORIS_DE_DEPART = ["slafkovsky", "suzuki", "hutson", "hage"];
