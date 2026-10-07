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
const jourFr = (d) => (d.getDate() === 1 ? "1er" : d.getDate());
function dateLongue(t) { const d = versDate(t); return `${JOURS[d.getDay()]} ${jourFr(d)} ${MOIS[d.getMonth()]}`; }
function decaler(t, n) { const d = versDate(t); d.setDate(d.getDate() + n); return versTexte(d); }
function simplifier(t) { return String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
function slug(t) { return simplifier(t).replace(/[^a-z]+/g, "-").replace(/^-|-$/g, ""); }
function echapper(t) { return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
function pluriel(n, mot) { return `${n} ${mot}${n > 1 ? "s" : ""}`; }
function heureDe(m, avecJour = true) {
  // « 9 h 45 » (sans zéro devant), avec des espaces insécables pour ne pas couper l'heure
  // et « 19 h » plutôt que « 19 h 00 ». L'heure est celle de l'appareil du visiteur.
  if (!m.debut) return "";
  const h = new Date(m.debut).toLocaleTimeString("fr-CA", { hour: "numeric", minute: "2-digit" }).replace(/\s/g, "\u00a0").replace(/\u00a0h\u00a000$/, "\u00a0h");
  // Ailleurs dans le monde (ex. en France), un match du jeudi soir au Québec tombe le vendredi :
  // on l'indique, « 1 h (ven.) », pour ne pas se tromper de journée
  const jl = dateLocale(m);
  return avecJour && jl !== m.date ? `${h}\u00a0(${JOURS[versDate(jl).getDay()]})` : h;
}
// La date du match là où se trouve le visiteur (peut différer de la date officielle de la ligue)
function dateLocale(m) { return m.debut ? versTexte(new Date(m.debut)) : m.date; }
// « la LNH », mais « l'OHL » ; virgule décimale (3,00) ; séquences en français (V3, D2, DP1)
const laLigue = (l) => (/^[AEIOUH]/.test(LIGUES[l]?.nom || "") && LIGUES[l]?.nom !== "LHJMQ" ? "l'" : "la ") + (LIGUES[l]?.nom || "ligue");
const dec = (x, n = 2) => (x == null || isNaN(x) ? "–" : Number(x).toFixed(n).replace(".", ","));
const serieFr = (s) => (s ? String(s).replace(/^OT/, "DP").replace(/^W/, "V").replace(/^L/, "D") : "–");
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
  khl:   { nom: "KHL",   long: "Russie", sansPlusMoins: true },
  liiga: { nom: "Liiga", long: "Finlande", pointsSeulement: true },
  shl:   { nom: "SHL",   long: "Suède" },
  nl:    { nom: "NL",    long: "Suisse · National League" },
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
  D.records = j.records || null;
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
  return `<span class="heure">${heureDe(m)}</span>`; // (en minuscules : « 19 h », pas « 19 H »)
}
// Bilan d'une équipe à partir de ses matchs terminés : [victoires, défaites, défaites en prolongation]
function issuePour(m, eq) { const { nous, eux } = scorePour(m, eq); return nous > eux ? 0 : m.fin ? 2 : 1; }
function bilan(eq) {
  const finis = matchsDe(eq).filter(estFini);
  const r = { tous: [0, 0, 0], dom: [0, 0, 0], ext: [0, 0, 0], dix: [0, 0, 0], forme: [] };
  for (const m of finis) { const i = issuePour(m, eq); r.tous[i]++; r[m.dom === eq ? "dom" : "ext"][i]++; }
  for (const m of finis.slice(-10)) { const i = issuePour(m, eq); r.dix[i]++; r.forme.push({ m, i }); }
  return r;
}
const fmtBilan = (b) => `${b[0]}-${b[1]}-${b[2]}`;
// Ligue d'un identifiant de joueur, d'équipe ou de match (ex. « ahl-123 », « ahl_LAV » ; sinon LNH)
const ligDeId = (id) => { const x = /^([a-z]+)[-_]/.exec(String(id)); return x && LIGUES[x[1]] ? x[1] : "lnh"; };
const matchParId = (id) => D.cal.find((m) => String(m.id) === String(id));
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
const GROUPES_LIGUES = [["Pro", ["lnh", "ahl"]], ["Junior", ["lhjmq", "ohl", "whl"]], ["Europe", ["khl", "shl", "liiga", "nl"]]];
function rendreChoixLigue() {
  $("choix-ligue").innerHTML = GROUPES_LIGUES.map(([g, ls]) => `<div class="groupe-ligues"><span class="groupe-nom">${g}</span>${ls.map((k) =>
    `<button class="puce-ligue ${k === ligue ? "actif" : ""}" data-ligue="${k}" role="tab" aria-selected="${k === ligue}" title="${LIGUES[k].long}">${LIGUES[k].nom}</button>`).join("")}</div>`).join("");
  // La ligue choisie reste visible dans la barre (ex. KHL, cachée à droite sur téléphone)
  const boite = $("choix-ligue"), a = boite.querySelector(".actif");
  if (a && boite.scrollWidth > boite.clientWidth) {
    const r = a.getBoundingClientRect(), rb = boite.getBoundingClientRect();
    if (r.left < rb.left || r.right > rb.right) boite.scrollLeft += r.left - rb.left - (rb.width - r.width) / 2;
  }
  $("ligue-long").textContent = LIGUES[ligue].long;
  document.querySelectorAll("[data-nom-ligue]").forEach((x) => (x.textContent = LIGUES[ligue].nom));
}
async function choisirLigue(k) {
  if (!LIGUES[k] || k === ligue) return;
  ligue = k; memoire("ligue", k);
  rendreChoixLigue();
  document.body.classList.add("chargement");
  try { await charger(k); } catch (e) { montrerErreur(`Les données de ${laLigue(k)} n'ont pas pu être chargées pour l'instant.`); }
  document.body.classList.remove("chargement");
  equipeChoisie = null;
  rafraichir(); rendreUne(); rendreRecits(); rendreMiseAJour();
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
  if (!liste.length) { $("bandeau-matchs").innerHTML = `<span class="bandeau-vide">Aucun match dans ${laLigue(ligue)} ce jour-là.</span>`; return; }
  $("bandeau-matchs").innerHTML = liste.map((m) => {
    const joue = estFini(m) || estDirect(m);
    return `<button class="score-carte ${fav.includes(m.dom) || fav.includes(m.ext) ? "favori" : ""}" data-match="${m.id}" title="Voir le sommaire du match">
      <span class="statut ${estDirect(m) ? "direct" : ""}">${estDirect(m) ? "● " : ""}${statutMatch(m)}</span>
      <span class="eq ${estFini(m) && m.se < m.sd ? "perd" : ""}"><span>${abr(m.ext)}</span><span>${joue ? m.se : ""}</span></span>
      <span class="eq ${estFini(m) && m.sd < m.se ? "perd" : ""}"><span>${abr(m.dom)}</span><span>${joue ? m.sd : ""}</span></span>
    </button>`;
  }).join("");
}
let scoresTout = memoire("scores-tout") === "1";
async function carteScore(m, favs, eqs) {
  const joue = estFini(m) || estDirect(m);
  const pts = joue ? { ...(await points(m.dom))[m.id], ...(await points(m.ext))[m.id] } : {};
  const lesMiens = favs.filter((j) => j.eq === m.dom || j.eq === m.ext);
  const etoiles = Object.entries(pts).filter(([, l]) => ptsLigne(l) > 0).map(([id, [b, a]]) => ({ j: D.parId.get(id), b, a }))
    .filter((x) => x.j).sort((x, y) => (y.b + y.a) - (x.b + x.a) || y.b - x.b).slice(0, 3);
  const ligne = (eq, score, gagne) => `<div class="gs-eq ${estFini(m) && !gagne ? "perd" : ""}">
    <span class="gs-abr">${abr(eq)}</span><span class="gs-nom">${echapper(nomEq(eq))}</span><span class="gs-score">${joue ? score : ""}</span></div>`;
  const avant = !joue ? `<div class="gs-avant">Fiches : ${abr(m.ext)} ${fmtBilan(bilan(m.ext).tous)} · ${abr(m.dom)} ${fmtBilan(bilan(m.dom).tous)}</div>` : "";
  return `<article class="gs-carte ${eqs.includes(m.dom) || eqs.includes(m.ext) ? "favori" : ""}" data-match="${m.id}" tabindex="0" role="button" aria-label="Sommaire : ${echapper(nomEq(m.ext))} contre ${echapper(nomEq(m.dom))}">
    <div class="gs-statut">${estDirect(m) ? `<span class="badge-direct">EN DIRECT</span> ${m.periode || ""}` : statutMatch(m)}${m.series ? " · Séries" : ""}<span class="gs-lien">${joue ? "Sommaire ›" : "Avant-match ›"}</span></div>
    ${ligne(m.ext, m.se, m.se > m.sd)}${ligne(m.dom, m.sd, m.sd > m.se)}${avant}
    ${etoiles.length ? `<div class="gs-etoiles">${etoiles.map((x) => `<button class="puce-joueur" data-fiche="${x.j.id}">${echapper(nomDeFamille(x.j))} (${abr(x.j.eq)}) ${x.b} B, ${x.a} A</button>`).join("")}</div>` : ""}
    ${lesMiens.length ? `<div class="gs-favoris">⭐ ${lesMiens.map((j) => echapper(nomDeFamille(j))).join(", ")}</div>` : ""}
  </article>`;
}
let jetonScores = 0;
async function rendrePageScores() {
  const jeton = ++jetonScores;
  $("page-score-jour").textContent = jourScores === AUJ ? "Aujourd'hui" : dateLongue(jourScores);
  $("scores-tout").checked = scoresTout;
  document.querySelector('[data-page="scores"] h2 .tag-ligue').hidden = scoresTout;
  const favs = favorisObjets(), eqs = equipesFavorites();
  let h = "";
  if (scoresTout) {
    await chargerTout();
    for (const [, ls] of GROUPES_LIGUES) for (const l of ls) {
      const liste = matchsLigue(l).filter((m) => m.date === jourScores);
      if (!liste.length) continue;
      h += `<h3 class="groupe-titre gs-groupe">${LIGUES[l].nom} <small>${LIGUES[l].long} · ${pluriel(liste.length, "match")}</small></h3><div class="grille-scores">`;
      for (const m of liste) h += await carteScore(m, favs, eqs);
      h += "</div>";
    }
    if (!h) h = `<p class="vide">Aucun match dans aucune ligue ce jour-là. Essaie les flèches pour changer de journée.</p>`;
  } else {
    const liste = matchsLigue(ligue).filter((m) => m.date === jourScores);
    if (!liste.length) h = `<p class="vide">Aucun match dans ${laLigue(ligue)} ce jour-là. Essaie les flèches pour changer de journée, ou coche « Toutes les ligues ».</p>`;
    else { h = `<div class="grille-scores">`; for (const m of liste) h += await carteScore(m, favs, eqs); h += "</div>"; }
  }
  if (jeton === jetonScores) $("grille-scores").innerHTML = h;
}
$("scores-tout").addEventListener("change", (e) => { scoresTout = e.target.checked; memoire("scores-tout", scoresTout ? "1" : "0"); rendrePageScores(); });
function changerJourScores(n) { jourScores = decaler(jourScores, n); rendreBandeau(); rendrePageScores(); }
$("score-prec").onclick = () => changerJourScores(-1);
$("score-suiv").onclick = () => changerJourScores(1);
$("page-score-prec").onclick = () => changerJourScores(-1);
$("page-score-suiv").onclick = () => changerJourScores(1);

// ---- 6. Performances (résumés générés à partir des stats) ----
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
        if (j && j.eq === eq && ptsLigne(ligne[pid]) > 0) perfs.push({ j, m, b: ligne[pid][0], a: ligne[pid][1] });
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
    $("soir").innerHTML = `<p class="vide">Pas de match ce soir pour tes favoris. Repose-toi! 😄${p ? `<br>Prochain rendez-vous : <button class="lien-match" data-match="${p.id}"><strong>${dateLongue(dateLocale(p))}</strong>, ${echapper(courtEq(p.ext))} @ ${echapper(courtEq(p.dom))} à ${heureDe(p, false)} ›</button>` : ""}</p>`;
    return;
  }
  let h = "";
  for (const m of ceSoir) {
    const lesMiens = favs.filter((j) => j.eq === m.dom || j.eq === m.ext);
    const pts = { ...(await points(m.dom))[m.id], ...(await points(m.ext))[m.id] };
    const statut = estDirect(m) ? `<span class="badge-direct">EN DIRECT</span> <strong>${m.se}-${m.sd}</strong>`
      : estFini(m) ? `<strong>Final ${m.se}-${m.sd}${suffixeFin(m)}</strong>` : `<strong>${heureDe(m)}</strong>`;
    h += `<div class="soir-match cliquable" data-match="${m.id}" role="button" tabindex="0" aria-label="Voir le match">
      <div class="soir-tete"><strong><span class="tag-ligue petit">${LIGUES[ligueDe(m.dom)].nom}</span> ${echapper(courtEq(m.ext))} @ ${echapper(courtEq(m.dom))}</strong><span>${statut}</span></div>
      <div class="soir-joueurs">${lesMiens.map((j) => {
        const p = pts[j.id];
        const txt = estGardienLigne(p) ? `🧤 ${nomDeFamille(j)} : ${p[1]} arrêts sur ${p[2]}` : ptsLigne(p) > 0 ? `🔥 ${nomDeFamille(j)} : ${p[0]} B, ${p[1]} A` : nomDeFamille(j);
        return `<button class="puce-joueur ${ptsLigne(p) > 0 || estGardienLigne(p) ? "chaud" : ""}" data-fiche="${j.id}">${echapper(txt)}</button>`;
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
function htmlStats(j, sansDetails = false) {
  if (j.g) {
    const g = j.g;
    return `<div class="stats">
      <div><b>${g.pj}</b><small>PJ</small></div><div><b>${g.v}-${g.d}-${g.dp}</b><small>Fiche</small></div>
      <div><b>${dec(g.moy)}</b><small>Moy.</small></div>
      <div><b>${g.pct != null ? g.pct.toFixed(3).replace(/^0/, "") : "–"}</b><small>% arr.</small></div></div>
      ${!sansDetails && g.pj && (g.arr != null || g.bl != null) ? `<div class="stats secondaires">${g.arr != null ? `<div><b>${g.arr}</b><small>Arrêts</small></div><div><b>${g.tr}</b><small>Tirs reçus</small></div>` : ""}<div><b>${g.bl ?? 0}</b><small>BL</small></div>${g.dq != null ? `<div><b>${g.dq}</b><small>Départs de qualité</small></div>` : ""}</div>` : ""}`;
  }
  if (j.s) {
    const s = j.s;
    // 2e rangée : le différentiel, les tirs, le temps de glace et les punitions (quand la ligue les donne)
    const x = [[signe(s.pm ?? 0), "+/-"], s.tirs != null && [s.tirs, "Tirs"], s.tg ? [`${Math.floor(s.tg / 60)}:${String(s.tg % 60).padStart(2, "0")}`, "TG moy."] : s.pav != null && [s.pav, "PTS AN"], s.pun != null && [s.pun, "PUN"]].filter(Boolean);
    return `<div class="stats"><div><b>${s.pj}</b><small>PJ</small></div><div><b>${s.b}</b><small>B</small></div>
      <div><b>${s.a}</b><small>A</small></div><div><b>${s.pts}</b><small>PTS</small></div></div>
      ${s.pj && !sansDetails ? `<div class="stats secondaires">${x.map(([v, l]) => `<div><b>${v}</b><small>${l}</small></div>`).join("")}</div>` : ""}`;
  }
  return `<div class="prochain">Stats à venir.</div>`;
}
function htmlProchain(j) {
  if (!D.equipes[j.eq]) return "Suivi de cette ligue : bientôt!";
  const direct = D.cal.find((m) => estDirect(m) && (m.dom === j.eq || m.ext === j.eq));
  if (direct) { const r = resultatPour(direct, j.eq); return `<button class="lien-match" data-match="${direct.id}"><span class="badge-direct">EN DIRECT</span> <strong>${r.texte}</strong> contre ${abr(adversaire(direct, j.eq))} ›</button>`; }
  const p = prochainMatch(j.eq);
  if (!p) return "Saison terminée";
  return `<button class="lien-match" data-match="${p.id}">Prochain : <strong>${dateLocale(p) === AUJ ? "ce soir" : dateLongue(dateLocale(p))}</strong> ${p.dom === j.eq ? "vs" : "@"} ${abr(adversaire(p, j.eq))} · ${heureDe(p, false)} ›</button>`;
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
    return `<div class="soir-match cliquable" data-match="${m.id}" role="button" tabindex="0"><div class="soir-tete"><strong><span class="tag-ligue petit">${LIGUES[ligueDe(m.dom)].nom}</span> ${echapper(courtEq(m.ext))} @ ${echapper(courtEq(m.dom))}</strong>
      <span>${estDirect(m) ? '<span class="badge-direct">EN DIRECT</span> ' : ""}<strong>${estFini(m) || estDirect(m) ? `${m.se}-${m.sd}` : heureDe(m)}</strong></span></div>
      <p class="petit-gris" style="margin-top:6px">Tes favoris : ${echapper(qui)} <span class="voir-match">${estFini(m) ? "Sommaire" : "Avant-match"} ›</span></p></div>`;
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
    <thead><tr><th>#</th><th>Équipe</th><th>PJ</th><th>V</th><th>D</th><th>DP</th><th>PTS</th><th class="large">BP</th><th class="large">BC</th><th>Diff</th><th class="large">10 dern.</th><th class="large">Dom.</th><th class="large">Ext.</th><th class="large">Série</th></tr></thead><tbody>
    ${trierEquipes(liste).map((t, i) => { const b = bilan(t.eq), diff = t.bp - t.bc; return `<tr class="${eqs.includes(t.eq) ? "favori" : ""}"><td>${i + 1}</td>
      <td class="eq"><button class="lien-equipe" data-equipe-fiche="${t.eq}"><span class="abr">${abr(t.eq)}</span> ${simplifier(courtEq(t.eq)).trim() !== simplifier(abr(t.eq)) ? `<span class="nom-long">${echapper(courtEq(t.eq))}</span>` : ""}</button></td>
      <td>${t.pj}</td><td>${t.v}</td><td>${t.d}</td><td>${t.dp}</td><td class="pts">${t.pts}</td>
      <td class="large">${t.bp}</td><td class="large">${t.bc}</td><td class="${diff > 0 ? "plus" : diff < 0 ? "moins" : ""}">${diff > 0 ? "+" : ""}${diff}</td>
      <td class="large">${fmtBilan(b.dix)}</td><td class="large">${fmtBilan(b.dom)}</td><td class="large">${fmtBilan(b.ext)}</td><td class="large">${serieFr(t.serie)}</td></tr>`; }).join("")}
  </tbody></table></div></div>`;
}
const groupes = (liste, cle) => [...new Set(liste.map((t) => t[cle]).filter(Boolean))];
function rendreClassement() {
  const c = D.classement[ligue] || [];
  $("vue-series").hidden = ligue !== "lnh";
  if (vueClassement === "series" && ligue !== "lnh") { vueClassement = "conf"; document.querySelectorAll("[data-vue]").forEach((x) => x.classList.toggle("actif", x.dataset.vue === "conf")); }
  if (vueClassement === "series") { $("tables-classement").classList.add("une-col"); return rendreSeries(); }
  if (vueClassement === "stats") { $("tables-classement").classList.add("une-col"); return rendreStatsEquipes(); }
  if (!c.length) { $("tables-classement").innerHTML = `<p class="vide">Classement à venir.</p>`; return; }
  let h = "";
  if (vueClassement === "ligue") h = tableClassement(`Toute ${laLigue(ligue)}`, c);
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
  if (LIGUES[ligue].sansJoueurs) {
    const msg = `<li class="vide">Les stats des joueurs de ${laLigue(ligue)} arrivent bientôt.</li>`;
    $("mini-meneurs").innerHTML = msg;
    $("grille-meneurs").innerHTML = `<section class="bloc"><div class="titre-section"><h2>Meneurs <span class="tag-ligue">${LIGUES[ligue].nom}</span></h2></div><p class="vide">Les stats des joueurs de la ${LIGUES[ligue].nom} ne sont pas encore offertes : pour l'instant, on suit le calendrier, les scores et le classement.</p></section>`;
    return;
  }
  $("mini-meneurs").innerHTML = htmlMeneurs(listeMeneurs(5, patineur, (j) => j.s.pts), (j) => j.s.pts);
  const maxPj = Math.max(1, ...(D.classement[ligue] || []).map((t) => t.pj));
  const gardien = (j) => j.g && j.g.pj >= Math.max(Math.min(2, maxPj), Math.ceil(maxPj / 3));
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
function ligneJoueur(j) {
  return `<li>${pastille(j)}
    <div class="infos" data-fiche="${j.id}"><strong>${echapper(j.nom)}</strong><span>${etiquetteLigue(j)} ${NOMS_POS[j.pos] || j.pos} · ${echapper(courtEq(j.eq))}</span></div>
    ${favoris.includes(j.id) ? `<button class="btn leger" disabled aria-label="Déjà dans tes favoris">⭐</button>` : `<button class="btn accent" data-ajouter="${j.id}" aria-label="Ajouter ${echapper(j.nom)} à mes favoris">+</button>`}
  </li>`;
}
// Fenêtre de recherche : ouverte par le bouton 🔍 (ou la touche « / »)
function ouvrirRecherche() {
  fermerFiche();
  $("recherche-fond").hidden = false;
  $("recherche").focus();
  rendreRecherche();
  chargerTout().then(() => { nettoyerFavoris(); rendreRecherche(); });
}
function fermerRecherche() { $("recherche-fond").hidden = true; }
function rendreRecherche() {
  const q = simplifier($("recherche").value.trim());
  const boite = $("resultats-globaux");
  if (q.length < 2) { boite.innerHTML = `<p class="vide">Commence à taper au moins 2 lettres.</p>`; return; }
  const trouves = [...D.joueurs, ...AUTRES_JOUEURS].filter((j) =>
    simplifier(j.nom).includes(q) || simplifier(nomEq(j.eq)).includes(q) || simplifier(abr(j.eq)) === q);
  const equipesTrouvees = Object.keys(D.equipes).filter((eq) => simplifier(nomEq(eq)).includes(q) || simplifier(abr(eq)) === q).slice(0, 8);
  const htmlEquipes = equipesTrouvees.length ? `<h3 class="groupe-titre">Équipes</h3><div class="equipes-liste">${equipesTrouvees.map((eq) =>
    `<button class="btn-equipe" data-equipe-fiche="${eq}"><b>${abr(eq)}</b><span>${echapper(courtEq(eq))} <span class="tag-ligue petit">${LIGUES[ligueDe(eq)].nom}</span></span></button>`).join("")}</div>` : "";
  if (!trouves.length) { boite.innerHTML = htmlEquipes || `<p class="vide">Aucun joueur ni aucune équipe trouvé. Vérifie l'orthographe ou essaie seulement le nom de famille.</p>`; return; }
  // Résultats regroupés par ligue, la ligue choisie en premier
  const ordre = [ligue, ...Object.keys(LIGUES).filter((l) => l !== ligue), null];
  boite.innerHTML = htmlEquipes + ordre.map((l) => {
    const liste = trouves.filter((j) => (j.lig || null) === l).slice(0, 15);
    if (!liste.length) return "";
    return `<h3 class="groupe-titre">${l ? `${LIGUES[l].nom} <small>${LIGUES[l].long}</small>` : "Autres ligues"}</h3><ul class="resultats grand">${liste.map(ligneJoueur).join("")}</ul>`;
  }).join("");
}
$("recherche").addEventListener("input", rendreRecherche);
$("ouvrir-recherche").onclick = ouvrirRecherche;
$("fermer-recherche").onclick = fermerRecherche;
$("recherche-fond").addEventListener("click", (e) => { if (e.target.id === "recherche-fond") fermerRecherche(); });
document.addEventListener("click", (e) => { if (e.target.closest("[data-ouvrir-recherche]")) ouvrirRecherche(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); ouvrirRecherche(); }
  if (e.key === "Escape") fermerRecherche();
});

// Page Joueurs : on choisit une équipe, puis on voit tout son effectif
function rendreResultats() {
  $("bloc-effectif").hidden = !equipeChoisie;
  if (!equipeChoisie) return;
  $("titre-effectif").textContent = nomEq(equipeChoisie);
  $("fiche-equipe-choisie").dataset.equipeFiche = equipeChoisie;
  const liste = D.joueurs.filter((j) => j.eq === equipeChoisie).sort((a, b) => ORDRE_POS.indexOf(a.pos) - ORDRE_POS.indexOf(b.pos) || (a.no ?? 99) - (b.no ?? 99));
  $("resultats").innerHTML = liste.length ? liste.map(ligneJoueur).join("")
    : `<li class="vide">Les joueurs de ${laLigue(ligueDe(equipeChoisie))} arrivent bientôt : pour l'instant, on a seulement le calendrier, les scores et le classement.</li>`;
  if (!$("recherche-fond").hidden) rendreRecherche();
}
function rendreEquipes() {
  const liste = Object.keys(D.equipes).filter((e) => ligueDe(e) === ligue).sort((a, b) => courtEq(a).localeCompare(courtEq(b), "fr"));
  $("equipes").innerHTML = `<div class="equipes-liste">${liste.map((eq) =>
    `<button class="btn-equipe ${eq === equipeChoisie ? "actif" : ""}" data-equipe="${eq}" title="${echapper(nomEq(eq))}"><b>${abr(eq)}</b><span>${echapper(courtEq(eq))}</span></button>`).join("")}</div>`;
}
$("equipes").addEventListener("click", (e) => {
  const b = e.target.closest("[data-equipe]");
  if (!b) return;
  equipeChoisie = equipeChoisie === b.dataset.equipe ? null : b.dataset.equipe;
  rendreEquipes(); rendreResultats();
  if (equipeChoisie) $("bloc-effectif").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("fermer-effectif").onclick = () => { equipeChoisie = null; rendreEquipes(); rendreResultats(); $("equipes").scrollIntoView({ behavior: "smooth", block: "start" }); };

// Carte de bienvenue : seulement au premier passage
function rendreBienvenue() { $("bienvenue").hidden = memoire("bienvenue-vue") === "1"; }
$("fermer-bienvenue").onclick = () => { memoire("bienvenue-vue", "1"); rendreBienvenue(); };

// ---- 12. Fiche d'un joueur : stats match par match -------------
// Format d'une ligne de match (voir les robots) :
//   patineur [buts, passes, +/-, tirs, punitions, temps de glace]
//   gardien  ["G", arrêts, tirs reçus, buts accordés, décision, temps]
const estGardienLigne = (l) => Array.isArray(l) && l[0] === "G";
const ptsLigne = (l) => (!l || estGardienLigne(l) ? 0 : (l[0] || 0) + (l[1] || 0));
const signe = (n) => (n > 0 ? `+${n}` : `${n}`);
const DECISIONS = { W: "V", L: "D", O: "DP" };
function dateCourte(t) { const d = versDate(t); return `${jourFr(d)} ${MOIS_COURT[d.getMonth()]}`; }
async function htmlMatchParMatch(j) {
  const pts = await points(j.eq);
  const tous = matchsDe(j.eq);
  const joues = tous.filter((m) => (estFini(m) || estDirect(m)) && pts[m.id]?.[j.id]).reverse();
  const prochains = tous.filter((m) => !estFini(m) && !estDirect(m) && m.date >= AUJ).slice(0, 5);
  const gardien = j.pos === "G";
  let h = "";
  if (LIGUES[j.lig]?.pointsSeulement) h += `<p class="petit-gris">Pour ${laLigue(j.lig)}, on affiche seulement les matchs où ${echapper(nomDeFamille(j))} a fait des points (buts et passes).</p>`;
  if (!joues.length) h += `<p class="vide">${LIGUES[j.lig]?.pointsSeulement ? "Pas encore de point cette saison." : "Pas encore de match joué cette saison."}</p>`;
  else {
    const avecTemps = !gardien && joues.some((m) => pts[m.id][j.id][5]);
    const simple = !!LIGUES[j.lig]?.pointsSeulement; // Liiga : seulement buts et passes
    const pmCol = !LIGUES[j.lig]?.sansPlusMoins; // KHL : pas de +/- match par match
    const tete = gardien
      ? `<th>Date</th><th>Adv.</th><th>Rés.</th><th>Déc.</th><th>Arrêts</th><th>Tirs</th><th>BC</th><th>% arr.</th>`
      : `<th>Date</th><th>Adv.</th><th>Rés.</th><th>B</th><th>A</th><th>PTS</th>${simple ? "" : `${pmCol ? "<th>+/-</th>" : ""}<th>Tirs</th><th>PUN</th>${avecTemps ? "<th>TG</th>" : ""}`}`;
    const tot = [0, 0, 0, 0, 0, 0];
    const lignes = joues.map((m) => {
      const l = pts[m.id][j.id], r = resultatPour(m, j.eq);
      const adv = `${m.dom === j.eq ? "vs" : "@"} ${abr(adversaire(m, j.eq))}`;
      const debut = `<td>${dateCourte(m.date)}</td><td>${adv}</td><td class="res ${r.classe}">${estDirect(m) ? "● " : ""}${r.texte}</td>`;
      if (gardien) {
        const [, sv, sa, ga, decBrute, temps] = estGardienLigne(l) ? l : ["G", 0, 0, 0, "", ""];
        // Certaines ligues ne donnent pas la décision : on la déduit si le gardien a joué presque tout le match
        const minutes = parseInt(String(temps).split(":")[0], 10) || 0;
        const dec = decBrute || (estFini(m) && minutes >= 50 ? (r.classe === "v" ? "W" : m.fin ? "O" : "L") : "");
        tot[0] += sv; tot[1] += sa; tot[2] += ga;
        return `<tr data-match="${m.id}">${debut}<td>${DECISIONS[dec] || "–"}</td><td>${sv}</td><td>${sa}</td><td>${ga}</td><td>${sa ? (sv / sa).toFixed(3).replace(/^0/, "") : "–"}</td></tr>`;
      }
      const [b, a, pm, tirs, pun, tg] = estGardienLigne(l) ? [0, 0, 0, 0, 0, ""] : l;
      tot[0] += b; tot[1] += a; tot[2] += pm || 0; tot[3] += tirs; tot[4] += pun;
      const fort = b + a > 0 ? ' class="fort"' : "";
      return `<tr${fort} data-match="${m.id}">${debut}<td>${b}</td><td>${a}</td><td class="pts">${b + a}</td>${simple ? "" : `${pmCol ? `<td>${signe(pm)}</td>` : ""}<td>${tirs}</td><td>${pun}</td>${avecTemps ? `<td>${tg || "–"}</td>` : ""}`}</tr>`;
    }).join("");
    const total = gardien
      ? `<tr class="total"><td colspan="4">Total · ${pluriel(joues.length, "match")}</td><td>${tot[0]}</td><td>${tot[1]}</td><td>${tot[2]}</td><td>${tot[1] ? (tot[0] / tot[1]).toFixed(3).replace(/^0/, "") : "–"}</td></tr>`
      : `<tr class="total"><td colspan="3">Total · ${pluriel(joues.length, "match")}</td><td>${tot[0]}</td><td>${tot[1]}</td><td class="pts">${tot[0] + tot[1]}</td>${simple ? "" : `${pmCol ? `<td>${signe(tot[2])}</td>` : ""}<td>${tot[3]}</td><td>${tot[4]}</td>${avecTemps ? "<td></td>" : ""}`}</tr>`;
    h += `<div class="defile"><table class="tableau journal"><thead><tr>${tete}</tr></thead><tbody>${lignes}${total}</tbody></table></div>
      <p class="petit-gris">${gardien ? "Déc. : décision (V, D, DP) · BC : buts contre. " : simple ? "" : `${pmCol ? "+/- : différentiel · " : ""}PUN : minutes de punition${avecTemps ? " · TG : temps de glace" : ""}. `}Le match le plus récent est en haut.</p>`;
  }
  if (prochains.length) {
    h += `<h3>Prochains matchs</h3><div class="prochains">${prochains.map((m) =>
      `<div class="prochain-match" data-match="${m.id}"><strong>${dateLocale(m) === AUJ ? "Ce soir" : dateLongue(dateLocale(m))}</strong><span>${m.dom === j.eq ? "vs" : "@"} ${echapper(nomEq(adversaire(m, j.eq)))}</span><span>${heureDe(m, false)}</span></div>`).join("")}</div>`;
  }
  return h;
}
async function ouvrirFiche(id) {
  const j = joueur(id);
  if (!j) return;
  fermerRecherche();
  const estFav = favoris.includes(j.id);
  let corps = "";
  if (j.s || j.g) {
    corps += `<h3>Saison 2026-27</h3>${htmlStats(j, true)}`;
    corps += htmlStatsAvancees(j);
  }
  corps += `<div id="fiche-profil"></div>`;
  if (D.equipes[j.eq]) {
    corps += `<h3>Match par match</h3><div id="fiche-saison"><p class="vide">Chargement…</p></div>`;
    corps += `<div id="fiche-carriere"></div>`;
  } else {
    corps += `<p class="note-fiche">${echapper(j.note || "Informations à venir.")}</p>`;
  }
  $("fiche").innerHTML = `
    <div class="fiche-haut">${pastille(j)}
      <div><h2>${echapper(j.nom)}${j.r ? ` <span class="tag-recrue">Recrue</span>` : ""}</h2><p>${etiquetteLigue(j)} ${NOMS_POS[j.pos] || j.pos} · ${D.equipes[j.eq] ? `<button class="lien-equipe clair" data-equipe-fiche="${j.eq}">${echapper(nomEq(j.eq))} ›</button>` : echapper(nomEq(j.eq))}</p>
        <p class="fiche-boutons">${estFav ? `<button class="btn leger" data-retirer="${j.id}" data-garder>Retirer de mes favoris</button>`
          : `<button class="btn accent" data-ajouter="${j.id}" data-garder>+ Ajouter à mes favoris</button>`}
          ${j.s || j.g ? `<button class="btn fantome" data-comparer="${j.id}">⇄ Comparer</button>` : ""}
          <button class="btn fantome" data-partager="joueur/${j.id}" data-titre="${echapper(j.nom)} · MonTrioHockey">↗ Partager</button></p></div>
      <button class="fermer" aria-label="Fermer">✕</button>
    </div>
    <div class="fiche-corps">${corps}</div>`;
  $("fiche-fond").hidden = false;
  $("fiche-fond").scrollTop = 0;
  if (D.equipes[j.eq]) $("fiche-saison").innerHTML = (await htmlFormeJoueur(j)) + (await htmlMatchParMatch(j));
}
function fermerFiche() {
  const ouverte = !$("fiche-fond").hidden;
  $("fiche-fond").hidden = true;
  if (ouverte && (/^#\/(joueur|equipe|match|comparer)\//.test(location.hash) || adresseJolie())) {
    if (history.state?.montrio) history.back(); // retire l'adresse de la fenêtre (comme le bouton Retour)
    else history.replaceState(null, "", document.baseURI.replace(/#.*$/, "") + "#/" + (pageActuelle || "accueil"));
  }
}
$("fiche-fond").addEventListener("click", (e) => { if (e.target.id === "fiche-fond" || e.target.closest(".fermer")) fermerFiche(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerFiche(); });

// ---- 13. Un seul « écouteur » pour tous les boutons ------------
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-fiche],[data-ajouter],[data-retirer],[data-jour],[data-match],[data-equipe-fiche]");
  if (!b) return;
  if (b.dataset.equipeFiche) return ouvrirEquipe(b.dataset.equipeFiche);
  if (b.dataset.match && !b.dataset.fiche) return ouvrirMatch(b.dataset.match);
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
        for (const p of [...(e.forwards || []), ...(e.defense || [])]) ligne[String(p.playerId)] = [p.goals || 0, p.assists || 0, p.plusMinus || 0, p.sog ?? 0, p.pim || 0, p.toi || ""];
        for (const g of e.goalies || []) {
          if (!g.toi || g.toi === "00:00") continue;
          const [sv, sa] = String(g.saveShotsAgainst || "0/0").split("/").map(Number);
          ligne[String(g.playerId)] = ["G", sv || 0, sa || 0, g.goalsAgainst ?? 0, g.decision || "", g.toi];
        }
        (await points(eq))[m.id] = ligne;
        change = true;
      }
    }
  }
  return change;
}
async function directAutre(lig) {
  if (htBloque[lig] || !CLES_HT[lig]) return false; // Liiga et KHL : mises à jour par le robot seulement
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
  if (change) { rendreBandeau(); rendrePageScores(); rendreSoir(); rendreFavoris(); rendreCalendrier(); verifierAlertes(); }
  rendreMiseAJour();
}

// ---- 16 b. L'application sur le téléphone ------------------------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
const estInstallee = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const estIPhone = /iphone|ipad|ipod/i.test(navigator.userAgent);
let demandeInstall = null;
function rendreInstaller() {
  // Seulement sur téléphone ou tablette (écran tactile), jamais sur un ordinateur
  const mobile = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) <= 900;
  const montrer = mobile && !estInstallee() && memoire("installer-non") !== "1" && (demandeInstall || estIPhone);
  $("installer").hidden = !montrer;
  // Sur ordinateur : un petit bouton dans l'en-tête, quand le navigateur permet l'installation
  $("installer-pc").hidden = mobile || estInstallee() || !demandeInstall;
  if (montrer && estIPhone && !demandeInstall) {
    $("installer-aide").innerHTML = "Dans Safari, touche le bouton <b>Partager</b> (le carré avec la flèche ⬆️), puis <b>« Sur l'écran d'accueil »</b>.";
    $("installer-ok").hidden = true;
  }
}
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); demandeInstall = e; rendreInstaller(); });
window.addEventListener("appinstalled", () => { demandeInstall = null; rendreInstaller(); });
$("installer-pc").onclick = () => $("installer-ok").onclick();
$("installer-ok").onclick = async () => {
  if (!demandeInstall) return;
  demandeInstall.prompt();
  await demandeInstall.userChoice.catch(() => {});
  demandeInstall = null; rendreInstaller();
};
$("installer-non").onclick = () => { memoire("installer-non", "1"); rendreInstaller(); };

// ---- 17. Les pages (onglets, glisser sur téléphone) -----------
const PAGES = ["accueil", "scores", "favoris", "classement", "meneurs", "joueurs"];
let pageActuelle = null;
function allerA(page) {
  if (!PAGES.includes(page)) page = "accueil";
  const avant = PAGES.indexOf(pageActuelle), apres = PAGES.indexOf(page);
  // On remonte en haut d'un coup (sans défilement animé, qui donnait l'impression que ça « lag »)
  if (pageActuelle !== null && pageActuelle !== page) window.scrollTo({ top: 0, behavior: "instant" });
  document.querySelectorAll(".page").forEach((p) => {
    const active = p.dataset.page === page;
    if (p.hidden === !active && !(active && avant !== apres)) return; // rien à changer
    p.hidden = !active;
    p.classList.remove("vers-gauche", "vers-droite");
    // (une page qui réapparaît rejoue son animation d'elle-même : pas besoin de forcer le navigateur à tout recalculer)
    if (active && avant >= 0 && avant !== apres) p.classList.add(apres > avant ? "vers-gauche" : "vers-droite");
  });
  document.querySelectorAll("[data-lien]").forEach((a) => a.classList.toggle("actif", a.dataset.lien === page));
  // Le choix de ligue ne concerne pas la page « Mes favoris »
  document.body.classList.toggle("page-favoris", page === "favoris");
  document.body.classList.toggle("page-scores", page === "scores");
  pageActuelle = page;
  fermerFiche();
  fermerRecherche();
}
// Adresse lisible d'un joueur, d'une équipe ou d'un match (voir plus.js)
const adresseJolie = () => /\/(lnh|lah|lhjmq|ohl|whl|khl|shl|liiga|nl)\/(joueur|equipe|match)\/([^/]+)\/(?:([^/]+)\/)?$/.exec(location.pathname);
const pageDeLAdresse = () => (location.hash.match(/^#\/(\w+)/) || [])[1] || "accueil";
window.addEventListener("hashchange", () => { if (!ouvrirDepuisAdresse()) allerA(pageDeLAdresse()); });
// Retour / avant dans l'historique vers une adresse lisible (sans « # »)
window.addEventListener("popstate", () => {
  if (!location.hash && adresseJolie()) ouvrirDepuisAdresse();
  else if (location.hash) { if (!ouvrirDepuisAdresse()) allerA(pageDeLAdresse()); } // (le navigateur n'envoie pas toujours « hashchange » ici)
  else if (!$("fiche-fond").hidden) fermerFiche();
});
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
  rendreChoixLigue(); rendreBienvenue(); rendreInstaller();
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
  rendreRecits();
  ouvrirDepuisAdresse();
  setInterval(tourDirect, SECONDES_DIRECT * 1000);
  tourDirect();
  setInterval(() => {
    const nouveauJour = versTexte(new Date());
    if (nouveauJour !== AUJ) { AUJ = nouveauJour; rafraichir(); rendreUne(); }
    rendreMiseAJour();
  }, 60000);
}
// demarrer() est appelé à la fin de plus.js (la 2e partie du code)
