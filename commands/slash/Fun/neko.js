const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    category: "Fun",
    // 💡 資料定義
    data: new SlashCommandBuilder()
        .setName('neko')
        .setDescription('從 nekos.best 獲取一張可愛的貓耳少女圖片喵 🐱'),

    async execute(interaction) {
        // 1. 進入思考狀態，告訴 Discord 我們正在處理中 (最多可等待 15 分鐘)
        await interaction.deferReply();

        try {
            // 2. 發送 API 請求
            const res = await axios.get("https://nekos.best/api/v2/neko", { 
                timeout: 8000,
                headers: { 'User-Agent': 'YinMiaoBot/1.0' }
            });
            
            const data = res.data?.results?.[0];

            // 檢查資料有效性
            if (!data || !data.url) {
                return await interaction.editReply({ 
                    content: "❌ 哎呀... 無法從圖片伺服器獲取內容，請稍後再試喵。" 
                });
            }

            // 3. 處理繪師連結邏輯
            const artistName = data.artist_name || "未知繪師";
            const artistUrl = data.artist_href || data.source_url || "https://nekos.best/";

            // 4. 構建 Embed (銀喵粉配色)
            const embed = new EmbedBuilder()
                .setTitle("🏮 Neko! 喵~ 🐱")
                .setURL(data.url)
                .setImage(data.url)
                .setColor("#ffb7c5") // 統一銀喵粉色
                .setDescription(`🎨 **繪師：** [${artistName}](${artistUrl})`)
                .setFooter({ 
                    text: `請求者：${interaction.user.username} 🐾`, 
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
                })
                .setTimestamp();

            // 5. 使用 editReply 發送結果
            await interaction.editReply({ embeds: [embed] });

        } catch (e) {
            console.error(`[Slash Neko Error]: ${e.message}`);
            
            // 根據錯誤類型給予回饋
            let errorText = "❌ 獲取貓貓圖片時發生錯誤喵！";
            if (e.code === 'ECONNABORTED') errorText = "❌ API 回應超時，召喚失敗了喵...";

            await interaction.editReply({ content: errorText }).catch(() => null);
        }
    }
};
