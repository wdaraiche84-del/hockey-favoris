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
function majAdresse() {
  const r = routeModale();
  if (!r || decodeURIComponent(location.hash) === `#/${r}`) return;
  if (/^#\/(joueur|equipe|match|comparer)\//.test(location.hash)) history.replaceState(history.state, "", `#/${r}`);
  else history.pushState({ montrio: true }, "", `#/${r}`);
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
  return p;
};

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
    <button class="btn fantome" data-partager="match/${m.id}" data-titre="${echapper(abr(m.ext))} @ ${echapper(abr(m.dom))} · MonTrio">↗ Partager</button>
</div>`;
  $("fiche").querySelector(".fiche-corps").innerHTML = corps + outils;
}
async function corpsMatchJoue(m) {
  const lig = ligueDe(m.dom), simple = !!LIGUES[lig].pointsSeulement;
  const lignes = [[m.ext, (await points(m.ext))[m.id] || {}], [m.dom, (await points(m.dom))[m.id] || {}]];
  const vide = !Object.keys(lignes[0][1]).length && !Object.keys(lignes[1][1]).length;
  let h = "";
  if (vide) return `<p class="vide">${estDirect(m) ? "Les statistiques des joueurs arrivent au fil du match." : "Les statistiques détaillées de ce match ne sont pas encore disponibles. Reviens un peu plus tard!"}</p>`;
  // Les 3 étoiles
  const etoiles = troisEtoiles(m, lignes);
  if (etoiles.length) {
    h += `<h3>Les 3 étoiles</h3><div class="etoiles">${etoiles.map((x, i) => `<button class="etoile" data-fiche="${x.j.id}">
      <span class="etoile-rang">${"★".repeat(3 - i)}</span><span class="numero">${x.j.no ?? "–"}</span>
      <span class="etoile-nom"><strong>${echapper(x.j.nom)}</strong><small>${abr(x.eq)} · ${texteLigne(x.l)}</small></span></button>`).join("")}</div>
      <p class="petit-gris">Choisies automatiquement par MonTrio selon les statistiques du match.</p>`;
  }
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
      <p class="fiche-boutons">        <button class="btn fantome" data-partager="equipe/${eq}" data-titre="${echapper(nomEq(eq))} · MonTrio">↗ Partager</button></p></div>
    <button class="fermer" aria-label="Fermer">✕</button></div><div class="fiche-corps">`;
  h += `<div class="tuiles">
    ${tuile(r ? ieme(r.ligueRang) : "–", `rang · ${LIGUES[lig].nom}`)}
    ${r?.groupe ? tuile(ieme(r.groupeRang), echapper(r.groupe.replace(/^Association de l'|^Division /, ""))) : ""}
    ${tuile(t?.pts ?? "–", "points")}${tuile(fmtBilan(b.tous), "fiche V-D-DP")}
    ${tuile(`${diff > 0 ? "+" : ""}${diff}`, `diff. (${t?.bp ?? 0} BP, ${t?.bc ?? 0} BC)`)}
    ${tuile(fmtBilan(b.dom), "à domicile")}${tuile(fmtBilan(b.ext), "à l'étranger")}${tuile(serieFr(t?.serie), "séquence")}</div>`;
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
    <section class="bloc"><div class="titre-section"><h2>Gardiens en forme <span class="tag-ligue">${LIGUES[lig].nom}</span></h2><span class="sur-titre">5 derniers matchs</span></div><ol class="meneurs">${htmlChauds(gar.slice(0, 10), (x) => pct3(x.sv / x.sa), (x) => `${x.sv} arrêts sur ${x.sa} en ${pluriel(x.pj, "match")}`)}</ol></section>`;
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
const rendreMeneursBase = rendreMeneurs;
rendreMeneurs = function () {
  rendreMeneursBase();
  if (LIGUES[ligue].sansJoueurs) return;
  const maxPj = Math.max(1, ...(D.classement[ligue] || []).map((t) => t.pj));
  const min = Math.max(1, Math.ceil(maxPj / 2));
  const ppm = listeMeneurs(15, (j) => j.s && j.s.pj >= min, (j) => j.s.pts / j.s.pj);
  $("grille-meneurs").insertAdjacentHTML("afterbegin", `<div id="bloc-chauds" class="bloc-chauds"></div>`);
  $("grille-meneurs").insertAdjacentHTML("beforeend", `<section class="bloc"><div class="titre-section"><h2>Points par match <span class="tag-ligue">${LIGUES[ligue].nom}</span></h2><span class="sur-titre">min. ${pluriel(min, "match")}</span></div>
    <ol class="meneurs">${htmlMeneurs(ppm, (j) => dec(j.s.pts / j.s.pj))}</ol></section>`);
  rendreChauds();
};

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
    <button class="btn fantome" data-partager="comparer/${A.id}/${B.id}" data-titre="${echapper(nomDeFamille(A))} vs ${echapper(nomDeFamille(B))} · MonTrio">↗ Partager</button></div></div>`);
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
  const url = `${location.origin}${location.pathname}#/${chemin}`;
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ title: titre, url }); return; }
    await navigator.clipboard.writeText(url);
    toast("Lien copié! Tu peux le coller dans un message.");
  } catch (e) { if (e.name !== "AbortError") prompt("Copie ce lien :", url); }
}
// Alertes de buts : pendant que MonTrio est ouvert (onglet ou application)
let alertesOn = memoire("alertes") === "1";
const vus = new Map();
function rendreBoutonAlertes() { $("alertes").textContent = `🔔 Alertes de buts : ${alertesOn ? "oui" : "non"}`; $("alertes").classList.toggle("accent", alertesOn); }
$("alertes").onclick = async () => {
  alertesOn = !alertesOn; memoire("alertes", alertesOn ? "1" : "0"); rendreBoutonAlertes();
  if (alertesOn && "Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch (e) {} }
  toast(alertesOn ? "Alertes activées : tu seras averti quand tes favoris marquent, tant que MonTrio reste ouvert." : "Alertes désactivées.");
};
function avertir(titre, texte) {
  toast(`${titre} ${texte}`, 7000);
  if (document.hidden && "Notification" in window && Notification.permission === "granted") {
    try { new Notification(titre, { body: texte, icon: "icones/icone-192.png", tag: titre + texte }); } catch (e) {}
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
  ["3 étoiles", "Les meilleurs du match, choisis automatiquement par MonTrio selon les stats"], ["En feu", "Les joueurs qui ont le plus de points dans les 5 derniers matchs de leur équipe"]];
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
  else if (b.dataset.partager) partager(b.dataset.partager, b.dataset.titre || "MonTrio");
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

// À la une : on prévient quand les médias de cette ligue écrivent surtout en anglais
const rendreBuzzBase = rendreBuzz;
rendreBuzz = async function () {
  await rendreBuzzBase();
  const anglais = !["lnh", "lhjmq"].includes(ligue);
  $("note-articles").textContent = `Les articles viennent de Google Actualités : un clic ouvre l'article complet sur le site du média.${anglais ? ` Pour ${laLigue(ligue)}, la plupart des médias écrivent en anglais.` : ""}`;
};

// ---- Démarrage ---------------------------------------------------
rendreBoutonAlertes();
demarrer().then(() => verifierAlertes());
