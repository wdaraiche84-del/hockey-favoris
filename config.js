// =============================================================
// RÉGLAGES DU SITE
// =============================================================

// Adresse du « relais » pour le direct à la seconde pendant les
// matchs (voir le dossier relais/). Laisse vide tant qu'il n'est
// pas installé : le site utilise alors les données du robot,
// mises à jour aux 30 minutes environ.
// Exemple : const RELAIS = "https://hockey-relais.ton-nom.workers.dev";
const RELAIS = "https://empty-forest-740ehockey-relais.w-daraiche84.workers.dev";

// Aux combien de secondes le score se rafraîchit pendant un match
const SECONDES_DIRECT = 20;

// Compteur de visites (Cloudflare Web Analytics : sans témoins ni suivi).
// C'est le « token » du bout de code donné par Cloudflare ; il n'est pas secret.
// Laisse vide pour ne rien compter.
const ANALYTIQUE = "";
