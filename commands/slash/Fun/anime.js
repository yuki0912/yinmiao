const { EmbedBuilder, SlashCommandBuilder } = require('discord.js'); 
const randomanime = require('random-anime');

module.exports = {
    category:"Fun",
    // Slash 指令必须包含 data 和 execute
    data: new SlashCommandBuilder()
        .setName("anime")
        .setDescription("取得隨機動漫圖片 :D"),

    async execute(interaction) {
        // 1. 先延遲回覆 (防止 API 抓圖超時)
        await interaction.deferReply();

        try {
            // 2. 獲取圖片
            const animeImg = randomanime.anime();
            const user = interaction.user;

            if (!animeImg || !animeImg.startsWith('http')) {
                return interaction.editReply("❌ 暫時無法取得圖片，請稍後再試。");
            }

            // 3. 建立 Embed
            const embed = new EmbedBuilder()
                .setTitle("🎌 隨機動漫圖片")
                .setImage(animeImg)
                .setColor('Random')
                .setFooter({ 
                    text: `由 ${user.tag} 請求`, 
                    iconURL: user.displayAvatarURL({ forceStatic: false }) 
                })
                .setTimestamp();

            // 4. 發送結果
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(`[Slash Anime Error]: ${error.message}`);
            await interaction.editReply("❌ 執行動令時發生錯誤。").catch(() => null);
        }
    }
};
