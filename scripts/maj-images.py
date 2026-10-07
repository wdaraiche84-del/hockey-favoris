# =============================================================
# LE ROBOT DES IMAGES DE PARTAGE
# Pour chaque joueur (qui a joué cette saison) et chaque équipe, une image 600 × 315 qui
# s'affiche quand on colle le lien dans Discord, Messenger, etc. :
# à gauche le nom du site, à droite l'info du joueur ou de l'équipe.
# Rangées dans images/partage/joueur/ID.jpg et images/partage/equipe/ID.jpg
# (l'image ne contient pas les stats, qui changent tous les jours : elles sont dans le texte de l'aperçu)
# Une image n'est refaite que si son contenu change (nom, numéro,
# équipe…) : on garde une empreinte de chaque image dans
# images/partage/empreintes.json.
# =============================================================
import json, hashlib, os, pathlib, html, subprocess, sys

RACINE = pathlib.Path(__file__).resolve().parent.parent
POLICES = RACINE / "scripts" / "polices"
SORTIE = RACINE / "images" / "partage"
VERSION = "5"  # changer ce chiffre refait toutes les images (nouveau dessin)
LIGUES = {"lnh": "LNH", "ahl": "LAH", "lhjmq": "LHJMQ", "ohl": "OHL", "whl": "WHL", "khl": "KHL", "shl": "SHL", "liiga": "Liiga", "nl": "National League"}
PAYS = {"lnh": "Ligue nationale de hockey", "ahl": "Ligue américaine de hockey", "lhjmq": "Junior · Québec et Maritimes", "ohl": "Junior · Ontario", "whl": "Junior · Ouest canadien et américain", "khl": "Russie", "shl": "Suède", "liiga": "Finlande", "nl": "Suisse"}
POS = {"AG": "Ailier gauche", "C": "Centre", "AD": "Ailier droit", "AV": "Attaquant", "D": "Défenseur", "G": "Gardien"}
LOGO = (RACINE / "icones" / "logo.svg").read_text().replace("<svg ", '<svg width="150" height="150" ', 1)

def lire(f):
    try: return json.loads((RACINE / f).read_text())
    except Exception: return None

def e(t): return html.escape(str(t if t is not None else ""))

GABARIT = """<html><head><style>
@font-face {{ font-family: I; font-weight: 500; src: url('{p}/Inter-Medium.otf'); }}
@font-face {{ font-family: I; font-weight: 800; src: url('{p}/Inter-ExtraBold.otf'); }}
* {{ margin: 0; box-sizing: border-box; }}
body {{ width: 1200px; height: 630px; font-family: I, sans-serif; display: flex; background: #111; color: #fff; overflow: hidden; }}
.g {{ width: 600px; height: 630px; background: #141414; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 26px; border-right: 6px solid #EA580C; }}
.nom-site {{ font-weight: 800; font-size: 64px; letter-spacing: -2px; }} .nom-site b {{ color: #FB923C; }}
.slogan {{ font-weight: 500; font-size: 24px; color: #D6D3D1; }}
.d {{ width: 600px; height: 630px; padding: 56px 54px; display: flex; flex-direction: column; justify-content: center; gap: 14px; background: #19191b; position: relative; }}
.filigrane {{ position: absolute; right: -10px; bottom: -40px; font-weight: 800; font-size: 300px; color: #fff; opacity: .05; letter-spacing: -10px; line-height: 1; }}
.ligue {{ align-self: flex-start; background: #EA580C; color: #fff; font-weight: 800; font-size: 24px; padding: 6px 16px; border-radius: 8px; letter-spacing: 1px; }}
.titre {{ font-weight: 800; font-size: {taille}px; line-height: 1.02; letter-spacing: -1.5px; }}
.sous {{ font-weight: 500; font-size: 30px; color: #E7E5E4; }}
.eq {{ font-weight: 800; font-size: 32px; color: #FDBA74; }}
.lignes {{ font-weight: 500; font-size: 24px; color: #A8A29E; margin-top: 8px; }}
</style></head><body>
<div class="g">{logo}<div class="nom-site">MonTrio<b>Hockey</b></div><div class="slogan">Le hockey de toutes les ligues, en français</div></div>
<div class="d"><div class="filigrane">{filigrane}</div><div class="ligue">{ligue}</div><div class="titre">{titre}</div><div class="sous">{sous}</div><div class="eq">{eq}</div><div class="lignes">{lignes}</div></div>
</body></html>"""

def taille(t):
    n = len(t)
    return 72 if n <= 14 else 62 if n <= 18 else 52 if n <= 24 else 44

def main():
    equipes, joueurs = {}, []
    lnh = lire("data/joueurs.json")
    if lnh:
        for a, nom in lnh["equipes"].items(): equipes[a] = {"abr": a, "nom": nom, "lig": "lnh"}
        for j in lnh["joueurs"]: joueurs.append({**j, "lig": "lnh"})
    for lig in LIGUES:
        if lig == "lnh": continue
        infos = lire(f"data/ligues/{lig}/infos.json")
        if not infos: continue
        for k, eq in infos["equipes"].items(): equipes[k] = {**eq, "lig": lig}
        for j in infos["joueurs"]: joueurs.append({**j, "lig": lig})
    fiches = lire("data/fiches.json") or {}  # bio (âge, naissance) si disponible

    taches = {}
    for j in joueurs:
        if not ((j.get("s") or {}).get("pj") or (j.get("g") or {}).get("pj")): continue  # seulement ceux qui ont joué
        eq = equipes.get(j["eq"], {})
        sous = POS.get(j.get("pos"), j.get("pos") or "")
        if j.get("no") is not None: sous = f"n° {j['no']} · {sous}"
        if j.get("r"): sous += " · Recrue"
        taches[f"joueur/{j['id']}.jpg"] = dict(ligue=LIGUES[j["lig"]], titre=j["nom"], sous=sous, eq=eq.get("nom", ""),
            lignes="Stats, match par match et fiche complète", filigrane=e(j.get("no") if j.get("no") is not None else eq.get("abr", "")))
    for k, eq in equipes.items():
        taches[f"equipe/{k}.jpg"] = dict(ligue=LIGUES[eq["lig"]], titre=eq["nom"], sous=PAYS[eq["lig"]], eq=" · ".join(dict.fromkeys(x for x in [eq.get("conf"), eq.get("div")] if x and x not in (LIGUES[eq["lig"]], "KHL", "SHL", "Liiga", "National League")))[:60],
            lignes="Classement, calendrier, meneurs et effectif", filigrane=e(eq.get("abr", "")))

    ancien = lire("images/partage/empreintes.json") or {}
    nouv = {}
    a_faire = []
    for chemin, t in taches.items():
        emp = hashlib.sha1((VERSION + json.dumps(t, sort_keys=True, ensure_ascii=False)).encode()).hexdigest()[:16]
        nouv[chemin] = emp
        if ancien.get(chemin) != emp or not (SORTIE / chemin).exists(): a_faire.append((chemin, t))
    # Les images de joueurs ou d'équipes disparus sont retirées
    for chemin in ancien:
        if chemin not in nouv and (SORTIE / chemin).exists(): (SORTIE / chemin).unlink()
    print(f"Images de partage : {len(taches)} au total, {len(a_faire)} à faire.")
    if a_faire:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:  # sur GitHub : on installe le navigateur seulement quand il y a des images à faire
            subprocess.run([sys.executable, "-m", "pip", "install", "-q", "--break-system-packages", "playwright"], check=True)
            subprocess.run([sys.executable, "-m", "playwright", "install", "--with-deps", "chromium"], check=True)
            from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=0.5)
            for i, (chemin, t) in enumerate(a_faire):
                contenu = GABARIT.format(p=POLICES.as_uri(), logo=LOGO, taille=taille(t["titre"]), ligue=e(t["ligue"]), titre=e(t["titre"]),
                                         sous=e(t["sous"]), eq=e(t["eq"]), lignes=e(t["lignes"]), filigrane=t["filigrane"])
                pg.set_content(contenu, wait_until="load")
                if i == 0: pg.evaluate("document.fonts.ready")
                f = SORTIE / chemin
                f.parent.mkdir(parents=True, exist_ok=True)
                pg.screenshot(path=str(f), type="jpeg", quality=75)
            b.close()
    (SORTIE / "empreintes.json").write_text(json.dumps(nouv, ensure_ascii=False, sort_keys=True))

if __name__ == "__main__":
    main()
