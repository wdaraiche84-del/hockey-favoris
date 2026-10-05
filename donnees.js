// =============================================================
// DONNÉES ÉCRITES À LA MAIN
// Presque tout vient maintenant du robot (dossier data/).
// Ici, on garde seulement ce que la LNH ne publie pas.
// =============================================================

// ---- Trios et paires ----------------------------------------
// La LNH ne publie pas les trios : on les écrit ici, équipe par
// équipe. Pour les équipes absentes, la fiche montre l'effectif
// par position. Les identifiants sont les noms de famille sans
// accents (ou prénom-nom quand deux joueurs ont le même nom).
const FORMATIONS = {
  MTL: {
    note: "Formation du début de saison 2026-27",
    trios: [
      ["slafkovsky", "suzuki", "caufield"],
      ["kreider", "newhook", "demidov"],
      ["bolduc", "evans", "dach"],
      ["texier", "danault", "anderson"],
    ],
    paires: [
      ["hutson", "dobson"],
      ["matheson", "carrier"],
      ["arber-xhekaj", "struble"],
    ],
    gardiens: ["dobes", "montembeault"],
  },
};

// ---- Joueurs hors LNH ---------------------------------------
const AUTRES_JOUEURS = [
  { id: "hage", nom: "Michael Hage", no: null, pos: "C", eq: "MICH",
    note: "Espoir du Canadien. Joue à l'Université du Michigan (NCAA) en 2026-27. Ses stats seront ajoutées avec les autres ligues." },
];
const AUTRES_EQUIPES = { MICH: "Université du Michigan (NCAA)" };

// ---- Favoris proposés au premier passage --------------------
const FAVORIS_DE_DEPART = ["slafkovsky", "suzuki", "hutson", "hage"];
