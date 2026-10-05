# Installer le relais pour le direct à la seconde

Sans relais, le site se met à jour aux 30 minutes environ grâce au robot.
Avec le relais, les scores et les points de tes favoris se rafraîchissent
toutes les 20 secondes pendant les matchs. C'est gratuit.

## Étapes (environ 10 minutes)

1. Crée un compte gratuit sur **dash.cloudflare.com/sign-up**.
2. Dans le menu de gauche, va dans **Compute (Workers)** → **Workers & Pages**, puis clique sur **Create** → **Start with Hello World**.
3. Donne-lui le nom **hockey-relais**, puis clique sur **Deploy**.
4. Clique sur **Edit code**. Efface tout le code affiché et colle le contenu du fichier `relais/worker.js`.
5. Clique sur **Deploy** en haut à droite.
6. Copie l'adresse du relais, qui ressemble à `https://hockey-relais.ton-nom.workers.dev`.
7. Donne cette adresse à Claude : il la mettra dans `config.js` (la ligne `const RELAIS = "";`).

## Vérifier que ça marche

Ouvre `https://hockey-relais.ton-nom.workers.dev/v1/score/now` dans ton navigateur.
Tu devrais voir une page pleine de texte avec les matchs du jour. C'est bon signe!
