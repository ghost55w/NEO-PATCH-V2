const { ovlcmd } = require('../lib/ovlcmd');
const { MyNeoFunctions } = require("../DataBase/myneo_lineup_team");
const { getData, setfiche, getAllFiches } = require("../DataBase/allstars_divs_fiches");

// Liste des cartes avec image
const shopCards = {
  "Trunks_argent_sparking_ssm_200nc.jpg": "https://files.catbox.moe/alprgr.jpg",
  "Trunks_argent_ultra_ssm_170nc.jpg": "https://files.catbox.moe/ougnbx.jpg",
  "Trunks_argent_ultra_ssp_230nc.jpg": "https://files.catbox.moe/zicnsn.jpg",
  "Tsunade_bronze_ultra_s_400k.jpg": "https://files.catbox.moe/nlggb9.jpg",
  "Twice_bronze_sparking_sm_100k.jpg": "https://files.catbox.moe/rk9zp5.jpg",
  "Uraume_argent_ultra_sm_500k.jpg": "https://files.catbox.moe/mugdkc.jpg",
  "Vanessa_bronze_sparking_sm_100k.jpg": "https://files.catbox.moe/kyael1.jpg",
  "Vanica_argent_sparking_sm_500k.jpg": "https://files.catbox.moe/dekzwe.jpg",
  "Vegeta_argent_ultra_ssm_180nc.jpg": "https://files.catbox.moe/k2cdjt.jpg",
  "Vegeta_bronze_sparking_ssp_130nc.jpg": "https://files.catbox.moe/swz65c.jpg",
  "Vegeta_or_legend_ss_340nc.jpg": "https://files.catbox.moe/fgqu2w.jpg",
  "Vegeta_or_legend_ssp_450nc.jpg": "https://files.catbox.moe/l3gss8.jpg",
  "Vegeta_or_legend_ssp_550nc.jpg": "https://files.catbox.moe/b9svgt.jpg",
  "Vegeta_or_ultra_ssp_420nc.jpg": "https://files.catbox.moe/7pznu1.jpg",
  "Vegito_bronze_legend_ssp_450nc.jpg": "https://files.catbox.moe/rgybyi.jpg",
  "Vegito_or_legend_ssp_550nc.jpg": "https://files.catbox.moe/wujmrs.jpg",
  "Vengeance_argent_sparking_sm_500k.jpg": "https://files.catbox.moe/aupjwj.jpg",
  "Vetto_argent_sparking_sm_500k.jpg": "https://files.catbox.moe/xp0i8c.jpg",
  "Victor_argent_sparking_sm_500k.jpg": "https://files.catbox.moe/m3hq7x.jpg",
  "Videl_bronze_sparking_sp_500k.jpg": "https://files.catbox.moe/0mubo7.jpg",
  "Weatherreport_argent_ultra_sm_900k.jpg": "https://files.catbox.moe/eq2wxq.jpg",
  "Wendy_bronze_sparking_sm_100k.jpg": "https://files.catbox.moe/uowygv.jpg",
  "Yahaba_bronze_sparking_sm_100k.jpg": "https://files.catbox.moe/jqa4l1.jpg",
  "Yamato_bronze_sparking_s_300k.jpg": "https://files.catbox.moe/ngy97w.jpg",
  "Yamcha_bronze_sparking_sp_500k.jpg": "https://files.catbox.moe/03fmv6.jpg",
  "Yami_argent_legend_s_50nc.jpg": "https://files.catbox.moe/alpzdx.jpg",
  "Yorozu_argent_sparking_sm_500k.jpg": "https://files.catbox.moe/zydytg.jpg",
  "YujiShibuyaIncident_bronze_sparking_s_200k.jpg": "https://files.catbox.moe/w0j4ll.jpg",
  "Yuji_argent_sparking_sm_50nc.jpg": "https://files.catbox.moe/q3yidh.jpg",
  "Yuji_bronze_sparking_sm_100k.jpg": "https://files.catbox.moe/dh6evb.jpg",
  "Yuki_argent_ultra_sm_500k.jpg": "https://files.catbox.moe/16a2yx.jpg",
  "Yuno_bronze_sparking_sm_100k.jpg": "https://files.catbox.moe/v3bnlo.jpg",
  "YutaJjk0_bronze_legend_sp_400k.jpg": "https://files.catbox.moe/06fvgx.jpg",
  "Yuta_argent_ultra_sm_50nc.jpg": "https://files.catbox.moe/pm6ioo.jpg",
  "Zabuza_bronze_sparking_sm_100k.jpg": "https://files.catbox.moe/44fdv2.jpg",
  "Zamasu_or_legend_ssp_520nc.jpg": "https://files.catbox.moe/163ro4.jpg",
  "Zenitsu_bronze_sparking_sm_200k.jpg": "https://files.catbox.moe/fqil2d.jpg",
  "Zeno_bronze_sparking_sp_400k.jpg": "https://files.catbox.moe/cem49v.jpg",
  "Zenon_or_ultra_sm_1m.jpg": "https://files.catbox.moe/ezuqry.jpg",
  "Zeref_argent_sparking_s_500k.jpg": "https://files.catbox.moe/7than2.jpg",
  "Zohakuten_bronze_ultra_sp_400k.jpg": "https://files.catbox.moe/1yh0jf.jpg",
  "Zora_bronze_sparking_sm_100k.jpg": "https://files.catbox.moe/dgoqx7.jpg",
  "Zorro_argent_ultra_sm_500k.jpg": "https://files.catbox.moe/h2cvdu.jpg"
};,
// ajoute toutes les autres cartes ici...
};

// Conversion prix
function parsePrice(priceString) {
priceString = priceString.toLowerCase();
if (priceString.includes("nc")) return { type: "nc", amount: parseInt(priceString.replace("nc", "")) };
if (priceString.includes("m")) return { type: "golds", amount: parseInt(priceString.replace("m", "")) * 1000000 };
if (priceString.includes("k")) return { type: "golds", amount: parseInt(priceString.replace("k", "")) * 1000 };
return { type: "golds", amount: 0 };
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

// Aliases pour tolérance de saisie
const cardAliases = {
"trunks ssm": "trunks_argent_sparking_ssm",
"vegeta legend": "vegeta_or_legend",
"vegeta legend ssp": "vegeta_or_legend_ssp",
"vegito legend": "vegito_or_legend_ssp",
// ajoute les autres alias selon besoin
};

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
    image: { url: 'https://files.catbox.moe/your_shop_image.jpg' },
    caption: `🛍️ Bienvenue à la boutique All Stars !

📌 Pour acheter plusieurs cartes, séparez-les par des virgules
📌 Format: nom couleur type grade
(ex: vegeta or legend SS+, trunks argent sparking SM)`
}, { quoted: ms });

// --- Récupération du texte des cartes ---
const rep = await ovl.recup_msg({ auteur: auteur_Message, ms_org, temps: 60000 });
const txt = (rep?.message?.extendedTextMessage?.text || rep?.message?.conversation || "").toLowerCase();
if (!txt) return repondre("❌ Aucune carte détectée.");

const requestedCards = txt.split(",").map(x => x.trim());
const allFiches = await getAllFiches();

let totalPrice = 0;
const cardsToSend = [];

for (const rcInput of requestedCards) {
    const rc = cardAliases[rcInput] || rcInput;

    const foundFile = Object.keys(shopCards).find(f => {
        const c = parseCardData(f);
        return rc.includes(c.name) && rc.includes(c.color) && rc.includes(c.type) && rc.includes(c.grade);
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
