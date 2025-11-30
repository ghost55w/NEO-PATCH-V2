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
const userData = await MyNeoFunctions.getUserData(auteur_Message);
const fiche = await getData({ jid: auteur_Message });

    if (!userData || !fiche)
        return repondre("❌ Impossible de récupérer ta fiche.");

    await ovl.sendMessage(ms_org, {
        image: { url: 'https://files.catbox.moe/i87tdr.png' },
        caption: `╭────〔 *🛍️BOUTIQUE🛒* 〕

😃Bienvenue dans la boutique NEO🛍️Store🛒, pour faire un achat il vous suffit de taper comme ceci :
*🛍️Achat: sasuke(Hebi)/ 🛍️Vente: sasuke(Hebi). Après cela attendez la validation de votre achat ou vente.  #Happy202️⃣6️⃣🎊🎄
╰───────────────────
🔷NEO🛍️STORE`
}, { quoted: ms });

    const waitFor = async (timeout = 120000) => {
        const r = await ovl.recup_msg({ auteur: auteur_Message, ms_org, temps: timeout });
        const txt = r?.message?.extendedTextMessage?.text || r?.message?.conversation || "";
        return txt ? txt.trim().toLowerCase() : "";
    };

    const findCardByName = (name) => {
        const low = name.toLowerCase();
        for (const [placementKey, placementCards] of Object.entries(cards)) {
            for (const c of placementCards) {
                if (c.name.toLowerCase() === low) return { ...c, placement: placementKey };
            }
        }
        for (const [placementKey, placementCards] of Object.entries(cards)) {
            for (const c of placementCards) {
                if (c.name.toLowerCase().includes(low)) return { ...c, placement: placementKey };
            }
        }
        return null;
    };

    let sessionOpen = true;
    let initialInput = await waitFor(120000);
    if (!initialInput) return repondre("❌ Temps écoulé. Session fermée.");

    while (sessionOpen) {
        if (initialInput === "close") {
            sessionOpen = false;
            return repondre("✅ Boutique fermée.");
        }

        let mode = null;
        if (/^(🛍️)?\s*achat\s*:/i.test(initialInput)) mode = 'achat';
        else if (/^(🛍️)?\s*vente\s*:/i.test(initialInput)) mode = 'vente';
        else mode = 'achat';

        let query = initialInput.includes(":") ? initialInput.split(":")[1].trim() : initialInput;
        if (!query) {
            initialInput = await waitFor(120000);
            if (!initialInput) return repondre("❌ Temps écoulé. Session fermée.");
            continue;
        }

        const card = findCardByName(query);
        if (!card) {
            await repondre(`❌ Carte introuvable pour : ${query}`);
            initialInput = await waitFor(120000);
            continue;
        }

        // Prix
        let basePrix = parseInt((card.price || "").replace(/[^\d]/g, "")) || 0;
        let bumpedPrix = basePrix;

        // Vérification si déjà possédée par >=2 joueurs (prix bump)
        const owners = await (async () => {
            try {
                if (MyNeoFunctions.getAllFiches) return (await MyNeoFunctions.getAllFiches()).filter(f=>f.cards?.includes(card.name)).length;
                return 0;
            } catch { return 0; }
        })();
        if (owners >= 2) bumpedPrix += 500000;

        let priceString = bumpedPrix.toLocaleString() + "🧭";

        // Prévisualisation avant confirmation
        await ovl.sendMessage(ms_org, {
            image: { url: card.image },
            caption: `🎴 *Carte :* ${card.name}

Nom : ${card.name}
Grade : ${card.grade}
Catégorie : ${card.category}
Placement : ${card.placement}
🛍️Prix : ${priceString}${owners >= 2 ? "  (Prix augmenté car déjà possédée par >=2 joueurs)" : ""}

✔️ Confirmer ${mode === 'achat' ? 'l'achat' : 'la vente'} ? (oui / non / oui +coupon)

Tu as 1 minute pour répondre.`
}, { quoted: ms });

        let confNorm = await waitFor(60000);
        if (!confNorm) return repondre("❌ Temps écoulé. Session fermée.");

        // Coupon
        let couponUsed = false;
        let finalPrice = bumpedPrix;
        if (confNorm.includes("+coupon")) {
            const userCoupons = parseInt(userData.coupons || 0);
            if (userCoupons < 100) {
                await repondre("❌ Pas assez de coupons (100 nécessaires). Achat annulé.");
                initialInput = await waitFor(120000); continue;
            }
            finalPrice = Math.floor(finalPrice / 2);
            couponUsed = true;
        }

        if (!confNorm.includes("oui") && !couponUsed) {
            await repondre("❌ Opération annulée. Tu peux choisir un autre numéro ou taper `close`.");
            initialInput = await waitFor(120000); continue;
        }

        // Retirer coupon si utilisé
        if (couponUsed) {
            await MyNeoFunctions.updateUser(auteur_Message, { coupons: userData.coupons - 100 });
            await repondre("🎟️ Coupon utilisé ! 50% de réduction appliquée.");
        }

        if (mode === 'achat') {
            // Vérification ressources
            if (parseInt(userData.np || 0) < 1) {
                await repondre("❌ Pas assez de NP.");
                initialInput = await waitFor(120000); continue;
            }

            // Débit NP
            await MyNeoFunctions.updateUser(auteur_Message, { np: parseInt(userData.np || 0) - 1 });

            // Ajouter carte
            let currentCards = (fiche.cards || "").split("\n").map(x=>x.trim()).filter(Boolean);
            if (!currentCards.includes(card.name)) currentCards.push(card.name);
            await setfiche("cards", currentCards.join("\n"), auteur_Message);

            // Facture finale
            await ovl.sendMessage(ms_org, {
                image: { url: card.image },
                caption: `

╭───〔 🛍️ REÇU D’ACHAT 〕───────
👤 Client : ${fiche.code_fiche}

🎴 ${card.name} ajoutée à ta fiche.

💳 Paiement :
• 1 NP
• ${finalPrice.toLocaleString()} 🧭

Merci pour ton achat !
╰───────────────────`
}, { quoted: ms });

        } else { // Vente
            let currentCards = (fiche.cards || "").split("\n").map(x=>x.trim()).filter(Boolean);
            const idx = currentCards.findIndex(n=>n===card.name);
            if (idx === -1) {
                await repondre(`❌ Carte introuvable dans ta fiche.`);
                initialInput = await waitFor(120000); continue;
            }

            const halfPrice = Math.floor(finalPrice / 2);
            currentCards.splice(idx, 1);
            await setfiche("cards", currentCards.join("\n"), auteur_Message);

            await ovl.sendMessage(ms_org, {
                image: { url: card.image },
                caption: `

╭───〔 🛍️ REÇU DE VENTE 〕───────
👤 Client : ${fiche.code_fiche}

🎴 ${card.name} retirée de ta fiche.

💳 Tu as reçu :
• ${halfPrice.toLocaleString()} 🧭

Merci pour ta vente !
╰───────────────────`
}, { quoted: ms });
}

        // Attente nouvelle commande ou close
        initialInput = await waitFor(120000);
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
