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
function abrev(adv) {
  for (const ville in ABREV) if (adv.includes(ville)) return ABREV[ville];
  return adv.slice(0, 3).toUpperCase();
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

const joueur = (id) => JOUEURS.find((j) => j.id === id);
const AUJOURDHUI = versTexte(new Date());

// ---- La liste de favoris (gardée dans le navigateur) --------
// Chaque visiteur a sa propre liste, enregistrée sur son appareil.
const CLE = "mes-favoris-hockey";
const FAVORIS_DE_DEPART = ["slafkovsky", "suzuki", "hutson", "hage"];

function lireFavoris() {
  try {
    const sauve = localStorage.getItem(CLE);
    if (sauve) return JSON.parse(sauve).filter((id) => joueur(id));
  } catch (e) { /* navigateur sans mémoire : on garde la liste de départ */ }
  return [...FAVORIS_DE_DEPART];
}
let favoris = lireFavoris();

function sauverFavoris() {
  try { localStorage.setItem(CLE, JSON.stringify(favoris)); } catch (e) {}
}

// ---- Statistiques -------------------------------------------
function habille(id) {
  // Le joueur a-t-il joué ? (tout le monde sauf les réservistes)
  return !FORMATION_MTL.reserve.includes(id);
}
function statsDe(j) {
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
  return CALENDRIER_MTL.find((m) => !m.res && m.date >= AUJOURDHUI) || null;
}
function texteResultat(m) {
  const victoire = m.res.mtl > m.res.adv;
  const fin = m.res.prol ? " (prol.)" : "";
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
      let txt = (match.dom ? "vs " : "@ ") + abrev(match.adv);
      if (match.res) { const r = texteResultat(match); classe = r.classe; txt = r.texte.split(" ")[0] + " " + r.texte.split(" ")[1]; }
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
  let score = `<span>${match.heure}</span>`;
  if (match.res) { const r = texteResultat(match); score = `<span class="score">${r.texte}</span>`; }
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
        ${s ? `<div class="stats">
          <div><b>${s.pj}</b><small>PJ</small></div>
          <div><b>${s.b}</b><small>B</small></div>
          <div><b>${s.a}</b><small>A</small></div>
          <div><b>${s.pts}</b><small>PTS</small></div>
        </div>` : `<div class="prochain">${j.pos === "G" ? "Stats de gardien à venir." : "Stats pas encore ajoutées."}</div>`}
        <div class="prochain">${p ? `Prochain match : <strong>${dateLongue(p.date)}</strong> ${p.dom ? "vs" : "@"} ${abrev(p.adv)}` : EQUIPES[j.equipe].ligue}</div>
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
  return `<button class="coequipier ${id === idChoisi ? "lui" : ""}" data-fiche="${id}">
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
    ${f.reserve.map((id) => caseCoequipier(id, idChoisi, joueur(id).pos)).join("")}</div>`;
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
    let res = `<span class="res">${m.heure}</span>`;
    if (m.res) {
      const r = texteResultat(m);
      const s = (STATS_MATCHS[m.date] || {})[j.id];
      const pts = s ? ` · ${s.b || 0} B, ${s.a || 0} A` : "";
      res = `<span class="res ${r.classe}">${r.texte}${pts}</span>`;
    }
    h += `<div class="ligne-match ${m.res ? "passe" : ""}">
      <span>${dateLongue(m.date)}</span>
      <span class="lieu ${m.dom ? "" : "ext"}">${m.dom ? "DOM" : "ÉTR"}</span>
      <span>${m.adv}${m.note ? " · " + m.note : ""}</span>
      ${res}
    </div>`;
  }
  return h + `<p class="vide" style="margin-top:8px">Le reste de la saison (janvier à avril) sera ajouté bientôt.</p></div>`;
}

function ouvrirFiche(id) {
  const j = joueur(id);
  const s = statsDe(j);
  const estFavori = favoris.includes(id);
  let corps = "";
  if (s) {
    corps += `<h3>Saison 2026-27</h3><div class="stats">
      <div><b>${s.pj}</b><small>Matchs</small></div><div><b>${s.b}</b><small>Buts</small></div>
      <div><b>${s.a}</b><small>Passes</small></div><div><b>${s.pts}</b><small>Points</small></div></div>`;
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
$("maj").textContent = MISE_A_JOUR;
toutAfficher();
