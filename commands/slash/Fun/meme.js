const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { httpUrl, sendSlashResult, executeSlashWithApi } =
    require('../../../utils/axiosMedia');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('使用 axios 從 Reddit 隨機取得迷因圖片'),

    async execute(interaction) {
        await executeSlashWithApi(interaction, 'meme', '迷因圖片', async () => {
            const allowNsfw = interaction.channel?.nsfw === true ||
                interaction.channel?.parent?.nsfw === true;

            let memeData = null;
            // API 偶爾抽到 NSFW；一般頻道自動換下一張，不公開敏感圖片。
            for (let attempt = 0; attempt < 3; attempt++) {
                const response = await axios.get('https://meme-api.com/gimme', {
                    timeout: 8000,
                    headers: { 'User-Agent': 'YinMiao (https://github.com/yuki0912/yinmiao)' }
                });
                const data = response.data;
                if (!httpUrl(data?.url) || data?.spoiler) continue;
                if (data.nsfw && !allowNsfw) continue;
                memeData = data;
                break;
            }

            if (!memeData) {
                await sendSlashResult(interaction, {
                    content: '🔞 這次沒有抽到適合目前頻道的迷因，請再試一次。'
                });
                return;
            }

            const title = String(memeData.title || '隨機迷因').slice(0, 250);
            const subreddit = String(memeData.subreddit || 'Reddit').slice(0, 70);
            const upvotes = Number.isFinite(Number(memeData.ups))
                ? Number(memeData.ups).toLocaleString()
                : '—';

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setImage(httpUrl(memeData.url))
                .setColor('#F2A9B4')
                .setFooter({
                    text: '👍 ' + upvotes + ' | 來源：r/' + subreddit +
                        ' | 由 ' + interaction.user.username + ' 請求',
                    iconURL: interaction.user.displayAvatarURL({ extension: 'png', size: 128 })
                })
                .setTimestamp();

            const postUrl = httpUrl(memeData.postLink);
            if (postUrl) embed.setURL(postUrl);

            await sendSlashResult(interaction, {
                embeds: [embed],
                allowedMentions: { parse: [] }
            });
        });
    }
};
