# MonTrioHockey : notes pour Claude

Site de hockey en français, fait pour le Québec : scores, classements, stats, récits de match et favoris pour 10 ligues (LNH, LAH, LHJMQ, OHL, WHL, KHL, SHL, Liiga, National League, NCAA).
Le propriétaire s'appelle **Will**. Il est débutant en programmation : explique simplement, en français, sans jargon.
Adresse actuelle : https://wdaraiche84-del.github.io/hockey-favoris/ (GitHub Pages, branche `main`). Nom de domaine prévu au lancement : montriohockey.ca.

## Règles de Will (à respecter)
- Ce qu'il ne veut pas sur le site :
  - aucune bagarre ;
  - aucun site de paris ;
  - aucun article d'autres sites (le contenu est le nôtre : récits écrits automatiquement) ;
  - pas de section « Québécois » ni de page d'espoirs du Canadien ;
  - pas de liste de coéquipiers, pas d'agenda .ics ;
  - pas de favoris imposés au premier passage.
- Images : seulement neutres et non trompeuses. Aucune photo de joueur ou d'équipe qui pourrait induire en erreur.
- Couleurs : orange (`--accent:#EA580C`) sur fond charbon, en mode clair et en mode sombre. Le site ne doit être associé à aucune équipe.
- Lancement public : seulement quand Will dira que l'app est « 100 % fonctionnelle ».
- Montrer un aperçu à Will avant les gros changements visuels.

## Sécurité
- Le dépôt est **public** : aucun secret dans le code.
- La clé API-Sports vit seulement dans le secret GitHub `APISPORTS_KEY`. Ne jamais l'écrire ni la demander dans la conversation.
- Les clés des alertes (VAPID) sont créées par le relais et gardées dans Cloudflare KV.

## Comment c'est fait
- **Front** :
  - `index.html`, `style.css`, `app.js`, puis `plus.js`.
  - `plus.js` est la 2e partie : il remplace certaines fonctions de `app.js` en les réassignant, et appelle `demarrer()` à la fin.
  - `config.js` contient l'adresse du relais.
  - `donnees.js` contient les joueurs hors ligues (ex. NCAA).
- **À chaque publication**, il faut changer la version :
  - le `?v=NN` des fichiers dans `index.html` et `sw.js` ;
  - `VERSION = "montrio-vNN"` dans `sw.js`.
  - Sinon les téléphones gardent l'ancienne version.
- **Robot** (`.github/workflows/maj-donnees.yml`) : il tourne aux 30 minutes et lance dans l'ordre :
  1. `scripts/maj-donnees.mjs` (LNH)
  2. `maj-bios.mjs`
  3. `maj-autres-ligues.mjs` (LAH et ligues juniors, via HockeyTech)
  4. `maj-europe.mjs` (KHL, SHL, Liiga, NL)
  5. `maj-ncaa.mjs` (NCAA, Division 1 masculine : pages de College Hockey News ; stats et alignements relus seulement quand l'équipe vient de jouer ; état dans `data/ligues/ncaa/etat.json`)
  6. `maj-images.py` (images d'aperçu 600 × 315)
  7. `maj-partage.mjs` (mini-pages de partage, ex. `lnh/joueur/nick-suzuki/8480018/`)
- **Format des lignes de match** (`data/points/…`) :
  - patineur : `[B, A, +/-, tirs, PUN, TG]`
  - gardien : `["G", arrêts, tirs, BC, décision, TG]`
- **Relais Cloudflare** (`relais/worker.js`) : le direct pendant les matchs et les alertes (rappel 30 min avant le match, buts, résultat final). Voir `relais/LISEZMOI.md`.
- **Discord** : serveur de support. Le relais fait aussi le bot (résultats LNH dans #résultats, /score, /joueur, /classement, bouton 🔔 Annonces ; secrets Cloudflare `DISCORD_TOKEN` et `DISCORD_PUBLIC_KEY`). `.github/workflows/discord.yml` (secret GitHub `DISCORD_TOKEN`) installe #résultats, le bouton et les commandes, et publie les nouvelles entrées de `data/annonces.json` dans #annonces : **ajouter une entrée à chaque grosse nouveauté**. Outil de création du serveur : `outils/discord/`.
- **Avec Will** : une seule méthode, une étape à la fois, des liens directs ; tester avant d'envoyer ; un seul fichier au même nom (pas de versions multiples).
- **Adresses** :
  - fenêtres : `#/joueur/ID`, `#/equipe/ID`, `#/match/ID`, `#/comparer/A/B`, `#/a-propos`
  - adresses lisibles : `PREFIXE` dans `plus.js` et dans `scripts/maj-partage.mjs`
- **Heures** : toujours celles de l'appareil du visiteur. Utiliser `heureDe()` et `dateLocale()`.
- **Explorer une source de données** : les requêtes du bac à sable vers les sites des ligues sont bloquées. Il faut passer par un workflow temporaire, qui écrit dans la branche orpheline `exploration`, puis le supprimer.

## À faire / en attente
- **Alertes** : activées dans Cloudflare le 8 octobre 2026 (relais `empty-forest-740ehockey-relais`, KV `montrio-abonnes` relié sous `ABONNES`, cron chaque minute). Reste à confirmer qu'elles arrivent sur un vrai téléphone pendant un match. Le relais `old-pine-be0ehockey-relais` ne sert pas : on peut le supprimer.
- **Au lancement** :
  - brancher montriohockey.ca : DNS, fichier `CNAME` ;
  - changer `SITE` dans `scripts/maj-partage.mjs`, les balises meta d'`index.html`, `robots.txt`, `sitemap.xml` et `SITE_PRINCIPAL` du relais ;
  - Google Search Console.
- **Noté pour plus tard** : ajouter « HE » après l'heure dans les aperçus de liens partagés (image et texte).
- **Avant le lancement** : un test sur iPhone.
- **Compteur de visites** : Cloudflare Web Analytics (constante `ANALYTIQUE` dans `config.js`, site `wdaraiche84-del.github.io`). Au lancement, ajouter montriohockey.ca dans Web Analytics.
- **Courriel de contact** : Will veut `contact@montriohockey.ca`, à créer avec le nom de domaine au lancement (la constante `CONTACT` dans `plus.js` ; page À propos).
- **Idées** :
  - équipe favorite ;
  - cartes de stats à partager ;
  - « chiffre du jour » ;
  - graphique des points d'un joueur ;
  - rythme de la saison ;
  - gardiens de la Liiga ;
  - salaires (seulement si une source légale existe).
