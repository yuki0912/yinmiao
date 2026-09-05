const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const translate = require('google-translate-api-x');

module.exports = {
    category:"Fun",
    data: new SlashCommandBuilder()
        .setName("translate")
        .setDescription("🌐 全球語言翻譯")
        .addStringOption(opt => opt.setName('內容').setDescription('要翻譯的文字').setRequired(true))
        .addStringOption(opt => opt.setName('語言').setDescription('目標語言代碼 (預設 zh-TW, 可選 en, ja, ko 等)').setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        const text = interaction.options.getString('內容');
        const targetLang = interaction.options.getString('語言') || 'zh-TW';

        try {
            const res = await translate(text, { to: targetLang });

            const embed = new EmbedBuilder()
                .setTitle("🌐 翻譯結果")
                .setColor("#5865F2")
                .addFields(
                    { name: "📥 原文", value: `\`\`\`${text}\`\`\`` },
                    { name: `📤 翻譯 (${res.from.language.iso} ➔ ${targetLang})`, value: `\`\`\`${res.text}\`\`\`` }
                )
                .setFooter({ text: `由 ${interaction.user.tag} 請求`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (e) {
            console.error(e);
            await interaction.editReply("❌ 翻譯失敗，請檢查語言代碼是否正確。");
        }
    }
};
