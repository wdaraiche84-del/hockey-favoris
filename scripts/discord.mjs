// =============================================================
// LE ROBOT DISCORD (lancé par .github/workflows/discord.yml)
//   1. Installe ce qu'il faut sur le serveur (sans rien effacer) :
//      les commandes /score, /joueur et /classement, le salon
//      #résultats (lecture seule) et le bouton « 🔔 Annonces ».
//   2. Publie dans #annonces les nouvelles entrées de data/annonces.json
//      (avec une mention du rôle 🔔 Annonces).
// Le jeton du bot vient du secret GitHub DISCORD_TOKEN (jamais dans le code).
// Ce qui a déjà été publié est noté dans data/discord.json.
// =============================================================

import { readFile, writeFile } from "node:fs/promises";

const API = "https://discord.com/api/v10";
const SITE = "https://wdaraiche84-del.github.io/hockey-favoris/";
const ORANGE = 0xEA580C;
const TOKEN = process.env.DISCORD_TOKEN;
// Permissions (valeurs de Discord)
// (le bot ne peut donner que des droits qu'il a lui-même : voir, écrire, liens, historique)
const VOIR = 1 << 10, ECRIRE = 1 << 11, LIENS = 1 << 14, HISTORIQUE = 1 << 16;

export async function api(chemin, methode = "GET", corps) {
  for (let essai = 1; ; essai++) {
    const r = await fetch(API + chemin, {
      method: methode,
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "DiscordBot (MonTrioHockey, 1)" },
      body: corps ? JSON.stringify(corps) : undefined,
    });
    if (r.status === 429 && essai < 4) { await new Promise((ok) => setTimeout(ok, 2000 * essai)); continue; } // trop vite : on attend
    if (!r.ok) throw new Error(`${methode} ${chemin} → ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  }
}
const lireJson = async (f, defaut) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return defaut; } };

export const COMMANDES = [
  { name: "score", description: "Les matchs de la LNH aujourd'hui, en direct" },
  { name: "joueur", description: "Les stats d'un joueur de la LNH",
    options: [{ type: 3, name: "nom", description: "Le nom du joueur (ex. Suzuki)", required: true }] },
  { name: "classement", description: "Le classement de la LNH",
    options: [{ type: 3, name: "groupe", description: "Quelle partie du classement", required: false,
      choices: [{ name: "Association de l'Est", value: "est" }, { name: "Association de l'Ouest", value: "ouest" }, { name: "Toute la ligue", value: "ligue" }] }] },
];

export async function installer() {
  const app = await api("/applications/@me");
  const serveurs = await api("/users/@me/guilds");
  if (serveurs.length !== 1) throw new Error(`Le bot doit être dans un seul serveur (il est dans ${serveurs.length}).`);
  const g = serveurs[0].id, moi = app.bot?.id || app.id;
  console.log(`Serveur : ${serveurs[0].name}`);

  // 1. Commandes (propres au serveur : elles apparaissent tout de suite)
  await api(`/applications/${app.id}/guilds/${g}/commands`, "PUT", COMMANDES);
  console.log("✔ Commandes /score, /joueur et /classement");

  const salons = await api(`/guilds/${g}/channels`);
  const roles = await api(`/guilds/${g}/roles`);
  const salon = (nom) => salons.find((c) => c.type === 0 && c.name === nom);
  const droitsBot = { id: moi, type: 1, allow: String(VOIR | ECRIRE | LIENS | HISTORIQUE), deny: "0" };

  // 2. Le bot peut écrire dans la catégorie 📢 INFORMATIONS (en lecture seule pour les membres).
  //    Discord exige ce droit dans la catégorie avant de le donner dans ses salons.
  const info = salons.find((c) => c.type === 4 && c.name === "📢 INFORMATIONS");
  if (info) await api(`/channels/${info.id}/permissions/${moi}`, "PUT", { type: 1, allow: droitsBot.allow, deny: "0" });

  // 3. Salon #résultats : il reprend les réglages de la catégorie (lecture seule, seul le bot écrit)
  let resultats = salon("résultats");
  if (!resultats) {
    resultats = await api(`/guilds/${g}/channels`, "POST", info
      ? { name: "résultats", type: 0, parent_id: info.id, topic: "Le résultat de chaque match de la LNH, dès la fin du match" }
      : { name: "résultats", type: 0, topic: "Le résultat de chaque match de la LNH, dès la fin du match",
          permission_overwrites: [{ id: g, type: 0, allow: "0", deny: String(ECRIRE) }, droitsBot] });
    console.log("✔ Salon #résultats créé");
  } else console.log("• #résultats existe déjà");

  // Le bot peut écrire dans les salons en lecture seule où il publie
  for (const nom of ["résultats", "annonces", "bienvenue"]) {
    const c = nom === "résultats" ? resultats : salon(nom);
    if (c) await api(`/channels/${c.id}/permissions/${moi}`, "PUT", { type: 1, allow: droitsBot.allow, deny: "0" });
  }
  console.log("✔ Le bot peut écrire dans #résultats, #annonces et #bienvenue");

  // Le bot peut écrire dans #modération (salon privé de l'équipe) pour la surveillance du site
  const equipe = salons.find((c) => c.type === 4 && c.name === "🔒 ÉQUIPE");
  const moderation = salon("modération");
  if (equipe && moderation) {
    await api(`/channels/${equipe.id}/permissions/${moi}`, "PUT", { type: 1, allow: droitsBot.allow, deny: "0" });
    await api(`/channels/${moderation.id}/permissions/${moi}`, "PUT", { type: 1, allow: droitsBot.allow, deny: "0" });
    console.log("✔ Le bot peut écrire dans #modération (surveillance du site)");
  }

  // 4. Le rôle du bot doit être au-dessus de 🔔 Annonces pour pouvoir le donner
  const annonces = roles.find((r) => r.name === "🔔 Annonces");
  const membre = await api(`/guilds/${g}/members/${moi}`);
  const hautBot = Math.max(0, ...roles.filter((r) => membre.roles.includes(r.id)).map((r) => r.position));
  if (annonces && annonces.position >= hautBot) {
    console.log("⚠️  Le rôle du bot est sous « 🔔 Annonces » : le bouton ne pourra pas donner le rôle.");
    console.log("    Paramètres du serveur → Rôles → glisse le rôle du bot au-dessus de « 🔔 Annonces ».");
  }

  // 5. Le bouton « 🔔 Annonces » dans #bienvenue (une seule fois)
  const bienvenue = salon("bienvenue");
  if (bienvenue && annonces) {
    const recents = await api(`/channels/${bienvenue.id}/messages?limit=50`);
    const dejaLa = recents.some((m) => m.author?.id === moi && JSON.stringify(m.components || []).includes("role:annonces"));
    if (!dejaLa) {
      await api(`/channels/${bienvenue.id}/messages`, "POST", {
        content: "## 🔔 Les annonces\nClique sur le bouton pour recevoir une mention quand une grosse nouveauté arrive sur MonTrioHockey.\nClique de nouveau pour l'enlever. Tu es le seul à voir la réponse.",
        components: [{ type: 1, components: [{ type: 2, style: 1, label: "Recevoir les annonces", emoji: { name: "🔔" }, custom_id: "role:annonces" }] }],
        allowed_mentions: { parse: [] },
      });
      console.log("✔ Bouton « 🔔 Annonces » publié dans #bienvenue");
    } else console.log("• Le bouton « 🔔 Annonces » est déjà dans #bienvenue");
  }
  return { salon, annonces };
}

// Les nouvelles annonces de data/annonces.json → #annonces
export async function publierAnnonces({ salon, annonces }) {
  const liste = await lireJson("data/annonces.json", []);
  const etat = await lireJson("data/discord.json", { annonces: [] });
  const c = salon("annonces");
  if (!c) { console.log("• Pas de salon #annonces"); return; }
  // Ce qui est déjà dans #annonces (au cas où deux lancements se croisent)
  const moi = (await api("/users/@me")).id;
  const dejaPubliees = new Set((await api(`/channels/${c.id}/messages?limit=50`))
    .filter((m) => m.author?.id === moi).flatMap((m) => (m.embeds || []).map((e) => e.title)));
  for (const a of liste) {
    if (etat.annonces.includes(a.id) || dejaPubliees.has(a.titre)) {
      if (!etat.annonces.includes(a.id)) etat.annonces.push(a.id);
      continue;
    }
    await api(`/channels/${c.id}/messages`, "POST", {
      content: annonces ? `<@&${annonces.id}>` : "",
      embeds: [{ title: a.titre, description: a.texte, color: ORANGE, url: a.lien || SITE, footer: { text: "MonTrioHockey" } }],
      allowed_mentions: { roles: annonces ? [annonces.id] : [] },
    });
    etat.annonces.push(a.id);
    console.log(`✔ Annonce publiée : ${a.titre}`);
  }
  await writeFile("data/discord.json", JSON.stringify(etat, null, 1) + "\n");
}

if (process.argv[1]?.endsWith("discord.mjs")) {
  if (!TOKEN) { console.log("Pas de secret DISCORD_TOKEN : rien à faire."); process.exit(0); }
  await publierAnnonces(await installer());
}
