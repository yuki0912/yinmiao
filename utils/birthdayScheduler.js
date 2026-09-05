const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const BirthdayModel = require('../models/Birthday.js');
// 🐾 若有伺服器設定模型（儲存各伺服器指定的慶生頻道 ID），可在此引入
const GuildConfigModel = require('../models/GuildConfig.js'); 

/**
 * 取得當前時區 (Asia/Taipei) 的 MM/DD 字串
 */
function getTodayDateString() {
    const now = new Date();
    // 強制轉換為台灣/香港/新加坡等 UTC+8 時區字串
    const options = { timeZone: 'Asia/Kuala_Lumpur', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const [{ value: month }, , { value: day }] = formatter.formatToParts(now);
    return `${month}/${day}`;
}

/**
 * 執行生日檢查與發送任務
 * @param {import('discord.js').Client} client 
 */
async function checkAndSendBirthdays(client) {
    const todayStr = getTodayDateString();
    console.log(`[🎂 生日排程] 開始檢查今日 (${todayStr}) 壽星...`);

    try {
        // 1. 搜尋所有當天生日的使用者
        const birthdayRecords = await BirthdayModel.find({ birthday: todayStr });

        if (!birthdayRecords || birthdayRecords.length === 0) {
            console.log(`[🎂 生日排程] 今日 (${todayStr}) 沒有壽星喵～`);
            return;
        }

        // 2. 將壽星依 Guild ID 分組，避免跨伺服器訊息混亂
        const guildMap = new Map();
        for (const record of birthdayRecords) {
            if (!guildMap.has(record.guildId)) {
                guildMap.set(record.guildId, []);
            }
            guildMap.get(record.guildId).push(record.userId);
        }

        // 3. 逐一伺服器發送祝賀 Embed
        for (const [guildId, userIds] of guildMap.entries()) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) continue;

            // 🐾 取得目標頻道 ID（優先讀取資料庫設定，無設定則預設找系統頻道或名字帶有 birthday / 聊天 頻道）
            let channelId = null;
            if (GuildConfigModel) {
                const config = await GuildConfigModel.findOne({ guildId });
                channelId = config?.birthdayChannelId;
            }

            // 防呆：若無設定頻道，自動搜尋名稱包含 "生日"、"birthday" 或伺服器預設頻道
            const targetChannel = channelId 
                ? guild.channels.cache.get(channelId)
                : guild.channels.cache.find(c => c.isTextBased() && (c.name.includes('birthday') || c.name.includes('生日'))) 
                  || guild.systemChannel;

            if (!targetChannel || !targetChannel.isTextBased()) {
                console.warn(`[⚠️ 生日排程] 伺服器 ${guild.name} (${guildId}) 找不到合適的發送頻道。`);
                continue;
            }

            // 組裝 Mention 名單
            const mentions = userIds.map(id => `<@${id}>`).join(' ');

            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('🎉 喵！今天是超級大壽星的日子！🎂')
                .setDescription(`讓我們一起祝以下小夥伴生日快樂祝賀喵！✨\n\n${mentions}\n\n願你新的一歲充滿貓咪、歡笑與滿滿的幸運！🐾💖`)
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ text: '銀喵生日廣播系統', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            await targetChannel.send({ content: `🔔 叮咚！壽星廣播時間～ ${mentions}`, embeds: [embed] });
            console.log(`[✅ 生日發送成功] 已於 ${guild.name} 的 #${targetChannel.name} 發送 ${userIds.length} 位壽星祝賀。`);
        }
    } catch (error) {
        console.error('[❌ 生日排程] 執行排程時發生錯誤：', error);
    }
}

/**
 * 初始化生日排程任務
 * @param {import('discord.js').Client} client 
 */
function initBirthdayScheduler(client) {
    // ⏰ 設定每天 00:00 (台北時區) 自動執行
    // 格式：秒(可省略) 分 時 日 月 星期
    cron.schedule('0 0 * * *', () => {
        checkAndSendBirthdays(client);
    }, {
        scheduled: true,
        timezone: "Asia/Taipei"
    });

    console.log('🌸 生日定時排程器已啟動 (每日 00:00 執行)');
}

module.exports = { initBirthdayScheduler, checkAndSendBirthdays };