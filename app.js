// =============================================================
// CE QUI REND LA PAGE VIVANTE
// Ce fichier charge les données du robot (dossier data/), les
// affiche dans les sections de la page (index.html) et réagit
// aux clics. Il est découpé en parties numérotées.
// =============================================================

// ---- 0. Petits outils ---------------------------------------
const $ = (id) => document.getElementById(id);
const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const NOMS_POS = { AG: "Ailier gauche", C: "Centre", AD: "Ailier droit", D: "Défenseur", G: "Gardien" };

function versTexte(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function versDate(t) { const [a, m, j] = t.split("-").map(Number); return new Date(a, m - 1, j); }
function dateLongue(t) { const d = versDate(t); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; }
function decaler(t, n) { const d = versDate(t); d.setDate(d.getDate() + n); return versTexte(d); }
function simplifier(t) { return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
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
let AUJ = versTexte(new Date());

// ---- 1. Les données -----------------------------------------
const D = {
  joueurs: [], parId: new Map(), equipes: {}, cal: [], classement: [],
  points: {}, misAJour: null, direct: false,
};

function nomEq(a) { return D.equipes[a] || AUTRES_EQUIPES[a] || a; }
// "Maple Leafs de Toronto" → "Maple Leafs"
function courtEq(a) { return nomEq(a).split(/\s(?:de|du|des)\s|\sd'/)[0]; }
function nomDeFamille(j) { return j.nom.split(" ").slice(1).join(" ") || j.nom; }

// Trouve un joueur par son identifiant LNH, ou par son nom simplifié
// (ex. "slafkovsky" ou "arber-xhekaj"), de préférence dans l'équipe donnée.
function joueur(id, eqPrefere = "MTL") {
  if (!id) return null;
  if (D.parId.has(id)) return D.parId.get(id);
  const autre = AUTRES_JOUEURS.find((j) => j.id === id);
  if (autre) return autre;
  const s = slug(id);
  const candidats = D.joueurs.filter((j) => slug(j.nom) === s || slug(nomDeFamille(j)) === s);
  return candidats.find((j) => j.eq === eqPrefere) || candidats[0] || null;
}
function joueurDansEquipe(s, eq) {
  return D.joueurs.find((j) => j.eq === eq && (slug(j.nom) === s || slug(nomDeFamille(j)) === s)) || null;
}

async function chargerDonnees() {
  const [j, cal, cl] = await Promise.all([
    lireJson("data/joueurs.json"),
    lireJson("data/calendrier.json"),
    lireJson("data/classement.json").catch(() => []),
  ]);
  D.joueurs = j.joueurs;
  D.equipes = j.equipes;
  D.misAJour = new Date(j.misAJour);
  D.cal = cal;
  D.classement = cl;
  D.parId = new Map(D.joueurs.map((x) => [x.id, x]));
}
async function points(eq) {
  if (!D.equipes[eq]) return {};
  if (!D.points[eq]) D.points[eq] = lireJson(`data/points/${eq}.json`).catch(() => ({}));
  return D.points[eq];
}

// ---- 2. Les matchs ------------------------------------------
const estFini = (m) => m.etat === "fini";
const estDirect = (m) => m.etat === "direct";
const matchsDe = (eq) => D.cal.filter((m) => m.dom === eq || m.ext === eq);
const adversaire = (m, eq) => (m.dom === eq ? m.ext : m.dom);
function scorePour(m, eq) {
  const nous = m.dom === eq ? m.sd : m.se, eux = m.dom === eq ? m.se : m.sd;
  return { nous, eux };
}
function resultatPour(m, eq) {
  const { nous, eux } = scorePour(m, eq);
  if (estDirect(m)) return { texte: `${nous}-${eux}`, classe: "direct" };
  const fin = m.fin === "SO" ? " (TB)" : m.fin === "OT" ? " (P)" : "";
  return { texte: `${nous > eux ? "V" : "D"} ${nous}-${eux}${fin}`, classe: nous > eux ? "v" : "d" };
}
function statutMatch(m) {
  if (estDirect(m)) return m.periode || "En direct";
  if (estFini(m)) return "Final" + (m.fin === "SO" ? " (TB)" : m.fin === "OT" ? " (P)" : "");
  return heureDe(m);
}
function prochainMatch(eq) {
  return D.cal.find((m) => (m.dom === eq || m.ext === eq) && !estFini(m) && m.date >= AUJ) || null;
}

// ---- 3. Les favoris (gardés dans le navigateur du visiteur) --
let favoris = [];
function lireFavoris() {
  try { const s = localStorage.getItem("mes-favoris-hockey"); if (s) return JSON.parse(s); } catch (e) {}
  return [...FAVORIS_DE_DEPART];
}
function sauverFavoris() {
  try { localStorage.setItem("mes-favoris-hockey", JSON.stringify(favoris)); } catch (e) {}
}
function nettoyerFavoris() {
  // Convertit les anciens identifiants (ex. "suzuki") en identifiants LNH
  favoris = [...new Set(favoris.map((id) => joueur(id)?.id).filter(Boolean))];
}
const favorisObjets = () => favoris.map((id) => joueur(id)).filter(Boolean);
const equipesFavorites = () => [...new Set(favorisObjets().map((j) => j.eq).filter((e) => D.equipes[e]))];
function ajouter(id) { if (!favoris.includes(id)) favoris.push(id); sauverFavoris(); rafraichir(); }
function retirer(id) { favoris = favoris.filter((f) => f !== id); sauverFavoris(); rafraichir(); }

// ---- 4. Bandeau des scores ----------------------------------
let jourScores = AUJ;
function rendreBandeau() {
  const d = versDate(jourScores);
  $("score-jour").textContent = jourScores === AUJ ? "Aujourd'hui" : `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS_COURT[d.getMonth()]}`;
  const liste = D.cal.filter((m) => m.date === jourScores);
  const fav = equipesFavorites();
  if (!liste.length) { $("bandeau-matchs").innerHTML = `<span class="bandeau-vide">Aucun match dans la LNH ce jour-là.</span>`; return; }
  $("bandeau-matchs").innerHTML = liste.map((m) => {
    const joue = estFini(m) || estDirect(m);
    const gagneDom = joue && m.sd > m.se, gagneExt = joue && m.se > m.sd;
    return `<div class="score-carte ${fav.includes(m.dom) || fav.includes(m.ext) ? "favori" : ""}">
      <span class="statut ${estDirect(m) ? "direct" : ""}">${estDirect(m) ? "● " : ""}${statutMatch(m)}</span>
      <span class="eq ${estFini(m) && !gagneExt ? "perd" : ""}"><span>${m.ext}</span><span>${joue ? m.se : ""}</span></span>
      <span class="eq ${estFini(m) && !gagneDom ? "perd" : ""}"><span>${m.dom}</span><span>${joue ? m.sd : ""}</span></span>
    </div>`;
  }).join("");
}
$("score-prec").onclick = () => { jourScores = decaler(jourScores, -1); rendreBandeau(); };
$("score-suiv").onclick = () => { jourScores = decaler(jourScores, 1); rendreBandeau(); };

// ---- 5. À la une (résumés générés à partir des stats) -------
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
async function rendreUne() {
  const finis = D.cal.filter((m) => estFini(m) && m.date <= AUJ);
  if (!finis.length) { $("une").innerHTML = `<p class="vide">La saison n'est pas encore commencée.</p>`; return; }
  const date = finis[finis.length - 1].date;
  const duJour = finis.filter((m) => m.date === date);
  $("une-date").textContent = `Matchs du ${dateLongue(date)}`;
  const perfs = [];
  for (const m of duJour) {
    for (const eq of [m.dom, m.ext]) {
      const ligne = (await points(eq))[m.id] || {};
      for (const pid in ligne) {
        const j = D.parId.get(pid);
        if (j && j.eq === eq) perfs.push({ j, m, b: ligne[pid][0], a: ligne[pid][1] });
      }
    }
  }
  perfs.sort((x, y) => (y.b + y.a) - (x.b + x.a) || y.b - x.b);
  const [h, ...reste] = perfs;
  if (!h) { $("une").innerHTML = `<p class="vide">Résumés à venir.</p>`; return; }
  $("une").innerHTML = `
    <button class="une-hero" data-fiche="${h.j.id}">
      <div class="une-visuel"><span class="gros-no">${h.j.no ?? ""}</span><span class="eq-tag">${h.j.eq}</span></div>
      <div class="une-texte">
        <span class="categorie">${echapper(nomEq(h.j.eq))}</span>
        <h3>${echapper(titrePerformance(h))}</h3>
        <p>${echapper(phraseMatch(h))}</p>
      </div>
    </button>`;
  $("manchettes").innerHTML = reste.slice(0, 6).map((p) => `
    <li><button data-fiche="${p.j.id}">
      <span class="chiffre">${p.b + p.a}</span>
      <span><strong>${echapper(titrePerformance(p))}</strong><small>${p.j.eq} vs ${adversaire(p.m, p.j.eq)} · ${p.b} B, ${p.a} A</small></span>
    </button></li>`).join("");
}

// ---- 6. Ce soir pour tes favoris -----------------------------
async function rendreSoir() {
  const favs = favorisObjets();
  const eqs = equipesFavorites();
  const ceSoir = D.cal.filter((m) => m.date === AUJ && (eqs.includes(m.dom) || eqs.includes(m.ext)));
  if (!favs.length) { $("soir").innerHTML = `<p class="vide">Ajoute des joueurs à tes favoris pour suivre leurs matchs ici.</p>`; return; }
  if (!ceSoir.length) {
    const prochains = eqs.map(prochainMatch).filter(Boolean).sort((a, b) => a.debut.localeCompare(b.debut));
    const p = prochains[0];
    $("soir").innerHTML = `<p class="vide">Pas de match ce soir pour tes favoris. Repose-toi! 😄${p ? `<br>Prochain rendez-vous : <strong>${dateLongue(p.date)}</strong>, ${courtEq(p.ext)} @ ${courtEq(p.dom)} à ${heureDe(p)}.` : ""}</p>`;
    return;
  }
  let h = "";
  for (const m of ceSoir) {
    const lesMiens = favs.filter((j) => j.eq === m.dom || j.eq === m.ext);
    const pts = { ...(await points(m.dom))[m.id], ...(await points(m.ext))[m.id] };
    const statut = estDirect(m) ? `<span class="badge-direct">EN DIRECT</span> <strong>${m.se}-${m.sd}</strong>`
      : estFini(m) ? `<strong>Final ${m.se}-${m.sd}${m.fin === "OT" ? " (P)" : m.fin === "SO" ? " (TB)" : ""}</strong>` : `<strong>${heureDe(m)}</strong>`;
    h += `<div class="soir-match">
      <div class="soir-tete"><strong>${courtEq(m.ext)} @ ${courtEq(m.dom)}</strong><span>${statut}</span></div>
      <div class="soir-joueurs">${lesMiens.map((j) => {
        const p = pts[j.id];
        const txt = p ? `🔥 ${nomDeFamille(j)} : ${p[0]} B, ${p[1]} A` : nomDeFamille(j);
        return `<button class="puce-joueur ${p ? "chaud" : ""}" data-fiche="${j.id}">${echapper(txt)}</button>`;
      }).join("")}</div>
    </div>`;
  }
  $("soir").innerHTML = h;
}

// ---- 7. Cartes des favoris -----------------------------------
const pastille = (j) => `<span class="numero">${j.no ?? "–"}</span>`;
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
  if (!D.equipes[j.eq]) return "Suivi des autres ligues : bientôt!";
  const direct = D.cal.find((m) => estDirect(m) && (m.dom === j.eq || m.ext === j.eq));
  if (direct) { const r = resultatPour(direct, j.eq); return `<span class="badge-direct">EN DIRECT</span> <strong>${r.texte}</strong> contre ${adversaire(direct, j.eq)}`; }
  const p = prochainMatch(j.eq);
  if (!p) return "Saison terminée";
  return `Prochain : <strong>${p.date === AUJ ? "ce soir" : dateLongue(p.date)}</strong> ${p.dom === j.eq ? "vs" : "@"} ${adversaire(p, j.eq)} · ${heureDe(p)}`;
}
function rendreFavoris() {
  const favs = favorisObjets();
  $("nb-favoris").textContent = favs.length;
  if (!favs.length) {
    const idees = [...D.joueurs].filter((j) => j.s).sort((a, b) => b.s.pts - a.s.pts).slice(0, 4);
    $("cartes-favoris").innerHTML = `<div><p class="vide">Ta liste est vide. Pour commencer, essaie un de ces joueurs en feu :</p>
      <div class="suggestions">${idees.map((j) => `<button class="btn leger" data-ajouter="${j.id}">+ ${echapper(j.nom)} (${j.eq})</button>`).join("")}</div></div>`;
    return;
  }
  $("cartes-favoris").innerHTML = favs.map((j) => `
    <div class="carte-joueur">
      <div class="haut">${pastille(j)}<div><h3>${echapper(j.nom)}</h3><div class="equipe">${NOMS_POS[j.pos] || j.pos} · ${echapper(nomEq(j.eq))}</div></div></div>
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

// ---- 8. Calendrier de la semaine -----------------------------
function lundiDe(t) { const d = versDate(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return versTexte(d); }
let debutSemaine = lundiDe(AUJ);
let jourChoisi = AUJ;
function rendreCalendrier() {
  const eqs = equipesFavorites();
  const fin = decaler(debutSemaine, 6);
  const d0 = versDate(debutSemaine), d1 = versDate(fin);
  $("sem-titre").textContent = `${d0.getDate()} ${MOIS_COURT[d0.getMonth()]} – ${d1.getDate()} ${MOIS_COURT[d1.getMonth()]}`;
  let h = "";
  for (let i = 0; i < 7; i++) {
    const t = decaler(debutSemaine, i), d = versDate(t);
    const ms = D.cal.filter((m) => m.date === t && (eqs.includes(m.dom) || eqs.includes(m.ext)));
    let puces = "";
    if (ms.length) {
      const m = ms[0], eq = eqs.includes(m.dom) ? m.dom : m.ext;
      let classe = "", txt = `${m.dom === eq ? "vs" : "@"} ${adversaire(m, eq)}`;
      if (estDirect(m) || estFini(m)) { const r = resultatPour(m, eq); classe = r.classe; txt = estDirect(m) ? `● ${r.texte}` : r.texte.split(" ").slice(0, 2).join(" "); }
      puces = `<span class="puce ${classe}">${txt}</span>${ms.length > 1 ? `<span class="puce">+${ms.length - 1}</span>` : ""}`;
    }
    h += `<button class="jour ${t === AUJ ? "aujourdhui" : ""} ${t === jourChoisi ? "choisi" : ""}" data-jour="${t}">
      <span class="nom-jour">${JOURS[d.getDay()]}</span><span class="num-jour">${d.getDate()}</span>${puces}</button>`;
  }
  $("calendrier").innerHTML = h;
  const ms = D.cal.filter((m) => m.date === jourChoisi && (eqs.includes(m.dom) || eqs.includes(m.ext)));
  const titre = `<p class="detail-titre">${dateLongue(jourChoisi)}${jourChoisi === AUJ ? " · aujourd'hui" : ""}</p>`;
  $("detail-jour").innerHTML = titre + (ms.length ? ms.map((m) => {
    const qui = favorisObjets().filter((j) => j.eq === m.dom || j.eq === m.ext).map(nomDeFamille).join(", ");
    return `<div class="soir-match"><div class="soir-tete"><strong>${courtEq(m.ext)} @ ${courtEq(m.dom)}</strong>
      <span>${estDirect(m) ? '<span class="badge-direct">EN DIRECT</span> ' : ""}<strong>${estFini(m) || estDirect(m) ? `${m.se}-${m.sd}` : heureDe(m)}</strong></span></div>
      <p class="petit-gris" style="margin-top:6px">Tes favoris : ${echapper(qui)}</p></div>`;
  }).join("") : `<p class="vide">Aucun de tes favoris ne joue cette journée.</p>`);
}
$("sem-prec").onclick = () => { debutSemaine = decaler(debutSemaine, -7); rendreCalendrier(); };
$("sem-suiv").onclick = () => { debutSemaine = decaler(debutSemaine, 7); rendreCalendrier(); };

// ---- 9. Classement et meneurs --------------------------------
let conf = "Eastern", cat = "pts";
function rendreClassement() {
  const eqs = equipesFavorites();
  const liste = D.classement.filter((t) => t.conf === conf).sort((a, b) => b.pts - a.pts || a.pj - b.pj || b.v - a.v);
  if (!liste.length) { $("table-classement").innerHTML = `<p class="vide">Classement à venir.</p>`; return; }
  $("table-classement").innerHTML = `<table class="tableau"><thead><tr><th>#</th><th>Équipe</th><th>PJ</th><th>V</th><th>D</th><th>DP</th><th>PTS</th></tr></thead><tbody>
    ${liste.map((t, i) => `<tr class="${eqs.includes(t.eq) ? "favori" : ""}"><td>${i + 1}</td><td class="eq" title="${echapper(nomEq(t.eq))}">${t.eq}</td>
      <td>${t.pj}</td><td>${t.v}</td><td>${t.d}</td><td>${t.dp}</td><td class="pts">${t.pts}</td></tr>`).join("")}
  </tbody></table>`;
}
function rendreMeneurs() {
  const liste = D.joueurs.filter((j) => j.s && j.s.pj > 0).sort((a, b) => b.s[cat] - a.s[cat] || b.s.pts - a.s.pts || a.s.pj - b.s.pj).slice(0, 10);
  $("liste-meneurs").innerHTML = liste.map((j) => `<li data-fiche="${j.id}">
    <span class="nom">${echapper(j.nom)}<small>${echapper(courtEq(j.eq))} · ${pluriel(j.s.pj, "match")}</small></span><span class="val">${j.s[cat]}</span></li>`).join("");
}
document.querySelectorAll("[data-conf]").forEach((b) => b.onclick = () => {
  conf = b.dataset.conf; document.querySelectorAll("[data-conf]").forEach((x) => x.classList.toggle("actif", x === b)); rendreClassement();
});
document.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => {
  cat = b.dataset.cat; document.querySelectorAll("[data-cat]").forEach((x) => x.classList.toggle("actif", x === b)); rendreMeneurs();
});

// ---- 10. Recherche --------------------------------------------
function rendreResultats() {
  const q = simplifier($("recherche").value.trim());
  if (!q) { $("resultats").innerHTML = ""; return; }
  const tous = [...D.joueurs, ...AUTRES_JOUEURS];
  const trouves = tous.filter((j) => simplifier(j.nom).includes(q) || simplifier(nomEq(j.eq)).includes(q) || simplifier(j.eq) === q).slice(0, 12);
  $("resultats").innerHTML = trouves.length ? trouves.map((j) => `
    <li>${pastille(j)}
      <div class="infos" data-fiche="${j.id}"><strong>${echapper(j.nom)}</strong><span>${NOMS_POS[j.pos] || j.pos} · ${echapper(courtEq(j.eq))}</span></div>
      ${favoris.includes(j.id) ? `<button class="btn leger" disabled aria-label="Déjà dans tes favoris">✓</button>` : `<button class="btn accent" data-ajouter="${j.id}" aria-label="Ajouter ${echapper(j.nom)}">+</button>`}
    </li>`).join("") : `<li class="vide">Aucun joueur trouvé.</li>`;
}
$("recherche").addEventListener("input", rendreResultats);

// ---- 11. Fiche d'un joueur ------------------------------------
function caseJoueur(j, idChoisi, etiquette) {
  if (!j) return `<div class="coequipier"><small>${etiquette || ""}</small><span>—</span></div>`;
  return `<button class="coequipier ${j.id === idChoisi ? "lui" : ""}" data-fiche="${j.id}">
    <small>${etiquette || j.pos} · #${j.no ?? "–"}</small><span>${echapper(j.nom)}</span></button>`;
}
function htmlEquipe(j) {
  const effectif = D.joueurs.filter((x) => x.eq === j.eq);
  const f = FORMATIONS[j.eq];
  let h = `<div class="formation">`;
  const places = new Set();
  if (f) {
    const trouve = (s) => { const x = joueurDansEquipe(s, j.eq); if (x) places.add(x.id); return x; };
    f.trios.forEach((t, i) => { h += `<div class="rangee"><span class="etiquette">${i + 1}${i ? "e" : "er"} trio</span>${t.map((s) => caseJoueur(trouve(s), j.id)).join("")}</div>`; });
    f.paires.forEach((p, i) => { h += `<div class="rangee deux"><span class="etiquette">${i + 1}${i ? "e" : "re"} paire</span>${p.map((s) => caseJoueur(trouve(s), j.id)).join("")}</div>`; });
    h += `<div class="rangee deux"><span class="etiquette">Gardiens</span>${f.gardiens.map((s) => caseJoueur(trouve(s), j.id)).join("")}</div>`;
    const autres = effectif.filter((x) => !places.has(x.id));
    if (autres.length) h += `<div class="rangee libre"><span class="etiquette">Autres</span><div class="groupe">${autres.map((x) => caseJoueur(x, j.id)).join("")}</div></div>`;
  } else {
    for (const [pos, nom] of [["C", "Centres"], ["AG", "Ailiers gauches"], ["AD", "Ailiers droits"], ["D", "Défenseurs"], ["G", "Gardiens"]]) {
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
      const r = resultatPour(m, j.eq);
      const p = (pts[m.id] || {})[j.id];
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
      <div><h2>${echapper(j.nom)}</h2><p>${NOMS_POS[j.pos] || j.pos} · ${echapper(nomEq(j.eq))}</p>
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

// ---- 12. Un seul « écouteur » pour tous les boutons ------------
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-fiche],[data-ajouter],[data-retirer],[data-jour]");
  if (!b) return;
  if (b.dataset.ajouter) { ajouter(b.dataset.ajouter); if (b.hasAttribute("data-garder")) ouvrirFiche(b.dataset.ajouter); }
  else if (b.dataset.retirer) { retirer(b.dataset.retirer); if (b.hasAttribute("data-garder")) ouvrirFiche(b.dataset.retirer); }
  else if (b.dataset.fiche) ouvrirFiche(b.dataset.fiche);
  else if (b.dataset.jour) { jourChoisi = b.dataset.jour; rendreCalendrier(); }
});

// ---- 13. Thème clair / sombre ---------------------------------
$("theme").onclick = () => {
  const sombre = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = sombre ? "light" : "dark";
  try { localStorage.setItem("theme", document.documentElement.dataset.theme); } catch (e) {}
};

// ---- 14. Indicateur de fraîcheur ------------------------------
function rendreMiseAJour() {
  let txt;
  if (D.direct && sourceOk) txt = "Scores en direct";
  else if (!D.misAJour) txt = "";
  else {
    const min = Math.round((Date.now() - D.misAJour) / 60000);
    txt = min < 1 ? "Mis à jour à l'instant" : min < 60 ? `Mis à jour il y a ${min} min`
      : min < 1440 ? `Mis à jour il y a ${Math.round(min / 60)} h` : `Mis à jour le ${D.misAJour.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`;
  }
  $("maj-badge").textContent = txt;
  $("maj-badge").classList.toggle("auto", !!txt);
  $("maj").textContent = "Stats fournies automatiquement à partir des données publiques de la LNH." + (txt ? ` ${txt}.` : "");
}

// ---- 15. Le direct à la seconde -------------------------------
// Pendant les matchs, on demande le score directement (au relais si
// installé, sinon au service de la LNH s'il accepte la demande).
const SOURCES_DIRECT = [RELAIS, "https://api-web.nhle.com"].filter(Boolean);
let sourceOk = null, minuterieDirect = null;
const PERIODES = { 1: "1re", 2: "2e", 3: "3e" };
function matchsEnCours() {
  const maintenant = Date.now();
  return D.cal.filter((m) => m.date >= decaler(AUJ, -1) && m.date <= AUJ && !estFini(m) && m.debut && new Date(m.debut).getTime() - 5 * 60000 <= maintenant);
}
async function lireDirect(chemin) {
  for (const base of sourceOk ? [sourceOk] : SOURCES_DIRECT) {
    try { const r = await fetch(base + chemin, { cache: "no-store" }); if (r.ok) { sourceOk = base; return await r.json(); } } catch (e) {}
  }
  return null;
}
async function tourDirect() {
  if (!matchsEnCours().length) { D.direct = false; return; }
  const donnees = await lireDirect("/v1/score/now");
  if (!donnees) return;
  let change = false;
  const eqs = equipesFavorites();
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
    // Points des favoris en direct
    if (etat === "direct" && (eqs.includes(m.dom) || eqs.includes(m.ext))) {
      const box = await lireDirect(`/v1/gamecenter/${m.id}/boxscore`);
      for (const [cote, eq] of [["homeTeam", m.dom], ["awayTeam", m.ext]]) {
        const e = box?.playerByGameStats?.[cote];
        if (!e) continue;
        const ligne = {};
        for (const p of [...(e.forwards || []), ...(e.defense || [])]) if (p.goals || p.assists) ligne[p.playerId] = [p.goals || 0, p.assists || 0];
        (await points(eq))[m.id] = ligne;
        change = true;
      }
    }
  }
  D.direct = D.cal.some(estDirect);
  if (change) { rendreBandeau(); rendreSoir(); rendreFavoris(); rendreCalendrier(); }
  rendreMiseAJour();
}
function demarrerDirect() {
  clearInterval(minuterieDirect);
  minuterieDirect = setInterval(tourDirect, SECONDES_DIRECT * 1000);
  tourDirect();
}

// ---- 16. Démarrage --------------------------------------------
function rafraichir() {
  rendreBandeau(); rendreSoir(); rendreFavoris(); rendreCalendrier();
  rendreClassement(); rendreMeneurs(); rendreResultats();
}
async function demarrer() {
  try {
    await chargerDonnees();
  } catch (e) {
    $("erreur").hidden = false;
    $("erreur").textContent = "Les données n'ont pas pu être chargées pour l'instant. Réessaie dans quelques minutes.";
    return;
  }
  favoris = lireFavoris();
  nettoyerFavoris();
  rafraichir();
  rendreMiseAJour();
  rendreUne();
  demarrerDirect();
  setInterval(() => {
    const nouveauJour = versTexte(new Date());
    if (nouveauJour !== AUJ) { AUJ = nouveauJour; rafraichir(); rendreUne(); }
    rendreMiseAJour();
  }, 60000);
}
demarrer();
