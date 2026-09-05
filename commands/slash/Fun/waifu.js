const { SlashCommandBuilder, EmbedBuilder } = require('discord.js'); // 刪除了未使用的 MessageFlags
const axios = require('axios');

module.exports = {
    category: "Fun",
    data: new SlashCommandBuilder()
        .setName('waifu')
        .setDescription('從 nekos.best 獲取一張隨機老婆圖片 ✨'),

    async execute(interaction) {
        // 1. 進入思考狀態 (延時回應)
        // 💡 提示：如果 interaction 已經被 reply 過，這裡會報錯，確保 execute 只被呼叫一次
        await interaction.deferReply();

        try {
            // 2. 獲取 API 資料
            // 💡 增加 timeout 到 10 秒，防止網路波動
            const res = await axios.get("https://nekos.best/api/v2/waifu", { 
                timeout: 10000,
                headers: { 'User-Agent': 'DiscordBot' } 
            });

            // 檢查回應內容是否存在
            if (!res.data || !res.data.results || res.data.results.length === 0) {
                throw new Error("API 回傳資料格式不正確");
            }

            const data = res.data.results[0];

            if (!data.url) {
                return await interaction.editReply({ 
                    content: "❌ 暫時無法獲取圖片網址，請稍後再試。" 
                });
            }

            // 3. 處理繪師資訊與連結
            const artistDisplay = data.artist_href 
                ? `[${data.artist_name}](${data.artist_href})` 
                : `\`${data.artist_name || "未知"}\``;

            // 4. 建立 Embed
            const embed = new EmbedBuilder()
                .setTitle("✨ 你的專屬老婆已送達！")
                .setURL(data.url)
                .setImage(data.url)
                .setColor("#FFB6C1") // 櫻花粉色
                .setDescription(`🎨 **繪師資訊：** ${artistDisplay}`)
                .setFooter({ 
                    text: `請求者：${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                });

            // 5. 回傳結果
            await interaction.editReply({ embeds: [embed] });

        } catch (e) {
            // 🚩 在控制台印出完整的錯誤資訊，方便你除錯
            console.error(`[Slash Waifu Error]:`, e.response ? e.response.data : e.message);
            
            // 根據不同錯誤給予提示
            let errorContent = "❌ 獲取圖片時發生內部錯誤，可能是 API 暫時離線。";
            if (e.code === 'ECONNABORTED') errorContent = "❌ 連線超時，請再試一次。";

            // 使用 editReply 因為前面已經 deferReply 了
            await interaction.editReply({ content: errorContent }).catch(() => null);
        }
    }
};
