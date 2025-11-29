const { ovlcmd } = require('../lib/ovlcmd');
const { MyNeoFunctions } = require("../DataBase/myneo_lineup_team");
const { getData, setfiche, getAllFiches } = require("../DataBase/allstars_divs_fiches");

 
const fs = require("fs");
const path = require("path");

function loadCards(directory) {
    const cards = {};

    const files = fs.readdirSync(directory);

    for (const file of files) {
        const fullPath = path.join(directory, file);

        // On ignore les sous-dossiers
        if (fs.statSync(fullPath).isDirectory()) continue;

        if (file.endsWith(".jpg") || file.endsWith(".png")) {
            cards[file] = fullPath; // clé = nom du fichier, valeur = chemin complet
        }
    }

    return cards;
}

// Chargement auto depuis /database/cards/
const shopCards = loadCards("./DataBase/cards");

function findCard(userMessage) {
    const text = userMessage.toLowerCase().replace(/_/g, " ");
    const words = text.split(/\s+/);

    for (const cardName in shopCards) {
        const card = shopCards[cardName];
        const keywords = [];

        // Nom : alias + version sans underscore
        card.alias.forEach(a => {
            keywords.push(a.toLowerCase()); 
            keywords.push(a.toLowerCase().replace(/_/g, ""));
        });

        // Rareté
        keywords.push(card.rare.toLowerCase());        // sparking
        keywords.push("sp");                           // sp équivalent sparking

        // Couleur
        keywords.push(card.color.toLowerCase());       // bronze/silver/or

        let matches = 0;

        for (const w of words) {
            if (keywords.includes(w)) {
                matches++;
            }
        }

        // Le joueur doit donner 3 éléments : nom + rareté + couleur
        if (matches >= 3) {
            return card;
        }
    }

    return null;
}


module.exports = {
  nom_cmd: "boutique",
  classe: "Shop",
  react: "🛍️",
  desc: "Afficher la boutique",
  execute: async (ms_org, ovl, cmd) => {
    console.log("Commande boutique chargée ✅");
  }
};

// Conversion prix
function parsePrice(priceString) {
priceString = priceString.toLowerCase();
if (priceString.includes("nc")) return { type: "nc", amount: parseInt(priceString.replace("nc", "")) };
if (priceString.includes("m")) return { type: "golds", amount: parseInt(priceString.replace("m", "")) * 1000000 };
if (priceString.includes("k")) return { type: "golds", amount: parseInt(priceString.replace("k", "")) * 1000 };
return { type: "golds", amount: 0 };
}

function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire accents
    .replace(/[^a-z0-9]/g, ""); // retire tout sauf lettres/chiffres
}

//recherche intelligente plus tolerance
function levenshtein(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
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

//trouve la card a partir de plusieurs mots
function searchCard(query, boutique) {
  const q = normalize(query);

  let bestMatch = null;
  let bestScore = Infinity;

  for (const key of Object.keys(boutique)) {
    const cleanKey = normalize(key);

    const score = levenshtein(q, cleanKey);

    if (score < bestScore) {
      bestScore = score;
      bestMatch = key;
    }
  }

  
  // si trop différent → pas sûr
  if (bestScore > 15) return null;

  return bestMatch;
}

// Parse les infos de la carte depuis le nom du fichier
function parseCardData(file) {
const parts = file.replace(".jpg","").split("_");
return {
name: parts[0].toLowerCase(),
color: parts[1].toLowerCase(),
type: parts[2].toLowerCase(),
grade: parts[3].toLowerCase(),
priceData: parsePrice(parts[4])
};
}


ovlcmd({
nom_cmd: "boutique🛍️",
react: "🛒",
classe: "NEO_GAMES🎰"
}, async (ms_org, ovl, { ms, auteur_Message, repondre }) => {
try {

const userData = await MyNeoFunctions.getUserData(auteur_Message);
const fiche = await getData({ jid: auteur_Message });
if (!userData || !fiche) return repondre("❌ Impossible de récupérer ta fiche.");

// --- Message d'accueil ---
await ovl.sendMessage(ms_org, {
    image: { url: 'https://files.catbox.moe/ye33nv.png' },
    caption: `╭────〔 *🛍️BOUTIQUE🛒* 〕

😃Bienvenue dans la boutique NEO🛍️Store🛒, pour faire un achat il vous suffit de taper comme ceci :
*achat: sasuke bronze sparking/sp* puis après avoir obtenu votre facture, veuillez remettre à un boutiquier qui mettra à jour sur votre fiche. *#Happy202️⃣6️⃣🎊🎄*
╰───────────────────
                  *🔷NEO🛍️STORE* `
}, { quoted: ms });

// --- Récupération du texte des cartes ---
const rep = await ovl.recup_msg({ auteur: auteur_Message, ms_org, temps: 60000 });
let txt = (rep?.message?.extendedTextMessage?.text || rep?.message?.conversation || "").toLowerCase();
if (!txt) return repondre("❌ Aucune carte détectée.");

// Vérifie que le joueur a bien écrit "achat:"
if (!txt.startsWith("achat:")) return repondre("❌ Veuillez commencer votre message par 'achat:' suivi du nom de la carte.");

// Supprime "achat:" pour ne garder que le nom des cartes
txt = txt.replace("achat:", "").trim();
if (!txt) return repondre("❌ Veuillez indiquer le nom de la carte après 'achat:'.");

const collector = message.channel.createMessageCollector({ time: 30000 });

collector.on("collect", msg => {
  const attempt = msg.content;
  let found2 = searchCard(attempt, boutique);

  if (found2) {
    collector.stop();
    return msg.reply(`🎉 Trouvé cette fois ! **${found2}**`);
  } else {
    msg.reply("Toujours rien 😅 Réessaie encore !");
  }
}); 

  
const requestedCards = txt.split(",").map(x => x.trim());
const allFiches = await getAllFiches();

let totalPrice = 0;
const cardsToSend = [];

// --- Nouveau bloc tolérant ---
for (const rcInput of requestedCards) {
    const rcWords = rcInput.toLowerCase().split(/[\s_]+/); // découpe la saisie en mots

    const foundFile = Object.keys(shopCards).find(f => {
        const c = parseCardData(f);
        const cardWords = [c.name, c.color, c.type, c.grade]; // mots du fichier
        // Vérifie que chaque mot de la saisie est présent dans les mots du fichier
        return rcWords.every(w => cardWords.includes(w));
    });

    if (!foundFile) return repondre(`❌ Carte non trouvée ou format incorrect: ${rcInput}`);

    const cardInfo = parseCardData(foundFile);

    // Vérification si 2 joueurs possèdent déjà la carte
    const possessedBy = allFiches.filter(f => f.cards && f.cards.toLowerCase().includes(cardInfo.name + " " + cardInfo.grade)).length;
    let priceAmount = cardInfo.priceData.amount;
    if (possessedBy >= 2) {
        priceAmount += 500000;
        await repondre(`⚠️ La carte ${cardInfo.name.toUpperCase()} ${cardInfo.grade} est déjà possédée par 2 joueurs, son prix augmente de 500k 🧭`);
    }

    totalPrice += priceAmount;
    cardsToSend.push({ file: foundFile, info: cardInfo, price: priceAmount });
}
    

// --- Confirmation avant achat ---
await ovl.sendMessage(ms_org, {
    caption: `💲 Total à payer: ${totalPrice} 🧭 + 1NP  

Répondez par Oui pour confirmer ou Non pour annuler`
}, { quoted: ms });

const conf = await ovl.recup_msg({ auteur: auteur_Message, ms_org, temps: 60000 });
const confTxt = (conf?.message?.extendedTextMessage?.text || conf?.message?.conversation || "").toLowerCase();
if (!["oui","o","yes"].includes(confTxt)) return repondre("❌ Achat annulé.");

// --- Vérification et déduction de l'argent et 1NP ---
let playerGolds = parseInt(fiche.golds) || 0;
if (playerGolds < totalPrice) return repondre("❌ Tu n’as pas assez de 🧭 golds.");
await setfiche("golds", playerGolds - totalPrice, auteur_Message);

let playerNP = parseInt(fiche.np) || 0;
if (playerNP < 1) return repondre("❌ Tu n’as pas assez de NP pour acheter cette carte.");
await setfiche("np", playerNP - 1, auteur_Message);

// --- Envoi groupé des cartes ---
const mediaArray = cardsToSend.map(card => ({
    image: { url: shopCards[card.file] },
    caption: `🎴 ${card.info.name.toUpperCase()} ${card.info.color} ${card.info.type} ${card.info.grade}`
}));

for (const media of mediaArray) {
    await ovl.sendMessage(ms_org, media, { quoted: ms });
}

// --- Facture ---
const codeClient = fiche.code_fiche;
const factureText = `╭───〔 *🛍️BOUTIQUE🛒* 〕─────── 

👤Code client: ${codeClient}
💲Total: ${totalPrice} 🧭 +1NP
🎴Objets: ${cardsToSend.map(c => c.info.name + " " + c.info.color + " " + c.info.type + " " + c.info.grade).join(", ")}
👉🏽
╰───────────────────
               *🔷NEO🛍️STORE*,`;

await repondre(factureText);

} catch (e) {
console.error(e);
repondre("❌ Une erreur est survenue dans la boutique.");
}
});
