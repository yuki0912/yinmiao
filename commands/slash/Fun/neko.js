const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fetchNekosBest, httpUrl, sendSlashResult, executeSlashWithApi } =
    require('../../../utils/axiosMedia');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('neko')
        .setDescription('使用 axios 從 nekos.best 取得貓耳少女圖片 🐱'),

    async execute(interaction) {
        await executeSlashWithApi(interaction, 'neko', '貓耳少女圖片', async () => {
            const data = await fetchNekosBest('neko');
            const artistName = String(data.artist_name || '未知繪師').slice(0, 150);
            const artistUrl = httpUrl(data.artist_href) || httpUrl(data.source_url);

            const embed = new EmbedBuilder()
                .setTitle('🐱 Neko！貓耳少女')
                .setURL(data.url)
                .setImage(data.url)
                .setColor('#F2A9B4')
                .setDescription(
                    artistUrl
                        ? '🎨 **繪師：** [' + artistName + '](' + artistUrl + ')'
                        : '🎨 **繪師：** ' + artistName
                )
                .setFooter({
                    text: '由 ' + interaction.user.username + ' 請求',
                    iconURL: interaction.user.displayAvatarURL({ extension: 'png', size: 128 })
                })
                .setTimestamp();

            await sendSlashResult(interaction, {
                embeds: [embed],
                allowedMentions: { parse: [] }
            });
        });
    }
};
