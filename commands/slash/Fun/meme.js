const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");

module.exports = {
    category:"Fun",
    data: new SlashCommandBuilder()
        .setName("meme")
        .setDescription("從 Reddit 獲取一張迷因圖片"),

    async execute(interaction) {
        // 1. 先延遲回覆
        await interaction.deferReply();

        try {
            // 2. 取得 API 資料
            const res = await axios.get("https://meme-api.com/gimme", { timeout: 5000 });
            let data = res.data;

            // 3. NSFW 檢查 (Slash 模式使用 interaction.channel)
            if (data.nsfw && !interaction.channel.nsfw) {
                return interaction.editReply("🔞 抽到了 NSFW 內容，但在非限時頻道無法顯示。請再試一次！");
            }

            // 4. 建立 Embed
            const embed = new EmbedBuilder()
                .setTitle(data.title.slice(0, 256))
                .setURL(data.postLink)
                .setImage(data.url)
                .setColor("Random")
                .setFooter({ 
                    text: `👍 ${data.ups} | 來源: r/${data.subreddit} | 由 ${interaction.user.tag} 請求`,
                    iconURL: interaction.user.displayAvatarURL() 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error("[Slash Meme Error]:", error.message);
            await interaction.editReply("❌ 獲取迷因時發生錯誤，API 可能暫時斷線。").catch(() => null);
        }
    }
};
