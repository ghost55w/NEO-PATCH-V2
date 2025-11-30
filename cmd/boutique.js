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
  // Important: remove emoji from nom_cmd to avoid parser issues on Render
  nom_cmd: "boutique",
  react: "🛒",
  classe: "NEO_GAMES"
}, async (ms_org, ovl, { ms, auteur_Message, repondre }) => {
  try {
    // Récupération des données utilisateur et fiche
    const userData = await MyNeoFunctions.getUserData(auteur_Message);
    const fiche = await getData({ jid: auteur_Message });
    if (!userData || !fiche) return repondre("❌ Impossible de récupérer ta fiche.");

    // Message d'accueil boutique (garde les emojis ici, c'est safe)
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
      return txt ? txt.trim() : ""; // return raw case (we'll lower where needed)
    };

    // Build flat list of all cards for searching (with placement)
    const allCards = [];
    for (const [placementKey, placementCards] of Object.entries(cards)) {
      for (const c of placementCards) {
        allCards.push({ ...c, placement: placementKey });
      }
    }

    // Boucle de session boutique
    let sessionOpen = true;
    let userInput = await waitFor(120000);
    if (!userInput) return repondre("❌ Temps écoulé. Session fermée.");

    while (sessionOpen) {
      try { // try interne pour que la session continue si une erreur ponctuelle survient
        if (!userInput) {
          userInput = await waitFor(120000);
          if (!userInput) return repondre("❌ Temps écoulé. Session fermée.");
        }

        if (userInput.toLowerCase() === "close") {
          await repondre("✅ Boutique fermée.");
          break;
        }

        // Détecter achat ou vente : use startsWith to avoid emoji-in-regex issues
        let normalized = userInput.trim();
        let lower = normalized.toLowerCase();

        let mode = "achat"; // défaut
        if (lower.startsWith("🛍️achat") || lower.startsWith("achat")) mode = "achat";
        else if (lower.startsWith("🛍️vente") || lower.startsWith("vente")) mode = "vente";

        // Extraction sûre du texte après les deux-points
        let parts = normalized.split(":");
        if (parts.length < 2) {
          await repondre("❌ Format incorrect. Exemple : 🛍️achat: sasuke(Hebi)");
          userInput = await waitFor(120000);
          continue;
        }
        let query = parts.slice(1).join(":").trim(); // supporte ":" dans le nom au cas où
        if (!query) {
          await repondre("❌ Tu dois écrire un nom après les deux-points.");
          userInput = await waitFor(120000);
          continue;
        }

        // ------------ RECHERCHE CARTE ------------
        const qRaw = query;
        const q = qRaw.toLowerCase().trim();
        const qNoSpace = q.replace(/[\s\-\_]/g, "");

        // PRIORITÉ DE RECHERCHE:
        // 1) match exact du nom complet
        // 2) match exact du nom simple (sans parenthèses) si q donne un simple
        // 3) match commence par (sans parenthèse) pour prioriser versions "principales"
        // 4) match partiel fallback
        let card = allCards.find(c => c.name.toLowerCase() === q);

        // If user typed a simple name (no parentheses) prefer the card without parentheses
        if (!card && !q.includes("(")) {
          // exact simple name (case where DB has "Sasuke" exactly)
          card = allCards.find(c => c.name.toLowerCase() === q && !c.name.includes("("));
        }

        // startsWith without parentheses
        if (!card && !q.includes("(")) {
          card = allCards.find(c =>
            !c.name.includes("(") &&
            c.name.toLowerCase().replace(/[\s\-\_]/g, "").startsWith(qNoSpace)
          );
        }

        // startsWith general
        if (!card) {
          card = allCards.find(c =>
            c.name.toLowerCase().replace(/[\s\-\_]/g, "").startsWith(qNoSpace)
          );
        }

        // partial fallback
        if (!card) {
          card = allCards.find(c =>
            c.name.toLowerCase().replace(/[\s\-\_]/g, "").includes(qNoSpace)
          );
        }

        // Not found
        if (!card) {
          await repondre(`❌ Aucune carte trouvée pour : ${query}`);
          userInput = await waitFor(120000);
          continue;
        }

        // Prix de base (important : définir avant usage)
        let basePrix = parseInt((card.price || "").replace(/[^\d]/g, "")) || 0;

        // Vérification si déjà possédée par >=2 joueurs pour bump prix
        let owners = 0;
        try {
          if (MyNeoFunctions.getAllFiches) {
            const allFiches = await MyNeoFunctions.getAllFiches();
            owners = allFiches.filter(f =>
              (f.cards || "").split("\n").map(x => x.trim().toLowerCase()).includes(card.name.toLowerCase())
            ).length;
          }
        } catch (e) {
          console.log("WARN: getAllFiches error:", e);
        }
        let bumpedPrix = owners >= 2 ? basePrix + 500000 : basePrix;

        // Format price string (keep emoji 🧭)
        const priceString = `${formatNumber(bumpedPrix)} 🧭`;

        // Affichage carte + confirmation (identique au format demandé)
        await ovl.sendMessage(ms_org, {
          image: { url: card.image },
          caption: `🎴 *Carte :* ${card.name}

Nom : ${card.name}
Grade : ${card.grade}
Catégorie : ${card.category}
Placement : ${card.placement}
🛍️Prix : ${priceString}

✔️ Confirmer ${mode === 'achat' ? "l'achat" : "la vente"} ? (oui / non / +coupon)

*Tu as 1 minute pour répondre.*`
        }, { quoted: ms });

        // Attente confirmation
        let confNorm = (await waitFor(60000)).toLowerCase();
        if (!confNorm) {
          userInput = await waitFor(120000);
          continue;
        }

        // Coupon handling
        let couponUsed = false;
        let finalPrice = bumpedPrix;
        if (confNorm.includes("+coupon")) {
          const userCoupons = parseInt(userData.coupons || 0);
          if (userCoupons < 100) {
            await repondre("❌ Pas assez de coupons (100 nécessaires). Opération annulée.");
            userInput = await waitFor(120000);
            continue;
          }
          finalPrice = Math.floor(finalPrice / 2);
          couponUsed = true;
        }

        // If user didn't confirm
        if (!confNorm.includes("oui") && !couponUsed) {
          await repondre("❌ Opération annulée. Tape `close` ou une autre commande.");
          userInput = await waitFor(120000);
          continue;
        }

        // Apply coupon deduction if used
        if (couponUsed) {
          await MyNeoFunctions.updateUser(auteur_Message, { coupons: (parseInt(userData.coupons||0) - 100) });
          await repondre("🎟️ Coupon utilisé ! 50% de réduction appliquée.");
        }

        // ----------------- ACHAT -----------------
        if (mode === 'achat') {
          // Vérification NP
          let np = parseInt(userData.np || 0);
          if (np < 1) {
            await repondre("❌ Tu n’as pas assez de NP.");
            userInput = await waitFor(120000);
            continue;
          }

          // Vérifier si le joueur a soit des golds (fiche) soit des nc (userData)
          let golds = parseInt(fiche.golds || 0);
          let nc = parseInt(userData.nc || 0);
          if (golds < finalPrice && nc < finalPrice) {
            await repondre("❌ Pas assez de fonds (Golds ou NC).");
            userInput = await waitFor(120000);
            continue;
          }

          // Débit NP
          await MyNeoFunctions.updateUser(auteur_Message, { np: np - 1 });

          // Préférence débit Golds si disponible, sinon NC
          if (golds >= finalPrice) {
            await setfiche("golds", golds - finalPrice, auteur_Message);
          } else {
            await MyNeoFunctions.updateUser(auteur_Message, { nc: nc - finalPrice });
          }

          // Ajouter carte à la fiche
          let currentCards = (fiche.cards || "").split("\n").map(x => x.trim()).filter(Boolean);
          if (!currentCards.includes(card.name)) {
            currentCards.push(card.name);
            await setfiche("cards", currentCards.join("\n"), auteur_Message);
          }

          // Facture d'achat
          await ovl.sendMessage(ms_org, {
            image: { url: card.image },
            caption: `╭───〔 🛍️ REÇU D’ACHAT 〕───────

👤 Client : ${fiche.code_fiche}

🎴 Carte ajoutée : ${card.name}

💳 Paiement :
• 1 NP
• ${formatNumber(finalPrice)} 🧭

Merci pour ton achat !
╰───────────────────`
          }, { quoted: ms });

        } else { // ----------------- VENTE -----------------
          // Vérifier que le joueur possède la carte demandée
          let currentCards = (fiche.cards || "").split("\n").map(x => x.trim()).filter(Boolean);

          // Recherche dans la fiche : priorise exact match (cas sensible), sinon startsWith/includes
          let ownedIndex = currentCards.findIndex(n => n.toLowerCase() === card.name.toLowerCase());
          if (ownedIndex === -1) {
            // try partial matches in fiche
            const partials = currentCards.filter(n => n.toLowerCase().includes(q));
            if (partials.length === 0) {
              await repondre(`❌ Tu ne possèdes pas cette carte (${card.name}).`);
              userInput = await waitFor(120000);
              continue;
            } else if (partials.length === 1) {
              // use that
              card = allCards.find(c => c.name.toLowerCase() === partials[0].toLowerCase()) || card;
              ownedIndex = currentCards.findIndex(n => n === card.name);
            } else {
              // multiple partials → ask which
              let selMsg = "📋 *Cartes correspondantes dans ta fiche :*\n\n";
              partials.forEach((n, i) => selMsg += `${i+1}. ${n}\n`);
              selMsg += `\nTape le numéro (1-${partials.length}) ou 'close'.`;
              await repondre(selMsg);
              let sel = await waitFor(60000);
              const idx = parseInt(sel);
              if (isNaN(idx) || idx < 1 || idx > partials.length) {
                await repondre("❌ Numéro invalide ou temps écoulé.");
                userInput = await waitFor(120000);
                continue;
              }
              const chosen = partials[idx-1];
              card = allCards.find(c => c.name.toLowerCase() === chosen.toLowerCase());
              ownedIndex = currentCards.findIndex(n => n === card.name);
            }
          }

          if (ownedIndex === -1) {
            await repondre("❌ Carte introuvable dans ta fiche.");
            userInput = await waitFor(120000);
            continue;
          }

          // Retirer la carte et créditer la moitié du prix
          const halfPrice = Math.floor(finalPrice / 2);
          currentCards.splice(ownedIndex, 1);
          await setfiche("cards", currentCards.join("\n"), auteur_Message);

          // crédit preference: golds on fiche if you use that currency, else nc
          let goldsAfter = parseInt(fiche.golds || 0) + halfPrice;
          await setfiche("golds", goldsAfter, auteur_Message);

          // Facture de vente
          await ovl.sendMessage(ms_org, {
            image: { url: card.image },
            caption: `╭───〔 🛍️ REÇU DE VENTE 〕───────

👤 Client : ${fiche.code_fiche}

🎴 Carte retirée : ${card.name}

💳 Tu as reçu :
• ${formatNumber(halfPrice)} 🧭

Merci pour ta vente !
╰───────────────────`
          }, { quoted: ms });
        }

        // ready for next command
        userInput = await waitFor(120000);
      } catch (innerErr) {
        console.log("❌ ERREUR SESSION BOUTIQUE (interne) :", innerErr && innerErr.stack ? innerErr.stack : innerErr);
        await repondre("❌ Une erreur est survenue dans la boutique.");
        // continue session (don't break) — wait for next input
        userInput = await waitFor(120000);
      }
    }

  } catch (e) {
    console.log("❌ ERREUR Boutique (critique) :", e && e.stack ? e.stack : e);
    return repondre("❌ Une erreur est survenue dans la boutique.");
  }
});
