const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('time')
        .setDescription('顯示一個會自動更新的實時時鐘，讓主人知道現在幾點喵！'),

    async execute(interaction) {
        
        // 1. 建立 Embed 的函數
        const createClockEmbed = (isStopped = false) => {
            const now = new Date();
            const timestamp = Math.floor(now.getTime() / 1000);
            
            // 💡 Discord 內建動態時間戳記會在用戶的手機/電腦螢幕上「自己跳秒」喔！
            const discordTime = `<t:${timestamp}:T>`;
            const discordDate = `<t:${timestamp}:D>`;

            return new EmbedBuilder()
                .setColor(isStopped ? '#808080' : '#ffb7c5') // 停止後變灰色
                .setTitle(isStopped ? '⏱️ 時鐘已停止休息' : '⏱️ 銀喵實時時鐘')
                .setDescription(isStopped ? '時鐘累了，請重新輸入指令召喚喵～' : '這是銀喵為您準備的精準時間喔！')
                .addFields(
                    { name: '📅 當前日期', value: discordDate, inline: true },
                    { name: '🕒 精準時間', value: discordTime, inline: true }
                )
                .setThumbnail(interaction.client.user.displayAvatarURL()) // 💡 自動從 interaction 抓取 client
                .setFooter({ text: isStopped ? '已運行 5 分鐘上限' : '為了不被 Discord 討厭，銀喵每 5 秒會整理一次錶面喵！' })
                .setTimestamp();
        };

        try {
            // 2. 發送初始回覆
            await interaction.reply({ embeds: [createClockEmbed()] });

            // 3. 設定定時器 (每 5 秒刷新一次 Embed 的右下角時間戳)
            let count = 0;
            const interval = setInterval(async () => {
                count += 5; // 每次跳 5 秒

                // 安全機制：運行 300 秒 (5 分鐘) 後停止
                if (count > 300) {
                    clearInterval(interval);
                    return await interaction.editReply({ embeds: [createClockEmbed(true)] }).catch(() => null);
                }

                // 執行編輯更新 (直接使用 interaction.editReply，不需要額外宣告變數，更安全)
                await interaction.editReply({ embeds: [createClockEmbed()] }).catch(err => {
                    // 🔒 如果使用者把訊息刪掉了，或是頻道關閉了，直接清除計時器防止記憶體洩漏
                    clearInterval(interval);
                });
            }, 5000);

        } catch (error) {
            console.error('Time Command Error:', error);
        }
    }
};
