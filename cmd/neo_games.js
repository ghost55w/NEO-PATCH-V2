const { ovlcmd } = require('../lib/ovlcmd');
const fs = require('fs');
const { cards } = require('../DataBase/cards');
const { MyNeoFunctions } = require("../DataBase/myneo_lineup_team");
const { getData, setfiche } = require("../DataBase/allstars_divs_fiches");

const generateRandomNumbers = (min, max, count) => {
  const numbers = new Set();
  while (numbers.size < count) {
    numbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  return Array.from(numbers);
};

const generateRewards = () => {
  const rewards = ['10🔷', '25.000 G🧭', '5🎟'];
  return rewards.sort(() => 0.5 - Math.random()).slice(0, 3);
};

ovlcmd({
  nom_cmd: 'roulette',
  classe: 'NEO_GAMES🎰',
  react: '🎰',
  desc: 'Lance une roulette aléatoire avec récompenses.'
}, async (ms_org, ovl, { ms, repondre, auteur_Message }) => {
  try {
    const authorizedChats = [
      '120363024647909493@g.us',
      '120363307444088356@g.us',
      '22651463203@s.whatsapp.net',
      '22605463559@s.whatsapp.net'
    ];
    if (!authorizedChats.includes(ms_org)) return repondre("Commande non autorisée pour ce chat.");

    const userData = await MyNeoFunctions.getUserData(auteur_Message);
    if (!userData) return repondre("❌ Joueur introuvable dans MyNeo.");

    const fiche = await getData({ jid: auteur_Message });
    if (!fiche) return repondre("❌ Fiche All Stars introuvable pour ce joueur.");

    let valeur_np = parseInt(userData.np) || 0;
    if (valeur_np < 1) return repondre("❌ Tu n’as pas assez de np (au moins 1 requis).");

    let valeur_nc = parseInt(userData.nc) || 0;
    let valeur_coupons = parseInt(userData.coupons) || 0;
    let valeur_golds = parseInt(fiche.golds) || 0;

    const numbers = generateRandomNumbers(0, 50, 50);
    const winningNumbers = generateRandomNumbers(0, 50, 3);
    const rewards = generateRewards();

    let msga = `*🎰𝗧𝗘𝗡𝗧𝗘𝗭 𝗩𝗢𝗧𝗥𝗘 𝗖𝗛𝗔𝗡𝗖𝗘🥳 !!*🎉🎉
▭▬▭▬▭▬▭▬▭▬▭▬════░▒▒▒▒░░▒░

Bienvenue dans la Roulette, choisissez un chiffre parmis les *5️⃣0️⃣*. Si vous choisissez le bon chiffre alors vous gagnez une récompense 🎁. *⚠️Vous avez 2 chances pour choisir le bon numéro*. 
🎊▔▔🎊▔🎊▔🎊▔▔🎊▔▔🎊▔🎊▔🎊
╭─────〔 *🎰CASINO🎰* 〕───
*\`${numbers.join(', ')}\`*. 
🎊▔▔🎊▔🎊▔🎊▔▔🎊▔▔🎊▔🎊▔🎊
             🎁10🔷  🎁25.000 🧭  🎁5🎫  

*🎊Voulez-vous tenter votre chance ?* (1min)
✅: \`Oui\`
❌: \`Non\`
╰───────────────────
 ══░▒▒▒▒░░▒░`;

    await ovl.sendMessage(ms_org, {
      video: { url: 'https://files.catbox.moe/amtfgl.mp4' },
      caption: msga,
      gifPlayback: true
    }, { quoted: ms });

    const getConfirmation = async (attempt = 1) => {
      if (attempt > 3) throw new Error('TooManyAttempts');
      const rep = await ovl.recup_msg({ auteur: auteur_Message, ms_org, temps: 60000 });
      const response = (rep?.message?.extendedTextMessage?.text || rep?.message?.conversation || "").trim().toLowerCase();
      if (response == 'oui') return true;
      if (response == 'non') throw new Error('GameCancelledByUser');
      await repondre('❓ Veuillez répondre par Oui ou Non.');
      return await getConfirmation(attempt + 1);
    };

    await getConfirmation();

    valeur_np -= 1;
    await MyNeoFunctions.updateUser(auteur_Message, { np: valeur_np });

    const getChosenNumber = async (isSecond = false, attempt = 1) => {
      if (attempt > 3) throw new Error('TooManyAttempts');
      await ovl.sendMessage(ms_org, {
        video: { url: 'https://files.catbox.moe/amtfgl.mp4' },
        caption: isSecond ? '🎊😃: *Vous avez une deuxième chance ! Choisissez un autre numéro. Vous avez 1 min ⚠️* (Répondre à ce message)' : '🎊😃: *Choisissez un numéro. Vous avez 1 min ⚠️* (Répondre à ce message)',
        gifPlayback: true
      }, { quoted: ms });
      const rep = await ovl.recup_msg({ auteur: auteur_Message, ms_org, temps: 60000 });
      const number = parseInt(rep?.message?.extendedTextMessage?.text || rep?.message?.conversation);
      if (isNaN(number) || number < 0 || number > 50) {
        await repondre('❌ Numéro invalide.');
        return await getChosenNumber(isSecond, attempt + 1);
      }
      return number;
    };

    const checkNumber = async (num, isSecond = false) => {
      if (winningNumbers.includes(num)) {
        const idx = winningNumbers.indexOf(num);
        let reward = rewards[idx];
        switch (reward) {
          case '10🔷':
            valeur_nc += 10;
            await MyNeoFunctions.updateUser(auteur_Message, { nc: valeur_nc });
            break;
          case '25.000 G🧭':
            valeur_golds += 25000;
            await setfiche("golds", valeur_golds, auteur_Message);
            break;
          case '5🎟':
            valeur_coupons += 5;
            await MyNeoFunctions.updateUser(auteur_Message, { coupons: valeur_coupons });
            break;
        }
        await ovl.sendMessage(ms_org, {
          video: { url: 'https://files.catbox.moe/vfv2hk.mp4' },
          caption: `🎰FÉLICITATIONS ! 🥳🥳 vous avez gagné +${reward} 🎁🎊
══░▒▒▒▒░░▒░`,
          gifPlayback: true
        }, { quoted: ms });
        return true;
      } else if (isSecond) {
        await ovl.sendMessage(ms_org, {
          video: { url: 'https://files.catbox.moe/hmhs29.mp4' },
          caption: `😫😖💔 ▭▬▭▬▭▬▭▬▭▬▭▬▭▬▭▬❌NON ! C'était le mauvais numéro ! Dommage tu y étais presque💔▭▬▭▬▭▬▭▬▭▬▭▬▭▬😫😖💔`,
          gifPlayback: true
        }, { quoted: ms });
      }
      return false;
    };

    const chosen1 = await getChosenNumber();
    const win1 = await checkNumber(chosen1);
    if (!win1) {
      const chosen2 = await getChosenNumber(true);
      await checkNumber(chosen2, true);
    }

  } catch (e) {
    console.error('Erreur roulette:', e);
    repondre("❌ Une erreur est survenue.");
  }
});

function tirerParProbabilite(table) {
    const random = Math.random() * 100;
    let cumulative = 0;
    for (const item of table) {
        cumulative += item.probability;
        if (random < cumulative) return item.value;
    }
    return table[table.length - 1].value;
}

function getAllCategories(type) {
    return [...new Set(cards[type].map(card => card.category))];
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function trouverCarte(type, gradeInit, catInit, tirees) {
    const grades = ['or', 'argent', 'bronze'];
    const tries = [gradeInit, ...shuffle(grades.filter(g => g !== gradeInit))];
    const cats = getAllCategories(type);
    for (const g of tries) {
        const catTry = [catInit, ...cats.filter(c => c !== catInit)];
        for (const c of catTry) {
            const dispo = cards[type].filter(
                x => x.grade === g && x.category === c && !tirees.includes(x.name)
            );
            if (dispo.length) return dispo[Math.floor(Math.random() * dispo.length)];
        }
    }
    return null;
}

async function envoyerCarte(dest, ovl, ms, type, gradeTable, catTable, tirees) {
    for (let i = 0; i < 10; i++) {
        const grade = tirerParProbabilite(gradeTable);
        const category = tirerParProbabilite(catTable);
        const card = trouverCarte(type, grade, category, tirees);
        if (card) {
            tirees.push(card.name);
            await ovl.sendMessage(dest, {
                image: { url: card.image },
                caption: `Grade: ${card.grade}\nCategory: ${card.category}\nName: ${card.name}\nPrix: ${card.price}`
            }, { quoted: ms });
            return;
        }
    }
    throw new Error("Aucune carte valide trouvée");
}

async function envoyerVideo(dest, ovl, videoUrl) {
    await ovl.sendMessage(dest, { video: { url: videoUrl }, gifPlayback: true });
}

ovlcmd(
    {
        nom_cmd: "tirageallstars",
        react: "🎰",
        classe: "NEO_GAMES🎰"
    },
    async (ms_org, ovl, { ms, auteur_Message, repondre }) => {
        try {
            const autorises = [
                '120363049564083813@g.us',
                '120363307444088356@g.us',
                '22651463203@s.whatsapp.net',
                '22605463559@s.whatsapp.net'
            ];
            if (!autorises.includes(ms_org)) return;

            await ovl.sendMessage(ms_org, {
                image: { url: 'https://files.catbox.moe/swbsgf.jpg' },
                caption: ''
            }, { quoted: ms });

            const demanderNiveau = async (tentative = 1) => {
                if (tentative > 3) throw new Error("MaxAttempts");
                try {
                    const rep = await ovl.recup_msg({ auteur: auteur_Message, ms_org, temps: 60000 });
                    const texte = rep.message?.extendedTextMessage?.text || rep.message?.conversation || "";
                    const r = texte.toLowerCase();
                    if (["legend", "legends"].includes(r)) return "legend";
                    if (r === "ultra") return "ultra";
                    if (r === "sparking") return "sparking";
                    await repondre("Choix invalide. Réponds par legends, ultra ou sparking.");
                    return await demanderNiveau(tentative + 1);
                } catch {
                    throw new Error("Timeout");
                }
            };

            const niveau = await demanderNiveau();

            const videoLinks = {
                sparking: 'https://files.catbox.moe/hm3t85.mp4',
                ultra: 'https://files.catbox.moe/kodcj4.mp4',
                legend: 'https://files.catbox.moe/3x9cvk.mp4'
            };

            const videoUrl = videoLinks[niveau];

            const probasGrade = [
                { value: "or", probability: 5 },
                { value: "argent", probability: 25 },
                { value: "bronze", probability: 70 }
            ];

            const probasCategorie = [
                { value: "ss+", probability: 2 },
                { value: "ss", probability: 5 },
                { value: "ss-", probability: 10 },
                { value: "s+", probability: 18 },
                { value: "s", probability: 25 },
                { value: "s-", probability: 40 }
            ];

            await envoyerVideo(ms_org, ovl, videoUrl);

            const tirees = [];
            await envoyerCarte(ms_org, ovl, ms, niveau, probasGrade, probasCategorie, tirees);
            await envoyerCarte(ms_org, ovl, ms, niveau, probasGrade, probasCategorie, tirees);

        } catch (e) {
            if (e.message === "Timeout") return repondre("*⏱️ Temps écoulé sans réponse.*");
            if (e.message === "MaxAttempts") return repondre("*❌ Trop de tentatives échouées.*");
            repondre("Erreur lors du tirage : " + e.message);
            console.error(e);
        }
    }
);
