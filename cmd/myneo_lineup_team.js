const { ovlcmd } = require('../lib/ovlcmd');
const { MyNeoFunctions, TeamFunctions, BlueLockFunctions } = require("../DataBase/myneo_lineup_team");
const { saveUser: saveMyNeo, deleteUser: delMyNeo, getUserData: getNeo, updateUser: updateMyNeo } = MyNeoFunctions;
const { saveUser: saveTeam, deleteUser: delTeam, getUserData: getTeam, updateUser: updateTeam } = TeamFunctions;
const { saveUser: saveLineup, deleteUser: delLineup, getUserData: getLineup, updatePlayers, updateStats } = BlueLockFunctions;

ovlcmd({
  nom_cmd: "save",
  classe: "Other",
  react: "💾",
  desc: "Enregistrer un joueur (myneo/team/lineup)",
}, async (ms_org, ovl, cmd) => {
  const { arg, repondre, prenium_id } = cmd;
  if (!prenium_id) return repondre("⚠️ Seuls les membres de la NS peuvent enregistrer un joueur.");
  const mention = arg[0];
  if (!mention) return repondre("⚠️ Mentionne un utilisateur.");

  const type = arg[1]?.toLowerCase();
  const baseMyNeo = {
    users: "aucun", tel: mention.replace("@s.whatsapp.net", ""), points_jeu: 0, nc: 0, np: 0,
    coupons: 0, gift_box: 0, all_stars: "", blue_lock: "+Team⚽", elysium: "+ElysiumMe💠"
  };
  const baseTeam = {
    users: "aucun", team: "aucun", points_jeu: 0, rank: "aucun",
    argent: 0, classement: "aucun", wins: 0, loss: 0,
    draws: 0, championnats: 0, nel: 0, niveau: 0, trophies: 0, goals: 0
  };
  const baseLineup = {
    nom: "aucun", joueur1: "", joueur2: "", joueur3: "", joueur4: "",
    joueur5: "", joueur6: "", joueur7: "", joueur8: "", joueur9: "",
    joueur10: "", joueur11: "", joueur12: "", joueur13: "", joueur14: "",
    joueur15: "", stat1: 100, stat2: 100, stat3: 100, stat4: 100,
    stat5: 100, stat6: 100, stat7: 100, stat8: 100, stat9: 100,
    stat10: 100
  };

  const bases = { myneo: baseMyNeo, team: baseTeam, lineup: baseLineup };
  const saves = { myneo: saveMyNeo, team: saveTeam, lineup: saveLineup };
  const gets = { myneo: getNeo, team: getTeam, lineup: getLineup };

  if (!bases[type]) return repondre("⚠️ Type invalide. Utilise : myneo, team ou lineup.");

  const existing = await gets[type](mention);
  if (existing) return repondre("⚠️ Ce joueur est déjà enregistré.");

  const base = { ...bases[type] };
  for (let i = 2; i < arg.length; i += 2) {
    const key = arg[i]?.toLowerCase();
    const val = arg[i + 1];
    if (key in base) {
      base[key] = isNaN(val) ? val : parseInt(val);
    }
  }

  const msg = await saves[type](mention, base);
  return repondre(msg);
});

ovlcmd({
  nom_cmd: "delete",
  classe: "Other",
  react: "🗑️",
  desc: "Supprimer un joueur (myneo/team/lineup)",
}, async (ms_org, ovl, cmd) => {
  const { arg, repondre, prenium_id } = cmd;
  if (!prenium_id) return repondre("⚠️ Seuls les membres de la NS peuvent supprimer un joueur.");

  const mention = arg[0];
  if (!mention) return repondre("⚠️ Mentionne un utilisateur.");
  const type = arg[1]?.toLowerCase();
  const dels = { myneo: delMyNeo, team: delTeam, lineup: delLineup };
  if (!dels[type]) return repondre("⚠️ Type invalide. Utilise : myneo, team ou lineup.");

  const msg = await dels[type](mention);
  return repondre(msg);
});

ovlcmd({
  nom_cmd: "myneo🔷",
  classe: "Other",
  react: "🪪",
  desc: "Afficher ou modifier les données NEO d'un joueur.",
}, async (ms_org, ovl, cmd_options) => {
  const { arg, auteur_Message, prenium_id, repondre } = cmd_options;
  let userId = auteur_Message;
  if (arg.length >= 1) {
    userId = arg[0];
    if (!userId) return repondre("⚠️ Mentionne un utilisateur.");
  }

  try {
    let data = await getNeo(userId);
    if (!data) return repondre("⚠️ Aucune donnée trouvée pour cet utilisateur.");

    if (arg.length <= 1) {
      const myn = `╭───〔 *🪀COMPTE NEO🔷* 〕
      
👤User: ${data.users}
📳Téléphone: ${data.tel}
🎮Points de jeux: ${data.points_jeu}
🔷NEOcoins: ${data.nc}🔷
🔶NEOpoints: ${data.np}🔶
🎫Coupons: ${data.coupons}🎫

*🎮MY GAMES🪀*
 ░▒▒▒▒░░▒░
▔▔▔▔▔▔▔▔▔▔▔▔░▒▒▒▒░░               
🌀All Stars: ${data.all_stars}
⚽Blue Lock: ${data.blue_lock}
💠Élysium: ${data.elysium}
╰───────────────────
                   *🔷NEOVERSE🎮*`;

      await ovl.sendMessage(ms_org, {
        video: { url: "https://files.catbox.moe/yimc4o.mp4" },
        gifPlayback: true,
        caption: ""
      }, { quoted: cmd_options.ms });
      
      return await ovl.sendMessage(ms_org, {
        image: { url: "https://files.catbox.moe/nyy6fb.jpg" },
        caption: myn
      }, { quoted: cmd_options.ms });
    }

    if (!prenium_id) return repondre("⚠️ Seuls les membres Premium peuvent actualiser un joueur.");

    const modifiables = [
      "users", "tel", "points_jeu", "nc", "np", "coupons", "gift_box",
      "all_stars", "blue_lock", "elysium"
    ];

    let updates = {};
    for (let i = 1; i < arg.length;) {
      const field = arg[i]?.toLowerCase();
      const op = arg[i + 1];
      if (!modifiables.includes(field) || !["=", "+", "-"].includes(op)) {
        i++;
        continue;
      }
      const isNumeric = ["points_jeu", "nc", "np", "coupons", "gift_box"].includes(field);
      let value;

      if (op === "=" && !isNumeric) {
        let valParts = [], j = i + 2;
        while (j < arg.length && !modifiables.includes(arg[j].toLowerCase())) valParts.push(arg[j++]);
        value = valParts.join(" "); i = j;
      } else {
        value = arg[i + 2]; i += 3;
      }

      if (value !== undefined) {
        if (isNumeric) {
          const val = parseInt(value);
          if (!isNaN(val)) {
            if (op === "=") updates[field] = val;
            else if (op === "+") updates[field] = data[field] + val;
            else if (op === "-") updates[field] = data[field] - val;
          }
        } else if (op === "=") updates[field] = value;
      }
    }

    if (Object.keys(updates).length > 0) {
      const message = await updateMyNeo(userId, updates);
      return repondre(message);
    } else {
      return repondre("⚠️ Format incorrect ou champ non valide. Exemple : +myNeo @user nc + 200 user = Damian KÏNGS⚜️");
    }

  } catch (err) {
    console.error("❌ Erreur ligne myNeo:", err);
    return repondre("❌ Une erreur est survenue.");
  }
});
 
ovlcmd({
  nom_cmd: "team⚽",
  classe: "Other",
  react: "⚽",
  desc: "Afficher ou modifier la team d’un joueur.",
}, async (ms_org, ovl, cmd_options) => {
  const { arg, auteur_Message, prenium_id, repondre } = cmd_options;
  let userId = auteur_Message;
  if (arg.length >= 1) {
    userId = arg[0];
    if (!userId) return repondre("⚠️ Mentionne un utilisateur.");
  }

  try {
    let data = await getTeam(userId);
    if (!data) return repondre("⚠️ Aucune donnée trouvée pour cet utilisateur.");

    if (arg.length <= 1) {
      const fiche = `░░ *👤PLAYER🥅⚽*: ${data.users}
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
*🛡️Team:* ${data.team}
*⬆️Niveau:* ${data.niveau}▲
*💰Argent:* ${data.argent} 💶
*🎖️Classement:* ${data.classement}

░░ *📊RECORDS⚽🥅*
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
*✅Wins:* ${data.wins}   *❌Loss:* ${data.loss}   *⚽Goals:* ${data.goals}
░▒▒▒▒░ *🏆Trophies:* ${data.trophies}

╭───〔 *⚽DATAS📊🔷* 〕───⬣
🥅+Lineup⚽: ⚠️pour voir la formation
🌍+player⚽: ⚠️pour voir son Hero

╰───────────────────
              *BLUE🔷LOCK*`;

      return await ovl.sendMessage(ms_org, {
        image: { url: "https://files.catbox.moe/2patx3.jpg" },
        caption: fiche,
      }, { quoted: cmd_options.ms });
    }

    if (!prenium_id) return repondre("⚠️ Seuls les membres de la NS peuvent actualiser une team.");

    const modifiables = [
      "users", "team", "niveau",
      "argent", "classement", "wins", "loss", "goals", "trophies",
    ];

    let updates = {};
    for (let i = 1; i < arg.length;) {
      const field = arg[i]?.toLowerCase();
      const op = arg[i + 1];
      if (!modifiables.includes(field) || !["=", "+", "-"].includes(op)) { i++; continue; }

      const isNumeric = [
        "niveau", "argent", "classement",
        "wins", "loss", "goals", "trophies",
      ].includes(field);

      let value;
      if (op === "=" && !isNumeric) {
        let valParts = [], j = i + 2;
        while (j < arg.length && !modifiables.includes(arg[j].toLowerCase())) valParts.push(arg[j++]);
        value = valParts.join(" "); i = j;
      } else {
        value = arg[i + 2]; i += 3;
      }

      if (value !== undefined) {
        if (isNumeric) {
          const val = parseInt(value);
          if (!isNaN(val)) {
            if (op === "=") updates[field] = val;
            else if (op === "+") updates[field] = data[field] + val;
            else if (op === "-") updates[field] = data[field] - val;
          }
        } else if (op === "=") updates[field] = value;
      }
    }

    if (Object.keys(updates).length > 0) {
      const message = await updateTeam(userId, updates);
      return repondre(message);
    } else {
      return repondre("⚠️ Format incorrect ou champ non valide. Exemple : +team @user wins + 2 team = BlueLock Elite");
    }

  } catch (err) {
    console.error("❌ Erreur ligne team:", err);
    return repondre("❌ Une erreur est survenue.");
  }
});
 
ovlcmd({
  nom_cmd: "lineup⚽",
  classe: "Other",
  react: "📋",
  desc: "Afficher ou modifier l'équipe du joueur.",
}, async (ms_org, ovl, cmd_options) => {
  const { arg, repondre, auteur_Message } = cmd_options;
   let userId = auteur_Message;
  if (arg.length >= 1) {
    userId = arg[0];
    if (!userId) return repondre("⚠️ Mentionne un utilisateur.");
  }
  const data = await getLineup(userId);
  if (!data) return repondre("⚠️ Joueur introuvable.");

  if (arg.length <= 1) {
    await ovl.sendMessage(ms_org, {
      video: { url: "https://files.catbox.moe/z64kuq.mp4" },
      caption: "",
      gifPlayback: true
    }, { quoted: cmd_options.ms });

    const lineup = `░░ *👥SQUAD⚽🥅*: ${data.nom}
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▱▱▱▱
1  👤(AG) ${data.joueur1} 
2  👤(AC) ${data.joueur2} 
3  👤(AD) ${data.joueur3} 
4  👤(MG) ${data.joueur4} 
5  👤(MC) ${data.joueur5} 
6  👤(MD) ${data.joueur6} 
7  👤(DG) ${data.joueur7}  
8  👤(DC) ${data.joueur8} 
9  👤(DC) ${data.joueur9}  
10 👤(DD) ${data.joueur10}
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▱▱▱▱
*🔷BENCH🥅*:
11 👤${data.joueur11}
12 👤${data.joueur12}
13 👤${data.joueur13}
14 👤${data.joueur14}
15 👤${data.joueur15}
╰───────────────────
                  *BLUE🔷LOCK* `;

    return await ovl.sendMessage(ms_org, {
      image: { url: "https://files.catbox.moe/p94q3m.jpg" },
      caption: lineup
    }, { quoted: cmd_options.ms });
  }
 
  const updates = {};
  for (let i = 0; i < arg.length; i += 3) {
    if (/^j\d+$/.test(arg[i]) && arg[i + 1] === "=") {
      const index = parseInt(arg[i].slice(1));
      if (index >= 1 && index <= 15) {
        updates[`joueur${index}`] = arg[i + 2];
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    const message = await updatePlayers(userId, updates);
    return repondre(message);
  } else {
    return repondre("⚠️ Format incorrect. Utilise: +lineup j1 = Nom j2 = Nom...");
  }
});

ovlcmd({
    nom: "stats_lineup",
    isfunc: true
}, async (ms_org, ovl, { texte, getJid }) => {
    try {
        if (!texte) return;
        const mots = texte.trim().toLowerCase().split(/\s+/);

        if (mots.length === 4 && mots[0].startsWith("@")) {
            const userW = mots[0].slice(1);
            let userId;
            if (userW.endsWith('lid')) {
                userId = await getJid(userW, ms_org, ovl);
            }

            const joueurKey = mots[1];
            if (/^j\d+$/.test(joueurKey)) {
                const statKey = `stat${joueurKey.replace("j", "")}`;
                const signe = mots[2];
                const valeur = parseInt(mots[3], 10);
                if (!isNaN(valeur) && valeur > 0 && ['+', '-'].includes(signe)) {
                    await updateStats(userId, statKey, signe, valeur);
                }
            }
        } else if (mots.length === 2 && mots[1] === "reset_stats" && mots[0].startsWith("@")) {
            const userW = mots[0].slice(1);
            let userId;
            if (userW.endsWith('lid')) {
                userId = await getJid(userW, ms_org, ovl);
            }
            if (typeof BlueLockFunctions?.resetStats === "function") {
                await BlueLockFunctions.resetStats(userId);
            }
        }
    } catch (e) {
        // console.error("Erreur stats_lineup:", e);
    }
});
