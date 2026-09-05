const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const axios = require("axios");

module.exports = {
    category: "Fun",
    data: new SlashCommandBuilder()
        .setName("pat") 
        .setDescription("摸摸對方的頭 👋")
        .addUserOption(opt => opt.setName("目標").setDescription("你想互動的成員")),

    async execute(interaction) {
        await interaction.deferReply();
        const cmd = interaction.commandName; // 自動抓取指令名
        const target = interaction.options.getUser("目標");
        const user = interaction.user;

        try {
            // 🚩 修正：URL 格式應為 /api/v2/指令名
            const res = await axios.get(`https://nekos.best{cmd}`, { timeout: 5000 });
            const data = res.data?.results?.[0];

            if (!data) throw new Error("無數據");

            const actions = { 
                cry: "哭了...", 
                hug: "抱住了", 
                kiss: "親吻了", 
                pat: "摸了摸", 
                punch: "給了一拳", 
                slap: "甩了一巴掌", 
                smug: "露出了得意的笑容",
                smile: "對著你笑了笑"
            };

            const actionText = target 
                ? `**${user.username}** ${actions[cmd] || '互動了'} **${target.username}**` 
                : `**${user.username}** ${actions[cmd] || '執行了動作'}`;

            const embed = new EmbedBuilder()
                .setDescription(actionText)
                .setImage(data.url)
                .setColor("Random")
                .setFooter({ text: data.anime_name ? `動畫來源: ${data.anime_name}` : `由 ${user.tag} 請求` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (e) {
            console.error("Nekos API Error:", e.message);
            await interaction.editReply("❌ 暫時無法獲取圖片，請稍後再試。").catch(() => null);
        }
    }
};
