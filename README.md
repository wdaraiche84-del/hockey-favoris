# Mes Favoris Hockey

Un site pour suivre ses joueurs de hockey préférés : calendrier, statistiques, équipe et trios.

## Les fichiers

| Fichier | À quoi il sert |
|---|---|
| `index.html` | La structure de la page (les sections) |
| `style.css` | L'apparence (couleurs, tailles, mise en page) |
| `app.js` | Ce qui réagit aux clics (favoris, recherche, fiche joueur) |
| `donnees.js` | Les trios du Canadien, plus des données de secours écrites à la main |
| `data/mtl.json` | Les stats et le calendrier, mis à jour automatiquement par le robot |
| `scripts/maj-donnees.mjs` | Le robot qui va chercher les stats auprès de la LNH |
| `.github/workflows/maj-donnees.yml` | Dit à GitHub de lancer le robot toutes les 30 minutes environ |

## Les mises à jour

- **Stats, résultats, calendrier, effectif** : automatiques. Pour forcer une mise à jour, va dans l'onglet **Actions**, choisis « Mise à jour des stats », puis « Run workflow ».
- **Trios et paires** : à la main, dans `donnees.js` (la LNH ne les publie pas).

Site non officiel, sans lien avec la LNH ni aucune de ses équipes.
