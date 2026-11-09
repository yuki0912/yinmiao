const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { fetchNekosBest, sendSlashResult, executeSlashWithApi } =
    require('../../../utils/axiosMedia');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('pat')
        .setDescription('摸摸對方的頭，隨機發送動漫 GIF 👋')
        .addUserOption(option => option
            .setName('目標')
            .setDescription('想摸摸的成員')
            .setRequired(false)),

    async execute(interaction) {
        await executeSlashWithApi(interaction, 'pat', '摸頭動畫', async () => {
            // 正確網址：https://nekos.best/api/v2/pat
            const data = await fetchNekosBest('pat');
            const target = interaction.options.getUser('目標');
            const author = interaction.user;

            const message = target
                ? '<@' + author.id + '> 輕輕摸了摸 <@' + target.id + '> 的頭！🐾'
                : '<@' + author.id + '> 送出了一個溫柔的摸頭！🐾';

            const embed = new EmbedBuilder()
                .setDescription(message)
                .setImage(data.url)
                .setColor('#F2A9B4')
                .setFooter({
                    text: data.anime_name
                        ? '動畫來源：' + String(data.anime_name).slice(0, 200)
                        : '由 ' + author.username + ' 請求'
                })
                .setTimestamp();

            await sendSlashResult(interaction, {
                embeds: [embed],
                allowedMentions: { parse: [], users: target ? [target.id] : [] }
            });
        });
    }
};
