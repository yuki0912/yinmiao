const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');

module.exports = {
    category: "Economy",
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('📅 每日簽到領取銀喵幣 (連續簽到獎勵更多！)'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        try {
            let profile = await UserProfile.findOne({ guildId, userId });

            if (!profile) {
                profile = new UserProfile({ guildId, userId, coins: 0, streak: 0 });
            }

            const now = new Date();
            const lastDaily = profile.lastDaily;
            
            // 🎯 【關鍵修復】使用原生國際化 API 強制鎖定馬來西亞時區 (GMT+8) 格式化日期
            // 💡 註：IANA 官方標準時區必須寫 Asia/Kuala_Lumpur，寫 Asia/Malaysia 機器人會崩潰喔！
            const tzFormatter = new Intl.DateTimeFormat('en-MY', {
                timeZone: 'Asia/Kuala_Lumpur',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });

            const todayStr = tzFormatter.format(now); 
            const lastDailyStr = lastDaily ? tzFormatter.format(lastDaily) : "";

            // 1. 檢查是否今天領過
            if (todayStr === lastDailyStr) {
                // 精準計算馬來西亞時間今晚午夜 (明天的 00:00) 剩餘時間
                const parts = tzFormatter.formatToParts(now);
                const y = parseInt(parts.find(p => p.type === 'year').value);
                const m = parseInt(parts.find(p => p.type === 'month').value) - 1;
                const d = parseInt(parts.find(p => p.type === 'day').value);

                // 馬來西亞為 GMT+8，將馬來西亞明晚 00:00 換算回精確的 UTC 時間戳
                const nextReset = new Date(Date.UTC(y, m, d + 1) - 8 * 60 * 60 * 1000);
                const unixTimestamp = Math.floor(nextReset.getTime() / 1000);

                return await interaction.reply({
                    content: `❌ 你今天已經簽到過囉喵！\n⏰ 下次領取時間：<t:${unixTimestamp}:f> (<t:${unixTimestamp}:R>)`,
                    ephemeral: true
                });
            }

            // 2. 核心邏輯：判斷連續簽到 (減去 24 小時計算馬來西亞時間的昨天)
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const yesterdayStr = tzFormatter.format(yesterday);

            if (lastDailyStr === yesterdayStr) {
                profile.streak = (profile.streak || 0) + 1;
            } else {
                profile.streak = 1; // 斷簽或首次簽到，重置為 1
            }

            // 3. 計算獎勵 (基礎 50~200 + 連續獎勵)
            const baseReward = Math.floor(Math.random() * 151) + 50;
            const streakBonus = Math.min((profile.streak - 1) * 10, 500); 
            const totalReward = baseReward + streakBonus;

            // 4. 更新資料
            profile.coins = (profile.coins || 0) + totalReward;
            profile.lastDaily = now; // 儲存當前完整 Date 物件
            
            await profile.save();

            // 5. 建立回饋 Embed
            const embed = new EmbedBuilder()
                .setColor(profile.streak >= 7 ? '#f1c40f' : '#2ecc71') // 滿一週變金色
                .setTitle('✨ 每日簽到成功')
                .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
                .setDescription(`🎉 恭喜 **${interaction.user.username}**！\n你已連續簽到 **${profile.streak}** 天喵！`)
                .addFields(
                    { name: '💰 基礎獎勵', value: `\`$${baseReward}\` 銀喵幣`, inline: true },
                    { name: '🔥 連續加成', value: `\`+$${streakBonus}\` 銀喵幣`, inline: true },
                    { name: '💳 目前總額', value: `\`$${profile.coins}\` 銀喵幣`, inline: false }
                )
                .setFooter({ text: '連續簽到不中斷，每天加成多 10 幣喵！', iconURL: interaction.guild.iconURL() || undefined })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Daily Streak Error:', error);
            const replyMethod = interaction.replied || interaction.deferred ? 'followUp' : 'reply';
            await interaction[replyMethod]({ 
                content: `❌ 哇！執行每日簽到時發生系統錯誤了喵！\n\`\`\`js\n${error.message}\n\`\`\``, 
                ephemeral: true 
            });
        }
    }
};
