const { ovlcmd } = require('../lib/ovlcmd');
const { cards } = require('../DataBase/cards');
const { MyNeoFunctions } = require("../DataBase/myneo_lineup_team");
const { getData, setfiche } = require("../DataBase/allstars_divs_fiches");
const config = require("../set");

const formatNumber = n => {
try { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
catch { return n; }
};

ovlcmd({
nom_cmd: "boutique🛍️",
react: "🛒",
classe: "NEO_GAMES🎰"
}, async (ms_org, ovl, { ms, auteur_Message, repondre }) => {
try {
// Récupération des données utilisateur et fiche
const userData = await MyNeoFunctions.getUserData(auteur_Message);
const fiche = await getData({ jid: auteur_Message });
if (!userData || !fiche) return repondre("❌ Impossible de récupérer ta fiche.");

    // Message d'accueil boutique
    await ovl.sendMessage(ms_org, {
        image: { url: 'https://files.catbox.moe/i87tdr.png' },
        caption: `╭────〔 *🛍️BOUTIQUE🛒* 〕

😃Bienvenue dans la boutique NEO🛍️Store🛒, pour faire un achat il vous suffit de taper comme ceci :
🛍️achat: sasuke(Hebi)/ 🛍️vente: sasuke(Hebi). Après cela attendez la validation de votre achat ou de votre vente.
#Happy202️⃣6️⃣🎊🎄
╰───────────────────
🔷NEO🛍️STORE`
}, { quoted: ms });

    // Fonction pour attendre message du joueur
    const waitFor = async (timeout = 120000) => {
        const r = await ovl.recup_msg({ auteur: auteur_Message, ms_org, temps: timeout });
        const txt = r?.message?.extendedTextMessage?.text || r?.message?.conversation || "";
        return txt ? txt.trim().toLowerCase() : "";
    };

    // Boucle de session boutique
    let sessionOpen = true;
    let userInput = await waitFor(120000);
    if (!userInput) return repondre("❌ Temps écoulé. Session fermée.");

    while (sessionOpen) {
        if (userInput === "close") {
            await repondre("✅ Boutique fermée.");
            break;
        }

        // Détecter achat ou vente
        let mode = "achat"; // par défaut
        if (/^(🛍️)?\s*achat\s*:/i.test(userInput)) mode = 'achat';
        else if (/^(🛍️)?\s*vente\s*:/i.test(userInput)) mode = 'vente';

        // Extraire le texte après les deux-points
        let query = userInput.includes(":") ? userInput.split(":")[1].trim() : userInput.trim();
        if (!query) {
            userInput = await waitFor(120000);
            continue;
        }

        // Recherche carte
        const cleanQuery = query.replace(/[\s\-\_]/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let found = [];
        for (const [placementKey, placementCards] of Object.entries(cards)) {
            for (const c of placementCards) {
                const cleanName = c.name.toLowerCase().replace(/[\s\-\_]/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (cleanName.includes(cleanQuery)) found.push({ ...c, placement: placementKey });
            }
        }

        if (found.length === 0) {
            await repondre(`❌ Aucune carte trouvée pour : ${query}`);
            userInput = await waitFor(120000);
            continue;
        }

        const card = found[0]; // on prend la première correspondance
        let basePrix = parseInt((card.price || "").replace(/[^\d]/g, "")) || 0;

        // Vérification si déjà possédée par >=2 joueurs pour bump prix
        let owners = 0;
        if (MyNeoFunctions.getAllFiches) {
            const allFiches = await MyNeoFunctions.getAllFiches();
            owners = allFiches.filter(f => (f.cards || "").split("\n").map(x => x.trim().toLowerCase()).includes(card.name.toLowerCase())).length;
        }
        let bumpedPrix = owners >= 2 ? basePrix + 500000 : basePrix;

        // Affichage carte + confirmation
        await ovl.sendMessage(ms_org, {
            image: { url: card.image },
            caption: `🎴 *Carte :* ${card.name}

Nom : ${card.name}
Grade : ${card.grade}
Catégorie : ${card.category}
Placement : ${card.placement}
🛍️Prix : ${bumpedPrix} 🧭

✔️ Confirmer ${mode === 'achat' ? 'l'achat' : 'la vente'} ? (oui / non / +coupon)

Tu as 1 minute pour répondre.`
}, { quoted: ms });

        // Attente confirmation
        let confNorm = await waitFor(60000);
        if (!confNorm) {
            userInput = await waitFor(120000);
            continue;
        }

        // Vérification coupon
        let couponUsed = false;
        let finalPrice = bumpedPrix;
        if (confNorm.includes("+coupon")) {
            const userCoupons = parseInt(userData.coupons || 0);
            if (userCoupons < 100) {
                await repondre("❌ Pas assez de coupons (100 nécessaires). Achat annulé.");
                userInput = await waitFor(120000);
                continue;
            }
            finalPrice = Math.floor(finalPrice / 2);
            couponUsed = true;
        }

        if (!confNorm.includes("oui") && !couponUsed) {
            await repondre("❌ Opération annulée. Tape `close` ou une autre commande.");
            userInput = await waitFor(120000);
            continue;
        }

        // Retirer coupon si utilisé
        if (couponUsed) {
            await MyNeoFunctions.updateUser(auteur_Message, { coupons: userData.coupons - 100 });
            await repondre("🎟️ Coupon utilisé ! 50% de réduction appliquée.");
        }

        // Achat
        if (mode === 'achat') {
            // Vérification NP
            let np = parseInt(userData.np || 0);
            if (np < 1) {
                await repondre("❌ Tu n’as pas assez de NP.");
                userInput = await waitFor(120000); continue;
            }
            await MyNeoFunctions.updateUser(auteur_Message, { np: np - 1 });

            // Ajouter carte à la fiche
            let currentCards = (fiche.cards || "").split("\n").map(x => x.trim()).filter(Boolean);
            if (!currentCards.includes(card.name)) {
                currentCards.push(card.name);
                await setfiche("cards", currentCards.join("\n"), auteur_Message);
            }

            // Facture
            await ovl.sendMessage(ms_org, {
                image: { url: card.image },
                caption: `╭───〔 🛍️ REÇU D’ACHAT 〕───────

👤 Client : ${fiche.code_fiche}

🎴 Carte ajoutée : ${card.name}

💳 Paiement :
• 1 NP
• ${finalPrice} 🧭

Merci pour ton achat !
╰───────────────────`
}, { quoted: ms });

        } else { // Vente
            let currentCards = (fiche.cards || "").split("\n").map(x => x.trim()).filter(Boolean);
            const idx = currentCards.indexOf(card.name);
            if (idx !== -1) currentCards.splice(idx, 1);
            await setfiche("cards", currentCards.join("\n"), auteur_Message);

            const halfPrice = Math.floor(finalPrice / 2);
            await ovl.sendMessage(ms_org, {
                image: { url: card.image },
                caption: `╭───〔 🛍️ REÇU DE VENTE 〕───────

👤 Client : ${fiche.code_fiche}

🎴 Carte retirée : ${card.name}

💳 Tu as reçu :
• ${halfPrice} 🧭

Merci pour ta vente !
╰───────────────────`
}, { quoted: ms });
}

        // Re-boucle pour nouvelle commande
        userInput = await waitFor(120000);
    }

} catch (e) {
    console.log("❌ ERREUR Boutique :", e);
    return repondre("❌ Une erreur est survenue dans la boutique.");
}

});
        

ovlcmd({
nom_cmd: /^(+cards)/i,
isCustom: true
}, async (ms_org, ovl, { ms, auteur_Message, repondre }) => {
try {
let txt = ms.body || "";
txt = txt.toLowerCase().replace(/^+cards/i, "").trim();

    if (!txt)
        return repondre("❌ Tu dois écrire un nom après +cards…");

    // Réaction pour confirmer que le bot lit la commande
    await ovl.react(ms, "🔎");

    // Nettoyage du texte → enlever espaces, -, _, etc.
    let clean = txt.replace(/[\s\-\_]/g, "")
                   .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    let found = [];

    for (const [placementKey, placementCards] of Object.entries(cards)) {
        for (const c of placementCards) {
            let cleanName = c.name.toLowerCase()
                .replace(/[\s\-\_]/g, "")
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

            if (cleanName.includes(clean)) {
                found.push({ ...c, placement: placementKey });
            }
        }
    }

    if (found.length === 0)
        return repondre("❌ Aucune carte ne correspond à : " + txt);

    if (found.length > 1) {
        // Optionnel : si plusieurs correspondances, prendre la première automatiquement
        const card = found[0];
        await ovl.sendMessage(ms_org, {
            image: { url: card.image },
            caption: `🎴 *${card.name}*`
        }, { quoted: ms });
        await ovl.react(ms, "✅");
        return;
    }

    const card = found[0];

    await ovl.sendMessage(ms_org, {
        image: { url: card.image },
        caption: `🎴 *${card.name}*`
    }, { quoted: ms });

    // Réaction de succès
    await ovl.react(ms, "✅");

} catch (e) {
    console.log("❌ ERREUR +cards :", e);
    return repondre("❌ Une erreur est survenue.");
}

});
