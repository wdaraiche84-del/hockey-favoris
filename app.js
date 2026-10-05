// =============================================================
// CE QUI REND LA PAGE VIVANTE
// Ce fichier lit les données (donnees.js) et les affiche dans
// les sections de la page (index.html). Il réagit aussi aux clics.
// =============================================================

// ---- Petits outils ------------------------------------------
const $ = (id) => document.getElementById(id);
const JOURS_COURTS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const NOMS_POS = { AG: "Ailier gauche", C: "Centre", AD: "Ailier droit", D: "Défenseur", G: "Gardien" };

// Abréviations des adversaires (pour les petites cases du calendrier)
const ABREV = {
  "Toronto": "TOR", "Pittsburgh": "PIT", "Caroline": "CAR", "Nashville": "NSH", "Detroit": "DET",
  "Buffalo": "BUF", "Washington": "WSH", "San Jose": "SJ", "Chicago": "CHI", "Winnipeg": "WPG",
  "St. Louis": "STL", "Dallas": "DAL", "Utah": "UTA", "Minnesota": "MIN", "Boston": "BOS",
  "Colorado": "COL", "New York": "NYR", "New Jersey": "NJ", "Philadelphie": "PHI", "Los Angeles": "LA",
  "Vegas": "VGK", "Tampa Bay": "TB", "Floride": "FLA", "Ottawa": "OTT", "Anaheim": "ANA",
  "Columbus": "CBJ", "Edmonton": "EDM",
};
function abrev(adv, m) {
  if (m && m.advAbrev) return m.advAbrev;
  for (const ville in ABREV) if (adv.includes(ville)) return ABREV[ville];
  return adv.slice(0, 3).toUpperCase();
}
// Heure du match, dans le fuseau horaire du visiteur
function heureDe(m) {
  if (!m.debut) return m.heure || "";
  return new Date(m.debut).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

// Convertit une date en texte "AAAA-MM-JJ" (heure locale)
function versTexte(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${j}`;
}
function versDate(texte) {
  const [a, m, j] = texte.split("-").map(Number);
  return new Date(a, m - 1, j);
}
function dateLongue(texte) {
  const d = versDate(texte);
  return `${JOURS_COURTS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}
// Enlève les accents pour que "slafkovsky" trouve "Slafkovský"
function simplifier(t) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Trouve un joueur par son identifiant. "arber-xhekaj" trouve aussi
// "xhekaj" (et l'inverse), selon ce que le robot a produit.
function joueur(id) {
  return JOUEURS.find((j) => j.id === id)
    || JOUEURS.find((j) => id.includes("-") && j.id === id.split("-").slice(-1)[0])
    || JOUEURS.find((j) => j.id.endsWith("-" + id));
}

// ---- Données automatiques du robot --------------------------
// Si le fichier data/mtl.json existe, il remplace les données
// écrites à la main (donnees.js), qui restent là en secours.
let misAJourAuto = null;
async function chargerDonneesAuto() {
  try {
    const rep = await fetch("data/mtl.json", { cache: "no-store" });
    if (!rep.ok) return;
    const d = await rep.json();
    const capitaines = JOUEURS.filter((j) => j.capitaine).map((j) => j.id);
    const autres = JOUEURS.filter((j) => j.equipe !== "MTL");
    d.joueurs.forEach((j) => { if (capitaines.includes(j.id)) j.capitaine = true; });
    JOUEURS.splice(0, JOUEURS.length, ...d.joueurs, ...autres);
    CALENDRIER_MTL.splice(0, CALENDRIER_MTL.length, ...d.calendrier);
    for (const k in STATS_MATCHS) delete STATS_MATCHS[k];
    Object.assign(STATS_MATCHS, d.matchs || {});
    misAJourAuto = new Date(d.misAJour);
  } catch (e) { /* pas de fichier automatique : on garde les données manuelles */ }
}
function texteMiseAJour() {
  if (!misAJourAuto) return `Données manuelles du ${MISE_A_JOUR}`;
  const min = Math.round((Date.now() - misAJourAuto) / 60000);
  if (min < 1) return "Stats mises à jour à l'instant";
  if (min < 60) return `Stats mises à jour il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Stats mises à jour il y a ${h} h`;
  return `Stats mises à jour le ${misAJourAuto.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`;
}
const AUJOURDHUI = versTexte(new Date());

// ---- La liste de favoris (gardée dans le navigateur) --------
// Chaque visiteur a sa propre liste, enregistrée sur son appareil.
const CLE = "mes-favoris-hockey";
const FAVORIS_DE_DEPART = ["slafkovsky", "suzuki", "hutson", "hage"];

function lireFavoris() {
  try {
    const sauve = localStorage.getItem(CLE);
    if (sauve) return JSON.parse(sauve);
  } catch (e) { /* navigateur sans mémoire : on garde la liste de départ */ }
  return [...FAVORIS_DE_DEPART];
}
let favoris = lireFavoris();
// Garde seulement les joueurs qui existent, avec leur identifiant à jour
function nettoyerFavoris() {
  favoris = [...new Set(favoris.map((id) => joueur(id)?.id).filter(Boolean))];
}

function sauverFavoris() {
  try { localStorage.setItem(CLE, JSON.stringify(favoris)); } catch (e) {}
}

// ---- Statistiques -------------------------------------------
function habille(id) {
  // Le joueur a-t-il joué ? (tout le monde sauf les réservistes)
  return !FORMATION_MTL.reserve.includes(id);
}
function statsDe(j) {
  if (j.stats) return j.stats; // données du robot
  if (j.equipe !== "MTL" || j.pos === "G") return null;
  let pj = 0, b = 0, a = 0;
  for (const m of CALENDRIER_MTL) {
    if (!m.res) continue;
    if (habille(j.id)) pj++;
    const s = (STATS_MATCHS[m.date] || {})[j.id];
    if (s) { b += s.b || 0; a += s.a || 0; }
  }
  return { pj, b, a, pts: b + a };
}
function prochainMatch(j) {
  if (j.equipe !== "MTL") return null;
  return CALENDRIER_MTL.find((m) => estAVenir(m) && m.date >= AUJOURDHUI) || null;
}
const estDirect = (m) => m.etat === "direct";
const estFini = (m) => (m.etat ? m.etat === "fini" : !!m.res);
const estAVenir = (m) => !estFini(m) && !estDirect(m);
function texteResultat(m) {
  if (estDirect(m)) return { texte: `${m.res.mtl}-${m.res.adv}`, classe: "direct" };
  const victoire = m.res.mtl > m.res.adv;
  const fin = m.res.tb ? " (TB)" : m.res.prol ? " (prol.)" : "";
  return { texte: `${victoire ? "V" : "D"} ${m.res.mtl}-${m.res.adv}${fin}`, classe: victoire ? "v" : "d" };
}

// =============================================================
// 1. CALENDRIER
// =============================================================
function lundiDe(d) {
  const r = new Date(d);
  const decalage = (r.getDay() + 6) % 7; // lundi = 0
  r.setDate(r.getDate() - decalage);
  return r;
}
let debutSemaine = lundiDe(new Date());
let jourChoisi = AUJOURDHUI;

function favorisQuiJouent() {
  return favoris.map(joueur).filter((j) => j.equipe === "MTL");
}

function afficherCalendrier() {
  const boite = $("calendrier");
  boite.innerHTML = "";
  const fin = new Date(debutSemaine);
  fin.setDate(fin.getDate() + 6);
  const COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  $("sem-titre").textContent = `${debutSemaine.getDate()} ${COURT[debutSemaine.getMonth()]} – ${fin.getDate()} ${COURT[fin.getMonth()]}`;

  const quiJouent = favorisQuiJouent();
  for (let i = 0; i < 7; i++) {
    const d = new Date(debutSemaine);
    d.setDate(d.getDate() + i);
    const texte = versTexte(d);
    const match = CALENDRIER_MTL.find((m) => m.date === texte);

    const bouton = document.createElement("button");
    bouton.className = "jour";
    if (texte === AUJOURDHUI) bouton.classList.add("aujourdhui");
    if (texte === jourChoisi) bouton.classList.add("choisi");
    bouton.innerHTML = `<span class="nom-jour">${JOURS_COURTS[d.getDay()]}</span><span class="num-jour">${d.getDate()}</span>`;

    if (match && quiJouent.length) {
      let classe = match.dom ? "" : "ext";
      let txt = (match.dom ? "vs " : "@ ") + abrev(match.adv, match);
      if (estDirect(match)) { classe = "direct"; txt = `● ${match.res.mtl}-${match.res.adv}`; }
      else if (estFini(match)) { const r = texteResultat(match); classe = r.classe; txt = r.texte.split(" ").slice(0, 2).join(" "); }
      bouton.innerHTML += `<span class="puce ${classe}">${txt}</span>`;
    }
    bouton.onclick = () => { jourChoisi = texte; afficherCalendrier(); };
    boite.appendChild(bouton);
  }
  afficherDetailJour();
}

function afficherDetailJour() {
  const boite = $("detail-jour");
  const match = CALENDRIER_MTL.find((m) => m.date === jourChoisi);
  const quiJouent = favorisQuiJouent();
  const titre = `<p class="vide" style="font-style:normal;font-weight:600;margin-bottom:8px">${dateLongue(jourChoisi)}${jourChoisi === AUJOURDHUI ? " · aujourd'hui" : ""}</p>`;

  if (!match || !quiJouent.length) {
    boite.innerHTML = titre + `<p class="vide">Aucun de tes favoris ne joue cette journée.</p>`;
    return;
  }
  let score = `<span>${heureDe(match)}</span>`;
  if (estDirect(match)) score = `<span class="badge-direct">EN DIRECT</span><span class="score">${match.res.mtl}-${match.res.adv}</span>`;
  else if (estFini(match)) { const r = texteResultat(match); score = `<span class="score">${r.texte}</span>`; }
  const noms = quiJouent.map((j) => j.nom.split(" ").slice(-1)[0]).join(", ");
  boite.innerHTML = titre + `
    <div class="match">
      <span class="lieu ${match.dom ? "" : "ext"}">${match.dom ? "Domicile" : "Étranger"}</span>
      <span class="titre-match">Canadiens ${match.dom ? "vs" : "@"} ${match.adv}${match.note ? " · " + match.note : ""}</span>
      ${score}
      <span class="qui">Tes favoris dans ce match : ${noms}</span>
    </div>`;
}

$("sem-prec").onclick = () => { debutSemaine.setDate(debutSemaine.getDate() - 7); afficherCalendrier(); };
$("sem-suiv").onclick = () => { debutSemaine.setDate(debutSemaine.getDate() + 7); afficherCalendrier(); };

// =============================================================
// 2. MES FAVORIS
// =============================================================
function pastilleNumero(j) {
  return `<span class="numero">${j.no ?? "–"}</span>`;
}

function htmlStatsCourtes(j, s) {
  if (j.gardien) {
    const g = j.gardien;
    return `<div class="stats">
      <div><b>${g.pj}</b><small>PJ</small></div>
      <div><b>${g.v}-${g.d}-${g.dp}</b><small>Fiche</small></div>
      <div><b>${g.moy != null ? g.moy.toFixed(2) : "–"}</b><small>Moy.</small></div>
      <div><b>${g.pct != null ? g.pct.toFixed(3).replace(/^0/, "") : "–"}</b><small>% arr.</small></div>
    </div>`;
  }
  if (!s) return `<div class="prochain">${j.pos === "G" ? "Stats de gardien à venir." : "Stats pas encore ajoutées."}</div>`;
  return `<div class="stats">
    <div><b>${s.pj}</b><small>PJ</small></div>
    <div><b>${s.b}</b><small>B</small></div>
    <div><b>${s.a}</b><small>A</small></div>
    <div><b>${s.pts}</b><small>PTS</small></div>
  </div>`;
}
function htmlProchain(j, p) {
  const direct = j.equipe === "MTL" && CALENDRIER_MTL.find(estDirect);
  if (direct) return `<span class="badge-direct">EN DIRECT</span> <strong>${direct.res.mtl}-${direct.res.adv}</strong> ${direct.dom ? "vs" : "@"} ${abrev(direct.adv, direct)}`;
  if (p) return `Prochain match : <strong>${dateLongue(p.date)}</strong> ${p.dom ? "vs" : "@"} ${abrev(p.adv, p)} · ${heureDe(p)}`;
  return EQUIPES[j.equipe].ligue;
}

function afficherFavoris() {
  const boite = $("favoris");
  $("nb-favoris").textContent = favoris.length;
  if (!favoris.length) {
    boite.innerHTML = `<p class="vide">Ta liste est vide. Ajoute des joueurs avec la recherche plus bas.</p>`;
    return;
  }
  boite.innerHTML = "";
  for (const id of favoris) {
    const j = joueur(id);
    const s = statsDe(j);
    const p = prochainMatch(j);
    const carte = document.createElement("div");
    carte.className = "carte-joueur" + (j.equipe !== "MTL" ? " autre-ligue" : "");
    carte.innerHTML = `
      <div class="haut">
        ${pastilleNumero(j)}
        <div>
          <h3>${j.nom}${j.capitaine ? " (C)" : ""}</h3>
          <div class="equipe">${NOMS_POS[j.pos]} · ${EQUIPES[j.equipe].nom}</div>
        </div>
      </div>
      <div class="bas">
        ${htmlStatsCourtes(j, s)}
        <div class="prochain">${htmlProchain(j, p)}</div>
        <div class="actions">
          <button class="btn" data-voir="${j.id}">Voir la fiche</button>
          <button class="btn leger" data-retirer="${j.id}" aria-label="Retirer ${j.nom}">Retirer</button>
        </div>
      </div>`;
    boite.appendChild(carte);
  }
  boite.querySelectorAll("[data-voir]").forEach((b) => (b.onclick = () => ouvrirFiche(b.dataset.voir)));
  boite.querySelectorAll("[data-retirer]").forEach((b) => (b.onclick = () => retirer(b.dataset.retirer)));
}

function ajouter(id) {
  if (!favoris.includes(id)) favoris.push(id);
  sauverFavoris(); toutAfficher();
}
function retirer(id) {
  favoris = favoris.filter((f) => f !== id);
  sauverFavoris(); toutAfficher();
}

// =============================================================
// 3. RECHERCHE
// =============================================================
function afficherResultats() {
  const q = simplifier($("recherche").value.trim());
  const boite = $("resultats");
  if (!q) { boite.innerHTML = ""; return; }
  const trouves = JOUEURS.filter((j) => simplifier(j.nom).includes(q)).slice(0, 8);
  if (!trouves.length) {
    boite.innerHTML = `<li><span class="vide">Aucun joueur trouvé. Pour l'instant, le site contient l'équipe du Canadien et quelques espoirs.</span></li>`;
    return;
  }
  boite.innerHTML = trouves.map((j) => `
    <li>
      ${pastilleNumero(j)}
      <div class="infos"><strong>${j.nom}</strong><span>${NOMS_POS[j.pos]} · ${EQUIPES[j.equipe].nom}</span></div>
      ${favoris.includes(j.id)
        ? `<button class="btn leger" disabled>✓ Dans ta liste</button>`
        : `<button class="btn rouge" data-ajouter="${j.id}">+ Ajouter</button>`}
    </li>`).join("");
  boite.querySelectorAll("[data-ajouter]").forEach((b) => (b.onclick = () => ajouter(b.dataset.ajouter)));
}
$("recherche").addEventListener("input", afficherResultats);

// =============================================================
// FICHE D'UN JOUEUR
// =============================================================
function caseCoequipier(id, idChoisi, poste) {
  const j = joueur(id);
  if (!j) return `<div class="coequipier"><small>${poste}</small><span>—</span></div>`;
  return `<button class="coequipier ${j.id === idChoisi ? "lui" : ""}" data-fiche="${j.id}">
    <small>${poste} · #${j.no ?? "–"}</small><span>${j.nom}</span></button>`;
}

function htmlFormation(idChoisi) {
  const f = FORMATION_MTL;
  const nomsTrios = ["1er trio", "2e trio", "3e trio", "4e trio"];
  const nomsPaires = ["1re paire", "2e paire", "3e paire"];
  let h = `<div class="formation">`;
  f.trios.forEach((t, i) => {
    h += `<div class="rangee"><span class="etiquette">${nomsTrios[i]}</span>
      ${caseCoequipier(t[0], idChoisi, "AG")}${caseCoequipier(t[1], idChoisi, "C")}${caseCoequipier(t[2], idChoisi, "AD")}</div>`;
  });
  f.paires.forEach((p, i) => {
    h += `<div class="rangee deux"><span class="etiquette">${nomsPaires[i]}</span>
      ${caseCoequipier(p[0], idChoisi, "D")}${caseCoequipier(p[1], idChoisi, "D")}</div>`;
  });
  h += `<div class="rangee deux"><span class="etiquette">Gardiens</span>
    ${caseCoequipier(f.gardiens[0], idChoisi, "Partant")}${caseCoequipier(f.gardiens[1], idChoisi, "Auxiliaire")}</div>`;
  h += `<div class="rangee"><span class="etiquette">Réserve</span>
    ${f.reserve.map((id) => caseCoequipier(id, idChoisi, joueur(id)?.pos || "")).join("")}</div>`;
  return h + `</div>`;
}

function htmlSaison(j) {
  let h = `<div class="saison">`;
  let moisCourant = -1;
  for (const m of CALENDRIER_MTL) {
    const d = versDate(m.date);
    if (d.getMonth() !== moisCourant) {
      moisCourant = d.getMonth();
      h += `<div class="mois">${MOIS[moisCourant]} ${d.getFullYear()}</div>`;
    }
    let res = `<span class="res">${heureDe(m)}</span>`;
    if (estDirect(m)) res = `<span class="res"><span class="badge-direct">EN DIRECT</span> ${m.res.mtl}-${m.res.adv}</span>`;
    else if (estFini(m)) {
      const r = texteResultat(m);
      const s = (STATS_MATCHS[m.date] || {})[j.id];
      const pts = s ? ` · ${s.b || 0} B, ${s.a || 0} A` : "";
      res = `<span class="res ${r.classe}">${r.texte}${pts}</span>`;
    }
    h += `<div class="ligne-match ${estFini(m) ? "passe" : ""}">
      <span>${dateLongue(m.date)}</span>
      <span class="lieu ${m.dom ? "" : "ext"}">${m.dom ? "DOM" : "ÉTR"}</span>
      <span>${m.adv}${m.note ? " · " + m.note : ""}</span>
      ${res}
    </div>`;
  }
  const note = misAJourAuto ? "" : `<p class="vide" style="margin-top:8px">Le reste de la saison (janvier à avril) sera ajouté bientôt.</p>`;
  return h + note + `</div>`;
}

function ouvrirFiche(idDemande) {
  const j = joueur(idDemande);
  if (!j) return;
  const id = j.id;
  const s = statsDe(j);
  const estFavori = favoris.includes(id);
  let corps = "";
  if (j.gardien) {
    corps += `<h3>Saison 2026-27</h3>${htmlStatsCourtes(j, s)}`;
  } else if (s) {
    corps += `<h3>Saison 2026-27</h3><div class="stats">
      <div><b>${s.pj}</b><small>Matchs</small></div><div><b>${s.b}</b><small>Buts</small></div>
      <div><b>${s.a}</b><small>Passes</small></div><div><b>${s.pts}</b><small>Points</small></div></div>
      ${s.pm != null ? `<p class="vide" style="text-align:center;margin-top:6px;font-style:normal">Différentiel : ${s.pm > 0 ? "+" : ""}${s.pm}</p>` : ""}`;
  }
  if (j.equipe === "MTL") {
    corps += `<h3>Son équipe : les Canadiens</h3>${htmlFormation(id)}`;
    corps += `<h3>Calendrier de sa saison</h3>${htmlSaison(j)}`;
  } else {
    corps += `<p class="note-fiche">${j.note || "Informations à venir."}</p>`;
  }
  $("fiche").innerHTML = `
    <div class="fiche-haut">
      ${pastilleNumero(j)}
      <div>
        <h2>${j.nom}${j.capitaine ? " (C)" : ""}</h2>
        <p>${NOMS_POS[j.pos]} · ${EQUIPES[j.equipe].nom} (${EQUIPES[j.equipe].ligue})</p>
        <p style="margin-top:10px">${estFavori
          ? `<button class="btn leger" data-retirer-fiche="${id}">Retirer de mes favoris</button>`
          : `<button class="btn rouge" data-ajouter-fiche="${id}">+ Ajouter à mes favoris</button>`}</p>
      </div>
      <button class="fermer" aria-label="Fermer">✕</button>
    </div>
    <div class="fiche-corps">${corps}</div>`;
  $("fiche-fond").hidden = false;
  $("fiche").querySelector(".fermer").onclick = fermerFiche;
  $("fiche").querySelectorAll("[data-fiche]").forEach((b) => (b.onclick = () => ouvrirFiche(b.dataset.fiche)));
  const ajout = $("fiche").querySelector("[data-ajouter-fiche]");
  if (ajout) ajout.onclick = () => { ajouter(id); ouvrirFiche(id); };
  const retrait = $("fiche").querySelector("[data-retirer-fiche]");
  if (retrait) retrait.onclick = () => { retirer(id); ouvrirFiche(id); };
  $("fiche-fond").scrollTop = 0;
}
function fermerFiche() { $("fiche-fond").hidden = true; }
$("fiche-fond").addEventListener("click", (e) => { if (e.target.id === "fiche-fond") fermerFiche(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerFiche(); });

// =============================================================
// DÉMARRAGE
// =============================================================
function toutAfficher() {
  afficherCalendrier();
  afficherFavoris();
  afficherResultats();
}
function afficherMiseAJour() {
  $("maj-badge").textContent = texteMiseAJour();
  $("maj-badge").classList.toggle("auto", !!misAJourAuto);
  $("maj").textContent = misAJourAuto
    ? "Stats fournies automatiquement à partir des données publiques de la LNH."
    : `Données saisies à la main, à jour au ${MISE_A_JOUR}. Les statistiques peuvent être incomplètes.`;
}

async function demarrer() {
  nettoyerFavoris();
  toutAfficher();
  afficherMiseAJour();
  await chargerDonneesAuto();
  nettoyerFavoris();
  toutAfficher();
  afficherMiseAJour();
  setInterval(afficherMiseAJour, 60000); // le « il y a X min » avance tout seul
}
demarrer();
