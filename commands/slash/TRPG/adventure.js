const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const TRPG = require('../../../models/TRPG');

module.exports = {
    category: 'TRPG',
    data: new SlashCommandBuilder()
        .setName('adventure')
        .setDescription('🧭 消耗 50 銀喵幣開啟一場隨機冒險'),

    async execute(interaction) {
        const { user, guild } = interaction;
        await interaction.deferReply().catch(() => { });

        try {
            // 1. 取得玩家經濟檔案
            let profile = await UserProfile.findOne({ guildId: guild.id, userId: user.id });
            if (!profile || (profile.coins ?? 0) < 50) {
                return interaction.editReply("❌ 冒險需要 50 銀喵幣購買備品與裝備，你口袋裡的錢不夠喔！");
            }

            // 2. 取得 TRPG 角色卡（優先連動伺服器專屬卡，無則讀取個人預設卡）
            const charData = await TRPG.findOne({ userId: user.id, guildId: guild.id })
                || await TRPG.findOne({ userId: user.id });

            // 3. 事件池 (對應 6 大屬性)
            const events = [
                { text: "你在遺跡深處遇到一道巨石阻擋的石門。", stat: "str", statName: "力量", dc: 12, win: "你猛力推開巨石，發現了前人留下的寶箱！", lose: "石門紋絲不動，你不僅沒推開還閃到了腰。" },
                { text: "暗巷中突然射出一道冰冷的暗箭！", stat: "dex", statName: "敏捷", dc: 11, win: "你一個俐落的側翻完美躲過，順手撿起地上的銀幣。", lose: "你反應太慢被箭擦傷，狼狽地逃離現場。" },
                { text: "飲用酒館神祕老者提供的不明高濃縮藥水。", stat: "con", statName: "體質", dc: 12, win: "藥水激發了你的潛能，強身健體並感覺神清氣爽！", lose: "藥水讓你上吐下瀉，折騰了整整一個晚上。" },
                { text: "古老圖書館的牆上刻著複雜的魔法符文陣。", stat: "int", statName: "智力", dc: 13, win: "你順利解讀符文導引出魔力，解開了封印寶庫！", lose: "符文過於深奧，你看到頭暈目眩什麼都沒看懂。" },
                { text: "迷霧森林中傳來詭異低語聲與隱密陷阱。", stat: "wis", statName: "感知", dc: 12, win: "你及時察覺周圍的危險，繞過陷阱並發現隱藏小徑。", lose: "你誤入陷阱迷失方向，耗費大量時間才脫困。" },
                { text: "遭遇路過的商隊，正嘗試與精明的商人討價還價。", stat: "cha", statName: "魅力", dc: 11, win: "你憑藉過人的口才說服商人，拿到了超值的冒險津貼！", lose: "商人嫌棄你的態度，將你轟出了營地。" }
            ];

            const event = events[Math.floor(Math.random() * events.length)];

            // 4. 計算屬性修正值 (優先調用 TRPG Schema 方法)
            let modifier = 0;
            if (charData) {
                modifier = charData.getModifier(event.stat);
            } else if (profile.stats && profile.stats[event.stat] !== undefined) {
                modifier = Math.floor((profile.stats[event.stat] - 10) / 2);
            }

            const roll = Math.floor(Math.random() * 20) + 1;
            const total = roll + modifier;

            // 5. 勝負判定
            const isCritSuccess = roll === 20;
            const isCritFail = roll === 1;
            const success = isCritSuccess ? true : (isCritFail ? false : total >= event.dc);

            // 6. 結算基礎銀幣與 XP
            profile.coins = (profile.coins || 0) - 50;
            profile.xp = profile.xp || 0;

            let rewardCoins = 0;
            let rewardXp = 0;
            let outcomeTitle = "";

            if (isCritSuccess) {
                rewardCoins = 150;
                rewardXp = 35;
                outcomeTitle = "🎉 **大成功 (Critical Success)！** 超乎預期的完美表現！";
            } else if (isCritFail) {
                rewardCoins = 0;
                rewardXp = 0;
                outcomeTitle = "💥 **大失敗 (Critical Failure)！** 災難性的慘敗！";
            } else if (success) {
                rewardCoins = 100;
                rewardXp = 20;
                outcomeTitle = "✅ **成功！** 順利克服危機！";
            } else {
                rewardCoins = 0;
                rewardXp = 5;
                outcomeTitle = "❌ **失敗！** 任務功敗垂成...";
            }

            profile.coins += rewardCoins;
            profile.xp += rewardXp;
            await profile.save();

            // 7. TRPG 角色卡升級邏輯
            let levelUpField = null;
            let currentLevel = 1;
            let currentXp = 0;
            let nextLevelXp = 100;

            if (charData) {
                charData.exp = (charData.exp || 0) + rewardXp;
                charData.level = charData.level || 1;

                const oldLevel = charData.level;
                let totalHpGained = 0;
                let boostedStatsText = [];

                // 檢查並處理升級（支援連續升級）
                while (charData.exp >= charData.level * 100) {
                    charData.exp -= charData.level * 100;
                    charData.level += 1;

                    // 7a. 計算 Max HP 成長 (利用 Schema 的 getModifier)
                    const conMod = charData.getModifier('con');
                    const hpGain = Math.max(2, (Math.floor(Math.random() * 6) + 1) + conMod + 2);
                    charData.maxHp = (charData.maxHp || 10) + hpGain;
                    totalHpGained += hpGain;

                    // 7b. 隨機提升一項屬性 (+1)，最高限制 30
                    const statNames = { str: '力量', dex: '敏捷', con: '體質', int: '智力', wis: '感知', cha: '魅力' };
                    const statKeys = Object.keys(statNames);
                    const boostedKey = statKeys[Math.floor(Math.random() * statKeys.length)];

                    if (charData.attributes[boostedKey] < 30) {
                        charData.attributes[boostedKey] += 1;
                        boostedStatsText.push(`**${statNames[boostedKey]}** ➔ ${charData.attributes[boostedKey]}`);
                    }
                }

                // 觸發升級時補滿血量並建構提示訊息
                if (charData.level > oldLevel) {
                    charData.hp = charData.maxHp;

                    levelUpField = {
                        name: '🎊 LEVEL UP！角色等級提升！',
                        value: `✨ **${charData.name}** 成長到了新高度！\n` +
                            `⭐ **等級**：Lv.${oldLevel} ➔ **Lv.${charData.level}**\n` +
                            `💚 **最大生命 (HP)**：+${totalHpGained} (現已完整修復至 ${charData.maxHp} HP)\n` +
                            `📈 **屬性成長**：${boostedStatsText.join(', ') || '屬性已達上限'}`,
                        inline: false
                    };
                }

                currentLevel = charData.level;
                currentXp = charData.exp;
                nextLevelXp = charData.level * 100;

                await charData.save();
            } else {
                currentXp = profile.xp;
            }

            // 8. 構建 Embed 訊息
            const modStr = charData ? charData.getModifierString(event.stat) : (modifier >= 0 ? `+${modifier}` : `${modifier}`);
            const actorName = charData ? `${charData.class.emoji} **${charData.name}**` : `👤 **${user.username}**`;

            const embed = new EmbedBuilder()
                .setAuthor({ name: `${user.username} 的冒險紀錄`, iconURL: user.displayAvatarURL({ forceStatic: false }) })
                .setTitle("⚔️ 隨機冒險事件")
                .setColor(levelUpField ? '#F1C40F' : (success ? '#2ECC71' : '#E74C3C'))
                .setDescription(`${actorName} 進入了未知領域...\n\n📖 **情境：** ${event.text}\n\n${outcomeTitle}`)
                .addFields(
                    {
                        name: '🎲 屬性檢定',
                        value: `**${event.statName} (${event.stat.toUpperCase()})**: d20 (${roll}) ${modStr} = **${total}** (目標 DC ${event.dc})`,
                        inline: false
                    },
                    {
                        name: '📝 冒險結局',
                        value: success ? `${event.win}` : `${event.lose}`,
                        inline: false
                    },
                    {
                        name: '🎁 結算獎勵',
                        value: `🪙 **銀喵幣：** -50 ${rewardCoins > 0 ? `+${rewardCoins} (淨賺 +${rewardCoins - 50})` : ''}\n⭐ **經驗值：** +${rewardXp} XP`,
                        inline: false
                    }
                );

            if (levelUpField) {
                embed.addFields(levelUpField);
            }

            embed.setFooter({
                text: charData
                    ? `🎭 Lv.${currentLevel} ${charData.name} (${charData.hp}/${charData.maxHp} HP) | 🎯 經驗值: ${currentXp}/${nextLevelXp} XP | 💰 餘額: ${profile.coins} 銀喵幣`
                    : `💰 目前總餘額：${profile.coins} 銀喵幣 | 累計 XP: ${profile.xp}`
            }).setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error('冒險指令發生錯誤:', err);
            await interaction.editReply("❌ 冒險發生意外錯誤，請稍後再試。");
        }
    }
};