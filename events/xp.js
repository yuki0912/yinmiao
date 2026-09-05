const { Events } = require('discord.js');
const UserProfile = require('../models/UserProfile'); // 串接妳的用戶資料模型

const xpCooldowns = new Set();

/**
 * 💡 Mee6 標準公式：計算「達到某等級所需的總累積經驗值門檻」
 * 用來精準判斷每次發話後是否達到升等門檻
 */
const getTotalXpForLevel = (lvl) => {
    let total = 0;
    for (let i = 1; i < lvl; i++) {
        total += 5 * (i ** 2) + 50 * i + 100;
    }
    return total;
};

module.exports = {
    name: Events.MessageCreate, 
    async execute(message, client) { 
        // 排除機器人、私訊以及沒有成員資料 transition 的特殊狀況
        if (message.author.bot || !message.guild || !message.member) return;

        const userId = message.author.id;
        const guildId = message.guild.id;

        // 1分鐘發話經驗值冷卻檢查
        if (!xpCooldowns.has(userId)) {
            try {
                // 隨機給予 5~15 點經驗值
                const xpToAdd = Math.floor(Math.random() * 11) + 5; 
                
                // 精準對接並更新資料庫
                let profile = await UserProfile.findOneAndUpdate(
                    { guildId, userId },
                    { $inc: { xp: xpToAdd, weeklyExp: xpToAdd } }, 
                    { upsert: true, new: true } 
                );

                let currentLevel = profile.level || 1;
                let leveledUp = false;

                // 判斷是否滿足連續升級的條件
                while (profile.xp >= getTotalXpForLevel(currentLevel + 1)) {
                    currentLevel++;
                    leveledUp = true;
                }

                // ====================================================
                // 🎊 觸發升級：改為乾淨流暢的純文字通知
                // ====================================================
                if (leveledUp) {
                    profile.level = currentLevel;
                    await profile.save();

                    // 發送純文字升級祝福，並加粗顯示新等級
                    const levelMsg = await message.channel.send({
                        content: `🎊 恭喜 ${message.author} 升級到 **Lv.${profile.level}** 囉喵！🐾`
                    }).catch(() => null);

                    // 保持原本的貼心設計：7秒後自動刪除升級訊息，避免洗頻
                    if (levelMsg) {
                        setTimeout(() => levelMsg.delete().catch(() => null), 7000);
                    }
                }

                // 觸發冷卻防刷機制
                xpCooldowns.add(userId);
                setTimeout(() => xpCooldowns.delete(userId), 60000);
            } catch (err) {
                console.error('XP 獨立系統執行出錯:', err);
            }
        }
    },
};
