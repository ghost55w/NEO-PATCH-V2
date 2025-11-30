const { ovlcmd } = require('../lib/ovlcmd');
const { cards } = require('../DataBase/cards');
const { MyNeoFunctions } = require("../DataBase/myneo_lineup_team");
const { getData, setfiche } = require("../DataBase/allstars_divs_fiches");
const config = require("../set");

const formatNumber = n => {
try { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
catch { return n; }
};

// ----------------- BOUTIQUE -----------------
ovlcmd({
nom_cmd: "boutique🛍️",
react: "🛒",
classe: "NEO_GAMES🎰"
}, async (ms_org, ovl, { ms, auteur_Message, repondre }) => {
try {
const userData = await MyNeoFunctions.getUserData(auteur_Message);
const fiche = await getData({ jid: auteur_Message });

    if (!userData || !fiche) return repondre("❌ Impossible de récupérer ta fiche.");

    // ----- MESSAGE D'ACCUEIL -----
    await ovl.sendMessage(ms_org, {
        image: { url: 'https://files.catbox.moe/i87tdr.png' },
        caption: `╭────〔 *🛍️BOUTIQUE🛒* 〕

😃Bienvenue dans la boutique NEO🛍️Store🛒, pour faire un achat il vous suffit de taper comme ceci :
🛍️achat: sasuke(Hebi)/ 🛍️vente: sasuke(Hebi). Après cela attendez la validation de votre achat ou de votre vente.  #Happy202️⃣6️⃣🎊🎄
╰───────────────────
🔷NEO🛍️STORE`
}, { quoted: ms });

    const waitFor = async (timeout = 120000) => {
        const r = await ovl.recup_msg({ auteur: auteur_Message, ms_org, temps: timeout });
        const txt = r?.message?.extendedTextMessage?.text || r?.message?.conversation || "";
        return txt ? txt.trim() : "";
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

    const countOwners = async (cardName) => {
        let allFiches = [];
        try {
            if (MyNeoFunctions.getAllFiches) allFiches = await MyNeoFunctions.getAllFiches();
            else if (MyNeoFunctions.getAllUsers) allFiches = await MyNeoFunctions.getAllUsers();
        } catch (e) { return 0; }
        const nameLow = cardName.toLowerCase();
        let cnt = 0;
        for (const f of allFiches) {
            const cstr = (f.cards || "").split("\n").map(x => x.trim()).filter(Boolean);
            if (cstr.some(n => n.toLowerCase() === nameLow)) cnt++;
        }
        return cnt;
    };

    let sessionOpen = true;
    let initialInput = await waitFor(120000);
    if (!initialInput) return repondre("❌ Temps écoulé. Session fermée.");

    while (sessionOpen) {
        initialInput = initialInput.trim();
        if (initialInput.toLowerCase() === "close") {
            await repondre("✅ Boutique fermée.");
            break;
        }

        const lower = initialInput.toLowerCase();
        let mode = null;
        if (/^(🛍️)?\s*achat\s*:/i.test(initialInput)) mode = 'achat';
        else if (/^(🛍️)?\s*vente\s*:/i.test(initialInput)) mode = 'vente';
        else mode = 'achat';

        let query = initialInput.includes(":") ? initialInput.split(":")[1].trim() : initialInput;
        if (!query) {
            await repondre("❌ Aucun texte reçu après la commande.");
            initialInput = await waitFor(120000);
            continue;
        }

        const tokens = query.split(/\s+/).map(t => t.trim()).filter(Boolean);
        const nameToken = tokens[0] || "";
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
                const allTokensPresent = tokens.every(tok => searchable.includes(tok.toLowerCase()));
                if (allTokensPresent || (c.name || "").toLowerCase().includes(qLower) || (c.name || "").toLowerCase().includes(nameToken.toLowerCase())) {
                    found.push({ ...c, placement: placementKey });
                }
            }
        }

        found = found.filter((v,i,a)=> a.findIndex(x=>x.name===v.name && x.placement===v.placement)===i);
        if (found.length === 0) {
            await repondre(`❌ Aucune carte trouvée pour : ${query}\n(Tape un autre nom ou \`close\` pour quitter.)`);
            initialInput = await waitFor(120000);
            continue;
        }

        const card = found.find(c => c.name.toLowerCase() === nameToken.toLowerCase()) || found[0];
        const owners = await countOwners(card.name);
        let basePrix = parseInt((card.price || "").replace(/[^\d]/g, "")) || 0;
        let bumpedPrix = owners >= 2 ? basePrix + 500000 : basePrix;
        let priceString = bumpedPrix !== basePrix ? `${formatNumber(bumpedPrix)}🔷` : card.price;

        await ovl.sendMessage(ms_org, {
            image: { url: card.image },
            caption: `🎴 Carte : ${card.name}\n🛍️Prix : ${priceString}\nConfirmer ${mode === 'achat' ? "l'achat" : "la vente"} ? (oui / non)`
        }, { quoted: ms });

        const confMsg = await waitFor(60000);
        const confNorm = (confMsg || "").toLowerCase();
        if (!confNorm.includes("oui")) {
            await repondre("❌ Opération annulée. Tape une autre commande ou `close`.");
            initialInput = await waitFor(120000);
            continue;
        }

        if (mode === 'achat') {
            let np = parseInt(userData.np || 0);
            if (np < 1) return repondre("❌ Tu n’as pas assez de NP.");
            await MyNeoFunctions.updateUser(auteur_Message, { np: np - 1 });

            let currentCards = (fiche.cards || "").split("\n").map(x => x.trim()).filter(Boolean);
            if (!currentCards.includes(card.name)) currentCards.push(card.name);
            await setfiche("cards", currentCards.join("\n"), auteur_Message);

            await ovl.sendMessage(ms_org, {
                image: { url: card.image },
                caption: `✅ Carte achetée : ${card.name}\n1 NP retiré`
            }, { quoted: ms });
        } else {
            let currentCards = (fiche.cards || "").split("\n").map(x => x.trim()).filter(Boolean);
            const idx = currentCards.findIndex(n => n === card.name);
            if (idx !== -1) {
                currentCards.splice(idx, 1);
                await setfiche("cards", currentCards.join("\n"), auteur_Message);
                await ovl.sendMessage(ms_org, { caption: `✅ Carte vendue : ${card.name}` }, { quoted: ms });
            } else {
                await repondre(`❌ Carte introuvable dans ta fiche : ${card.name}`);
            }
        }

        initialInput = await waitFor(120000);
    }

} catch (e) {
    console.log("❌ ERREUR Boutique:", e);
    return repondre("❌ Une erreur est survenue.");
}

});
