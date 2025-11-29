const { ovlcmd } = require('../lib/ovlcmd');
const { MyNeoFunctions } = require("../DataBase/myneo_lineup_team");
const { getData, setfiche, getAllFiches } = require("../DataBase/allstars_divs_fiches");

const fs = require("fs");
const path = require("path");

// Chargement Auto des cartes depuis ./DataBase/cards ----------
function loadCards(directory) {
  const cards = {}; // clé = filename, valeur = { file: fullPath, filename }

  // assure le chemin absolu (moins d'erreurs)
  const dir = path.isAbsolute(directory) ? directory : path.join(__dirname, "..", directory);

  if (!fs.existsSync(dir)) return cards;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);

    // ignore dossiers
    if (fs.statSync(fullPath).isDirectory()) continue;

    if (/\.(jpg|jpeg|png)$/i.test(file)) {
      cards[file] = {
        filename: file,
        file: fullPath
      };
    }
  }
  return cards;
}

// charge automatiquement
const shopCards = loadCards("DataBase/cards");

// utilitaires 
function parsePrice(priceString) {
  if (!priceString) return { type: "golds", amount: 0 };
  const s = priceString.toLowerCase();
  if (s.includes("nc")) return { type: "nc", amount: parseInt(s.replace(/[^0-9]/g, "") || "0", 10) };
  if (s.includes("m")) return { type: "golds", amount: parseInt(s.replace(/[^0-9]/g, "") || "0", 10) * 1000000 };
  if (s.includes("k")) return { type: "golds", amount: parseInt(s.replace(/[^0-9]/g, "") || "0", 10) * 1000 };
  return { type: "golds", amount: parseInt(s.replace(/[^0-9]/g, "") || "0", 10) || 0 };
}

function normalize(str = "") {
  return str
    .toString()
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// levenshtein (inchangé)
function levenshtein(a, b) {
  a = a || "";
  b = b || "";
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

// PARSE le nom de la carte à partir du filename ----------
// attend un fichier nommé style: Sasuke_bronze_sparking_sp_300k.jpg
function parseCardData(fileName) {
  const nameWithoutExt = fileName.replace(/\.(jpg|jpeg|png)$/i, "");
  const parts = nameWithoutExt.split("_");

  // défense: si le format n'est pas complet, on complète pour éviter crash
  const [rawName = "", color = "", type = "", grade = "", price = ""] = parts;

  return {
    filename: fileName,
    name: rawName.toLowerCase(),
    color: color.toLowerCase(),
    type: type.toLowerCase(),   // sparking/ultra/legend etc
    grade: grade.toLowerCase(), // sp / s / sm / ss etc selon name
    priceData: parsePrice(price)
  };
}

// RECHERCHE: on veut que l'utilisateur tape 3 mots-clés (nom + couleur + rareté) ----------
function findCardByKeywords(userMessage) {
  if (!userMessage) return null;

  // on récupère mots saisis (en minuscule), supprime underscores
  const text = userMessage.toLowerCase().replace(/_/g, " ");
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length === 0) return null;

  // pour chaque fichier, on parse les infos et on vérifie que les 3 éléments existent dans la saisie
  for (const fileKey of Object.keys(shopCards)) {
    const info = parseCardData(fileKey);
    // transform to comparison tokens
    const tokens = [info.name, info.color, info.type, info.grade].map(t => t.toLowerCase());

    // check presence of at least name + color + type/grade (on autorise type ou grade comme rareté)
    const hasName = words.some(w => normalize(w).includes(normalize(info.name)) || normalize(info.name).includes(normalize(w)));
    const hasColor = words.some(w => normalize(w) === normalize(info.color));
    const hasRarity = words.some(w => normalize(w) === normalize(info.type) || normalize(w) === normalize(info.grade) || normalize(w) === "sp" && normalize(info.type).includes("sparking"));

    if (hasName && hasColor && hasRarity) {
      return fileKey; // retourne le filename trouvé
    }
  }

  // fallback: fuzzy match (si saisie en une seule chaîne)
  // on cherche la meilleure correspondance sur le filename complet
  const q = normalize(userMessage);
  let best = null;
  let bestScore = Infinity;
  for (const key of Object.keys(shopCards)) {
    const score = levenshtein(q, normalize(key));
    if (score < bestScore) {
      bestScore = score;
      best = key;
    }
  }
  // si trop différent => null (seuil ajustable)
  if (bestScore <= 10) return best;
  return null;
}

// ---------- recherche (utilitaire existant) ----------
function searchCardFuzzy(query) {
  // retourne le filename ou null
  return findCardByKeywords(query);
}

// OVLCMD
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

    if (!txt.startsWith("achat:")) return repondre("❌ Veuillez commencer votre message par 'achat:' suivi du nom de la carte.");

    txt = txt.replace("achat:", "").trim();
    if (!txt) return repondre("❌ Veuillez indiquer le nom de la carte après 'achat:'.");

    const requestedCards = txt.split(",").map(x => x.trim()).filter(Boolean);
    const allFiches = await getAllFiches();

    let totalPrice = 0;
    const cardsToSend = [];

    for (const rcInput of requestedCards) {
      // on recherche via les mots-clés (nom + couleur + rareté)
      const foundFile = findCardByKeywords(rcInput);

      if (!foundFile) return repondre(`❌ Carte non trouvée ou format incorrect: ${rcInput}`);

      const cardInfo = parseCardData(foundFile);

      // Vérification si 2 joueurs possèdent déjà la carte
      const possessedBy = allFiches.filter(f => f.cards && f.cards.toLowerCase().includes((cardInfo.name + " " + cardInfo.grade).toLowerCase())).length;
      let priceAmount = cardInfo.priceData.amount || 0;
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
    // NOTE: j'envoie en utilisant file:// + chemin absolu — si ovl n'accepte pas file://,
    // remplace `image: { url: 'file://' + ... }` par un Buffer ou un stream.
    for (const card of cardsToSend) {
      const fullPath = shopCards[card.file].file ? shopCards[card.file].file : shopCards[card.file];
      // si shopCards stocke juste le fullPath en string, adapt above accordingly

      // méthode proposée (file://)
      await ovl.sendMessage(ms_org, {
        image: { url: 'file://' + fullPath },
        caption: `🎴 ${card.info.name.toUpperCase()} ${card.info.color} ${card.info.type} ${card.info.grade}`
      }, { quoted: ms });

      // Si ovl attend stream/buffer (décommente et ajuste si besoin):
      // await ovl.sendMessage(ms_org, {
      //   image: fs.createReadStream(fullPath),
      //   caption: `🎴 ${card.info.name.toUpperCase()} ...`
      // }, { quoted: ms });
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
