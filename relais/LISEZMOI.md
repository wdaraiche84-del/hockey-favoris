# Le relais de MonTrioHockey (Cloudflare Workers, gratuit)

Le relais fait deux choses :

1. **Le direct** : les scores et les points de tes favoris se rafraîchissent
   toutes les 20 secondes pendant les matchs de la LNH.
2. **Les alertes sur le téléphone** : un rappel 30 minutes avant le match,
   une notification quand un de tes favoris de la LNH marque ou obtient une
   passe, quand ton équipe marque, et le résultat final — même quand
   MonTrioHockey est fermé.

## Mettre le code à jour (à faire chaque fois que `relais/worker.js` change)

1. Va sur **dash.cloudflare.com** → **Workers & Pages** → ton relais.
2. Clique sur **Edit code**. Efface tout et colle le contenu de `relais/worker.js`
   (sur GitHub, le bouton « Copy raw file » copie tout d'un coup).
3. Clique sur **Deploy**.

## Activer les alertes (une seule fois, environ 5 minutes)

Le relais a besoin d'un petit espace pour se souvenir des abonnés (KV)
et d'un réveil chaque minute (Cron).

1. **Créer l'espace** : dans le menu de gauche, **Storage & Databases** → **KV**
   → **Create** (ou « Create namespace »). Nom : `montrio-abonnes`. Clique **Add**.
2. **Le relier au relais** : retourne dans ton relais → onglet **Settings**
   → **Bindings** → **Add** → **KV namespace**.
   - Variable name : `ABONNES` (en majuscules, exactement comme ça)
   - KV namespace : `montrio-abonnes`
   - Clique **Add binding** (ou **Deploy**).
3. **Le réveil chaque minute** : toujours dans **Settings** → **Trigger events**
   (ou « Triggers ») → **Add** → **Cron triggers** → choisis « Every minute »
   ou écris `* * * * *` → **Add**.
4. Vérifie : ouvre `https://TON-RELAIS.workers.dev/alertes/etat`.
   Tu dois voir `{"actif":true}`.

C'est tout : aucune clé secrète à copier. Le relais crée lui-même sa clé
d'envoi la première fois et la garde dans son espace KV.

## Limites du plan gratuit

Largement suffisant pour commencer : le relais n'écrit dans son espace que
lorsqu'un but est marqué ou qu'un match se termine.
Sur iPhone, les alertes fonctionnent seulement si MonTrioHockey est installé sur
l'écran d'accueil (iOS 16.4 ou plus récent).

## Le bot Discord (résultats, commandes, bouton 🔔 Annonces)

Le relais sert aussi de bot Discord :
- le résultat de chaque match de la LNH dans **#résultats**, dès la fin du match ;
- les commandes **/score**, **/joueur** et **/classement** ;
- le bouton **🔔 Recevoir les annonces** (dans #bienvenue) qui donne ou enlève le rôle.

Le robot GitHub `.github/workflows/discord.yml` installe le salon #résultats,
le bouton et les commandes, et publie dans #annonces chaque nouvelle entrée de
`data/annonces.json`.

À configurer une fois :
1. **Cloudflare** → le relais → **Settings** → **Variables and Secrets** :
   - `DISCORD_TOKEN` (type **Secret**) : le jeton du bot ;
   - `DISCORD_PUBLIC_KEY` (type **Text**) : la « Public Key » de l'application
     (Discord Developer Portal → General Information).
2. **Discord Developer Portal** → General Information → **Interactions Endpoint URL** :
   `https://TON-RELAIS.workers.dev/discord` → Save.
3. **GitHub** → Settings → Secrets and variables → Actions → secret `DISCORD_TOKEN`
   (le même jeton).
4. Inviter le bot avec les permissions : Manage Roles, Manage Channels, View Channels,
   Send Messages, Embed Links, Read Message History (portées `bot` et `applications.commands`).
5. Dans Discord : Paramètres du serveur → Rôles → glisser le rôle du bot **au-dessus**
   de « 🔔 Annonces ».
6. GitHub → Actions → **Discord** → **Run workflow**.
