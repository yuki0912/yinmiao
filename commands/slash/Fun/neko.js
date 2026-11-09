const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('neko')
        .setDescription('隨機取得一隻貓耳少女圖片 🐱'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // 直接透過 axios 請求 nekos.best API
            const response = await axios.get('https://nekos.best/api/v2/neko');
            const resultData = response.data?.results?.[0];

            if (!resultData || !resultData.url) {
                return await interaction.editReply({
                    content: '❌ 無法取得圖片，請稍後再試喵！'
                });
            }

            const artistName = String(resultData.artist_name || '未知繪師').slice(0, 150);
            const artistUrl = resultData.artist_href || resultData.source_url || null;

            const embed = new EmbedBuilder()
                .setTitle('🐱 Neko！貓耳少女')
                .setURL(resultData.url)
                .setImage(resultData.url)
                .setColor('#F2A9B4')
                .setDescription(
                    artistUrl
                        ? `🎨 **繪師：** [${artistName}](${artistUrl})`
                        : `🎨 **繪師：** ${artistName}`
                )
                .setFooter({
                    text: `由 ${interaction.user.username} 請求`,
                    iconURL: interaction.user.displayAvatarURL({ extension: 'png', size: 128 })
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                allowedMentions: { parse: [] }
            });

        } catch (error) {
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: '❌ 請求圖片時發生錯誤喵！' });
                } else {
                    await interaction.reply({ content: '❌ 請求圖片時發生錯誤喵！', ephemeral: true });
                }
            } catch (e) {
                // 靜默略過
            }
        }
    }
};
