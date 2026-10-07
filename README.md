# MonTrioHockey

Tes joueurs de hockey préférés, toutes les ligues, au même endroit.

Scores, classement, meneurs et stats de la LNH, de la LAH, des ligues junior (LHJMQ, OHL, WHL) et de l'Europe (KHL, SHL, Liiga, National League), avec le suivi de tes joueurs préférés.

## Les fichiers

| Fichier | À quoi il sert |
|---|---|
| `index.html` | La structure du site : 6 pages (À la une, Scores, Mes favoris, Classement, Meneurs, Joueurs) |
| `manifest.webmanifest`, `sw.js`, `icones/` | Ce qui permet d'installer MonTrioHockey comme une application sur le téléphone |
| `style.css` | L'apparence (couleurs, thème sombre, version téléphone) |
| `app.js` | Ce qui réagit aux clics et affiche les données |
| `plus.js` | Les fenêtres de détail : sommaire de match, fiche d'équipe, comparateur, joueurs en feu, alertes, lexique |
| `config.js` | Les réglages (adresse du relais pour le direct) |
| `donnees.js` | Ce qu'aucune source ne publie : les joueurs hors des ligues suivies |
| `data/` | Les données de la LNH, mises à jour automatiquement par le robot |
| `data/ligues/` | Les données de la LAH, de la LHJMQ, de l'OHL, de la WHL, de la Liiga et de la KHL |
| `scripts/maj-donnees.mjs` | Le robot qui va chercher les données des 32 équipes de la LNH |
| `scripts/maj-autres-ligues.mjs` | Le robot de la LAH et des juniors |
| `scripts/maj-europe.mjs` | Le robot des ligues d'Europe : KHL, SHL (Suède), Liiga (Finlande), National League (Suisse) |
| `.github/workflows/maj-donnees.yml` | Dit à GitHub de lancer le robot toutes les 30 minutes environ |
| `relais/` | Le relais optionnel pour le direct à la seconde (voir `relais/LISEZMOI.md`) |

## Les mises à jour

- **Stats, résultats, calendrier, effectifs, classement** : automatiques. Pour forcer une mise à jour, va dans l'onglet **Actions**, choisis « Mise à jour des stats », puis « Run workflow ».
- **Scores pendant les matchs** : aux 20 secondes une fois le relais installé.
- **À la une** : articles de Google Actualités (titre, source et lien seulement).

Site non officiel, sans lien avec la LNH ni aucune de ses équipes.
