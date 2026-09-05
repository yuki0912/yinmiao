const { Events, EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig'); // 預留給未來伺服器自訂設定使用

const prefix = process.env.PREFIX || 's!';

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        // --- 🔴 基礎安全過濾 ---
        if (message.author.bot || !message.guild || !message.member) return;

        const content = message.content.toLowerCase().trim();

        // =========================================================================
        // 🛡️ 🌟 唯一防禦地雷：只要「照片/檔案 + Tag Everyone」就立刻粉碎 🌟
        // =========================================================================

        const triesToTagEveryone = message.mentions.everyone || content.includes('@everyone') || content.includes('@here');
        const hasAttachments = message.attachments.size > 0;

        if (triesToTagEveryone && hasAttachments) {
            try {
                await message.delete().catch(() => { });

                const warningEmbed = new EmbedBuilder()
                    .setTitle('🚨 系統自動防禦攔截通知 🚨')
                    .setDescription(`偵測到違規「照片 + 標記全體」的惡意行為，已由銀喵保鑣自動粉碎！`)
                    .addFields(
                        { name: '違規成員', value: `${message.author}`, inline: true },
                        { name: '處置動作', value: '🗑️ 刪除訊息與檔案 + 🚫 自動禁言 24 小時', inline: true }
                    )
                    .setColor('#FF0000')
                    .setTimestamp();

                await message.channel.send({ embeds: [warningEmbed] }).catch(() => { });

                if (message.member && message.member.moderatable) {
                    await message.member.timeout(86400000, '發送惡意照片/檔案訊息並企圖標記全體 (AutoMod)').catch(console.error);
                }

                return;
            } catch (error) {
                console.error('執行自動防禦時出錯:', error);
            }
        }

        // =========================================================================
        // 🐦 🌟 X / Twitter 超連結自動修復（雙重防漏 + 正確預覽） 🌟
        // =========================================================================
        const twitterRegex = /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/g;
        const matches = [...message.content.matchAll(twitterRegex)];

        if (matches.length > 0) {
            const convertedLinks = matches.map(match => {
                const username = match[1];
                const statusId = match[2];
                const fxUrl = `https://fxtwitter.com/${username}/status/${statusId}`;
                const rawUrl = `https://x.com/${username}/status/${statusId}`;
                const usnUrl = `https://x.com/${username}/`;

                // ⚠️ 注意：
                // 1. rawUrl 加 < > 可以徹底禁止產生 x.com 的重複預覽卡片
                // 2. fxUrl 不能加 < >，否則 Discord 會把 FxTwitter 的媒體預覽也一起關掉
                return `**[Tweet](<${rawUrl}>) ‖ [ACC](<${usnUrl}>) ‖ [X URL](${fxUrl}) **`;
            });

            try {
                // 發送修復後的連結
                await message.channel.send({
                    content: convertedLinks.join('\n'),
                    allowedMentions: { repliedUser: false }
                }).catch(() => { });

                // 1. 立即關閉原訊息預覽
                await message.suppressEmbeds(true).catch(() => { });

                // 2. 延遲 1.5 秒再次關閉（防範 Discord 異步載入原生預覽的時間差）
                setTimeout(async () => {
                    await message.suppressEmbeds(true).catch(() => { });
                }, 1500);

            } catch (error) {
                console.error('執行 FxTwitter 連結轉換時出錯:', error);
            }
        }

        // =========================================================================
        // --- 🟢 自動回覆關鍵字系統 ---
        const morningKeywords = ['早安'];
        if (morningKeywords.some(g => content.includes(g)) && content.length < 10) {
            return message.channel.send('早安喵！✨').catch(() => null);
        }

        const afternoonKeywords = ['午安'];
        if (afternoonKeywords.some(g => content.includes(g)) && content.length < 10) {
            return message.channel.send('午安喵！✨').catch(() => null);
        }

        if (content === '機器人' || content === 'yinmiao bot') {
            const infoEmbed = new EmbedBuilder()
                .setColor('#ffb7c5')
                .setTitle('🤖 銀喵助手資訊')
                .setDescription('你好！我是銀喵，你的專屬夥伴喵！')
                .addFields(
                    { name: '🛠️ 前綴', value: `\`${prefix}\``, inline: true },
                    { name: '📊 等級', value: '聊天即可獲取 XP', inline: true },
                    { name: 'Github', value: '[Github](https://github.com/yuki0912/yinmiao)', inline: true },
                )
                .setTimestamp();
            return message.channel.send({ embeds: [infoEmbed] }).catch(() => null);
        }

        // --- 🔵 Prefix 傳統指令處理 ---
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = client.prefixCommands.get(commandName) ||
            client.prefixCommands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) return;

        if (command.permissions) {
            if (!message.member.permissions.has(command.permissions)) {
                const permsMsg = await message.channel.send(`❌ <@${message.author.id}> 你沒有權限使用此指令喵。`).catch(() => null);
                if (permsMsg) setTimeout(() => permsMsg.delete().catch(() => null), 3000);
                return;
            }
        }

        try {
            const runFunction = command.execute || command.run || (typeof command === 'function' ? command : null);

            if (runFunction) {
                await runFunction(message, args, client);
            } else {
                console.error(`❌ 指令錯誤: [${commandName}] 結構不正確。`);
                message.channel.send(`❌ 指令檔案結構錯誤，請檢查 \`${commandName}.js\` 喵。`).catch(() => null);
            }
        } catch (error) {
            console.error(`執行指令 ${commandName} 時出錯:`, error);

            message.channel.send('❌ 執行指令時，銀喵端的大腦突然打結了...請檢查後台 Log 喵。')
                .then(msg => setTimeout(() => msg.delete().catch(() => null), 5000))
                .catch(() => null);
        }
    },
};
