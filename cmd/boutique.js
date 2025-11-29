const { ovlcmd } = require('../lib/ovlcmd');
const { MyNeoFunctions } = require("../DataBase/myneo_lineup_team");
const { getData, setfiche, getAllFiches } = require("../DataBase/allstars_divs_fiches");

const fs = require("fs");
const path = require("path");

//chargement des Cards
function loadCards(directory) {
    const cards = {};
    const dir = path.isAbsolute(directory)
        ? directory
        : path.join(__dirname, "..", directory);

    if (!fs.existsSync(dir)) return cards;

    for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isFile() && /\.(jpg|jpeg|png)$/i.test(file)) {
            cards[file] = { filename: file, path: full };
        }
    }
    return cards;
}

const shopCards = loadCards("DataBase/cards");

//utilitaires
function normalize(str = "") {
    return str
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
}

// Levenshtein
function levenshtein(a, b) {
    if (!a) return b.length;
    if (!b) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] =
                b[i - 1] === a[j - 1]
                    ? matrix[i - 1][j - 1]
                    : Math.min(
                          matrix[i - 1][j - 1] + 1,
                          matrix[i][j - 1] + 1,
                          matrix[i - 1][j] + 1
                      );
        }
    }
    return matrix[b.length][a.length];
}

//🔥 Parse nom de fichier en info Carte 
function parseCardData(file) {
    const base = file.replace(/\.(jpg|jpeg|png)$/i, "");
    const parts = base.split("_");

    return {
        file,
        name: parts[0]?.toLowerCase() || "",
        color: parts[1]?.toLowerCase() || "",
        type: parts[2]?.toLowerCase() || "",
        grade: parts[3]?.toLowerCase() || "",
        rawPrice: parts[4] || ""
    };
}

function parsePrice(str) {
    if (!str) return 0;
    str = str.toLowerCase();
    const num = parseInt(str.replace(/\D/g, "")) || 0;

    if (str.includes("nc")) return num;
    if (str.includes("m")) return num * 1_000_000;
    if (str.includes("k")) return num * 1000;
    return num;
}

// RECHERCHE INTELLIGENTE (FAUTES ACCEPTÉES)
function smartFindCard(query) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    for (const file of Object.keys(shopCards)) {
        const c = parseCardData(file);
        const tokens = [c.name, c.color, c.type, c.grade].map(normalize);

        const ok = words.every(w =>
            tokens.some(t =>
                t.includes(normalize(w)) ||
                normalize(w).includes(t)
            )
        );
        if (ok) return file;
    }

    // Fallback fuzzy
    const normQuery = normalize(query);
    let best = null;
    let score = Infinity;
    for (const file of Object.keys(shopCards)) {
        const s = levenshtein(normQuery, normalize(file));
        if (s < score) { score = s; best = file; }
    }
    return score <= 15 ? best : null;
}

//🛍️ COMMANDE BOUTIQUE
ovlcmd({
    nom_cmd: "boutique🛍️",
    react: "🛒",
    classe: "NEO_GAMES🎰"
}, async (ms_org, ovl, { ms, auteur_Message, repondre }) => {

    try {
        const userData = await MyNeoFunctions.getUserData(auteur_Message);
        const fiche = await getData({ jid: auteur_Message });

        if (!userData || !fiche)
            return repondre("❌ Impossible de récupérer ta fiche.");

        // ⭐ TON TEXTE EXACT, NON MODIFIÉ
        await ovl.sendMessage(ms_org, {
            image: { url: 'https://files.catbox.moe/ye33nv.png' },
            caption: `╭────〔 *🛍️BOUTIQUE🛒* 〕

😃Bienvenue dans la boutique NEO🛍️Store🛒, pour faire un achat il vous suffit de taper comme ceci :
*achat: sasuke bronze sparking/sp* puis après avoir obtenu votre facture, veuillez remettre à un boutiquier qui mettra à jour sur votre fiche. *#Happy202️⃣6️⃣🎊🎄*
╰───────────────────
                  *🔷NEO🛍️STORE* `
        }, { quoted: ms });

        // BOUCLE POUR ACHATS MULTIPLES
        const purchases = [];

        while (true) {

            const rep = await ovl.recup_msg({ auteur: auteur_Message, ms_org, temps: 60000 });
            const txt = (rep?.message?.extendedTextMessage?.text ||
                         rep?.message?.conversation ||
                         "").toLowerCase().trim();

            if (!txt) continue;

            // Quitter = générer facture globale
            if (txt === "stop" || txt === "quitter") break;

            if (!txt.startsWith("achat:")) {
                await repondre("❌ Mauvais format.\nTape : *achat: nom couleur rareté*");
                continue;
            }

            const query = txt.replace("achat:", "").trim();
            const file = smartFindCard(query);

            if (!file) {
                await repondre("❌ Carte introuvable. Réessaie, le bot attend toujours.");
                continue;
            }

            const info = parseCardData(file);
            const full = shopCards[file].path;

            // Calcul prix
            const price = parsePrice(info.rawPrice);

            // Confirmation
            await ovl.sendMessage(ms_org, {
                caption: `🎴 **${info.name.toUpperCase()}** trouvée !
Couleur : ${info.color}
Rareté : ${info.type}
Grade : ${info.grade}
Prix : ${price} 🧭 + 1 NP

Réponds *oui* pour confirmer l'achat.`
            });

            const conf = await ovl.recup_msg({ auteur: auteur_Message, ms_org, temps: 60000 });
            const ctx = (conf?.message?.extendedTextMessage?.text ||
                          conf?.message?.conversation ||
                          "").toLowerCase();

            if (!["oui", "o"].includes(ctx)) {
                await repondre("❌ Achat annulé.");
                continue;
            }

            // Vérification
            const golds = parseInt(fiche.golds) || 0;
            const np = parseInt(fiche.np) || 0;

            if (golds < price) {
                await repondre("❌ Pas assez de golds.");
                continue;
            }
            if (np < 1) {
                await repondre("❌ Pas assez de NP.");
                continue;
            }

            // Déduction
            await setfiche("golds", golds - price, auteur_Message);
            await setfiche("np", np - 1, auteur_Message);

            // Envoi de l’image
            await ovl.sendMessage(ms_org, {
                image: fs.createReadStream(full),
                caption: `🎴 ${info.name.toUpperCase()} ${info.color} ${info.type} ${info.grade}`
            });

            // Ajout au panier global
            purchases.push({
                name: info.name,
                color: info.color,
                type: info.type,
                grade: info.grade,
                price
            });

            await repondre("✅ Achat effectué ! Tu peux taper un autre *achat:* ou envoyer *stop*.");
        }

        // FACTURE GLOBALE
        if (purchases.length === 0) {
            return repondre("🛍️ Aucun achat effectué.");
        }

        const totalGolds = purchases.reduce((s, c) => s + c.price, 0);
        const totalNP = purchases.length;

        const list = purchases
            .map(c => `- ${c.name} ${c.color} ${c.type} ${c.grade} —— ${c.price}`)
            .join("\n");

        const facture = `
╭───〔 🛍️BOUTIQUE🛒 〕─────── 
👤 Code client : ${fiche.code_fiche}

🎴 Achats :
${list}

💰 TOTAL : ${totalGolds} 🧭 + ${totalNP} NP
╰───────────────────
    🔷 NEO🛍️STORE
        `;

        await repondre(facture);

    } catch (err) {
        console.error(err);
        repondre("❌ Une erreur est survenue dans la boutique.");
    }
});
