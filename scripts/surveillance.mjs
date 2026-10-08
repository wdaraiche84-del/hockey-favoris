// =============================================================
// LA SURVEILLANCE DES ROBOTS (dernière étape de maj-donnees.yml)
// Vérifie que tout roule et prévient l'équipe dans #surveillance sur
// Discord quand un problème apparaît, puis quand il est réglé :
//   - une étape du robot a échoué (stats LNH, juniors, Europe, NCAA…) ;
//   - les scores d'une ligue ne se mettent plus à jour (des matchs
//     commencés depuis plus de 8 heures ne sont toujours pas terminés) ;
//   - le relais Cloudflare (direct, alertes, bot Discord) ne répond plus.
// Un même problème n'est signalé qu'une fois. L'état est gardé dans
// data/surveillance.json.
// =============================================================

import { readFile, writeFile } from "node:fs/promises";

const FICHIER = "data/surveillance.json";
const RELAIS = "https://empty-forest-740ehockey-relais.w-daraiche84.workers.dev";
const LIGUES = { lnh: "LNH", ahl: "LAH", lhjmq: "LHJMQ", ohl: "OHL", whl: "WHL", khl: "KHL", shl: "SHL", liiga: "Liiga", nl: "National League", ncaa: "NCAA" };
const ETAPES = { lnh: "les stats de la LNH", bios: "les fiches des joueurs de la LNH", autres: "la LAH et les juniors", europe: "les ligues d'Europe",
  ncaa: "la NCAA", images: "les images de partage", partage: "les liens de partage", chiffre: "le chiffre du jour" };
const lireJson = async (f, defaut) => { try { return JSON.parse(await readFile(f, "utf8")); } catch { return defaut; } };

// Les scores d'une ligue sont « figés » si la plupart des matchs commencés il y a 8 à 48 heures ne sont pas terminés
export function scoresFiges(calendrier, maintenant = Date.now()) {
  const fenetre = calendrier.filter((m) => {
    const t = Date.parse(m.debut || "");
    return t && maintenant - t > 8 * 3600e3 && maintenant - t < 48 * 3600e3;
  });
  const enRetard = fenetre.filter((m) => m.etat !== "fini");
  return enRetard.length >= 2 && enRetard.length > fenetre.length / 2 ? enRetard.length : 0;
}

export async function verifier({ etapes = {}, calendriers = {}, relaisOk = true } = {}) {
  const problemes = {};
  for (const [id, resultat] of Object.entries(etapes)) {
    if (resultat === "failure") problemes[`etape-${id}`] = `Le robot n'a pas réussi à mettre à jour ${ETAPES[id] || id}.`;
  }
  for (const [lig, cal] of Object.entries(calendriers)) {
    const n = scoresFiges(cal || []);
    const la = /^[AEIOU]/.test(LIGUES[lig]) ? "l'" : "la ";
    if (n) problemes[`scores-${lig}`] = `Les scores de ${la}${LIGUES[lig]} ne se mettent plus à jour (${n} matchs terminés depuis des heures sont encore affichés « à venir »).`;
  }
  if (!relaisOk) problemes.relais = "Le relais Cloudflare ne répond pas : le direct, les alertes et le bot Discord peuvent être en panne.";
  return problemes;
}

// Compare avec le passage précédent : ce qui est nouveau, ce qui est réglé
export function changements(avant, maintenant) {
  return {
    nouveaux: Object.entries(maintenant).filter(([k]) => !avant[k]),
    regles: Object.entries(avant).filter(([k]) => !maintenant[k]),
  };
}

async function relaisRepond() {
  for (let essai = 1; essai <= 2; essai++) {
    try { const r = await fetch(`${RELAIS}/alertes/etat`, { signal: AbortSignal.timeout(15000) }); if (r.ok) return true; } catch {}
  }
  return false;
}

async function prevenirDiscord(nouveaux, regles) {
  if (!process.env.DISCORD_TOKEN) { console.log("(pas de DISCORD_TOKEN : pas de message Discord)"); return; }
  const { api } = await import("./discord.mjs");
  const [g] = await api("/users/@me/guilds");
  const salon = (await api(`/guilds/${g.id}/channels`)).find((c) => c.type === 0 && c.name === "surveillance");
  if (!salon) throw new Error("pas encore de salon #surveillance (le robot Discord le crée)");
  const lien = process.env.LIEN_EXECUTION ? `\n[Voir les détails dans GitHub](${process.env.LIEN_EXECUTION})` : "";
  const lignes = [
    ...nouveaux.map(([, t]) => `⚠️ ${t}`),
    ...regles.map(([, t]) => `✅ Réglé : ${t}`),
  ];
  await api(`/channels/${salon.id}/messages`, "POST", {
    embeds: [{ title: nouveaux.length ? "🛠️ Surveillance du site : problème détecté" : "🛠️ Surveillance du site : tout est revenu à la normale",
      description: lignes.join("\n").slice(0, 3900) + lien, color: nouveaux.length ? 0xDC2626 : 0x16A34A }],
    allowed_mentions: { parse: [] },
  });
}

if (process.argv[1]?.endsWith("surveillance.mjs")) {
  let etapes = {};
  try { etapes = JSON.parse(process.env.ETAPES || "{}"); } catch {}
  const calendriers = { lnh: await lireJson("data/calendrier.json", []) };
  for (const lig of Object.keys(LIGUES)) if (lig !== "lnh") calendriers[lig] = await lireJson(`data/ligues/${lig}/calendrier.json`, []);
  const actuels = await verifier({ etapes, calendriers, relaisOk: await relaisRepond() });
  const etat = await lireJson(FICHIER, { problemes: {} });
  const { nouveaux, regles } = changements(etat.problemes || {}, actuels);
  for (const [, t] of Object.entries(actuels)) console.log("⚠️", t);
  if (!Object.keys(actuels).length) console.log("✔ Tout roule.");
  if (nouveaux.length || regles.length) {
    try {
      await prevenirDiscord(nouveaux, regles);
      // On note l'état seulement si l'équipe a été prévenue (sinon on réessaie au prochain passage)
      await writeFile(FICHIER, JSON.stringify({ problemes: actuels }, null, 1) + "\n");
      console.log("État noté.");
    } catch (e) { console.log("Discord :", e.message); }
  }
}
