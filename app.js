// =============================================================
// CE QUI REND LA PAGE VIVANTE
// Ce fichier charge les données du robot (dossier data/), les
// affiche dans les pages du site (index.html) et réagit aux clics.
// Il est découpé en parties numérotées.
// =============================================================

// ---- 0. Petits outils ---------------------------------------
const $ = (id) => document.getElementById(id);
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const NOMS_POS = { AG: "Ailier gauche", C: "Centre", AD: "Ailier droit", AV: "Attaquant", D: "Défenseur", G: "Gardien" };

function versTexte(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function versDate(t) { const [a, m, j] = t.split("-").map(Number); return new Date(a, m - 1, j); }
function dateLongue(t) { const d = versDate(t); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; }
function decaler(t, n) { const d = versDate(t); d.setDate(d.getDate() + n); return versTexte(d); }
function simplifier(t) { return String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
function slug(t) { return simplifier(t).replace(/[^a-z]+/g, "-").replace(/^-|-$/g, ""); }
function echapper(t) { return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
function pluriel(n, mot) { return `${n} ${mot}${n > 1 ? "s" : ""}`; }
function heureDe(m) {
  return m.debut ? new Date(m.debut).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "";
}
async function lireJson(url) {
  const rep = await fetch(url, { cache: "no-store" });
  if (!rep.ok) throw new Error(url + " : " + rep.status);
  return rep.json();
}
function memoire(cle, valeur) {
  try { if (valeur === undefined) return localStorage.getItem(cle); localStorage.setItem(cle, valeur); } catch (e) { return null; }
}
let AUJ = versTexte(new Date());

// ---- 1. Les ligues et leurs données -------------------------
const LIGUES = {
  lnh:   { nom: "LNH",   long: "Ligue nationale de hockey" },
  ahl:   { nom: "LAH",   long: "Ligue américaine de hockey" },
  lhjmq: { nom: "LHJMQ", long: "Junior · Québec et Maritimes" },
  ohl:   { nom: "OHL",   long: "Junior · Ontario" },
  whl:   { nom: "WHL",   long: "Junior · Ouest canadien et américain" },
};
const NOMS_CONF = { Eastern: "Association de l'Est", Western: "Association de l'Ouest" };
const NOMS_DIV = { Atlantic: "Division Atlantique", Metropolitan: "Division Métropolitaine", Central: "Division Centrale", Pacific: "Division Pacifique" };

// Tout ce qui est chargé, toutes ligues confondues
const D = { joueurs: [], parId: new Map(), equipes: {}, cal: [], classement: {}, misAJour: {}, points: {}, charge: {}, direct: false };
let ligue = LIGUES[memoire("ligue")] ? memoire("ligue") : "lnh";

const infoEq = (eq) => D.equipes[eq] || { abr: eq, nom: AUTRES_EQUIPES[eq] || eq, court: AUTRES_EQUIPES[eq] || eq, lig: null };
const abr = (eq) => infoEq(eq).abr;
const nomEq = (eq) => infoEq(eq).nom;
const courtEq = (eq) => infoEq(eq).court;
const ligueDe = (eq) => infoEq(eq).lig;
const nomDeFamille = (j) => j.nom.split(" ").slice(1).join(" ") || j.nom;

function ajouterDonnees(lig, equipes, joueurs, cal, classement, misAJour) {
  for (const [k, e] of Object.entries(equipes)) D.equipes[k] = { ...e, lig };
  for (const j of joueurs) { j.lig = lig; D.joueurs.push(j); D.parId.set(j.id, j); }
  D.cal.push(...cal);
  D.cal.sort((a, b) => (a.debut || a.date).localeCompare(b.debut || b.date));
  D.classement[lig] = classement;
  D.misAJour[lig] = new Date(misAJour);
}
async function chargerLnh() {
  const [j, cal, cl] = await Promise.all([
    lireJson("data/joueurs.json"), lireJson("data/calendrier.json"), lireJson("data/classement.json").catch(() => []),
  ]);
  const equipes = {};
  for (const [abrev, nom] of Object.entries(j.equipes)) equipes[abrev] = { abr: abrev, nom, court: nom.split(/\s(?:de|du|des)\s|\sd'/)[0] };
  for (const t of cl) {
    t.conf = NOMS_CONF[t.conf] || t.conf; t.div = NOMS_DIV[t.div] || t.div;
    if (equipes[t.eq]) Object.assign(equipes[t.eq], { conf: t.conf, div: t.div });
  }
  ajouterDonnees("lnh", equipes, j.joueurs, cal, cl, j.misAJour);
}
async function chargerAutre(lig) {
  const [infos, cal] = await Promise.all([lireJson(`data/ligues/${lig}/infos.json`), lireJson(`data/ligues/${lig}/calendrier.json`)]);
  ajouterDonnees(lig, infos.equipes, infos.joueurs, cal, infos.classement, infos.misAJour);
}
// Charge une ligue une seule fois (les suivantes réutilisent le même résultat)
function charger(lig) {
  if (!LIGUES[lig]) return Promise.resolve();
  if (!D.charge[lig]) D.charge[lig] = (lig === "lnh" ? chargerLnh() : chargerAutre(lig)).catch((e) => { delete D.charge[lig]; throw e; });
  return D.charge[lig];
}
const chargerTout = () => Promise.allSettled(Object.keys(LIGUES).map(charger));
async function points(eq) {
  const lig = ligueDe(eq);
  if (!lig) return {};
  if (!D.points[eq]) D.points[eq] = lireJson(lig === "lnh" ? `data/points/${eq}.json` : `data/ligues/${lig}/points/${eq}.json`).catch(() => ({}));
  return D.points[eq];
}

// Trouve un joueur par son identifiant, ou par son nom simplifié
// (ex. "slafkovsky" ou "arber-xhekaj"), de préférence dans l'équipe donnée.
function joueur(id, eqPrefere = "MTL") {
  if (!id) return null;
  if (D.parId.has(id)) return D.parId.get(id);
  const autre = AUTRES_JOUEURS.find((j) => j.id === id);
  if (autre) return autre;
  if (/^[a-z]+-\d+$/.test(id)) return null; // joueur d'une ligue pas encore chargée
  const s = slug(id);
  const candidats = D.joueurs.filter((j) => j.lig === "lnh" && (slug(j.nom) === s || slug(nomDeFamille(j)) === s));
  return candidats.find((j) => j.eq === eqPrefere) || candidats[0] || null;
}
function joueurDansEquipe(s, eq) {
  return D.joueurs.find((j) => j.eq === eq && (slug(j.nom) === s || slug(nomDeFamille(j)) === s)) || null;
}

// ---- 2. Les matchs ------------------------------------------
const estFini = (m) => m.etat === "fini";
const estDirect = (m) => m.etat === "direct";
const matchsDe = (eq) => D.cal.filter((m) => m.dom === eq || m.ext === eq);
const matchsLigue = (lig) => D.cal.filter((m) => ligueDe(m.dom) === lig);
const adversaire = (m, eq) => (m.dom === eq ? m.ext : m.dom);
function scorePour(m, eq) {
  const nous = m.dom === eq ? m.sd : m.se, eux = m.dom === eq ? m.se : m.sd;
  return { nous, eux };
}
const suffixeFin = (m) => (m.fin === "SO" ? " (TB)" : m.fin === "OT" ? " (P)" : "");
function resultatPour(m, eq) {
  const { nous, eux } = scorePour(m, eq);
  if (estDirect(m)) return { texte: `${nous}-${eux}`, classe: "direct" };
  return { texte: `${nous > eux ? "V" : "D"} ${nous}-${eux}${suffixeFin(m)}`, classe: nous > eux ? "v" : "d" };
}
function statutMatch(m) {
  if (estDirect(m)) return m.periode || "En direct";
  if (estFini(m)) return "Final" + suffixeFin(m);
  return heureDe(m);
}
function prochainMatch(eq) {
  return D.cal.find((m) => (m.dom === eq || m.ext === eq) && !estFini(m) && m.date >= AUJ) || null;
}

// ---- 3. Les favoris (gardés dans le navigateur du visiteur) --
let favoris = [];
function lireFavoris() {
  try { const s = memoire("mes-favoris-hockey"); if (s) return JSON.parse(s); } catch (e) {}
  return [...FAVORIS_DE_DEPART];
}
const sauverFavoris = () => memoire("mes-favoris-hockey", JSON.stringify(favoris));
function nettoyerFavoris() {
  // Convertit les anciens identifiants (ex. "suzuki") ; garde ceux d'une ligue pas encore chargée
  favoris = [...new Set(favoris.map((id) => joueur(id)?.id || (/^[a-z]+-\d+$/.test(id) && !D.charge[id.split("-")[0]] ? id : null)).filter(Boolean))];
}
const liguesDesFavoris = (liste) => [...new Set(liste.map((id) => (/^([a-z]+)-\d+$/.exec(id) || [])[1]).filter((l) => LIGUES[l]))];
const favorisObjets = () => favoris.map((id) => joueur(id)).filter(Boolean);
const equipesFavorites = () => [...new Set(favorisObjets().map((j) => j.eq).filter((e) => D.equipes[e]))];
function ajouter(id) { if (!favoris.includes(id)) favoris.push(id); sauverFavoris(); rafraichir(); }
function retirer(id) { favoris = favoris.filter((f) => f !== id); sauverFavoris(); rafraichir(); }

// ---- 4. Choix de la ligue ------------------------------------
function rendreChoixLigue() {
  $("choix-ligue").innerHTML = Object.entries(LIGUES).map(([k, l]) =>
    `<button class="puce-ligue ${k === ligue ? "actif" : ""}" data-ligue="${k}" role="tab" aria-selected="${k === ligue}">${l.nom}</button>`).join("");
  $("ligue-long").textContent = LIGUES[ligue].long;
  document.querySelectorAll("[data-nom-ligue]").forEach((x) => (x.textContent = LIGUES[ligue].nom));
}
async function choisirLigue(k) {
  if (!LIGUES[k] || k === ligue) return;
  ligue = k; memoire("ligue", k);
  rendreChoixLigue();
  document.body.classList.add("chargement");
  try { await charger(k); } catch (e) { montrerErreur(`Les données de la ${LIGUES[k].nom} n'ont pas pu être chargées pour l'instant.`); }
  document.body.classList.remove("chargement");
  equipeChoisie = null;
  rafraichir(); rendreUne(); rendreMiseAJour();
}
$("choix-ligue").addEventListener("click", (e) => { const b = e.target.closest("[data-ligue]"); if (b) choisirLigue(b.dataset.ligue); });
function montrerErreur(t) { $("erreur").hidden = false; $("erreur").textContent = t; setTimeout(() => ($("erreur").hidden = true), 8000); }

// ---- 5. Scores (bandeau du haut + page Scores) ----------------
let jourScores = AUJ;
function texteJour(t) {
  const d = versDate(t);
  if (t === AUJ) return "Aujourd'hui";
  if (t === decaler(AUJ, -1)) return "Hier";
  if (t === decaler(AUJ, 1)) return "Demain";
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS_COURT[d.getMonth()]}`;
}
function rendreBandeau() {
  $("score-jour").textContent = texteJour(jourScores);
  const liste = matchsLigue(ligue).filter((m) => m.date === jourScores);
  const fav = equipesFavorites();
  if (!liste.length) { $("bandeau-matchs").innerHTML = `<span class="bandeau-vide">Aucun match dans la ${LIGUES[ligue].nom} ce jour-là.</span>`; return; }
  $("bandeau-matchs").innerHTML = liste.map((m) => {
    const joue = estFini(m) || estDirect(m);
    return `<a class="score-carte ${fav.includes(m.dom) || fav.includes(m.ext) ? "favori" : ""}" href="#/scores">
      <span class="statut ${estDirect(m) ? "direct" : ""}">${estDirect(m) ? "● " : ""}${statutMatch(m)}</span>
      <span class="eq ${estFini(m) && m.se < m.sd ? "perd" : ""}"><span>${abr(m.ext)}</span><span>${joue ? m.se : ""}</span></span>
      <span class="eq ${estFini(m) && m.sd < m.se ? "perd" : ""}"><span>${abr(m.dom)}</span><span>${joue ? m.sd : ""}</span></span>
    </a>`;
  }).join("");
}
async function rendrePageScores() {
  $("page-score-jour").textContent = jourScores === AUJ ? "Aujourd'hui" : dateLongue(jourScores);
  const liste = matchsLigue(ligue).filter((m) => m.date === jourScores);
  if (!liste.length) { $("grille-scores").innerHTML = `<p class="vide">Aucun match dans la ${LIGUES[ligue].nom} ce jour-là. Essaie les flèches pour changer de journée.</p>`; return; }
  const favs = favorisObjets(), eqs = equipesFavorites();
  let h = "";
  for (const m of liste) {
    const joue = estFini(m) || estDirect(m);
    const pts = joue ? { ...(await points(m.dom))[m.id], ...(await points(m.ext))[m.id] } : {};
    const lesMiens = favs.filter((j) => j.eq === m.dom || j.eq === m.ext);
    const etoiles = Object.entries(pts).map(([id, [b, a]]) => ({ j: D.parId.get(id), b, a }))
      .filter((x) => x.j).sort((x, y) => (y.b + y.a) - (x.b + x.a) || y.b - x.b).slice(0, 3);
    const ligne = (eq, score, gagne) => `<div class="gs-eq ${estFini(m) && !gagne ? "perd" : ""}">
      <span class="gs-abr">${abr(eq)}</span><span class="gs-nom">${echapper(nomEq(eq))}</span><span class="gs-score">${joue ? score : ""}</span></div>`;
    h += `<article class="gs-carte ${eqs.includes(m.dom) || eqs.includes(m.ext) ? "favori" : ""}">
      <div class="gs-statut">${estDirect(m) ? `<span class="badge-direct">EN DIRECT</span> ${m.periode || ""}` : statutMatch(m)}${m.series ? " · Séries" : ""}</div>
      ${ligne(m.ext, m.se, m.se > m.sd)}${ligne(m.dom, m.sd, m.sd > m.se)}
      ${etoiles.length ? `<div class="gs-etoiles">${etoiles.map((x) => `<button class="puce-joueur" data-fiche="${x.j.id}">${echapper(nomDeFamille(x.j))} (${abr(x.j.eq)}) ${x.b} B, ${x.a} A</button>`).join("")}</div>` : ""}
      ${lesMiens.length ? `<div class="gs-favoris">⭐ ${lesMiens.map((j) => echapper(nomDeFamille(j))).join(", ")}</div>` : ""}
    </article>`;
  }
  $("grille-scores").innerHTML = h;
}
function changerJourScores(n) { jourScores = decaler(jourScores, n); rendreBandeau(); rendrePageScores(); }
$("score-prec").onclick = () => changerJourScores(-1);
$("score-suiv").onclick = () => changerJourScores(1);
$("page-score-prec").onclick = () => changerJourScores(-1);
$("page-score-suiv").onclick = () => changerJourScores(1);

// ---- 6. À la une (résumés générés à partir des stats) -------
function titrePerformance(p) {
  const nom = p.j.nom;
  if (p.b >= 3) return `Tour du chapeau pour ${nom}`;
  if (p.b + p.a >= 4) return `${nom} brille avec ${p.b + p.a} points`;
  if (p.b === 2) return `${nom} marque deux fois`;
  if (p.b + p.a === 3) return `${nom} récolte 3 points`;
  if (p.a >= 2) return `${nom} distribue ${p.a} passes`;
  return `${nom} se démarque`;
}
function phraseMatch(p) {
  const { nous, eux } = scorePour(p.m, p.j.eq);
  const fin = p.m.fin === "SO" ? " en tirs de barrage" : p.m.fin === "OT" ? " en prolongation" : "";
  const issue = nous > eux ? `l'emportent ${nous}-${eux}${fin}` : `s'inclinent ${eux}-${nous}${fin}`;
  return `${pluriel(p.b, "but")} et ${pluriel(p.a, "passe")} pour le n° ${p.j.no ?? "–"}. Les ${courtEq(p.j.eq)} ${issue} face aux ${courtEq(adversaire(p.m, p.j.eq))}.`;
}
let jetonUne = 0;
async function rendreUne() {
  const jeton = ++jetonUne;
  const finis = matchsLigue(ligue).filter((m) => estFini(m) && m.date <= AUJ);
  if (!finis.length) { $("une").innerHTML = `<p class="vide">La saison n'est pas encore commencée.</p>`; $("manchettes").innerHTML = ""; $("une-date").textContent = ""; return; }
  const date = finis[finis.length - 1].date;
  const perfs = [];
  for (const m of finis.filter((x) => x.date === date)) {
    for (const eq of [m.dom, m.ext]) {
      const ligne = (await points(eq))[m.id] || {};
      for (const pid in ligne) {
        const j = D.parId.get(pid);
        if (j && j.eq === eq) perfs.push({ j, m, b: ligne[pid][0], a: ligne[pid][1] });
      }
    }
  }
  if (jeton !== jetonUne) return; // une autre ligue a été choisie entre-temps
  $("une-date").textContent = `Matchs du ${dateLongue(date)}`;
  perfs.sort((x, y) => (y.b + y.a) - (x.b + x.a) || y.b - x.b);
  const [h, ...reste] = perfs;
  if (!h) { $("une").innerHTML = `<p class="vide">Résumés à venir.</p>`; $("manchettes").innerHTML = ""; return; }
  $("une").innerHTML = `
    <button class="une-hero" data-fiche="${h.j.id}">
      <div class="une-visuel"><span class="gros-no">${h.j.no ?? ""}</span><span class="eq-tag">${abr(h.j.eq)}</span></div>
      <div class="une-texte">
        <span class="categorie">${LIGUES[ligue].nom} · ${echapper(nomEq(h.j.eq))}</span>
        <h3>${echapper(titrePerformance(h))}</h3>
        <p>${echapper(phraseMatch(h))}</p>
      </div>
    </button>`;
  $("manchettes").innerHTML = reste.slice(0, 6).map((p) => `
    <li><button data-fiche="${p.j.id}">
      <span class="chiffre">${p.b + p.a}</span>
      <span><strong>${echapper(titrePerformance(p))}</strong><small>${abr(p.j.eq)} vs ${abr(adversaire(p.m, p.j.eq))} · ${p.b} B, ${p.a} A</small></span>
    </button></li>`).join("");
}

// ---- 7. Ce soir pour tes favoris (toutes les ligues) ---------
async function rendreSoir() {
  const favs = favorisObjets(), eqs = equipesFavorites();
  const ceSoir = D.cal.filter((m) => m.date === AUJ && (eqs.includes(m.dom) || eqs.includes(m.ext)));
  if (!favs.length) { $("soir").innerHTML = `<p class="vide">Ajoute des joueurs à tes favoris pour suivre leurs matchs ici.</p>`; return; }
  if (!ceSoir.length) {
    const p = eqs.map(prochainMatch).filter((x) => x && x.debut).sort((a, b) => a.debut.localeCompare(b.debut))[0];
    $("soir").innerHTML = `<p class="vide">Pas de match ce soir pour tes favoris. Repose-toi! 😄${p ? `<br>Prochain rendez-vous : <strong>${dateLongue(p.date)}</strong>, ${echapper(courtEq(p.ext))} @ ${echapper(courtEq(p.dom))} à ${heureDe(p)}.` : ""}</p>`;
    return;
  }
  let h = "";
  for (const m of ceSoir) {
    const lesMiens = favs.filter((j) => j.eq === m.dom || j.eq === m.ext);
    const pts = { ...(await points(m.dom))[m.id], ...(await points(m.ext))[m.id] };
    const statut = estDirect(m) ? `<span class="badge-direct">EN DIRECT</span> <strong>${m.se}-${m.sd}</strong>`
      : estFini(m) ? `<strong>Final ${m.se}-${m.sd}${suffixeFin(m)}</strong>` : `<strong>${heureDe(m)}</strong>`;
    h += `<div class="soir-match">
      <div class="soir-tete"><strong><span class="tag-ligue petit">${LIGUES[ligueDe(m.dom)].nom}</span> ${echapper(courtEq(m.ext))} @ ${echapper(courtEq(m.dom))}</strong><span>${statut}</span></div>
      <div class="soir-joueurs">${lesMiens.map((j) => {
        const p = pts[j.id];
        return `<button class="puce-joueur ${p ? "chaud" : ""}" data-fiche="${j.id}">${echapper(p ? `🔥 ${nomDeFamille(j)} : ${p[0]} B, ${p[1]} A` : nomDeFamille(j))}</button>`;
      }).join("")}</div>
    </div>`;
  }
  $("soir").innerHTML = h;
}

// ---- 8. Cartes des favoris -----------------------------------
const pastille = (j) => `<span class="numero">${j.no ?? "–"}</span>`;
function etiquetteLigue(j) {
  const l = j.lig ? LIGUES[j.lig].nom : "NCAA";
  return `<span class="tag-ligue petit">${l}</span>`;
}
function htmlStats(j) {
  if (j.g) {
    const g = j.g;
    return `<div class="stats">
      <div><b>${g.pj}</b><small>PJ</small></div><div><b>${g.v}-${g.d}-${g.dp}</b><small>Fiche</small></div>
      <div><b>${g.moy != null ? g.moy.toFixed(2) : "–"}</b><small>Moy.</small></div>
      <div><b>${g.pct != null ? g.pct.toFixed(3).replace(/^0/, "") : "–"}</b><small>% arr.</small></div></div>`;
  }
  if (j.s) {
    const s = j.s;
    return `<div class="stats"><div><b>${s.pj}</b><small>PJ</small></div><div><b>${s.b}</b><small>B</small></div>
      <div><b>${s.a}</b><small>A</small></div><div><b>${s.pts}</b><small>PTS</small></div></div>`;
  }
  return `<div class="prochain">Stats à venir.</div>`;
}
function htmlProchain(j) {
  if (!D.equipes[j.eq]) return "Suivi de cette ligue : bientôt!";
  const direct = D.cal.find((m) => estDirect(m) && (m.dom === j.eq || m.ext === j.eq));
  if (direct) { const r = resultatPour(direct, j.eq); return `<span class="badge-direct">EN DIRECT</span> <strong>${r.texte}</strong> contre ${abr(adversaire(direct, j.eq))}`; }
  const p = prochainMatch(j.eq);
  if (!p) return "Saison terminée";
  return `Prochain : <strong>${p.date === AUJ ? "ce soir" : dateLongue(p.date)}</strong> ${p.dom === j.eq ? "vs" : "@"} ${abr(adversaire(p, j.eq))} · ${heureDe(p)}`;
}
function rendreFavoris() {
  const favs = favorisObjets();
  $("nb-favoris").textContent = favs.length;
  if (!favs.length) {
    const idees = D.joueurs.filter((j) => j.lig === "lnh" && j.s).sort((a, b) => b.s.pts - a.s.pts).slice(0, 4);
    $("cartes-favoris").innerHTML = `<div><p class="vide">Ta liste est vide. Pour commencer, essaie un de ces joueurs en feu :</p>
      <div class="suggestions">${idees.map((j) => `<button class="btn leger" data-ajouter="${j.id}">+ ${echapper(j.nom)} (${abr(j.eq)})</button>`).join("")}</div></div>`;
    return;
  }
  $("cartes-favoris").innerHTML = favs.map((j) => `
    <div class="carte-joueur">
      <div class="haut">${pastille(j)}<div><h3>${echapper(j.nom)}</h3><div class="equipe">${etiquetteLigue(j)} ${NOMS_POS[j.pos] || j.pos} · ${echapper(nomEq(j.eq))}</div></div></div>
      <div class="bas">
        ${htmlStats(j)}
        <div class="prochain">${htmlProchain(j)}</div>
        <div class="actions">
          <button class="btn" data-fiche="${j.id}">Voir la fiche</button>
          <button class="btn leger" data-retirer="${j.id}" aria-label="Retirer ${echapper(j.nom)}">Retirer</button>
        </div>
      </div>
    </div>`).join("");
}

// ---- 9. Calendrier de la semaine (toutes les ligues) ---------
function lundiDe(t) { const d = versDate(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return versTexte(d); }
let debutSemaine = lundiDe(AUJ), jourChoisi = AUJ;
function rendreCalendrier() {
  const eqs = equipesFavorites();
  const d0 = versDate(debutSemaine), d1 = versDate(decaler(debutSemaine, 6));
  $("sem-titre").textContent = `${d0.getDate()} ${MOIS_COURT[d0.getMonth()]} – ${d1.getDate()} ${MOIS_COURT[d1.getMonth()]}`;
  let h = "";
  for (let i = 0; i < 7; i++) {
    const t = decaler(debutSemaine, i), d = versDate(t);
    const ms = D.cal.filter((m) => m.date === t && (eqs.includes(m.dom) || eqs.includes(m.ext)));
    let puces = "";
    if (ms.length) {
      const m = ms[0], eq = eqs.includes(m.dom) ? m.dom : m.ext;
      let classe = "", txt = `${m.dom === eq ? "vs" : "@"} ${abr(adversaire(m, eq))}`;
      if (estDirect(m) || estFini(m)) { const r = resultatPour(m, eq); classe = r.classe; txt = estDirect(m) ? `● ${r.texte}` : r.texte.split(" ").slice(0, 2).join(" "); }
      puces = `<span class="puce ${classe}">${txt}</span>${ms.length > 1 ? `<span class="puce">+${ms.length - 1}</span>` : ""}`;
    }
    h += `<button class="jour ${t === AUJ ? "aujourdhui" : ""} ${t === jourChoisi ? "choisi" : ""}" data-jour="${t}">
      <span class="nom-jour">${JOURS[d.getDay()]}</span><span class="num-jour">${d.getDate()}</span>${puces}</button>`;
  }
  $("calendrier").innerHTML = h;
  const ms = D.cal.filter((m) => m.date === jourChoisi && (eqs.includes(m.dom) || eqs.includes(m.ext)));
  $("detail-jour").innerHTML = `<p class="detail-titre">${dateLongue(jourChoisi)}${jourChoisi === AUJ ? " · aujourd'hui" : ""}</p>` + (ms.length ? ms.map((m) => {
    const qui = favorisObjets().filter((j) => j.eq === m.dom || j.eq === m.ext).map(nomDeFamille).join(", ");
    return `<div class="soir-match"><div class="soir-tete"><strong><span class="tag-ligue petit">${LIGUES[ligueDe(m.dom)].nom}</span> ${echapper(courtEq(m.ext))} @ ${echapper(courtEq(m.dom))}</strong>
      <span>${estDirect(m) ? '<span class="badge-direct">EN DIRECT</span> ' : ""}<strong>${estFini(m) || estDirect(m) ? `${m.se}-${m.sd}` : heureDe(m)}</strong></span></div>
      <p class="petit-gris" style="margin-top:6px">Tes favoris : ${echapper(qui)}</p></div>`;
  }).join("") : `<p class="vide">Aucun de tes favoris ne joue cette journée.</p>`);
}
$("sem-prec").onclick = () => { debutSemaine = decaler(debutSemaine, -7); rendreCalendrier(); };
$("sem-suiv").onclick = () => { debutSemaine = decaler(debutSemaine, 7); rendreCalendrier(); };

// ---- 10. Classement et meneurs (ligue choisie) ----------------
let vueClassement = "conf";
const trierEquipes = (l) => [...l].sort((a, b) => b.pts - a.pts || a.pj - b.pj || b.v - a.v);
function tableClassement(titre, liste) {
  const eqs = equipesFavorites();
  return `<div class="table-bloc"><h3>${echapper(titre)}</h3><div class="defile"><table class="tableau">
    <thead><tr><th>#</th><th>Équipe</th><th>PJ</th><th>V</th><th>D</th><th>DP</th><th>PTS</th><th class="large">BP</th><th class="large">BC</th><th class="large">Série</th></tr></thead><tbody>
    ${trierEquipes(liste).map((t, i) => `<tr class="${eqs.includes(t.eq) ? "favori" : ""}"><td>${i + 1}</td>
      <td class="eq"><span class="abr">${abr(t.eq)}</span> <span class="nom-long">${echapper(courtEq(t.eq))}</span></td>
      <td>${t.pj}</td><td>${t.v}</td><td>${t.d}</td><td>${t.dp}</td><td class="pts">${t.pts}</td>
      <td class="large">${t.bp}</td><td class="large">${t.bc}</td><td class="large">${t.serie || "–"}</td></tr>`).join("")}
  </tbody></table></div></div>`;
}
const groupes = (liste, cle) => [...new Set(liste.map((t) => t[cle]).filter(Boolean))];
function rendreClassement() {
  const c = D.classement[ligue] || [];
  if (!c.length) { $("tables-classement").innerHTML = `<p class="vide">Classement à venir.</p>`; return; }
  let h = "";
  if (vueClassement === "ligue") h = tableClassement(`Toute la ${LIGUES[ligue].nom}`, c);
  else for (const g of groupes(c, vueClassement)) h += tableClassement(g, c.filter((t) => t[vueClassement] === g));
  $("tables-classement").innerHTML = h;
  $("tables-classement").classList.toggle("une-col", vueClassement === "ligue");
}
document.querySelectorAll("[data-vue]").forEach((b) => b.onclick = () => {
  vueClassement = b.dataset.vue;
  document.querySelectorAll("[data-vue]").forEach((x) => x.classList.toggle("actif", x === b));
  rendreClassement();
});

const joueursLigue = () => D.joueurs.filter((j) => j.lig === ligue);
function listeMeneurs(n, filtre, val) {
  return joueursLigue().filter(filtre).sort((a, b) => val(b) - val(a) || (b.s?.pts ?? 0) - (a.s?.pts ?? 0)).slice(0, n);
}
const patineur = (j) => j.s && j.s.pj > 0;
function htmlMeneurs(liste, aff) {
  if (!liste.length) return `<li class="vide">À venir.</li>`;
  return liste.map((j) => `<li data-fiche="${j.id}">
    <span class="nom">${echapper(j.nom)}${favoris.includes(j.id) ? " ⭐" : ""}<small>${echapper(courtEq(j.eq))} · ${pluriel((j.s || j.g).pj, "match")}</small></span>
    <span class="val">${aff(j)}</span></li>`).join("");
}
function rendreMeneurs() {
  $("mini-meneurs").innerHTML = htmlMeneurs(listeMeneurs(5, patineur, (j) => j.s.pts), (j) => j.s.pts);
  const maxPj = Math.max(1, ...(D.classement[ligue] || []).map((t) => t.pj));
  const gardien = (j) => j.g && j.g.pj >= Math.max(1, Math.floor(maxPj / 3));
  const blocs = [
    ["Points", htmlMeneurs(listeMeneurs(15, patineur, (j) => j.s.pts), (j) => j.s.pts)],
    ["Buts", htmlMeneurs(listeMeneurs(15, patineur, (j) => j.s.b), (j) => j.s.b)],
    ["Passes", htmlMeneurs(listeMeneurs(15, patineur, (j) => j.s.a), (j) => j.s.a)],
    ["Différentiel", htmlMeneurs(listeMeneurs(10, patineur, (j) => j.s.pm), (j) => (j.s.pm > 0 ? "+" : "") + j.s.pm)],
    ["Gardiens · Victoires", htmlMeneurs(listeMeneurs(10, gardien, (j) => j.g.v), (j) => j.g.v)],
    ["Gardiens · % d'arrêts", htmlMeneurs(listeMeneurs(10, (j) => gardien(j) && j.g.pct != null, (j) => j.g.pct), (j) => j.g.pct.toFixed(3).replace(/^0/, ""))],
  ];
  $("grille-meneurs").innerHTML = blocs.map(([t, l]) => `<section class="bloc"><div class="titre-section"><h2>${t} <span class="tag-ligue">${LIGUES[ligue].nom}</span></h2></div><ol class="meneurs">${l}</ol></section>`).join("");
}

// ---- 11. Recherche (toutes les ligues) et liste des équipes ---
let equipeChoisie = null;
const ORDRE_POS = ["C", "AG", "AD", "AV", "D", "G"];
function rendreResultats() {
  const q = simplifier($("recherche").value.trim());
  $("equipes").hidden = !!q;
  if (!q && !equipeChoisie) { $("resultats").innerHTML = ""; return; }
  const trouves = q
    ? [...D.joueurs, ...AUTRES_JOUEURS].filter((j) => simplifier(j.nom).includes(q) || simplifier(nomEq(j.eq)).includes(q) || simplifier(abr(j.eq)) === q)
        .sort((a, b) => (a.lig === ligue ? 0 : 1) - (b.lig === ligue ? 0 : 1)).slice(0, 30)
    : D.joueurs.filter((j) => j.eq === equipeChoisie).sort((a, b) => ORDRE_POS.indexOf(a.pos) - ORDRE_POS.indexOf(b.pos) || (a.no ?? 99) - (b.no ?? 99));
  $("resultats").innerHTML = trouves.length ? trouves.map((j) => `
    <li>${pastille(j)}
      <div class="infos" data-fiche="${j.id}"><strong>${echapper(j.nom)}</strong><span>${etiquetteLigue(j)} ${NOMS_POS[j.pos] || j.pos} · ${echapper(courtEq(j.eq))}</span></div>
      ${favoris.includes(j.id) ? `<button class="btn leger" disabled aria-label="Déjà dans tes favoris">✓</button>` : `<button class="btn accent" data-ajouter="${j.id}" aria-label="Ajouter ${echapper(j.nom)}">+</button>`}
    </li>`).join("") : `<li class="vide">Aucun joueur trouvé.</li>`;
}
$("recherche").addEventListener("input", () => { equipeChoisie = null; rendreResultats(); rendreEquipes(); });
// La recherche couvre toutes les ligues : on les charge à la première lettre tapée
$("recherche").addEventListener("focus", () => { chargerTout().then(() => { nettoyerFavoris(); rendreResultats(); }); }, { once: true });
function rendreEquipes() {
  const liste = Object.keys(D.equipes).filter((e) => ligueDe(e) === ligue).sort((a, b) => courtEq(a).localeCompare(courtEq(b), "fr"));
  $("equipes").innerHTML = `<p class="detail-titre">Ou choisis une équipe de la ${LIGUES[ligue].nom} :</p><div class="equipes-liste">${liste.map((eq) =>
    `<button class="btn-equipe ${eq === equipeChoisie ? "actif" : ""}" data-equipe="${eq}" title="${echapper(nomEq(eq))}"><b>${abr(eq)}</b><span>${echapper(courtEq(eq))}</span></button>`).join("")}</div>`;
}
$("equipes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-equipe]");
  if (!b) return;
  equipeChoisie = equipeChoisie === b.dataset.equipe ? null : b.dataset.equipe;
  rendreEquipes(); rendreResultats();
  if (equipeChoisie) $("resultats").scrollIntoView({ behavior: "smooth", block: "start" });
});

// ---- 12. Fiche d'un joueur ------------------------------------
function caseJoueur(j, idChoisi, etiquette) {
  if (!j) return `<div class="coequipier"><small>${etiquette || ""}</small><span>—</span></div>`;
  return `<button class="coequipier ${j.id === idChoisi ? "lui" : ""}" data-fiche="${j.id}">
    <small>${etiquette || j.pos} · #${j.no ?? "–"}</small><span>${echapper(j.nom)}</span></button>`;
}
function htmlEquipe(j) {
  const effectif = D.joueurs.filter((x) => x.eq === j.eq);
  const f = FORMATIONS[j.eq];
  let h = `<div class="formation">`;
  if (f) {
    const places = new Set();
    const trouve = (s) => { const x = joueurDansEquipe(s, j.eq); if (x) places.add(x.id); return x; };
    f.trios.forEach((t, i) => { h += `<div class="rangee"><span class="etiquette">${i + 1}${i ? "e" : "er"} trio</span>${t.map((s) => caseJoueur(trouve(s), j.id)).join("")}</div>`; });
    f.paires.forEach((p, i) => { h += `<div class="rangee deux"><span class="etiquette">${i + 1}${i ? "e" : "re"} paire</span>${p.map((s) => caseJoueur(trouve(s), j.id)).join("")}</div>`; });
    h += `<div class="rangee deux"><span class="etiquette">Gardiens</span>${f.gardiens.map((s) => caseJoueur(trouve(s), j.id)).join("")}</div>`;
    const autres = effectif.filter((x) => !places.has(x.id));
    if (autres.length) h += `<div class="rangee libre"><span class="etiquette">Autres</span><div class="groupe">${autres.map((x) => caseJoueur(x, j.id)).join("")}</div></div>`;
  } else {
    for (const [pos, nom] of [["C", "Centres"], ["AG", "Ailiers gauches"], ["AD", "Ailiers droits"], ["AV", "Attaquants"], ["D", "Défenseurs"], ["G", "Gardiens"]]) {
      const groupe = effectif.filter((x) => x.pos === pos);
      if (groupe.length) h += `<div class="rangee libre"><span class="etiquette">${nom}</span><div class="groupe">${groupe.map((x) => caseJoueur(x, j.id)).join("")}</div></div>`;
    }
  }
  return h + `</div>${f?.note ? `<p class="petit-gris">${f.note}. Les trios changent souvent.</p>` : `<p class="petit-gris">Effectif actuel, par position.</p>`}`;
}
async function htmlSaison(j) {
  const pts = await points(j.eq);
  let h = `<div class="saison">`, mois = -1;
  for (const m of matchsDe(j.eq)) {
    const d = versDate(m.date);
    if (d.getMonth() !== mois) { mois = d.getMonth(); h += `<div class="mois">${MOIS[mois]} ${d.getFullYear()}</div>`; }
    let res = `<span class="res">${heureDe(m)}</span>`;
    if (estFini(m) || estDirect(m)) {
      const r = resultatPour(m, j.eq), p = (pts[m.id] || {})[j.id];
      res = `<span class="res ${r.classe}">${estDirect(m) ? '<span class="badge-direct">DIRECT</span> ' : ""}${r.texte}${p ? ` · ${p[0]} B, ${p[1]} A` : ""}</span>`;
    }
    const dom = m.dom === j.eq;
    h += `<div class="ligne-match ${estFini(m) ? "passe" : ""}"><span>${dateLongue(m.date)}</span>
      <span class="lieu ${dom ? "" : "ext"}">${dom ? "DOM" : "ÉTR"}</span><span>${echapper(nomEq(adversaire(m, j.eq)))}${m.series ? " · Séries" : ""}</span>${res}</div>`;
  }
  return h + `</div>`;
}
async function ouvrirFiche(id) {
  const j = joueur(id);
  if (!j) return;
  const estFav = favoris.includes(j.id);
  let corps = "";
  if (j.s || j.g) {
    corps += `<h3>Saison 2026-27</h3>${htmlStats(j)}`;
    if (j.s) corps += `<p class="petit-gris" style="text-align:center">Différentiel : ${j.s.pm > 0 ? "+" : ""}${j.s.pm}</p>`;
  }
  if (D.equipes[j.eq]) {
    corps += `<h3>Son équipe : ${echapper(nomEq(j.eq))}</h3>${htmlEquipe(j)}`;
    corps += `<h3>Calendrier de sa saison</h3><div id="fiche-saison"><p class="vide">Chargement…</p></div>`;
  } else {
    corps += `<p class="note-fiche">${echapper(j.note || "Informations à venir.")}</p>`;
  }
  $("fiche").innerHTML = `
    <div class="fiche-haut">${pastille(j)}
      <div><h2>${echapper(j.nom)}</h2><p>${etiquetteLigue(j)} ${NOMS_POS[j.pos] || j.pos} · ${echapper(nomEq(j.eq))}</p>
        <p style="margin-top:10px">${estFav ? `<button class="btn leger" data-retirer="${j.id}" data-garder>Retirer de mes favoris</button>`
          : `<button class="btn accent" data-ajouter="${j.id}" data-garder>+ Ajouter à mes favoris</button>`}</p></div>
      <button class="fermer" aria-label="Fermer">✕</button>
    </div>
    <div class="fiche-corps">${corps}</div>`;
  $("fiche-fond").hidden = false;
  $("fiche-fond").scrollTop = 0;
  if (D.equipes[j.eq]) $("fiche-saison").innerHTML = await htmlSaison(j);
}
function fermerFiche() { $("fiche-fond").hidden = true; }
$("fiche-fond").addEventListener("click", (e) => { if (e.target.id === "fiche-fond" || e.target.closest(".fermer")) fermerFiche(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerFiche(); });

// ---- 13. Un seul « écouteur » pour tous les boutons ------------
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-fiche],[data-ajouter],[data-retirer],[data-jour]");
  if (!b) return;
  if (b.dataset.ajouter) { ajouter(b.dataset.ajouter); if (b.hasAttribute("data-garder")) ouvrirFiche(b.dataset.ajouter); }
  else if (b.dataset.retirer) { retirer(b.dataset.retirer); if (b.hasAttribute("data-garder")) ouvrirFiche(b.dataset.retirer); }
  else if (b.dataset.fiche) ouvrirFiche(b.dataset.fiche);
  else if (b.dataset.jour) { jourChoisi = b.dataset.jour; rendreCalendrier(); }
});

// ---- 14. Thème clair / sombre ---------------------------------
$("theme").onclick = () => {
  const el = document.documentElement;
  const sombre = el.dataset.theme ? el.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  el.dataset.theme = sombre ? "light" : "dark";
  memoire("theme", el.dataset.theme);
};

// ---- 15. Indicateur de fraîcheur ------------------------------
function rendreMiseAJour() {
  const quand = D.misAJour[ligue];
  let txt = "";
  if (D.direct && matchsLigue(ligue).some(estDirect)) txt = "Scores en direct";
  else if (quand) {
    const min = Math.round((Date.now() - quand) / 60000);
    txt = min < 1 ? "Mis à jour à l'instant" : min < 60 ? `Mis à jour il y a ${min} min`
      : min < 1440 ? `Mis à jour il y a ${Math.round(min / 60)} h` : `Mis à jour le ${quand.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`;
  }
  $("maj-badge").textContent = txt;
  $("maj-badge").classList.toggle("auto", !!txt);
  $("maj").textContent = `Stats fournies automatiquement à partir des données publiques des ligues (${LIGUES[ligue].nom} : ${txt || "à venir"}).`;
}

// ---- 16. Le direct à la seconde -------------------------------
// LNH : par le relais (config.js). Autres ligues : directement auprès
// du fournisseur de stats, s'il accepte la demande.
const SOURCES_LNH = [RELAIS, "https://api-web.nhle.com"].filter(Boolean);
const CLES_HT = { ahl: "50c2cd9b5e18e390", lhjmq: "f1aa699db3d81487", ohl: "f1aa699db3d81487", whl: "f1aa699db3d81487" };
let sourceLnh = null, htBloque = {};
const PERIODES = { 1: "1re", 2: "2e", 3: "3e" };
function enCours(lig) {
  const maintenant = Date.now();
  return D.cal.filter((m) => ligueDe(m.dom) === lig && m.date >= decaler(AUJ, -1) && m.date <= AUJ && !estFini(m) && m.debut && new Date(m.debut).getTime() - 5 * 60000 <= maintenant);
}
async function lireLnh(chemin) {
  for (const base of sourceLnh ? [sourceLnh] : SOURCES_LNH) {
    try { const r = await fetch(base + chemin, { cache: "no-store" }); if (r.ok) { sourceLnh = base; return await r.json(); } } catch (e) {}
  }
  return null;
}
async function directLnh(eqs) {
  const donnees = await lireLnh("/v1/score/now");
  if (!donnees) return false;
  let change = false;
  for (const g of donnees.games || []) {
    const m = D.cal.find((x) => x.id === g.id);
    if (!m) continue;
    const etat = g.gameState === "LIVE" || g.gameState === "CRIT" ? "direct" : g.gameState === "FINAL" || g.gameState === "OFF" ? "fini" : m.etat;
    if (etat !== m.etat || g.homeTeam?.score !== m.sd || g.awayTeam?.score !== m.se) change = true;
    m.etat = etat;
    if (etat !== "avenir") { m.sd = g.homeTeam?.score ?? 0; m.se = g.awayTeam?.score ?? 0; }
    const per = g.periodDescriptor;
    if (etat === "direct" && per) {
      const nomP = per.periodType === "OT" ? "Prol." : per.periodType === "SO" ? "Tirs" : `${PERIODES[per.number] || per.number + "e"}`;
      m.periode = g.clock?.inIntermission ? `Entracte ${nomP}` : `${nomP} · ${g.clock?.timeRemaining || ""}`;
    }
    if (etat === "fini" && per && per.periodType !== "REG") m.fin = per.periodType;
    if (etat === "direct" && (eqs.includes(m.dom) || eqs.includes(m.ext))) {
      const box = await lireLnh(`/v1/gamecenter/${m.id}/boxscore`);
      for (const [cote, eq] of [["homeTeam", m.dom], ["awayTeam", m.ext]]) {
        const e = box?.playerByGameStats?.[cote];
        if (!e) continue;
        const ligne = {};
        for (const p of [...(e.forwards || []), ...(e.defense || [])]) if (p.goals || p.assists) ligne[String(p.playerId)] = [p.goals || 0, p.assists || 0];
        (await points(eq))[m.id] = ligne;
        change = true;
      }
    }
  }
  return change;
}
async function directAutre(lig) {
  if (htBloque[lig]) return false;
  let donnees;
  try {
    const url = "https://lscluster.hockeytech.com/feed/?" + new URLSearchParams({ feed: "modulekit", view: "scorebar", key: CLES_HT[lig], client_code: lig, numberofdaysahead: 0, numberofdaysback: 1, fmt: "json", lang: "fr" });
    donnees = JSON.parse((await (await fetch(url, { cache: "no-store" })).text()).trim().replace(/^\(|\)$/g, ""));
  } catch (e) { htBloque[lig] = true; return false; }
  let change = false;
  for (const g of donnees?.SiteKit?.Scorebar || []) {
    const m = D.cal.find((x) => x.id === `${lig}-${g.ID}`);
    if (!m) continue;
    const fini = /final/i.test(g.GameStatusString || ""), commence = Number(g.Period) > 0 || fini;
    const etat = fini ? "fini" : commence ? "direct" : m.etat;
    const sd = Number(g.HomeGoals) || 0, se = Number(g.VisitorGoals) || 0;
    if (etat !== m.etat || sd !== m.sd || se !== m.se) change = true;
    m.etat = etat;
    if (etat !== "avenir") { m.sd = sd; m.se = se; }
    if (etat === "direct") m.periode = Number(g.Intermission) ? `Entracte ${g.PeriodNameShort || ""}` : `${g.PeriodNameShort || ""} · ${g.GameClock || ""}`;
    if (fini && /OT|SO/.test(g.GameStatusStringLong || "")) m.fin = /SO/.test(g.GameStatusStringLong) ? "SO" : "OT";
  }
  return change;
}
async function tourDirect() {
  const eqs = equipesFavorites();
  const actives = Object.keys(LIGUES).filter((l) => D.charge[l] && enCours(l).length);
  if (!actives.length) { D.direct = false; return; }
  let change = false;
  for (const lig of actives) change = (lig === "lnh" ? await directLnh(eqs) : await directAutre(lig)) || change;
  D.direct = D.cal.some(estDirect);
  if (change) { rendreBandeau(); rendrePageScores(); rendreSoir(); rendreFavoris(); rendreCalendrier(); }
  rendreMiseAJour();
}

// ---- 17. Les pages (onglets, glisser sur téléphone) -----------
const PAGES = ["accueil", "scores", "favoris", "classement", "meneurs", "joueurs"];
let pageActuelle = null;
function allerA(page) {
  if (!PAGES.includes(page)) page = "accueil";
  const avant = PAGES.indexOf(pageActuelle), apres = PAGES.indexOf(page);
  document.querySelectorAll(".page").forEach((p) => {
    const active = p.dataset.page === page;
    p.hidden = !active;
    p.classList.remove("vers-gauche", "vers-droite");
    if (active && avant >= 0 && avant !== apres) { void p.offsetWidth; p.classList.add(apres > avant ? "vers-gauche" : "vers-droite"); }
  });
  document.querySelectorAll("[data-lien]").forEach((a) => a.classList.toggle("actif", a.dataset.lien === page));
  // Le choix de ligue ne concerne pas la page « Mes favoris »
  document.body.classList.toggle("page-favoris", page === "favoris");
  if (pageActuelle !== null && pageActuelle !== page) window.scrollTo({ top: 0 });
  pageActuelle = page;
  fermerFiche();
}
const pageDeLAdresse = () => (location.hash.match(/^#\/(\w+)/) || [])[1] || "accueil";
window.addEventListener("hashchange", () => allerA(pageDeLAdresse()));
let toucheDepart = null;
$("pages").addEventListener("touchstart", (e) => {
  const zone = e.target.closest(".defile, .bandeau-matchs, .jours, input");
  toucheDepart = zone ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
$("pages").addEventListener("touchend", (e) => {
  if (!toucheDepart) return;
  const dx = e.changedTouches[0].clientX - toucheDepart.x, dy = e.changedTouches[0].clientY - toucheDepart.y;
  toucheDepart = null;
  if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  const i = PAGES.indexOf(pageActuelle) + (dx < 0 ? 1 : -1);
  if (i >= 0 && i < PAGES.length) location.hash = "#/" + PAGES[i];
}, { passive: true });

// ---- 18. Démarrage --------------------------------------------
function rafraichir() {
  rendreChoixLigue();
  rendreBandeau(); rendrePageScores(); rendreSoir(); rendreFavoris(); rendreCalendrier();
  rendreClassement(); rendreMeneurs(); rendreResultats(); rendreEquipes();
}
async function demarrer() {
  allerA(pageDeLAdresse());
  rendreChoixLigue();
  favoris = lireFavoris();
  // On charge la LNH, la ligue choisie et les ligues des favoris
  const aCharger = [...new Set(["lnh", ligue, ...liguesDesFavoris(favoris)])];
  const res = await Promise.allSettled(aCharger.map(charger));
  if (res[0].status === "rejected" && !D.charge[ligue]) {
    montrerErreur("Les données n'ont pas pu être chargées pour l'instant. Réessaie dans quelques minutes.");
    return;
  }
  if (!D.charge[ligue]) ligue = "lnh";
  nettoyerFavoris();
  rafraichir();
  rendreMiseAJour();
  rendreUne();
  setInterval(tourDirect, SECONDES_DIRECT * 1000);
  tourDirect();
  setInterval(() => {
    const nouveauJour = versTexte(new Date());
    if (nouveauJour !== AUJ) { AUJ = nouveauJour; rafraichir(); rendreUne(); }
    rendreMiseAJour();
  }, 60000);
}
demarrer();
