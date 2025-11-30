const { ovlcmd } = require('../lib/ovlcmd');
const { cards } = require('../DataBase/cards');
const { MyNeoFunctions } = require("../DataBase/myneo_lineup_team");
const { getData, setfiche /*, getAllFiches ?*/ } = require("../DataBase/allstars_divs_fiches");
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
        // get user data & fiche
        const userData = await MyNeoFunctions.getUserData(auteur_Message);
        const fiche = await getData({ jid: auteur_Message });

        if (!userData || !fiche)
            return repondre("❌ Impossible de récupérer ta fiche.");

        // open session message
        await ovl.sendMessage(ms_org, {
            image: { url: 'https://files.catbox.moe/i87tdr.png' },
            caption: `╭────〔 *🛍️BOUTIQUE🛒* 〕

😃Bienvenue dans la boutique NEO🛍️Store🛒, pour faire un achat il vous suffit de taper comme ceci :
*🛍️achat: sasuke(Hebi)/ 🛍️vente: sasuke(Hebi)*. Après cela attendez la validation de votre achat où de votre vente.  *#Happy202️⃣6️⃣🎊🎄*
╰───────────────────
                  *🔷NEO🛍️STORE*`
        }, { quoted: ms });

        // wait for message with timeout (ms)
        const waitFor = async (timeout = 120000) => {
            const r = await ovl.recup_msg({ auteur: auteur_Message, ms_org, temps: timeout });
            const txt = r?.message?.extendedTextMessage?.text || r?.message?.conversation || "";
            return txt ? txt.trim() : "";
        };

        // DB card by exact name or includes
        function findCardByName(name) {
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
        }

        // how many players own a card (exact name)
        async function countOwners(cardName) {
            let allFiches = [];
            try {
                // try several likely helpers depending on your project structure
                if (MyNeoFunctions.getAllFiches) {
                    allFiches = await MyNeoFunctions.getAllFiches();
                } else if (MyNeoFunctions.getAllUsers) {
                    // some projects expose all users with fiches through a different method
                    allFiches = await MyNeoFunctions.getAllUsers();
                } else if (typeof getAllFiches === 'function') {
                    // if your allstars_divs_fiches module exports getAllFiches
                    allFiches = await getAllFiches();
                } else {
                    // If none exists, try building from MyNeoFunctions list of users (best-effort)
                    if (MyNeoFunctions.listAllUsers) {
                        const users = await MyNeoFunctions.listAllUsers();
                        for (const u of users) {
                            try {
                                const f = await getData({ jid: u.jid || u.id || u });
                                if (f) allFiches.push(f);
                            } catch (e) { /* ignore individual errors */ }
                        }
                    } else {
                        // fallback: cannot enumerate fiches — return 0 so no price bump
                        console.log("WARN: Impossible to fetch all fiches to count owners. Aucun bump appliqué.");
                        return 0;
                    }
                }
            } catch (e) {
                console.log("WARN: erreur lors récupération toutes les fiches:", e);
                return 0;
            }

            // count exact occurrences of cardName in fiche.cards
            const nameLow = cardName.toLowerCase();
            let cnt = 0;
            for (const f of allFiches) {
                try {
                    const cstr = (f.cards || "").split("\n").map(x => x.trim()).filter(Boolean);
                    if (cstr.some(n => n.toLowerCase() === nameLow)) cnt++;
                } catch (e) { /* ignore malformed fiche */ }
            }
            return cnt;
        }

        // session loop: keep alive until user types 'close'
        let sessionOpen = true;

        // main session: 2 minutes to send first command, then loop until close
        let initialInput = await waitFor(120000);
        if (!initialInput) return repondre("❌ Temps écoulé. Session fermée.");

        // normalize
        initialInput = initialInput.trim();

        // process commands until close
        while (sessionOpen) {
            // user wants to close session
            if (initialInput.toLowerCase() === "close") {
                sessionOpen = false;
                await repondre("✅ Boutique fermée.");
                break;
            }

            // Commands detection (achat/vente)
            const lower = initialInput.toLowerCase();

            let mode = null; // 'achat' | 'vente'
            if (/^(🛍️)?\s*achat\s*:/i.test(initialInput)) mode = 'achat';
            else if (/^(🛍️)?\s*vente\s*:/i.test(initialInput)) mode = 'vente';
            else {
                // Accept bare names as achat by default
                mode = 'achat';
            }

            // extract query text after colon if present, else full text
            let query = initialInput;
            const colonIndex = initialInput.indexOf(":");
            if (colonIndex !== -1) {
                query = initialInput.slice(colonIndex + 1).trim();
            }

            if (!query) {
                await repondre("❌ Aucun texte reçu après la commande.");
                initialInput = await waitFor(120000);
                if (!initialInput) return repondre("❌ Temps écoulé. Session fermée.");
                continue;
            }

            // Split into tokens for multi-field search
            // Remove punctuation except parentheses which we keep for exact "Sasuke(EMS)" style
            const tokens = query.split(/\s+/).map(t => t.trim()).filter(Boolean);
            const nameToken = tokens[0] || "";
            const extras = tokens.slice(1);

            // Build found array by searching multiple fields (name + category + grade + placement + tags)
            const qLower = query.toLowerCase();
            let found = [];
            for (const [placementKey, placementCards] of Object.entries(cards)) {
                for (const c of placementCards) {
                    const searchable = [
                        c.name || "",
                        c.category || "",
                        c.grade || "",
                        placementKey || "",
                        (c.tags || []).join(" ")
                    ].join(" ").toLowerCase();

                    // require that ALL tokens appear somewhere in searchable (multi-word precise search)
                    const allTokensPresent = tokens.every(tok => searchable.includes(tok.toLowerCase()));
                    if (allTokensPresent) {
                        found.push({ ...c, placement: placementKey });
                        continue;
                    }

                    // fallback: if name contains the whole query
                    if ((c.name || "").toLowerCase().includes(qLower)) {
                        found.push({ ...c, placement: placementKey });
                        continue;
                    }

                    // also allow partial: if first token matches name loosely
                    if ((c.name || "").toLowerCase().includes(nameToken.toLowerCase())) {
                        found.push({ ...c, placement: placementKey });
                        continue;
                    }
                }
            }

            // Remove duplicates
            found = found.filter((v,i,a)=> a.findIndex(x=>x.name===v.name && x.placement===v.placement)===i);

            if (found.length === 0) {
                await repondre(`❌ Aucune carte trouvée pour : ${query}\n(Tape un autre nom ou \`close\` pour quitter.)`);
                initialInput = await waitFor(120000);
                if (!initialInput) return repondre("❌ Temps écoulé. Session fermée.");
                continue;
            }

            // If single exact match (name equals token) or best match candidate => proceed directly
            const exactCandidate = found.find(c => c.name.toLowerCase() === nameToken.toLowerCase()) || (found.length === 1 ? found[0] : null);

            if (exactCandidate) {
                let card = exactCandidate;

                // compute price bump if owners >= 2
                const owners = await countOwners(card.name);
                let basePrix = parseInt((card.price || "").replace(/[^\d]/g, "")) || 0;
                let bumpedPrix = basePrix;
                if (owners >= 2) bumpedPrix = basePrix + 500000;

                // build temporary price string to show
                let priceString = card.price;
                if (bumpedPrix !== basePrix) {
                    // replace digits in original price with bumped formatted price and keep currency emoji
                    const currencyEmoji = card.price.replace(/[0-9\.,\s]/g, "").trim() || (card.price.includes("🔷") ? "🔷" : "🧭");
                    priceString = `${formatNumber(bumpedPrix)}${currencyEmoji}`;
                }

                // vente mode: verify the player owns the card (search fiche)
                if (mode === 'vente') {
                    const ficheCardsRaw = (fiche.cards || "").split("\n").map(x => x.trim()).filter(Boolean);
                    const ownedIndex = ficheCardsRaw.indexOf(card.name);
                    if (ownedIndex === -1) {
                        // try partial matches in fiche
                        const partials = ficheCardsRaw.filter(x => x.toLowerCase().includes(nameToken.toLowerCase()));
                        if (partials.length === 0) {
                            await repondre(`❌ Tu ne possèdes pas cette carte (${card.name}).`);
                            initialInput = await waitFor(120000);
                            if (!initialInput) return repondre("❌ Temps écoulé. Session fermée.");
                            continue;
                        } else if (partials.length === 1) {
                            const ownedName = partials[0];
                            const dbCard = findCardByName(ownedName);
                            if (!dbCard) {
                                await repondre(`❌ Erreur: impossible de retrouver la carte "${ownedName}" dans la DB.`);
                                initialInput = await waitFor(120000);
                                if (!initialInput) return repondre("❌ Temps écoulé. Session fermée.");
                                continue;
                            }
                            card = dbCard;
                        } else {
                            // multiple partials -> ask which to sell
                            let selList = "📋 *Cartes correspondantes trouvées dans ta fiche :*\n\n";
                            partials.forEach((n, i) => {
                                selList += `${i + 1}. ${n}\n`;
                            });
                            selList += `\nTape le numéro de la carte que tu veux vendre ou \`close\`.`;
                            await repondre(selList);
                            const sel = await waitFor(60000);
                            const idx = parseInt(sel);
                            if (isNaN(idx) || idx < 1 || idx > partials.length) {
                                await repondre("❌ Numéro invalide ou temps écoulé.");
                                initialInput = await waitFor(120000);
                                if (!initialInput) return repondre("❌ Temps écoulé. Session fermée.");
                                continue;
                            }
                            const chosenOwned = partials[idx - 1];
                            const dbCard = findCardByName(chosenOwned);
                            if (!dbCard) {
                                await repondre("❌ Erreur DB.");
                                initialInput = await waitFor(120000);
                                if (!initialInput) return repondre("❌ Temps écoulé. Session fermée.");
                                continue;
                            }
                            card = dbCard;
                        }
                    }
                }

                // show card with bumped price if needed
                await ovl.sendMessage(ms_org, {
                    image: { url: card.image },
                    caption: `🎴 *Carte :* ${card.name}

Nom : ${card.name}
Grade : ${card.grade}
Catégorie : ${card.category}
Placement : ${card.placement}
🛍️Prix : ${priceString}${owners >= 2 ? "  (Prix augmenté car déjà possédée par >=2 joueurs)" : ""}

✔️ Confirmer ${mode === 'achat' ? 'l\'achat' : 'la vente'} ? (oui / non)

*Tu as 1 minute pour répondre.*`
                }, { quoted: ms });


// ---- Achat/Vente confirmé ----
let finalPrice = bumpedPrix; // Toujours défini en premier

// Vérification coupon
let couponUsed = false;
if (confNorm.includes("+coupon")) {
    const userCoupons = parseInt(userData.coupons || 0);
    if (userCoupons < 100) {
        await repondre("❌ Pas assez de coupons (100 nécessaires). Achat annulé.");
        initialInput = await waitFor(120000);
        if (!initialInput) return repondre("❌ Temps écoulé. Session fermée.");
        continue;
    }
    finalPrice = Math.floor(finalPrice / 2); // 50% réduction
    couponUsed = true;
}

// Vérification confirmation "oui"
if (!confNorm.includes("oui") && !confNorm.includes("yes") && !couponUsed) {
    await repondre("❌ Opération annulée. Tu peux choisir un autre numéro ou taper `close`.");
    initialInput = await waitFor(120000);
    if (!initialInput) return repondre("❌ Temps écoulé. Session fermée.");
    continue;
}

// Retirer coupon si utilisé
if (couponUsed) {
    await MyNeoFunctions.updateUser(auteur_Message, { coupons: userData.coupons - 100 });
    await repondre("🎟️ Coupon utilisé ! 50% de réduction appliquée.");
}

// Achat
if (mode === 'achat') {
    let np = parseInt(userData.np || 0);
    let nc = parseInt(userData.nc || 0);
    let golds = parseInt(fiche.golds || 0);

    // Vérification ressources
    if (np < 1) {
        await repondre("❌ Tu n’as pas assez de NP.");
        initialInput = await waitFor(120000); continue;
    }
    if (usesGold && golds < finalPrice) {
        await repondre("❌ Pas assez de G🧭.");
        initialInput = await waitFor(120000); continue;
    }
    if (usesNC && nc < finalPrice) {
        await repondre("❌ Pas assez de NC 🔷.");
        initialInput = await waitFor(120000); continue;
    }

    // Débit ressources
    await MyNeoFunctions.updateUser(auteur_Message, { np: np - 1 });
    if (usesGold) await setfiche("golds", golds - finalPrice, auteur_Message);
    if (usesNC) await MyNeoFunctions.updateUser(auteur_Message, { nc: nc - finalPrice });

    // Ajouter carte
    let currentCards = (fiche.cards || "").split("\n").map(x => x.trim()).filter(Boolean);
    if (!currentCards.includes(card.name)) {
        currentCards.push(card.name);
        await setfiche("cards", currentCards.join("\n"), auteur_Message);
    }

    // Facture
    await ovl.sendMessage(ms_org, {
        image: { url: card.image },
        caption: `
╭───〔 🛍️ REÇU D’ACHAT 〕───────
👤 Client : ${fiche.code_fiche}

🎴 Carte ajoutée : ${card.name}

💳 Paiement :
• 1 NP
• ${formatNumber(finalPrice)} ${usesNC ? "🔷" : "🧭"}

Merci pour ton achat !
╰───────────────────`
    }, { quoted: ms });

} else { // Vente
    let currentCards = (fiche.cards || "").split("\n").map(x => x.trim()).filter(Boolean);
    const idx = currentCards.findIndex(n => n === card.name);
    if (idx === -1) {
        await repondre(`❌ Carte introuvable dans ta fiche.`);
        initialInput = await waitFor(120000); continue;
    }

    const halfPrice = Math.floor(finalPrice / 2);
    currentCards.splice(idx, 1);
    await setfiche("cards", currentCards.join("\n"), auteur_Message);

    if (usesGold) {
        let golds = parseInt(fiche.golds || 0);
        await setfiche("golds", golds + halfPrice, auteur_Message);
    }
    if (usesNC) {
        let nc = parseInt(userData.nc || 0);
        await MyNeoFunctions.updateUser(auteur_Message, { nc: nc + halfPrice });
    }

    await ovl.sendMessage(ms_org, {
        image: { url: card.image },
        caption: `
╭───〔 🛍️ REÇU DE VENTE 〕───────
👤 Client : ${fiche.code_fiche}

🎴 Carte retirée : ${card.name}

💳 Tu as reçu :
• ${formatNumber(halfPrice)} ${usesNC ? "🔷" : "🧭"}

Merci pour ta vente !
╰───────────────────`
    }, { quoted: ms });
}


// SHOWING CARD TO THE PLAYER BY DEMAND
ovlcmd({
    nom_cmd: /^(\+cards)/i,
    isCustom: true
}, async (ms_org, ovl, { ms, auteur_Message, repondre, prefixe, commande }) => {
    try {
        let txt = ms.body || "";
        txt = txt.toLowerCase().replace(/^\+cards/i, "").trim();

        if (!txt)
            return repondre("❌ Tu dois écrire un nom après +cards…");

        // Réaction pour confirmer que le bot lit la commande
        await ovl.react(ms, "🔎");

        // Nettoyage extrême → enlève espaces, (), -, _ etc.
        let clean = txt.replace(/[\s\-\_]/g, "")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        let found = [];

        for (const [placementKey, placementCards] of Object.entries(cards)) {
            for (const c of placementCards) {
                let cleanName = c.name.toLowerCase()
                    .replace(/[\s\-\_]/g, "")
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                if (cleanName.includes(clean)) {
                    found.push({ ...c, placement: placementKey });
                }
            }
        }

        if (found.length === 0)
            return repondre("❌ Aucune Card ne correspond à : " + txt);

        if (found.length > 1) {
            let msg = "📋 Plusieurs cards trouvées :\n\n";
            found.forEach((c, i) => {
                msg += `${i + 1}. ${c.name} — Grade: ${c.grade} — ${c.price}\n`;
            });
            msg += "\n🔎 Tape un nom plus précis.";
            return repondre(msg);
        }

        const card = found[0];

        await ovl.sendMessage(ms_org, {
            image: { url: card.image },
            caption: `🎴 *${card.name}*\n\nGrade : ${card.grade}\nCatégorie : ${card.category}\nPlacement : ${card.placement}\nPrix : ${card.price}`
        }, { quoted: ms });

        // Réaction de succès
        await ovl.react(ms, "✅");

    } catch (e) {
        console.log("❌ ERREUR +cards :", e);
        return repondre("❌ Une erreur est survenue.");
    }
});
