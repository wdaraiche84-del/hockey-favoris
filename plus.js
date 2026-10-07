// =============================================================
// LA 2e PARTIE DU CODE : LES PAGES DE DÉTAIL ET LES OUTILS
// (chargée juste après app.js, elle utilise ses fonctions)
//   A. Fenêtre de détail (avec bouton « Retour »)
//   B. Sommaire d'un match (ou avant-match)
//   C. Fiche d'une équipe
//   D. Forme récente : joueurs en feu, séquences de points
//   E. Comparateur de joueurs
//   F. Partage, alertes de buts, lexique
//   G. Liens directs (#/joueur/…, #/equipe/…, #/match/…)
// =============================================================

// ---- A. Fenêtre de détail -------------------------------------
// On garde la liste des fenêtres ouvertes l'une après l'autre,
// pour pouvoir revenir en arrière (ex. match → joueur → retour au match).
let pileModale = [], modaleActuelle = null;
function noterModale(entree) {
  if ($("fiche-fond").hidden) { pileModale = []; modaleActuelle = null; }
  const pareil = modaleActuelle && modaleActuelle.t === entree.t && modaleActuelle.id === entree.id;
  if (modaleActuelle && !pareil && !entree.retour) pileModale.push(modaleActuelle);
  modaleActuelle = { t: entree.t, id: entree.id, id2: entree.id2 };
}
const boutonRetour = () => (pileModale.length ? `<button class="retour" data-retour aria-label="Retour">‹ Retour</button>` : "");
function ajouterRetour() {
  const haut = document.querySelector("#fiche .fiche-haut");
  if (haut && pileModale.length && !haut.querySelector(".retour")) haut.insertAdjacentHTML("afterbegin", boutonRetour());
}
function montrerModale(html) {
  fermerRecherche();
  $("fiche").innerHTML = html;
  $("fiche-fond").hidden = false;
  $("fiche-fond").scrollTop = 0;
  majAdresse();
  $("fiche").querySelector(".fermer")?.focus({ preventScroll: true });
}
// L'adresse suit la fenêtre ouverte : le bouton Retour du téléphone la ferme,
// et le lien peut être copié tel quel.
function routeModale() {
  const e = modaleActuelle;
  if (!e || e.t === "lexique") return null;
  return e.t === "comparer" ? (e.id2 ? `comparer/${e.id}/${e.id2}` : null) : `${e.t}/${e.id}`;
}
// Adresses lisibles, comme les grands sites : lnh/joueur/nick-suzuki/8480018/
// (même règle que le robot scripts/maj-partage.mjs, qui crée une page pour chacune)
const PREFIXE = { lnh: "lnh", ahl: "lah", lhjmq: "lhjmq", ohl: "ohl", whl: "whl", khl: "khl", shl: "shl", liiga: "liiga", nl: "nl" };
const slugUrl = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
function cheminJoli(type, id) {
  if (type === "joueur") { const j = joueur(id); return j && j.lig ? `${PREFIXE[j.lig]}/joueur/${slugUrl(j.nom)}/${j.id}/` : null; }
  if (type === "equipe") { const e = D.equipes[id]; return e ? `${PREFIXE[e.lig]}/equipe/${slugUrl(e.nom)}/` : null; }
  if (type === "match") { const m = matchParId(id); return m && D.equipes[m.dom] ? `${PREFIXE[ligueDe(m.dom)]}/match/${slugUrl(courtEq(m.ext))}-${slugUrl(courtEq(m.dom))}-${m.date}/${m.id}/` : null; }
  return null;
}
function adresseModale() {
  const e = modaleActuelle;
  if (!e || e.t === "lexique") return null;
  if (e.t === "comparer") return e.id2 ? `#/comparer/${e.id}/${e.id2}` : null;
  return cheminJoli(e.t, e.id) || `#/${e.t}/${e.id}`;
}
function majAdresse() {
  const r = adresseModale();
  if (!r) return;
  const url = new URL(r, document.baseURI).href;
  if (url === location.href) return;
  const dejaModale = /^#\/(joueur|equipe|match|comparer)\//.test(location.hash) || adresseJolie();
  if (dejaModale) history.replaceState(history.state, "", url);
  else history.pushState({ montrio: true }, "", url);
}
function revenir() {
  const e = pileModale.pop();
  if (!e) return fermerFiche();
  const r = { retour: true };
  if (e.t === "joueur") ouvrirFiche(e.id, r);
  else if (e.t === "equipe") ouvrirEquipe(e.id, r);
  else if (e.t === "match") ouvrirMatch(e.id, r);
  else if (e.t === "comparer") ouvrirComparaison(e.id, e.id2, r);
}
// La fiche d'un joueur (écrite dans app.js) profite aussi du bouton Retour
const ouvrirFicheBase = ouvrirFiche;
ouvrirFiche = function (id, opt = {}) {
  noterModale({ t: "joueur", id, retour: opt.retour });
  const p = ouvrirFicheBase(id);
  ajouterRetour();
  majAdresse();
  $("fiche").querySelector(".fermer")?.focus({ preventScroll: true });
  rendreProfil(id);
  return p;
};

// ---- Profil du joueur : bio, repêchage, carrière, trophées -------------
const PAYS = { CAN: "Canada", USA: "États-Unis", SWE: "Suède", FIN: "Finlande", CZE: "Tchéquie", SVK: "Slovaquie", RUS: "Russie", CHE: "Suisse", SUI: "Suisse",
  DEU: "Allemagne", GER: "Allemagne", AUT: "Autriche", LVA: "Lettonie", LAT: "Lettonie", DNK: "Danemark", DEN: "Danemark", NOR: "Norvège", BLR: "Bélarus",
  KAZ: "Kazakhstan", FRA: "France", SVN: "Slovénie", SLO: "Slovénie", UKR: "Ukraine", GBR: "Royaume-Uni", NLD: "Pays-Bas", AUS: "Australie", ITA: "Italie",
  POL: "Pologne", HUN: "Hongrie", JPN: "Japon", CHN: "Chine", KOR: "Corée du Sud", EST: "Estonie", LTU: "Lituanie", "United States": "États-Unis",
  Canada: "Canada", Sweden: "Suède", Finland: "Finlande", Czechia: "Tchéquie", "Czech Republic": "Tchéquie", Slovakia: "Slovaquie", Russia: "Russie",
  Switzerland: "Suisse", Germany: "Allemagne", Austria: "Autriche", Latvia: "Lettonie", Denmark: "Danemark", Norway: "Norvège", Belarus: "Bélarus",
  Kazakhstan: "Kazakhstan", France: "France", Slovenia: "Slovénie", Ukraine: "Ukraine", Netherlands: "Pays-Bas", "United Kingdom": "Royaume-Uni", USA: "États-Unis" };
const carrieres = {};
const ageDe = (n) => { const d = new Date(n), a = new Date(); let x = a.getFullYear() - d.getFullYear(); if (a < new Date(a.getFullYear(), d.getMonth(), d.getDate())) x--; return x; };
const dateNaissance = (n) => { const [y, m, d] = n.split("-").map(Number); return `${d === 1 ? "1er" : d} ${MOIS[m - 1]} ${y}`; };
async function rendreProfil(id) {
  const j = joueur(id);
  if (!j) return;
  let c = null;
  if (j.lig === "lnh" && /^\d+$/.test(j.id)) {
    carrieres[j.id] ||= lireJson(`data/carriere/${j.id}.json`).catch(() => null);
    c = await carrieres[j.id];
  }
  if (modaleActuelle?.t !== "joueur" || modaleActuelle.id !== id) return;
  const bio = c?.bio || j.bio, rep = c?.rep || j.rep;
  const boite = $("fiche-profil");
  if (boite && (bio || rep)) {
    const t = (val, lib) => (val ? `<div class="profil-ligne"><small>${lib}</small><b>${val}</b></div>` : "");
    const lieu = bio ? [bio.ville, bio.prov, PAYS[bio.pays] || bio.pays].filter(Boolean).join(", ") : "";
    const tir = bio?.tir ? `${j.pos === "G" ? "Attrape" : "Lance"} de la ${/^L/i.test(bio.tir) ? "gauche" : "droite"}` : "";
    const repTxt = rep ? `${rep.annee}${rep.ronde ? `, ${rep.ronde === 1 ? "1re" : `${rep.ronde}e`} ronde` : ""}${rep.rang ? ` (${rep.rang === 1 ? "1er" : `${rep.rang}e`} au total)` : ""}${rep.eq ? ` · ${echapper(D.equipes[rep.eq] ? nomEq(rep.eq) : rep.eq)}` : ""}` : (j.lig === "lnh" && c ? "Jamais repêché" : "");
    boite.innerHTML = `<h3>Profil</h3><div class="profil">
      ${t(bio?.naissance ? `${ageDe(bio.naissance)} ans` : "", "Âge")}
      ${t(bio?.naissance ? `${dateNaissance(bio.naissance)}${lieu ? ` · ${echapper(lieu)}` : ""}` : echapper(lieu), "Naissance")}
      ${t(bio?.taille ? `${(bio.taille / 100).toFixed(2).replace(".", ",")} m` : "", "Taille")}
      ${t(bio?.poids ? `${bio.poids} kg` : "", "Poids")}
      ${t(tir, j.pos === "G" ? "Gant" : "Tir")}
      ${t(repTxt, "Repêchage LNH")}</div>`;
  }
  const bc = $("fiche-carriere");
  if (!bc || !c?.saisons?.length) return;
  const gardien = j.pos === "G";
  const lignes = (type) => c.saisons.filter((s) => s[3] === type);
  const table = (rows) => `<div class="defile"><table class="tableau journal carriere"><thead><tr><th>Saison</th><th>Équipe</th><th>Ligue</th><th>PJ</th>${gardien ? "<th>V</th><th>D</th><th>DP</th><th>Moy.</th><th>% arr.</th><th>BL</th>" : "<th>B</th><th>A</th><th>PTS</th><th>+/-</th><th>PUN</th>"}</tr></thead><tbody>
    ${rows.map((s) => `<tr class="${s[1] === "NHL" ? "lnh" : ""}"><td>${s[0]}</td><td>${echapper(s[2])}</td><td>${echapper(s[1] === "NHL" ? "LNH" : s[1] === "AHL" ? "LAH" : s[1] === "QMJHL" ? "LHJMQ" : s[1])}</td><td>${s[4]}</td>${gardien
      ? `<td>${s[5]}</td><td>${s[6]}</td><td>${s[7]}</td><td>${dec(s[8])}</td><td>${pct3(s[9])}</td><td>${s[10]}</td>`
      : `<td>${s[5]}</td><td>${s[6]}</td><td class="pts">${s[7]}</td><td>${s[8] == null ? "–" : signe(s[8])}</td><td>${s[9]}</td>`}</tr>`).join("")}</tbody></table></div>`;
  const totLnh = lignes("s").filter((s) => s[1] === "NHL");
  const somme = (k) => totLnh.reduce((x, s) => x + (Number(s[k]) || 0), 0);
  const resume = gardien ? `${somme(4)} matchs · ${somme(5)} victoires · ${somme(10)} blanchissages` : `${somme(4)} matchs · ${somme(5)} buts · ${somme(6)} passes · ${somme(7)} points`;
  bc.innerHTML = `<h3>Carrière</h3>${totLnh.length ? `<p class="petit-gris" style="margin-top:0">En carrière dans la LNH (saison régulière) : <b>${resume}</b></p>` : ""}
    ${c.trophees?.length ? `<div class="trophees">${c.trophees.map((x) => `<span class="trophee">🏆 ${echapper(x.nom)} <small>${x.saisons.join(", ")}</small></span>`).join("")}</div>` : ""}
    ${table(lignes("s").slice().reverse())}
    ${lignes("e").length ? `<details class="feuille-equipe"><summary>Séries éliminatoires <small>${lignes("e").length} saisons</small></summary>${table(lignes("e").slice().reverse())}</details>` : ""}
    <p class="petit-gris">Toutes les ligues où il a joué, saison régulière, de la plus récente à la plus ancienne. Source : LNH.</p>`;
}

// Petits morceaux réutilisés
const pct3 = (x) => (x == null || isNaN(x) ? "–" : x.toFixed(3).replace(/^0/, ""));
const PASTILLE_ISSUE = ["V", "D", "DP"];
function pastillesForme(eq, n = 10) {
  const f = bilan(eq).forme.slice(-n);
  if (!f.length) return `<span class="petit-gris">Aucun match joué.</span>`;
  return `<div class="forme">${f.map(({ m, i }) => {
    const { nous, eux } = scorePour(m, eq);
    return `<button class="forme-pastille f${i}" data-match="${m.id}" title="${dateCourte(m.date)} · ${m.dom === eq ? "vs" : "@"} ${abr(adversaire(m, eq))} · ${nous}-${eux}${suffixeFin(m)}">${PASTILLE_ISSUE[i]}</button>`;
  }).join("")}</div>`;
}
function rangDe(eq) {
  const lig = ligueDe(eq), c = D.classement[lig] || [];
  const t = c.find((x) => x.eq === eq);
  if (!t) return null;
  const ligueRang = trierEquipes(c).findIndex((x) => x.eq === eq) + 1;
  const groupe = t.div && groupes(c, "div").length > 1 ? t.div : t.conf && groupes(c, "conf").length > 1 ? t.conf : null;
  const groupeRang = groupe ? trierEquipes(c.filter((x) => (x.div === groupe || x.conf === groupe))).findIndex((x) => x.eq === eq) + 1 : null;
  return { t, ligueRang, nbLigue: c.length, groupe, groupeRang };
}
const ieme = (n) => (n === 1 ? "1<sup>er</sup>" : `${n}<sup>e</sup>`);
const ligneMatchCourte = (m, eq) => {
  const joue = estFini(m) || estDirect(m);
  const r = joue ? resultatPour(m, eq) : null;
  return `<button class="ligne-cal" data-match="${m.id}">
    <span class="lc-date">${m.date === AUJ ? "Ce soir" : dateCourte(m.date)}</span>
    <span class="lc-adv">${m.dom === eq ? "vs" : "@"} <b>${abr(adversaire(m, eq))}</b> ${simplifier(courtEq(adversaire(m, eq))).trim() !== simplifier(abr(adversaire(m, eq))) ? `<span class="lc-nom">${echapper(courtEq(adversaire(m, eq)))}</span>` : ""}</span>
    <span class="lc-res ${r ? r.classe : ""}">${r ? (estDirect(m) ? "● " : "") + r.texte : heureDe(m)}</span></button>`;
};

// ---- B. Sommaire d'un match -----------------------------------
const nomCourt = (j) => (j ? `${j.nom.split(" ")[0][0]}. ${nomDeFamille(j)}` : "?");
// Les 3 étoiles, choisies automatiquement à partir des stats du match
function troisEtoiles(m, lignes) {
  const cand = [];
  for (const [eq, ligne] of lignes) for (const [id, l] of Object.entries(ligne)) {
    const j = D.parId.get(id); if (!j) continue;
    const gagne = issuePour(m, eq) === 0;
    if (estGardienLigne(l)) {
      const [, sv, sa] = l; if (!sa) continue;
      // Un gardien doit avoir fait face à beaucoup de tirs pour mériter une étoile
      cand.push({ j, eq, l, note: (sv / sa - 0.9) * sa * 0.5 + (gagne ? 2 : 0) + sv * 0.04 });
    } else {
      const [b, a, pm, tirs] = l;
      cand.push({ j, eq, l, note: b * 3 + a * 2 + (pm > 0 ? pm * 0.4 : 0) + (tirs || 0) * 0.1 + (gagne ? 0.5 : 0) });
    }
  }
  return cand.sort((x, y) => y.note - x.note).slice(0, 3).filter((x) => x.note > 1);
}
const texteLigne = (l) => (estGardienLigne(l) ? `${l[1]} arrêts sur ${l[2]} (${l[2] ? pct3(l[1] / l[2]) : "–"})` : `${l[0]} B, ${l[1]} A${l[3] ? ` · ${pluriel(l[3], "tir")}` : ""}`);
function barreComparee(titre, a, b, inverse = false) {
  if (!a && !b) return "";
  const tot = a + b || 1, mieuxA = inverse ? a < b : a > b, mieuxB = inverse ? b < a : b > a;
  return `<div class="barre-comp"><span class="${mieuxA ? "fort" : ""}">${a}</span><div class="bc-centre"><small>${titre}</small>
    <div class="bc-piste"><i style="width:${(a / tot) * 100}%"></i><i style="width:${(b / tot) * 100}%"></i></div></div><span class="${mieuxB ? "fort" : ""}">${b}</span></div>`;
}
function tableFeuille(eq, ligne, simple) {
  const lignes = Object.entries(ligne).map(([id, l]) => ({ j: D.parId.get(id), id, l })).filter((x) => x.j);
  const pat = lignes.filter((x) => !estGardienLigne(x.l)).sort((a, b) => ptsLigne(b.l) - ptsLigne(a.l) || b.l[0] - a.l[0] || String(b.l[5]).localeCompare(String(a.l[5]), undefined, { numeric: true }));
  const gar = lignes.filter((x) => estGardienLigne(x.l));
  const pm = !LIGUES[ligueDe(eq)]?.sansPlusMoins, tg = pat.some((x) => x.l[5]);
  return `<div class="defile"><table class="tableau journal feuille"><thead><tr><th>Joueur</th><th>Pos</th><th>B</th><th>A</th><th>PTS</th>${simple ? "" : `${pm ? "<th>+/-</th>" : ""}<th>Tirs</th><th>PUN</th>${tg ? "<th>TG</th>" : ""}`}</tr></thead><tbody>
    ${pat.map(({ j, l }) => `<tr class="${ptsLigne(l) ? "fort" : ""}" data-fiche="${j.id}"><td>${echapper(nomCourt(j))}${favoris.includes(j.id) ? " ⭐" : ""}</td><td>${j.pos}</td><td>${l[0]}</td><td>${l[1]}</td><td class="pts">${ptsLigne(l)}</td>${simple ? "" : `${pm ? `<td>${signe(l[2] || 0)}</td>` : ""}<td>${l[3] ?? 0}</td><td>${l[4] ?? 0}</td>${tg ? `<td>${l[5] || "–"}</td>` : ""}`}</tr>`).join("")}
    </tbody></table></div>
    ${gar.length ? `<div class="defile"><table class="tableau journal feuille"><thead><tr><th>Gardien</th><th>Déc.</th><th>Arrêts</th><th>Tirs</th><th>BC</th><th>% arr.</th></tr></thead><tbody>
    ${gar.map(({ j, l }) => `<tr data-fiche="${j.id}"><td>${echapper(nomCourt(j))}</td><td>${DECISIONS[l[4]] || "–"}</td><td>${l[1]}</td><td>${l[2]}</td><td>${l[3]}</td><td>${l[2] ? pct3(l[1] / l[2]) : "–"}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
}
function blocEquipeMatch(eq, score, joue, gagne, cote) {
  return `<button class="me-equipe ${joue && !gagne ? "perd" : ""}" data-equipe-fiche="${eq}">
    <span class="me-cote">${cote}</span><span class="me-abr">${abr(eq)}</span><span class="me-nom">${echapper(nomEq(eq))}</span>
    <span class="me-bilan">${fmtBilan(bilan(eq).tous)}</span></button>
    ${joue ? `<span class="me-score ${gagne ? "gagne" : ""}">${score}</span>` : ""}`;
}
async function ouvrirMatch(id, opt = {}) {
  await charger(ligDeId(id)).catch(() => {});
  const m = matchParId(id);
  if (!m) return toast("Ce match n'a pas été trouvé.");
  noterModale({ t: "match", id: String(m.id), retour: opt.retour });
  const lig = ligueDe(m.dom), joue = estFini(m) || estDirect(m);
  const statut = estDirect(m) ? `<span class="badge-direct">EN DIRECT</span> ${m.periode || ""}` : estFini(m) ? `Final${suffixeFin(m)}` : `${heureDe(m)}`;
  const haut = `<div class="fiche-haut match-haut">${boutonRetour()}
    <div class="match-entete"><span class="tag-ligue petit">${LIGUES[lig].nom}</span> ${dateLongue(m.date)} · ${statut}${m.series ? " · Séries" : ""}</div>
    <div class="match-equipes">
      <div class="me-cote-bloc">${blocEquipeMatch(m.ext, m.se, joue, m.se > m.sd, "Visiteurs")}</div>
      <span class="me-tiret">${joue ? "–" : "@"}</span>
      <div class="me-cote-bloc dom">${blocEquipeMatch(m.dom, m.sd, joue, m.sd > m.se, "Locaux")}</div>
    </div>
    <button class="fermer" aria-label="Fermer">✕</button></div>`;
  montrerModale(haut + `<div class="fiche-corps"><p class="vide">Chargement…</p></div>`);
  const corps = joue ? await corpsMatchJoue(m) : corpsAvantMatch(m);
  if (modaleActuelle?.t !== "match" || modaleActuelle.id !== String(m.id)) return; // une autre fenêtre a été ouverte entre-temps
  const outils = `<div class="fiche-outils">
    <button class="btn fantome" data-partager="match/${m.id}" data-titre="${echapper(abr(m.ext))} @ ${echapper(abr(m.dom))} · MonTrioHockey">↗ Partager</button>
</div>`;
  $("fiche").querySelector(".fiche-corps").innerHTML = corps + outils;
}
async function corpsMatchJoue(m) {
  const lig = ligueDe(m.dom), simple = !!LIGUES[lig].pointsSeulement;
  const lignes = [[m.ext, (await points(m.ext))[m.id] || {}], [m.dom, (await points(m.dom))[m.id] || {}]];
  const vide = !Object.keys(lignes[0][1]).length && !Object.keys(lignes[1][1]).length;
  let h = "";
  if (vide) return `<p class="vide">${estDirect(m) ? "Les statistiques des joueurs arrivent au fil du match." : "Les statistiques détaillées de ce match ne sont pas encore disponibles. Reviens un peu plus tard!"}</p>`;
  // Le récit du match, écrit automatiquement
  if (estFini(m)) h += `<h3>Le récit</h3><p class="recit">${recitMatch(m, lignes)}</p><p class="petit-gris">Écrit automatiquement par MonTrioHockey à partir des statistiques officielles.</p>`;
  // Les 3 étoiles
  // LNH : le déroulement du match (buts période par période) et les 3 étoiles officielles
  const som = ligueDe(m.dom) === "lnh" && estFini(m) ? await lireJson(`data/sommaires/${m.id}.json`).catch(() => null) : null;
  let etoiles = troisEtoiles(m, lignes), officielles = false;
  if (som?.etoiles?.length) {
    const toutes = Object.fromEntries(lignes.flatMap(([eq, ligne]) => Object.entries(ligne).map(([id, l]) => [id, { eq, l }])));
    const off = som.etoiles.map((id) => ({ j: D.parId.get(id), ...toutes[id] })).filter((x) => x.j && x.l);
    if (off.length) { etoiles = off; officielles = true; }
  }
  if (etoiles.length) {
    h += `<h3>Les 3 étoiles</h3><div class="etoiles">${etoiles.map((x, i) => `<button class="etoile" data-fiche="${x.j.id}">
      <span class="etoile-rang">${"★".repeat(3 - i)}</span><span class="numero">${x.j.no ?? "–"}</span>
      <span class="etoile-nom"><strong>${echapper(x.j.nom)}</strong><small>${abr(x.eq)} · ${texteLigne(x.l)}</small></span></button>`).join("")}</div>
      <p class="petit-gris">${officielles ? "Les 3 étoiles officielles du match." : "Choisies automatiquement par MonTrioHockey selon les statistiques du match."}</p>`;
  }
  if (som?.per?.some((x) => x.buts.length)) h += htmlDeroulement(m, som);
  // Le match en chiffres
  const tot = (ligne, k) => Object.values(ligne).filter((l) => !estGardienLigne(l)).reduce((s, l) => s + (Number(l[k]) || 0), 0);
  const tirsContre = (ligne) => Object.values(ligne).filter(estGardienLigne).reduce((s, l) => s + (l[2] || 0), 0);
  const [[, le], [, ld]] = lignes;
  // Tirs : selon les gardiens adverses (plus fiable), sinon selon les patineurs
  const tirsE = tirsContre(ld) || tot(le, 3), tirsD = tirsContre(le) || tot(ld, 3);
  if (!simple) {
    h += `<h3>Le match en chiffres</h3><div class="comp-tete"><b>${abr(m.ext)}</b><b>${abr(m.dom)}</b></div>
      ${barreComparee("Buts", m.se, m.sd)}${barreComparee("Tirs au but", tirsE, tirsD)}${barreComparee("Minutes de punition", tot(le, 4), tot(ld, 4), true)}`;
  }
  // Marqueurs et gardiens, par équipe
  h += `<h3>${simple ? "Les marqueurs" : "Marqueurs et gardiens"}</h3><div class="deux-col">${lignes.map(([eq, ligne]) => {
    const pts = Object.entries(ligne).filter(([, l]) => ptsLigne(l) > 0).map(([id, l]) => ({ j: D.parId.get(id), l })).filter((x) => x.j).sort((a, b) => ptsLigne(b.l) - ptsLigne(a.l) || b.l[0] - a.l[0]);
    const gar = Object.entries(ligne).filter(([, l]) => estGardienLigne(l)).map(([id, l]) => ({ j: D.parId.get(id), l })).filter((x) => x.j);
    return `<div class="col-equipe"><h4>${echapper(nomEq(eq))}</h4><ul class="liste-simple">
      ${pts.map(({ j, l }) => `<li data-fiche="${j.id}"><span>${echapper(j.nom)}${favoris.includes(j.id) ? " ⭐" : ""}</span><b>${l[0] ? `${l[0]} B` : ""}${l[0] && l[1] ? ", " : ""}${l[1] ? `${l[1]} A` : ""}</b></li>`).join("") || `<li class="vide">Aucun point.</li>`}
      ${gar.map(({ j, l }) => `<li class="gardien" data-fiche="${j.id}"><span>🧤 ${echapper(j.nom)}</span><b>${l[1]}/${l[2]}</b></li>`).join("")}</ul></div>`;
  }).join("")}</div>`;
  // Feuille de match complète
  if (!simple) h += `<h3>Feuille de match</h3>${lignes.map(([eq, ligne]) => `<details class="feuille-equipe"><summary>${echapper(nomEq(eq))} <small>${Object.keys(ligne).length} joueurs</small></summary>${tableFeuille(eq, ligne, simple)}</details>`).join("")}
    <p class="petit-gris">Touche un joueur pour voir sa fiche. PUN : minutes de punition · TG : temps de glace · BC : buts contre.</p>`;
  else h += `<p class="petit-gris">Pour ${laLigue(lig)}, la source donne seulement les buts et les passes.</p>`;
  // Les autres matchs entre ces deux équipes
  h += htmlFaceAFace(m);
  return h;
}
// ---- Récit automatique d'un match, en français ----------------
// Articles selon le nom court : « les Canadiens », « le Lightning », « l'Avalanche »
function article(eq) {
  const n = courtEq(eq).trim();
  // Les surnoms au pluriel : « les Canadiens », « les Hitmen », « les ZSC Lions »
  if (/(s|men)$/i.test(n)) return { le: `les ${n}`, du: `des ${n}`, au: `aux ${n}`, pl: true };
  // En Europe, les autres équipes portent surtout un nom de ville : pas d'article (« Fribourg-Gottéron », « de Lausanne »)
  if (["khl", "shl", "liiga", "nl"].includes(ligueDe(eq))) {
    const voy = /^[aeiouhéèêàâîôûAEIOUHÉÈÄÖÜ]/.test(n);
    return { le: n, du: `${voy ? "d'" : "de "}${n}`, au: `à ${n}`, pl: false };
  }
  if (/^[aeiouhéèêàâîôûAEIOUHÉÈ]/.test(n)) return { le: `l'${n}`, du: `de l'${n}`, au: `à l'${n}`, pl: false };
  return { le: `le ${n}`, du: `du ${n}`, au: `au ${n}`, pl: false };
}
const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const JOURS_LONGS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
function recitMatch(m, lignes) {
  const gagnantDom = m.sd > m.se, W = gagnantDom ? m.dom : m.ext, L = gagnantDom ? m.ext : m.dom;
  const sw = Math.max(m.sd, m.se), sl = Math.min(m.sd, m.se), ecart = sw - sl;
  const aW = article(W), aL = article(L), v = (a, sing, plur) => (a.pl ? plur : sing);
  const jour = JOURS_LONGS[versDate(m.date).getDay()], lieu = gagnantDom ? (aW.pl ? "devant leurs partisans" : "devant ses partisans") : "sur la route";
  let p1;
  if (m.fin === "SO") p1 = `${majuscule(aW.le)} ${v(aW, "l'a", "l'ont")} emporté ${sw}-${sl} en tirs de barrage contre ${aL.le}, ${jour}, ${lieu}.`;
  else if (m.fin === "OT") p1 = `${majuscule(aW.le)} ${v(aW, "a", "ont")} eu besoin de la prolongation pour venir à bout ${aL.du} ${sw}-${sl}, ${jour}, ${lieu}.`;
  else if (sl === 0) p1 = `${majuscule(aW.le)} ${v(aW, "a", "ont")} blanchi ${aL.le} ${sw}-0, ${jour}, ${lieu}.`;
  else if (ecart >= 3) p1 = `${majuscule(aW.le)} ${v(aW, "a", "ont")} dominé ${aL.le} ${sw}-${sl}, ${jour}, ${lieu}.`;
  else p1 = `${majuscule(aW.le)} ${v(aW, "a", "ont")} eu le dessus sur ${aL.le} ${sw}-${sl}, ${jour}, ${lieu}.`;
  const lig = Object.fromEntries(lignes);
  const meilleurs = (eq) => Object.entries(lig[eq] || {}).filter(([, l]) => !estGardienLigne(l) && ptsLigne(l) > 0)
    .map(([id, l]) => ({ j: D.parId.get(id), b: l[0], a: l[1] })).filter((x) => x.j).sort((a, b) => (b.b + b.a) - (a.b + a.a) || b.b - a.b);
  const fait = (x) => [x.b ? pluriel(x.b, "but") : "", x.a ? pluriel(x.a, "passe") : ""].filter(Boolean).join(" et ");
  const phrases = [p1];
  const [h1, h2] = meilleurs(W);
  if (h1) {
    if (h1.b >= 3) phrases.push(`${h1.j.nom} a réussi un tour du chapeau${h1.a ? ` en plus d'ajouter ${pluriel(h1.a, "passe")}` : ""}.`);
    else phrases.push(`${h1.j.nom} a mené la charge avec ${fait(h1)}${h2 && h2.b + h2.a >= 2 ? `, ${/^[aeiouhéèêàâîôûAEIOUHÉÈ]/.test(h2.j.nom) ? "tandis qu'" : "tandis que "}${h2.j.nom} a ajouté ${fait(h2)}` : ""}.`);
  }
  const [p] = meilleurs(L);
  if (p && p.b + p.a >= 2) phrases.push(`Du côté ${aL.du}, ${p.j.nom} a récolté ${fait(p)} dans la défaite.`);
  const gardien = Object.entries(lig[W] || {}).filter(([, l]) => estGardienLigne(l) && l[2]).map(([id, l]) => ({ j: D.parId.get(id), sv: l[1], sa: l[2] })).filter((x) => x.j).sort((a, b) => b.sa - a.sa)[0];
  if (gardien) phrases.push(sl === 0 ? `${gardien.j.nom} a signé le blanchissage en bloquant ${pluriel(gardien.sv, "tir")}.` : `Devant le filet, ${gardien.j.nom} a repoussé ${gardien.sv} des ${gardien.sa} tirs dirigés vers lui.`);
  const tirs = (eq) => Object.values(lig[eq === m.dom ? m.ext : m.dom] || {}).filter(estGardienLigne).reduce((s, l) => s + (l[2] || 0), 0);
  const tW = tirs(W), tL = tirs(L);
  if (tW && tL && Math.abs(tW - tL) >= 10) {
    if (tW > tL) phrases.push(`${majuscule(aW.le)} ${v(aW, "a", "ont")} aussi eu nettement l'avantage au chapitre des tirs, ${tW}-${tL}.`);
    else phrases.push(`${majuscule(aL.le)} ${v(aL, "a", "ont")} pourtant obtenu beaucoup plus de tirs, ${tL}-${tW}, sans réussir à en profiter.`);
  }
  // Fiche de l'équipe gagnante juste après ce match
  const fiche = [0, 0, 0];
  for (const x of matchsDe(W).filter(estFini)) { fiche[issuePour(x, W)]++; if (String(x.id) === String(m.id)) break; }
  phrases.push(`${majuscule(aW.le)} ${v(aW, "porte", "portent")} ainsi ${v(aW, "sa", "leur")} fiche à ${fmtBilan(fiche)}.`);
  return phrases.map(echapper).join(" ");
}

const NOMS_PERIODE = (x) => (x.type === "SO" ? "Tirs de barrage" : x.type === "OT" ? "Prolongation" : `${x.n === 1 ? "1re" : `${x.n}e`} période`);
const FORCE = { pp: "AN", sh: "DN", ev: "" };
function htmlDeroulement(m, som) {
  return `<h3>Déroulement</h3><div class="deroulement">${som.per.map((x) => `<div class="periode"><h4>${NOMS_PERIODE(x)}</h4>
    ${x.buts.length ? x.buts.map((g) => {
      const j = D.parId.get(g.id);
      const nom = j ? `<button class="lien-joueur" data-fiche="${j.id}">${echapper(g.nom)}</button>` : echapper(g.nom);
      const passes = g.passes.map(([id, n]) => (D.parId.get(id) ? `<button class="lien-joueur" data-fiche="${id}">${echapper(n)}</button>` : echapper(n))).join(", ");
      const etiq = [FORCE[g.force], g.mod === "empty-net" ? "filet désert" : g.mod === "penalty-shot" ? "tir de pénalité" : ""].filter(Boolean).join(" · ");
      return `<div class="but-ligne"><span class="but-temps">${x.type === "SO" ? "" : g.t}</span><span class="but-eq">${abr(g.eq)}</span>
        <span class="but-texte">${nom}${passes ? ` <small>(${passes})</small>` : x.type === "SO" ? "" : " <small>(sans aide)</small>"}${etiq ? ` <span class="but-etiq">${etiq}</span>` : ""}</span>
        <span class="but-score">${g.se}-${g.sd}</span></div>`;
    }).join("") : `<p class="vide">Aucun but.</p>`}</div>`).join("")}</div>
    <p class="petit-gris">Score affiché : ${abr(m.ext)}-${abr(m.dom)} · AN : avantage numérique · DN : désavantage numérique.</p>`;
}
function htmlFaceAFace(m) {
  const autres = D.cal.filter((x) => x !== m && ((x.dom === m.dom && x.ext === m.ext) || (x.dom === m.ext && x.ext === m.dom)));
  if (!autres.length) return "";
  const v = { [m.dom]: 0, [m.ext]: 0 }, finis = [...autres, m].filter(estFini);
  for (const x of finis) v[x.sd > x.se ? x.dom : x.ext]++;
  const ligneNeutre = (x) => `<button class="ligne-cal" data-match="${x.id}"><span class="lc-date">${x.date === AUJ ? "Ce soir" : dateCourte(x.date) + (x.date.slice(0, 4) !== AUJ.slice(0, 4) ? ` ${x.date.slice(0, 4)}` : "")}</span>
    <span class="lc-adv"><b>${abr(x.ext)}</b> @ <b>${abr(x.dom)}</b></span><span class="lc-res">${estFini(x) || estDirect(x) ? `${x.se}-${x.sd}${suffixeFin(x)}` : heureDe(x)}</span></button>`;
  return `<h3>Entre eux cette saison</h3>${finis.length ? `<p class="petit-gris" style="margin-top:0">${abr(m.ext)} : ${pluriel(v[m.ext], "victoire")} · ${abr(m.dom)} : ${pluriel(v[m.dom], "victoire")}</p>` : ""}
    <div class="liste-cal">${autres.map(ligneNeutre).join("")}</div>`;
}
function corpsAvantMatch(m) {
  const eqs = [m.ext, m.dom], b = eqs.map(bilan), r = eqs.map(rangDe);
  const ligneComp = (titre, a, d) => `<tr><td>${a}</td><th>${titre}</th><td>${d}</td></tr>`;
  const moy = (t, k) => (t && t.pj ? dec(t[k] / t.pj) : "–");
  let h = `<h3>Face à face</h3><table class="table-face"><thead><tr><th>${abr(m.ext)}</th><th></th><th>${abr(m.dom)}</th></tr></thead><tbody>
    ${ligneComp("Rang dans la ligue", r[0] ? ieme(r[0].ligueRang) : "–", r[1] ? ieme(r[1].ligueRang) : "–")}
    ${ligneComp("Points", r[0]?.t.pts ?? "–", r[1]?.t.pts ?? "–")}
    ${ligneComp("Fiche (V-D-DP)", fmtBilan(b[0].tous), fmtBilan(b[1].tous))}
    ${ligneComp("Buts pour par match", moy(r[0]?.t, "bp"), moy(r[1]?.t, "bp"))}
    ${ligneComp("Buts contre par match", moy(r[0]?.t, "bc"), moy(r[1]?.t, "bc"))}
    ${ligneComp("Sur la route / à domicile", fmtBilan(b[0].ext), fmtBilan(b[1].dom))}
    ${ligneComp("10 derniers matchs", fmtBilan(b[0].dix), fmtBilan(b[1].dix))}
    ${ligneComp("Séquence", serieFr(r[0]?.t.serie), serieFr(r[1]?.t.serie))}
  </tbody></table>
  <h3>Forme récente</h3><div class="deux-col">${eqs.map((eq) => `<div class="col-equipe"><h4>${echapper(nomEq(eq))}</h4>${pastillesForme(eq, 5)}</div>`).join("")}</div>`;
  // Joueurs à surveiller : les meilleurs pointeurs de chaque équipe
  h += `<h3>Joueurs à surveiller</h3><div class="deux-col">${eqs.map((eq) => {
    const top = D.joueurs.filter((j) => j.eq === eq && j.s).sort((a, c) => c.s.pts - a.s.pts || c.s.b - a.s.b).slice(0, 3);
    const g = D.joueurs.filter((j) => j.eq === eq && j.g && j.g.pj).sort((a, c) => c.g.pj - a.g.pj)[0];
    return `<div class="col-equipe"><h4>${echapper(nomEq(eq))}</h4><ul class="liste-simple">${top.map((j) => `<li data-fiche="${j.id}"><span>${echapper(j.nom)}${favoris.includes(j.id) ? " ⭐" : ""}</span><b>${j.s.pts} PTS</b></li>`).join("") || `<li class="vide">Stats à venir.</li>`}
      ${g ? `<li class="gardien" data-fiche="${g.id}"><span>🧤 ${echapper(g.nom)}</span><b>${pct3(g.g.pct)}</b></li>` : ""}</ul></div>`;
  }).join("")}</div>`;
  const miens = favorisObjets().filter((j) => j.eq === m.dom || j.eq === m.ext);
  if (miens.length) h += `<h3>Tes favoris dans ce match</h3><div class="soir-joueurs">${miens.map((j) => `<button class="puce-joueur chaud" data-fiche="${j.id}">⭐ ${echapper(j.nom)}</button>`).join("")}</div>`;
  h += htmlFaceAFace(m);
  return h;
}

// ---- C. Fiche d'une équipe ------------------------------------
async function ouvrirEquipe(eq, opt = {}) {
  await charger(ligDeId(eq)).catch(() => {});
  if (!D.equipes[eq]) return toast("Cette équipe n'a pas été trouvée.");
  noterModale({ t: "equipe", id: eq, retour: opt.retour });
  const lig = ligueDe(eq), b = bilan(eq), r = rangDe(eq), t = r?.t;
  const ms = matchsDe(eq);
  const derniers = ms.filter((m) => estFini(m) || estDirect(m)).slice(-5).reverse();
  const prochains = ms.filter((m) => !estFini(m) && !estDirect(m) && m.date >= AUJ).slice(0, 5);
  const effectif = D.joueurs.filter((j) => j.eq === eq);
  const diff = t ? t.bp - t.bc : 0;
  const tuile = (val, lib) => `<div class="tuile"><b>${val}</b><small>${lib}</small></div>`;
  const e = D.equipes[eq];
  let h = `<div class="fiche-haut equipe-haut">${boutonRetour()}<span class="numero equipe-pastille">${abr(eq)}</span>
    <div><h2>${echapper(nomEq(eq))}</h2><p><span class="tag-ligue petit">${LIGUES[lig].nom}</span> ${[e.conf, e.div].filter((x, i, a) => x && a.indexOf(x) === i && x !== LIGUES[lig].nom).map(echapper).join(" · ")}</p>
      <p class="fiche-boutons">        <button class="btn fantome" data-partager="equipe/${eq}" data-titre="${echapper(nomEq(eq))} · MonTrioHockey">↗ Partager</button></p></div>
    <button class="fermer" aria-label="Fermer">✕</button></div><div class="fiche-corps">`;
  h += `<div class="tuiles">
    ${tuile(r ? ieme(r.ligueRang) : "–", `rang · ${LIGUES[lig].nom}`)}
    ${r?.groupe ? tuile(ieme(r.groupeRang), echapper(r.groupe.replace(/^Association de l'|^Division /, ""))) : ""}
    ${tuile(t?.pts ?? "–", "points")}${tuile(fmtBilan(b.tous), "fiche V-D-DP")}
    ${tuile(`${diff > 0 ? "+" : ""}${diff}`, `diff. (${t?.bp ?? 0} BP, ${t?.bc ?? 0} BC)`)}
    ${tuile(fmtBilan(b.dom), "à domicile")}${tuile(fmtBilan(b.ext), "à l'étranger")}${tuile(serieFr(t?.serie), "séquence")}
    ${t?.av != null ? tuile(pctFr(t.av), "avantage numérique") : ""}${t?.dn != null ? tuile(pctFr(t.dn), "désavantage numérique") : ""}
    ${t?.tpm != null ? tuile(dec(t.tpm, 1), "tirs par match") : ""}${t?.tcm != null ? tuile(dec(t.tcm, 1), "tirs accordés par match") : ""}
    ${t?.mj != null ? tuile(pctFr(t.mj), "mises au jeu gagnées") : ""}</div>`;
  h += `<h3>10 derniers matchs <small class="sous-titre">${fmtBilan(b.dix)}</small></h3>${pastillesForme(eq, 10)}`;
  // Meneurs de l'équipe
  const pat = effectif.filter((j) => j.s && j.s.pj).sort((a, c) => c.s.pts - a.s.pts || c.s.b - a.s.b);
  const gar = effectif.filter((j) => j.g && j.g.pj).sort((a, c) => (c.g.pct ?? 0) - (a.g.pct ?? 0) || c.g.pj - a.g.pj);
  if (pat.length || gar.length) {
    h += `<h3>Meneurs de l'équipe</h3><div class="deux-col"><div><h4 class="mini-titre">Points</h4><ol class="meneurs">${htmlMeneurs(pat.slice(0, 5), (j) => j.s.pts)}</ol></div>
      <div><h4 class="mini-titre">Gardiens · % d'arrêts</h4><ol class="meneurs">${gar.length ? htmlMeneurs(gar.slice(0, 3), (j) => pct3(j.g.pct)) : `<li class="vide">Stats à venir.</li>`}</ol></div></div>`;
  }
  h += `<div class="deux-col"><div><h3>Derniers résultats</h3><div class="liste-cal">${derniers.map((m) => ligneMatchCourte(m, eq)).join("") || `<p class="vide">Aucun match joué.</p>`}</div></div>
    <div><h3>Prochains matchs</h3><div class="liste-cal">${prochains.map((m) => ligneMatchCourte(m, eq)).join("") || `<p class="vide">Aucun match à venir.</p>`}</div></div></div>`;
  // Effectif complet avec stats
  if (effectif.length) {
    const groupesPos = [["Attaquants", (j) => ["C", "AG", "AD", "AV"].includes(j.pos)], ["Défenseurs", (j) => j.pos === "D"], ["Gardiens", (j) => j.pos === "G"]];
    h += `<h3>Effectif <small class="sous-titre">${pluriel(effectif.length, "joueur")}</small></h3>`;
    for (const [titre, f] of groupesPos) {
      const liste = effectif.filter(f).sort((a, c) => (c.s?.pts ?? c.g?.pj ?? 0) - (a.s?.pts ?? a.g?.pj ?? 0));
      if (!liste.length) continue;
      const gardiens = titre === "Gardiens";
      h += `<details class="feuille-equipe" ${titre === "Attaquants" ? "open" : ""}><summary>${titre} <small>${liste.length}</small></summary><div class="defile"><table class="tableau journal feuille"><thead><tr><th>Joueur</th><th>N°</th>
        ${gardiens ? "<th>PJ</th><th>V</th><th>D</th><th>Moy.</th><th>% arr.</th>" : "<th>PJ</th><th>B</th><th>A</th><th>PTS</th><th>+/-</th>"}<th></th></tr></thead><tbody>
        ${liste.map((j) => `<tr data-fiche="${j.id}"><td>${echapper(j.nom)}</td><td>${j.no ?? "–"}</td>${gardiens
          ? `<td>${j.g?.pj ?? 0}</td><td>${j.g?.v ?? 0}</td><td>${j.g?.d ?? 0}</td><td>${dec(j.g?.moy)}</td><td>${pct3(j.g?.pct)}</td>`
          : `<td>${j.s?.pj ?? 0}</td><td>${j.s?.b ?? 0}</td><td>${j.s?.a ?? 0}</td><td class="pts">${j.s?.pts ?? 0}</td><td>${signe(j.s?.pm ?? 0)}</td>`}
          <td>${favoris.includes(j.id) ? "⭐" : `<button class="mini-plus" data-ajouter="${j.id}" aria-label="Ajouter ${echapper(j.nom)} à mes favoris">+</button>`}</td></tr>`).join("")}</tbody></table></div></details>`;
    }
    h += `<p class="petit-gris">Touche un joueur pour voir sa fiche, ou <b>+</b> pour l'ajouter à tes favoris.</p>`;
  }
  montrerModale(h + "</div>");
}

// ---- D. Forme récente -----------------------------------------
// Pour chaque joueur : ses stats dans les 5 derniers matchs de son équipe,
// et sa séquence de matchs consécutifs avec au moins un point.
const formeCache = {};
async function formeLigue(lig) {
  const cle = `${lig}|${D.cal.length}|${matchsLigue(lig).filter(estFini).length}`;
  if (formeCache[lig]?.cle === cle) return formeCache[lig].res;
  const eqs = Object.keys(D.equipes).filter((e) => ligueDe(e) === lig);
  const res = new Map();
  await Promise.all(eqs.map(async (eq) => {
    const pts = await points(eq);
    const finis = matchsDe(eq).filter((m) => estFini(m) && pts[m.id]);
    const cinq = finis.slice(-5);
    for (const j of D.joueurs.filter((x) => x.eq === eq)) {
      const f = { j, pj: 0, b: 0, a: 0, pts: 0, sv: 0, sa: 0, sequence: 0 };
      for (const m of cinq) {
        const l = pts[m.id][j.id]; if (!l) continue;
        f.pj++;
        if (estGardienLigne(l)) { f.sv += l[1]; f.sa += l[2]; } else { f.b += l[0]; f.a += l[1]; f.pts += l[0] + l[1]; }
      }
      // Séquence : en partant du dernier match joué par le joueur
      if (!LIGUES[lig].pointsSeulement && j.pos !== "G") {
        for (let i = finis.length - 1; i >= 0; i--) {
          const l = pts[finis[i].id][j.id];
          if (!l) continue; // n'a pas joué ce match
          if (ptsLigne(l) > 0) f.sequence++; else break;
        }
      }
      res.set(j.id, f);
    }
  }));
  formeCache[lig] = { cle, res };
  return res;
}
const htmlChauds = (liste, val, detail) => liste.length ? liste.map((f) => `<li data-fiche="${f.j.id}">
  <span class="nom">${echapper(f.j.nom)}${favoris.includes(f.j.id) ? " ⭐" : ""}<small>${echapper(courtEq(f.j.eq))} · ${detail(f)}</small></span><span class="val">${val(f)}</span></li>`).join("") : `<li class="vide">À venir.</li>`;
let jetonChauds = 0;
async function rendreChauds() {
  const jeton = ++jetonChauds, lig = ligue;
  if (LIGUES[lig].sansJoueurs) { $("mini-chauds").innerHTML = `<li class="vide">À venir.</li>`; return; }
  const f = [...(await formeLigue(lig)).values()];
  if (jeton !== jetonChauds) return;
  const chauds = f.filter((x) => x.j.pos !== "G" && x.pts > 0).sort((a, b) => b.pts - a.pts || b.b - a.b || a.pj - b.pj);
  const detailPts = (x) => `${x.b} B, ${x.a} A en ${pluriel(x.pj, "match")}`;
  $("mini-chauds").innerHTML = htmlChauds(chauds.slice(0, 5), (x) => x.pts, detailPts);
  const bloc = $("bloc-chauds");
  if (!bloc) return;
  const seq = f.filter((x) => x.sequence >= 3).sort((a, b) => b.sequence - a.sequence || b.j.s.pts - a.j.s.pts);
  const gar = f.filter((x) => x.j.pos === "G" && x.pj >= 2 && x.sa > 0).sort((a, b) => b.sv / b.sa - a.sv / a.sa);
  bloc.innerHTML = `
    <section class="bloc bloc-feu"><div class="titre-section"><h2>🔥 En feu <span class="tag-ligue">${LIGUES[lig].nom}</span></h2><span class="sur-titre">5 derniers matchs</span></div><ol class="meneurs">${htmlChauds(chauds.slice(0, 10), (x) => x.pts, detailPts)}</ol></section>
    ${LIGUES[lig].pointsSeulement ? "" : `<section class="bloc"><div class="titre-section"><h2>Séquences de points <span class="tag-ligue">${LIGUES[lig].nom}</span></h2><span class="sur-titre">En cours</span></div><ol class="meneurs">${htmlChauds(seq.slice(0, 10), (x) => x.sequence, (x) => `${x.sequence} matchs de suite`)}</ol></section>`}
    ${f.some((x) => x.j.pos === "G") ? "" : "<!--"}<section class="bloc"><div class="titre-section"><h2>Gardiens en forme <span class="tag-ligue">${LIGUES[lig].nom}</span></h2><span class="sur-titre">5 derniers matchs</span></div><ol class="meneurs">${htmlChauds(gar.slice(0, 10), (x) => pct3(x.sv / x.sa), (x) => `${x.sv} arrêts sur ${x.sa} en ${pluriel(x.pj, "match")}`)}</ol></section>${f.some((x) => x.j.pos === "G") ? "" : "-->"}`;
}
// Forme récente dans la fiche d'un joueur
async function htmlFormeJoueur(j) {
  if (!j.lig || LIGUES[j.lig].sansJoueurs) return "";
  const f = (await formeLigue(j.lig)).get(j.id);
  if (!f || !f.pj) return "";
  const txt = j.pos === "G" ? `${f.sv} arrêts sur ${f.sa} (${f.sa ? pct3(f.sv / f.sa) : "–"})` : `${f.b} B, ${f.a} A, <b>${f.pts} PTS</b>`;
  return `<div class="forme-joueur ${f.pts >= 5 ? "feu" : ""}"><span>${f.pts >= 5 ? "🔥 " : ""}5 derniers matchs de l'équipe</span><strong>${txt}</strong>${f.sequence >= 3 ? `<span class="sequence">Séquence de ${f.sequence} matchs avec un point</span>` : ""}</div>`;
}
// La page Meneurs reçoit 3 nouveaux blocs, et un classement aux points par match
// La page Meneurs, en onglets pour ne pas s'y perdre : Saison, En forme, Stats avancées, Recrues
let ongletMeneurs = memoire("onglet-meneurs") || "saison";
const mmss = (sec) => (sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}` : "–");
const pctFr = (x, n = 1) => (x == null || isNaN(x) ? "–" : `${(x * 100).toFixed(n).replace(".", ",")} %`);
rendreMeneurs = function () {
  const lig = ligue, nom = LIGUES[lig].nom, tous = joueursLigue();
  $("mini-meneurs").innerHTML = htmlMeneurs(listeMeneurs(5, patineur, (j) => j.s.pts), (j) => j.s.pts);
  const maxPj = Math.max(1, ...(D.classement[lig] || []).map((t) => t.pj));
  const minPj = Math.max(1, Math.ceil(maxPj / 2)), minG = Math.max(Math.min(2, maxPj), Math.ceil(maxPj / 3));
  const gardien = (j) => j.g && j.g.pj >= minG;
  const bloc = (titre, liste, aff, sous = "") => `<section class="bloc"><div class="titre-section"><h2>${titre} <span class="tag-ligue">${nom}</span></h2>${sous ? `<span class="sur-titre">${sous}</span>` : ""}</div><ol class="meneurs">${htmlMeneurs(liste, aff)}</ol></section>`;
  const avecAvancees = tous.some((j) => j.s && j.s.tirs != null), avecRecrues = tous.some((j) => j.r);
  const onglets = [["saison", "Saison"], ["forme", "🔥 En forme"], avecAvancees && ["avancees", "Stats avancées"], avecRecrues && ["recrues", "Recrues"]].filter(Boolean);
  const onglet = onglets.some(([k]) => k === ongletMeneurs) ? ongletMeneurs : "saison"; // le choix est gardé pour les autres ligues
  const avecGardiens = tous.some((j) => j.g);
  let h = `<div class="onglets meneurs-onglets" role="tablist">${onglets.map(([k, t]) => `<button class="onglet ${k === onglet ? "actif" : ""}" data-onglet-meneurs="${k}" role="tab" aria-selected="${k === onglet}">${t}</button>`).join("")}</div>`;
  if (onglet === "saison") {
    h += bloc("Points", listeMeneurs(15, patineur, (j) => j.s.pts), (j) => j.s.pts)
      + bloc("Buts", listeMeneurs(15, patineur, (j) => j.s.b), (j) => j.s.b)
      + bloc("Passes", listeMeneurs(15, patineur, (j) => j.s.a), (j) => j.s.a)
      + bloc("Points par match", listeMeneurs(10, (j) => j.s && j.s.pj >= minPj, (j) => j.s.pts / j.s.pj), (j) => dec(j.s.pts / j.s.pj), `min. ${pluriel(minPj, "match")}`)
      + bloc("Différentiel", listeMeneurs(10, patineur, (j) => j.s.pm), (j) => signe(j.s.pm))
      + (avecGardiens ? bloc("Gardiens · Victoires", listeMeneurs(10, gardien, (j) => j.g.v), (j) => j.g.v)
      + bloc("Gardiens · % d'arrêts", listeMeneurs(10, (j) => gardien(j) && j.g.pct != null, (j) => j.g.pct), (j) => pct3(j.g.pct), `min. ${pluriel(minG, "match")}`)
      + bloc("Gardiens · Moyenne", listeMeneurs(10, (j) => gardien(j) && j.g.moy != null, (j) => -j.g.moy), (j) => dec(j.g.moy), "buts accordés par match") : "");
  } else if (onglet === "forme") {
    h += `<div id="bloc-chauds" class="bloc-chauds"></div>`;
  } else if (onglet === "avancees") {
    const minTirs = Math.max(5, Math.ceil(maxPj * 1.5));
    const av = (j) => j.s && j.s.pj > 0 && j.s.tirs != null;
    h += bloc("Tirs au but", listeMeneurs(10, av, (j) => j.s.tirs), (j) => j.s.tirs)
      + bloc("% de tirs", listeMeneurs(10, (j) => av(j) && j.s.tirs >= minTirs, (j) => j.s.b / j.s.tirs), (j) => pctFr(j.s.b / j.s.tirs), `min. ${minTirs} tirs`)
      + (tous.some((j) => j.s?.bav != null) ? bloc("Buts en avantage numérique", listeMeneurs(10, (j) => av(j) && j.s.bav > 0, (j) => j.s.bav), (j) => j.s.bav) : "")
      + (tous.some((j) => j.s?.bg != null) ? bloc("Buts gagnants", listeMeneurs(10, (j) => av(j) && j.s.bg > 0, (j) => j.s.bg), (j) => j.s.bg) : "")
      + (tous.some((j) => j.s?.bin != null) ? bloc("Buts en infériorité numérique", listeMeneurs(10, (j) => av(j) && j.s.bin > 0, (j) => j.s.bin), (j) => j.s.bin) : "")
      + (tous.some((j) => j.s?.tg) ? bloc("Temps de glace moyen", listeMeneurs(10, (j) => av(j) && j.s.tg && j.s.pj >= minPj, (j) => j.s.tg), (j) => mmss(j.s.tg), "par match") : "")
      + (tous.some((j) => j.s?.mj != null) ? bloc("Mises au jeu gagnées", listeMeneurs(10, (j) => av(j) && j.s.mj != null && ["C", "AV"].includes(j.pos) && j.s.pj >= Math.max(3, minPj) && j.s.mj > 0 && j.s.mj < 1, (j) => j.s.mj), (j) => pctFr(j.s.mj), "centres") : "")
      + (tous.some((j) => j.g?.bl != null) ? bloc("Gardiens · Blanchissages", listeMeneurs(10, (j) => j.g && j.g.bl > 0, (j) => j.g.bl), (j) => j.g.bl) : "");
  } else if (onglet === "recrues") {
    const rec = (j) => j.r && j.s && j.s.pj > 0;
    h += `<p class="aide meneurs-aide">Les joueurs qui jouent leur première saison dans ${laLigue(lig)}.</p>`
      + bloc("Recrues · Points", listeMeneurs(15, rec, (j) => j.s.pts), (j) => j.s.pts)
      + bloc("Recrues · Buts", listeMeneurs(10, (j) => rec(j) && j.s.b > 0, (j) => j.s.b), (j) => j.s.b)
      + (avecGardiens ? bloc("Recrues · Gardiens", listeMeneurs(10, (j) => j.r && gardien(j) && j.g.pct != null, (j) => j.g.pct), (j) => pct3(j.g.pct), `% d'arrêts · min. ${pluriel(minG, "match")}`) : "");
  }
  $("grille-meneurs").innerHTML = h;
  rendreChauds();
};
$("grille-meneurs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-onglet-meneurs]");
  if (!b) return;
  ongletMeneurs = b.dataset.ongletMeneurs; memoire("onglet-meneurs", ongletMeneurs); rendreMeneurs();
});
// Stats avancées dans la fiche d'un joueur
function htmlStatsAvancees(j) {
  const s = j.s, g = j.g, t = (val, lib) => `<div class="tuile"><b>${val}</b><small>${lib}</small></div>`;
  const nb = (n, sing, plur) => t(n, n > 1 ? plur : sing);
  if (g) return g.bl ? `<div class="tuiles petites">${nb(g.bl, "blanchissage", "blanchissages")}</div>` : "";
  if (!s) return "";
  let h = t(signe(s.pm), "différentiel");
  if (s.tirs != null) h += nb(s.tirs, "tir", "tirs") + (s.tirs >= 5 ? t(pctFr(s.b / s.tirs), "% de tirs") : "");
  if (s.bav != null) h += t(s.bav, s.bav > 1 ? "buts en AN" : "but en AN");
  if (s.bg != null) h += nb(s.bg, "but gagnant", "buts gagnants");
  if (s.tg) h += t(mmss(s.tg), "temps de glace moyen");
  if (s.mj != null && s.mj > 0 && s.mj < 1 && s.pj >= 3 && ["C", "AV"].includes(j.pos)) h += t(pctFr(s.mj), "mises au jeu gagnées");
  if (s.pun != null) h += t(s.pun, s.pun > 1 ? "minutes de punition" : "minute de punition");
  return `<div class="tuiles petites">${h}</div>`;
}

// ---- D bis. Course aux séries et tableau des séries (LNH) -------
let seriesLnh;
const QUALIF = { x: "Qualifié", y: "Champion de division", z: "Champion d'association", p: "Meilleur de la ligue", e: "Éliminé" };
const RONDES = { 1: "1re ronde", 2: "2e ronde", 3: "Finales d'association", 4: "Finale de la Coupe Stanley" };
function ligneCourse(t, rang, eqs) {
  const b = bilan(t.eq), diff = t.bp - t.bc;
  return `<tr class="${eqs.includes(t.eq) ? "favori" : ""} ${t.q === "e" ? "elimine" : ""}"><td>${rang}</td>
    <td class="eq"><button class="lien-equipe" data-equipe-fiche="${t.eq}"><span class="abr">${abr(t.eq)}</span> <span class="nom-long">${echapper(courtEq(t.eq))}</span></button>${t.q && QUALIF[t.q] ? ` <span class="qualif q-${t.q}" title="${QUALIF[t.q]}">${t.q === "e" ? "É" : "✓"}</span>` : ""}</td>
    <td>${t.pj}</td><td class="pts">${t.pts}</td><td>${fmtBilan([t.v, t.d, t.dp])}</td><td class="large">${t.vr ?? "–"}</td>
    <td class="${diff > 0 ? "plus" : diff < 0 ? "moins" : ""}">${signe(diff)}</td><td class="large">${fmtBilan(b.dix)}</td><td class="large">${serieFr(t.serie)}</td></tr>`;
}
const teteCourse = `<thead><tr><th>#</th><th>Équipe</th><th>PJ</th><th>PTS</th><th>V-D-DP</th><th class="large">VR</th><th>Diff</th><th class="large">10 dern.</th><th class="large">Série</th></tr></thead>`;
function htmlCourse(c) {
  const eqs = equipesFavorites();
  const parRang = (l, k) => [...l].sort((a, b) => (a[k] ?? 99) - (b[k] ?? 99) || b.pts - a.pts || a.pj - b.pj || (b.vr ?? 0) - (a.vr ?? 0) || b.v - a.v);
  let h = "", affiches = "";
  for (const conf of groupes(c, "conf")) {
    const eqConf = c.filter((t) => t.conf === conf);
    const divs = groupes(eqConf, "div");
    const tetes = {};
    h += `<div class="table-bloc"><h3>${echapper(conf)}</h3><div class="defile"><table class="tableau course">${teteCourse}<tbody>`;
    for (const d of divs) {
      const top = parRang(eqConf.filter((t) => t.div === d), "rd").slice(0, 3);
      tetes[d] = top;
      h += `<tr class="sous-tete"><td colspan="9">${echapper(d)}</td></tr>${top.map((t, i) => ligneCourse(t, i + 1, eqs)).join("")}`;
    }
    const pris = new Set(Object.values(tetes).flat().map((t) => t.eq));
    const wc = parRang(eqConf.filter((t) => !pris.has(t.eq)), "rw");
    h += `<tr class="sous-tete"><td colspan="9">Meilleures 2es places (2 places)</td></tr>${wc.map((t, i) => ligneCourse(t, `${i + 1}`, eqs).replace("<tr class=\"", `<tr class="${i === 2 ? "coupure " : ""}`)).join("")}`;
    h += `</tbody></table></div></div>`;
    // Si les séries commençaient aujourd'hui
    const [d1, d2] = divs;
    if (d1 && d2 && wc.length >= 2 && tetes[d1].length >= 3 && tetes[d2].length >= 3) {
      const [m1, m2] = [tetes[d1][0], tetes[d2][0]].sort((a, b) => b.pts - a.pts || a.pj - b.pj || (b.vr ?? 0) - (a.vr ?? 0) || b.v - a.v || (b.bp - b.bc) - (a.bp - a.bc));
      const duel = (a, b, ra, rb) => `<div class="duel"><button data-equipe-fiche="${a.eq}"><small>${ra}</small><b>${abr(a.eq)}</b></button><span>vs</span><button data-equipe-fiche="${b.eq}"><b>${abr(b.eq)}</b><small>${rb}</small></button></div>`;
      affiches += `<div class="affiches-conf"><h4>${echapper(conf)}</h4>
        ${duel(m1, wc[1], "1re div.", "2e meill. 2e")}${duel(tetes[m1.div][1], tetes[m1.div][2], "2e div.", "3e div.")}
        ${duel(m2, wc[0], "1re div.", "1re meill. 2e")}${duel(tetes[m2.div][1], tetes[m2.div][2], "2e div.", "3e div.")}</div>`;
    }
  }
  return `${affiches ? `<div class="table-bloc"><h3>Si les séries commençaient aujourd'hui</h3><div class="affiches">${affiches}</div></div>` : ""}${h}
    <p class="petit-gris">Format de la LNH : les 3 premiers de chaque division et les 2 meilleures équipes parmi les autres (les « meilleures 2es places ») de chaque association font les séries. La ligne pointillée marque la limite. VR : victoires en temps réglementaire (premier critère en cas d'égalité). ✓ : place assurée · É : éliminé.</p>`;
}
function htmlTableauSeries(series) {
  const carte = (x) => {
    const eq = (e, gagne) => e.eq ? `<button class="sc-eq ${x.gagnant && !gagne ? "perd" : ""}" data-equipe-fiche="${e.eq}"><small>${e.rang}</small><b>${abr(e.eq)}</b><span>${echapper(courtEq(e.eq))}</span><i>${e.v}</i></button>` : `<div class="sc-eq vide"><b>À déterminer</b></div>`;
    return `<div class="serie-carte">${eq(x.haut, x.gagnant === x.haut.eq)}${eq(x.bas, x.gagnant === x.bas.eq)}</div>`;
  };
  const rondes = [...new Set(series.map((x) => x.ronde))].sort();
  return `<div class="table-bloc"><h3>Séries éliminatoires</h3><div class="tableau-series">${rondes.map((r) => `<div class="ronde"><h4>${RONDES[r] || `Ronde ${r}`}</h4>${series.filter((x) => x.ronde === r).map(carte).join("")}</div>`).join("")}</div></div>`;
}
// ---- Classement : stats d'équipe (triables) ----------------------
let triStats = { col: "pts", sens: -1 };
function rendreStatsEquipes() {
  const c = D.classement[ligue] || [];
  const par = (t, k) => (t.pj ? t[k] / t.pj : null);
  const cols = [
    ["pts", "PTS", (t) => t.pts, (v) => v],
    ["bpm", "BP/m", (t) => par(t, "bp"), (v) => dec(v)],
    ["bcm", "BC/m", (t) => par(t, "bc"), (v) => dec(v), true],
    ["av", "AN %", (t) => t.av, (v) => pctFr(v)],
    ["dn", "DN %", (t) => t.dn, (v) => pctFr(v)],
    ["tpm", "Tirs/m", (t) => t.tpm, (v) => dec(v, 1)],
    ["tcm", "Tirs c./m", (t) => t.tcm, (v) => dec(v, 1), true],
    ["mj", "MAJ %", (t) => t.mj, (v) => pctFr(v)],
  ].filter(([k, , f]) => c.some((t) => f(t) != null));
  const col = cols.find((x) => x[0] === triStats.col) || cols[0];
  const liste = [...c].sort((a, b) => ((col[2](b) ?? -1e9) - (col[2](a) ?? -1e9)) * (triStats.sens < 0 ? 1 : -1));
  const eqs = equipesFavorites();
  $("tables-classement").innerHTML = `<div class="table-bloc"><h3>Stats d'équipe · ${LIGUES[ligue].nom}</h3><div class="defile"><table class="tableau stats-eq"><thead><tr><th>#</th><th>Équipe</th><th>PJ</th>
    ${cols.map(([k, t]) => `<th><button class="tri ${k === col[0] ? "actif" : ""}" data-tri="${k}">${t}${k === col[0] ? (triStats.sens < 0 ? " ▼" : " ▲") : ""}</button></th>`).join("")}</tr></thead><tbody>
    ${liste.map((t, i) => `<tr class="${eqs.includes(t.eq) ? "favori" : ""}"><td>${i + 1}</td><td class="eq"><button class="lien-equipe" data-equipe-fiche="${t.eq}"><span class="abr">${abr(t.eq)}</span> <span class="nom-long">${echapper(courtEq(t.eq))}</span></button></td><td>${t.pj}</td>
      ${cols.map(([k, , f, fmt]) => `<td class="${k === col[0] ? "pts" : ""}">${f(t) == null ? "–" : fmt(f(t))}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>
    <p class="petit-gris">Touche un titre de colonne pour trier. BP/m, BC/m : buts pour et contre par match · AN : avantage numérique (% des occasions converties) · DN : désavantage numérique (% des pénalités écoulées sans but) · Tirs c./m : tirs accordés par match · MAJ : mises au jeu gagnées.</p>`;
}
$("tables-classement").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tri]");
  if (!b) return;
  triStats = { col: b.dataset.tri, sens: triStats.col === b.dataset.tri ? -triStats.sens : -1 };
  rendreStatsEquipes();
});

async function rendreSeries() {
  if (seriesLnh === undefined) seriesLnh = matchsLigue("lnh").some((m) => m.series) ? await lireJson("data/series.json").catch(() => null) : null;
  if (vueClassement !== "series" || ligue !== "lnh") return;
  $("tables-classement").innerHTML = (seriesLnh?.length ? htmlTableauSeries(seriesLnh) : "") + htmlCourse(D.classement.lnh || []);
}

// ---- E. Comparateur de joueurs --------------------------------
async function ouvrirComparaison(idA, idB, opt = {}) {
  await Promise.all([charger(ligDeId(idA)), idB ? charger(ligDeId(idB)) : null].map((p) => p && p.catch(() => {})));
  const A = joueur(idA);
  if (!A) return;
  noterModale({ t: "comparer", id: A.id, id2: idB, retour: opt.retour });
  const B = idB ? joueur(idB) : null;
  const haut = (titre) => `<div class="fiche-haut">${boutonRetour()}<div><h2>${titre}</h2><p>Compare deux joueurs de n'importe quelle ligue.</p></div><button class="fermer" aria-label="Fermer">✕</button></div>`;
  if (!B) {
    montrerModale(haut(`Comparer ${echapper(A.nom)}`) + `<div class="fiche-corps">
      <label class="aide" for="comp-recherche">Avec qui veux-tu comparer <b>${echapper(A.nom)}</b>?</label>
      <input id="comp-recherche" class="champ" type="search" placeholder="Tape un nom… ex. Caufield, Demidov" autocomplete="off">
      <ul id="comp-resultats" class="resultats"></ul></div>`);
    chargerTout().then(() => rendreChoixComp(A));
    $("comp-recherche").addEventListener("input", () => rendreChoixComp(A));
    rendreChoixComp(A);
    setTimeout(() => $("comp-recherche")?.focus(), 50);
    return;
  }
  const [fA, fB] = await Promise.all([A, B].map(async (j) => (j.lig ? (await formeLigue(j.lig)).get(j.id) : null)));
  const ligne = (titre, a, b, fmt = (x) => x, inverse = false) => {
    if (a == null && b == null) return "";
    const ok = a != null && b != null, na = Number(a) || 0, nb = Number(b) || 0;
    const bas = Math.min(0, na, nb), haut = Math.max(na, nb) - bas || 1; // les barres partent du plus petit (ex. différentiel négatif)
    const larg = (v, x) => (x == null ? 0 : Math.max(4, ((v - bas) / haut) * 100));
    const mA = ok && (inverse ? na < nb : na > nb), mB = ok && (inverse ? nb < na : nb > na);
    return `<div class="cmp-ligne"><div class="cmp-val ${mA ? "fort" : ""}"><span>${a == null ? "–" : fmt(a)}</span><i style="width:${larg(na, a)}%"></i></div>
      <small>${titre}</small><div class="cmp-val droite ${mB ? "fort" : ""}"><i style="width:${larg(nb, b)}%"></i><span>${b == null ? "–" : fmt(b)}</span></div></div>`;
  };
  const tete = (j) => `<button class="cmp-joueur" data-fiche="${j.id}"><span class="numero">${j.no ?? "–"}</span><strong>${echapper(j.nom)}</strong>
    <small>${etiquetteLigue(j)} ${NOMS_POS[j.pos] || j.pos} · ${echapper(courtEq(j.eq))}</small></button>`;
  let lignes = "";
  if (A.g && B.g) {
    lignes = ligne("Matchs joués", A.g.pj, B.g.pj) + ligne("Victoires", A.g.v, B.g.v) + ligne("Moyenne de buts", A.g.pj ? A.g.moy : null, B.g.pj ? B.g.moy : null, dec, true)
      + ligne("% d'arrêts", A.g.pj ? A.g.pct : null, B.g.pj ? B.g.pct : null, pct3) + ligne("% d'arrêts · 5 derniers", fA?.sa ? fA.sv / fA.sa : null, fB?.sa ? fB.sv / fB.sa : null, pct3);
  } else if (A.s && B.s) {
    const ppm = (s) => (s.pj ? s.pts / s.pj : 0), bpm = (s) => (s.pj ? s.b / s.pj : 0);
    lignes = ligne("Matchs joués", A.s.pj, B.s.pj) + ligne("Buts", A.s.b, B.s.b) + ligne("Passes", A.s.a, B.s.a) + ligne("Points", A.s.pts, B.s.pts)
      + ligne("Points par match", ppm(A.s), ppm(B.s), dec) + ligne("Buts par match", bpm(A.s), bpm(B.s), dec)
      + ligne("Différentiel", A.s.pm, B.s.pm, signe) + ligne("Points · 5 derniers matchs", fA?.pts ?? null, fB?.pts ?? null);
  } else lignes = `<p class="vide">On ne peut pas comparer un gardien et un joueur. Choisis deux gardiens ou deux joueurs.</p>`;
  const note = A.lig !== B.lig ? `<p class="note-fiche">Attention : ${echapper(nomDeFamille(A))} et ${echapper(nomDeFamille(B))} ne jouent pas dans la même ligue, alors les chiffres ne se comparent pas parfaitement.</p>` : "";
  montrerModale(haut("Comparaison") + `<div class="fiche-corps"><div class="cmp-tetes">${tete(A)}<span class="cmp-vs">VS</span>${tete(B)}</div>${note}<div class="cmp">${lignes}</div>
    <div class="fiche-outils"><button class="btn fantome" data-comparer="${A.id}">⇄ Changer de joueur</button>
    <button class="btn fantome" data-partager="comparer/${A.id}/${B.id}" data-titre="${echapper(nomDeFamille(A))} vs ${echapper(nomDeFamille(B))} · MonTrioHockey">↗ Partager</button></div></div>`);
}
function rendreChoixComp(A) {
  const champ = $("comp-recherche"), boite = $("comp-resultats");
  if (!champ || !boite) return;
  const q = simplifier(champ.value.trim());
  const memeType = (j) => (A.pos === "G") === (j.pos === "G");
  let liste;
  if (q.length < 2) {
    // Suggestions : les meilleurs de la même ligue, à la même position
    liste = D.joueurs.filter((j) => j.lig === A.lig && j.id !== A.id && memeType(j) && (j.s || j.g)).sort((a, b) => (b.s?.pts ?? b.g?.v ?? 0) - (a.s?.pts ?? a.g?.v ?? 0)).slice(0, 8);
  } else {
    liste = D.joueurs.filter((j) => j.id !== A.id && simplifier(j.nom).includes(q) && (j.s || j.g)).sort((a, b) => memeType(b) - memeType(a)).slice(0, 12);
  }
  boite.innerHTML = (q.length < 2 ? `<li class="aide">Suggestions :</li>` : "") + (liste.map((j) => `<li>${pastille(j)}<div class="infos" data-comparer-avec="${j.id}"><strong>${echapper(j.nom)}</strong><span>${etiquetteLigue(j)} ${NOMS_POS[j.pos] || j.pos} · ${echapper(courtEq(j.eq))}</span></div>
    <button class="btn accent" data-comparer-avec="${j.id}">Comparer</button></li>`).join("") || `<li class="vide">Aucun joueur trouvé.</li>`);
  boite.dataset.a = A.id;
}

// ---- F. Partage, alertes, lexique ----------------------
function toast(texte, duree = 4000) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = texte;
  while ($("toasts").children.length >= 2) $("toasts").firstElementChild.remove();
  $("toasts").appendChild(t);
  setTimeout(() => t.classList.add("part"), duree);
  setTimeout(() => t.remove(), duree + 400);
}
async function partager(chemin, titre) {
  // Joueurs, équipes et matchs ont leur propre petite page de partage (j/, e/, m/) :
  // l'aperçu dans Messenger, Discord ou un texto montre alors le bon nom et les bonnes stats.
  const [type, id, id2] = chemin.split("/");
  const joli = !id2 && cheminJoli(type, id);
  const url = new URL(joli || `#/${chemin}`, document.baseURI).href;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ title: titre, url }); return; }
    await navigator.clipboard.writeText(url);
    toast("Lien copié! Tu peux le coller dans un message.");
  } catch (e) { if (e.name !== "AbortError") prompt("Copie ce lien :", url); }
}
// Alertes de buts.
//  · Si le relais a les alertes activées (et le téléphone le permet) : de vraies notifications,
//    même quand MonTrioHockey est fermé (LNH : buts de tes joueurs et de tes équipes, résultat final).
//  · Sinon : un avis à l'écran pendant que MonTrioHockey est ouvert.
let alertesOn = memoire("alertes") === "1";
const vus = new Map();
let pushPossible = null; // null = pas encore vérifié
async function verifierPush() {
  if (pushPossible !== null) return pushPossible;
  pushPossible = false;
  if (!RELAIS || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try { pushPossible = !!(await (await fetch(`${RELAIS}/alertes/etat`, { cache: "no-store" })).json()).actif; }
  catch (e) { const r = pushPossible; pushPossible = null; return r; } // erreur réseau : on réessaiera plus tard
  return pushPossible;
}
const b64uVersOctets = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
function favorisLnh() {
  const fav = favorisObjets().filter((j) => j.lig === "lnh");
  return { joueurs: fav.map((j) => j.id).filter((id) => /^\d+$/.test(id)), equipes: [...new Set(fav.map((j) => j.eq))] };
}
async function abonnementPush(creer) {
  // On n'attend jamais plus de 4 secondes (ex. navigation privée sans « service worker »)
  const reg = await Promise.race([navigator.serviceWorker.getRegistration().then((r) => r || navigator.serviceWorker.ready), new Promise((r) => setTimeout(() => r(null), 4000))]);
  if (!reg) return null;
  let sub = await reg.pushManager.getSubscription();
  if (!sub && creer) {
    const { cle } = await (await fetch(`${RELAIS}/alertes/cle`)).json();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uVersOctets(cle) });
  }
  return sub;
}
async function synchroniserPush() {
  if (!alertesOn || !(await verifierPush())) return;
  try {
    const sub = await abonnementPush(false);
    if (!sub) return;
    const corps = JSON.stringify({ abonnement: sub.toJSON(), ...favorisLnh() });
    if (memoire("push-envoye") === corps) return; // rien de changé depuis la dernière fois
    const r = await fetch(`${RELAIS}/alertes/abonner`, { method: "POST", headers: { "Content-Type": "application/json" }, body: corps });
    if (r.ok) memoire("push-envoye", corps);
  } catch (e) {}
}
function rendreBoutonAlertes() {
  $("alertes").textContent = `🔔 Alertes de buts : ${alertesOn ? "oui" : "non"}`;
  $("alertes").classList.toggle("accent", alertesOn);
}
$("alertes").onclick = async () => {
  const activer = !alertesOn;
  const iPhoneNav = /iphone|ipad/i.test(navigator.userAgent) && !estInstallee();
  if (activer && "Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch (e) {} }
  alertesOn = activer; memoire("alertes", alertesOn ? "1" : "0"); rendreBoutonAlertes();
  if (activer && "Notification" in window && Notification.permission === "denied") toast("Les notifications sont bloquées pour ce site dans les réglages de ton navigateur ou de ton téléphone. Tu seras averti seulement pendant que MonTrioHockey est ouvert.", 9000);
  if (!activer) {
    memoire("push-envoye", "");
    try { const sub = await abonnementPush(false); if (sub) { await fetch(`${RELAIS}/alertes/desabonner`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ abonnement: sub.toJSON() }) }); await sub.unsubscribe(); } } catch (e) {}
    return toast("Alertes désactivées.");
  }
  if (await verifierPush() && "Notification" in window && Notification.permission === "granted") {
    try {
      await abonnementPush(true); await synchroniserPush();
      const { joueurs, equipes } = favorisLnh();
      return toast(joueurs.length ? `Alertes activées! Ton téléphone t'avertira quand tes favoris de la LNH marquent (${pluriel(equipes.length, "équipe")}), même si MonTrioHockey est fermé.` : "Alertes activées. Ajoute des joueurs de la LNH à tes favoris pour recevoir leurs buts.", 7000);
    } catch (e) {}
  }
  if (iPhoneNav) return toast("Sur iPhone, installe d'abord MonTrioHockey sur ton écran d'accueil pour recevoir des alertes même quand l'app est fermée. En attendant, tu seras averti pendant que MonTrioHockey est ouvert.", 9000);
  toast("Alertes activées : tu seras averti quand tes favoris marquent, tant que MonTrioHockey reste ouvert.");
};
// Quand les favoris changent, on prévient le relais (s'il envoie les alertes)
const ajouterBase = ajouter, retirerBase = retirer;
ajouter = function (id) { ajouterBase(id); synchroniserPush(); };
retirer = function (id) { retirerBase(id); synchroniserPush(); };
function avertir(titre, texte) {
  toast(`${titre} ${texte}`, 7000);
  if (document.hidden && "Notification" in window && Notification.permission === "granted") {
    // Si le relais envoie déjà les alertes au téléphone, on n'en ajoute pas une deuxième
    if (!pushPossible) try { new Notification(titre, { body: texte, icon: "icones/icone-192.png", tag: titre + texte }); } catch (e) {}
  }
}
async function verifierAlertes() {
  const favs = favorisObjets(), eqs = equipesFavorites();
  const actifs = D.cal.filter((m) => (estDirect(m) || (estFini(m) && m.date >= decaler(AUJ, -1))) && (eqs.includes(m.dom) || eqs.includes(m.ext)));
  for (const m of actifs) {
    const cle = `s${m.id}`, avant = vus.get(cle), score = `${m.se}-${m.sd}`;
    if (alertesOn && avant && avant !== score && estDirect(m)) avertir("🚨 But!", `${abr(m.ext)} ${m.se} – ${m.sd} ${abr(m.dom)}`);
    vus.set(cle, score);
    for (const j of favs.filter((x) => x.eq === m.dom || x.eq === m.ext)) {
      const l = (await points(j.eq))[m.id]?.[j.id];
      if (!l || estGardienLigne(l)) continue;
      const c = `${m.id}|${j.id}`, p = vus.get(c);
      if (alertesOn && p && (l[0] > p[0] || l[1] > p[1])) avertir(`⭐ ${j.nom}`, l[0] > p[0] ? "vient de marquer!" : "obtient une passe!");
      vus.set(c, [l[0], l[1]]);
    }
  }
}
// Lexique des abréviations
const LEXIQUE = [["PJ", "Parties (matchs) jouées"], ["B", "Buts"], ["A", "Passes (aides)"], ["PTS", "Points (buts + passes)"], ["+/-", "Différentiel : buts pour moins buts contre quand le joueur est sur la glace (à forces égales ou en infériorité)"],
  ["PUN", "Minutes de punition"], ["TG", "Temps de glace"], ["V", "Victoires"], ["D", "Défaites en temps réglementaire"], ["DP", "Défaites en prolongation ou en tirs de barrage (valent 1 point)"],
  ["(P)", "Match décidé en prolongation"], ["(TB)", "Match décidé en tirs de barrage"], ["BP / BC", "Buts pour / buts contre"], ["Diff", "Différence entre les buts pour et les buts contre"],
  ["Moy.", "Moyenne de buts accordés par match (gardiens)"], ["% arr.", "Pourcentage d'arrêts : arrêts divisés par les tirs reçus (.920 = 92 %)"], ["Déc.", "Décision du gardien : V, D ou DP"],
  ["Série", "Résultats de suite en cours (V3 = 3 victoires de suite, D2 = 2 défaites, DP1 = 1 défaite en prolongation)"], ["10 dern.", "Fiche des 10 derniers matchs (V-D-DP)"], ["Dom. / Ext.", "Fiche à domicile / à l'étranger"],
  ["3 étoiles", "Les meilleurs du match, choisis automatiquement par MonTrioHockey selon les stats"], ["En feu", "Les joueurs qui ont le plus de points dans les 5 derniers matchs de leur équipe"]];
function ouvrirLexique() {
  noterModale({ t: "lexique", id: "x" });
  montrerModale(`<div class="fiche-haut"><div><h2>Lexique</h2><p>Les abréviations du hockey, expliquées simplement.</p></div><button class="fermer" aria-label="Fermer">✕</button></div>
    <div class="fiche-corps"><dl class="lexique">${LEXIQUE.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join("")}</dl></div>`);
}
$("ouvrir-lexique").onclick = ouvrirLexique;

// Les boutons de cette 2e partie
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-retour],[data-partager],[data-comparer],[data-comparer-avec],[data-lexique]");
  if (!b) return;
  if (b.hasAttribute("data-retour")) revenir();
  else if (b.dataset.partager) partager(b.dataset.partager, b.dataset.titre || "MonTrioHockey");
  else if (b.dataset.comparer) ouvrirComparaison(b.dataset.comparer);
  else if (b.dataset.comparerAvec) ouvrirComparaison($("comp-resultats").dataset.a, b.dataset.comparerAvec);
  else if (b.hasAttribute("data-lexique")) ouvrirLexique();
});
// Clavier : les cartes de match s'ouvrent aussi avec Entrée
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("[role=button][data-match]")) { e.preventDefault(); ouvrirMatch(e.target.dataset.match); }
});

// ---- G. Liens directs -----------------------------------------
// #/joueur/ID, #/equipe/ID, #/match/ID, #/comparer/ID1/ID2
function ouvrirDepuisAdresse() {
  // Adresse lisible (ex. retour en avant dans l'historique) : lnh/joueur/nom/ID/, lnh/equipe/nom/, lnh/match/…/ID/
  const jolie = adresseJolie();
  if (jolie) {
    const [, pre, type, morceau, id] = jolie;
    const lig = Object.keys(PREFIXE).find((k) => PREFIXE[k] === pre);
    if (pageActuelle === null) allerA("accueil");
    charger(lig).catch(() => {}).then(() => {
      if (type === "joueur") { nettoyerFavoris(); ouvrirFiche(id); }
      else if (type === "match") ouvrirMatch(id);
      else { const eq = Object.keys(D.equipes).find((k) => ligueDe(k) === lig && slugUrl(nomEq(k)) === morceau); if (eq) ouvrirEquipe(eq); }
    });
    return true;
  }
  const x = /^#\/(joueur|equipe|match|comparer)\/([^/]+)(?:\/([^/]+))?/.exec(decodeURIComponent(location.hash));
  if (!x) return false;
  const [, type, id, id2] = x;
  if (pageActuelle === null) allerA("accueil");
  if (type === "joueur") charger(ligDeId(id)).catch(() => {}).then(() => { nettoyerFavoris(); ouvrirFiche(id); });
  else if (type === "equipe") ouvrirEquipe(id);
  else if (type === "match") ouvrirMatch(id);
  else if (type === "comparer") ouvrirComparaison(id, id2);
  return true;
}

// ---- Les récits de la soirée (accueil) ---------------------------
// Notre propre contenu : un récit écrit automatiquement pour chaque match de la dernière soirée.
let jetonRecits = 0;
async function rendreRecits() {
  const jeton = ++jetonRecits, lig = ligue;
  const finis = matchsLigue(lig).filter((m) => estFini(m) && m.date <= AUJ);
  const boite = $("recits");
  if (!finis.length) { boite.innerHTML = `<p class="vide">La saison n'est pas encore commencée.</p>`; $("recits-date").textContent = ""; return; }
  const date = finis[finis.length - 1].date;
  const eqs = equipesFavorites();
  const ms = finis.filter((m) => m.date === date).sort((a, b) => (eqs.includes(b.dom) || eqs.includes(b.ext)) - (eqs.includes(a.dom) || eqs.includes(a.ext)) || (b.sd + b.se) - (a.sd + a.se));
  const cartes = [];
  for (const m of ms) {
    const lignes = [[m.ext, (await points(m.ext))[m.id] || {}], [m.dom, (await points(m.dom))[m.id] || {}]];
    const vide = !Object.keys(lignes[0][1]).length && !Object.keys(lignes[1][1]).length;
    const fav = eqs.includes(m.dom) || eqs.includes(m.ext);
    const gagne = (eq) => (m.dom === eq ? m.sd > m.se : m.se > m.sd);
    cartes.push(`<article class="recit-carte ${fav ? "favori" : ""}" data-match="${m.id}" tabindex="0" role="button">
      <div class="rc-score"><span class="${gagne(m.ext) ? "gagne" : ""}"><b>${abr(m.ext)}</b> ${m.se}</span><span class="rc-tiret">–</span><span class="${gagne(m.dom) ? "gagne" : ""}">${m.sd} <b>${abr(m.dom)}</b></span><small>Final${suffixeFin(m)}${fav ? " · ⭐" : ""}</small></div>
      <p>${vide ? "Le récit arrive dès que les statistiques du match sont disponibles." : recitMatch(m, lignes)}</p>
      <span class="rc-lien">Sommaire du match ›</span></article>`);
  }
  if (jeton !== jetonRecits) return;
  $("recits-date").textContent = dateLongue(date);
  boite.innerHTML = `<div class="recits">${cartes.join("")}</div>`;
}

// ---- La semaine en bref (accueil) -------------------------------
let jetonSemaine = 0;
async function rendreSemaine() {
  const jeton = ++jetonSemaine, lig = ligue, debut = decaler(AUJ, -6); // aujourd'hui et les 6 jours d'avant
  const ms = matchsLigue(lig).filter((m) => estFini(m) && m.date >= debut && m.date <= AUJ);
  const boite = $("semaine");
  if (!ms.length) { boite.innerHTML = `<p class="vide">Aucun match dans les 7 derniers jours.</p>`; return; }
  const joueurs = new Map(), equipes = new Map();
  for (const m of ms) {
    for (const eq of [m.dom, m.ext]) {
      const e = equipes.get(eq) || { eq, v: 0, d: 0, dp: 0, bp: 0, bc: 0 };
      const { nous, eux } = scorePour(m, eq);
      if (nous > eux) e.v++; else if (m.fin) e.dp++; else e.d++;
      e.bp += nous; e.bc += eux; equipes.set(eq, e);
      const ligne = (await points(eq))[m.id] || {};
      for (const [id, l] of Object.entries(ligne)) {
        const j = D.parId.get(id); if (!j) continue;
        const x = joueurs.get(id) || { j, pj: 0, b: 0, a: 0, sv: 0, sa: 0, v: 0 };
        x.pj++;
        if (estGardienLigne(l)) { x.sv += l[1]; x.sa += l[2]; if (nous > eux && l[2] >= 15) x.v++; } else { x.b += l[0]; x.a += l[1]; }
        joueurs.set(id, x);
      }
    }
  }
  if (jeton !== jetonSemaine) return;
  const tous = [...joueurs.values()];
  const top = tous.filter((x) => x.j.pos !== "G" && x.b + x.a > 0).sort((a, b) => (b.b + b.a) - (a.b + a.a) || b.b - a.b || a.pj - b.pj).slice(0, 5);
  const g = tous.filter((x) => x.j.pos === "G" && x.pj >= 2 && x.sa >= 40).sort((a, b) => b.sv / b.sa - a.sv / a.sa)[0];
  const e = [...equipes.values()].sort((a, b) => (2 * b.v + b.dp) - (2 * a.v + a.dp) || (b.bp - b.bc) - (a.bp - a.bc))[0];
  const mdm = [...ms].sort((a, b) => (b.sd + b.se + (b.fin ? 2 : 0)) - (a.sd + a.se + (a.fin ? 2 : 0)))[0];
  const carte = (titre, attr, grand, petit) => `<button class="sem-carte" ${attr}><small>${titre}</small><b>${grand}</b><span>${petit}</span></button>`;
  boite.innerHTML = `<div class="sem-cartes">
    ${top[0] ? carte("Joueur de la semaine", `data-fiche="${top[0].j.id}"`, echapper(top[0].j.nom), `${abr(top[0].j.eq)} · ${top[0].b} B, ${top[0].a} A en ${pluriel(top[0].pj, "match")}`) : ""}
    ${g ? carte("Gardien de la semaine", `data-fiche="${g.j.id}"`, echapper(g.j.nom), `${abr(g.j.eq)} · ${pct3(g.sv / g.sa)} en ${pluriel(g.pj, "match")}`) : ""}
    ${e ? carte("Équipe de la semaine", `data-equipe-fiche="${e.eq}"`, echapper(nomEq(e.eq)), `${e.v}-${e.d}-${e.dp} · ${signe(e.bp - e.bc)} au différentiel`) : ""}
    ${mdm ? carte("Match de la semaine", `data-match="${mdm.id}"`, `${abr(mdm.ext)} ${mdm.se} – ${mdm.sd} ${abr(mdm.dom)}${suffixeFin(mdm)}`, dateLongue(mdm.date)) : ""}</div>
    ${top.length ? `<h4 class="mini-titre sem-titre">Les meilleurs pointeurs</h4><ol class="meneurs">${top.map((x) => `<li data-fiche="${x.j.id}"><span class="nom">${echapper(x.j.nom)}${favoris.includes(x.j.id) ? " ⭐" : ""}<small>${echapper(courtEq(x.j.eq))} · ${x.b} B, ${x.a} A en ${pluriel(x.pj, "match")}</small></span><span class="val">${x.b + x.a}</span></li>`).join("")}</ol>` : ""}`;
}
const rendreUneBase = rendreUne;
rendreUne = async function () { await rendreUneBase(); rendreSemaine(); };

// ---- Démarrage ---------------------------------------------------
rendreBoutonAlertes();
demarrer().then(() => { verifierAlertes(); synchroniserPush(); });
