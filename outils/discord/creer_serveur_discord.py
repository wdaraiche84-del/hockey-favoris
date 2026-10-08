# =============================================================
# CRÉER LE SERVEUR DISCORD DE MONTRIOHOCKEY (complet, prêt à ouvrir)
#
# À lancer UNE fois sur un serveur neuf. Il fait tout :
#   - les réglages de sécurité du serveur et son icône ;
#   - les rôles et leurs permissions ;
#   - les catégories, les salons texte et vocal, les salons privés ;
#   - les messages (bienvenue, règles, rôles, FAQ, guides),
#     avec des liens cliquables vers les salons et les rôles.
# Si on le relance, il ne crée pas de doublons : il garde ce qui existe
# et publie les messages seulement dans les salons qu'il vient de créer.
#
# Avant de le lancer :
#   1. pip install discord.py
#   2. Inviter le bot dans le serveur avec la permission « Administrateur ».
# Le jeton (token) du bot est demandé au lancement : il n'est jamais
# écrit dans ce fichier. Ne le partage avec personne.
# =============================================================

import re
import urllib.request
import discord

SITE = "https://wdaraiche84-del.github.io/hockey-favoris/"
ICONE = SITE + "icones/icone-512.png"
ORANGE, ROUGE, VERT, GRIS = 0xEA580C, 0xDC2626, 0x16A34A, 0x78716C
P = discord.Permissions

# ---- Les rôles (du plus haut au plus bas) ------------------------
ROLES = [
    # nom, couleur, affiché à part, permissions
    ("👑 Fondateur", ORANGE, True, P(administrator=True)),
    ("🛡️ Modérateur", ROUGE, True, P(manage_messages=True, manage_threads=True, kick_members=True, moderate_members=True,
                                     mute_members=True, move_members=True, deafen_members=True, view_audit_log=True,
                                     manage_nicknames=True, mention_everyone=True)),
    ("🧪 Testeur", VERT, True, P.none()),
    ("🔔 Annonces", GRIS, False, P.none()),
]
# Ce que tout le monde (@everyone) peut faire dans le serveur
PERMS_TOUS = P(view_channel=True, send_messages=True, send_messages_in_threads=True, create_public_threads=True,
               read_message_history=True, add_reactions=True, embed_links=True, attach_files=True,
               use_external_emojis=True, use_external_stickers=True, connect=True, speak=True, stream=True,
               use_voice_activation=True, use_application_commands=True, create_instant_invite=True,
               change_nickname=True)

# ---- Les salons ---------------------------------------------------
# Accès d'une catégorie : "public", "lecture" (tout le monde lit, l'équipe écrit), ou une liste de rôles (privé)
# Salon : (nom, sujet, type "texte"/"vocal", délai entre 2 messages en secondes, accès propre ou None)
STRUCTURE = [
    ("📢 INFORMATIONS", "lecture", [
        ("bienvenue", "Bienvenue sur le Discord de MonTrioHockey!", "texte", 0, None),
        ("règles", "Les règles du serveur : à lire avant d'écrire", "texte", 0, None),
        ("annonces", "Les nouveautés du site MonTrioHockey", "texte", 0, None),
        ("faq", "Les questions qu'on nous pose souvent", "texte", 0, None),
    ]),
    ("🛟 SUPPORT", "public", [
        ("aide", "Une question sur le site? Pose-la ici", "texte", 15, None),
        ("signaler-un-bug", "Un problème sur le site? Décris-le ici (voir le message épinglé)", "texte", 30, None),
        ("suggestions", "Tes idées pour améliorer le site, une idée par message", "texte", 30, None),
    ]),
    ("🏒 HOCKEY", "public", [
        ("discussion-générale", "On jase de hockey, toutes ligues confondues", "texte", 0, None),
        ("lnh", "La Ligue nationale", "texte", 0, None),
        ("lah-et-juniors", "LAH, LHJMQ, OHL, WHL : la relève", "texte", 0, None),
        ("europe-et-ncaa", "KHL, SHL, Liiga, National League et hockey universitaire", "texte", 0, None),
        ("hors-sujet", "Tout ce qui n'est pas du hockey (en restant poli!)", "texte", 0, None),
        ("🎙️ Match en direct", None, "vocal", 0, None),
    ]),
    ("🧪 TESTEURS", ["🧪 Testeur", "🛡️ Modérateur"], [
        ("tests-bêta", "Pour essayer les nouveautés avant tout le monde", "texte", 0, None),
    ]),
    ("🔒 ÉQUIPE", ["🛡️ Modérateur"], [
        ("modération", "Discussions de l'équipe de modération", "texte", 0, None),
        ("journal", "Notes : avertissements, expulsions, décisions", "texte", 0, None),
        ("🎙️ Réunion d'équipe", None, "vocal", 0, None),
    ]),
]


# ---- Les messages (s = salons, r = rôles, pour les liens cliquables) ----
def messages(s, r):
    return {
        "bienvenue": [f"""# Bienvenue sur le Discord de MonTrioHockey 🏒

**MonTrioHockey**, c'est le hockey de toutes les ligues, en français : scores, classements, stats et récits de match pour la LNH, la LAH, les juniors, l'Europe et la NCAA. Ajoute tes joueurs préférés à tes favoris et suis leurs matchs, peu importe où ils jouent.

👉 **Le site : {SITE}**

## Par où commencer?
1️⃣ Lis les règles dans {s['règles']}
2️⃣ Une question sur le site? Va dans {s['aide']}
3️⃣ Un problème? Écris dans {s['signaler-un-bug']}
4️⃣ Une idée? Partage-la dans {s['suggestions']}
5️⃣ Envie de jaser hockey? Viens dans {s['discussion-générale']}

Les nouveautés du site sont publiées dans {s['annonces']} et les réponses aux questions fréquentes sont dans {s['faq']}.""",
f"""## Les salons
**📢 Informations**
{s['bienvenue']} : tu es ici!
{s['règles']} : les règles du serveur
{s['annonces']} : les nouveautés du site
{s['faq']} : les questions fréquentes

**🛟 Support**
{s['aide']} : tes questions sur le site
{s['signaler-un-bug']} : les problèmes à corriger
{s['suggestions']} : tes idées

**🏒 Hockey**
{s['discussion-générale']} · {s['lnh']} · {s['lah-et-juniors']} · {s['europe-et-ncaa']} · {s['hors-sujet']}
{s['🎙️ Match en direct']} : pour regarder un match ensemble""",
f"""## Les rôles
{r['👑 Fondateur']} : le créateur de MonTrioHockey
{r['🛡️ Modérateur']} : l'équipe qui veille au respect des règles. Une question ou un problème avec un membre? Écris-leur.
{r['🧪 Testeur']} : les membres qui essaient les nouveautés avant tout le monde, dans un salon privé. Tu veux devenir testeur? Demande-le dans {s['aide']}.
{r['🔔 Annonces']} : reçoit une mention quand une grosse nouveauté arrive.

Tout le monde peut lire et écrire dans les salons de support et de hockey dès son arrivée."""],

        "règles": [f"""# Les règles du serveur

**1. Le respect avant tout.** Aucune insulte, aucun harcèlement, aucun propos haineux, raciste, sexiste ou discriminatoire. On peut ne pas être d'accord sans être méchant.

**2. Aucun pari.** Pas de liens, de codes promo, de cotes ni de conseils de sites de paris.

**3. Pas de bagarres.** Pas de vidéos, d'images ni de discussions qui mettent en valeur les bagarres.

**4. Pas de pourriel ni de publicité.** Pas d'autopromotion, de liens d'invitation vers d'autres serveurs ni de messages répétés.

**5. Garde tes infos privées.** Ne partage pas d'informations personnelles, les tiennes ou celles des autres.

**6. Le bon salon au bon endroit.** Les questions dans {s['aide']}, les bogues dans {s['signaler-un-bug']}, les idées dans {s['suggestions']}, le reste dans {s['hors-sujet']}.

**7. Contenu approprié.** Aucun contenu choquant, violent ou pour adultes. Pas de pseudonyme ni d'image de profil offensants.

**8. Français d'abord.** Le serveur est en français ; tout le monde est le bienvenu.

**9. Écoute l'équipe.** Les décisions des {r['🛡️ Modérateur']} doivent être respectées. Tu n'es pas d'accord? Écris-leur en privé, calmement.""",
f"""## Ce qui arrive si une règle n'est pas respectée
1️⃣ Un avertissement
2️⃣ Une mise en sourdine temporaire
3️⃣ Une expulsion du serveur
Les cas graves (haine, harcèlement, contenu choquant) peuvent mener directement à l'expulsion.

*MonTrioHockey est un site de fan indépendant, affilié à aucune ligue ni à aucune équipe. Les noms des ligues et des équipes appartiennent à leurs propriétaires respectifs.*

En restant sur le serveur, tu acceptes ces règles. Bonne visite! 🏒"""],

        "annonces": [f"""# 📢 Bienvenue dans les annonces!

Ici, on publie les nouveautés de MonTrioHockey : nouvelles ligues, nouvelles fonctions et corrections importantes.

**Le site compte maintenant 10 ligues** : LNH, LAH, LHJMQ, OHL, WHL, KHL, SHL, Liiga, National League et NCAA. 🎉

Pour ne rien manquer, active les notifications de ce salon : clic droit (ou appui long) sur {s['annonces']} → *Paramètres de notification* → *Tous les messages*."""],

        "faq": [f"""# ❓ Questions fréquentes

**C'est quoi MonTrioHockey?**
Un site de fan indépendant, en français, qui regroupe les scores, classements, stats et récits de match de 10 ligues de hockey. C'est gratuit, sans compte et sans publicité.

**Comment ajouter un joueur à mes favoris?**
Touche la loupe 🔍 en haut du site, cherche le joueur, puis touche ⭐. Tes favoris restent sur ton appareil.

**Comment installer le site comme une application?**
• **iPhone** : dans Safari, touche Partager, puis *Sur l'écran d'accueil*.
• **Android** : dans Chrome, touche le menu ⋮, puis *Installer l'application*.

**Comment recevoir les alertes de buts?**
Touche 🔔 *Alertes* sur la page d'accueil et accepte les notifications. Tu reçois un rappel 30 minutes avant le match, une alerte quand tes favoris de la LNH marquent, et le résultat final. Sur iPhone, installe d'abord le site sur l'écran d'accueil.

**Les stats ne sont pas à jour?**
Les stats sont mises à jour environ aux 30 minutes, et en direct pendant les matchs de la LNH. Si un chiffre est encore faux après une heure, signale-le dans {s['signaler-un-bug']}.

**À quelle heure sont affichés les matchs?**
À l'heure de ton appareil.

**Il manque une ligue ou une fonction?**
Propose-la dans {s['suggestions']}!"""],

        "aide": [f"""# 🛟 Besoin d'aide?

Pose ta question ici, n'importe qui peut répondre, et l'équipe passe régulièrement.
Avant de demander, jette un œil à {s['faq']} : la réponse y est peut-être déjà.
Pour un problème sur le site, utilise plutôt {s['signaler-un-bug']}."""],

        "signaler-un-bug": [f"""# 🐛 Comment signaler un bogue

Pour qu'on puisse le corriger vite, indique :
• **La page** : ce que tu regardais (ex. fiche d'un joueur, classement de la NCAA)
• **Ce qui se passe** : ce que tu vois de travers
• **Ce que tu attendais**
• **Ton appareil** : iPhone, Android ou ordinateur, et le navigateur
• Une **capture d'écran** si possible

Un bogue par message, s'il te plaît. Merci, ça aide beaucoup! 🙏"""],

        "suggestions": ["""# 💡 Tes idées pour MonTrioHockey

Une idée pour améliorer le site? Écris-la ici, **une idée par message**.
Réagis avec 👍 aux idées que tu aimes : ça nous aide à choisir quoi faire en premier.
On répond aux idées retenues dans les annonces."""],

        "discussion-générale": ["""# 🏒 On jase de hockey!

Toutes les ligues, toutes les équipes, dans le respect. Garde les sujets précis pour les bons salons et n'oublie pas les règles : aucun pari, pas de bagarres."""],

        "tests-bêta": [f"""# 🧪 Salon des testeurs

Merci d'aider à tester MonTrioHockey! Ici, on partage les nouveautés avant tout le monde.
Note ce qui fonctionne et ce qui accroche, avec ton appareil et une capture d'écran.
Ce qui est montré ici reste ici jusqu'à l'annonce officielle dans {s['annonces']}."""],

        "modération": [f"""# 🔒 Salon de l'équipe

Salon privé des {r['🛡️ Modérateur']}.
**Rappels**
• Avertir d'abord, en privé si possible, puis sourdine, puis expulsion.
• Noter chaque intervention dans {s['journal']} : qui, quoi, quand, pourquoi.
• En cas de doute, on en parle ici avant d'agir.
• Aucune information personnelle des membres ne sort de ce salon."""],

        "journal": ["""# 📝 Journal de modération

Une ligne par intervention :
`date · membre · règle · action (avertissement / sourdine / expulsion) · par qui`"""],
    }


class Bot(discord.Client):
    def __init__(self, id_serveur, repartir):
        super().__init__(intents=discord.Intents.default())
        self.id_serveur = id_serveur
        self.repartir = repartir

    async def on_ready(self):
        try:
            await self.installer()
        except discord.Forbidden:
            print("\n❌ Permission refusée. Vérifie que le bot a bien la permission « Administrateur ».")
        except Exception as e:
            print(f"\n❌ Erreur : {e}")
        await self.close()

    async def installer(self):
        g = self.get_guild(self.id_serveur)
        if g is None:
            print("❌ Le bot ne trouve pas ce serveur. Vérifie le numéro et que le bot y est bien invité.")
            return
        print(f"Connecté au serveur « {g.name} ». Installation…\n")

        # 0. Repartir à neuf : on efface tous les salons et les rôles créés avant
        if self.repartir:
            for salon in list(g.channels):
                try:
                    await salon.delete()
                    print(f"🗑️ Salon effacé : {salon.name}")
                except discord.HTTPException:
                    print(f"• Impossible d'effacer {salon.name}")
            for role in list(g.roles):
                if role.is_default() or role.managed or role >= g.me.top_role:
                    continue  # @everyone, le rôle du bot et les rôles plus hauts que le bot restent
                try:
                    await role.delete()
                    print(f"🗑️ Rôle effacé : {role.name}")
                except discord.HTTPException:
                    pass
            print()

        # 1. Rôles (créés du plus haut au plus bas)
        roles = {}
        for nom, couleur, a_part, perms in ROLES:
            role = discord.utils.get(g.roles, name=nom)
            if role is None:
                role = await g.create_role(name=nom, colour=discord.Colour(couleur), hoist=a_part,
                                           mentionable=True, permissions=perms)
            roles[nom] = role
            print(f"✔ Rôle {nom}")
        # Ordre : juste sous le rôle du bot, dans l'ordre de la liste
        haut = g.me.top_role.position
        try:
            await g.edit_role_positions({role: max(1, haut - 1 - i) for i, role in enumerate(roles.values())})
        except discord.HTTPException:
            pass
        await g.default_role.edit(permissions=PERMS_TOUS)
        print("✔ Permissions de base de tout le monde (pas de @everyone pour les membres)")
        # Le propriétaire reçoit le rôle Fondateur
        try:
            proprio = await g.fetch_member(g.owner_id)
            await proprio.add_roles(roles["👑 Fondateur"])
            print(f"✔ {proprio.display_name} est 👑 Fondateur")
        except discord.HTTPException:
            print("• Donne-toi le rôle 👑 Fondateur à la main (Paramètres du serveur → Membres)")

        # 2. Catégories et salons
        tous, mods = g.default_role, roles["🛡️ Modérateur"]
        salons, nouveaux = {}, set()
        for nom_cat, acces, liste in STRUCTURE:
            if acces == "lecture":
                droits = {tous: discord.PermissionOverwrite(view_channel=True, send_messages=False, add_reactions=True,
                                                           create_public_threads=False, send_messages_in_threads=False),
                          mods: discord.PermissionOverwrite(send_messages=True, send_messages_in_threads=True)}
            elif acces == "public":
                droits = {tous: discord.PermissionOverwrite(view_channel=True)}
            else:  # privé : seulement les rôles nommés
                droits = {tous: discord.PermissionOverwrite(view_channel=False)}
                for nom_role in acces:
                    droits[roles[nom_role]] = discord.PermissionOverwrite(view_channel=True, send_messages=True,
                                                                          connect=True, speak=True)
            cat = discord.utils.get(g.categories, name=nom_cat)
            if cat is None:
                cat = await g.create_category(nom_cat, overwrites=droits)
            else:
                await cat.edit(overwrites=droits)
            for nom, sujet, type_, delai, _ in liste:
                existant = discord.utils.get(cat.channels, name=nom)
                if existant is None:
                    if type_ == "vocal":
                        existant = await g.create_voice_channel(nom, category=cat, overwrites=droits)
                    else:
                        existant = await g.create_text_channel(nom, category=cat, topic=sujet, slowmode_delay=delai,
                                                               overwrites=droits)
                    nouveaux.add(nom)
                    print(f"✔ {nom_cat} › {nom}")
                else:
                    print(f"• {nom_cat} › {nom} existe déjà, on le garde")
                salons[nom] = existant

        # 3. Messages (avec liens cliquables vers les salons et les rôles)
        s = {nom: c.mention for nom, c in salons.items()}
        r = {nom: role.mention for nom, role in roles.items()}
        for nom, textes in messages(s, r).items():
            if nom not in nouveaux:
                continue
            premier = None
            for t in textes:
                m = await salons[nom].send(t, allowed_mentions=discord.AllowedMentions.none(),
                                           suppress_embeds=True)
                premier = premier or m
            try:
                await premier.pin()
            except discord.HTTPException:
                pass
            print(f"✔ Messages publiés dans #{nom}")

        # 4. Réglages du serveur
        reglages = dict(
            verification_level=discord.VerificationLevel.medium,          # compte Discord de plus de 5 minutes
            explicit_content_filter=discord.ContentFilter.all_members,    # filtre les images choquantes
            default_notifications=discord.NotificationLevel.only_mentions,
            preferred_locale=discord.Locale.french,
            system_channel=salons["bienvenue"],                            # message quand quelqu'un arrive
            system_channel_flags=discord.SystemChannelFlags(join_notifications=True, premium_subscriptions=True,
                                                            guild_reminder_notifications=False, join_notification_replies=True),
        )
        try:
            with urllib.request.urlopen(ICONE, timeout=15) as rep:
                reglages["icon"] = rep.read()
        except Exception:
            print("• Icône du site introuvable : le serveur garde son icône actuelle")
        await g.edit(**reglages)
        print("✔ Réglages : vérification moyenne, filtre des images, notifications par mention, icône")

        # 5. Lien d'invitation permanent vers #bienvenue
        invitation = await salons["bienvenue"].create_invite(max_age=0, max_uses=0, unique=False)
        print(f"\n✅ Le serveur est prêt!\n🔗 Lien d'invitation permanent : {invitation.url}")
        print("Tu peux maintenant retirer le bot du serveur (clic droit sur le bot → Expulser).")


if __name__ == "__main__":
    print("⚠️  Ne fais pas de capture d'écran pendant que le jeton est affiché.")
    # On garde seulement les caractères d'un vrai jeton (enlève les espaces et caractères invisibles collés par erreur)
    jeton = re.sub(r"[^A-Za-z0-9._\-]", "", input("Colle le jeton (token) du bot (Ctrl+V ou clic droit) puis Entrée : "))
    if len(jeton) < 50 or jeton.count(".") != 2:
        input("\n❌ Ce jeton ne semble pas complet. Recopie-le (onglet Bot → Reset Token → Copy) et relance. Appuie sur Entrée.")
        raise SystemExit
    print("\n" * 40)  # cache le jeton de l'écran
    id_serveur = int(re.sub(r"\D", "", input("Numéro (ID) du serveur : ")))
    print("\nVeux-tu EFFACER tous les salons et rôles du serveur et repartir à neuf?")
    print("(Oui si le serveur est neuf ou si tu avais lancé une autre version du code. Les messages seront perdus.)")
    repartir = input("Écris oui ou non : ").strip().lower() in ("oui", "o", "yes", "y")
    Bot(id_serveur, repartir).run(jeton, log_handler=None)
