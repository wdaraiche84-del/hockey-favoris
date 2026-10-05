# Mes Favoris Hockey

Scores, classement, meneurs et stats de toute la LNH, avec le suivi de tes joueurs préférés.

## Les fichiers

| Fichier | À quoi il sert |
|---|---|
| `index.html` | La structure du site : 6 pages (À la une, Scores, Mes favoris, Classement, Meneurs, Joueurs) |
| `style.css` | L'apparence (couleurs, thème sombre, version téléphone) |
| `app.js` | Ce qui réagit aux clics et affiche les données |
| `config.js` | Les réglages (adresse du relais pour le direct) |
| `donnees.js` | Ce que la LNH ne publie pas : les trios, les joueurs hors LNH |
| `data/` | Les données de la LNH, mises à jour automatiquement par le robot |
| `scripts/maj-donnees.mjs` | Le robot qui va chercher les données des 32 équipes |
| `.github/workflows/maj-donnees.yml` | Dit à GitHub de lancer le robot toutes les 30 minutes environ |
| `relais/` | Le relais optionnel pour le direct à la seconde (voir `relais/LISEZMOI.md`) |

## Les mises à jour

- **Stats, résultats, calendrier, effectifs, classement** : automatiques. Pour forcer une mise à jour, va dans l'onglet **Actions**, choisis « Mise à jour des stats », puis « Run workflow ».
- **Scores pendant les matchs** : aux 20 secondes une fois le relais installé.
- **Trios et paires** : à la main, dans `donnees.js` (la LNH ne les publie pas).

Site non officiel, sans lien avec la LNH ni aucune de ses équipes.
